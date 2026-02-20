use mysql_async::{prelude::*, Pool, OptsBuilder};
use tauri::State;
use std::sync::Mutex;
use serde::{Deserialize, Serialize};

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
    
    // Try a simple query
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
    // Verify connection before saving
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;
    let _ = r"SELECT 1".ignore(&mut conn).await.map_err(|e| e.to_string())?;

    *state.pool.lock().unwrap() = Some(pool);

    Ok("Connection initialized".into())
}

#[tauri::command]
pub async fn check_login(state: State<'_, DbState>, user: String, _pass: String) -> Result<String, String> {
    let pool = {
        let pool_guard = state.pool.lock().unwrap();
        pool_guard.as_ref().ok_or("Database not initialized")?.clone()
    };
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Check in admin table
    // Query: SELECT usere FROM admin WHERE AES_DECRYPT(usere, 'nur') = ?
    let stmt_admin = conn.prep("SELECT usere FROM admin WHERE AES_DECRYPT(usere, 'nur') = ? AND AES_DECRYPT(passworde, 'windi') = ?").await.map_err(|e| e.to_string())?;
    let result_admin: Vec<String> = conn.exec(stmt_admin, (user.clone(), _pass.clone())).await.map_err(|e| e.to_string())?;

    if !result_admin.is_empty() {
        return Ok("Login successful".into());
    }

    // Check in user table
    // Query: SELECT id_user FROM user WHERE AES_DECRYPT(id_user, 'nur') = ?
    let stmt_user = conn.prep("SELECT id_user FROM user WHERE AES_DECRYPT(id_user, 'nur') = ? AND AES_DECRYPT(password, 'windi') = ?").await.map_err(|e| e.to_string())?;
    let result_user: Vec<String> = conn.exec(stmt_user, (user, _pass)).await.map_err(|e| e.to_string())?;

    if !result_user.is_empty() {
        return Ok("Login successful".into());
    }
    
    Err("User not found or password incorrect".into())
}

#[tauri::command]
pub async fn get_patients(
    state: State<'_, DbState>,
    search: String,
    limit: u32,
    offset: u32,
) -> Result<Vec<Pasien>, String> {
    let pool = {
        let pool_guard = state.pool.lock().unwrap();
        pool_guard.as_ref().ok_or("Database not initialized")?.clone()
    };
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
             FROM pasien \
             WHERE no_rkm_medis LIKE '%{q}%' OR nm_pasien LIKE '%{q}%' \
             OR no_ktp LIKE '%{q}%' OR no_tlp LIKE '%{q}%' \
             ORDER BY no_rkm_medis DESC LIMIT {} OFFSET {}",
            limit, offset
        )
    };

    let rows: Vec<(String, String, String, String, String, String, String, String, String, String, String, String)> =
        conn.query(sql).await.map_err(|e| e.to_string())?;

    let patients = rows
        .into_iter()
        .map(|(no_rkm_medis, nm_pasien, jk, tgl_lahir, tmp_lahir, no_tlp, alamat, agama, stts_nikah, gol_darah, tgl_daftar, no_ktp)| {
            Pasien { no_rkm_medis, nm_pasien, jk, tgl_lahir, tmp_lahir, no_tlp, alamat, agama, stts_nikah, gol_darah, tgl_daftar, no_ktp }
        })
        .collect();

    Ok(patients)
}

#[tauri::command]
pub async fn count_patients(state: State<'_, DbState>, search: String) -> Result<i64, String> {
    let pool = {
        let pool_guard = state.pool.lock().unwrap();
        pool_guard.as_ref().ok_or("Database not initialized")?.clone()
    };
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let count: i64 = if search.trim().is_empty() {
        conn.query_first("SELECT COUNT(*) FROM pasien")
            .await
            .map_err(|e| e.to_string())?
            .unwrap_or(0)
    } else {
        let q = search.replace('\'', "''");
        let sql = format!(
            "SELECT COUNT(*) FROM pasien WHERE no_rkm_medis LIKE '%{q}%' OR nm_pasien LIKE '%{q}%' OR no_ktp LIKE '%{q}%' OR no_tlp LIKE '%{q}%'"
        );
        conn.query_first(sql)
            .await
            .map_err(|e| e.to_string())?
            .unwrap_or(0)
    };

    Ok(count)
}
