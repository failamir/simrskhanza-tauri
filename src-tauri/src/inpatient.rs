/// Phase 3 – Rawat Inap (Inpatient) Module
/// Tables: kamar, bangsal, kamar_inap, reg_periksa (ranap)

use mysql_async::{prelude::*, Pool};
use tauri::State;
use serde::{Deserialize, Serialize};
use crate::db::DbState;

// ─────────────────────────── STRUCTS ──────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StatusKamar {
    pub kd_kamar: String,
    pub nm_bangsal: String,
    pub kelas: String,
    pub trf_kamar: f64,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PasienRanap {
    pub no_rawat: String,
    pub no_rkm_medis: String,
    pub nm_pasien: String,
    pub kd_kamar: String,
    pub nm_bangsal: String,
    pub kelas: String,
    pub diagnosa_awal: String,
    pub tgl_masuk: String,
    pub jam_masuk: String,
    pub lama: f64,
    pub ttl_biaya: f64,
    pub nm_dokter: String,
    pub png_jawab: String,
    pub stts_pulang: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AdmisiInput {
    pub no_rawat: String,
    pub kd_kamar: String,
    pub diagnosa_awal: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PulangInput {
    pub no_rawat: String,
    pub stts_pulang: String,
    pub diagnosa_akhir: String,
}

// ──────────────────────────── HELPER ──────────────────────────────

fn get_pool(state: &State<'_, DbState>) -> Result<Pool, String> {
    let guard = state.pool.lock().unwrap();
    guard.as_ref().ok_or_else(|| "Database not initialized".to_string()).cloned()
}

// ──────────────────────────── COMMANDS ────────────────────────────

#[tauri::command]
pub async fn get_status_kamar(state: State<'_, DbState>) -> Result<Vec<StatusKamar>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let rows: Vec<(String, String, String, f64, String)> = conn.query(
        "SELECT k.kd_kamar, IFNULL(b.nm_bangsal,''), IFNULL(k.kelas,''), \
         IFNULL(k.trf_kamar,0), IFNULL(k.status,'KOSONG') \
         FROM kamar k \
         LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal \
         WHERE k.statusdata='1' \
         ORDER BY b.nm_bangsal, k.kd_kamar"
    ).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(kd_kamar, nm_bangsal, kelas, trf_kamar, status)| StatusKamar {
        kd_kamar, nm_bangsal, kelas, trf_kamar, status,
    }).collect())
}

#[tauri::command]
pub async fn get_pasien_ranap(state: State<'_, DbState>) -> Result<Vec<PasienRanap>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let rows: Vec<mysql_async::Row> = conn.query(
        "SELECT rp.no_rawat, rp.no_rkm_medis, IFNULL(p.nm_pasien,''), \
         IFNULL(ki.kd_kamar,''), IFNULL(b.nm_bangsal,''), IFNULL(k.kelas,''), \
         IFNULL(ki.diagnosa_awal,''), \
         IFNULL(DATE_FORMAT(ki.tgl_masuk,'%d-%m-%Y'),''), \
         IFNULL(TIME_FORMAT(ki.jam_masuk,'%H:%i'),''), \
         IFNULL(ki.lama,0), IFNULL(ki.ttl_biaya,0), \
         IFNULL(d.nm_dokter,''), IFNULL(pj.png_jawab,''), \
         IFNULL(ki.stts_pulang,'Dirawat') \
         FROM reg_periksa rp \
         JOIN kamar_inap ki ON rp.no_rawat = ki.no_rawat \
         LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis \
         LEFT JOIN kamar k ON ki.kd_kamar = k.kd_kamar \
         LEFT JOIN bangsal b ON k.kd_bangsal = b.kd_bangsal \
         LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter \
         LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj \
         WHERE ki.tgl_keluar IS NULL OR ki.tgl_keluar = '0000-00-00' \
         ORDER BY ki.tgl_masuk DESC"
    ).await.map_err(|e| e.to_string())?;

    let mut result = vec![];
    for mut r in rows {
        use mysql_async::prelude::FromValue;
        result.push(PasienRanap {
            no_rawat:     String::from_value(r.take(0).unwrap_or(mysql_async::Value::NULL)),
            no_rkm_medis: String::from_value(r.take(1).unwrap_or(mysql_async::Value::NULL)),
            nm_pasien:    String::from_value(r.take(2).unwrap_or(mysql_async::Value::NULL)),
            kd_kamar:     String::from_value(r.take(3).unwrap_or(mysql_async::Value::NULL)),
            nm_bangsal:   String::from_value(r.take(4).unwrap_or(mysql_async::Value::NULL)),
            kelas:        String::from_value(r.take(5).unwrap_or(mysql_async::Value::NULL)),
            diagnosa_awal:String::from_value(r.take(6).unwrap_or(mysql_async::Value::NULL)),
            tgl_masuk:    String::from_value(r.take(7).unwrap_or(mysql_async::Value::NULL)),
            jam_masuk:    String::from_value(r.take(8).unwrap_or(mysql_async::Value::NULL)),
            lama:         f64::from_value(r.take(9).unwrap_or(mysql_async::Value::NULL)),
            ttl_biaya:    f64::from_value(r.take(10).unwrap_or(mysql_async::Value::NULL)),
            nm_dokter:    String::from_value(r.take(11).unwrap_or(mysql_async::Value::NULL)),
            png_jawab:    String::from_value(r.take(12).unwrap_or(mysql_async::Value::NULL)),
            stts_pulang:  String::from_value(r.take(13).unwrap_or(mysql_async::Value::NULL)),
        });
    }
    Ok(result)
}

#[tauri::command]
pub async fn admisi_ranap(
    state: State<'_, DbState>,
    input: AdmisiInput,
) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Update reg_periksa stts → Ranap
    conn.exec_drop(
        "UPDATE reg_periksa SET stts='Ranap' WHERE no_rawat=?",
        (&input.no_rawat,)
    ).await.map_err(|e| e.to_string())?;

    // Get kamar tarif
    let trf: f64 = conn.exec_first(
        "SELECT IFNULL(trf_kamar,0) FROM kamar WHERE kd_kamar=?",
        (&input.kd_kamar,)
    ).await.map_err(|e| e.to_string())?.unwrap_or(0.0);

    // Insert kamar_inap
    conn.exec_drop(
        "INSERT INTO kamar_inap (no_rawat, kd_kamar, trf_kamar, diagnosa_awal, \
         tgl_masuk, jam_masuk, stts_pulang) \
         VALUES (?, ?, ?, ?, CURDATE(), NOW(), 'Dirawat')",
        (&input.no_rawat, &input.kd_kamar, trf, &input.diagnosa_awal)
    ).await.map_err(|e| e.to_string())?;

    // Update kamar status → ISI
    conn.exec_drop(
        "UPDATE kamar SET status='ISI' WHERE kd_kamar=?",
        (&input.kd_kamar,)
    ).await.map_err(|e| e.to_string())?;

    Ok("Admisi berhasil".into())
}

#[tauri::command]
pub async fn pulang_ranap(
    state: State<'_, DbState>,
    input: PulangInput,
) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Get kd_kamar
    let kd_kamar: Option<String> = conn.exec_first(
        "SELECT kd_kamar FROM kamar_inap WHERE no_rawat=? LIMIT 1",
        (&input.no_rawat,)
    ).await.map_err(|e| e.to_string())?;

    // Update kamar_inap
    conn.exec_drop(
        "UPDATE kamar_inap SET tgl_keluar=CURDATE(), jam_keluar=NOW(), \
         diagnosa_akhir=?, stts_pulang=?, \
         lama=DATEDIFF(CURDATE(), tgl_masuk) \
         WHERE no_rawat=? AND (tgl_keluar IS NULL OR tgl_keluar='0000-00-00')",
        (&input.diagnosa_akhir, &input.stts_pulang, &input.no_rawat)
    ).await.map_err(|e| e.to_string())?;

    // Update reg_periksa
    conn.exec_drop(
        "UPDATE reg_periksa SET stts='Pulang' WHERE no_rawat=?",
        (&input.no_rawat,)
    ).await.map_err(|e| e.to_string())?;

    // Free the room
    if let Some(kd) = kd_kamar {
        conn.exec_drop(
            "UPDATE kamar SET status='KOSONG' WHERE kd_kamar=?",
            (kd,)
        ).await.map_err(|e| e.to_string())?;
    }

    Ok("Pasien berhasil dipulangkan".into())
}
