/// Phase 4 – Laporan (Reports) Module
/// Aggregates data across all major tables for management reporting

use mysql_async::{prelude::*, Pool};
use tauri::State;
use serde::{Deserialize, Serialize};
use crate::db::DbState;

// ─────────────────────────── STRUCTS ──────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LaporanHarian {
    pub tanggal: String,
    pub total_kunjungan: i64,
    pub kunjungan_ralan: i64,
    pub kunjungan_igd: i64,
    pub pasien_ranap: i64,
    pub pasien_baru: i64,
    pub total_resep: i64,
    pub total_lab: i64,
    pub total_radiologi: i64,
    pub total_pendapatan: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct LaporanBulanan {
    pub bulan: String,
    pub total_kunjungan: i64,
    pub pasien_baru: i64,
    pub total_pendapatan: f64,
    pub rata_kunjungan: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct KunjunganPoliRow {
    pub nm_poli: String,
    pub jumlah: i64,
    pub persen: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DiagnosaRow {
    pub kd_penyakit: String,
    pub nm_penyakit: String,
    pub jumlah: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PendapatanRow {
    pub kategori: String,
    pub total: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DokterKunjunganRow {
    pub nm_dokter: String,
    pub jumlah_pasien: i64,
    pub total_pendapatan: f64,
}

// ──────────────────────────── HELPER ──────────────────────────────

fn get_pool(state: &State<'_, DbState>) -> Result<Pool, String> {
    let guard = state.pool.lock().unwrap();
    guard.as_ref().ok_or_else(|| "Database not initialized".to_string()).cloned()
}

// ──────────────────────────── COMMANDS ────────────────────────────

#[tauri::command]
pub async fn get_laporan_harian(
    state: State<'_, DbState>,
    tanggal: String,
) -> Result<LaporanHarian, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT \
         COUNT(DISTINCT rp.no_rawat) as total, \
         SUM(IF(rp.kd_poli NOT IN (SELECT kd_poli FROM poliklinik WHERE nm_poli LIKE '%IGD%'),1,0)) as ralan, \
         SUM(IF(rp.kd_poli IN (SELECT kd_poli FROM poliklinik WHERE nm_poli LIKE '%IGD%'),1,0)) as igd, \
         IFNULL((SELECT COUNT(*) FROM kamar_inap ki2 WHERE ki2.tgl_masuk='{}' AND (ki2.tgl_keluar IS NULL OR ki2.tgl_keluar='0000-00-00')),0) as ranap, \
         SUM(IF(rp.no_rkm_medis IN (SELECT no_rkm_medis FROM pasien WHERE tgl_daftar='{}'),1,0)) as baru, \
         IFNULL((SELECT COUNT(*) FROM resep_obat ro WHERE DATE(ro.tgl_peresepan)='{}'),0) as resep, \
         IFNULL((SELECT COUNT(*) FROM permintaan_lab pl WHERE pl.tgl_permintaan='{}'),0) as lab, \
         IFNULL((SELECT COUNT(*) FROM periksa_radiologi pr WHERE pr.tgl_periksa='{}'),0) as rad, \
         IFNULL((SELECT SUM(b.totalbiaya) FROM billing b JOIN nota_jalan nj ON b.no_rawat=nj.no_rawat WHERE nj.tanggal='{}'),0) + \
         IFNULL((SELECT SUM(b.totalbiaya) FROM billing b JOIN nota_inap ni ON b.no_rawat=ni.no_rawat WHERE ni.tanggal='{}'),0) as pendapatan \
         FROM reg_periksa rp WHERE rp.tgl_registrasi='{}'",
        tanggal, tanggal, tanggal, tanggal, tanggal, tanggal, tanggal, tanggal
    );

    let row: Option<(i64, i64, i64, i64, i64, i64, i64, i64, f64)> =
        conn.query_first(sql).await.map_err(|e| e.to_string())?;

    let r = row.unwrap_or((0, 0, 0, 0, 0, 0, 0, 0, 0.0));
    Ok(LaporanHarian {
        tanggal: tanggal.clone(),
        total_kunjungan: r.0,
        kunjungan_ralan: r.1,
        kunjungan_igd: r.2,
        pasien_ranap: r.3,
        pasien_baru: r.4,
        total_resep: r.5,
        total_lab: r.6,
        total_radiologi: r.7,
        total_pendapatan: r.8,
    })
}

#[tauri::command]
pub async fn get_laporan_bulanan(
    state: State<'_, DbState>,
    tahun: String,
) -> Result<Vec<LaporanBulanan>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT \
         DATE_FORMAT(rp.tgl_registrasi,'%Y-%m') as bulan, \
         COUNT(*) as total, \
         SUM(IF(p.tgl_daftar=rp.tgl_registrasi,1,0)) as pasien_baru, \
         IFNULL((SELECT SUM(b.totalbiaya) FROM billing b \
           JOIN nota_jalan nj ON b.no_rawat=nj.no_rawat \
           WHERE DATE_FORMAT(nj.tanggal,'%Y-%m')=DATE_FORMAT(rp.tgl_registrasi,'%Y-%m')),0) as pendapatan, \
         COUNT(*) / DAY(LAST_DAY(rp.tgl_registrasi)) as rata \
         FROM reg_periksa rp \
         LEFT JOIN pasien p ON rp.no_rkm_medis=p.no_rkm_medis \
         WHERE YEAR(rp.tgl_registrasi)='{}' \
         GROUP BY DATE_FORMAT(rp.tgl_registrasi,'%Y-%m') \
         ORDER BY bulan",
        tahun
    );

    let rows: Vec<(String, i64, i64, f64, f64)> =
        conn.query(sql).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(bulan, total, pasien_baru, pendapatan, rata)| LaporanBulanan {
        bulan, total_kunjungan: total, pasien_baru, total_pendapatan: pendapatan, rata_kunjungan: rata,
    }).collect())
}

#[tauri::command]
pub async fn get_kunjungan_per_poli(
    state: State<'_, DbState>,
    tanggal_awal: String,
    tanggal_akhir: String,
) -> Result<Vec<KunjunganPoliRow>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT IFNULL(pl.nm_poli,'Tidak Diketahui'), COUNT(*) as jml, \
         ROUND(COUNT(*)*100.0/(SELECT COUNT(*) FROM reg_periksa \
           WHERE tgl_registrasi BETWEEN '{}' AND '{}'),1) \
         FROM reg_periksa rp \
         LEFT JOIN poliklinik pl ON rp.kd_poli=pl.kd_poli \
         WHERE rp.tgl_registrasi BETWEEN '{}' AND '{}' \
         GROUP BY pl.nm_poli ORDER BY jml DESC LIMIT 15",
        tanggal_awal, tanggal_akhir, tanggal_awal, tanggal_akhir
    );

    let rows: Vec<(String, i64, f64)> = conn.query(sql).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(nm_poli, jumlah, persen)| KunjunganPoliRow { nm_poli, jumlah, persen }).collect())
}

#[tauri::command]
pub async fn get_diagnosa_terbanyak(
    state: State<'_, DbState>,
    tanggal_awal: String,
    tanggal_akhir: String,
) -> Result<Vec<DiagnosaRow>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT dp.kd_penyakit, IFNULL(py.nm_penyakit,''), COUNT(*) as jml \
         FROM diagnosa_pasien_ralan dp \
         LEFT JOIN penyakit py ON dp.kd_penyakit=py.kd_penyakit \
         JOIN reg_periksa rp ON dp.no_rawat=rp.no_rawat \
         WHERE rp.tgl_registrasi BETWEEN '{}' AND '{}' \
         GROUP BY dp.kd_penyakit ORDER BY jml DESC LIMIT 10",
        tanggal_awal, tanggal_akhir
    );

    let rows: Vec<(String, String, i64)> = conn.query(sql).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(kd, nm, jml)| DiagnosaRow {
        kd_penyakit: kd, nm_penyakit: nm, jumlah: jml,
    }).collect())
}

#[tauri::command]
pub async fn get_pendapatan_per_kategori(
    state: State<'_, DbState>,
    tanggal_awal: String,
    tanggal_akhir: String,
) -> Result<Vec<PendapatanRow>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT IFNULL(status,'-'), SUM(totalbiaya) \
         FROM billing \
         WHERE tgl_byr BETWEEN '{}' AND '{}' \
         AND status NOT LIKE 'Ttl%' AND status NOT IN ('-') \
         GROUP BY status ORDER BY SUM(totalbiaya) DESC",
        tanggal_awal, tanggal_akhir
    );

    let rows: Vec<(String, f64)> = conn.query(sql).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(kategori, total)| PendapatanRow { kategori, total }).collect())
}

#[tauri::command]
pub async fn get_kinerja_dokter(
    state: State<'_, DbState>,
    tanggal_awal: String,
    tanggal_akhir: String,
) -> Result<Vec<DokterKunjunganRow>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT IFNULL(d.nm_dokter,''), COUNT(rp.no_rawat) as jml, \
         IFNULL((SELECT SUM(b.totalbiaya) FROM billing b \
           JOIN reg_periksa rp2 ON b.no_rawat=rp2.no_rawat \
           WHERE rp2.kd_dokter=rp.kd_dokter \
           AND rp2.tgl_registrasi BETWEEN '{}' AND '{}'),0) \
         FROM reg_periksa rp \
         LEFT JOIN dokter d ON rp.kd_dokter=d.kd_dokter \
         WHERE rp.tgl_registrasi BETWEEN '{}' AND '{}' \
         GROUP BY rp.kd_dokter ORDER BY jml DESC LIMIT 10",
        tanggal_awal, tanggal_akhir, tanggal_awal, tanggal_akhir
    );

    let rows: Vec<(String, i64, f64)> = conn.query(sql).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(nm_dokter, jml, total)| DokterKunjunganRow {
        nm_dokter, jumlah_pasien: jml, total_pendapatan: total,
    }).collect())
}
