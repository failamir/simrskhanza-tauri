/// In-App Notification System
/// Generates notifications from live DB data — no extra table needed.
/// Reads existing tables to surface actionable alerts.

use mysql_async::{prelude::*, Pool};
use tauri::State;
use serde::{Deserialize, Serialize};
use crate::db::DbState;

// ─────────────────────────── STRUCTS ──────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Notifikasi {
    pub id: String,
    pub kategori: String,    // "antrian" | "lab" | "kasir" | "ranap" | "bpjs" | "igd"
    pub judul: String,
    pub pesan: String,
    pub waktu: String,
    pub level: String,       // "info" | "warning" | "success" | "danger"
    pub link_to: String,     // route to navigate to
    pub data_ref: String,    // no_rawat / no_sep / noorder
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct NotifSummary {
    pub total: i64,
    pub antrian_menunggu: i64,
    pub lab_pending: i64,
    pub billing_pending: i64,
    pub ranap_baru: i64,
    pub igd_belum_triase: i64,
}

// ──────────────────────────── HELPER ──────────────────────────────

fn get_pool(state: &State<'_, DbState>) -> Result<Pool, String> {
    let guard = state.pool.lock().unwrap();
    guard.as_ref().ok_or_else(|| "Database not initialized".to_string()).cloned()
}

// ──────────────────────────── COMMANDS ────────────────────────────

/// Baca semua notifikasi aktif dari database hari ini
#[tauri::command]
pub async fn get_notifikasi(
    state: State<'_, DbState>,
) -> Result<Vec<Notifikasi>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let mut notifs: Vec<Notifikasi> = Vec::new();

    // 1. Antrian dipanggil tapi belum selesai
    let antrian: Vec<(String, String, String)> = conn.query(
        "SELECT IFNULL(a.no_rawat,''), IFNULL(p.nm_pasien,''), \
         IFNULL(TIME_FORMAT(a.jam_panggil,'%H:%i'),'') \
         FROM antrian_loket a \
         LEFT JOIN reg_periksa rp ON a.no_rawat=rp.no_rawat \
         LEFT JOIN pasien p ON rp.no_rkm_medis=p.no_rkm_medis \
         WHERE a.tgl_antrian=CURDATE() AND a.status_panggil='Dipanggil' \
         AND a.status_selesai='Belum' \
         ORDER BY a.jam_panggil DESC LIMIT 5"
    ).await.unwrap_or_default();

    for (no_rawat, nm, jam) in antrian {
        notifs.push(Notifikasi {
            id: format!("antr-{}", no_rawat),
            kategori: "antrian".into(),
            judul: "Antrian Dipanggil".into(),
            pesan: format!("{} dipanggil jam {} belum hadir", nm, jam),
            waktu: jam,
            level: "warning".into(),
            link_to: "/antrian".into(),
            data_ref: no_rawat,
        });
    }

    // 2. Lab menunggu hasil (permintaan tanpa hasil)
    let lab_pending: Vec<(String, String, String)> = conn.query(
        "SELECT pl.noorder, IFNULL(p.nm_pasien,''), \
         IFNULL(TIME_FORMAT(pl.jam_permintaan,'%H:%i'),'') \
         FROM permintaan_lab pl \
         LEFT JOIN reg_periksa rp ON pl.no_rawat=rp.no_rawat \
         LEFT JOIN pasien p ON rp.no_rkm_medis=p.no_rkm_medis \
         LEFT JOIN detail_periksa_lab dpl ON pl.noorder=dpl.noorder \
         WHERE pl.tgl_permintaan=CURDATE() AND dpl.noorder IS NULL \
         GROUP BY pl.noorder \
         ORDER BY pl.jam_permintaan ASC LIMIT 5"
    ).await.unwrap_or_default();

    for (noorder, nm, jam) in lab_pending {
        notifs.push(Notifikasi {
            id: format!("lab-{}", noorder),
            kategori: "lab".into(),
            judul: "Hasil Lab Pending".into(),
            pesan: format!("{} — order {} menunggu input hasil", nm, noorder),
            waktu: jam,
            level: "info".into(),
            link_to: "/lab".into(),
            data_ref: noorder,
        });
    }

    // 3. Tagihan belum dibayar hari ini
    let billing_pending: Vec<(String, String, f64)> = conn.query(
        "SELECT rp.no_rawat, IFNULL(p.nm_pasien,''), \
         IFNULL((SELECT SUM(b.totalbiaya) FROM billing b WHERE b.no_rawat=rp.no_rawat),0) \
         FROM reg_periksa rp \
         LEFT JOIN pasien p ON rp.no_rkm_medis=p.no_rkm_medis \
         WHERE rp.tgl_registrasi=CURDATE() \
         AND rp.no_rawat NOT IN (SELECT no_rawat FROM nota_jalan) \
         AND rp.no_rawat NOT IN (SELECT no_rawat FROM nota_inap) \
         AND rp.stts IN ('Sudah','selesai') \
         ORDER BY rp.jam_reg ASC LIMIT 5"
    ).await.unwrap_or_default();

    for (no_rawat, nm, total) in billing_pending {
        notifs.push(Notifikasi {
            id: format!("bill-{}", no_rawat),
            kategori: "kasir".into(),
            judul: "Tagihan Belum Dibayar".into(),
            pesan: format!("{} — Rp{:.0} menunggu pembayaran", nm, total),
            waktu: String::new(),
            level: "danger".into(),
            link_to: "/kasir".into(),
            data_ref: no_rawat,
        });
    }

    // 4. Pasien ranap baru hari ini (masuk bangsal)
    let ranap_baru: Vec<(String, String, String)> = conn.query(
        "SELECT ki.no_rawat, IFNULL(p.nm_pasien,''), \
         IFNULL(ki.kd_kamar,'') \
         FROM kamar_inap ki \
         LEFT JOIN reg_periksa rp ON ki.no_rawat=rp.no_rawat \
         LEFT JOIN pasien p ON rp.no_rkm_medis=p.no_rkm_medis \
         WHERE ki.tgl_masuk=CURDATE() \
         AND (ki.tgl_keluar IS NULL OR ki.tgl_keluar='0000-00-00') \
         ORDER BY ki.jam_masuk DESC LIMIT 3"
    ).await.unwrap_or_default();

    for (no_rawat, nm, kamar) in ranap_baru {
        notifs.push(Notifikasi {
            id: format!("ranap-{}", no_rawat),
            kategori: "ranap".into(),
            judul: "Pasien Masuk Bangsal".into(),
            pesan: format!("{} baru diadmisi ke kamar {}", nm, kamar),
            waktu: String::new(),
            level: "success".into(),
            link_to: "/ranap".into(),
            data_ref: no_rawat,
        });
    }

    // 5. IGD — pasien tanpa triase
    let igd_notriage: Vec<(String, String)> = conn.query(
        "SELECT rp.no_rawat, IFNULL(p.nm_pasien,'') \
         FROM reg_periksa rp \
         LEFT JOIN pasien p ON rp.no_rkm_medis=p.no_rkm_medis \
         LEFT JOIN data_triase_igd dt ON rp.no_rawat=dt.no_rawat \
         WHERE rp.tgl_registrasi=CURDATE() \
         AND rp.kd_poli=(SELECT kd_poli FROM poliklinik WHERE nm_poli LIKE '%IGD%' LIMIT 1) \
         AND dt.no_rawat IS NULL \
         ORDER BY rp.jam_reg ASC LIMIT 3"
    ).await.unwrap_or_default();

    for (no_rawat, nm) in igd_notriage {
        notifs.push(Notifikasi {
            id: format!("igd-{}", no_rawat),
            kategori: "igd".into(),
            judul: "IGD — Triase Belum Diisi".into(),
            pesan: format!("{} di IGD belum dilakukan triase!", nm),
            waktu: String::new(),
            level: "danger".into(),
            link_to: "/igd".into(),
            data_ref: no_rawat,
        });
    }

    // Sort: danger/warning dahulu, lalu info/success
    notifs.sort_by(|a, b| {
        let priority = |l: &str| match l {
            "danger" => 0, "warning" => 1, "info" => 2, _ => 3,
        };
        priority(&a.level).cmp(&priority(&b.level))
    });

    Ok(notifs)
}

/// Summary badge count saja (untuk badge di navbar)
#[tauri::command]
pub async fn get_notif_summary(
    state: State<'_, DbState>,
) -> Result<NotifSummary, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let row: Option<(i64, i64, i64, i64, i64)> = conn.query_first(
        "SELECT \
         IFNULL((SELECT COUNT(*) FROM antrian_loket WHERE tgl_antrian=CURDATE() AND status_panggil='Dipanggil' AND status_selesai='Belum'),0), \
         IFNULL((SELECT COUNT(DISTINCT pl.noorder) FROM permintaan_lab pl \
           LEFT JOIN detail_periksa_lab dpl ON pl.noorder=dpl.noorder \
           WHERE pl.tgl_permintaan=CURDATE() AND dpl.noorder IS NULL),0), \
         IFNULL((SELECT COUNT(*) FROM reg_periksa rp \
           WHERE rp.tgl_registrasi=CURDATE() \
           AND rp.no_rawat NOT IN (SELECT no_rawat FROM nota_jalan) \
           AND rp.no_rawat NOT IN (SELECT no_rawat FROM nota_inap) \
           AND rp.stts IN ('Sudah','selesai')),0), \
         IFNULL((SELECT COUNT(*) FROM kamar_inap WHERE tgl_masuk=CURDATE() AND (tgl_keluar IS NULL OR tgl_keluar='0000-00-00')),0), \
         IFNULL((SELECT COUNT(*) FROM reg_periksa rp2 \
           LEFT JOIN data_triase_igd dt ON rp2.no_rawat=dt.no_rawat \
           WHERE rp2.tgl_registrasi=CURDATE() \
           AND rp2.kd_poli=(SELECT kd_poli FROM poliklinik WHERE nm_poli LIKE '%IGD%' LIMIT 1) \
           AND dt.no_rawat IS NULL),0)"
    ).await.map_err(|e| e.to_string())?;

    let (antrian, lab, billing, ranap, igd) = row.unwrap_or((0, 0, 0, 0, 0));
    let total = antrian + lab + billing + ranap + igd;

    Ok(NotifSummary {
        total,
        antrian_menunggu: antrian,
        lab_pending: lab,
        billing_pending: billing,
        ranap_baru: ranap,
        igd_belum_triase: igd,
    })
}
