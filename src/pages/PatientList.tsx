import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    Search, Users, ChevronLeft, ChevronRight, RefreshCw,
    User, Plus, Pencil, X, Save, Loader2, CheckCircle2, AlertCircle,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import clsx from "clsx";

interface Pasien {
    no_rkm_medis: string;
    nm_pasien: string;
    jk: string;
    tgl_lahir: string;
    tmp_lahir: string;
    no_tlp: string;
    alamat: string;
    agama: string;
    stts_nikah: string;
    gol_darah: string;
    tgl_daftar: string;
    no_ktp: string;
}

interface PasienInput {
    nm_pasien: string;
    jk: string;
    tgl_lahir: string;
    tmp_lahir: string;
    no_tlp: string;
    alamat: string;
    agama: string;
    stts_nikah: string;
    gol_darah: string;
    no_ktp: string;
    pekerjaan: string;
    pendidikan: string;
    nm_ayah: string;
    nm_ibu_kandung: string;
}

const EMPTY_FORM: PasienInput = {
    nm_pasien: "", jk: "L", tgl_lahir: "", tmp_lahir: "",
    no_tlp: "", alamat: "", agama: "Islam", stts_nikah: "Belum Kawin",
    gol_darah: "", no_ktp: "", pekerjaan: "", pendidikan: "",
    nm_ayah: "", nm_ibu_kandung: "",
};

const PAGE_SIZE = 20;

// ─── Form Modal ────────────────────────────────────────────────────────────────
function PasienFormModal({
    mode,
    pasien,
    onClose,
    onSuccess,
}: {
    mode: "add" | "edit";
    pasien: Pasien | null;
    onClose: () => void;
    onSuccess: () => void;
}) {
    const [form, setForm] = useState<PasienInput>(() => {
        if (mode === "edit" && pasien) {
            // Convert date from dd-MM-yyyy to yyyy-MM-dd for input[type=date]
            const conv = (d: string) => {
                const p = d.split("-");
                return p.length === 3 && p[0].length === 2 ? `${p[2]}-${p[1]}-${p[0]}` : d;
            };
            return {
                nm_pasien: pasien.nm_pasien, jk: pasien.jk,
                tgl_lahir: conv(pasien.tgl_lahir), tmp_lahir: pasien.tmp_lahir,
                no_tlp: pasien.no_tlp, alamat: pasien.alamat, agama: pasien.agama,
                stts_nikah: pasien.stts_nikah, gol_darah: pasien.gol_darah,
                no_ktp: pasien.no_ktp,
                pekerjaan: "", pendidikan: "", nm_ayah: "", nm_ibu_kandung: "",
            };
        }
        return { ...EMPTY_FORM };
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");

    const set = (k: keyof PasienInput) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
        setForm((f) => ({ ...f, [k]: e.target.value }));

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!form.nm_pasien.trim()) { setError("Nama pasien wajib diisi."); return; }
        setLoading(true);
        setError("");
        try {
            // tgl_lahir in form is yyyy-MM-dd, backend expects dd-MM-yyyy
            const tglDb = form.tgl_lahir
                ? form.tgl_lahir.split("-").reverse().join("-")
                : "";
            const payload = { ...form, tgl_lahir: tglDb };

            if (mode === "add") {
                const noRm = await invoke<string>("add_patient", { pasien: payload });
                console.log("No. RM baru:", noRm);
            } else {
                await invoke<string>("update_patient", {
                    noRkmMedis: pasien!.no_rkm_medis,
                    pasien: payload,
                });
            }
            onSuccess();
            onClose();
        } catch (e) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    };

    const Field = ({
        label, id, children,
    }: { label: string; id: string; children: React.ReactNode }) => (
        <div className="space-y-1">
            <label htmlFor={id} className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</label>
            {children}
        </div>
    );

    const inputCls = "w-full px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500";

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            {mode === "add" ? <Plus className="w-4 h-4 text-blue-600" /> : <Pencil className="w-4 h-4 text-blue-600" />}
                        </div>
                        <div>
                            <h2 className="font-semibold text-slate-800">
                                {mode === "add" ? "Tambah Pasien Baru" : "Edit Data Pasien"}
                            </h2>
                            {mode === "edit" && pasien && (
                                <p className="text-xs text-slate-400">No. RM: {pasien.no_rkm_medis}</p>
                            )}
                        </div>
                    </div>
                    <button onClick={onClose} className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                {/* Body */}
                <form onSubmit={handleSubmit} className="overflow-y-auto px-6 py-5">
                    {error && (
                        <div className="flex items-center gap-2 mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                            <AlertCircle className="w-4 h-4 shrink-0" />
                            {error}
                        </div>
                    )}

                    <div className="grid grid-cols-2 gap-4">
                        {/* Nama */}
                        <div className="col-span-2">
                            <Field label="Nama Lengkap *" id="nm_pasien">
                                <input id="nm_pasien" className={inputCls} value={form.nm_pasien} onChange={set("nm_pasien")} placeholder="Nama lengkap pasien" required />
                            </Field>
                        </div>

                        {/* JK */}
                        <Field label="Jenis Kelamin" id="jk">
                            <select id="jk" className={inputCls} value={form.jk} onChange={set("jk")}>
                                <option value="L">Laki-laki</option>
                                <option value="P">Perempuan</option>
                            </select>
                        </Field>

                        {/* Gol Darah */}
                        <Field label="Golongan Darah" id="gol_darah">
                            <select id="gol_darah" className={inputCls} value={form.gol_darah} onChange={set("gol_darah")}>
                                <option value="">— Pilih —</option>
                                {["A", "B", "AB", "O", "A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"].map((g) => (
                                    <option key={g} value={g}>{g}</option>
                                ))}
                            </select>
                        </Field>

                        {/* Tgl Lahir */}
                        <Field label="Tanggal Lahir" id="tgl_lahir">
                            <input id="tgl_lahir" type="date" className={inputCls} value={form.tgl_lahir} onChange={set("tgl_lahir")} />
                        </Field>

                        {/* Tempat Lahir */}
                        <Field label="Tempat Lahir" id="tmp_lahir">
                            <input id="tmp_lahir" className={inputCls} value={form.tmp_lahir} onChange={set("tmp_lahir")} placeholder="Kota lahir" />
                        </Field>

                        {/* Agama */}
                        <Field label="Agama" id="agama">
                            <select id="agama" className={inputCls} value={form.agama} onChange={set("agama")}>
                                {["Islam", "Kristen", "Katolik", "Hindu", "Buddha", "Konghucu", "Lain-lain"].map((a) => (
                                    <option key={a} value={a}>{a}</option>
                                ))}
                            </select>
                        </Field>

                        {/* Status Nikah */}
                        <Field label="Status Nikah" id="stts_nikah">
                            <select id="stts_nikah" className={inputCls} value={form.stts_nikah} onChange={set("stts_nikah")}>
                                {["Belum Kawin", "Kawin", "Cerai Hidup", "Cerai Mati"].map((s) => (
                                    <option key={s} value={s}>{s}</option>
                                ))}
                            </select>
                        </Field>

                        {/* No. KTP */}
                        <Field label="No. KTP / NIK" id="no_ktp">
                            <input id="no_ktp" className={inputCls} value={form.no_ktp} onChange={set("no_ktp")} placeholder="16 digit NIK" maxLength={16} />
                        </Field>

                        {/* No. Telp */}
                        <Field label="No. Telepon" id="no_tlp">
                            <input id="no_tlp" className={inputCls} value={form.no_tlp} onChange={set("no_tlp")} placeholder="08xx..." />
                        </Field>

                        {/* Pekerjaan */}
                        <Field label="Pekerjaan" id="pekerjaan">
                            <input id="pekerjaan" className={inputCls} value={form.pekerjaan} onChange={set("pekerjaan")} placeholder="Pekerjaan" />
                        </Field>

                        {/* Pendidikan */}
                        <Field label="Pendidikan" id="pendidikan">
                            <select id="pendidikan" className={inputCls} value={form.pendidikan} onChange={set("pendidikan")}>
                                <option value="">— Pilih —</option>
                                {["Tidak Sekolah", "SD", "SMP", "SMA/K", "D3", "S1", "S2", "S3"].map((p) => (
                                    <option key={p} value={p}>{p}</option>
                                ))}
                            </select>
                        </Field>

                        {/* Nama Ayah */}
                        <Field label="Nama Ayah" id="nm_ayah">
                            <input id="nm_ayah" className={inputCls} value={form.nm_ayah} onChange={set("nm_ayah")} placeholder="Nama ayah" />
                        </Field>

                        {/* Nama Ibu Kandung */}
                        <Field label="Nama Ibu Kandung" id="nm_ibu_kandung">
                            <input id="nm_ibu_kandung" className={inputCls} value={form.nm_ibu_kandung} onChange={set("nm_ibu_kandung")} placeholder="Nama ibu kandung" />
                        </Field>

                        {/* Alamat */}
                        <div className="col-span-2">
                            <Field label="Alamat" id="alamat">
                                <textarea id="alamat" className={`${inputCls} resize-none`} rows={2} value={form.alamat} onChange={set("alamat")} placeholder="Alamat lengkap" />
                            </Field>
                        </div>
                    </div>
                </form>

                {/* Footer */}
                <div className="px-6 py-4 border-t border-slate-100 flex items-center justify-end gap-3">
                    <button type="button" onClick={onClose} className="px-4 py-2 border border-slate-200 text-slate-600 rounded-lg text-sm hover:bg-slate-50 transition-colors">
                        Batal
                    </button>
                    <button
                        onClick={handleSubmit as any}
                        disabled={loading}
                        className="px-5 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors disabled:opacity-50 flex items-center gap-2"
                    >
                        {loading
                            ? <><Loader2 className="w-4 h-4 animate-spin" />Menyimpan...</>
                            : <><Save className="w-4 h-4" />{mode === "add" ? "Simpan Pasien" : "Perbarui Data"}</>
                        }
                    </button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Page ────────────────────────────────────────────────────────────────
export function PatientList() {
    const navigate = useNavigate();
    const [patients, setPatients] = useState<Pasien[]>([]);
    const [total, setTotal] = useState(0);
    const [page, setPage] = useState(0);
    const [search, setSearch] = useState("");
    const [searchInput, setSearchInput] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [selected, setSelected] = useState<Pasien | null>(null);
    const [toast, setToast] = useState<string | null>(null);

    // Modal state
    const [modal, setModal] = useState<{ open: boolean; mode: "add" | "edit" }>({ open: false, mode: "add" });

    const fetchData = useCallback(async (q: string, p: number) => {
        setLoading(true);
        setError(null);
        try {
            const [data, count] = await Promise.all([
                invoke<Pasien[]>("get_patients", { search: q, limit: PAGE_SIZE, offset: p * PAGE_SIZE }),
                invoke<number>("count_patients", { search: q }),
            ]);
            setPatients(data);
            setTotal(count);
        } catch (e: any) {
            setError(String(e));
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchData(search, page); }, [search, page, fetchData]);

    const handleSearch = () => { setSearch(searchInput); setPage(0); };
    const handleReset = () => { setSearchInput(""); setSearch(""); setPage(0); };
    const handleLogout = () => navigate("/");
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const showToast = (msg: string) => {
        setToast(msg);
        setTimeout(() => setToast(null), 3000);
    };

    const handleModalSuccess = () => {
        showToast(modal.mode === "add" ? "Pasien berhasil ditambahkan!" : "Data pasien berhasil diperbarui!");
        setSelected(null);
        fetchData(search, page);
    };

    const genderLabel = (jk: string) => {
        if (jk === "L") return { label: "Laki-laki", color: "bg-blue-100 text-blue-700" };
        if (jk === "P") return { label: "Perempuan", color: "bg-pink-100 text-pink-700" };
        return { label: jk || "-", color: "bg-slate-100 text-slate-600" };
    };

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar onLogout={handleLogout} />

            {/* Modal */}
            {modal.open && (
                <PasienFormModal
                    mode={modal.mode}
                    pasien={modal.mode === "edit" ? selected : null}
                    onClose={() => setModal({ ...modal, open: false })}
                    onSuccess={handleModalSuccess}
                />
            )}

            {/* Toast */}
            {toast && (
                <div className="fixed bottom-6 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-lg text-sm font-medium animate-in fade-in slide-in-from-bottom-2">
                    <CheckCircle2 className="w-4 h-4" />
                    {toast}
                </div>
            )}

            {/* Main */}
            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-blue-100 rounded-lg flex items-center justify-center">
                            <Users className="w-4 h-4 text-blue-600" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-slate-800">Data Pasien</h1>
                            <p className="text-xs text-slate-400">{total.toLocaleString()} total pasien terdaftar</p>
                        </div>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Search */}
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                placeholder="Cari nama, No. RM, KTP, telp..."
                                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 w-64"
                            />
                        </div>
                        <button onClick={handleSearch} className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors">Cari</button>
                        <button onClick={handleReset} className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors" title="Reset"><RefreshCw className="w-4 h-4" /></button>
                        <div className="w-px h-6 bg-slate-200" />
                        <button
                            onClick={() => setModal({ open: true, mode: "add" })}
                            className="flex items-center gap-2 px-4 py-2 bg-emerald-600 text-white rounded-lg text-sm font-medium hover:bg-emerald-700 transition-colors"
                        >
                            <Plus className="w-4 h-4" />
                            Tambah Pasien
                        </button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* Table */}
                    <div className="flex-1 overflow-auto p-6">
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-center gap-2">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">No. RM</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Nama Pasien</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">JK</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Tgl. Lahir</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Alamat</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">No. Telp</th>
                                        <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Tgl. Daftar</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {loading ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-16 text-slate-400">
                                                <div className="flex flex-col items-center gap-2">
                                                    <RefreshCw className="w-6 h-6 animate-spin" />
                                                    <span>Memuat data...</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : patients.length === 0 ? (
                                        <tr>
                                            <td colSpan={7} className="text-center py-16 text-slate-400">
                                                <div className="flex flex-col items-center gap-2">
                                                    <Users className="w-8 h-8 opacity-30" />
                                                    <span>Tidak ada data pasien</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ) : (
                                        patients.map((p) => {
                                            const g = genderLabel(p.jk);
                                            const isActive = selected?.no_rkm_medis === p.no_rkm_medis;
                                            return (
                                                <tr
                                                    key={p.no_rkm_medis}
                                                    onClick={() => setSelected(isActive ? null : p)}
                                                    className={clsx(
                                                        "border-b border-slate-100 cursor-pointer transition-colors",
                                                        isActive ? "bg-blue-50" : "hover:bg-slate-50"
                                                    )}
                                                >
                                                    <td className="px-4 py-3 font-mono text-xs text-slate-700 font-medium">{p.no_rkm_medis}</td>
                                                    <td className="px-4 py-3 font-medium text-slate-800">{p.nm_pasien || "-"}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", g.color)}>{g.label}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-slate-600">{p.tgl_lahir || "-"}</td>
                                                    <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{p.alamat || "-"}</td>
                                                    <td className="px-4 py-3 text-slate-600">{p.no_tlp || "-"}</td>
                                                    <td className="px-4 py-3 text-slate-500">{p.tgl_daftar || "-"}</td>
                                                </tr>
                                            );
                                        })
                                    )}
                                </tbody>
                            </table>
                        </div>

                        {/* Pagination */}
                        {totalPages > 1 && (
                            <div className="mt-4 flex items-center justify-between">
                                <p className="text-sm text-slate-500">
                                    Halaman {page + 1} dari {totalPages} &mdash; {total.toLocaleString()} data
                                </p>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => setPage((p) => Math.max(0, p - 1))}
                                        disabled={page === 0}
                                        className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    ><ChevronLeft className="w-4 h-4" /></button>
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        const pg = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                                        return (
                                            <button
                                                key={pg}
                                                onClick={() => setPage(pg)}
                                                className={clsx(
                                                    "w-9 h-9 rounded-lg text-sm font-medium transition-colors",
                                                    pg === page ? "bg-blue-600 text-white" : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                                                )}
                                            >{pg + 1}</button>
                                        );
                                    })}
                                    <button
                                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1}
                                        className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    ><ChevronRight className="w-4 h-4" /></button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Detail panel */}
                    {selected && (
                        <div className="w-72 border-l border-slate-200 bg-white flex flex-col overflow-hidden">
                            <div className="p-5 border-b border-slate-100 flex items-center justify-between">
                                <span className="font-semibold text-slate-700 text-sm">Detail Pasien</span>
                                <button onClick={() => setSelected(null)} className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-5 space-y-4">
                                {/* Avatar */}
                                <div className="flex flex-col items-center pt-2">
                                    <div className={clsx(
                                        "w-16 h-16 rounded-full flex items-center justify-center mb-2",
                                        selected.jk === "L" ? "bg-blue-100" : "bg-pink-100"
                                    )}>
                                        <User className={clsx("w-8 h-8", selected.jk === "L" ? "text-blue-500" : "text-pink-500")} />
                                    </div>
                                    <div className="font-semibold text-slate-800 text-center">{selected.nm_pasien}</div>
                                    <div className="text-xs text-slate-400 font-mono">{selected.no_rkm_medis}</div>
                                </div>

                                {/* Fields */}
                                <div className="space-y-3">
                                    {[
                                        { label: "Jenis Kelamin", value: genderLabel(selected.jk).label },
                                        { label: "Tgl. Lahir", value: selected.tgl_lahir || "-" },
                                        { label: "Tempat Lahir", value: selected.tmp_lahir || "-" },
                                        { label: "Gol. Darah", value: selected.gol_darah || "-" },
                                        { label: "Agama", value: selected.agama || "-" },
                                        { label: "Sts. Nikah", value: selected.stts_nikah || "-" },
                                        { label: "No. KTP", value: selected.no_ktp || "-" },
                                        { label: "No. Telp", value: selected.no_tlp || "-" },
                                        { label: "Alamat", value: selected.alamat || "-" },
                                        { label: "Tgl. Daftar", value: selected.tgl_daftar || "-" },
                                    ].map((item) => (
                                        <div key={item.label}>
                                            <div className="text-xs text-slate-400 mb-0.5">{item.label}</div>
                                            <div className="text-sm text-slate-700 break-words">{item.value}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Edit button */}
                            <div className="p-4 border-t border-slate-100">
                                <button
                                    onClick={() => setModal({ open: true, mode: "edit" })}
                                    className="w-full flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                                >
                                    <Pencil className="w-4 h-4" />
                                    Edit Data Pasien
                                </button>
                            </div>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
