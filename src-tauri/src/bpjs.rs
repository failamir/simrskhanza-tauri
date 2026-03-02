/// BPJS Bridging Module (VClaim API v3)
/// Handles: eligibility check, SEP creation, SEP retrieval, rujukan, local DB operations
///
/// BPJS VClaim uses HMAC-SHA256 for request signing and a timestamp-based system key.
/// All config (cons_id, secretkey, userkey, kd_ppk) is stored per-session via set_bpjs_config.

use hmac::{Hmac, Mac};
use sha2::Sha256;
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Mutex;
use std::time::{SystemTime, UNIX_EPOCH};
use tauri::State;
use mysql_async::{prelude::*, Pool, params};
use crate::db::DbState;

// ─────────────────────────── CONFIG STATE ─────────────────────────

#[derive(Debug, Default, Clone)]
pub struct BpjsConfig {
    pub cons_id: String,
    pub secret_key: String,
    pub user_key: String,
    pub kd_ppk: String,
    pub base_url: String, // prod: https://vclaim.bpjs-kesehatan.go.id/vclaim-rest
}

pub struct BpjsState {
    pub config: Mutex<BpjsConfig>,
}

impl Default for BpjsState {
    fn default() -> Self {
        Self {
            config: Mutex::new(BpjsConfig {
                cons_id: String::new(),
                secret_key: String::new(),
                user_key: String::new(),
                kd_ppk: String::new(),
                base_url: "https://vclaim.bpjs-kesehatan.go.id/vclaim-rest".into(),
            }),
        }
    }
}

// ─────────────────────────── STRUCTS ──────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BpjsConfigInput {
    pub cons_id: String,
    pub secret_key: String,
    pub user_key: String,
    pub kd_ppk: String,
    pub use_dev: bool, // dev = https://apijkn-dev.bpjs-kesehatan.go.id/vclaim-rest
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct EligibilitasResult {
    pub no_kartu: String,
    pub nama: String,
    pub tgl_lahir: String,
    pub jenis_kelamin: String,
    pub pisa: String,           // status kepesertaan
    pub kelas: String,
    pub jenis_peserta: String,
    pub status_aktif: String,
    pub faskes_1: String,
    pub no_mr: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SepRow {
    pub no_sep: String,
    pub no_rawat: String,
    pub tglsep: String,
    pub nama_pasien: String,
    pub no_kartu: String,
    pub peserta: String,
    pub kelas_rawat: String,
    pub nm_poli: String,
    pub jenis_pelayanan: String,
    pub diagawal: String,
    pub catatan: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BuatSepInput {
    pub no_rawat: String,
    pub no_kartu: String,
    pub tgl_sep: String,
    pub jenis_pelayanan: String, // "1"=Ralan, "2"=Ranap
    pub kd_poli: String,
    pub nm_poli: String,
    pub kelas: String,           // "1","2","3"
    pub diagnosa: String,
    pub catatan: String,
    pub tgl_rujukan: String,
    pub no_rujukan: String,
    pub kd_ppk_rujukan: String,
    pub nm_ppk_rujukan: String,
    pub lakalantas: String,      // "0"=Tidak, "1"=Ya
    pub nm_pasien: String,
    pub tgl_lahir: String,
    pub jkel: String,            // "L"/"P"
    pub no_mr: String,
    pub no_telep: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct ApiResponse {
    pub success: bool,
    pub message: String,
    pub data: Option<Value>,
}

// ──────────────────────────── AUTH HELPERS ────────────────────────

/// Build HMAC-SHA256 timestamp-keyed system key required by BPJS VClaim
fn build_system_key(secret_key: &str) -> String {
    let ts = SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs();
    let message = ts.to_string();

    let mut mac = Hmac::<Sha256>::new_from_slice(secret_key.as_bytes())
        .expect("HMAC key error");
    mac.update(message.as_bytes());
    let result = mac.finalize().into_bytes();
    hex::encode(result)
}

fn build_timestamp() -> u64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap()
        .as_secs()
}

fn build_headers(cons_id: &str, secret_key: &str, user_key: &str) -> reqwest::header::HeaderMap {
    let mut headers = reqwest::header::HeaderMap::new();
    headers.insert("X-cons-id", cons_id.parse().unwrap());
    headers.insert("X-timestamp", build_timestamp().to_string().parse().unwrap());
    headers.insert("X-signature", build_system_key(secret_key).parse().unwrap());
    headers.insert("user_key", user_key.parse().unwrap());
    headers.insert("Content-Type", "application/json".parse().unwrap());
    headers
}

// Pool helper
fn get_pool(state: &State<'_, DbState>) -> Result<Pool, String> {
    let guard = state.pool.lock().unwrap();
    guard.as_ref().ok_or_else(|| "Database not initialized".to_string()).cloned()
}

// ──────────────────────────── COMMANDS ────────────────────────────

/// Simpan konfigurasi BPJS (per session, tidak disimpan ke disk)
#[tauri::command]
pub async fn set_bpjs_config(
    bpjs_state: State<'_, BpjsState>,
    input: BpjsConfigInput,
) -> Result<String, String> {
    let mut cfg = bpjs_state.config.lock().unwrap();
    cfg.cons_id = input.cons_id;
    cfg.secret_key = input.secret_key;
    cfg.user_key = input.user_key;
    cfg.kd_ppk = input.kd_ppk;
    cfg.base_url = if input.use_dev {
        "https://apijkn-dev.bpjs-kesehatan.go.id/vclaim-rest".into()
    } else {
        "https://vclaim.bpjs-kesehatan.go.id/vclaim-rest".into()
    };
    Ok("Konfigurasi BPJS berhasil disimpan".into())
}

/// Cek eligibilitas peserta berdasarkan No. Kartu BPJS
#[tauri::command]
pub async fn cek_eligibilitas(
    bpjs_state: State<'_, BpjsState>,
    no_kartu: String,
    tanggal: String,
) -> Result<ApiResponse, String> {
    let cfg = bpjs_state.config.lock().unwrap().clone();
    if cfg.cons_id.is_empty() {
        return Err("Konfigurasi BPJS belum diset".into());
    }

    let url = format!(
        "{}/peserta/nokartu/{}/tanggal/{}",
        cfg.base_url, no_kartu, tanggal
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .headers(build_headers(&cfg.cons_id, &cfg.secret_key, &cfg.user_key))
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    let status = resp.status().as_u16();
    let body: Value = resp.json().await.map_err(|e| e.to_string())?;

    if status == 200 {
        // Parse peserta data from response
        let peserta = body.get("response").and_then(|r| r.get("peserta"));
        Ok(ApiResponse {
            success: true,
            message: body["message"].as_str().unwrap_or("OK").to_string(),
            data: peserta.cloned(),
        })
    } else {
        Ok(ApiResponse {
            success: false,
            message: body["message"].as_str().unwrap_or("Gagal").to_string(),
            data: None,
        })
    }
}

/// Cek eligibilitas berdasarkan NIK
#[tauri::command]
pub async fn cek_eligibilitas_nik(
    bpjs_state: State<'_, BpjsState>,
    nik: String,
    tanggal: String,
) -> Result<ApiResponse, String> {
    let cfg = bpjs_state.config.lock().unwrap().clone();
    if cfg.cons_id.is_empty() {
        return Err("Konfigurasi BPJS belum diset".into());
    }

    let url = format!(
        "{}/peserta/nik/{}/tanggal/{}",
        cfg.base_url, nik, tanggal
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .headers(build_headers(&cfg.cons_id, &cfg.secret_key, &cfg.user_key))
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    let success = body["metaData"]["code"].as_str().map(|c| c == "200").unwrap_or(false);

    Ok(ApiResponse {
        success,
        message: body["metaData"]["message"].as_str().unwrap_or("").to_string(),
        data: body.get("response").and_then(|r| r.get("peserta")).cloned(),
    })
}

/// Ambil data SEP dari API BPJS berdasarkan no_sep
#[tauri::command]
pub async fn get_sep_remote(
    bpjs_state: State<'_, BpjsState>,
    no_sep: String,
) -> Result<ApiResponse, String> {
    let cfg = bpjs_state.config.lock().unwrap().clone();
    if cfg.cons_id.is_empty() {
        return Err("Konfigurasi BPJS belum diset".into());
    }

    let url = format!("{}/SEP/{}", cfg.base_url, no_sep);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .headers(build_headers(&cfg.cons_id, &cfg.secret_key, &cfg.user_key))
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    let success = body["metaData"]["code"].as_str().map(|c| c == "200").unwrap_or(false);

    Ok(ApiResponse {
        success,
        message: body["metaData"]["message"].as_str().unwrap_or("").to_string(),
        data: body.get("response").cloned(),
    })
}

/// Simpan SEP ke database lokal (bridging_sep)
#[tauri::command]
pub async fn simpan_sep_lokal(
    db_state: State<'_, DbState>,
    input: BuatSepInput,
    no_sep: String,
) -> Result<String, String> {
    let pool = get_pool(&db_state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    conn.exec_drop(
        "INSERT INTO bridging_sep \
         (no_sep, no_rawat, tglsep, tglrujukan, no_rujukan, \
         kdppkrujukan, nmppkrujukan, kdppkpelayanan, nmppkpelayanan, \
         jnspelayanan, catatan, diagawal, nmdiagnosaawal, kdpolitujuan, nmpolitujuan, \
         klsrawat, klsnaik, pembiayaan, pjnaikkelas, lakalantas, user, \
         nomr, nama_pasien, tanggal_lahir, peserta, jkel, no_kartu, \
         asal_rujukan, eksekutif, cob, notelep, katarak, \
         tglkkl, keterangankkl, suplesi, no_sep_suplesi, \
         kdprop, nmprop, kdkab, nmkab, kdkec, nmkec, \
         noskdp, kddpjp, nmdpdjp, tujuankunjungan, flagprosedur, penunjang, \
         asesmenpelayanan, kddpjplayanan, nmdpjplayanan) \
         VALUES \
         (:no_sep, :no_rawat, :tglsep, :tglrujukan, :no_rujukan, \
         :kdppk, :nmppk, '', '', \
         :jns, :catatan, :diag, '', :kdpoli, :nmpoli, \
         :kls, '', '', '', :laka, '', \
         :nomr, :nama, :ttl, '', :jkel, :no_kartu, \
         '', '0. Tidak', '0. Tidak', :notelep, '0. Tidak', \
         '0000-00-00', '', '0. Tidak', '', \
         '', '', '', '', '', '', \
         '', '', '', '0', '0', '1', \
         '1', '', '')",
        params! {
            "no_sep" => &no_sep,
            "no_rawat" => &input.no_rawat,
            "tglsep" => &input.tgl_sep,
            "tglrujukan" => &input.tgl_rujukan,
            "no_rujukan" => &input.no_rujukan,
            "kdppk" => &input.kd_ppk_rujukan,
            "nmppk" => &input.nm_ppk_rujukan,
            "jns" => &input.jenis_pelayanan,
            "catatan" => &input.catatan,
            "diag" => &input.diagnosa,
            "kdpoli" => &input.kd_poli,
            "nmpoli" => &input.nm_poli,
            "kls" => &input.kelas,
            "laka" => &input.lakalantas,
            "nomr" => &input.no_mr,
            "nama" => &input.nm_pasien,
            "ttl" => &input.tgl_lahir,
            "jkel" => &input.jkel,
            "no_kartu" => &input.no_kartu,
            "notelep" => &input.no_telep,
        }
    ).await.map_err(|e| e.to_string())?;

    Ok(format!("SEP {} berhasil disimpan ke database", no_sep))
}

/// Ambil daftar SEP lokal berdasarkan tanggal
#[tauri::command]
pub async fn get_sep_list(
    db_state: State<'_, DbState>,
    tanggal: String,
) -> Result<Vec<SepRow>, String> {
    let pool = get_pool(&db_state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let stmt = conn.prep(
        "SELECT bs.no_sep, IFNULL(bs.no_rawat,''), \
         IFNULL(DATE_FORMAT(bs.tglsep,'%d-%m-%Y'),''), \
         IFNULL(bs.nama_pasien,''), IFNULL(bs.no_kartu,''), \
         IFNULL(bs.peserta,''), \
         CASE bs.klsrawat WHEN '1' THEN 'Kelas 1' WHEN '2' THEN 'Kelas 2' WHEN '3' THEN 'Kelas 3' ELSE '-' END, \
         IFNULL(bs.nmpolitujuan,''), \
         IF(bs.jnspelayanan='1','Rawat Jalan','Rawat Inap'), \
         IFNULL(bs.diagawal,''), IFNULL(bs.catatan,'') \
         FROM bridging_sep bs \
         WHERE bs.tglsep = ? \
         ORDER BY bs.no_sep"
    ).await.map_err(|e| e.to_string())?;

    let rows: Vec<(String, String, String, String, String, String, String, String, String, String, String)> =
        conn.exec(stmt, (tanggal,)).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| SepRow {
        no_sep: r.0, no_rawat: r.1, tglsep: r.2, nama_pasien: r.3,
        no_kartu: r.4, peserta: r.5, kelas_rawat: r.6,
        nm_poli: r.7, jenis_pelayanan: r.8, diagawal: r.9, catatan: r.10,
    }).collect())
}

/// Cek referensi faskes oleh BPJS (untuk dropdown PPK rujukan)
#[tauri::command]
pub async fn cari_faskes_bpjs(
    bpjs_state: State<'_, BpjsState>,
    nama_faskes: String,
    jenis: String, // "1"=Klinik, "2"=RS
) -> Result<ApiResponse, String> {
    let cfg = bpjs_state.config.lock().unwrap().clone();
    if cfg.cons_id.is_empty() {
        return Err("Konfigurasi BPJS belum diset".into());
    }

    let url = format!(
        "{}/referensi/faskes/jenis/{}/nama/{}",
        cfg.base_url, jenis, nama_faskes
    );

    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .headers(build_headers(&cfg.cons_id, &cfg.secret_key, &cfg.user_key))
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    let success = body["metaData"]["code"].as_str().map(|c| c == "200").unwrap_or(false);

    Ok(ApiResponse {
        success,
        message: body["metaData"]["message"].as_str().unwrap_or("").to_string(),
        data: body.get("response").cloned(),
    })
}

/// Cek rujukan dari Faskes 1 via API BPJS
#[tauri::command]
pub async fn cek_rujukan_bpjs(
    bpjs_state: State<'_, BpjsState>,
    no_rujukan: String,
) -> Result<ApiResponse, String> {
    let cfg = bpjs_state.config.lock().unwrap().clone();
    if cfg.cons_id.is_empty() {
        return Err("Konfigurasi BPJS belum diset".into());
    }

    let url = format!("{}/rujukan/{}", cfg.base_url, no_rujukan);
    let client = reqwest::Client::new();
    let resp = client
        .get(&url)
        .headers(build_headers(&cfg.cons_id, &cfg.secret_key, &cfg.user_key))
        .send()
        .await
        .map_err(|e| format!("HTTP error: {}", e))?;

    let body: Value = resp.json().await.map_err(|e| e.to_string())?;
    let success = body["metaData"]["code"].as_str().map(|c| c == "200").unwrap_or(false);

    Ok(ApiResponse {
        success,
        message: body["metaData"]["message"].as_str().unwrap_or("").to_string(),
        data: body.get("response").cloned(),
    })
}

/// Get SEP by no_rawat (lokal)
#[tauri::command]
pub async fn get_sep_by_rawat(
    db_state: State<'_, DbState>,
    no_rawat: String,
) -> Result<Option<SepRow>, String> {
    let pool = get_pool(&db_state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let row: Option<(String, String, String, String, String, String, String, String, String, String, String)> = conn.exec_first(
        "SELECT bs.no_sep, IFNULL(bs.no_rawat,''), \
         IFNULL(DATE_FORMAT(bs.tglsep,'%d-%m-%Y'),''), \
         IFNULL(bs.nama_pasien,''), IFNULL(bs.no_kartu,''), \
         IFNULL(bs.peserta,''), \
         CASE bs.klsrawat WHEN '1' THEN 'Kelas 1' WHEN '2' THEN 'Kelas 2' WHEN '3' THEN 'Kelas 3' ELSE '-' END, \
         IFNULL(bs.nmpolitujuan,''), \
         IF(bs.jnspelayanan='1','Rawat Jalan','Rawat Inap'), \
         IFNULL(bs.diagawal,''), IFNULL(bs.catatan,'') \
         FROM bridging_sep bs WHERE bs.no_rawat=? LIMIT 1",
        (&no_rawat,)
    ).await.map_err(|e| e.to_string())?;

    Ok(row.map(|r| SepRow {
        no_sep: r.0, no_rawat: r.1, tglsep: r.2, nama_pasien: r.3,
        no_kartu: r.4, peserta: r.5, kelas_rawat: r.6,
        nm_poli: r.7, jenis_pelayanan: r.8, diagawal: r.9, catatan: r.10,
    }))
}
