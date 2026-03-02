/// Phase 3 – Laboratorium Module
/// Tables: permintaan_lab, detail_periksa_lab, template_laboratorium, jns_perawatan

use mysql_async::{prelude::*, Pool};
use tauri::State;
use serde::{Deserialize, Serialize};
use crate::db::DbState;

// ─────────────────────────── STRUCTS ──────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JenisPemeriksaanLab {
    pub kd_jenis_prw: String,
    pub nm_perawatan: String,
    pub nm_poli: String,
    pub biaya: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PermintaanLabRow {
    pub noorder: String,
    pub no_rawat: String,
    pub nm_pasien: String,
    pub tgl_permintaan: String,
    pub jam_permintaan: String,
    pub diagnosa_klinis: String,
    pub nm_dokter: String,
    pub status: String,
    pub sudah_ada_hasil: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TemplateLab {
    pub id_template: i64,
    pub pemeriksaan: String,
    pub satuan: String,
    pub nilai_rujukan: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct HasilLabInput {
    pub no_rawat: String,
    pub kd_jenis_prw: String,
    pub id_template: i64,
    pub nilai: String,
    pub keterangan: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DetailHasilLab {
    pub id_template: i64,
    pub pemeriksaan: String,
    pub nilai: String,
    pub satuan: String,
    pub nilai_rujukan: String,
    pub keterangan: String,
    pub biaya_item: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PermintaanLabInput {
    pub no_rawat: String,
    pub kd_jenis_prw: String,
    pub kd_dokter: String,
    pub diagnosa_klinis: String,
    pub status: String,
}

// ──────────────────────────── HELPER ──────────────────────────────

fn get_pool(state: &State<'_, DbState>) -> Result<Pool, String> {
    let guard = state.pool.lock().unwrap();
    guard.as_ref().ok_or_else(|| "Database not initialized".to_string()).cloned()
}

// ──────────────────────────── COMMANDS ────────────────────────────

#[tauri::command]
pub async fn get_jenis_pemeriksaan_lab(
    state: State<'_, DbState>,
) -> Result<Vec<JenisPemeriksaanLab>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let rows: Vec<(String, String, String, f64)> = conn.query(
        "SELECT jp.kd_jenis_prw, IFNULL(jp.nm_perawatan,''), \
         IFNULL(pl.nm_poli,''), IFNULL(jp.total_byrdr,0) \
         FROM jns_perawatan jp \
         LEFT JOIN poliklinik pl ON jp.kd_poli = pl.kd_poli \
         WHERE jp.kd_poli IN \
           (SELECT kd_poli FROM poliklinik WHERE nm_poli LIKE '%Lab%' OR nm_poli LIKE '%Laborat%') \
         AND jp.status='1' \
         ORDER BY jp.nm_perawatan"
    ).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(kd_jenis_prw, nm_perawatan, nm_poli, biaya)| JenisPemeriksaanLab {
        kd_jenis_prw, nm_perawatan, nm_poli, biaya,
    }).collect())
}

#[tauri::command]
pub async fn get_permintaan_lab(
    state: State<'_, DbState>,
    tanggal: String,
) -> Result<Vec<PermintaanLabRow>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT pl.noorder, pl.no_rawat, IFNULL(p.nm_pasien,''), \
         IFNULL(DATE_FORMAT(pl.tgl_permintaan,'%d-%m-%Y'),''), \
         IFNULL(TIME_FORMAT(pl.jam_permintaan,'%H:%i'),''), \
         IFNULL(pl.diagnosa_klinis,''), IFNULL(d.nm_dokter,''), \
         pl.status, \
         IF(pl.tgl_hasil != '0000-00-00', 1, 0) \
         FROM permintaan_lab pl \
         LEFT JOIN reg_periksa rp ON pl.no_rawat = rp.no_rawat \
         LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis \
         LEFT JOIN dokter d ON pl.dokter_perujuk = d.kd_dokter \
         WHERE pl.tgl_permintaan = '{}' \
         ORDER BY pl.jam_permintaan DESC",
        tanggal
    );

    let rows: Vec<(String, String, String, String, String, String, String, String, i8)> =
        conn.query(sql).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| PermintaanLabRow {
        noorder: r.0, no_rawat: r.1, nm_pasien: r.2,
        tgl_permintaan: r.3, jam_permintaan: r.4,
        diagnosa_klinis: r.5, nm_dokter: r.6, status: r.7,
        sudah_ada_hasil: r.8 == 1,
    }).collect())
}

#[tauri::command]
pub async fn buat_permintaan_lab(
    state: State<'_, DbState>,
    input: PermintaanLabInput,
) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Generate noorder
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let today = crate::db::secs_to_ymd_str(secs).replace("-", "");
    let prefix = format!("LAB{}", today);

    let last: Option<String> = conn.query_first(format!(
        "SELECT noorder FROM permintaan_lab WHERE noorder LIKE '{}%' ORDER BY noorder DESC LIMIT 1",
        prefix
    )).await.map_err(|e| e.to_string())?;

    let seq: u64 = match last {
        Some(s) => s[prefix.len()..].parse().unwrap_or(0) + 1,
        None => 1,
    };
    let noorder = format!("{}{:04}", prefix, seq);

    conn.exec_drop(
        "INSERT INTO permintaan_lab (noorder, no_rawat, tgl_permintaan, jam_permintaan, \
         tgl_sampel, jam_sampel, tgl_hasil, jam_hasil, \
         dokter_perujuk, status, informasi_tambahan, diagnosa_klinis) \
         VALUES (?,?,CURDATE(),NOW(),CURDATE(),NOW(),'0000-00-00','00:00:00',?,?,'',?)",
        (&noorder, &input.no_rawat, &input.kd_dokter, &input.status, &input.diagnosa_klinis)
    ).await.map_err(|e| e.to_string())?;

    Ok(noorder)
}

#[tauri::command]
pub async fn get_template_lab(
    state: State<'_, DbState>,
    kd_jenis_prw: String,
) -> Result<Vec<TemplateLab>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let stmt = conn.prep(
        "SELECT id_template, IFNULL(Pemeriksaan,''), IFNULL(satuan,''), \
         IFNULL(nilai_rujukan_ld,'') \
         FROM template_laboratorium WHERE kd_jenis_prw=? ORDER BY urut, id_template"
    ).await.map_err(|e| e.to_string())?;

    let rows: Vec<(i64, String, String, String)> =
        conn.exec(stmt, (kd_jenis_prw,)).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(id_template, pemeriksaan, satuan, nilai_rujukan)| TemplateLab {
        id_template, pemeriksaan, satuan, nilai_rujukan,
    }).collect())
}

#[tauri::command]
pub async fn input_hasil_lab(
    state: State<'_, DbState>,
    noorder: String,
    results: Vec<HasilLabInput>,
) -> Result<String, String> {
    if results.is_empty() {
        return Err("Tidak ada data hasil".into());
    }
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    for item in &results {
        // Get template biaya
        let biaya: f64 = conn.exec_first(
            "SELECT IFNULL(biaya_item,0) FROM template_laboratorium WHERE id_template=?",
            (item.id_template,)
        ).await.map_err(|e| e.to_string())?.unwrap_or(0.0);

        let nilai_ref: String = conn.exec_first(
            "SELECT IFNULL(nilai_rujukan_ld,'') FROM template_laboratorium WHERE id_template=?",
            (item.id_template,)
        ).await.map_err(|e| e.to_string())?.unwrap_or_default();

        // Upsert detail_periksa_lab
        conn.exec_drop(
            "INSERT INTO detail_periksa_lab \
             (no_rawat, kd_jenis_prw, tgl_periksa, jam, id_template, nilai, nilai_rujukan, \
             keterangan, bagian_rs, bhp, bagian_perujuk, bagian_dokter, bagian_laborat, \
             kso, menejemen, biaya_item) \
             VALUES (?,?,CURDATE(),NOW(),?,?,?,?,?,0,0,0,0,0,0,?) \
             ON DUPLICATE KEY UPDATE nilai=VALUES(nilai), keterangan=VALUES(keterangan)",
            (&item.no_rawat, &item.kd_jenis_prw, item.id_template,
             &item.nilai, &nilai_ref, &item.keterangan,
             biaya * 0.7, biaya)
        ).await.map_err(|e| e.to_string())?;
    }

    // Update permintaan_lab tgl_hasil
    conn.exec_drop(
        "UPDATE permintaan_lab SET tgl_hasil=CURDATE(), jam_hasil=NOW() WHERE noorder=?",
        (noorder,)
    ).await.map_err(|e| e.to_string())?;

    Ok("Hasil lab berhasil disimpan".into())
}

#[tauri::command]
pub async fn get_detail_hasil_lab(
    state: State<'_, DbState>,
    no_rawat: String,
    kd_jenis_prw: String,
) -> Result<Vec<DetailHasilLab>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let stmt = conn.prep(
        "SELECT dpl.id_template, IFNULL(tl.Pemeriksaan,''), \
         IFNULL(dpl.nilai,''), IFNULL(tl.satuan,''), \
         IFNULL(dpl.nilai_rujukan,''), IFNULL(dpl.keterangan,''), \
         IFNULL(dpl.biaya_item,0) \
         FROM detail_periksa_lab dpl \
         JOIN template_laboratorium tl ON dpl.id_template = tl.id_template \
         WHERE dpl.no_rawat=? AND dpl.kd_jenis_prw=? \
         ORDER BY tl.urut, tl.id_template"
    ).await.map_err(|e| e.to_string())?;

    let rows: Vec<(i64, String, String, String, String, String, f64)> =
        conn.exec(stmt, (&no_rawat, &kd_jenis_prw)).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(id_template, pemeriksaan, nilai, satuan, nilai_rujukan, keterangan, biaya_item)| DetailHasilLab {
        id_template, pemeriksaan, nilai, satuan, nilai_rujukan, keterangan, biaya_item,
    }).collect())
}
