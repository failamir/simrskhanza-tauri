import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    Shield, RefreshCw, CheckCircle2, AlertCircle, Loader2,
    Search, Plus, FileText, User, Settings, Eye, EyeOff,
    ChevronDown, ChevronUp, Wifi, WifiOff,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import clsx from "clsx";

interface SepRow {
    no_sep: string; no_rawat: string; tglsep: string; nama_pasien: string;
    no_kartu: string; peserta: string; kelas_rawat: string;
    nm_poli: string; jenis_pelayanan: string; diagawal: string; catatan: string;
}
interface ApiResponse { success: boolean; message: string; data: any; }

const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500";
const inputErrCls = "w-full px-3 py-2 border border-red-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-red-400";

function Label({ text }: { text: string }) {
    return <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">{text}</label>;
}

const KELAS_LIST = [{ val: "1", label: "Kelas 1" }, { val: "2", label: "Kelas 2" }, { val: "3", label: "Kelas 3" }];
const JENIS_LAYANAN = [{ val: "1", label: "Rawat Jalan" }, { val: "2", label: "Rawat Inap" }];

export function BPJSBridging() {
    const navigate = useNavigate();
    const today = new Date().toISOString().split("T")[0];

    const [tab, setTab] = useState<"config" | "eligibilitas" | "sep">("config");

    // ── CONFIG ──────────────────────────────────────────────────
    const [cfg, setCfg] = useState({ cons_id: "", secret_key: "", user_key: "", kd_ppk: "", use_dev: true });
    const [showKey, setShowKey] = useState(false);
    const [cfgSaved, setCfgSaved] = useState(false);
    const [cfgLoading, setCfgLoading] = useState(false);
    const [connected, setConnected] = useState<boolean | null>(null);

    const handleSaveConfig = async () => {
        setCfgLoading(true);
        try {
            await invoke("set_bpjs_config", { input: cfg });
            setCfgSaved(true);
            setTimeout(() => setCfgSaved(false), 2500);
        } catch (e) { console.error(e); }
        finally { setCfgLoading(false); }
    };

    const handleTestConnection = async () => {
        setCfgLoading(true);
        try {
            // Test dengan cek peserta dummy — jika error "404" berarti connected, "401" berarti auth salah
            await invoke<ApiResponse>("cek_eligibilitas", {
                noKartu: "0000000000000", tanggal: today,
            });
            // Jika dapat response (even failure), API reachable
            setConnected(true);
        } catch (e) {
            // Network error = not connected
            setConnected(false);
        }
        finally { setCfgLoading(false); }
    };

    // ── ELIGIBILITAS ─────────────────────────────────────────────
    const [eligMode, setEligMode] = useState<"kartu" | "nik">("kartu");
    const [eligInput, setEligInput] = useState("");
    const [eligTgl, setEligTgl] = useState(today);
    const [eligResult, setEligResult] = useState<ApiResponse | null>(null);
    const [eligLoading, setEligLoading] = useState(false);

    const handleCekEligibilitas = async () => {
        if (!eligInput) return;
        setEligLoading(true);
        setEligResult(null);
        try {
            const res = await invoke<ApiResponse>(
                eligMode === "kartu" ? "cek_eligibilitas" : "cek_eligibilitas_nik",
                eligMode === "kartu"
                    ? { noKartu: eligInput, tanggal: eligTgl }
                    : { nik: eligInput, tanggal: eligTgl }
            );
            setEligResult(res);
        } catch (e) {
            setEligResult({ success: false, message: String(e), data: null });
        }
        finally { setEligLoading(false); }
    };

    // ── SEP ──────────────────────────────────────────────────────
    const [tanggalSep, setTanggalSep] = useState(today);
    const [sepList, setSepList] = useState<SepRow[]>([]);
    const [sepLoading, setSepLoading] = useState(false);
    const [expandedSep, setExpandedSep] = useState<string | null>(null);

    // Form buat SEP
    const [sepForm, setSepForm] = useState({
        no_rawat: "", no_kartu: "", tgl_sep: today,
        jenis_pelayanan: "1", kd_poli: "", nm_poli: "",
        kelas: "3", diagnosa: "", catatan: "",
        tgl_rujukan: today, no_rujukan: "", kd_ppk_rujukan: "", nm_ppk_rujukan: "",
        lakalantas: "0", nm_pasien: "", tgl_lahir: "", jkel: "L",
        no_mr: "", no_telep: "",
    });
    const [noSepManual, setNoSepManual] = useState("");
    const [sepSaving, setSepSaving] = useState(false);

    const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
    const showToast = (ok: boolean, text: string) => {
        setToast({ ok, text });
        setTimeout(() => setToast(null), 4000);
    };

    const fetchSepList = useCallback(async () => {
        setSepLoading(true);
        try {
            const data = await invoke<SepRow[]>("get_sep_list", { tanggal: tanggalSep });
            setSepList(data);
        } catch { setSepList([]); }
        finally { setSepLoading(false); }
    }, [tanggalSep]);

    useEffect(() => { if (tab === "sep") fetchSepList(); }, [tab, fetchSepList]);

    const handleSimpanSep = async () => {
        if (!noSepManual || !sepForm.no_rawat || !sepForm.no_kartu) {
            showToast(false, "No SEP, No Rawat, dan No Kartu wajib diisi");
            return;
        }
        setSepSaving(true);
        try {
            await invoke("simpan_sep_lokal", { input: sepForm, noSep: noSepManual });
            showToast(true, `SEP ${noSepManual} berhasil disimpan!`);
            fetchSepList();
            setNoSepManual("");
        } catch (e) { showToast(false, String(e)); }
        finally { setSepSaving(false); }
    };

    const renderEligData = (data: any) => {
        if (!data || typeof data !== "object") return null;
        const fields = [
            ["nama", "Nama"],
            ["noKartu", "No. Kartu"],
            ["tglLahir", "Tgl Lahir"],
            ["jkl", "Jenis Kelamin"],
            ["statusPeserta.keterangan", "Status"],
            ["hakKelas.keterangan", "Hak Kelas"],
            ["jenisPeserta.keterangan", "Jenis Peserta"],
            ["kdProviderPst.nmProvider", "Faskes 1"],
        ];
        return (
            <div className="grid grid-cols-2 gap-2 mt-3">
                {fields.map(([key, label]) => {
                    const keys = key.split(".");
                    let val = data;
                    for (const k of keys) val = val?.[k];
                    if (!val) return null;
                    return (
                        <div key={key} className="bg-white rounded-lg px-3 py-2 border border-slate-100">
                            <div className="text-[10px] text-slate-400 uppercase font-semibold">{label}</div>
                            <div className="text-sm font-medium text-slate-800">{String(val)}</div>
                        </div>
                    );
                })}
            </div>
        );
    };

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar onLogout={() => navigate("/")} />

            {toast && (
                <div className={clsx("fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-5 py-3 rounded-xl shadow-lg text-sm font-medium",
                    toast.ok ? "bg-emerald-600 text-white" : "bg-red-600 text-white")}>
                    {toast.ok ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    {toast.text}
                </div>
            )}

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                            <Shield className="w-4 h-4 text-indigo-600" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-slate-800">Bridging BPJS — VClaim</h1>
                            <p className="text-xs text-slate-400">Eligibilitas peserta · SEP · Rujukan</p>
                        </div>
                    </div>
                    <div className="flex items-center gap-2">
                        {connected !== null && (
                            <div className={clsx("flex items-center gap-1.5 text-xs font-medium px-3 py-1.5 rounded-full",
                                connected ? "bg-emerald-100 text-emerald-700" : "bg-red-100 text-red-700")}>
                                {connected ? <Wifi className="w-3.5 h-3.5" /> : <WifiOff className="w-3.5 h-3.5" />}
                                {connected ? "Terhubung" : "Tidak Terhubung"}
                            </div>
                        )}
                    </div>
                </header>

                {/* Tabs */}
                <div className="bg-white border-b border-slate-200 px-6 flex">
                    {[
                        { key: "config", label: "Konfigurasi API", icon: Settings },
                        { key: "eligibilitas", label: "Cek Eligibilitas", icon: Search },
                        { key: "sep", label: "SEP & Klaim", icon: FileText },
                    ].map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setTab(key as any)}
                            className={clsx("flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                                tab === key ? "border-indigo-600 text-indigo-600" : "border-transparent text-slate-500 hover:text-slate-700"
                            )}>
                            <Icon className="w-4 h-4" />{label}
                        </button>
                    ))}
                </div>

                <main className="flex-1 overflow-y-auto p-6">
                    {/* CONFIG TAB */}
                    {tab === "config" && (
                        <div className="max-w-xl mx-auto space-y-5">
                            <div className="bg-indigo-50 border border-indigo-200 rounded-xl p-4 text-sm text-indigo-700">
                                <b>Panduan:</b> Isi kredensial dari portal BPJS Kesehatan → HFIS → VClaim → Aktivasi → Unduh Kunci. Gunakan mode <b>Dev</b> untuk testing.
                            </div>

                            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                    <Settings className="w-4 h-4 text-indigo-500" /> Konfigurasi VClaim BPJS
                                </h3>

                                <div className="space-y-1">
                                    <Label text="Cons ID" />
                                    <input className={inputCls} placeholder="Consumer ID dari portal BPJS"
                                        value={cfg.cons_id} onChange={(e) => setCfg(c => ({ ...c, cons_id: e.target.value }))} />
                                </div>

                                <div className="space-y-1">
                                    <Label text="Secret Key" />
                                    <div className="relative">
                                        <input
                                            type={showKey ? "text" : "password"}
                                            className={inputCls + " pr-10"}
                                            placeholder="Secret key dari portal BPJS"
                                            value={cfg.secret_key}
                                            onChange={(e) => setCfg(c => ({ ...c, secret_key: e.target.value }))}
                                        />
                                        <button onClick={() => setShowKey(s => !s)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                                            {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <Label text="User Key" />
                                    <input className={inputCls} placeholder="User key"
                                        value={cfg.user_key} onChange={(e) => setCfg(c => ({ ...c, user_key: e.target.value }))} />
                                </div>

                                <div className="space-y-1">
                                    <Label text="Kode PPK (Faskes)" />
                                    <input className={inputCls} placeholder="Kode faskes ini (misal: 1234567)"
                                        value={cfg.kd_ppk} onChange={(e) => setCfg(c => ({ ...c, kd_ppk: e.target.value }))} />
                                </div>

                                <div className="flex items-center gap-3">
                                    <label className="flex items-center gap-2 cursor-pointer select-none">
                                        <div onClick={() => setCfg(c => ({ ...c, use_dev: !c.use_dev }))}
                                            className={clsx("w-10 h-5 rounded-full transition-colors relative",
                                                cfg.use_dev ? "bg-amber-400" : "bg-emerald-500")}>
                                            <span className={clsx("absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform",
                                                cfg.use_dev ? "left-0.5" : "left-5.5")} />
                                        </div>
                                        <span className="text-sm text-slate-600">
                                            Mode: <b className={cfg.use_dev ? "text-amber-600" : "text-emerald-600"}>
                                                {cfg.use_dev ? "Development" : "Production"}
                                            </b>
                                        </span>
                                    </label>
                                </div>

                                <div className="flex gap-3 pt-2">
                                    <button onClick={handleSaveConfig} disabled={cfgLoading}
                                        className="flex-1 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                        {cfgLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                                        {cfgSaved ? "Tersimpan!" : "Simpan Konfigurasi"}
                                    </button>
                                    <button onClick={handleTestConnection} disabled={cfgLoading}
                                        className="px-4 py-2.5 border border-indigo-300 text-indigo-600 rounded-xl font-medium text-sm hover:bg-indigo-50 flex items-center gap-2">
                                        <Wifi className="w-4 h-4" /> Test
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}

                    {/* ELIGIBILITAS TAB */}
                    {tab === "eligibilitas" && (
                        <div className="max-w-2xl mx-auto space-y-5">
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                    <Search className="w-4 h-4 text-indigo-500" /> Cek Eligibilitas Peserta
                                </h3>

                                {/* Mode toggle */}
                                <div className="flex p-1 bg-slate-100 rounded-xl w-fit gap-1">
                                    {[
                                        { key: "kartu", label: "No. Kartu BPJS" },
                                        { key: "nik", label: "NIK KTP" },
                                    ].map(({ key, label }) => (
                                        <button key={key} onClick={() => setEligMode(key as any)}
                                            className={clsx("px-4 py-1.5 rounded-lg text-sm font-medium transition-all",
                                                eligMode === key ? "bg-white shadow text-indigo-700" : "text-slate-500 hover:text-slate-700"
                                            )}>
                                            {label}
                                        </button>
                                    ))}
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <Label text={eligMode === "kartu" ? "Nomor Kartu BPJS" : "NIK KTP"} />
                                        <input className={inputCls}
                                            placeholder={eligMode === "kartu" ? "13 digit nomor kartu" : "16 digit NIK"}
                                            value={eligInput} onChange={(e) => setEligInput(e.target.value)}
                                            maxLength={eligMode === "kartu" ? 13 : 16} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label text="Tanggal Cek" />
                                        <input type="date" className={inputCls} value={eligTgl}
                                            onChange={(e) => setEligTgl(e.target.value)} />
                                    </div>
                                </div>

                                <button onClick={handleCekEligibilitas} disabled={eligLoading || !eligInput}
                                    className="w-full py-3 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                    {eligLoading ? <><Loader2 className="w-4 h-4 animate-spin" />Memeriksa...</> : <><Search className="w-4 h-4" />Cek Eligibilitas</>}
                                </button>
                            </div>

                            {/* Result */}
                            {eligResult && (
                                <div className={clsx("rounded-2xl border p-5",
                                    eligResult.success ? "bg-emerald-50 border-emerald-200" : "bg-red-50 border-red-200")}>
                                    <div className={clsx("flex items-center gap-2 font-semibold text-sm mb-2",
                                        eligResult.success ? "text-emerald-700" : "text-red-700")}>
                                        {eligResult.success ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                                        {eligResult.success ? "Peserta Aktif / Ditemukan" : "Tidak Ditemukan / Error"}
                                    </div>
                                    <p className="text-xs text-slate-500 mb-2">Pesan API: {eligResult.message}</p>
                                    {eligResult.data && renderEligData(eligResult.data)}
                                </div>
                            )}
                        </div>
                    )}

                    {/* SEP TAB */}
                    {tab === "sep" && (
                        <div className="max-w-4xl mx-auto space-y-5">
                            {/* Form simpan SEP */}
                            <div className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
                                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                    <Plus className="w-4 h-4 text-indigo-500" /> Input / Simpan Data SEP
                                    <span className="text-xs text-slate-400 font-normal">(dari hasil pembuatan SEP di portal BPJS)</span>
                                </h3>

                                <div className="grid grid-cols-3 gap-3">
                                    <div className="space-y-1">
                                        <Label text="No SEP *" />
                                        <input className={!noSepManual ? inputErrCls : inputCls} placeholder="No SEP dari BPJS"
                                            value={noSepManual} onChange={(e) => setNoSepManual(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label text="No Rawat *" />
                                        <input className={inputCls} placeholder="No rawat kunjungan"
                                            value={sepForm.no_rawat} onChange={(e) => setSepForm(f => ({ ...f, no_rawat: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label text="No Kartu BPJS *" />
                                        <input className={inputCls} placeholder="13 digit"
                                            value={sepForm.no_kartu} onChange={(e) => setSepForm(f => ({ ...f, no_kartu: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label text="Nama Pasien" />
                                        <input className={inputCls} placeholder="Nama lengkap"
                                            value={sepForm.nm_pasien} onChange={(e) => setSepForm(f => ({ ...f, nm_pasien: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label text="Tanggal SEP" />
                                        <input type="date" className={inputCls} value={sepForm.tgl_sep}
                                            onChange={(e) => setSepForm(f => ({ ...f, tgl_sep: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label text="Jenis Pelayanan" />
                                        <select className={inputCls} value={sepForm.jenis_pelayanan}
                                            onChange={(e) => setSepForm(f => ({ ...f, jenis_pelayanan: e.target.value }))}>
                                            {JENIS_LAYANAN.map(j => <option key={j.val} value={j.val}>{j.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label text="Kelas Rawat" />
                                        <select className={inputCls} value={sepForm.kelas}
                                            onChange={(e) => setSepForm(f => ({ ...f, kelas: e.target.value }))}>
                                            {KELAS_LIST.map(k => <option key={k.val} value={k.val}>{k.label}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <Label text="Diagnosa Awal (ICD-10)" />
                                        <input className={inputCls} placeholder="Contoh: J06.9"
                                            value={sepForm.diagnosa} onChange={(e) => setSepForm(f => ({ ...f, diagnosa: e.target.value }))} />
                                    </div>
                                    <div className="space-y-1">
                                        <Label text="No Rujukan" />
                                        <input className={inputCls} placeholder="No rujukan faskes 1"
                                            value={sepForm.no_rujukan} onChange={(e) => setSepForm(f => ({ ...f, no_rujukan: e.target.value }))} />
                                    </div>
                                    <div className="col-span-3 space-y-1">
                                        <Label text="Catatan" />
                                        <input className={inputCls} placeholder="Catatan tambahan..."
                                            value={sepForm.catatan} onChange={(e) => setSepForm(f => ({ ...f, catatan: e.target.value }))} />
                                    </div>
                                </div>

                                <button onClick={handleSimpanSep} disabled={sepSaving}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-indigo-600 text-white rounded-xl font-semibold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors">
                                    {sepSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    Simpan SEP ke Database
                                </button>
                            </div>

                            {/* SEP List */}
                            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
                                <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                                    <div className="flex items-center gap-3">
                                        <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                            <FileText className="w-4 h-4 text-indigo-500" /> Daftar SEP
                                        </h3>
                                        <input type="date" value={tanggalSep} onChange={(e) => setTanggalSep(e.target.value)}
                                            className="px-2 py-1 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400" />
                                    </div>
                                    <button onClick={fetchSepList} className="p-1.5 text-slate-400 hover:text-indigo-600 rounded-lg transition-colors">
                                        <RefreshCw className={`w-4 h-4 ${sepLoading ? "animate-spin" : ""}`} />
                                    </button>
                                </div>

                                {sepLoading ? (
                                    <div className="flex justify-center py-10 text-slate-400 gap-2">
                                        <Loader2 className="w-5 h-5 animate-spin" />Memuat SEP...
                                    </div>
                                ) : sepList.length === 0 ? (
                                    <div className="flex flex-col items-center py-10 text-slate-300 gap-2">
                                        <FileText className="w-10 h-10 opacity-40" />
                                        <span>Tidak ada SEP tanggal tersebut</span>
                                    </div>
                                ) : (
                                    <div className="divide-y divide-slate-100">
                                        {sepList.map((s) => {
                                            const isExp = expandedSep === s.no_sep;
                                            return (
                                                <div key={s.no_sep}>
                                                    <div className="flex items-center gap-4 px-6 py-4">
                                                        <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
                                                            <User className="w-5 h-5 text-indigo-600" />
                                                        </div>
                                                        <div className="flex-1 min-w-0">
                                                            <div className="font-semibold text-slate-800">{s.nama_pasien}</div>
                                                            <div className="text-xs text-slate-400 flex gap-3 mt-0.5">
                                                                <span className="font-mono">{s.no_kartu}</span>
                                                                <span>{s.peserta}</span>
                                                                <span>{s.kelas_rawat}</span>
                                                            </div>
                                                        </div>
                                                        <div className="flex items-center gap-2 shrink-0">
                                                            <span className={clsx("text-xs px-2.5 py-1 rounded-full font-medium",
                                                                s.jenis_pelayanan === "Rawat Inap" ? "bg-teal-100 text-teal-700" : "bg-indigo-100 text-indigo-700"
                                                            )}>{s.jenis_pelayanan}</span>
                                                            <span className="text-xs font-mono text-slate-400">{s.tglsep}</span>
                                                            <button onClick={() => setExpandedSep(isExp ? null : s.no_sep)}
                                                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                                                                {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                            </button>
                                                        </div>
                                                    </div>

                                                    {isExp && (
                                                        <div className="bg-slate-50 border-t border-slate-100 px-6 py-4 grid grid-cols-3 gap-3 text-sm">
                                                            <div><span className="text-slate-400 text-xs">No SEP:</span><div className="font-mono text-slate-700 text-xs">{s.no_sep}</div></div>
                                                            <div><span className="text-slate-400 text-xs">No Rawat:</span><div className="font-mono text-slate-700 text-xs">{s.no_rawat}</div></div>
                                                            <div><span className="text-slate-400 text-xs">Poli:</span><div className="text-slate-700 text-xs">{s.nm_poli}</div></div>
                                                            <div><span className="text-slate-400 text-xs">Diagnosa:</span><div className="font-semibold text-slate-700">{s.diagawal || "—"}</div></div>
                                                            <div className="col-span-2"><span className="text-slate-400 text-xs">Catatan:</span><div className="text-slate-600 text-xs">{s.catatan || "—"}</div></div>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        })}
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
