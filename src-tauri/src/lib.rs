mod clinical;
mod db;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(db::DbState {
            pool: Mutex::new(None),
        })
        .invoke_handler(tauri::generate_handler![
            // ── Connection ──────────────────────
            db::test_connection,
            db::init_connection,
            // ── Auth ────────────────────────────
            db::check_login,
            // ── Dashboard ───────────────────────
            db::get_dashboard_stats,
            // ── Pasien ──────────────────────────
            db::get_patients,
            db::count_patients,
            db::get_next_no_rm,
            db::add_patient,
            db::update_patient,
            // ── Master Data Registrasi ───────────
            db::get_poliklinik,
            db::get_dokter_poli,
            db::get_penjab,
            // ── Registrasi ──────────────────────
            db::register_ralan,
            db::get_next_no_rawat,
            // ── Antrian ─────────────────────────
            db::get_antrian_hari_ini,
            db::panggil_antrian,
            db::selesai_antrian,
            // ── Rawat Jalan / Kunjungan ─────────
            clinical::get_kunjungan_ralan,
            clinical::update_status_kunjungan,
            // ── CPPT / Penilaian Medis ───────────
            clinical::get_penilaian_medis,
            clinical::save_penilaian_medis,
            clinical::search_penyakit,
            // ── Resep ───────────────────────────
            clinical::search_obat,
            clinical::get_resep_kunjungan,
            clinical::save_resep,
            // ── Farmasi ─────────────────────────
            clinical::get_resep_farmasi,
            clinical::serahkan_resep,
            // ── Laboratorium ────────────────────
            clinical::get_jenis_lab,
            clinical::get_permintaan_lab_hari_ini,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
