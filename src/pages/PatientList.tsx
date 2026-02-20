import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    Search,
    Users,
    ChevronLeft,
    ChevronRight,
    RefreshCw,
    User,
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

const PAGE_SIZE = 20;

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

    const fetchData = useCallback(async (q: string, p: number) => {
        setLoading(true);
        setError(null);
        try {
            const [data, count] = await Promise.all([
                invoke<Pasien[]>("get_patients", {
                    search: q,
                    limit: PAGE_SIZE,
                    offset: p * PAGE_SIZE,
                }),
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

    useEffect(() => {
        fetchData(search, page);
    }, [search, page, fetchData]);

    const handleSearch = () => {
        setSearch(searchInput);
        setPage(0);
    };

    const handleLogout = () => navigate("/");
    const totalPages = Math.ceil(total / PAGE_SIZE);

    const genderLabel = (jk: string) => {
        if (jk === "L") return { label: "Laki-laki", color: "bg-blue-100 text-blue-700" };
        if (jk === "P") return { label: "Perempuan", color: "bg-pink-100 text-pink-700" };
        return { label: jk || "-", color: "bg-slate-100 text-slate-600" };
    };

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar onLogout={handleLogout} />

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
                            <p className="text-xs text-slate-400">
                                {total.toLocaleString()} total pasien terdaftar
                            </p>
                        </div>
                    </div>

                    {/* Search */}
                    <div className="flex items-center gap-2">
                        <div className="relative">
                            <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                            <input
                                type="text"
                                value={searchInput}
                                onChange={(e) => setSearchInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                                placeholder="Cari nama, No. RM, KTP, telp..."
                                className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent w-72"
                            />
                        </div>
                        <button
                            onClick={handleSearch}
                            className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
                        >
                            Cari
                        </button>
                        <button
                            onClick={() => {
                                setSearchInput("");
                                setSearch("");
                                setPage(0);
                            }}
                            className="p-2 border border-slate-200 rounded-lg text-slate-500 hover:bg-slate-50 transition-colors"
                            title="Reset"
                        >
                            <RefreshCw className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                <div className="flex-1 flex overflow-hidden">
                    {/* Table area */}
                    <div className="flex-1 overflow-auto p-6">
                        {error && (
                            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
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
                                                        isActive
                                                            ? "bg-blue-50"
                                                            : "hover:bg-slate-50"
                                                    )}
                                                >
                                                    <td className="px-4 py-3 font-mono text-xs text-slate-700 font-medium">{p.no_rkm_medis}</td>
                                                    <td className="px-4 py-3 font-medium text-slate-800">{p.nm_pasien || "-"}</td>
                                                    <td className="px-4 py-3">
                                                        <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium", g.color)}>
                                                            {g.label}
                                                        </span>
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
                                    >
                                        <ChevronLeft className="w-4 h-4" />
                                    </button>
                                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                                        const pg = Math.max(0, Math.min(page - 2, totalPages - 5)) + i;
                                        return (
                                            <button
                                                key={pg}
                                                onClick={() => setPage(pg)}
                                                className={clsx(
                                                    "w-9 h-9 rounded-lg text-sm font-medium transition-colors",
                                                    pg === page
                                                        ? "bg-blue-600 text-white"
                                                        : "border border-slate-200 text-slate-600 hover:bg-slate-100"
                                                )}
                                            >
                                                {pg + 1}
                                            </button>
                                        );
                                    })}
                                    <button
                                        onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                                        disabled={page >= totalPages - 1}
                                        className="p-2 border border-slate-200 rounded-lg text-slate-600 hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
                                    >
                                        <ChevronRight className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Detail panel (slide in when selected) */}
                    {selected && (
                        <div className="w-72 border-l border-slate-200 bg-white p-5 overflow-y-auto">
                            <div className="flex items-center justify-between mb-4">
                                <span className="font-semibold text-slate-700 text-sm">Detail Pasien</span>
                                <button
                                    onClick={() => setSelected(null)}
                                    className="text-slate-400 hover:text-slate-600 text-lg leading-none"
                                >
                                    ×
                                </button>
                            </div>

                            <div className="flex flex-col items-center mb-4 pt-2">
                                <div className={clsx(
                                    "w-16 h-16 rounded-full flex items-center justify-center mb-2",
                                    selected.jk === "L" ? "bg-blue-100" : "bg-pink-100"
                                )}>
                                    <User className={clsx("w-8 h-8", selected.jk === "L" ? "text-blue-500" : "text-pink-500")} />
                                </div>
                                <div className="font-semibold text-slate-800 text-center">{selected.nm_pasien}</div>
                                <div className="text-xs text-slate-400 font-mono">{selected.no_rkm_medis}</div>
                            </div>

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
                    )}
                </div>
            </div>
        </div>
    );
}
