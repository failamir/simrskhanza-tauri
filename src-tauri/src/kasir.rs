/// Phase 3 – Kasir / Billing Module
/// Tables: billing, nota_jalan, nota_inap, reg_periksa, kamar_inap

use mysql_async::{prelude::*, Pool};
use tauri::State;
use serde::{Deserialize, Serialize};
use crate::db::DbState;

// ─────────────────────────── STRUCTS ──────────────────────────────

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TagihanRow {
    pub no_rawat: String,
    pub nm_pasien: String,
    pub nm_poli: String,
    pub nm_dokter: String,
    pub tgl_registrasi: String,
    pub png_jawab: String,
    pub tipe: String,
    pub total_billing: f64,
    pub sudah_bayar: bool,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct BillingItem {
    pub nm_perawatan: String,
    pub jumlah: f64,
    pub biaya: f64,
    pub totalbiaya: f64,
    pub status: String,
}

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct SummaryKasir {
    pub total_masuk_hari_ini: f64,
    pub jumlah_transaksi: i64,
    pub total_ralan: f64,
    pub total_ranap: f64,
    pub pending_bayar: i64,
}

// ──────────────────────────── HELPER ──────────────────────────────

fn get_pool(state: &State<'_, DbState>) -> Result<Pool, String> {
    let guard = state.pool.lock().unwrap();
    guard.as_ref().ok_or_else(|| "Database not initialized".to_string()).cloned()
}

// ──────────────────────────── COMMANDS ────────────────────────────

#[tauri::command]
pub async fn get_tagihan_list(
    state: State<'_, DbState>,
    tanggal: String,
) -> Result<Vec<TagihanRow>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let sql = format!(
        "SELECT rp.no_rawat, IFNULL(p.nm_pasien,''), \
         IFNULL(pl.nm_poli,''), IFNULL(d.nm_dokter,''), \
         IFNULL(DATE_FORMAT(rp.tgl_registrasi,'%d-%m-%Y'),''), \
         IFNULL(pj.png_jawab,''), \
         IF(ki.no_rawat IS NOT NULL,'Ranap','Ralan'), \
         IFNULL((SELECT SUM(totalbiaya) FROM billing WHERE no_rawat=rp.no_rawat),0), \
         IF(nj.no_rawat IS NOT NULL OR ni.no_rawat IS NOT NULL, 1, 0) \
         FROM reg_periksa rp \
         LEFT JOIN pasien p ON rp.no_rkm_medis = p.no_rkm_medis \
         LEFT JOIN poliklinik pl ON rp.kd_poli = pl.kd_poli \
         LEFT JOIN dokter d ON rp.kd_dokter = d.kd_dokter \
         LEFT JOIN penjab pj ON rp.kd_pj = pj.kd_pj \
         LEFT JOIN kamar_inap ki ON rp.no_rawat = ki.no_rawat AND (ki.tgl_keluar IS NULL OR ki.tgl_keluar='0000-00-00') \
         LEFT JOIN nota_jalan nj ON rp.no_rawat = nj.no_rawat \
         LEFT JOIN nota_inap ni ON rp.no_rawat = ni.no_rawat \
         WHERE rp.tgl_registrasi = '{}' \
         ORDER BY rp.jam_reg DESC",
        tanggal
    );

    let rows: Vec<(String, String, String, String, String, String, String, f64, i8)> =
        conn.query(sql).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|r| TagihanRow {
        no_rawat: r.0, nm_pasien: r.1, nm_poli: r.2, nm_dokter: r.3,
        tgl_registrasi: r.4, png_jawab: r.5, tipe: r.6,
        total_billing: r.7, sudah_bayar: r.8 == 1,
    }).collect())
}

#[tauri::command]
pub async fn get_billing_detail(
    state: State<'_, DbState>,
    no_rawat: String,
) -> Result<Vec<BillingItem>, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let stmt = conn.prep(
        "SELECT IFNULL(nm_perawatan,''), IFNULL(jumlah,0), \
         IFNULL(biaya,0), IFNULL(totalbiaya,0), IFNULL(status,'-') \
         FROM billing WHERE no_rawat=? ORDER BY status, nm_perawatan"
    ).await.map_err(|e| e.to_string())?;

    let rows: Vec<(String, f64, f64, f64, String)> =
        conn.exec(stmt, (no_rawat,)).await.map_err(|e| e.to_string())?;

    Ok(rows.into_iter().map(|(nm_perawatan, jumlah, biaya, totalbiaya, status)| BillingItem {
        nm_perawatan, jumlah, biaya, totalbiaya, status,
    }).collect())
}

#[tauri::command]
pub async fn bayar_ralan(
    state: State<'_, DbState>,
    no_rawat: String,
) -> Result<String, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    // Check if nota already exists
    let exists: Option<String> = conn.exec_first(
        "SELECT no_rawat FROM nota_jalan WHERE no_rawat=?",
        (&no_rawat,)
    ).await.map_err(|e| e.to_string())?;

    if exists.is_some() {
        return Err("Tagihan sudah pernah dibayar".into());
    }

    // Generate no_nota
    use std::time::{SystemTime, UNIX_EPOCH};
    let secs = SystemTime::now().duration_since(UNIX_EPOCH).unwrap().as_secs();
    let ym = crate::db::secs_to_ymd_str(secs);
    let prefix = format!("{}/RJ", &ym[..7]); // YYYY-MM/RJ

    let last: Option<String> = conn.query_first(format!(
        "SELECT no_nota FROM nota_jalan WHERE no_nota LIKE '{}%' ORDER BY no_nota DESC LIMIT 1",
        prefix
    )).await.map_err(|e| e.to_string())?;

    let seq: u64 = match last {
        Some(s) => {
            let tail = &s[prefix.len()..];
            tail.trim_start_matches('0').parse().unwrap_or(0) + 1
        }
        None => 1,
    };
    let no_nota = format!("{}{:04}", prefix, seq);

    conn.exec_drop(
        "INSERT INTO nota_jalan (no_rawat, no_nota, tanggal, jam) VALUES (?,?,CURDATE(),NOW())",
        (&no_rawat, &no_nota)
    ).await.map_err(|e| e.to_string())?;

    Ok(no_nota)
}

#[tauri::command]
pub async fn get_summary_kasir(
    state: State<'_, DbState>,
    tanggal: String,
) -> Result<SummaryKasir, String> {
    let pool = get_pool(&state)?;
    let mut conn = pool.get_conn().await.map_err(|e| e.to_string())?;

    let stmt = conn.prep(
        "SELECT \
         IFNULL((SELECT SUM(b.totalbiaya) FROM billing b \
           JOIN nota_jalan nj ON b.no_rawat=nj.no_rawat WHERE nj.tanggal=?),0) + \
         IFNULL((SELECT SUM(b.totalbiaya) FROM billing b \
           JOIN nota_inap ni ON b.no_rawat=ni.no_rawat WHERE ni.tanggal=?),0), \
         IFNULL((SELECT COUNT(*) FROM nota_jalan WHERE tanggal=?),0) + \
         IFNULL((SELECT COUNT(*) FROM nota_inap WHERE tanggal=?),0), \
         IFNULL((SELECT SUM(b.totalbiaya) FROM billing b \
           JOIN nota_jalan nj ON b.no_rawat=nj.no_rawat WHERE nj.tanggal=?),0), \
         IFNULL((SELECT SUM(b.totalbiaya) FROM billing b \
           JOIN nota_inap ni ON b.no_rawat=ni.no_rawat WHERE ni.tanggal=?),0), \
         IFNULL((SELECT COUNT(*) FROM reg_periksa rp WHERE rp.tgl_registrasi=? \
           AND rp.no_rawat NOT IN (SELECT no_rawat FROM nota_jalan) \
           AND rp.no_rawat NOT IN (SELECT no_rawat FROM nota_inap)),0)"
    ).await.map_err(|e| e.to_string())?;

    let row: Option<(f64, i64, f64, f64, i64)> = conn.exec_first(
        stmt, (&tanggal, &tanggal, &tanggal, &tanggal, &tanggal, &tanggal, &tanggal)
    ).await.map_err(|e| e.to_string())?;

    let (total_masuk_hari_ini, jumlah_transaksi, total_ralan, total_ranap, pending_bayar) =
        row.unwrap_or((0.0, 0, 0.0, 0.0, 0));

    Ok(SummaryKasir {
        total_masuk_hari_ini,
        jumlah_transaksi,
        total_ralan,
        total_ranap,
        pending_bayar,
    })
}
