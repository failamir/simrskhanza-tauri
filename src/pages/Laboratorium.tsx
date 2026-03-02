import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    TestTube, RefreshCw, Plus, Save, CheckCircle2,
    AlertCircle, Loader2, X, ChevronDown, ChevronUp,
    FlaskConical, ClipboardList,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import clsx from "clsx";

interface JenisPemeriksaanLab {
    kd_jenis_prw: string; nm_perawatan: string; nm_poli: string; biaya: number;
}
interface PermintaanLabRow {
    noorder: string; no_rawat: string; nm_pasien: string;
    tgl_permintaan: string; jam_permintaan: string;
    diagnosa_klinis: string; nm_dokter: string; status: string; sudah_ada_hasil: boolean;
}
interface TemplateLab { id_template: number; pemeriksaan: string; satuan: string; nilai_rujukan: string; }
interface DetailHasilLab {
    id_template: number; pemeriksaan: string; nilai: string;
    satuan: string; nilai_rujukan: string; keterangan: string; biaya_item: number;
}

export function Laboratorium() {
    const navigate = useNavigate();
    const today = new Date().toISOString().split("T")[0];
    const [tanggal, setTanggal] = useState(today);
    const [tab, setTab] = useState<"permintaan" | "input">("permintaan");

    // PERMINTAAN TAB
    const [permintaanList, setPermintaanList] = useState<PermintaanLabRow[]>([]);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [expandedDetail, setExpandedDetail] = useState<DetailHasilLab[]>([]);
    const [loadingDetail, setLoadingDetail] = useState(false);

    // NEW PERMINTAAN FORM
    const [jenisList, setJenisList] = useState<JenisPemeriksaanLab[]>([]);
    const [formNoRawat, setFormNoRawat] = useState("");
    const [formKdJenis, setFormKdJenis] = useState("");
    const [formDiagnosa, setFormDiagnosa] = useState("");
    const [submitting, setSubmitting] = useState(false);

    // INPUT HASIL TAB
    const [noorderSelected, setNoorderSelected] = useState("");
    const [templates, setTemplates] = useState<TemplateLab[]>([]);
    const [hasilForm, setHasilForm] = useState<Record<number, { nilai: string; keterangan: string }>>({});
    const [loadingTemplate, setLoadingTemplate] = useState(false);
    const [savingHasil, setSavingHasil] = useState(false);

    const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);

    const showToast = (ok: boolean, text: string) => {
        setToast({ ok, text });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchPermintaan = useCallback(async () => {
        setLoading(true);
        try {
            const data = await invoke<PermintaanLabRow[]>("get_permintaan_lab", { tanggal });
            setPermintaanList(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [tanggal]);

    useEffect(() => { fetchPermintaan(); }, [fetchPermintaan]);

    useEffect(() => {
        invoke<JenisPemeriksaanLab[]>("get_jenis_pemeriksaan_lab")
            .then(setJenisList).catch(console.error);
    }, []);

    const toggleExpand = async (row: PermintaanLabRow) => {
        if (expanded === row.noorder) { setExpanded(null); return; }
        setExpanded(row.noorder);
        if (row.sudah_ada_hasil) {
            setLoadingDetail(true);
            try {
                const detail = await invoke<DetailHasilLab[]>("get_detail_hasil_lab", {
                    noRawat: row.no_rawat, kdJenisPrw: row.noorder.startsWith("LAB") ? "" : row.noorder,
                });
                setExpandedDetail(detail);
            } catch { setExpandedDetail([]); }
            finally { setLoadingDetail(false); }
        } else {
            setExpandedDetail([]);
        }
    };

    const handleBuatPermintaan = async () => {
        if (!formNoRawat || !formKdJenis) {
            showToast(false, "No Rawat dan Jenis Pemeriksaan wajib diisi");
            return;
        }
        setSubmitting(true);
        try {
            const noorder = await invoke<string>("buat_permintaan_lab", {
                input: { no_rawat: formNoRawat, kd_jenis_prw: formKdJenis, kd_dokter: "", diagnosa_klinis: formDiagnosa, status: "ralan" },
            });
            showToast(true, `Permintaan lab berhasil. No Order: ${noorder}`);
            setFormNoRawat(""); setFormKdJenis(""); setFormDiagnosa("");
            fetchPermintaan();
        } catch (e) { showToast(false, String(e)); }
        finally { setSubmitting(false); }
    };

    const handleSelectForInput = async (row: PermintaanLabRow, kdJenis: string) => {
        setNoorderSelected(row.noorder);
        setLoadingTemplate(true);
        setTemplates([]);
        setHasilForm({});
        try {
            const tpls = await invoke<TemplateLab[]>("get_template_lab", { kdJenisPrw: kdJenis });
            setTemplates(tpls);
            const init: Record<number, { nilai: string; keterangan: string }> = {};
            tpls.forEach((t) => { init[t.id_template] = { nilai: "", keterangan: "" }; });
            setHasilForm(init);
            setTab("input");
        } catch { showToast(false, "Gagal memuat template lab"); }
        finally { setLoadingTemplate(false); }
    };

    const handleSimpanHasil = async () => {
        const noorderRow = permintaanList.find(p => p.noorder === noorderSelected);
        if (!noorderRow || templates.length === 0) return;
        setSavingHasil(true);
        try {
            const results = templates.map((t) => ({
                no_rawat: noorderRow.no_rawat,
                kd_jenis_prw: "", // we use noorder for tracking
                id_template: t.id_template,
                nilai: hasilForm[t.id_template]?.nilai ?? "",
                keterangan: hasilForm[t.id_template]?.keterangan ?? "",
            }));
            await invoke<string>("input_hasil_lab", { noorder: noorderSelected, results });
            showToast(true, "Hasil lab berhasil disimpan!");
            setNoorderSelected("");
            setTemplates([]);
            setTab("permintaan");
            fetchPermintaan();
        } catch (e) { showToast(false, String(e)); }
        finally { setSavingHasil(false); }
    };

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar onLogout={() => navigate("/")} />

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
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-purple-100 rounded-lg flex items-center justify-center">
                            <TestTube className="w-4 h-4 text-purple-600" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-slate-800">Laboratorium</h1>
                            <p className="text-xs text-slate-400">
                                {permintaanList.filter(p => !p.sudah_ada_hasil).length} menunggu · {permintaanList.filter(p => p.sudah_ada_hasil).length} selesai
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500" />
                        <button onClick={fetchPermintaan} className="p-2 text-slate-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition-colors">
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </header>

                {/* Tabs */}
                <div className="bg-white border-b border-slate-200 px-6 flex">
                    {[
                        { key: "permintaan", label: "Daftar Permintaan", icon: ClipboardList },
                        { key: "input", label: "Input Hasil", icon: FlaskConical },
                    ].map(({ key, label, icon: Icon }) => (
                        <button key={key} onClick={() => setTab(key as any)}
                            className={clsx("flex items-center gap-2 px-5 py-3 text-sm font-medium border-b-2 transition-colors",
                                tab === key ? "border-purple-600 text-purple-600" : "border-transparent text-slate-500 hover:text-slate-700"
                            )}>
                            <Icon className="w-4 h-4" /> {label}
                            {key === "input" && noorderSelected && (
                                <span className="ml-1 bg-purple-100 text-purple-600 text-xs px-1.5 py-0.5 rounded-full font-semibold">●</span>
                            )}
                        </button>
                    ))}
                </div>

                <main className="flex-1 overflow-y-auto p-6">
                    {/* PERMINTAAN TAB */}
                    {tab === "permintaan" && (
                        <div className="max-w-4xl mx-auto space-y-5">
                            {/* Buat Permintaan Card */}
                            <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                <h3 className="font-semibold text-slate-700 flex items-center gap-2">
                                    <Plus className="w-4 h-4 text-purple-500" /> Buat Permintaan Lab
                                </h3>
                                <div className="grid grid-cols-2 gap-3">
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">No Rawat</label>
                                        <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            placeholder="Contoh: 2026/03/02/000001"
                                            value={formNoRawat} onChange={(e) => setFormNoRawat(e.target.value)} />
                                    </div>
                                    <div className="space-y-1">
                                        <label className="text-xs font-semibold text-slate-500 uppercase">Jenis Pemeriksaan</label>
                                        <select className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                            value={formKdJenis} onChange={(e) => setFormKdJenis(e.target.value)}>
                                            <option value="">— Pilih Pemeriksaan —</option>
                                            {jenisList.map((j) => (
                                                <option key={j.kd_jenis_prw} value={j.kd_jenis_prw}>
                                                    {j.nm_perawatan} · Rp{j.biaya.toLocaleString("id-ID")}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-xs font-semibold text-slate-500 uppercase">Diagnosa Klinis</label>
                                    <input className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                        placeholder="Diagnosa / indikasi pemeriksaan..."
                                        value={formDiagnosa} onChange={(e) => setFormDiagnosa(e.target.value)} />
                                </div>
                                <button onClick={handleBuatPermintaan} disabled={submitting}
                                    className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors">
                                    {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                    Buat Permintaan
                                </button>
                            </div>

                            {/* List Permintaan */}
                            {loading ? (
                                <div className="flex justify-center py-12 text-slate-400 gap-2">
                                    <Loader2 className="w-5 h-5 animate-spin" />Memuat...
                                </div>
                            ) : permintaanList.length === 0 ? (
                                <div className="flex flex-col items-center py-12 text-slate-300 gap-2">
                                    <TestTube className="w-10 h-10 opacity-40" />
                                    <span>Tidak ada permintaan lab hari ini</span>
                                </div>
                            ) : permintaanList.map((row) => {
                                const isExp = expanded === row.noorder;
                                return (
                                    <div key={row.noorder} className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
                                        <div className="flex items-center gap-4 px-5 py-4">
                                            <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                                row.sudah_ada_hasil ? "bg-emerald-100" : "bg-amber-100")}>
                                                <TestTube className={clsx("w-5 h-5", row.sudah_ada_hasil ? "text-emerald-600" : "text-amber-600")} />
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="font-semibold text-slate-800">{row.nm_pasien}</div>
                                                <div className="text-xs text-slate-400 truncate">
                                                    {row.diagnosa_klinis} · Dr. {row.nm_dokter} · {row.jam_permintaan}
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 shrink-0">
                                                <span className={clsx("text-xs px-2.5 py-1 rounded-full font-medium",
                                                    row.sudah_ada_hasil ? "bg-emerald-100 text-emerald-700" : "bg-amber-100 text-amber-700"
                                                )}>
                                                    {row.sudah_ada_hasil ? "Selesai" : "Menunggu"}
                                                </span>
                                                <span className="text-xs font-mono text-slate-400">#{row.noorder}</span>
                                                {!row.sudah_ada_hasil && (
                                                    <button
                                                        onClick={() => handleSelectForInput(row, formKdJenis)}
                                                        className="text-xs px-2.5 py-1 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors font-medium"
                                                    >
                                                        Input Hasil
                                                    </button>
                                                )}
                                                <button onClick={() => toggleExpand(row)}
                                                    className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                                                    {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                                </button>
                                            </div>
                                        </div>

                                        {isExp && row.sudah_ada_hasil && (
                                            <div className="border-t border-slate-100 bg-slate-50 px-5 py-4">
                                                {loadingDetail ? (
                                                    <div className="flex items-center gap-2 text-slate-400 text-sm">
                                                        <Loader2 className="w-4 h-4 animate-spin" />Memuat detail...
                                                    </div>
                                                ) : expandedDetail.length === 0 ? (
                                                    <p className="text-sm text-slate-400">Belum ada rincian hasil</p>
                                                ) : (
                                                    <table className="w-full text-sm">
                                                        <thead>
                                                            <tr className="text-xs text-slate-500 border-b border-slate-200">
                                                                <th className="text-left py-2 pr-4 font-semibold">Pemeriksaan</th>
                                                                <th className="text-center py-2 px-2 font-semibold">Hasil</th>
                                                                <th className="text-center py-2 px-2 font-semibold">Satuan</th>
                                                                <th className="text-left py-2 pl-2 font-semibold">Nilai Rujukan</th>
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {expandedDetail.map((d) => (
                                                                <tr key={d.id_template} className="border-b border-slate-100 last:border-0">
                                                                    <td className="py-2 pr-4 text-slate-700">{d.pemeriksaan}</td>
                                                                    <td className="py-2 px-2 text-center font-semibold text-slate-800">{d.nilai || "—"}</td>
                                                                    <td className="py-2 px-2 text-center text-slate-400 text-xs">{d.satuan}</td>
                                                                    <td className="py-2 pl-2 text-slate-400 text-xs">{d.nilai_rujukan}</td>
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* INPUT HASIL TAB */}
                    {tab === "input" && (
                        <div className="max-w-3xl mx-auto space-y-5">
                            {!noorderSelected ? (
                                <div className="flex flex-col items-center justify-center py-16 text-slate-300 gap-2">
                                    <FlaskConical className="w-12 h-12 opacity-30" />
                                    <p className="text-sm">Pilih permintaan di tab "Daftar Permintaan" lalu klik "Input Hasil"</p>
                                </div>
                            ) : (
                                <div className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="font-semibold text-slate-700">
                                            Input Hasil Lab &mdash; <span className="font-mono text-purple-600">#{noorderSelected}</span>
                                        </h3>
                                        <button onClick={() => { setNoorderSelected(""); setTemplates([]); setTab("permintaan"); }}
                                            className="text-slate-400 hover:text-slate-600"><X className="w-4 h-4" /></button>
                                    </div>

                                    {loadingTemplate ? (
                                        <div className="flex justify-center py-8 text-slate-400 gap-2">
                                            <Loader2 className="w-5 h-5 animate-spin" />Memuat template...
                                        </div>
                                    ) : templates.length === 0 ? (
                                        <p className="text-sm text-slate-400 text-center py-4">
                                            Tidak ada template lab untuk jenis pemeriksaan ini.
                                        </p>
                                    ) : (
                                        <div className="space-y-3">
                                            {templates.map((t) => (
                                                <div key={t.id_template} className="grid grid-cols-5 gap-3 items-center p-3 bg-slate-50 rounded-lg">
                                                    <div className="col-span-2">
                                                        <div className="text-sm font-medium text-slate-700">{t.pemeriksaan}</div>
                                                        <div className="text-xs text-slate-400">{t.satuan} · Normal: {t.nilai_rujukan}</div>
                                                    </div>
                                                    <input
                                                        className="col-span-2 px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500 text-center font-semibold"
                                                        placeholder="Nilai hasil"
                                                        value={hasilForm[t.id_template]?.nilai ?? ""}
                                                        onChange={(e) => setHasilForm(f => ({
                                                            ...f, [t.id_template]: { ...f[t.id_template], nilai: e.target.value }
                                                        }))}
                                                    />
                                                    <input
                                                        className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-purple-500"
                                                        placeholder="Keterangan"
                                                        value={hasilForm[t.id_template]?.keterangan ?? ""}
                                                        onChange={(e) => setHasilForm(f => ({
                                                            ...f, [t.id_template]: { ...f[t.id_template], keterangan: e.target.value }
                                                        }))}
                                                    />
                                                </div>
                                            ))}

                                            <button onClick={handleSimpanHasil} disabled={savingHasil}
                                                className="w-full py-3 bg-purple-600 text-white rounded-xl font-semibold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors">
                                                {savingHasil ? <><Loader2 className="w-4 h-4 animate-spin" />Menyimpan...</> : <><Save className="w-4 h-4" />Simpan Hasil Lab</>}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    )}
                </main>
            </div>
        </div>
    );
}
