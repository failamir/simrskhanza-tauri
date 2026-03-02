import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    ClipboardList, Search, User, ChevronRight,
    Loader2, AlertCircle, CheckCircle2, X,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";

interface Pasien { no_rkm_medis: string; nm_pasien: string; jk: string; tgl_lahir: string; alamat: string; no_ktp: string; }
interface Poliklinik { kd_poli: string; nm_poli: string; }
interface Dokter { kd_dokter: string; nm_dokter: string; }
interface Penjab { kd_pj: string; png_jawab: string; }

type Step = "pasien" | "poli" | "konfirmasi";

export function Registrasi() {
    const navigate = useNavigate();
    const [step, setStep] = useState<Step>("pasien");

    // Search pasien
    const [searchInput, setSearchInput] = useState("");
    const [searchResult, setSearchResult] = useState<Pasien[]>([]);
    const [searchLoading, setSearchLoading] = useState(false);
    const [selectedPasien, setSelectedPasien] = useState<Pasien | null>(null);

    // Step 2 data
    const [poliklinik, setPoliklinik] = useState<Poliklinik[]>([]);
    const [dokterList, setDokterList] = useState<Dokter[]>([]);
    const [penjabList, setPenjabList] = useState<Penjab[]>([]);
    const [selectedPoli, setSelectedPoli] = useState("");
    const [selectedDokter, setSelectedDokter] = useState("");
    const [selectedPenjab, setSelectedPenjab] = useState("");
    const [tglReg, setTglReg] = useState(new Date().toISOString().split("T")[0]);
    const [jamReg, setJamReg] = useState(new Date().toTimeString().slice(0, 5));

    // Submit
    const [submitting, setSubmitting] = useState(false);
    const [success, setSuccess] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const searchPasien = useCallback(async () => {
        if (!searchInput.trim()) return;
        setSearchLoading(true);
        try {
            const data = await invoke<Pasien[]>("get_patients", { search: searchInput, limit: 10, offset: 0 });
            setSearchResult(data);
        } catch { setSearchResult([]); }
        finally { setSearchLoading(false); }
    }, [searchInput]);

    const loadPoli = async () => {
        try {
            const [poli, pj] = await Promise.all([
                invoke<Poliklinik[]>("get_poliklinik"),
                invoke<Penjab[]>("get_penjab"),
            ]);
            setPoliklinik(poli);
            setPenjabList(pj);
            if (poli.length > 0) setSelectedPoli(poli[0].kd_poli);
            if (pj.length > 0) setSelectedPenjab(pj[0].kd_pj);
        } catch (e) { setError(String(e)); }
    };

    useEffect(() => {
        if (step === "poli") loadPoli();
    }, [step]);

    useEffect(() => {
        if (!selectedPoli) return;
        invoke<Dokter[]>("get_dokter_poli", { kdPoli: selectedPoli })
            .then((d) => {
                setDokterList(d);
                setSelectedDokter(d.length > 0 ? d[0].kd_dokter : "");
            })
            .catch(() => { setDokterList([]); setSelectedDokter(""); });
    }, [selectedPoli]);

    const handleSubmit = async () => {
        if (!selectedPasien || !selectedPoli || !selectedPenjab) return;
        setSubmitting(true);
        setError(null);
        try {
            const noRawat = await invoke<string>("get_next_no_rawat");
            const result = await invoke<string>("register_ralan", {
                input: {
                    no_rawat: noRawat,
                    no_rkm_medis: selectedPasien.no_rkm_medis,
                    kd_poli: selectedPoli,
                    kd_dokter: selectedDokter || "-",
                    kd_pj: selectedPenjab,
                    tgl_registrasi: tglReg,
                    jam_reg: jamReg,
                    stts: "Belum",
                },
            });
            setSuccess(`Registrasi berhasil! No. Rawat: ${result}`);
            setStep("pasien"); setSelectedPasien(null); setSearchInput(""); setSearchResult([]);
        } catch (e) { setError(String(e)); }
        finally { setSubmitting(false); }
    };

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar onLogout={() => navigate("/")} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center gap-3">
                    <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                        <ClipboardList className="w-4 h-4 text-emerald-600" />
                    </div>
                    <div>
                        <h1 className="font-semibold text-slate-800">Registrasi Rawat Jalan</h1>
                        <p className="text-xs text-slate-400">Pendaftaran kunjungan baru</p>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-2xl mx-auto space-y-4">
                        {/* Success */}
                        {success && (
                            <div className="flex items-center gap-3 bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-emerald-700">
                                <CheckCircle2 className="w-5 h-5 shrink-0" />
                                <span className="font-medium">{success}</span>
                                <button onClick={() => setSuccess(null)} className="ml-auto text-emerald-500 hover:text-emerald-700"><X className="w-4 h-4" /></button>
                            </div>
                        )}
                        {error && (
                            <div className="flex items-center gap-3 bg-red-50 border border-red-200 rounded-xl p-4 text-red-700">
                                <AlertCircle className="w-5 h-5 shrink-0" />
                                <span>{error}</span>
                                <button onClick={() => setError(null)} className="ml-auto text-red-400 hover:text-red-600"><X className="w-4 h-4" /></button>
                            </div>
                        )}

                        {/* Step indicator */}
                        <div className="flex items-center gap-2 text-sm">
                            {(["pasien", "poli", "konfirmasi"] as Step[]).map((s, i) => (
                                <div key={s} className="flex items-center gap-2">
                                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${step === s ? "bg-emerald-600 text-white" : (["pasien", "poli", "konfirmasi"].indexOf(step) > i ? "bg-emerald-200 text-emerald-700" : "bg-slate-200 text-slate-500")}`}>{i + 1}</div>
                                    <span className={step === s ? "text-slate-800 font-medium" : "text-slate-400"}>
                                        {s === "pasien" ? "Pilih Pasien" : s === "poli" ? "Poliklinik & Dokter" : "Konfirmasi"}
                                    </span>
                                    {i < 2 && <ChevronRight className="w-4 h-4 text-slate-300" />}
                                </div>
                            ))}
                        </div>

                        {/* Step 1: Cari Pasien */}
                        {step === "pasien" && (
                            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                <h2 className="font-medium text-slate-700">Cari Pasien</h2>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                                        <input
                                            type="text"
                                            value={searchInput}
                                            onChange={(e) => setSearchInput(e.target.value)}
                                            onKeyDown={(e) => e.key === "Enter" && searchPasien()}
                                            placeholder="Cari nama, No. RM, No. KTP..."
                                            className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500"
                                        />
                                    </div>
                                    <button onClick={searchPasien} disabled={searchLoading} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                                        {searchLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
                                        Cari
                                    </button>
                                </div>

                                {searchResult.length > 0 && (
                                    <div className="border border-slate-200 rounded-lg overflow-hidden">
                                        {searchResult.map((p) => (
                                            <button
                                                key={p.no_rkm_medis}
                                                onClick={() => { setSelectedPasien(p); setStep("poli"); }}
                                                className="w-full flex items-center gap-3 px-4 py-3 hover:bg-emerald-50 text-left border-b border-slate-100 last:border-0 transition-colors"
                                            >
                                                <div className="w-8 h-8 bg-slate-100 rounded-full flex items-center justify-center shrink-0">
                                                    <User className="w-4 h-4 text-slate-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium text-slate-800 text-sm">{p.nm_pasien}</div>
                                                    <div className="text-xs text-slate-400">No. RM: {p.no_rkm_medis} · {p.jk === "L" ? "Laki-laki" : "Perempuan"}</div>
                                                </div>
                                                <ChevronRight className="w-4 h-4 text-slate-300" />
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        )}

                        {/* Step 2: Poliklinik & Dokter */}
                        {step === "poli" && selectedPasien && (
                            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                <div className="p-3 bg-emerald-50 rounded-lg flex items-center gap-3">
                                    <User className="w-4 h-4 text-emerald-600" />
                                    <div>
                                        <div className="text-sm font-semibold text-slate-800">{selectedPasien.nm_pasien}</div>
                                        <div className="text-xs text-slate-500">No. RM: {selectedPasien.no_rkm_medis}</div>
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Poliklinik</label>
                                        <select value={selectedPoli} onChange={(e) => setSelectedPoli(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                            {poliklinik.map((p) => <option key={p.kd_poli} value={p.kd_poli}>{p.nm_poli}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Dokter</label>
                                        <select value={selectedDokter} onChange={(e) => setSelectedDokter(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                            {dokterList.length === 0 ? <option value="">— Tidak ada dokter —</option> : dokterList.map((d) => <option key={d.kd_dokter} value={d.kd_dokter}>{d.nm_dokter}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Penjamin</label>
                                        <select value={selectedPenjab} onChange={(e) => setSelectedPenjab(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500">
                                            {penjabList.map((p) => <option key={p.kd_pj} value={p.kd_pj}>{p.png_jawab}</option>)}
                                        </select>
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Tanggal Registrasi</label>
                                        <input type="date" value={tglReg} onChange={(e) => setTglReg(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Jam Registrasi</label>
                                        <input type="time" value={jamReg} onChange={(e) => setJamReg(e.target.value)} className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                                    </div>
                                </div>

                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => setStep("pasien")} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">Kembali</button>
                                    <button onClick={() => setStep("konfirmasi")} disabled={!selectedPoli} className="px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-2">
                                        Lanjut <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}

                        {/* Step 3: Konfirmasi */}
                        {step === "konfirmasi" && selectedPasien && (
                            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                <h2 className="font-medium text-slate-700">Konfirmasi Registrasi</h2>
                                <div className="space-y-3 text-sm">
                                    {[
                                        ["Pasien", `${selectedPasien.nm_pasien} (${selectedPasien.no_rkm_medis})`],
                                        ["Poliklinik", poliklinik.find((p) => p.kd_poli === selectedPoli)?.nm_poli || selectedPoli],
                                        ["Dokter", dokterList.find((d) => d.kd_dokter === selectedDokter)?.nm_dokter || "—"],
                                        ["Penjamin", penjabList.find((p) => p.kd_pj === selectedPenjab)?.png_jawab || selectedPenjab],
                                        ["Tanggal", tglReg],
                                        ["Jam", jamReg],
                                    ].map(([k, v]) => (
                                        <div key={k} className="flex justify-between py-2 border-b border-slate-100 last:border-0">
                                            <span className="text-slate-500">{k}</span>
                                            <span className="font-medium text-slate-800">{v}</span>
                                        </div>
                                    ))}
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button onClick={() => setStep("poli")} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50">Kembali</button>
                                    <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2">
                                        {submitting ? <><Loader2 className="w-4 h-4 animate-spin" /> Menyimpan...</> : <><CheckCircle2 className="w-4 h-4" /> Simpan Registrasi</>}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                </main>
            </div>
        </div>
    );
}
