import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    List, RefreshCw, Bell, CheckCircle, Clock,
    User, Stethoscope,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import clsx from "clsx";

interface AntrianLoket {
    no_rawat: string;
    nm_pasien: string;
    no_rkm_medis: string;
    nm_poli: string;
    png_jawab: string;
    status: string;
    jam_masuk: string;
    no_antrian: number | null;
}

const statusConfig = {
    menunggu: { label: "Menunggu", color: "bg-amber-100 text-amber-700", dot: "bg-amber-400" },
    dipanggil: { label: "Dipanggil", color: "bg-blue-100 text-blue-700", dot: "bg-blue-500 animate-pulse" },
    selesai: { label: "Selesai", color: "bg-emerald-100 text-emerald-700", dot: "bg-emerald-500" },
};

export function AntrianLoket() {
    const navigate = useNavigate();
    const [antrian, setAntrian] = useState<AntrianLoket[]>([]);
    const [loading, setLoading] = useState(false);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetch = useCallback(async () => {
        setLoading(true);
        try {
            const data = await invoke<AntrianLoket[]>("get_antrian_hari_ini");
            setAntrian(data);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, []);

    useEffect(() => {
        fetch();
        const interval = setInterval(fetch, 30000); // auto-refresh 30s
        return () => clearInterval(interval);
    }, [fetch]);

    const handlePanggil = async (no_rawat: string) => {
        setActionLoading(no_rawat);
        try {
            await invoke("panggil_antrian", { noRawat: no_rawat });
            fetch();
        } catch (e) { console.error(e); }
        finally { setActionLoading(null); }
    };

    const handleSelesai = async (no_rawat: string) => {
        setActionLoading(no_rawat);
        try {
            await invoke("selesai_antrian", { noRawat: no_rawat });
            fetch();
        } catch (e) { console.error(e); }
        finally { setActionLoading(null); }
    };

    const menunggu = antrian.filter((a) => a.status === "menunggu");
    const dipanggil = antrian.filter((a) => a.status === "dipanggil");
    const selesai = antrian.filter((a) => a.status === "selesai");

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar onLogout={() => navigate("/")} />
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-slate-200 px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 bg-amber-100 rounded-lg flex items-center justify-center">
                            <List className="w-4 h-4 text-amber-600" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-slate-800">Antrian Loket</h1>
                            <p className="text-xs text-slate-400">
                                Hari ini · {antrian.length} total · {menunggu.length} menunggu
                            </p>
                        </div>
                    </div>
                    <button
                        onClick={fetch}
                        className="p-2 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                        title="Refresh"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                    </button>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    {/* Stats row */}
                    <div className="grid grid-cols-3 gap-4 mb-6">
                        {[
                            { label: "Menunggu", count: menunggu.length, color: "text-amber-600", bg: "bg-amber-50", icon: Clock },
                            { label: "Dipanggil", count: dipanggil.length, color: "text-blue-600", bg: "bg-blue-50", icon: Bell },
                            { label: "Selesai", count: selesai.length, color: "text-emerald-600", bg: "bg-emerald-50", icon: CheckCircle },
                        ].map(({ label, count, color, bg, icon: Icon }) => (
                            <div key={label} className={`${bg} rounded-xl p-4 flex items-center gap-3`}>
                                <Icon className={`w-5 h-5 ${color}`} />
                                <div>
                                    <div className={`text-2xl font-bold ${color}`}>{count}</div>
                                    <div className="text-xs text-slate-500">{label}</div>
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* Antrian table */}
                    <div className="bg-white rounded-xl border border-slate-200 overflow-hidden shadow-sm">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="bg-slate-50 border-b border-slate-200">
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">No.</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Pasien</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Poliklinik</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Penjamin</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Masuk</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Status</th>
                                    <th className="text-left px-4 py-3 font-semibold text-slate-500 text-xs uppercase tracking-wider">Aksi</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-slate-400">
                                            <RefreshCw className="w-6 h-6 animate-spin mx-auto mb-2" />
                                            Memuat antrian...
                                        </td>
                                    </tr>
                                ) : antrian.length === 0 ? (
                                    <tr>
                                        <td colSpan={7} className="text-center py-12 text-slate-400">
                                            <List className="w-8 h-8 mx-auto mb-2 opacity-30" />
                                            Belum ada antrian hari ini
                                        </td>
                                    </tr>
                                ) : (
                                    antrian.map((a) => {
                                        const sc = statusConfig[a.status as keyof typeof statusConfig] || statusConfig.menunggu;
                                        const isLoading = actionLoading === a.no_rawat;
                                        return (
                                            <tr key={a.no_rawat} className={clsx(
                                                "border-b border-slate-100 transition-colors",
                                                a.status === "dipanggil" ? "bg-blue-50" : "hover:bg-slate-50"
                                            )}>
                                                <td className="px-4 py-3">
                                                    <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center font-bold text-slate-600 text-sm">
                                                        {a.no_antrian ?? "—"}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        <div className="w-7 h-7 bg-blue-100 rounded-full flex items-center justify-center shrink-0">
                                                            <User className="w-3.5 h-3.5 text-blue-500" />
                                                        </div>
                                                        <div>
                                                            <div className="font-medium text-slate-800">{a.nm_pasien || "—"}</div>
                                                            <div className="text-xs text-slate-400 font-mono">{a.no_rkm_medis}</div>
                                                        </div>
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-1 text-slate-600">
                                                        <Stethoscope className="w-3.5 h-3.5 text-slate-400" />
                                                        {a.nm_poli || "—"}
                                                    </div>
                                                </td>
                                                <td className="px-4 py-3 text-slate-500">{a.png_jawab || "—"}</td>
                                                <td className="px-4 py-3 text-slate-500 font-mono text-xs">{a.jam_masuk}</td>
                                                <td className="px-4 py-3">
                                                    <span className={clsx("inline-flex items-center gap-1.5 text-xs px-2 py-1 rounded-full font-medium", sc.color)}>
                                                        <span className={clsx("w-1.5 h-1.5 rounded-full", sc.dot)} />
                                                        {sc.label}
                                                    </span>
                                                </td>
                                                <td className="px-4 py-3">
                                                    <div className="flex items-center gap-2">
                                                        {a.status === "menunggu" && (
                                                            <button
                                                                onClick={() => handlePanggil(a.no_rawat)}
                                                                disabled={isLoading}
                                                                className="px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-medium hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1"
                                                            >
                                                                <Bell className="w-3 h-3" />
                                                                Panggil
                                                            </button>
                                                        )}
                                                        {a.status === "dipanggil" && (
                                                            <button
                                                                onClick={() => handleSelesai(a.no_rawat)}
                                                                disabled={isLoading}
                                                                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg text-xs font-medium hover:bg-emerald-700 disabled:opacity-50 flex items-center gap-1"
                                                            >
                                                                <CheckCircle className="w-3 h-3" />
                                                                Selesai
                                                            </button>
                                                        )}
                                                        {a.status === "selesai" && (
                                                            <span className="text-xs text-slate-400">Selesai</span>
                                                        )}
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>
                </main>
            </div>
        </div>
    );
}
