import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    BedDouble, RefreshCw, Users, CheckCircle2,
    AlertCircle, Loader2, X, UserPlus, LogOut,
    Building2,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import clsx from "clsx";

interface StatusKamar {
    kd_kamar: string; nm_bangsal: string; kelas: string;
    trf_kamar: number; status: string;
}
interface PasienRanap {
    no_rawat: string; no_rkm_medis: string; nm_pasien: string;
    kd_kamar: string; nm_bangsal: string; kelas: string;
    diagnosa_awal: string; tgl_masuk: string; jam_masuk: string;
    lama: number; ttl_biaya: number; nm_dokter: string;
    png_jawab: string; stts_pulang: string;
}

const statusKamarColor: Record<string, string> = {
    ISI: "bg-red-100 text-red-700 border border-red-200",
    KOSONG: "bg-emerald-100 text-emerald-700 border border-emerald-200",
    DIBERSIHKAN: "bg-amber-100 text-amber-700 border border-amber-200",
    DIBOOKING: "bg-blue-100 text-blue-700 border border-blue-200",
    PERBAIKAN: "bg-slate-100 text-slate-600 border border-slate-200",
};

const OPSI_PULANG = ["Sehat", "Sembuh", "Membaik", "Rujuk", "APS", "+", "Lain-lain"];

export function RawatInap() {
    const navigate = useNavigate();
    const [activeTab, setActiveTab] = useState<"bangsal" | "pasien">("bangsal");
    const [kamarList, setKamarList] = useState<StatusKamar[]>([]);
    const [pasienList, setPasienList] = useState<PasienRanap[]>([]);
    const [loading, setLoading] = useState(false);
    const [selectedPasien, setSelectedPasien] = useState<PasienRanap | null>(null);

    // Admisi modal
    const [admisiOpen, setAdmisiOpen] = useState(false);
    const [admisiData, setAdmisiData] = useState({ no_rawat: "", kd_kamar: "", diagnosa_awal: "" });

    // Pulang modal
    const [pulangOpen, setPulangOpen] = useState(false);
    const [pulangData, setPulangData] = useState({ no_rawat: "", stts_pulang: "Sehat", diagnosa_akhir: "" });

    const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
    const [processing, setProcessing] = useState(false);

    const showToast = (ok: boolean, text: string) => {
        setToast({ ok, text });
        setTimeout(() => setToast(null), 3500);
    };

    const loadAll = useCallback(async () => {
        setLoading(true);
        try {
            const [kamar, pasien] = await Promise.all([
                invoke<StatusKamar[]>("get_status_kamar"),
                invoke<PasienRanap[]>("get_pasien_ranap"),
            ]);
            setKamarList(kamar);
            setPasienList(pasien);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => { loadAll(); }, [loadAll]);

    const handleAdmisi = async () => {
        if (!admisiData.no_rawat || !admisiData.kd_kamar) return;
        setProcessing(true);
        try {
            await invoke<string>("admisi_ranap", { input: admisiData });
            showToast(true, "Admisi berhasil! Pasien masuk bangsal.");
            setAdmisiOpen(false);
            setAdmisiData({ no_rawat: "", kd_kamar: "", diagnosa_awal: "" });
            loadAll();
        } catch (e) { showToast(false, String(e)); }
        finally { setProcessing(false); }
    };

    const handlePulang = async () => {
        if (!pulangData.no_rawat) return;
        setProcessing(true);
        try {
            await invoke<string>("pulang_ranap", { input: pulangData });
            showToast(true, "Pasien berhasil dipulangkan.");
            setPulangOpen(false);
            setSelectedPasien(null);
            loadAll();
        } catch (e) { showToast(false, String(e)); }
        finally { setProcessing(false); }
    };

    const kamarKosong = kamarList.filter((k) => k.status === "KOSONG");
    const kamarIsi = kamarList.filter((k) => k.status === "ISI");

    const grouped: Record<string, StatusKamar[]> = {};
    kamarList.forEach((k) => {
        if (!grouped[k.nm_bangsal]) grouped[k.nm_bangsal] = [];
        grouped[k.nm_bangsal].push(k);
    });

    const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-teal-500";

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar onLogout={() => navigate("/")} />

            {/* Toast */}
            {toast && (
                <div className={clsx(
                    "fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium",
                    toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white"
                )}>
                    {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {toast.text}
                </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-teal-100 rounded-lg flex items-center justify-center">
                            <BedDouble className="w-4 h-4 text-teal-600" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-slate-800">Rawat Inap — Bangsal</h1>
                            <p className="text-xs text-slate-400">
                                {kamarIsi.length} kamar terisi · {kamarKosong.length} kamar kosong · {pasienList.length} pasien dirawat
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        <button onClick={() => setAdmisiOpen(true)}
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg text-sm font-medium hover:bg-teal-700 transition-colors">
                            <UserPlus className="w-4 h-4" />
                            Admisi Pasien
                        </button>
                        <button onClick={loadAll} className="p-2 text-slate-400 hover:text-teal-600 hover:bg-teal-50 rounded-lg transition-colors">
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </header>

                {/* Tabs */}
                <div className="bg-white border-b border-slate-200 px-6 flex">
                    {[
                        { key: "bangsal", label: "Status Kamar / Bangsal", icon: Building2 },
                        { key: "pasien", label: "Daftar Pasien Dirawat", icon: Users },
                    ].map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setActiveTab(key as any)}
                            className={clsx("flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                                activeTab === key ? "border-teal-600 text-teal-600" : "border-transparent text-slate-500 hover:text-slate-700"
                            )}>
                            <Icon className="w-4 h-4" /> {label}
                        </button>
                    ))}
                </div>

                <main className="flex-1 overflow-y-auto p-6">
                    {/* BANGSAL TAB */}
                    {activeTab === "bangsal" && (
                        <div className="space-y-6 max-w-5xl mx-auto">
                            {loading ? (
                                <div className="flex justify-center py-16 text-slate-400 gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" /> Memuat data...
                                </div>
                            ) : Object.entries(grouped).map(([bangsal, kamarArr]) => (
                                <div key={bangsal}>
                                    <div className="flex items-center gap-2 mb-3">
                                        <Building2 className="w-4 h-4 text-teal-500" />
                                        <h3 className="font-semibold text-slate-700">{bangsal}</h3>
                                        <span className="text-xs text-slate-400">
                                            ({kamarArr.filter(k => k.status === "ISI").length} terisi / {kamarArr.length})
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3">
                                        {kamarArr.map((k) => (
                                            <div key={k.kd_kamar}
                                                className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm hover:shadow-md transition-shadow">
                                                <div className="flex items-start justify-between mb-2">
                                                    <span className="font-bold text-slate-800 text-sm">{k.kd_kamar}</span>
                                                    <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full font-medium", statusKamarColor[k.status] || "bg-slate-100 text-slate-500")}>
                                                        {k.status}
                                                    </span>
                                                </div>
                                                <div className="text-xs text-slate-500">{k.kelas}</div>
                                                <div className="text-xs font-semibold text-teal-600 mt-1">
                                                    Rp{k.trf_kamar.toLocaleString("id-ID")}
                                                    <span className="font-normal text-slate-400">/hari</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* PASIEN tab */}
                    {activeTab === "pasien" && (
                        <div className="max-w-5xl mx-auto">
                            {loading ? (
                                <div className="flex justify-center py-16 text-slate-400 gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />Memuat...
                                </div>
                            ) : pasienList.length === 0 ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
                                    <BedDouble className="w-10 h-10 opacity-40" />
                                    <span>Belum ada pasien dirawat</span>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {pasienList.map((p) => (
                                        <div key={p.no_rawat}
                                            className={clsx("bg-white rounded-xl border p-5 shadow-sm cursor-pointer hover:border-teal-300 hover:shadow-md transition-all",
                                                selectedPasien?.no_rawat === p.no_rawat ? "border-teal-500 ring-1 ring-teal-500/30" : "border-slate-200"
                                            )}
                                            onClick={() => setSelectedPasien(p)}>
                                            <div className="flex items-start justify-between">
                                                <div className="flex-1">
                                                    <div className="flex items-center gap-3 mb-1">
                                                        <span className="font-semibold text-slate-800">{p.nm_pasien}</span>
                                                        <span className="text-xs bg-teal-100 text-teal-700 px-2 py-0.5 rounded-full">{p.kd_kamar}</span>
                                                        <span className="text-xs text-slate-400">{p.nm_bangsal} · {p.kelas}</span>
                                                    </div>
                                                    <div className="text-sm text-slate-500">
                                                        Dr. {p.nm_dokter} · {p.png_jawab} · Masuk: {p.tgl_masuk}
                                                    </div>
                                                    <div className="text-xs text-slate-400 mt-1 italic">
                                                        Diagnosa: {p.diagnosa_awal || "—"}
                                                    </div>
                                                </div>
                                                <div className="text-right shrink-0 ml-4">
                                                    <div className="text-sm font-semibold text-slate-700">
                                                        {p.lama > 0 ? `${p.lama} hari` : "Hari ini"}
                                                    </div>
                                                    <div className="text-xs text-slate-400">lama rawat</div>
                                                    {selectedPasien?.no_rawat === p.no_rawat && (
                                                        <button
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setPulangData({ no_rawat: p.no_rawat, stts_pulang: "Sehat", diagnosa_akhir: p.diagnosa_awal });
                                                                setPulangOpen(true);
                                                            }}
                                                            className="mt-2 flex items-center gap-1 text-xs text-red-500 hover:text-red-700 font-medium"
                                                        >
                                                            <LogOut className="w-3 h-3" /> Pulangkan
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>

            {/* Admisi Modal */}
            {admisiOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b">
                            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                <UserPlus className="w-5 h-5 text-teal-600" /> Admisi Rawat Inap
                            </h2>
                            <button onClick={() => setAdmisiOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">No Rawat</label>
                                <input className={inputCls} placeholder="Contoh: 2026/03/02/000001"
                                    value={admisiData.no_rawat} onChange={(e) => setAdmisiData(d => ({ ...d, no_rawat: e.target.value }))} />
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Pilih Kamar</label>
                                <select className={inputCls} value={admisiData.kd_kamar}
                                    onChange={(e) => setAdmisiData(d => ({ ...d, kd_kamar: e.target.value }))}>
                                    <option value="">— Pilih Kamar Kosong —</option>
                                    {kamarKosong.map((k) => (
                                        <option key={k.kd_kamar} value={k.kd_kamar}>
                                            {k.kd_kamar} · {k.nm_bangsal} · {k.kelas} · Rp{k.trf_kamar.toLocaleString("id-ID")}/hari
                                        </option>
                                    ))}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Diagnosa Awal</label>
                                <input className={inputCls} placeholder="Diagnosa saat masuk..."
                                    value={admisiData.diagnosa_awal} onChange={(e) => setAdmisiData(d => ({ ...d, diagnosa_awal: e.target.value }))} />
                            </div>
                        </div>
                        <div className="p-5 border-t flex justify-end gap-3">
                            <button onClick={() => setAdmisiOpen(false)} className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg transition-colors">
                                Batal
                            </button>
                            <button onClick={handleAdmisi} disabled={processing}
                                className="px-5 py-2 bg-teal-600 text-white text-sm font-semibold rounded-lg hover:bg-teal-700 disabled:opacity-50 flex items-center gap-2">
                                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                Proses Admisi
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Pulang Modal */}
            {pulangOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md">
                        <div className="flex items-center justify-between p-5 border-b">
                            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
                                <LogOut className="w-5 h-5 text-red-500" /> Pemulangan Pasien
                            </h2>
                            <button onClick={() => setPulangOpen(false)}><X className="w-5 h-5 text-slate-400 hover:text-slate-600" /></button>
                        </div>
                        <div className="p-5 space-y-4">
                            <div className="p-3 bg-teal-50 rounded-lg text-sm text-teal-700">
                                No. Rawat: <span className="font-mono font-semibold">{pulangData.no_rawat}</span>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Status Pulang</label>
                                <select className={inputCls} value={pulangData.stts_pulang}
                                    onChange={(e) => setPulangData(d => ({ ...d, stts_pulang: e.target.value }))}>
                                    {OPSI_PULANG.map((s) => <option key={s}>{s}</option>)}
                                </select>
                            </div>
                            <div className="space-y-1">
                                <label className="text-xs font-semibold text-slate-500 uppercase">Diagnosa Akhir</label>
                                <input className={inputCls} placeholder="Diagnosa akhir / saat pulang..."
                                    value={pulangData.diagnosa_akhir}
                                    onChange={(e) => setPulangData(d => ({ ...d, diagnosa_akhir: e.target.value }))} />
                            </div>
                        </div>
                        <div className="p-5 border-t flex justify-end gap-3">
                            <button onClick={() => setPulangOpen(false)} className="px-4 py-2 text-slate-600 text-sm font-medium hover:bg-slate-100 rounded-lg transition-colors">
                                Batal
                            </button>
                            <button onClick={handlePulang} disabled={processing}
                                className="px-5 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg hover:bg-red-600 disabled:opacity-50 flex items-center gap-2">
                                {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <LogOut className="w-4 h-4" />}
                                Pulangkan Pasien
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
