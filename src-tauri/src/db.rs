use mysql_async::{prelude::*, Pool, OptsBuilder, params};
use tauri::State;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

// ─────────────────────────────────────────────
// STRUCTS
// ─────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Pasien {
    pub no_rkm_medis: String,
    pub nm_pasien: String,
    pub jk: String,
    pub tgl_lahir: String,
    pub tmp_lahir: String,
    pub no_tlp: String,
    pub alamat: String,
    pub agama: String,
    pub stts_nikah: String,
    pub gol_darah: String,
    pub tgl_daftar: String,
    pub no_ktp: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct PasienInput {
    pub nm_pasien: String,
    pub jk: String,
    pub tgl_lahir: String,
    pub tmp_lahir: String,
    pub no_tlp: String,
    pub alamat: String,
    pub agama: String,
    pub stts_nikah: String,
    pub gol_darah: String,
    pub no_ktp: String,
    pub pekerjaan: String,
    pub pendidikan: String,
    pub nm_ayah: String,
    pub nm_ibu_kandung: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct UserInfo {
    pub id_user: String,
    pub nama: String,
    pub jabatan: String,
    pub level: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DashboardStats {
    pub total_pasien: i64,
    pub kunjungan_ralan_hari_ini: i64,
    pub pasien_ranap_aktif: i64,
    pub antrian_menunggu: i64,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Poliklinik {
    pub kd_poli: String,
    pub nm_poli: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Dokter {
    pub kd_dokter: String,
    pub nm_dokter: String,
    pub kd_poli: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Penjab {
    pub kd_pj: String,
    pub png_jawab: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct AntrianLoket {
    pub no_rawat: String,
    pub nm_pasien: String,
    pub no_rkm_medis: String,
    pub nm_poli: String,
    pub png_jawab: String,
    pub status: String,
    pub jam_masuk: String,
    pub no_antrian: Option<i32>,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct RegistrasiInput {
    pub no_rkm_medis: String,
    pub kd_poli: String,
    pub kd_dokter: String,
    pub kd_pj: String,
    pub tgl_registrasi: String,
    pub jam_reg: String,
    pub no_rawat: String,
    pub stts: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct DbConfig {
    pub host: String,
    pub port: u16,
    pub user: String,
    pub pass: String,
    pub dbname: String,
}

pub struct DbState {
    pub pool: Mutex<Option<Pool>>,
}

// ─────────────────────────────────────────────
// DB CONNECTION
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn test_connection(config: DbConfig) -> Result<String, String> {
    let opts = OptsBuilder::default()
        .ip_or_hostname(config.host)
        .tcp_port(config.port)
        .user(Some(config.user))
        .pass(Some(config.pass))
        .db_name(Some(config.dbname));

    let pool = Pool::new(opts);
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;
    let _ = r"SELECT 1".ignore(&mut conn).await.map_err(|e| e.to_string())?;
    Ok("Connection successful".into())
}

#[tauri::command]
pub async fn init_connection(state: State<'_, DbState>, config: DbConfig) -> Result<String, String> {
    let opts = OptsBuilder::default()
        .ip_or_hostname(config.host)
        .tcp_port(config.port)
        .user(Some(config.user))
        .pass(Some(config.pass))
        .db_name(Some(config.dbname));

    let pool = Pool::new(opts);
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;
    let _ = r"SELECT 1".ignore(&mut conn).await.map_err(|e| e.to_string())?;
    *state.pool.lock().unwrap() = Some(pool);
    Ok("Connection initialized".into())
}

// Helper to get pool
fn get_pool(state: &State<'_, DbState>) -> Result<Pool, String> {
    let pool_guard = state.pool.lock().unwrap();
    pool_guard.as_ref().ok_or("Database not initialized".to_string()).cloned()
}

// ─────────────────────────────────────────────
// AUTH
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn check_login(state: State<'_, DbState>, user: String, pass: String) -> Result<UserInfo, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Check admin table first
    let stmt_admin = conn.prep(
        "SELECT AES_DECRYPT(usere,'nur'), AES_DECRYPT(usere,'nur'), 'Administrator', 'admin' \
         FROM admin WHERE AES_DECRYPT(usere,'nur') = ? AND AES_DECRYPT(passworde,'windi') = ? LIMIT 1"
    ).await.map_err(|e| e.to_string())?;

    let result_admin: Vec<(Option<Vec<u8>>, Option<Vec<u8>>, String, String)> =
        conn.exec(stmt_admin, (user.clone(), pass.clone())).await.map_err(|e| e.to_string())?;

    if let Some(row) = result_admin.into_iter().next() {
        let id = row.0.map(|b| String::from_utf8_lossy(&b).to_string()).unwrap_or_default();
        return Ok(UserInfo {
            id_user: id.clone(),
            nama: id,
            jabatan: "Administrator".to_string(),
            level: "admin".to_string(),
        });
    }

    // Check user table
    let stmt_user = conn.prep(
        "SELECT AES_DECRYPT(id_user,'nur'), AES_DECRYPT(nama,'nur'), AES_DECRYPT(jabatan,'nur'), AES_DECRYPT(id_user,'nur') \
         FROM user WHERE AES_DECRYPT(id_user,'nur') = ? AND AES_DECRYPT(password,'windi') = ? LIMIT 1"
    ).await.map_err(|e| e.to_string())?;

    let result_user: Vec<(Option<Vec<u8>>, Option<Vec<u8>>, Option<Vec<u8>>, Option<Vec<u8>>)> =
        conn.exec(stmt_user, (user, pass)).await.map_err(|e| e.to_string())?;

    if let Some(row) = result_user.into_iter().next() {
        let to_str = |b: Option<Vec<u8>>| b.map(|v| String::from_utf8_lossy(&v).to_string()).unwrap_or_default();
        return Ok(UserInfo {
            id_user: to_str(row.0.clone()),
            nama: to_str(row.1),
            jabatan: to_str(row.2),
            level: "user".to_string(),
        });
    }

    Err("User tidak ditemukan atau password salah".into())
}

// ─────────────────────────────────────────────
// DASHBOARD
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn get_dashboard_stats(state: State<'_, DbState>) -> Result<DashboardStats, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Total pasien terdaftar
    let total_pasien: i64 = conn
        .query_first("SELECT COUNT(*) FROM pasien")
        .await.map_err(|e| e.to_string())?
        .unwrap_or(0);

    // Kunjungan rawat jalan hari ini
    let kunjungan_ralan: i64 = conn
        .query_first("SELECT COUNT(*) FROM reg_periksa WHERE tgl_registrasi = CURDATE() AND stts NOT IN ('Ranap','Selesai')")
        .await.map_err(|e| e.to_string())?
        .unwrap_or(0);

    // Pasien rawat inap aktif
    let pasien_ranap: i64 = conn
        .query_first("SELECT COUNT(*) FROM kamar_inap WHERE stts = 'Dirawat'")
        .await.map_err(|e| e.to_string())?
        .unwrap_or(0);

    // Antrian loket menunggu hari ini
    let antrian_menunggu: i64 = conn
        .query_first("SELECT COUNT(*) FROM antriloket WHERE tgl_antri = CURDATE() AND status = 'menunggu'")
        .await.map_err(|e| e.to_string())?
        .unwrap_or(0);

    Ok(DashboardStats {
        total_pasien,
        kunjungan_ralan_hari_ini: kunjungan_ralan,
        pasien_ranap_aktif: pasien_ranap,
        antrian_menunggu,
    })
}

// ─────────────────────────────────────────────
// PASIEN CRUD
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn get_patients(
    state: State<'_, DbState>,
    search: String,
    limit: u32,
    offset: u32,
) -> Result<Vec<Pasien>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = if search.trim().is_empty() {
        format!(
            "SELECT no_rkm_medis, IFNULL(nm_pasien,''), IFNULL(jk,''), \
             IFNULL(DATE_FORMAT(tgl_lahir,'%d-%m-%Y'),''), IFNULL(tmp_lahir,''), \
             IFNULL(no_tlp,''), IFNULL(alamat,''), IFNULL(agama,''), \
             IFNULL(stts_nikah,''), IFNULL(gol_darah,''), \
             IFNULL(DATE_FORMAT(tgl_daftar,'%d-%m-%Y'),''), IFNULL(no_ktp,'') \
             FROM pasien ORDER BY no_rkm_medis DESC LIMIT {} OFFSET {}",
            limit, offset
        )
    } else {
        let q = search.replace('\'', "''");
        format!(
            "SELECT no_rkm_medis, IFNULL(nm_pasien,''), IFNULL(jk,''), \
             IFNULL(DATE_FORMAT(tgl_lahir,'%d-%m-%Y'),''), IFNULL(tmp_lahir,''), \
             IFNULL(no_tlp,''), IFNULL(alamat,''), IFNULL(agama,''), \
             IFNULL(stts_nikah,''), IFNULL(gol_darah,''), \
             IFNULL(DATE_FORMAT(tgl_daftar,'%d-%m-%Y'),''), IFNULL(no_ktp,'') \
             FROM pasien WHERE no_rkm_medis LIKE '%{q}%' OR nm_pasien LIKE '%{q}%' \
             OR no_ktp LIKE '%{q}%' OR no_tlp LIKE '%{q}%' \
             ORDER BY no_rkm_medis DESC LIMIT {} OFFSET {}",
            limit, offset
        )
    };

    let rows: Vec<(String, String, String, String, String, String, String, String, String, String, String, String)> =
        conn.query(sql).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| Pasien {
        no_rkm_medis: r.0, nm_pasien: r.1, jk: r.2, tgl_lahir: r.3,
        tmp_lahir: r.4, no_tlp: r.5, alamat: r.6, agama: r.7,
        stts_nikah: r.8, gol_darah: r.9, tgl_daftar: r.10, no_ktp: r.11,
    }).collect())
}

#[tauri::command]
pub async fn count_patients(state: State<'_, DbState>, search: String) -> Result<i64, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let count: i64 = if search.trim().is_empty() {
        conn.query_first("SELECT COUNT(*) FROM pasien")
            .await.map_err(|e| e.to_string())?.unwrap_or(0)
    } else {
        let q = search.replace('\'', "''");
        conn.query_first(format!(
            "SELECT COUNT(*) FROM pasien WHERE no_rkm_medis LIKE '%{q}%' OR nm_pasien LIKE '%{q}%' OR no_ktp LIKE '%{q}%' OR no_tlp LIKE '%{q}%'"
        )).await.map_err(|e| e.to_string())?.unwrap_or(0)
    };

    Ok(count)
}

#[tauri::command]
pub async fn get_next_no_rm(state: State<'_, DbState>) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Get max No RM and increment by 1, formatted as 6 digits
    let last: Option<String> = conn
        .query_first("SELECT no_rkm_medis FROM pasien ORDER BY no_rkm_medis DESC LIMIT 1")
        .await.map_err(|e| e.to_string())?;

    let next = match last {
        Some(rm) => {
            let num: u64 = rm.trim().parse().unwrap_or(0);
            format!("{:06}", num + 1)
        }
        None => "000001".to_string(),
    };
    Ok(next)
}

#[tauri::command]
pub async fn add_patient(state: State<'_, DbState>, pasien: PasienInput) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Get next No. RM
    let last: Option<String> = conn
        .query_first("SELECT no_rkm_medis FROM pasien ORDER BY no_rkm_medis DESC LIMIT 1")
        .await.map_err(|e| e.to_string())?;
    let no_rm = match last {
        Some(rm) => {
            let num: u64 = rm.trim().parse().unwrap_or(0);
            format!("{:06}", num + 1)
        }
        None => "000001".to_string(),
    };

    let tgl_lahir_db = convert_date_to_db(&pasien.tgl_lahir);

    conn.exec_drop(
        "INSERT INTO pasien (no_rkm_medis, nm_pasien, jk, tgl_lahir, tmp_lahir, no_tlp, alamat, \
         agama, stts_nikah, gol_darah, no_ktp, pekerjaan, pendidikan, nm_ayah, nm_ibu_kandung, tgl_daftar) \
         VALUES (:no_rm,:nm,:jk,:tgl,:tmp,:tlp,:alamat,:agama,:nikah,:gol,:ktp,:pek,:pend,:ayah,:ibu,CURDATE())",
        params! {
            "no_rm" => &no_rm, "nm" => &pasien.nm_pasien, "jk" => &pasien.jk,
            "tgl" => &tgl_lahir_db, "tmp" => &pasien.tmp_lahir,
            "tlp" => &pasien.no_tlp, "alamat" => &pasien.alamat,
            "agama" => &pasien.agama, "nikah" => &pasien.stts_nikah,
            "gol" => &pasien.gol_darah, "ktp" => &pasien.no_ktp,
            "pek" => &pasien.pekerjaan, "pend" => &pasien.pendidikan,
            "ayah" => &pasien.nm_ayah, "ibu" => &pasien.nm_ibu_kandung,
        }
    ).await.map_err(|e| e.to_string())?;

    Ok(no_rm)
}

#[tauri::command]
pub async fn update_patient(state: State<'_, DbState>, no_rkm_medis: String, pasien: PasienInput) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let tgl_lahir_db = convert_date_to_db(&pasien.tgl_lahir);

    conn.exec_drop(
        "UPDATE pasien SET nm_pasien=:nm, jk=:jk, tgl_lahir=:tgl, tmp_lahir=:tmp, \
         no_tlp=:tlp, alamat=:alamat, agama=:agama, stts_nikah=:nikah, \
         gol_darah=:gol, no_ktp=:ktp, pekerjaan=:pek, pendidikan=:pend, \
         nm_ayah=:ayah, nm_ibu_kandung=:ibu WHERE no_rkm_medis=:rm",
        params! {
            "nm" => &pasien.nm_pasien, "jk" => &pasien.jk,
            "tgl" => &tgl_lahir_db, "tmp" => &pasien.tmp_lahir,
            "tlp" => &pasien.no_tlp, "alamat" => &pasien.alamat,
            "agama" => &pasien.agama, "nikah" => &pasien.stts_nikah,
            "gol" => &pasien.gol_darah, "ktp" => &pasien.no_ktp,
            "pek" => &pasien.pekerjaan, "pend" => &pasien.pendidikan,
            "ayah" => &pasien.nm_ayah, "ibu" => &pasien.nm_ibu_kandung,
            "rm" => &no_rkm_medis,
        }
    ).await.map_err(|e| e.to_string())?;

    Ok("Pasien berhasil diperbarui".into())
}

// ─────────────────────────────────────────────
// MASTER DATA REGISTRASI
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn get_poliklinik(state: State<'_, DbState>) -> Result<Vec<Poliklinik>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let rows: Vec<(String, String)> = conn
        .query("SELECT kd_poli, nm_poli FROM poliklinik WHERE status='Aktif' ORDER BY nm_poli")
        .await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(kd_poli, nm_poli)| Poliklinik { kd_poli, nm_poli }).collect())
}

#[tauri::command]
pub async fn get_dokter_poli(state: State<'_, DbState>, kd_poli: String) -> Result<Vec<Dokter>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let stmt = conn.prep(
        "SELECT d.kd_dokter, d.nm_dokter, j.kd_poli FROM dokter d \
         JOIN jadwal j ON d.kd_dokter = j.kd_dokter \
         WHERE j.kd_poli = ? AND d.status = 'Aktif' GROUP BY d.kd_dokter ORDER BY d.nm_dokter"
    ).await.map_err(|e| e.to_string())?;

    let rows: Vec<(String, String, String)> = conn.exec(stmt, (kd_poli,)).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(kd_dokter, nm_dokter, kd_poli)| Dokter { kd_dokter, nm_dokter, kd_poli }).collect())
}

#[tauri::command]
pub async fn get_penjab(state: State<'_, DbState>) -> Result<Vec<Penjab>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let rows: Vec<(String, String)> = conn
        .query("SELECT kd_pj, png_jawab FROM penjab WHERE status='Aktif' ORDER BY png_jawab")
        .await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(kd_pj, png_jawab)| Penjab { kd_pj, png_jawab }).collect())
}

// ─────────────────────────────────────────────
// REGISTRASI
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn register_ralan(state: State<'_, DbState>, input: RegistrasiInput) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let stmt = conn.prep(
        "INSERT INTO reg_periksa (no_rawat, no_rkm_medis, kd_dokter, kd_poli, tgl_registrasi, jam_reg, kd_pj, stts) \
         VALUES (?,?,?,?,?,?,?,?)"
    ).await.map_err(|e| e.to_string())?;

    conn.exec_drop(stmt, (
        &input.no_rawat, &input.no_rkm_medis, &input.kd_dokter,
        &input.kd_poli, &input.tgl_registrasi, &input.jam_reg,
        &input.kd_pj, &input.stts,
    )).await.map_err(|e| e.to_string())?;

    // Add to antriloket
    let stmt2 = conn.prep(
        "INSERT INTO antriloket (no_rawat, tgl_antri, jam_antri, status) VALUES (?,CURDATE(),NOW(),'menunggu')"
    ).await.map_err(|e| e.to_string())?;
    conn.exec_drop(stmt2, (&input.no_rawat,)).await.map_err(|e| e.to_string())?;

    Ok(input.no_rawat)
}

#[tauri::command]
pub async fn get_next_no_rawat(state: State<'_, DbState>) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Format: YYYYMMDD/SEQ e.g. 20260302/0001
    let today = chrono_today();
    let prefix = format!("{}/", today.replace("-", ""));

    let last: Option<String> = conn.query_first(format!(
        "SELECT no_rawat FROM reg_periksa WHERE no_rawat LIKE '{}%' ORDER BY no_rawat DESC LIMIT 1",
        prefix
    )).await.map_err(|e| e.to_string())?;

    let next = match last {
        Some(nr) => {
            let parts: Vec<&str> = nr.split('/').collect();
            let seq: u64 = parts.get(1).and_then(|s| s.parse().ok()).unwrap_or(0);
            format!("{}{:04}", prefix, seq + 1)
        }
        None => format!("{}0001", prefix),
    };

    Ok(next)
}

// ─────────────────────────────────────────────
// ANTRIAN LOKET
// ─────────────────────────────────────────────

#[tauri::command]
pub async fn get_antrian_hari_ini(state: State<'_, DbState>) -> Result<Vec<AntrianLoket>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let rows: Vec<(String, String, String, String, String, String, String, Option<i32>)> = conn.query(
        "SELECT al.no_rawat, IFNULL(p.nm_pasien,''), IFNULL(rp.no_rkm_medis,''), \
         IFNULL(pl.nm_poli,''), IFNULL(pj.png_jawab,''), IFNULL(al.status,'menunggu'), \
         IFNULL(TIME_FORMAT(al.jam_antri,'%H:%i'),''), al.no_antrian \
         FROM antriloket al \
         LEFT JOIN reg_periksa rp ON al.no_rawat = rp.no_rawat \
         LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis \
         LEFT JOIN poliklinik pl ON rp.kd_poli = pl.kd_poli \
         LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj \
         WHERE al.tgl_antri = CURDATE() \
         ORDER BY al.no_antrian ASC, al.jam_antri ASC"
    ).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| AntrianLoket {
        no_rawat: r.0, nm_pasien: r.1, no_rkm_medis: r.2,
        nm_poli: r.3, png_jawab: r.4, status: r.5, jam_masuk: r.6, no_antrian: r.7,
    }).collect())
}

#[tauri::command]
pub async fn panggil_antrian(state: State<'_, DbState>, no_rawat: String) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Reset previous "dipanggil" to "menunggu"
    conn.query_drop("UPDATE antriloket SET status='menunggu' WHERE tgl_antri=CURDATE() AND status='dipanggil'")
        .await.map_err(|e| e.to_string())?;

    let stmt = conn.prep(
        "UPDATE antriloket SET status='dipanggil' WHERE no_rawat=? AND tgl_antri=CURDATE()"
    ).await.map_err(|e| e.to_string())?;
    conn.exec_drop(stmt, (no_rawat,)).await.map_err(|e| e.to_string())?;

    Ok("Pasien dipanggil".into())
}

#[tauri::command]
pub async fn selesai_antrian(state: State<'_, DbState>, no_rawat: String) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let stmt = conn.prep(
        "UPDATE antriloket SET status='selesai' WHERE no_rawat=? AND tgl_antri=CURDATE()"
    ).await.map_err(|e| e.to_string())?;
    conn.exec_drop(stmt, (no_rawat,)).await.map_err(|e| e.to_string())?;

    Ok("Antrian selesai".into())
}

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

/// Convert dd-MM-yyyy → yyyy-MM-dd for DB storage
fn convert_date_to_db(date: &str) -> String {
    let parts: Vec<&str> = date.split('-').collect();
    if parts.len() == 3 && parts[0].len() == 2 {
        format!("{}-{}-{}", parts[2], parts[1], parts[0])
    } else {
        date.to_string()
    }
}

/// Get today's date as yyyy-MM-dd using system time
fn chrono_today() -> String {
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    secs_to_ymd_str(secs)
}

/// Public: convert unix seconds to yyyy-MM-dd string
pub fn secs_to_ymd_str(secs: u64) -> String {
    let days = secs / 86400;
    let ymd = days_to_ymd(days as u32);
    format!("{:04}-{:02}-{:02}", ymd.0, ymd.1, ymd.2)
}

fn days_to_ymd(days: u32) -> (u32, u32, u32) {
    // Days since 1970-01-01
    let mut d = days;
    let mut y = 1970u32;
    loop {
        let leap = is_leap(y);
        let days_in_year = if leap { 366 } else { 365 };
        if d < days_in_year { break; }
        d -= days_in_year;
        y += 1;
    }
    let months = [31, if is_leap(y) { 29 } else { 28 }, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    let mut m = 0u32;
    for (i, &ml) in months.iter().enumerate() {
        if d < ml { m = i as u32 + 1; break; }
        d -= ml;
    }
    (y, m, d + 1)
}

fn is_leap(y: u32) -> bool {
    (y % 4 == 0 && y % 100 != 0) || y % 400 == 0
}
