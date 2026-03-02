use mysql_async::{prelude::*, Pool};
use tauri::State;
use serde::{Deserialize, Serialize};
use crate::db::DbState;

#[derive(Debug, Serialize, Deserialize)]
pub struct RsSetting {
    pub nama_instansi: String,
    pub alamat_instansi: String,
    pub kabupaten: String,
    pub propinsi: String,
    pub kontak: String,
    pub email: String,
}

fn get_pool(state: &State<'_, DbState>) -> Result<Pool, String> {
    let guard = state.pool.lock().unwrap();
    guard.as_ref().ok_or_else(|| "Database not initialized".to_string()).cloned()
}

/// Mengambil pengaturan nama dan alamat RS untuk dicetak di header PDF / Struk
#[tauri::command]
pub async fn get_setting_rs(state: State<'_, DbState>) -> Result<RsSetting, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let row: Option<(String, String, String, String, String, String)> = conn
        .query_first("SELECT nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email FROM setting LIMIT 1")
        .await
        .map_err(|e| e.to_string())?;

    match row {
        Some((nama_instansi, alamat_instansi, kabupaten, propinsi, kontak, email)) => Ok(RsSetting {
            nama_instansi,
            alamat_instansi,
            kabupaten,
            propinsi,
            kontak,
            email,
        }),
        None => Ok(RsSetting {
            nama_instansi: "RSUD MAJU MUNDUR".to_string(),
            alamat_instansi: "Jl. Kesehatan No. 1".to_string(),
            kabupaten: "KAB. MAJU MUNDUR".to_string(),
            propinsi: "JAWA BARAT".to_string(),
            kontak: "08123456789".to_string(),
            email: "admin@rsud.com".to_string(),
        }),
    }
}
