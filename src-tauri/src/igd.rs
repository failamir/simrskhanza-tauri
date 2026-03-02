/// Phase 4 – IGD (Emergency) Module
/// Tables: reg_periksa (kd_poli=IGD), data_triase_igd, catatan_observasi_igd, master_triase_macam_kasus

use mysql_async::{prelude::*, Pool, params};
use tauri::State;
use serde::{Deserialize, Serialize};
use crate::db::DbState;

// ─────────────────────────── STRUCTS ──────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KunjunganIGD {
    pub no_rawat: String,
    pub no_rkm_medis: String,
    pub nm_pasien: String,
    pub nm_dokter: String,
    pub png_jawab: String,
    pub jam_reg: String,
    pub stts: String,
    pub ada_triase: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct MasterKasus {
    pub kode_kasus: String,
    pub macam_kasus: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TriaseInput {
    pub no_rawat: String,
    pub cara_masuk: String,
    pub alat_transportasi: String,
    pub alasan_kedatangan: String,
    pub keterangan_kedatangan: String,
    pub kode_kasus: String,
    pub tekanan_darah: String,
    pub nadi: String,
    pub pernapasan: String,
    pub suhu: String,
    pub saturasi_o2: String,
    pub nyeri: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DataTriase {
    pub tgl_kunjungan: String,
    pub cara_masuk: String,
    pub alat_transportasi: String,
    pub alasan_kedatangan: String,
    pub kode_kasus: String,
    pub macam_kasus: String,
    pub tekanan_darah: String,
    pub nadi: String,
    pub pernapasan: String,
    pub suhu: String,
    pub saturasi_o2: String,
    pub nyeri: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ObservasiInput {
    pub no_rawat: String,
    pub gcs: String,
    pub td: String,
    pub hr: String,
    pub rr: String,
    pub suhu: String,
    pub spo2: String,
    pub nip: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ObservasiRow {
    pub jam_rawat: String,
    pub gcs: String,
    pub td: String,
    pub hr: String,
    pub rr: String,
    pub suhu: String,
    pub spo2: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct StatsIGD {
    pub total_hari_ini: i64,
    pub triase_selesai: i64,
    pub masih_ditangani: i64,
    pub dirujuk: i64,
}

// ──────────────────────────── HELPER ──────────────────────────────

fn get_pool(state: &State<'_, DbState>) -> Result<Pool, String> {
    let guard = state.pool.lock().unwrap();
    guard.as_ref().ok_or_else(|| "Database not initialized".to_string()).cloned()
}

// ──────────────────────────── COMMANDS ────────────────────────────

#[tauri::command]
pub async fn get_kunjungan_igd(
    state: State<'_, DbState>,
    tanggal: String,
) -> Result<Vec<KunjunganIGD>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT rp.no_rawat, rp.no_rkm_medis, IFNULL(p.nm_pasien,''), \
         IFNULL(d.nm_dokter,''), IFNULL(pj.png_jawab,''), \
         IFNULL(TIME_FORMAT(rp.jam_reg,'%H:%i'),''), rp.stts, \
         IF(dt.no_rawat IS NOT NULL, 1, 0) \
         FROM reg_periksa rp \
         LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis \
         LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter \
         LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj \
         LEFT JOIN data_triase_igd dt ON rp.no_rawat = dt.no_rawat \
         WHERE rp.tgl_registrasi = '{}' \
         AND rp.kd_poli = (SELECT kd_poli FROM poliklinik WHERE nm_poli LIKE '%IGD%' LIMIT 1) \
         ORDER BY rp.jam_reg DESC",
        tanggal
    );

    let rows: Vec<(String, String, String, String, String, String, String, i8)> =
        conn.query(sql).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| KunjunganIGD {
        no_rawat: r.0, no_rkm_medis: r.1, nm_pasien: r.2,
        nm_dokter: r.3, png_jawab: r.4, jam_reg: r.5, stts: r.6,
        ada_triase: r.7 == 1,
    }).collect())
}

#[tauri::command]
pub async fn get_master_kasus_igd(
    state: State<'_, DbState>,
) -> Result<Vec<MasterKasus>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let rows: Vec<(String, String)> = conn.query(
        "SELECT kode_kasus, macam_kasus FROM master_triase_macam_kasus ORDER BY kode_kasus"
    ).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(kode_kasus, macam_kasus)| MasterKasus { kode_kasus, macam_kasus }).collect())
}

#[tauri::command]
pub async fn save_triase_igd(
    state: State<'_, DbState>,
    input: TriaseInput,
) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Upsert triase
    conn.exec_drop(
        "INSERT INTO data_triase_igd \
         (no_rawat, tgl_kunjungan, cara_masuk, alat_transportasi, alasan_kedatangan, \
         keterangan_kedatangan, kode_kasus, tekanan_darah, nadi, pernapasan, suhu, saturasi_o2, nyeri) \
         VALUES (:no_rawat, NOW(), :cara_masuk, :alat_transportasi, :alasan_kedatangan, \
         :keterangan, :kode_kasus, :td, :nadi, :rr, :suhu, :spo2, :nyeri) \
         ON DUPLICATE KEY UPDATE \
         cara_masuk=VALUES(cara_masuk), alat_transportasi=VALUES(alat_transportasi), \
         alasan_kedatangan=VALUES(alasan_kedatangan), kode_kasus=VALUES(kode_kasus), \
         tekanan_darah=VALUES(tekanan_darah), nadi=VALUES(nadi), pernapasan=VALUES(pernapasan), \
         suhu=VALUES(suhu), saturasi_o2=VALUES(saturasi_o2), nyeri=VALUES(nyeri)",
        params! {
            "no_rawat" => &input.no_rawat,
            "cara_masuk" => &input.cara_masuk,
            "alat_transportasi" => &input.alat_transportasi,
            "alasan_kedatangan" => &input.alasan_kedatangan,
            "keterangan" => &input.keterangan_kedatangan,
            "kode_kasus" => &input.kode_kasus,
            "td" => &input.tekanan_darah,
            "nadi" => &input.nadi,
            "rr" => &input.pernapasan,
            "suhu" => &input.suhu,
            "spo2" => &input.saturasi_o2,
            "nyeri" => &input.nyeri,
        }
    ).await.map_err(|e| e.to_string())?;

    Ok("Triase berhasil disimpan".into())
}

#[tauri::command]
pub async fn get_triase_igd(
    state: State<'_, DbState>,
    no_rawat: String,
) -> Result<Option<DataTriase>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let row: Option<(String, String, String, String, String, String, String, String, String, String, String, String)> = conn.exec_first(
        "SELECT IFNULL(DATE_FORMAT(dt.tgl_kunjungan,'%d-%m-%Y %H:%i'),''), \
         dt.cara_masuk, dt.alat_transportasi, dt.alasan_kedatangan, \
         dt.kode_kasus, IFNULL(mk.macam_kasus,''), \
         dt.tekanan_darah, dt.nadi, dt.pernapasan, dt.suhu, dt.saturasi_o2, dt.nyeri \
         FROM data_triase_igd dt \
         LEFT JOIN master_triase_macam_kasus mk ON dt.kode_kasus = mk.kode_kasus \
         WHERE dt.no_rawat=?",
        (&no_rawat,)
    ).await.map_err(|e| e.to_string())?;

    Ok(row.map(|r| DataTriase {
        tgl_kunjungan: r.0, cara_masuk: r.1, alat_transportasi: r.2,
        alasan_kedatangan: r.3, kode_kasus: r.4, macam_kasus: r.5,
        tekanan_darah: r.6, nadi: r.7, pernapasan: r.8,
        suhu: r.9, saturasi_o2: r.10, nyeri: r.11,
    }))
}

#[tauri::command]
pub async fn add_observasi_igd(
    state: State<'_, DbState>,
    input: ObservasiInput,
) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    conn.exec_drop(
        "INSERT INTO catatan_observasi_igd \
         (no_rawat, tgl_perawatan, jam_rawat, gcs, td, hr, rr, suhu, spo2, nip) \
         VALUES (?,CURDATE(),NOW(),?,?,?,?,?,?,?)",
        (&input.no_rawat, &input.gcs, &input.td, &input.hr,
         &input.rr, &input.suhu, &input.spo2, &input.nip)
    ).await.map_err(|e| e.to_string())?;

    Ok("Observasi disimpan".into())
}

#[tauri::command]
pub async fn get_observasi_igd(
    state: State<'_, DbState>,
    no_rawat: String,
) -> Result<Vec<ObservasiRow>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let stmt = conn.prep(
        "SELECT IFNULL(TIME_FORMAT(jam_rawat,'%H:%i'),''), \
         IFNULL(gcs,''), IFNULL(td,''), IFNULL(hr,''), \
         IFNULL(rr,''), IFNULL(suhu,''), IFNULL(spo2,'') \
         FROM catatan_observasi_igd WHERE no_rawat=? \
         ORDER BY tgl_perawatan, jam_rawat"
    ).await.map_err(|e| e.to_string())?;

    let rows: Vec<(String, String, String, String, String, String, String)> =
        conn.exec(stmt, (no_rawat,)).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| ObservasiRow {
        jam_rawat: r.0, gcs: r.1, td: r.2, hr: r.3, rr: r.4, suhu: r.5, spo2: r.6,
    }).collect())
}

#[tauri::command]
pub async fn get_stats_igd(
    state: State<'_, DbState>,
    tanggal: String,
) -> Result<StatsIGD, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT \
         COUNT(*) as total, \
         SUM(IF(dt.no_rawat IS NOT NULL,1,0)) as triase, \
         SUM(IF(rp.stts NOT IN ('Pulang','Rujuk'),1,0)) as ditangani, \
         SUM(IF(rp.stts='Rujuk',1,0)) as dirujuk \
         FROM reg_periksa rp \
         LEFT JOIN data_triase_igd dt ON rp.no_rawat=dt.no_rawat \
         WHERE rp.tgl_registrasi='{}' \
         AND rp.kd_poli=(SELECT kd_poli FROM poliklinik WHERE nm_poli LIKE '%IGD%' LIMIT 1)",
        tanggal
    );

    let row: Option<(i64, i64, i64, i64)> = conn.query_first(sql).await.map_err(|e| e.to_string())?;

    let (total_hari_ini, triase_selesai, masih_ditangani, dirujuk) =
        row.unwrap_or((0, 0, 0, 0));

    Ok(StatsIGD { total_hari_ini, triase_selesai, masih_ditangani, dirujuk })
}
