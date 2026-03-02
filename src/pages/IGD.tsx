import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    AlertTriangle, RefreshCw, Activity, Loader2,
    CheckCircle2, AlertCircle, User, Siren,
    ClipboardList, Stethoscope, Plus, Save,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import clsx from "clsx";

interface KunjunganIGD {
    no_rawat: string; no_rkm_medis: string; nm_pasien: string;
    nm_dokter: string; png_jawab: string; jam_reg: string;
    stts: string; ada_triase: boolean;
}
interface MasterKasus { kode_kasus: string; macam_kasus: string; }
interface DataTriase {
    tgl_kunjungan: string; cara_masuk: string; alat_transportasi: string;
    alasan_kedatangan: string; kode_kasus: string; macam_kasus: string;
    tekanan_darah: string; nadi: string; pernapasan: string;
    suhu: string; saturasi_o2: string; nyeri: string;
}
interface ObservasiRow {
    jam_rawat: string; gcs: string; td: string;
    hr: string; rr: string; suhu: string; spo2: string;
}
interface StatsIGD {
    total_hari_ini: number; triase_selesai: number;
    masih_ditangani: number; dirujuk: number;
}

const CARA_MASUK = ["Jalan", "Brankar", "Kursi Roda", "Digendong"];
const ALAT_TRANS = ["-", "AGD", "Sendiri", "Swasta"];
const ALASAN = ["Datang Sendiri", "Polisi", "Rujukan", "Bidan", "Puskesmas", "Rumah Sakit", "Poliklinik", "Faskes Lain", "-"];

const EMPTY_TRIASE = {
    cara_masuk: "Jalan", alat_transportasi: "-", alasan_kedatangan: "Datang Sendiri",
    keterangan_kedatangan: "", kode_kasus: "001",
    tekanan_darah: "", nadi: "", pernapasan: "", suhu: "", saturasi_o2: "", nyeri: "0",
};

const EMPTY_OBS = { gcs: "15", td: "", hr: "", rr: "", suhu: "", spo2: "", nip: "" };

export function IGD() {
    const navigate = useNavigate();
    const today = new Date().toISOString().split("T")[0];
    const [tanggal, setTanggal] = useState(today);

    const [kunjungan, setKunjungan] = useState<KunjunganIGD[]>([]);
    const [stats, setStats] = useState<StatsIGD | null>(null);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<KunjunganIGD | null>(null);
    const [activePanel, setActivePanel] = useState<"triase" | "observasi">("triase");

    const [masterKasus, setMasterKasus] = useState<MasterKasus[]>([]);
    const [triaseData, setTriaseData] = useState<DataTriase | null>(null);
    const [triaseForm, setTriaseForm] = useState({ ...EMPTY_TRIASE });
    const [savingTriase, setSavingTriase] = useState(false);

    const [observasiList, setObservasiList] = useState<ObservasiRow[]>([]);
    const [obsForm, setObsForm] = useState({ ...EMPTY_OBS });
    const [savingObs, setSavingObs] = useState(false);

    const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

    const showToast = (ok: boolean, text: string) => {
        setToast({ ok, text });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [k, s] = await Promise.all([
                invoke<KunjunganIGD[]>("get_kunjungan_igd", { tanggal }),
                invoke<StatsIGD>("get_stats_igd", { tanggal }),
            ]);
            setKunjungan(k);
            setStats(s);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [tanggal]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    useEffect(() => {
        invoke<MasterKasus[]>("get_master_kasus_igd").then(setMasterKasus).catch(console.error);
    }, []);

    const selectKunjungan = async (k: KunjunganIGD) => {
        setSelected(k);
        setActivePanel("triase");
        setTriaseData(null);
        setObservasiList([]);
        try {
            const [triase, obs] = await Promise.all([
                invoke<DataTriase | null>("get_triase_igd", { noRawat: k.no_rawat }),
                invoke<ObservasiRow[]>("get_observasi_igd", { noRawat: k.no_rawat }),
            ]);
            setTriaseData(triase || null);
            setObservasiList(obs);
            if (triase) {
                setTriaseForm({
                    cara_masuk: triase.cara_masuk,
                    alat_transportasi: triase.alat_transportasi,
                    alasan_kedatangan: triase.alasan_kedatangan,
                    keterangan_kedatangan: triase.alasan_kedatangan,
                    kode_kasus: triase.kode_kasus,
                    tekanan_darah: triase.tekanan_darah,
                    nadi: triase.nadi, pernapasan: triase.pernapasan,
                    suhu: triase.suhu, saturasi_o2: triase.saturasi_o2, nyeri: triase.nyeri,
                });
            } else {
                setTriaseForm({ ...EMPTY_TRIASE });
            }
        } catch { }
    };

    const handleSaveTriase = async () => {
        if (!selected) return;
        setSavingTriase(true);
        try {
            await invoke<string>("save_triase_igd", {
                input: { no_rawat: selected.no_rawat, ...triaseForm }
            });
            showToast(true, "Triase berhasil disimpan!");
            fetchAll();
            const triase = await invoke<DataTriase | null>("get_triase_igd", { noRawat: selected.no_rawat });
            setTriaseData(triase || null);
        } catch (e) { showToast(false, String(e)); }
        finally { setSavingTriase(false); }
    };

    const handleSaveObs = async () => {
        if (!selected) return;
        setSavingObs(true);
        try {
            await invoke<string>("add_observasi_igd", {
                input: { no_rawat: selected.no_rawat, ...obsForm }
            });
            showToast(true, "Observasi ditambahkan!");
            const obs = await invoke<ObservasiRow[]>("get_observasi_igd", { noRawat: selected.no_rawat });
            setObservasiList(obs);
            setObsForm({ ...EMPTY_OBS });
        } catch (e) { showToast(false, String(e)); }
        finally { setSavingObs(false); }
    };

    const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-500";
    const selectCls = inputCls;

    const nyeriLevel = (v: string) => {
        const n = parseInt(v) || 0;
        if (n === 0) return "bg-emerald-100 text-emerald-700";
        if (n <= 3) return "bg-green-100 text-green-700";
        if (n <= 6) return "bg-amber-100 text-amber-700";
        return "bg-red-100 text-red-700";
    };

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
                {/* Header */}
                <header className="bg-red-600 text-white px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-white/20 rounded-lg flex items-center justify-center">
                            <Siren className="w-4 h-4" />
                        </div>
                        <div>
                            <h1 className="font-semibold">IGD — Unit Gawat Darurat</h1>
                            <p className="text-red-200 text-xs">
                                {kunjungan.length} kunjungan · {kunjungan.filter(k => !k.ada_triase).length} menunggu triase
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
                            className="px-3 py-2 bg-white/10 border border-white/30 rounded-lg text-sm text-white focus:outline-none" />
                        <button onClick={fetchAll} className="p-2 text-white/70 hover:text-white hover:bg-white/10 rounded-lg transition-colors">
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </header>

                {/* Stats bar */}
                {stats && (
                    <div className="bg-red-50 border-b border-red-100 px-6 py-3 flex gap-6">
                        {[
                            { label: "Total Kunjungan", val: stats.total_hari_ini, color: "text-slate-700" },
                            { label: "Triase Selesai", val: stats.triase_selesai, color: "text-emerald-600" },
                            { label: "Masih Ditangani", val: stats.masih_ditangani, color: "text-amber-600" },
                            { label: "Dirujuk", val: stats.dirujuk, color: "text-red-600" },
                        ].map(({ label, val, color }) => (
                            <div key={label} className="flex items-center gap-2">
                                <span className={`text-xl font-bold ${color}`}>{val}</span>
                                <span className="text-xs text-slate-500">{label}</span>
                            </div>
                        ))}
                    </div>
                )}

                <div className="flex-1 flex overflow-hidden">
                    {/* Kunjungan List */}
                    <div className="w-72 border-r border-slate-200 bg-white overflow-y-auto flex-shrink-0">
                        {loading ? (
                            <div className="flex items-center justify-center h-24 gap-2 text-slate-400 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin" />Memuat...
                            </div>
                        ) : kunjungan.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-24 text-slate-300 gap-2">
                                <Siren className="w-6 h-6 opacity-40" />
                                <span className="text-sm">Tidak ada kunjungan</span>
                            </div>
                        ) : kunjungan.map((k) => (
                            <button key={k.no_rawat} onClick={() => selectKunjungan(k)}
                                className={clsx("w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-red-50 transition-colors",
                                    selected?.no_rawat === k.no_rawat && "bg-red-50 border-l-2 border-l-red-500"
                                )}>
                                <div className="flex items-center justify-between mb-1">
                                    <span className="font-semibold text-slate-800 text-sm truncate max-w-[150px]">{k.nm_pasien}</span>
                                    {!k.ada_triase && (
                                        <span className="text-[10px] bg-red-100 text-red-700 px-1.5 py-0.5 rounded-full font-semibold shrink-0">
                                            Triase
                                        </span>
                                    )}
                                    {k.ada_triase && (
                                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                                    )}
                                </div>
                                <div className="text-xs text-slate-400">{k.jam_reg} · {k.png_jawab}</div>
                                <div className="text-xs text-slate-400 truncate">Dr. {k.nm_dokter}</div>
                            </button>
                        ))}
                    </div>

                    {/* Detail Panel */}
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-3">
                            <AlertTriangle className="w-12 h-12 opacity-30" />
                            <span className="text-sm">Pilih kunjungan IGD untuk melihat detail</span>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Patient banner */}
                            <div className="bg-red-600 text-white px-6 py-3 flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold">{selected.nm_pasien}</div>
                                    <div className="text-red-200 text-xs">No. RM: {selected.no_rkm_medis} · Dr. {selected.nm_dokter}</div>
                                </div>
                                <div className="text-xs text-red-200 font-mono">{selected.no_rawat.slice(-6)}</div>
                            </div>

                            {/* Sub tabs */}
                            <div className="bg-white border-b border-slate-200 flex">
                                {[
                                    { key: "triase", label: "Triase & Vital Sign", icon: Activity },
                                    { key: "observasi", label: "Observasi", icon: ClipboardList },
                                ].map(({ key, label, icon: Icon }) => (
                                    <button key={key} onClick={() => setActivePanel(key as any)}
                                        className={clsx("flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                                            activePanel === key ? "border-red-600 text-red-600" : "border-transparent text-slate-500 hover:text-slate-700"
                                        )}>
                                        <Icon className="w-4 h-4" />{label}
                                    </button>
                                ))}
                            </div>

                            <div className="flex-1 overflow-y-auto p-6">
                                {/* TRIASE PANEL */}
                                {activePanel === "triase" && (
                                    <div className="max-w-2xl space-y-5">
                                        {/* Existing triase info */}
                                        {triaseData && (
                                            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
                                                <div className="flex items-center gap-2 text-emerald-700 font-semibold mb-2">
                                                    <CheckCircle2 className="w-4 h-4" /> Triase sudah diisi — {triaseData.tgl_kunjungan}
                                                </div>
                                                <div className="text-slate-600 grid grid-cols-3 gap-2">
                                                    <span>TD: <b>{triaseData.tekanan_darah}</b></span>
                                                    <span>Nadi: <b>{triaseData.nadi}x/mnt</b></span>
                                                    <span>RR: <b>{triaseData.pernapasan}x/mnt</b></span>
                                                    <span>Suhu: <b>{triaseData.suhu}°C</b></span>
                                                    <span>SpO2: <b>{triaseData.saturasi_o2}%</b></span>
                                                    <span>Nyeri: <span className={clsx("px-1.5 rounded font-bold text-xs", nyeriLevel(triaseData.nyeri))}>{triaseData.nyeri}/10</span></span>
                                                </div>
                                                <div className="mt-2 text-xs text-slate-500">{triaseData.macam_kasus} · {triaseData.cara_masuk}</div>
                                            </div>
                                        )}

                                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                                <Activity className="w-4 h-4 text-red-500" />
                                                {triaseData ? "Update Triase" : "Isi Triase"}
                                            </h3>

                                            <div className="grid grid-cols-3 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase">Cara Masuk</label>
                                                    <select className={selectCls} value={triaseForm.cara_masuk}
                                                        onChange={(e) => setTriaseForm(f => ({ ...f, cara_masuk: e.target.value }))}>
                                                        {CARA_MASUK.map(s => <option key={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase">Transportasi</label>
                                                    <select className={selectCls} value={triaseForm.alat_transportasi}
                                                        onChange={(e) => setTriaseForm(f => ({ ...f, alat_transportasi: e.target.value }))}>
                                                        {ALAT_TRANS.map(s => <option key={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase">Macam Kasus</label>
                                                    <select className={selectCls} value={triaseForm.kode_kasus}
                                                        onChange={(e) => setTriaseForm(f => ({ ...f, kode_kasus: e.target.value }))}>
                                                        {masterKasus.map(k => (
                                                            <option key={k.kode_kasus} value={k.kode_kasus}>{k.macam_kasus}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase">Alasan Kedatangan</label>
                                                    <select className={selectCls} value={triaseForm.alasan_kedatangan}
                                                        onChange={(e) => setTriaseForm(f => ({ ...f, alasan_kedatangan: e.target.value }))}>
                                                        {ALASAN.map(s => <option key={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                                <div className="col-span-2 space-y-1">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase">Keterangan</label>
                                                    <input className={inputCls} placeholder="Keterangan tambahan..."
                                                        value={triaseForm.keterangan_kedatangan}
                                                        onChange={(e) => setTriaseForm(f => ({ ...f, keterangan_kedatangan: e.target.value }))} />
                                                </div>
                                            </div>

                                            <div className="border-t border-slate-100 pt-4">
                                                <div className="text-xs font-semibold text-slate-500 uppercase mb-3">Tanda Vital</div>
                                                <div className="grid grid-cols-3 gap-3">
                                                    {[
                                                        { key: "tekanan_darah", label: "Tekanan Darah", ph: "120/80" },
                                                        { key: "nadi", label: "Nadi (x/mnt)", ph: "80" },
                                                        { key: "pernapasan", label: "RR (x/mnt)", ph: "20" },
                                                        { key: "suhu", label: "Suhu (°C)", ph: "36.5" },
                                                        { key: "saturasi_o2", label: "SpO2 (%)", ph: "98" },
                                                        { key: "nyeri", label: "Nyeri (0-10)", ph: "0" },
                                                    ].map(({ key, label, ph }) => (
                                                        <div key={key} className="space-y-1">
                                                            <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
                                                            <input className={inputCls} placeholder={ph}
                                                                value={(triaseForm as any)[key]}
                                                                onChange={(e) => setTriaseForm(f => ({ ...f, [key]: e.target.value }))} />
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            <button onClick={handleSaveTriase} disabled={savingTriase}
                                                className="w-full py-3 bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                                                {savingTriase ? <><Loader2 className="w-4 h-4 animate-spin" />Menyimpan...</> : <><Save className="w-4 h-4" />Simpan Triase</>}
                                            </button>
                                        </div>
                                    </div>
                                )}

                                {/* OBSERVASI PANEL */}
                                {activePanel === "observasi" && (
                                    <div className="max-w-3xl space-y-5">
                                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                                <Plus className="w-4 h-4 text-red-500" /> Tambah Observasi
                                            </h3>
                                            <div className="grid grid-cols-3 gap-3">
                                                {[
                                                    { key: "td", label: "Tekanan Darah", ph: "120/80" },
                                                    { key: "hr", label: "Nadi (HR)", ph: "80" },
                                                    { key: "rr", label: "RR", ph: "20" },
                                                    { key: "suhu", label: "Suhu", ph: "36.5" },
                                                    { key: "spo2", label: "SpO2", ph: "98" },
                                                    { key: "gcs", label: "GCS", ph: "15" },
                                                ].map(({ key, label, ph }) => (
                                                    <div key={key} className="space-y-1">
                                                        <label className="text-xs font-semibold text-slate-500 uppercase">{label}</label>
                                                        <input className={inputCls} placeholder={ph}
                                                            value={(obsForm as any)[key]}
                                                            onChange={(e) => setObsForm(f => ({ ...f, [key]: e.target.value }))} />
                                                    </div>
                                                ))}
                                            </div>
                                            <button onClick={handleSaveObs} disabled={savingObs}
                                                className="w-full py-2.5 bg-red-600 text-white rounded-lg font-semibold hover:bg-red-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                                                {savingObs ? <><Loader2 className="w-4 h-4 animate-spin" />Menyimpan...</> : <><Plus className="w-4 h-4" />Tambah Observasi</>}
                                            </button>
                                        </div>

                                        {/* History */}
                                        {observasiList.length > 0 && (
                                            <div className="bg-white rounded-xl border border-slate-200 overflow-hidden">
                                                <div className="px-5 py-3 border-b border-slate-100 font-medium text-slate-700 text-sm flex items-center gap-2">
                                                    <Stethoscope className="w-4 h-4" /> Riwayat Observasi ({observasiList.length})
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-sm">
                                                        <thead className="bg-slate-50">
                                                            <tr className="text-xs text-slate-500">
                                                                {["Jam", "GCS", "TD", "HR", "RR", "Suhu", "SpO2"].map(h => (
                                                                    <th key={h} className="px-4 py-2 text-center font-semibold">{h}</th>
                                                                ))}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {observasiList.map((o, i) => (
                                                                <tr key={i} className="border-t border-slate-100 hover:bg-slate-50">
                                                                    <td className="px-4 py-2 text-center font-mono text-slate-600">{o.jam_rawat}</td>
                                                                    <td className="px-4 py-2 text-center">{o.gcs}</td>
                                                                    <td className="px-4 py-2 text-center font-semibold">{o.td}</td>
                                                                    <td className="px-4 py-2 text-center">{o.hr}</td>
                                                                    <td className="px-4 py-2 text-center">{o.rr}</td>
                                                                    <td className="px-4 py-2 text-center">{o.suhu}</td>
                                                                    <td className="px-4 py-2 text-center">{o.spo2}%</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
