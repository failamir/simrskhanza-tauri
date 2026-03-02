import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    Image as ImageIcon, RefreshCw, Plus,
    CheckCircle2, AlertCircle, Loader2,
    ChevronDown, ChevronUp, Scan,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import clsx from "clsx";

interface JenisRadiologi {
    kd_jenis_prw: string; nm_perawatan: string; total_byr: number;
}
interface PeriksaRadiologiRow {
    no_rawat: string; nm_pasien: string; nm_perawatan: string;
    tgl_periksa: string; jam: string; nm_dokter: string;
    status: string; biaya: number; proyeksi: string; expertise: string;
}

export function Radiologi() {
    const navigate = useNavigate();
    const today = new Date().toISOString().split("T")[0];
    const [tanggal, setTanggal] = useState(today);
    const [periksaList, setPeriksaList] = useState<PeriksaRadiologiRow[]>([]);
    const [jenisList, setJenisList] = useState<JenisRadiologi[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
    const [submitting, setSubmitting] = useState(false);

    const [form, setForm] = useState({
        no_rawat: "", kd_jenis_prw: "", kd_dokter: "",
        dokter_perujuk: "", status: "Ralan", proyeksi: "",
    });

    const showToast = (ok: boolean, text: string) => {
        setToast({ ok, text });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchPeriksa = useCallback(async () => {
        setLoading(true);
        try {
            const data = await invoke<PeriksaRadiologiRow[]>("get_periksa_radiologi", { tanggal });
            setPeriksaList(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [tanggal]);

    useEffect(() => { fetchPeriksa(); }, [fetchPeriksa]);

    useEffect(() => {
        invoke<JenisRadiologi[]>("get_jenis_radiologi").then(setJenisList).catch(console.error);
    }, []);

    const handleBuat = async () => {
        if (!form.no_rawat || !form.kd_jenis_prw) {
            showToast(false, "No Rawat dan Jenis Pemeriksaan wajib diisi");
            return;
        }
        setSubmitting(true);
        try {
            await invoke<string>("buat_periksa_radiologi", { input: form });
            showToast(true, "Pemeriksaan radiologi berhasil dibuat!");
            setForm({ no_rawat: "", kd_jenis_prw: "", kd_dokter: "", dokter_perujuk: "", status: "Ralan", proyeksi: "" });
            fetchPeriksa();
        } catch (e) { showToast(false, String(e)); }
        finally { setSubmitting(false); }
    };

    const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

    const ralan = periksaList.filter(p => p.status === "Ralan");
    const ranap = periksaList.filter(p => p.status === "Ranap");

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar onLogout={() => navigate("/")} />

            {toast && (
                <div className={clsx("fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium",
                    toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}>
                    {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {toast.text}
                </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Scan className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-slate-800">Radiologi</h1>
                            <p className="text-xs text-slate-400">
                                {periksaList.length} pemeriksaan · {ralan.length} ralan · {ranap.length} ranap
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
                        <button onClick={fetchPeriksa} className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto space-y-5">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: "Total Hari Ini", val: periksaList.length, color: "text-slate-700", bg: "bg-white" },
                                { label: "Rawat Jalan", val: ralan.length, color: "text-indigo-600", bg: "bg-indigo-50" },
                                { label: "Rawat Inap", val: ranap.length, color: "text-teal-600", bg: "bg-teal-50" },
                            ].map(({ label, val, color, bg }) => (
                                <div key={label} className={`${bg} rounded-xl border border-slate-200 p-4`}>
                                    <div className={`text-2xl font-bold ${color}`}>{val}</div>
                                    <div className="text-sm text-slate-500">{label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Form buat pemeriksaan */}
                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                <Plus className="w-4 h-4 text-blue-500" /> Buat Pemeriksaan Radiologi
                            </h3>
                            <div className="grid grid-cols-2 gap-3">
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">No Rawat</label>
                                    <input className={inputCls} placeholder="Contoh: 2026/03/02/000001"
                                        value={form.no_rawat} onChange={(e) => setForm(f => ({ ...f, no_rawat: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Jenis Pemeriksaan</label>
                                    <select className={inputCls} value={form.kd_jenis_prw}
                                        onChange={(e) => setForm(f => ({ ...f, kd_jenis_prw: e.target.value }))}>
                                        <option value="">— Pilih Pemeriksaan —</option>
                                        {jenisList.map((j) => (
                                            <option key={j.kd_jenis_prw} value={j.kd_jenis_prw}>
                                                {j.nm_perawatan} — Rp{j.total_byr.toLocaleString("id-ID")}
                                            </option>
                                        ))}
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Proyeksi / Posisi</label>
                                    <input className={inputCls} placeholder="AP, Lateral, PA, ..."
                                        value={form.proyeksi} onChange={(e) => setForm(f => ({ ...f, proyeksi: e.target.value }))} />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Status Pasien</label>
                                    <select className={inputCls} value={form.status}
                                        onChange={(e) => setForm(f => ({ ...f, status: e.target.value }))}>
                                        <option value="Ralan">Rawat Jalan</option>
                                        <option value="Ranap">Rawat Inap</option>
                                    </select>
                                </div>
                            </div>
                            <button onClick={handleBuat} disabled={submitting}
                                className="flex items-center gap-2 px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors">
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                Buat Pemeriksaan
                            </button>
                        </div>

                        {/* List hasil */}
                        {loading ? (
                            <div className="flex justify-center py-12 text-slate-400 gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" />Memuat...
                            </div>
                        ) : periksaList.length === 0 ? (
                            <div className="flex flex-col items-center py-12 text-slate-300 gap-2">
                                <ImageIcon className="w-10 h-10 opacity-40" />
                                <span>Belum ada pemeriksaan radiologi hari ini</span>
                            </div>
                        ) : periksaList.map((p, i) => {
                            const key = `${p.no_rawat}-${i}`;
                            const isExp = expanded === key;
                            return (
                                <div key={key} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                    <div className="flex items-center gap-4 px-5 py-4">
                                        <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center shrink-0">
                                            <Scan className="w-5 h-5 text-blue-600" />
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="font-semibold text-slate-800">{p.nm_pasien}</div>
                                            <div className="text-xs text-slate-400 truncate">
                                                {p.nm_perawatan} · {p.jam} · Dr. {p.nm_dokter}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 shrink-0">
                                            <span className={clsx("text-xs px-2.5 py-1 rounded-full font-medium",
                                                p.status === "Ranap" ? "bg-teal-100 text-teal-700" : "bg-indigo-100 text-indigo-700"
                                            )}>{p.status}</span>
                                            <span className="text-sm font-bold text-slate-700">Rp{p.biaya.toLocaleString("id-ID")}</span>
                                            <button onClick={() => setExpanded(isExp ? null : key)}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                                                {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {isExp && (
                                        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-2 text-sm">
                                            <div className="grid grid-cols-2 gap-2">
                                                <div><span className="text-slate-400">No Rawat:</span> <span className="font-mono text-slate-700">{p.no_rawat}</span></div>
                                                <div><span className="text-slate-400">Proyeksi:</span> <span className="text-slate-700">{p.proyeksi || "—"}</span></div>
                                                <div><span className="text-slate-400">Tanggal:</span> <span className="text-slate-700">{p.tgl_periksa}</span></div>
                                                <div><span className="text-slate-400">Jam:</span> <span className="text-slate-700">{p.jam}</span></div>
                                            </div>
                                            {p.expertise && (
                                                <div className="mt-2 p-3 bg-white rounded-lg border border-slate-200">
                                                    <div className="text-xs font-semibold text-slate-500 uppercase mb-1">Expertise / Hasil Bacaan</div>
                                                    <p className="text-slate-700">{p.expertise}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </main>
            </div>
        </div>
    );
}
