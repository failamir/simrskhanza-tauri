import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    Pill, RefreshCw, CheckCircle, Clock, Loader2,
    User, Package, ChevronDown, ChevronUp,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import clsx from "clsx";

interface ResepFarmasiRow {
    no_resep: string; no_rawat: string; nm_pasien: string;
    tgl_peresepan: string; jam_peresepan: string; nm_dokter: string;
    tgl_penyerahan: string; jumlah_item: number; sudah_diserahkan: boolean;
}
interface ResepItem { kode_brng: string; nama_brng: string; jml: number; aturan_pakai: string; }
interface ResepKunjungan { no_resep: string; tgl_peresepan: string; nm_dokter: string; status_penyerahan: string; items: ResepItem[]; }

export function Farmasi() {
    const navigate = useNavigate();
    const today = new Date().toISOString().split("T")[0];
    const [tanggal, setTanggal] = useState(today);
    const [resepList, setResepList] = useState<ResepFarmasiRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<ResepItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const data = await invoke<ResepFarmasiRow[]>("get_resep_farmasi", { tanggal });
            setResepList(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [tanggal]);

    useEffect(() => { fetch(); }, [fetch]);

    const toggleExpand = async (noResep: string, noRawat: string) => {
        if (expanded === noResep) { setExpanded(null); return; }
        setExpanded(noResep);
        setLoadingItems(true);
        try {
            const resep = await invoke<ResepKunjungan[]>("get_resep_kunjungan", { noRawat });
            const found = resep.find((r) => r.no_resep === noResep);
            setExpandedItems(found?.items ?? []);
        } catch { setExpandedItems([]); }
        finally { setLoadingItems(false); }
    };

    const handleSerahkan = async (noResep: string) => {
        setProcessingId(noResep);
        try {
            await invoke<string>("serahkan_resep", { noResep });
            setToast(`Resep #${noResep} berhasil diserahkan`);
            setTimeout(() => setToast(null), 3000);
            fetch();
            setExpanded(null);
        } catch (e) { console.error(e); }
        finally { setProcessingId(null); }
    };

    const belum = resepList.filter((r) => !r.sudah_diserahkan);
    const sudah = resepList.filter((r) => r.sudah_diserahkan);

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar onLogout={() => navigate("/")} />

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium">
                    <CheckCircle className="w-4 h-4" />
                    {toast}
                </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-rose-100 rounded-lg flex items-center justify-center">
                            <Pill className="w-4 h-4 text-rose-600" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-slate-800">Farmasi — Pelayanan Resep</h1>
                            <p className="text-xs text-slate-400">{belum.length} menunggu · {sudah.length} sudah diserahkan</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-rose-500" />
                        <button onClick={fetch} className="p-2 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors">
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-4xl mx-auto space-y-4">
                        {/* Summary */}
                        <div className="grid grid-cols-3 gap-4">
                            {[
                                { label: "Total Resep", count: resepList.length, color: "text-slate-600", bg: "bg-white" },
                                { label: "Menunggu", count: belum.length, color: "text-amber-600", bg: "bg-amber-50" },
                                { label: "Diserahkan", count: sudah.length, color: "text-emerald-600", bg: "bg-emerald-50" },
                            ].map(({ label, count, color, bg }) => (
                                <div key={label} className={`${bg} rounded-xl border border-slate-200 p-4`}>
                                    <div className={`text-2xl font-bold ${color}`}>{count}</div>
                                    <div className="text-sm text-slate-500">{label}</div>
                                </div>
                            ))}
                        </div>

                        {/* Resep List */}
                        {loading ? (
                            <div className="flex items-center justify-center py-16 text-slate-400 gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" />
                                Memuat resep...
                            </div>
                        ) : resepList.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
                                <Pill className="w-10 h-10 opacity-40" />
                                <span>Belum ada resep hari ini</span>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {/* Pending first */}
                                {[...belum, ...sudah].map((r) => {
                                    const isExpanded = expanded === r.no_resep;
                                    return (
                                        <div key={r.no_resep} className={clsx(
                                            "bg-white rounded-xl border overflow-hidden shadow-sm transition-shadow",
                                            r.sudah_diserahkan ? "border-slate-200" : "border-amber-200 shadow-amber-100"
                                        )}>
                                            {/* Header */}
                                            <div className="flex items-center gap-4 px-5 py-4">
                                                <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                                    r.sudah_diserahkan ? "bg-emerald-100" : "bg-amber-100")}>
                                                    <User className={clsx("w-5 h-5", r.sudah_diserahkan ? "text-emerald-500" : "text-amber-500")} />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-semibold text-slate-800">{r.nm_pasien}</div>
                                                    <div className="text-xs text-slate-400">
                                                        Dr. {r.nm_dokter} · {r.jam_peresepan} · {r.jumlah_item} item
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0">
                                                    <span className={clsx("text-xs px-2.5 py-1 rounded-full font-medium flex items-center gap-1",
                                                        r.sudah_diserahkan ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                                    )}>
                                                        {r.sudah_diserahkan ? <CheckCircle className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                                                        {r.sudah_diserahkan ? "Diserahkan" : "Menunggu"}
                                                    </span>
                                                    <div className="text-xs text-slate-400 font-mono">#{r.no_resep}</div>
                                                    <button
                                                        onClick={() => toggleExpand(r.no_resep, r.no_rawat)}
                                                        className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-colors"
                                                    >
                                                        {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                    </button>
                                                </div>
                                            </div>

                                            {/* Expanded items */}
                                            {isExpanded && (
                                                <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
                                                    {loadingItems ? (
                                                        <div className="flex items-center gap-2 text-slate-400 text-sm">
                                                            <Loader2 className="w-4 h-4 animate-spin" />Memuat item...
                                                        </div>
                                                    ) : expandedItems.length === 0 ? (
                                                        <p className="text-sm text-slate-400">Tidak ada item</p>
                                                    ) : (
                                                        <div className="space-y-2">
                                                            {expandedItems.map((item) => (
                                                                <div key={item.kode_brng} className="flex items-center justify-between bg-white px-4 py-2.5 rounded-lg border border-slate-100">
                                                                    <div className="flex items-center gap-3">
                                                                        <Package className="w-4 h-4 text-slate-400 shrink-0" />
                                                                        <div>
                                                                            <div className="text-sm font-medium text-slate-800">{item.nama_brng}</div>
                                                                            <div className="text-xs text-slate-400 font-mono">{item.kode_brng}</div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="text-right shrink-0">
                                                                        <div className="text-sm font-semibold text-slate-700">{item.jml} pcs</div>
                                                                        <div className="text-xs text-slate-400">{item.aturan_pakai}</div>
                                                                    </div>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    )}

                                                    {!r.sudah_diserahkan && (
                                                        <button
                                                            onClick={() => handleSerahkan(r.no_resep)}
                                                            disabled={processingId === r.no_resep}
                                                            className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                                                        >
                                                            {processingId === r.no_resep
                                                                ? <><Loader2 className="w-4 h-4 animate-spin" />Memproses...</>
                                                                : <><CheckCircle className="w-4 h-4" />Serahkan Obat</>
                                                            }
                                                        </button>
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    );
                                })}
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
