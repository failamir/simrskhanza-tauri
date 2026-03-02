/// Phase 4 – Radiologi Module
/// Tables: periksa_radiologi, jns_perawatan_radiologi

use mysql_async::{prelude::*, Pool, params};
use tauri::State;
use serde::{Deserialize, Serialize};
use crate::db::DbState;

// ─────────────────────────── STRUCTS ──────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct JenisRadiologi {
    pub kd_jenis_prw: String,
    pub nm_perawatan: String,
    pub total_byr: f64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PeriksaRadiologiRow {
    pub no_rawat: String,
    pub nm_pasien: String,
    pub nm_perawatan: String,
    pub tgl_periksa: String,
    pub jam: String,
    pub nm_dokter: String,
    pub status: String,
    pub biaya: f64,
    pub proyeksi: String,
    pub expertise: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PeriksaRadiologiInput {
    pub no_rawat: String,
    pub kd_jenis_prw: String,
    pub kd_dokter: String,
    pub dokter_perujuk: String,
    pub status: String,
    pub proyeksi: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ExpertiseInput {
    pub no_rawat: String,
    pub kd_jenis_prw: String,
    pub tgl_periksa: String,
    pub jam: String,
    pub expertise: String,
}

// ──────────────────────────── HELPER ──────────────────────────────

fn get_pool(state: &State<'_, DbState>) -> Result<Pool, String> {
    let guard = state.pool.lock().unwrap();
    guard.as_ref().ok_or_else(|| "Database not initialized".to_string()).cloned()
}

// ──────────────────────────── COMMANDS ────────────────────────────

#[tauri::command]
pub async fn get_jenis_radiologi(
    state: State<'_, DbState>,
) -> Result<Vec<JenisRadiologi>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let rows: Vec<(String, String, f64)> = conn.query(
        "SELECT kd_jenis_prw, IFNULL(nm_perawatan,''), IFNULL(total_byr,0) \
         FROM jns_perawatan_radiologi WHERE status='1' \
         ORDER BY nm_perawatan"
    ).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(kd, nm, total)| JenisRadiologi {
        kd_jenis_prw: kd, nm_perawatan: nm, total_byr: total,
    }).collect())
}

#[tauri::command]
pub async fn get_periksa_radiologi(
    state: State<'_, DbState>,
    tanggal: String,
) -> Result<Vec<PeriksaRadiologiRow>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT pr.no_rawat, IFNULL(p.nm_pasien,''), \
         IFNULL(jr.nm_perawatan,''), \
         IFNULL(DATE_FORMAT(pr.tgl_periksa,'%d-%m-%Y'),''), \
         IFNULL(TIME_FORMAT(pr.jam,'%H:%i'),''), \
         IFNULL(d.nm_dokter,''), pr.status, pr.biaya, \
         IFNULL(pr.proyeksi,''), '' \
         FROM periksa_radiologi pr \
         LEFT JOIN reg_periksa rp ON pr.no_rawat = rp.no_rawat \
         LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis \
         LEFT JOIN jns_perawatan_radiologi jr ON pr.kd_jenis_prw = jr.kd_jenis_prw \
         LEFT JOIN dokter d ON pr.kd_dokter = d.kd_dokter \
         WHERE pr.tgl_periksa = '{}' \
         ORDER BY pr.jam DESC",
        tanggal
    );

    let rows: Vec<(String, String, String, String, String, String, String, f64, String, String)> =
        conn.query(sql).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| PeriksaRadiologiRow {
        no_rawat: r.0, nm_pasien: r.1, nm_perawatan: r.2,
        tgl_periksa: r.3, jam: r.4, nm_dokter: r.5, status: r.6,
        biaya: r.7, proyeksi: r.8, expertise: r.9,
    }).collect())
}

#[tauri::command]
pub async fn buat_periksa_radiologi(
    state: State<'_, DbState>,
    input: PeriksaRadiologiInput,
) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Get tarif
    let tarif: (f64, f64, f64, f64, f64, f64, f64) = conn.exec_first(
        "SELECT IFNULL(bagian_rs,0), IFNULL(bhp,0), IFNULL(tarif_perujuk,0), \
         IFNULL(tarif_tindakan_dokter,0), IFNULL(tarif_tindakan_petugas,0), \
         IFNULL(kso,0), IFNULL(total_byr,0) \
         FROM jns_perawatan_radiologi WHERE kd_jenis_prw=?",
        (&input.kd_jenis_prw,)
    ).await.map_err(|e| e.to_string())?.unwrap_or((0.0,0.0,0.0,0.0,0.0,0.0,0.0));

    // Use a system NIP (first petugas found)
    let nip: String = conn.query_first(
        "SELECT nip FROM petugas LIMIT 1"
    ).await.map_err(|e| e.to_string())?.unwrap_or("00".into());

    conn.exec_drop(
        "INSERT INTO periksa_radiologi \
         (no_rawat, nip, kd_jenis_prw, tgl_periksa, jam, dokter_perujuk, \
         bagian_rs, bhp, tarif_perujuk, tarif_tindakan_dokter, tarif_tindakan_petugas, \
         kso, menejemen, biaya, kd_dokter, status, proyeksi, kV, mAS, FFD, BSF, inak, jml_penyinaran, dosis) \
         VALUES (:n, :nip, :kp, CURDATE(), NOW(), :dp, :brs, :bhp, :tp, :ttd, :ttp, :kso, 0, :b, :kd, :sta, :pro, '','','','','','','')",
        params! {
            "n" => &input.no_rawat,
            "nip" => nip,
            "kp" => &input.kd_jenis_prw,
            "dp" => &input.dokter_perujuk,
            "brs" => tarif.0,
            "bhp" => tarif.1,
            "tp" => tarif.2,
            "ttd" => tarif.3,
            "ttp" => tarif.4,
            "kso" => tarif.5,
            "b" => tarif.6,
            "kd" => &input.kd_dokter,
            "sta" => &input.status,
            "pro" => &input.proyeksi,
        }
    ).await.map_err(|e| e.to_string())?;

    Ok("Pemeriksaan radiologi berhasil dibuat".into())
}
