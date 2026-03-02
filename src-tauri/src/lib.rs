mod bpjs;
mod clinical;
mod db;
mod igd;
mod inpatient;
mod kasir;
mod lab;
mod laporan;
mod notifikasi;
mod radiologi;
mod setting_rs;
use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_opener::init())
        .manage(db::DbState {
            pool: Mutex::new(None),
        })
        .manage(bpjs::BpjsState::default())
        .invoke_handler(tauri::generate_handler![
            // ── Connection ──────────────────────────
            db::test_connection,
            db::init_connection,
            // ── Auth ────────────────────────────────
            db::check_login,
            // ── Dashboard ───────────────────────────
            db::get_dashboard_stats,
            // ── Pasien ──────────────────────────────
            db::get_patients,
            db::count_patients,
            db::get_next_no_rm,
            db::add_patient,
            db::update_patient,
            // ── Master Data Registrasi ───────────────
            db::get_poliklinik,
            db::get_dokter_poli,
            db::get_penjab,
            // ── Registrasi ──────────────────────────
            db::register_ralan,
            db::get_next_no_rawat,
            // ── Antrian ─────────────────────────────
            db::get_antrian_hari_ini,
            db::panggil_antrian,
            db::selesai_antrian,
            // ── Rawat Jalan / Kunjungan ─────────────
            clinical::get_kunjungan_ralan,
            clinical::update_status_kunjungan,
            // ── CPPT / Penilaian Medis ───────────────
            clinical::get_penilaian_medis,
            clinical::save_penilaian_medis,
            clinical::search_penyakit,
            // ── Resep ───────────────────────────────
            clinical::search_obat,
            clinical::get_resep_kunjungan,
            clinical::save_resep,
            // ── Farmasi ─────────────────────────────
            clinical::get_resep_farmasi,
            clinical::serahkan_resep,
            // ── Rawat Inap ──────────────────────────
            inpatient::get_status_kamar,
            inpatient::get_pasien_ranap,
            inpatient::admisi_ranap,
            inpatient::pulang_ranap,
            // ── Laboratorium ────────────────────────
            lab::get_jenis_pemeriksaan_lab,
            lab::get_permintaan_lab,
            lab::buat_permintaan_lab,
            lab::get_template_lab,
            lab::input_hasil_lab,
            lab::get_detail_hasil_lab,
            // ── Kasir / Billing ─────────────────────
            kasir::get_tagihan_list,
            kasir::get_billing_detail,
            kasir::bayar_ralan,
            kasir::get_summary_kasir,
            // ── IGD ─────────────────────────────────
            igd::get_kunjungan_igd,
            igd::get_master_kasus_igd,
            igd::save_triase_igd,
            igd::get_triase_igd,
            igd::add_observasi_igd,
            igd::get_observasi_igd,
            igd::get_stats_igd,
            // ── Radiologi ───────────────────────────
            radiologi::get_jenis_radiologi,
            radiologi::get_periksa_radiologi,
            radiologi::buat_periksa_radiologi,
            // ── Laporan ─────────────────────────────
            laporan::get_laporan_harian,
            laporan::get_laporan_bulanan,
            laporan::get_kunjungan_per_poli,
            laporan::get_diagnosa_terbanyak,
            laporan::get_pendapatan_per_kategori,
            laporan::get_kinerja_dokter,
            // ── BPJS Bridging ───────────────────────
            bpjs::set_bpjs_config,
            bpjs::cek_eligibilitas,
            bpjs::cek_eligibilitas_nik,
            bpjs::get_sep_remote,
            bpjs::simpan_sep_lokal,
            bpjs::get_sep_list,
            bpjs::cari_faskes_bpjs,
            bpjs::cek_rujukan_bpjs,
            bpjs::get_sep_by_rawat,
            // ── Notifikasi ──────────────────────────
            notifikasi::get_notifikasi,
            notifikasi::get_notif_summary,
            // ── Setting / RS ────────────────────────
            setting_rs::get_setting_rs,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
