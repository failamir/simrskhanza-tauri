import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    BarChart2, RefreshCw, TrendingUp, Users, Calendar,
    Loader2, ArrowUpRight, Activity, PieChart, Award,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";

interface LaporanHarian {
    tanggal: string; total_kunjungan: number; kunjungan_ralan: number;
    kunjungan_igd: number; pasien_ranap: number; pasien_baru: number;
    total_resep: number; total_lab: number; total_radiologi: number;
    total_pendapatan: number;
}
interface LaporanBulanan {
    bulan: string; total_kunjungan: number; pasien_baru: number;
    total_pendapatan: number; rata_kunjungan: number;
}
interface KunjunganPoliRow { nm_poli: string; jumlah: number; persen: number; }
interface DiagnosaRow { kd_penyakit: string; nm_penyakit: string; jumlah: number; }
interface PendapatanRow { kategori: string; total: number; }
interface DokterKunjunganRow { nm_dokter: string; jumlah_pasien: number; total_pendapatan: number; }

function rupiah(n: number) {
    if (n >= 1_000_000) return `Rp${(n / 1_000_000).toFixed(1)}jt`;
    if (n >= 1_000) return `Rp${(n / 1_000).toFixed(0)}rb`;
    return `Rp${n.toLocaleString("id-ID")}`;
}

const MONTHS = ["Januari", "Februari", "Maret", "April", "Mei", "Juni",
    "Juli", "Agustus", "September", "Oktober", "November", "Desember"];

// Mini bar chart component
function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
    const w = max > 0 ? Math.round((value / max) * 100) : 0;
    return (
        <div className="w-full bg-slate-100 rounded-full h-1.5 mt-1">
            <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${w}%` }} />
        </div>
    );
}

export function Laporan() {
    const navigate = useNavigate();
    const today = new Date().toISOString().split("T")[0];
    const year = new Date().getFullYear().toString();

    const [tab, setTab] = useState<"harian" | "bulanan" | "analisa">("harian");
    const [tanggal, setTanggal] = useState(today);
    const [tahun, setTahun] = useState(year);
    const [tglAwal, setTglAwal] = useState(today.slice(0, 8) + "01");
    const [tglAkhir, setTglAkhir] = useState(today);

    const [harian, setHarian] = useState<LaporanHarian | null>(null);
    const [bulanan, setBulanan] = useState<LaporanBulanan[]>([]);
    const [perPoli, setPerPoli] = useState<KunjunganPoliRow[]>([]);
    const [diagnosa, setDiagnosa] = useState<DiagnosaRow[]>([]);
    const [pendapatan, setPendapatan] = useState<PendapatanRow[]>([]);
    const [dokter, setDokter] = useState<DokterKunjunganRow[]>([]);

    const [loading, setLoading] = useState(false);

    const fetchHarian = useCallback(async () => {
        setLoading(true);
        try {
            const h = await invoke<LaporanHarian>("get_laporan_harian", { tanggal });
            setHarian(h);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [tanggal]);

    const fetchBulanan = useCallback(async () => {
        setLoading(true);
        try {
            const b = await invoke<LaporanBulanan[]>("get_laporan_bulanan", { tahun });
            setBulanan(b);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [tahun]);

    const fetchAnalisa = useCallback(async () => {
        setLoading(true);
        try {
            const [poli, dx, pend, dok] = await Promise.all([
                invoke<KunjunganPoliRow[]>("get_kunjungan_per_poli", { tanggalAwal: tglAwal, tanggalAkhir: tglAkhir }),
                invoke<DiagnosaRow[]>("get_diagnosa_terbanyak", { tanggalAwal: tglAwal, tanggalAkhir: tglAkhir }),
                invoke<PendapatanRow[]>("get_pendapatan_per_kategori", { tanggalAwal: tglAwal, tanggalAkhir: tglAkhir }),
                invoke<DokterKunjunganRow[]>("get_kinerja_dokter", { tanggalAwal: tglAwal, tanggalAkhir: tglAkhir }),
            ]);
            setPerPoli(poli); setDiagnosa(dx); setPendapatan(pend); setDokter(dok);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [tglAwal, tglAkhir]);

    useEffect(() => { if (tab === "harian") fetchHarian(); }, [tab, fetchHarian]);
    useEffect(() => { if (tab === "bulanan") fetchBulanan(); }, [tab, fetchBulanan]);
    useEffect(() => { if (tab === "analisa") fetchAnalisa(); }, [tab, fetchAnalisa]);

    const maxPoli = Math.max(...perPoli.map(p => p.jumlah), 1);
    const maxPend = Math.max(...pendapatan.map(p => p.total), 1);
    const maxDok = Math.max(...dokter.map(d => d.jumlah_pasien), 1);
    const maxBulanan = Math.max(...bulanan.map(b => b.total_kunjungan), 1);

    const PALETTE = ["bg-indigo-500", "bg-blue-500", "bg-teal-500", "bg-emerald-500",
        "bg-amber-500", "bg-orange-500", "bg-rose-500", "bg-violet-500"];

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar onLogout={() => navigate("/")} />

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-violet-100 rounded-lg flex items-center justify-center">
                            <BarChart2 className="w-4 h-4 text-violet-600" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-slate-800">Laporan &amp; Analisa</h1>
                            <p className="text-xs text-slate-400">Data statistik dan kinerja rumah sakit</p>
                        </div>
                    </div>
                    <button
                        onClick={() => { if (tab === "harian") fetchHarian(); else if (tab === "bulanan") fetchBulanan(); else fetchAnalisa(); }}
                        className="p-2 text-slate-400 hover:text-violet-600 hover:bg-violet-50 rounded-lg transition-colors">
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </header>

                {/* Tabs */}
                <div className="bg-white border-b border-slate-200 px-6 flex">
                    {[
                        { key: "harian", label: "Laporan Harian", icon: Calendar },
                        { key: "bulanan", label: "Laporan Bulanan", icon: TrendingUp },
                        { key: "analisa", label: "Analisa & Statistik", icon: PieChart },
                    ].map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setTab(key as any)}
                            className={`flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors ${tab === key ? "border-violet-600 text-violet-600" : "border-transparent text-slate-500 hover:text-slate-700"}`}>
                            <Icon className="w-4 h-4" />{label}
                        </button>
                    ))}
                </div>

                <main className="flex-1 overflow-y-auto p-6">
                    {/* HARIAN TAB */}
                    {tab === "harian" && (
                        <div className="max-w-4xl mx-auto space-y-5">
                            <div className="flex items-center gap-3">
                                <Calendar className="w-4 h-4 text-slate-400" />
                                <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
                                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                                <button onClick={fetchHarian} className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors">
                                    Tampilkan
                                </button>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-16 text-slate-400 gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />Memuat laporan...
                                </div>
                            ) : harian ? (
                                <>
                                    {/* KPI Cards */}
                                    <div className="grid grid-cols-3 gap-4">
                                        {[
                                            { label: "Total Kunjungan", val: harian.total_kunjungan, icon: Users, color: "text-indigo-600", bg: "bg-indigo-50" },
                                            { label: "Ralan + Poli", val: harian.kunjungan_ralan, icon: Activity, color: "text-blue-600", bg: "bg-blue-50" },
                                            { label: "IGD", val: harian.kunjungan_igd, icon: ArrowUpRight, color: "text-red-600", bg: "bg-red-50" },
                                            { label: "Rawat Inap Aktif", val: harian.pasien_ranap, icon: TrendingUp, color: "text-teal-600", bg: "bg-teal-50" },
                                            { label: "Pasien Baru", val: harian.pasien_baru, icon: Users, color: "text-emerald-600", bg: "bg-emerald-50" },
                                            { label: "Resep Dibuat", val: harian.total_resep, icon: Activity, color: "text-amber-600", bg: "bg-amber-50" },
                                        ].map(({ label, val, icon: Icon, color, bg }) => (
                                            <div key={label} className={`${bg} rounded-2xl p-5 border border-slate-100`}>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs text-slate-500 font-medium">{label}</span>
                                                    <div className={`w-8 h-8 rounded-full ${bg} flex items-center justify-center`}>
                                                        <Icon className={`w-4 h-4 ${color}`} />
                                                    </div>
                                                </div>
                                                <div className={`text-3xl font-bold ${color}`}>{val}</div>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Pendapatan */}
                                    <div className="bg-gradient-to-br from-violet-600 to-indigo-600 rounded-2xl p-6 text-white">
                                        <div className="text-violet-200 text-sm font-medium mb-1">Total Pendapatan Hari Ini</div>
                                        <div className="text-4xl font-bold mb-3">Rp{harian.total_pendapatan.toLocaleString("id-ID")}</div>
                                        <div className="grid grid-cols-3 gap-4 text-sm">
                                            <div><div className="text-violet-200">Lab</div><div className="font-semibold">{harian.total_lab} tindakan</div></div>
                                            <div><div className="text-violet-200">Radiologi</div><div className="font-semibold">{harian.total_radiologi} tindakan</div></div>
                                            <div><div className="text-violet-200">Resep</div><div className="font-semibold">{harian.total_resep} resep</div></div>
                                        </div>
                                    </div>
                                </>
                            ) : null}
                        </div>
                    )}

                    {/* BULANAN TAB */}
                    {tab === "bulanan" && (
                        <div className="max-w-4xl mx-auto space-y-5">
                            <div className="flex items-center gap-3">
                                <input type="number" min="2020" max="2030" value={tahun}
                                    onChange={(e) => setTahun(e.target.value)}
                                    className="px-3 py-2 border border-slate-200 rounded-lg text-sm w-28 focus:outline-none focus:ring-2 focus:ring-violet-500" />
                                <button onClick={fetchBulanan} className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors">
                                    Tampilkan
                                </button>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-16 text-slate-400 gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />Memuat...
                                </div>
                            ) : bulanan.length === 0 ? (
                                <div className="flex flex-col items-center py-16 text-slate-300 gap-2">
                                    <BarChart2 className="w-10 h-10 opacity-40" />
                                    <span>Belum ada data tahun {tahun}</span>
                                </div>
                            ) : (
                                <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                    <div className="px-6 py-4 border-b border-slate-100">
                                        <h3 className="font-semibold text-slate-700">Rekapitulasi Bulanan {tahun}</h3>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-sm">
                                            <thead className="bg-slate-50">
                                                <tr className="text-xs text-slate-500">
                                                    <th className="px-5 py-3 text-left font-semibold">Bulan</th>
                                                    <th className="px-4 py-3 text-center font-semibold">Kunjungan</th>
                                                    <th className="px-4 py-3 text-center font-semibold">Pasien Baru</th>
                                                    <th className="px-4 py-3 text-center font-semibold">Rata/Hari</th>
                                                    <th className="px-4 py-3 text-right font-semibold">Pendapatan</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {bulanan.map((b) => {
                                                    const [y, m] = b.bulan.split("-");
                                                    const nmBulan = MONTHS[parseInt(m) - 1] || b.bulan;
                                                    return (
                                                        <tr key={b.bulan} className="border-t border-slate-100 hover:bg-slate-50">
                                                            <td className="px-5 py-3 font-medium text-slate-800">{nmBulan} {y}</td>
                                                            <td className="px-4 py-3 text-center">
                                                                <div className="font-semibold text-indigo-700">{b.total_kunjungan}</div>
                                                                <MiniBar value={b.total_kunjungan} max={maxBulanan} color="bg-indigo-400" />
                                                            </td>
                                                            <td className="px-4 py-3 text-center text-slate-600">{b.pasien_baru}</td>
                                                            <td className="px-4 py-3 text-center text-slate-500">{b.rata_kunjungan.toFixed(1)}</td>
                                                            <td className="px-4 py-3 text-right font-semibold text-emerald-700">{rupiah(b.total_pendapatan)}</td>
                                                        </tr>
                                                    );
                                                })}
                                                <tr className="border-t-2 border-slate-200 bg-slate-50 font-semibold">
                                                    <td className="px-5 py-3 text-slate-700">TOTAL</td>
                                                    <td className="px-4 py-3 text-center text-indigo-700">{bulanan.reduce((s, b) => s + b.total_kunjungan, 0)}</td>
                                                    <td className="px-4 py-3 text-center text-slate-600">{bulanan.reduce((s, b) => s + b.pasien_baru, 0)}</td>
                                                    <td className="px-4 py-3 text-center text-slate-400">—</td>
                                                    <td className="px-4 py-3 text-right text-emerald-700">{rupiah(bulanan.reduce((s, b) => s + b.total_pendapatan, 0))}</td>
                                                </tr>
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}

                    {/* ANALISA TAB */}
                    {tab === "analisa" && (
                        <div className="max-w-5xl mx-auto space-y-5">
                            <div className="flex items-center gap-3 flex-wrap">
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-500">Dari</span>
                                    <input type="date" value={tglAwal} onChange={(e) => setTglAwal(e.target.value)}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                                </div>
                                <div className="flex items-center gap-2">
                                    <span className="text-sm text-slate-500">s/d</span>
                                    <input type="date" value={tglAkhir} onChange={(e) => setTglAkhir(e.target.value)}
                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-violet-500" />
                                </div>
                                <button onClick={fetchAnalisa} className="px-4 py-2 bg-violet-600 text-white text-sm font-medium rounded-lg hover:bg-violet-700 transition-colors">
                                    Analisa
                                </button>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-16 text-slate-400 gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />Menganalisa data...
                                </div>
                            ) : (
                                <div className="grid grid-cols-2 gap-5">
                                    {/* Kunjungan per poli */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                            <Activity className="w-4 h-4 text-indigo-500" /> Kunjungan per Poli (Top 10)
                                        </h3>
                                        <div className="space-y-3">
                                            {perPoli.slice(0, 10).map((p, i) => (
                                                <div key={p.nm_poli}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-slate-700 truncate max-w-[180px]">{p.nm_poli}</span>
                                                        <span className="font-semibold text-slate-600 shrink-0">{p.jumlah} <span className="text-slate-400 font-normal">({p.persen}%)</span></span>
                                                    </div>
                                                    <MiniBar value={p.jumlah} max={maxPoli} color={PALETTE[i % PALETTE.length]} />
                                                </div>
                                            ))}
                                            {perPoli.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Tidak ada data</p>}
                                        </div>
                                    </div>

                                    {/* Pendapatan per kategori */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                            <TrendingUp className="w-4 h-4 text-emerald-500" /> Pendapatan per Kategori
                                        </h3>
                                        <div className="space-y-3">
                                            {pendapatan.map((p, i) => (
                                                <div key={p.kategori}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-slate-700">{p.kategori}</span>
                                                        <span className="font-semibold text-emerald-700 shrink-0">{rupiah(p.total)}</span>
                                                    </div>
                                                    <MiniBar value={p.total} max={maxPend} color={PALETTE[(i + 2) % PALETTE.length]} />
                                                </div>
                                            ))}
                                            {pendapatan.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Tidak ada data</p>}
                                        </div>
                                    </div>

                                    {/* Diagnosa terbanyak */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                            <BarChart2 className="w-4 h-4 text-amber-500" /> Diagnosa Terbanyak (ICD-10)
                                        </h3>
                                        <div className="space-y-2">
                                            {diagnosa.map((d, i) => (
                                                <div key={d.kd_penyakit} className="flex items-center gap-3 py-1.5 border-b border-slate-100 last:border-0">
                                                    <span className="text-xs font-bold text-slate-400 w-5 text-center">{i + 1}</span>
                                                    <span className="text-xs font-mono bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded shrink-0">{d.kd_penyakit}</span>
                                                    <span className="text-sm text-slate-700 flex-1 truncate">{d.nm_penyakit}</span>
                                                    <span className="text-sm font-bold text-slate-600 shrink-0">{d.jumlah}x</span>
                                                </div>
                                            ))}
                                            {diagnosa.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Tidak ada data</p>}
                                        </div>
                                    </div>

                                    {/* Kinerja dokter */}
                                    <div className="bg-white rounded-2xl border border-slate-200 p-5">
                                        <h3 className="font-semibold text-slate-700 mb-4 flex items-center gap-2">
                                            <Award className="w-4 h-4 text-violet-500" /> Kinerja Dokter (Top 10)
                                        </h3>
                                        <div className="space-y-3">
                                            {dokter.map((d, i) => (
                                                <div key={d.nm_dokter}>
                                                    <div className="flex justify-between text-sm mb-1">
                                                        <span className="text-slate-700 truncate max-w-[160px] flex items-center gap-2">
                                                            {i === 0 && <span className="text-amber-500">🥇</span>}
                                                            {i === 1 && <span className="text-slate-400">🥈</span>}
                                                            {i === 2 && <span className="text-amber-700">🥉</span>}
                                                            {d.nm_dokter}
                                                        </span>
                                                        <span className="font-semibold text-violet-700 shrink-0">{d.jumlah_pasien} pasien</span>
                                                    </div>
                                                    <MiniBar value={d.jumlah_pasien} max={maxDok} color="bg-violet-400" />
                                                </div>
                                            ))}
                                            {dokter.length === 0 && <p className="text-slate-400 text-sm text-center py-4">Tidak ada data</p>}
                                        </div>
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
