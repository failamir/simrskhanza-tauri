/// Phase 2: Clinical Module
/// Tables: reg_periksa, penilaian_medis_ralan, resep_obat, resep_dokter,
///         databarang, penyakit, periksa_lab (permintaan_lab)

use mysql_async::{prelude::*, Pool, params};
use tauri::State;
use serde::{Deserialize, Serialize};
use crate::db::DbState;

// ─────────────────────────────────────────────
// STRUCTS
// ─────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KunjunganRalan {
    pub no_rawat: String,
    pub no_rkm_medis: String,
    pub nm_pasien: String,
    pub nm_poli: String,
    pub nm_dokter: String,
    pub png_jawab: String,
    pub jam_reg: String,
    pub stts: String,
    pub tgl_registrasi: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PenilaianMedisInput {
    pub no_rawat: String,
    pub kd_dokter: String,
    pub keluhan_utama: String,
    pub rps: String,
    pub rpd: String,
    pub rpk: String,
    pub rpo: String,
    pub alergi: String,
    pub keadaan: String,
    pub gcs: String,
    pub kesadaran: String,
    pub td: String,
    pub nadi: String,
    pub rr: String,
    pub suhu: String,
    pub spo: String,
    pub bb: String,
    pub tb: String,
    pub diagnosis: String,
    pub kd_penyakit: String,
    pub rtl: String,
    pub catatan: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PenilaianMedis {
    pub no_rawat: String,
    pub tanggal: String,
    pub kd_dokter: String,
    pub nm_dokter: String,
    pub keluhan_utama: String,
    pub rps: String,
    pub rpd: String,
    pub alergi: String,
    pub keadaan: String,
    pub td: String,
    pub nadi: String,
    pub rr: String,
    pub suhu: String,
    pub spo: String,
    pub bb: String,
    pub tb: String,
    pub gcs: String,
    pub kesadaran: String,
    pub diagnosis: String,
    pub kd_penyakit: String,
    pub rtl: String,
    pub catatan: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Penyakit {
    pub kd_penyakit: String,
    pub nm_penyakit: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Obat {
    pub kode_brng: String,
    pub nama_brng: String,
    pub stok: f64,
    pub satuan: String,
    pub harga_ralan: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResepItem {
    pub kode_brng: String,
    pub nama_brng: String,
    pub jml: f64,
    pub aturan_pakai: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResepInput {
    pub kode_brng: String,
    pub jml: f64,
    pub aturan_pakai: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResepKunjungan {
    pub no_resep: String,
    pub tgl_peresepan: String,
    pub kd_dokter: String,
    pub nm_dokter: String,
    pub status_penyerahan: String,
    pub items: Vec<ResepItem>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ResepFarmasiRow {
    pub no_resep: String,
    pub no_rawat: String,
    pub nm_pasien: String,
    pub tgl_peresepan: String,
    pub jam_peresepan: String,
    pub nm_dokter: String,
    pub tgl_penyerahan: String,
    pub jumlah_item: i64,
    pub sudah_diserahkan: bool,
}

// Lab
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PermintaanLabInput {
    pub no_rawat: String,
    pub kd_dokter: String,
    pub items: Vec<String>, // list kd_jenis_prw (lab items)
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JenisLab {
    pub kd_jenis: String,
    pub nm_jenis: String,
    pub kategori: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HasilLab {
    pub no_rawat: String,
    pub nm_pasien: String,
    pub tgl_perawatan: String,
    pub jenis_hasil: String,
    pub nilai: String,
    pub satuan: String,
    pub nilai_normal: String,
    pub status: String,
}

// ─────────────────────────────────────────────
// HELPER
// ─────────────────────────────────────────────

fn get_pool_inner(state: &State<'_, DbState>) -> Result<Pool, String> {
    let guard = state.pool.lock().unwrap();
    guard.as_ref().ok_or("Database not initialized".to_string()).cloned()
}

// ─────────────────────────────────────────────
// RAWAT JALAN — KUNJUNGAN
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn get_kunjungan_ralan(
    state: State<'_, DbState>,
    tanggal: String,
) -> Result<Vec<KunjunganRalan>, String> {
    let pool = get_pool_inner(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT rp.no_rawat, rp.no_rkm_medis, IFNULL(p.nm_pasien,''), \
         IFNULL(pl.nm_poli,''), IFNULL(d.nm_dokter,''), \
         IFNULL(pj.png_jawab,''), IFNULL(TIME_FORMAT(rp.jam_reg,'%H:%i'),''), \
         IFNULL(rp.stts,''), IFNULL(DATE_FORMAT(rp.tgl_registrasi,'%d-%m-%Y'),'') \
         FROM reg_periksa rp \
         LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis \
         LEFT JOIN poliklinik pl ON rp.kd_poli = pl.kd_poli \
         LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter \
         LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj \
         WHERE rp.tgl_registrasi = '{}' AND rp.stts NOT IN ('Ranap') \
         ORDER BY rp.jam_reg ASC",
        tanggal
    );

    let rows: Vec<(String, String, String, String, String, String, String, String, String)> =
        conn.query(sql).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| KunjunganRalan {
        no_rawat: r.0, no_rkm_medis: r.1, nm_pasien: r.2,
        nm_poli: r.3, nm_dokter: r.4, png_jawab: r.5,
        jam_reg: r.6, stts: r.7, tgl_registrasi: r.8,
    }).collect())
}

#[tauri::command]
pub async fn update_status_kunjungan(
    state: State<'_, DbState>,
    no_rawat: String,
    stts: String,
) -> Result<String, String> {
    let pool = get_pool_inner(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let stmt = conn.prep("UPDATE reg_periksa SET stts=? WHERE no_rawat=?")
        .await.map_err(|e| e.to_string())?;
    conn.exec_drop(stmt, (&stts, &no_rawat)).await.map_err(|e| e.to_string())?;
    Ok("Status diperbarui".into())
}

// ─────────────────────────────────────────────
// PENILAIAN MEDIS (CPPT/SOAP)
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn get_penilaian_medis(
    state: State<'_, DbState>,
    no_rawat: String,
) -> Result<Vec<PenilaianMedis>, String> {
    let pool = get_pool_inner(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let stmt = conn.prep(
        "SELECT pm.no_rawat, DATE_FORMAT(pm.tanggal,'%d-%m-%Y %H:%i'), pm.kd_dokter, \
         IFNULL(d.nm_dokter,''), IFNULL(pm.keluhan_utama,''), IFNULL(pm.rps,''), \
         IFNULL(pm.rpd,''), IFNULL(pm.alergi,''), pm.keadaan, \
         IFNULL(pm.td,''), IFNULL(pm.nadi,''), IFNULL(pm.rr,''), \
         IFNULL(pm.suhu,''), IFNULL(pm.spo,''), IFNULL(pm.bb,''), IFNULL(pm.tb,''), \
         IFNULL(pm.gcs,''), pm.kesadaran, \
         IFNULL((SELECT GROUP_CONCAT(nm_penyakit SEPARATOR ', ') FROM penyakit WHERE kd_penyakit IN \
           (SELECT kd_penyakit FROM diagnosa_pasien_ralan WHERE no_rawat=pm.no_rawat)),''), \
         IFNULL((SELECT GROUP_CONCAT(kd_penyakit SEPARATOR ',') FROM diagnosa_pasien_ralan WHERE no_rawat=pm.no_rawat),''), \
         '', '' \
         FROM penilaian_medis_ralan pm \
         LEFT JOIN dokter d ON pm.kd_dokter = d.kd_dokter \
         WHERE pm.no_rawat = ? ORDER BY pm.tanggal DESC"
    ).await.map_err(|e| e.to_string())?;

    let rows: Vec<mysql_async::Row> =
        conn.exec(stmt, (no_rawat,)).await.map_err(|e| e.to_string())?;

    let mut result = vec![];
    for mut row in rows {
        use mysql_async::prelude::FromValue;
        result.push(PenilaianMedis {
            no_rawat:       String::from_value(row.take(0).unwrap_or(mysql_async::Value::NULL)),
            tanggal:        String::from_value(row.take(1).unwrap_or(mysql_async::Value::NULL)),
            kd_dokter:      String::from_value(row.take(2).unwrap_or(mysql_async::Value::NULL)),
            nm_dokter:      String::from_value(row.take(3).unwrap_or(mysql_async::Value::NULL)),
            keluhan_utama:  String::from_value(row.take(4).unwrap_or(mysql_async::Value::NULL)),
            rps:            String::from_value(row.take(5).unwrap_or(mysql_async::Value::NULL)),
            rpd:            String::from_value(row.take(6).unwrap_or(mysql_async::Value::NULL)),
            alergi:         String::from_value(row.take(7).unwrap_or(mysql_async::Value::NULL)),
            keadaan:        String::from_value(row.take(8).unwrap_or(mysql_async::Value::NULL)),
            td:             String::from_value(row.take(9).unwrap_or(mysql_async::Value::NULL)),
            nadi:           String::from_value(row.take(10).unwrap_or(mysql_async::Value::NULL)),
            rr:             String::from_value(row.take(11).unwrap_or(mysql_async::Value::NULL)),
            suhu:           String::from_value(row.take(12).unwrap_or(mysql_async::Value::NULL)),
            spo:            String::from_value(row.take(13).unwrap_or(mysql_async::Value::NULL)),
            bb:             String::from_value(row.take(14).unwrap_or(mysql_async::Value::NULL)),
            tb:             String::from_value(row.take(15).unwrap_or(mysql_async::Value::NULL)),
            gcs:            String::from_value(row.take(16).unwrap_or(mysql_async::Value::NULL)),
            kesadaran:      String::from_value(row.take(17).unwrap_or(mysql_async::Value::NULL)),
            diagnosis:      String::from_value(row.take(18).unwrap_or(mysql_async::Value::NULL)),
            kd_penyakit:    String::from_value(row.take(19).unwrap_or(mysql_async::Value::NULL)),
            rtl:            String::from_value(row.take(20).unwrap_or(mysql_async::Value::NULL)),
            catatan:        String::from_value(row.take(21).unwrap_or(mysql_async::Value::NULL)),
        });
    }
    Ok(result)
}

#[tauri::command]
pub async fn save_penilaian_medis(
    state: State<'_, DbState>,
    input: PenilaianMedisInput,
) -> Result<String, String> {
    let pool = get_pool_inner(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Check if already exists
    let existing: Option<String> = conn.exec_first(
        "SELECT no_rawat FROM penilaian_medis_ralan WHERE no_rawat=? LIMIT 1",
        (&input.no_rawat,)
    ).await.map_err(|e| e.to_string())?;

    if existing.is_some() {
        conn.exec_drop(
            "UPDATE penilaian_medis_ralan SET keluhan_utama=:keluhan, rps=:rps, rpd=:rpd, rpk='', rpo='', \
             alergi=:alergi, keadaan=:keadaan, gcs=:gcs, kesadaran=:kesadaran, \
             td=:td, nadi=:nadi, rr=:rr, suhu=:suhu, spo=:spo, \
             bb=:bb, tb=:tb, anamnesis='Autoanamnesis', hubungan='' \
             WHERE no_rawat=:no_rawat",
            params! {
                "keluhan" => &input.keluhan_utama,
                "rps" => &input.rps, "rpd" => &input.rpd,
                "alergi" => &input.alergi, "keadaan" => &input.keadaan,
                "gcs" => &input.gcs, "kesadaran" => &input.kesadaran,
                "td" => &input.td, "nadi" => &input.nadi, "rr" => &input.rr,
                "suhu" => &input.suhu, "spo" => &input.spo,
                "bb" => &input.bb, "tb" => &input.tb,
                "no_rawat" => &input.no_rawat,
            }
        ).await.map_err(|e| e.to_string())?;
    } else {
        conn.exec_drop(
            "INSERT INTO penilaian_medis_ralan (no_rawat, tanggal, kd_dokter, anamnesis, hubungan, \
             keluhan_utama, rps, rpd, rpk, rpo, alergi, keadaan, gcs, kesadaran, \
             td, nadi, rr, suhu, spo, bb, tb, \
             kepala, gigi, tht, thoraks, abdomen, ekstremitas, genitalia, kulit, \
             lain_lain, status_perkawinan, status_hamil, pemeriksaan_penunjang, \
             diagnosis, terapi) \
             VALUES (:no_rawat,NOW(),:kd_dokter,'Autoanamnesis','', \
             :keluhan,:rps,:rpd,'','', :alergi,:keadaan,:gcs,:kesadaran, \
             :td,:nadi,:rr,:suhu,:spo,:bb,:tb, \
             'Tidak Diperiksa','Tidak Diperiksa','Tidak Diperiksa','Tidak Diperiksa', \
             'Tidak Diperiksa','Tidak Diperiksa','Tidak Diperiksa','Tidak Diperiksa', \
             '','Belum Kawin','Tidak',:diagnosis,:rtl,:catatan)",
            params! {
                "no_rawat" => &input.no_rawat,
                "kd_dokter" => &input.kd_dokter,
                "keluhan" => &input.keluhan_utama,
                "rps" => &input.rps,
                "rpd" => &input.rpd,
                "alergi" => &input.alergi,
                "keadaan" => &input.keadaan,
                "gcs" => &input.gcs,
                "kesadaran" => &input.kesadaran,
                "td" => &input.td,
                "nadi" => &input.nadi,
                "rr" => &input.rr,
                "suhu" => &input.suhu,
                "spo" => &input.spo,
                "bb" => &input.bb,
                "tb" => &input.tb,
                "diagnosis" => &input.diagnosis,
                "rtl" => &input.rtl,
                "catatan" => &input.catatan,
            }
        ).await.map_err(|e| e.to_string())?;
    }

    // Save diagnosis ICD-10 if provided
    if !input.kd_penyakit.is_empty() {
        // Clear existing diagnoses for this visit
        conn.exec_drop(
            "DELETE FROM diagnosa_pasien_ralan WHERE no_rawat=?",
            (&input.no_rawat,)
        ).await.map_err(|e| e.to_string())?;

        // Insert new diagnosis
        for kd in input.kd_penyakit.split(',') {
            let kd = kd.trim();
            if kd.is_empty() { continue; }
            let stmt2 = conn.prep(
                "INSERT IGNORE INTO diagnosa_pasien_ralan (no_rawat, kd_penyakit, prioritas, status) VALUES (?,?,1,'Diagnosa Awal')"
            ).await.map_err(|e| e.to_string())?;
            conn.exec_drop(stmt2, (&input.no_rawat, kd)).await.map_err(|e| e.to_string())?;
        }
    }

    // Update status kunjungan
    conn.exec_drop(
        "UPDATE reg_periksa SET stts='Sudah' WHERE no_rawat=?",
        (&input.no_rawat,)
    ).await.map_err(|e| e.to_string())?;

    Ok("Penilaian medis berhasil disimpan".into())
}

// ─────────────────────────────────────────────
// ICD-10 / PENYAKIT
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn search_penyakit(
    state: State<'_, DbState>,
    query: String,
) -> Result<Vec<Penyakit>, String> {
    let pool = get_pool_inner(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let q = query.replace('\'', "''");
    let rows: Vec<(String, String)> = conn.query(format!(
        "SELECT kd_penyakit, IFNULL(nm_penyakit,'') FROM penyakit \
         WHERE kd_penyakit LIKE '%{q}%' OR nm_penyakit LIKE '%{q}%' \
         ORDER BY kd_penyakit LIMIT 20"
    )).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(kd_penyakit, nm_penyakit)| Penyakit { kd_penyakit, nm_penyakit }).collect())
}

// ─────────────────────────────────────────────
// RESEP & FARMASI
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn search_obat(
    state: State<'_, DbState>,
    query: String,
) -> Result<Vec<Obat>, String> {
    let pool = get_pool_inner(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    if query.trim().is_empty() {
        return Ok(vec![]);
    }

    let q = query.replace('\'', "''");
    let rows: Vec<(String, String, f64, String, f64)> = conn.query(format!(
        "SELECT db.kode_brng, IFNULL(db.nama_brng,''), \
         IFNULL((SELECT SUM(jumlah_masuk-jumlah_keluar) FROM stok_barang_rinci WHERE kode_brng=db.kode_brng),0), \
         IFNULL(ks.kode_sat,''), IFNULL(db.ralan,0) \
         FROM databarang db \
         LEFT JOIN kode_satuan ks ON db.kode_sat = ks.kode_sat \
         WHERE db.nama_brng LIKE '%{q}%' OR db.kode_brng LIKE '%{q}%' \
         ORDER BY db.nama_brng LIMIT 20"
    )).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(kode_brng, nama_brng, stok, satuan, harga_ralan)| Obat {
        kode_brng, nama_brng, stok, satuan, harga_ralan,
    }).collect())
}

#[tauri::command]
pub async fn get_resep_kunjungan(
    state: State<'_, DbState>,
    no_rawat: String,
) -> Result<Vec<ResepKunjungan>, String> {
    let pool = get_pool_inner(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let stmt = conn.prep(
        "SELECT ro.no_resep, IFNULL(DATE_FORMAT(ro.tgl_peresepan,'%d-%m-%Y'),''), \
         ro.kd_dokter, IFNULL(d.nm_dokter,''), \
         IF(ro.tgl_penyerahan = '0000-00-00','Belum Diserahkan','Sudah Diserahkan') \
         FROM resep_obat ro \
         LEFT JOIN dokter d ON ro.kd_dokter = d.kd_dokter \
         WHERE ro.no_rawat=? ORDER BY ro.tgl_peresepan DESC"
    ).await.map_err(|e| e.to_string())?;

    let resep_rows: Vec<(String, String, String, String, String)> =
        conn.exec(stmt, (&no_rawat,)).await.map_err(|e| e.to_string())?;

    let mut result = vec![];
    for (no_resep, tgl, kd_dokter, nm_dokter, status_penyerahan) in resep_rows {
        // Get items for this resep
        let item_stmt = conn.prep(
            "SELECT rd.kode_brng, IFNULL(db.nama_brng,''), IFNULL(rd.jml,0), IFNULL(rd.aturan_pakai,'') \
             FROM resep_dokter rd LEFT JOIN databarang db ON rd.kode_brng = db.kode_brng \
             WHERE rd.no_resep=?"
        ).await.map_err(|e| e.to_string())?;

        let items: Vec<(String, String, f64, String)> =
            conn.exec(item_stmt, (&no_resep,)).await.map_err(|e| e.to_string())?;

        result.push(ResepKunjungan {
            no_resep: no_resep.clone(),
            tgl_peresepan: tgl,
            kd_dokter,
            nm_dokter,
            status_penyerahan,
            items: items.into_iter().map(|(kode_brng, nama_brng, jml, aturan_pakai)| ResepItem {
                kode_brng, nama_brng, jml, aturan_pakai,
            }).collect(),
        });
    }

    Ok(result)
}

#[tauri::command]
pub async fn save_resep(
    state: State<'_, DbState>,
    no_rawat: String,
    kd_dokter: String,
    items: Vec<ResepInput>,
) -> Result<String, String> {
    if items.is_empty() {
        return Err("Tidak ada item resep".into());
    }

    let pool = get_pool_inner(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Generate no_resep: YYYYMMDDNNNN
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let today_str = crate::db::secs_to_ymd_str(secs);
    let prefix = today_str.replace("-", "");

    let last: Option<String> = conn.query_first(format!(
        "SELECT no_resep FROM resep_obat WHERE no_resep LIKE '{}%' ORDER BY no_resep DESC LIMIT 1",
        prefix
    )).await.map_err(|e| e.to_string())?;

    let seq: u64 = match last {
        Some(s) => s[prefix.len()..].parse().unwrap_or(0) + 1,
        None => 1,
    };
    let no_resep = format!("{}{:04}", prefix, seq);

    // Insert resep_obat header
    let stmt = conn.prep(
        "INSERT INTO resep_obat (no_resep, tgl_perawatan, jam, no_rawat, kd_dokter, \
         tgl_peresepan, jam_peresepan, status, tgl_penyerahan, jam_penyerahan) \
         VALUES (?,CURDATE(),NOW(),?,?,CURDATE(),NOW(),'ralan','0000-00-00','00:00:00')"
    ).await.map_err(|e| e.to_string())?;
    conn.exec_drop(stmt, (&no_resep, &no_rawat, &kd_dokter))
        .await.map_err(|e| e.to_string())?;

    // Insert resep_dokter items
    for item in &items {
        let stmt2 = conn.prep(
            "INSERT INTO resep_dokter (no_resep, kode_brng, jml, aturan_pakai) VALUES (?,?,?,?)"
        ).await.map_err(|e| e.to_string())?;
        conn.exec_drop(stmt2, (&no_resep, &item.kode_brng, item.jml, &item.aturan_pakai))
            .await.map_err(|e| e.to_string())?;
    }

    Ok(no_resep)
}

// ─────────────────────────────────────────────
// FARMASI — PELAYANAN RESEP
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn get_resep_farmasi(
    state: State<'_, DbState>,
    tanggal: String,
) -> Result<Vec<ResepFarmasiRow>, String> {
    let pool = get_pool_inner(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT ro.no_resep, ro.no_rawat, IFNULL(p.nm_pasien,''), \
         IFNULL(DATE_FORMAT(ro.tgl_peresepan,'%d-%m-%Y'),''), \
         IFNULL(TIME_FORMAT(ro.jam_peresepan,'%H:%i'),''), \
         IFNULL(d.nm_dokter,''), \
         IFNULL(DATE_FORMAT(ro.tgl_penyerahan,'%d-%m-%Y'),''), \
         (SELECT COUNT(*) FROM resep_dokter WHERE no_resep=ro.no_resep), \
         IF(ro.tgl_penyerahan != '0000-00-00', 1, 0) \
         FROM resep_obat ro \
         LEFT JOIN reg_periksa rp ON ro.no_rawat = rp.no_rawat \
         LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis \
         LEFT JOIN dokter d ON ro.kd_dokter = d.kd_dokter \
         WHERE ro.tgl_peresepan = '{}' AND ro.status = 'ralan' \
         ORDER BY ro.jam_peresepan ASC",
        tanggal
    );

    let rows: Vec<(String, String, String, String, String, String, String, i64, i8)> =
        conn.query(sql).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| ResepFarmasiRow {
        no_resep: r.0, no_rawat: r.1, nm_pasien: r.2,
        tgl_peresepan: r.3, jam_peresepan: r.4, nm_dokter: r.5,
        tgl_penyerahan: r.6, jumlah_item: r.7,
        sudah_diserahkan: r.8 == 1,
    }).collect())
}

#[tauri::command]
pub async fn serahkan_resep(
    state: State<'_, DbState>,
    no_resep: String,
) -> Result<String, String> {
    let pool = get_pool_inner(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let stmt = conn.prep(
        "UPDATE resep_obat SET tgl_penyerahan=CURDATE(), jam_penyerahan=NOW() WHERE no_resep=?"
    ).await.map_err(|e| e.to_string())?;
    conn.exec_drop(stmt, (no_resep,)).await.map_err(|e| e.to_string())?;

    Ok("Resep berhasil diserahkan".into())
}

// ─────────────────────────────────────────────
// LABORATORIUM
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn get_jenis_lab(
    state: State<'_, DbState>,
) -> Result<Vec<JenisLab>, String> {
    let pool = get_pool_inner(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let rows: Vec<(String, String, String)> = conn.query(
        "SELECT jp.kd_jenis_prw, jp.nm_jenis, IFNULL(kp.nm_poli,'Umum') \
         FROM jns_perawatan jp \
         LEFT JOIN poliklinik kp ON jp.kd_poli = kp.kd_poli \
         WHERE jp.kd_poli IN \
           (SELECT kd_poli FROM poliklinik WHERE nm_poli LIKE '%Lab%' OR nm_poli LIKE '%Laborat%') \
         ORDER BY jp.nm_jenis LIMIT 200"
    ).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(kd_jenis, nm_jenis, kategori)| JenisLab {
        kd_jenis, nm_jenis, kategori,
    }).collect())
}

#[tauri::command]
pub async fn get_permintaan_lab_hari_ini(
    state: State<'_, DbState>,
    tanggal: String,
) -> Result<Vec<HasilLab>, String> {
    let pool = get_pool_inner(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT pl.no_rawat, IFNULL(p.nm_pasien,''), \
         IFNULL(DATE_FORMAT(pl.tgl_perawatan,'%d-%m-%Y'),''), \
         IFNULL(jp.nm_jenis,''), IFNULL(pl.hasil,''), \
         IFNULL(pl.satuan,''), IFNULL(pl.nilai_normal,''), \
         IFNULL(pl.status, 'Belum') \
         FROM periksa_lab pl \
         LEFT JOIN reg_periksa rp ON pl.no_rawat = rp.no_rawat \
         LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis \
         LEFT JOIN jns_perawatan jp ON pl.kd_jenis_prw = jp.kd_jenis_prw \
         WHERE pl.tgl_perawatan = '{}' \
         ORDER BY pl.no_rawat, pl.kd_jenis_prw",
        tanggal
    );

    let rows: Vec<(String, String, String, String, String, String, String, String)> =
        conn.query(sql).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| HasilLab {
        no_rawat: r.0, nm_pasien: r.1, tgl_perawatan: r.2,
        jenis_hasil: r.3, nilai: r.4, satuan: r.5,
        nilai_normal: r.6, status: r.7,
    }).collect())
}
