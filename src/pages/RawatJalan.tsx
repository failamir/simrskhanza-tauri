import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    Stethoscope, RefreshCw, Search,
    User, FileText, Pill,
    CheckCircle2, X,
    Loader2, AlertCircle, Save, Plus, Trash2,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import clsx from "clsx";

interface KunjunganRalan {
    no_rawat: string; no_rkm_medis: string; nm_pasien: string;
    nm_poli: string; nm_dokter: string; png_jawab: string;
    jam_reg: string; stts: string; tgl_registrasi: string;
}
interface Penyakit { kd_penyakit: string; nm_penyakit: string; }
interface Obat { kode_brng: string; nama_brng: string; stok: number; satuan: string; harga_ralan: number; }
interface ResepItem { kode_brng: string; nama_brng: string; jml: number; aturan_pakai: string; }
interface ResepKunjungan { no_resep: string; tgl_peresepan: string; nm_dokter: string; status_penyerahan: string; items: ResepItem[]; }

interface CPPTForm {
    keluhan_utama: string; rps: string; rpd: string;
    alergi: string; keadaan: string; gcs: string; kesadaran: string;
    td: string; nadi: string; rr: string; suhu: string; spo: string;
    bb: string; tb: string;
    diagnosis: string; kd_penyakit: string;
    rtl: string; catatan: string;
}

const EMPTY_CPPT: CPPTForm = {
    keluhan_utama: "", rps: "", rpd: "",
    alergi: "", keadaan: "Sakit Ringan", gcs: "15", kesadaran: "Compos Mentis",
    td: "", nadi: "", rr: "", suhu: "", spo: "",
    bb: "", tb: "",
    diagnosis: "", kd_penyakit: "",
    rtl: "", catatan: "",
};

const sttsConfig: Record<string, { label: string; color: string; dot: string }> = {
    Belum: { label: "Menunggu", color: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
    Sudah: { label: "Selesai", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
    default: { label: "—", color: "bg-slate-100 text-slate-500", dot: "bg-slate-300" },
};

export function RawatJalan() {
    const navigate = useNavigate();
    const today = new Date().toISOString().split("T")[0];
    const [tanggal, setTanggal] = useState(today);
    const [kunjungan, setKunjungan] = useState<KunjunganRalan[]>([]);
    const [loading, setLoading] = useState(false);
    const [selected, setSelected] = useState<KunjunganRalan | null>(null);
    const [tab, setTab] = useState<"cppt" | "resep">("cppt");

    // CPPT
    const [cpptForm, setCpptForm] = useState<CPPTForm>({ ...EMPTY_CPPT });
    const [savingCppt, setSavingCppt] = useState(false);
    const [cpptMsg, setCpptMsg] = useState<{ ok: boolean; text: string } | null>(null);

    // ICD-10 search
    const [icdQuery, setIcdQuery] = useState("");
    const [icdResults, setIcdResults] = useState<Penyakit[]>([]);
    const [icdLoading, setIcdLoading] = useState(false);

    // Resep
    const [resepList, setResepList] = useState<ResepKunjungan[]>([]);
    const [obatQuery, setObatQuery] = useState("");
    const [obatResults, setObatResults] = useState<Obat[]>([]);
    const [obatLoading, setObatLoading] = useState(false);
    const [keranjang, setKeranjang] = useState<{ kode_brng: string; nama_brng: string; jml: number; aturan_pakai: string }[]>([]);
    const [savingResep, setSavingResep] = useState(false);

    const fetchKunjungan = useCallback(async () => {
        setLoading(true);
        try {
            // format tanggal to yyyy-MM-dd for backend
            const data = await invoke<KunjunganRalan[]>("get_kunjungan_ralan", { tanggal });
            setKunjungan(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [tanggal]);

    useEffect(() => { fetchKunjungan(); }, [fetchKunjungan]);

    const selectKunjungan = async (k: KunjunganRalan) => {
        setSelected(k);
        setTab("cppt");
        setCpptMsg(null);
        setCpptForm({ ...EMPTY_CPPT });
        setKeranjang([]);
        // Load existing resep
        try {
            const resep = await invoke<ResepKunjungan[]>("get_resep_kunjungan", { noRawat: k.no_rawat });
            setResepList(resep);
        } catch { setResepList([]); }
    };

    // ICD-10 search
    useEffect(() => {
        if (!icdQuery.trim()) { setIcdResults([]); return; }
        const t = setTimeout(async () => {
            setIcdLoading(true);
            try {
                const r = await invoke<Penyakit[]>("search_penyakit", { query: icdQuery });
                setIcdResults(r);
            } catch { setIcdResults([]); }
            finally { setIcdLoading(false); }
        }, 400);
        return () => clearTimeout(t);
    }, [icdQuery]);

    // Obat search
    useEffect(() => {
        if (!obatQuery.trim()) { setObatResults([]); return; }
        const t = setTimeout(async () => {
            setObatLoading(true);
            try {
                const r = await invoke<Obat[]>("search_obat", { query: obatQuery });
                setObatResults(r);
            } catch { setObatResults([]); }
            finally { setObatLoading(false); }
        }, 400);
        return () => clearTimeout(t);
    }, [obatQuery]);

    const handleSaveCppt = async () => {
        if (!selected) return;
        setSavingCppt(true);
        setCpptMsg(null);
        try {
            await invoke<string>("save_penilaian_medis", {
                input: {
                    no_rawat: selected.no_rawat,
                    kd_dokter: "",
                    ...cpptForm,
                },
            });
            setCpptMsg({ ok: true, text: "Penilaian medis berhasil disimpan!" });
            fetchKunjungan();
        } catch (e) {
            setCpptMsg({ ok: false, text: String(e) });
        } finally {
            setSavingCppt(false);
        }
    };

    const tambahObat = (o: Obat) => {
        setKeranjang((k) => [...k, { kode_brng: o.kode_brng, nama_brng: o.nama_brng, jml: 1, aturan_pakai: "3x1" }]);
        setObatQuery("");
        setObatResults([]);
    };

    const handleSaveResep = async () => {
        if (!selected || keranjang.length === 0) return;
        setSavingResep(true);
        try {
            await invoke<string>("save_resep", {
                noRawat: selected.no_rawat,
                kdDokter: "",
                items: keranjang.map((k) => ({ kode_brng: k.kode_brng, jml: k.jml, aturan_pakai: k.aturan_pakai })),
            });
            setCpptMsg({ ok: true, text: "Resep berhasil disimpan!" });
            setKeranjang([]);
            const resep = await invoke<ResepKunjungan[]>("get_resep_kunjungan", { noRawat: selected.no_rawat });
            setResepList(resep);
        } catch (e) {
            setCpptMsg({ ok: false, text: String(e) });
        } finally {
            setSavingResep(false);
        }
    };

    const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white";

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar onLogout={() => navigate("/")} />
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <Stethoscope className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-slate-800">Rawat Jalan — E-RM</h1>
                            <p className="text-xs text-slate-400">{kunjungan.length} kunjungan terdaftar</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        <button onClick={fetchKunjungan} className="p-2 text-slate-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors">
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* Kunjungan list */}
                    <div className="w-72 border-r border-slate-200 bg-white overflow-y-auto flex-shrink-0">
                        {loading ? (
                            <div className="flex items-center justify-center h-24 text-slate-400 text-sm">
                                <Loader2 className="w-4 h-4 animate-spin mr-2" />Memuat...
                            </div>
                        ) : kunjungan.length === 0 ? (
                            <div className="flex flex-col items-center justify-center h-24 text-slate-300 text-sm gap-2">
                                <Stethoscope className="w-6 h-6 opacity-40" />
                                Tidak ada kunjungan
                            </div>
                        ) : kunjungan.map((k) => {
                            const sc = sttsConfig[k.stts] || sttsConfig.default;
                            const isActive = selected?.no_rawat === k.no_rawat;
                            return (
                                <button key={k.no_rawat} onClick={() => selectKunjungan(k)}
                                    className={clsx("w-full text-left px-4 py-3 border-b border-slate-100 hover:bg-indigo-50 transition-colors",
                                        isActive && "bg-indigo-50 border-l-2 border-l-indigo-500"
                                    )}>
                                    <div className="flex items-center justify-between mb-1">
                                        <span className="font-medium text-slate-800 text-sm truncate max-w-[160px]">{k.nm_pasien}</span>
                                        <span className={clsx("text-[10px] px-1.5 py-0.5 rounded-full font-medium", sc.color)}>{sc.label}</span>
                                    </div>
                                    <div className="text-xs text-slate-400">{k.nm_poli} · {k.jam_reg}</div>
                                    <div className="text-xs text-slate-400 truncate">{k.nm_dokter}</div>
                                </button>
                            );
                        })}
                    </div>

                    {/* Detail Panel */}
                    {!selected ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-300 gap-2">
                            <FileText className="w-12 h-12 opacity-30" />
                            <span className="text-sm">Pilih kunjungan untuk isi E-RM</span>
                        </div>
                    ) : (
                        <div className="flex-1 flex flex-col overflow-hidden">
                            {/* Patient banner */}
                            <div className="bg-indigo-600 text-white px-6 py-3 flex items-center gap-4">
                                <div className="w-10 h-10 bg-white/20 rounded-full flex items-center justify-center">
                                    <User className="w-5 h-5" />
                                </div>
                                <div className="flex-1">
                                    <div className="font-semibold">{selected.nm_pasien}</div>
                                    <div className="text-indigo-200 text-xs">No. RM: {selected.no_rkm_medis} · {selected.nm_poli} · Dr. {selected.nm_dokter}</div>
                                </div>
                                <div className="text-xs text-indigo-200">No. Rawat: {selected.no_rawat}</div>
                            </div>

                            {/* Tabs */}
                            <div className="bg-white border-b border-slate-200 flex">
                                {[
                                    { key: "cppt", label: "Penilaian Medis", icon: FileText },
                                    { key: "resep", label: "Resep", icon: Pill },
                                ].map(({ key, label, icon: Icon }) => (
                                    <button key={key} onClick={() => setTab(key as any)}
                                        className={clsx("flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                                            tab === key ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                                        )}>
                                        <Icon className="w-4 h-4" />
                                        {label}
                                    </button>
                                ))}
                            </div>

                            {/* Toast */}
                            {cpptMsg && (
                                <div className={clsx("mx-6 mt-4 flex items-center gap-2 p-3 rounded-lg text-sm",
                                    cpptMsg.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"
                                )}>
                                    {cpptMsg.ok ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
                                    {cpptMsg.text}
                                    <button className="ml-auto" onClick={() => setCpptMsg(null)}><X className="w-4 h-4" /></button>
                                </div>
                            )}

                            <div className="flex-1 overflow-y-auto p-6">
                                {/* CPPT Tab */}
                                {tab === "cppt" && (
                                    <div className="space-y-5 max-w-3xl">
                                        {/* S — Subjektif */}
                                        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                                <span className="w-6 h-6 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-xs font-bold">S</span>
                                                Subjektif (Anamnesis)
                                            </h3>
                                            <div className="grid grid-cols-1 gap-3">
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Keluhan Utama *</label>
                                                    <textarea className={inputCls} rows={2} placeholder="Keluhan pasien saat datang..."
                                                        value={cpptForm.keluhan_utama} onChange={(e) => setCpptForm(f => ({ ...f, keluhan_utama: e.target.value }))} />
                                                </div>
                                                <div className="grid grid-cols-2 gap-3">
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">RPS (Riwayat Penyakit Sekarang)</label>
                                                        <textarea className={inputCls} rows={2} placeholder="..."
                                                            value={cpptForm.rps} onChange={(e) => setCpptForm(f => ({ ...f, rps: e.target.value }))} />
                                                    </div>
                                                    <div className="space-y-1">
                                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">RPD (Riwayat Penyakit Dahulu)</label>
                                                        <textarea className={inputCls} rows={2} placeholder="..."
                                                            value={cpptForm.rpd} onChange={(e) => setCpptForm(f => ({ ...f, rpd: e.target.value }))} />
                                                    </div>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Alergi</label>
                                                    <input className={inputCls} placeholder="Alergi obat / makanan (jika ada)"
                                                        value={cpptForm.alergi} onChange={(e) => setCpptForm(f => ({ ...f, alergi: e.target.value }))} />
                                                </div>
                                            </div>
                                        </section>

                                        {/* O — Objektif */}
                                        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                                <span className="w-6 h-6 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center text-xs font-bold">O</span>
                                                Objektif (Pemeriksaan Fisik)
                                            </h3>
                                            <div className="grid grid-cols-2 gap-3">
                                                {[
                                                    { key: "td", label: "Tekanan Darah", ph: "120/80 mmHg" },
                                                    { key: "nadi", label: "Nadi", ph: "80x/mnt" },
                                                    { key: "rr", label: "Respirasi", ph: "20x/mnt" },
                                                    { key: "suhu", label: "Suhu", ph: "36.5 °C" },
                                                    { key: "spo", label: "SpO2", ph: "98%" },
                                                    { key: "gcs", label: "GCS", ph: "15" },
                                                    { key: "bb", label: "Berat Badan", ph: "kg" },
                                                    { key: "tb", label: "Tinggi Badan", ph: "cm" },
                                                ].map(({ key, label, ph }) => (
                                                    <div key={key} className="space-y-1">
                                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
                                                        <input className={inputCls} placeholder={ph}
                                                            value={(cpptForm as any)[key]}
                                                            onChange={(e) => setCpptForm(f => ({ ...f, [key]: e.target.value }))} />
                                                    </div>
                                                ))}
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Keadaan Umum</label>
                                                    <select className={inputCls} value={cpptForm.keadaan} onChange={(e) => setCpptForm(f => ({ ...f, keadaan: e.target.value }))}>
                                                        {["Sehat", "Sakit Ringan", "Sakit Sedang", "Sakit Berat"].map(s => <option key={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Kesadaran</label>
                                                    <select className={inputCls} value={cpptForm.kesadaran} onChange={(e) => setCpptForm(f => ({ ...f, kesadaran: e.target.value }))}>
                                                        {["Compos Mentis", "Apatis", "Somnolen", "Sopor", "Koma"].map(s => <option key={s}>{s}</option>)}
                                                    </select>
                                                </div>
                                            </div>
                                        </section>

                                        {/* A — Assessment */}
                                        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                                <span className="w-6 h-6 bg-amber-100 text-amber-600 rounded-full flex items-center justify-center text-xs font-bold">A</span>
                                                Assessment (Diagnosa)
                                            </h3>
                                            {/* ICD-10 search */}
                                            <div className="space-y-1 relative">
                                                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Cari Kode ICD-10</label>
                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                    <input className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                        placeholder="Cari kode atau nama penyakit..."
                                                        value={icdQuery} onChange={(e) => setIcdQuery(e.target.value)} />
                                                    {icdLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
                                                </div>
                                                {icdResults.length > 0 && (
                                                    <div className="absolute z-10 w-full bg-white border border-slate-200 rounded-lg shadow-lg overflow-hidden mt-1">
                                                        {icdResults.map((p) => (
                                                            <button key={p.kd_penyakit} onClick={() => {
                                                                setCpptForm(f => ({
                                                                    ...f,
                                                                    kd_penyakit: f.kd_penyakit ? `${f.kd_penyakit},${p.kd_penyakit}` : p.kd_penyakit,
                                                                    diagnosis: f.diagnosis ? `${f.diagnosis}, ${p.nm_penyakit}` : p.nm_penyakit,
                                                                }));
                                                                setIcdQuery(""); setIcdResults([]);
                                                            }}
                                                                className="w-full text-left px-4 py-2 text-sm hover:bg-indigo-50 flex items-center gap-3 border-b border-slate-100 last:border-0">
                                                                <span className="font-mono text-xs bg-slate-100 px-1.5 py-0.5 rounded text-slate-700">{p.kd_penyakit}</span>
                                                                <span className="text-slate-700 truncate">{p.nm_penyakit}</span>
                                                            </button>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                            {cpptForm.kd_penyakit && (
                                                <div className="p-3 bg-amber-50 rounded-lg text-sm">
                                                    <span className="text-amber-700 font-medium">Dipilih: </span>
                                                    <span className="text-amber-600">{cpptForm.kd_penyakit}</span>
                                                    <span className="text-slate-500 ml-2">— {cpptForm.diagnosis}</span>
                                                    <button className="ml-2 text-red-400 hover:text-red-600" onClick={() => setCpptForm(f => ({ ...f, kd_penyakit: "", diagnosis: "" }))}>
                                                        <X className="w-3 h-3 inline" />
                                                    </button>
                                                </div>
                                            )}
                                        </section>

                                        {/* P — Plan */}
                                        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                            <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                                <span className="w-6 h-6 bg-violet-100 text-violet-600 rounded-full flex items-center justify-center text-xs font-bold">P</span>
                                                Plan (Rencana Tindak Lanjut)
                                            </h3>
                                            <div className="space-y-3">
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">RTL / Terapi</label>
                                                    <textarea className={inputCls} rows={2} placeholder="Rencana tindakan, tindak lanjut, terapi..."
                                                        value={cpptForm.rtl} onChange={(e) => setCpptForm(f => ({ ...f, rtl: e.target.value }))} />
                                                </div>
                                                <div className="space-y-1">
                                                    <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Catatan Tambahan</label>
                                                    <textarea className={inputCls} rows={2} placeholder="Catatan lainnya..."
                                                        value={cpptForm.catatan} onChange={(e) => setCpptForm(f => ({ ...f, catatan: e.target.value }))} />
                                                </div>
                                            </div>
                                        </section>

                                        <button onClick={handleSaveCppt} disabled={savingCppt}
                                            className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
                                            {savingCppt ? <><Loader2 className="w-4 h-4 animate-spin" />Menyimpan...</> : <><Save className="w-4 h-4" />Simpan Penilaian Medis</>}
                                        </button>
                                    </div>
                                )}

                                {/* Resep Tab */}
                                {tab === "resep" && (
                                    <div className="space-y-5 max-w-3xl">
                                        {/* Existing resep */}
                                        {resepList.length > 0 && (
                                            <div className="space-y-3">
                                                <h3 className="font-medium text-slate-600 text-sm">Resep Sebelumnya</h3>
                                                {resepList.map((r) => (
                                                    <div key={r.no_resep} className="bg-white rounded-xl border border-slate-200 p-4">
                                                        <div className="flex items-center justify-between mb-3">
                                                            <div>
                                                                <span className="text-sm font-semibold text-slate-800">#{r.no_resep}</span>
                                                                <span className="text-xs text-slate-400 ml-2">{r.tgl_peresepan}</span>
                                                            </div>
                                                            <span className={clsx("text-xs px-2 py-1 rounded-full font-medium",
                                                                r.status_penyerahan === "Sudah Diserahkan" ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                                            )}>{r.status_penyerahan}</span>
                                                        </div>
                                                        <div className="space-y-1">
                                                            {r.items.map((item) => (
                                                                <div key={item.kode_brng} className="flex justify-between text-sm text-slate-600">
                                                                    <span className="truncate">{item.nama_brng}</span>
                                                                    <span className="text-slate-400 shrink-0 ml-2">{item.jml}x · {item.aturan_pakai}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                ))}
                                            </div>
                                        )}

                                        {/* Add resep */}
                                        <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                            <h3 className="font-semibold text-slate-700">Buat Resep Baru</h3>
                                            {/* Search obat */}
                                            <div className="relative">
                                                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                                                <input className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                                    placeholder="Cari nama obat / kode..."
                                                    value={obatQuery} onChange={(e) => setObatQuery(e.target.value)} />
                                                {obatLoading && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 animate-spin text-slate-400" />}
                                            </div>
                                            {obatResults.length > 0 && (
                                                <div className="border border-slate-200 rounded-lg overflow-hidden">
                                                    {obatResults.map((o) => (
                                                        <button key={o.kode_brng} onClick={() => tambahObat(o)}
                                                            className="w-full text-left px-4 py-2.5 text-sm hover:bg-indigo-50 flex items-center justify-between border-b border-slate-100 last:border-0">
                                                            <div>
                                                                <div className="font-medium text-slate-800">{o.nama_brng}</div>
                                                                <div className="text-xs text-slate-400">Stok: {o.stok} · Rp{o.harga_ralan?.toLocaleString("id-ID")}</div>
                                                            </div>
                                                            <Plus className="w-4 h-4 text-indigo-500 shrink-0" />
                                                        </button>
                                                    ))}
                                                </div>
                                            )}

                                            {/* Keranjang */}
                                            {keranjang.length > 0 && (
                                                <div className="space-y-2">
                                                    {keranjang.map((item, i) => (
                                                        <div key={i} className="flex items-center gap-3 bg-slate-50 px-3 py-2 rounded-lg">
                                                            <div className="flex-1 text-sm font-medium text-slate-700 truncate">{item.nama_brng}</div>
                                                            <input type="number" min={0.5} step={0.5}
                                                                className="w-16 px-2 py-1 border border-slate-200 rounded text-sm text-center"
                                                                value={item.jml} onChange={(e) => setKeranjang(k => k.map((x, j) => j === i ? { ...x, jml: parseFloat(e.target.value) } : x))} />
                                                            <input type="text" className="w-24 px-2 py-1 border border-slate-200 rounded text-sm"
                                                                placeholder="3x1" value={item.aturan_pakai}
                                                                onChange={(e) => setKeranjang(k => k.map((x, j) => j === i ? { ...x, aturan_pakai: e.target.value } : x))} />
                                                            <button onClick={() => setKeranjang(k => k.filter((_, j) => j !== i))}
                                                                className="text-red-400 hover:text-red-600 shrink-0">
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    ))}
                                                    <button onClick={handleSaveResep} disabled={savingResep}
                                                        className="w-full py-2 bg-indigo-600 text-white rounded-lg text-sm font-semibold hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                                        {savingResep ? <><Loader2 className="w-4 h-4 animate-spin" />Menyimpan...</> : <><Save className="w-4 h-4" />Simpan Resep</>}
                                                    </button>
                                                </div>
                                            )}
                                        </div>
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
