import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    Users, BedDouble, ClipboardList, List,
    TrendingUp, RefreshCw, LogOut,
} from "lucide-react";
import { Sidebar } from "../components/Sidebar";
import { useSession } from "../App";

interface DashboardStats {
    total_pasien: number;
    kunjungan_ralan_hari_ini: number;
    pasien_ranap_aktif: number;
    antrian_menunggu: number;
}

export function Dashboard() {
    const navigate = useNavigate();
    const { user, setUser } = useSession();
    const [stats, setStats] = useState<DashboardStats | null>(null);
    const [loading, setLoading] = useState(true);

    const fetchStats = async () => {
        setLoading(true);
        try {
            const data = await invoke<DashboardStats>("get_dashboard_stats");
            setStats(data);
        } catch (e) {
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchStats(); }, []);

    const handleLogout = () => {
        setUser(null);
        navigate("/");
    };

    const cards = stats ? [
        {
            label: "Total Pasien Terdaftar",
            value: stats.total_pasien.toLocaleString("id-ID"),
            icon: Users,
            color: "bg-blue-500",
            bg: "bg-blue-50",
            text: "text-blue-600",
        },
        {
            label: "Kunjungan Ralan Hari Ini",
            value: stats.kunjungan_ralan_hari_ini.toLocaleString("id-ID"),
            icon: ClipboardList,
            color: "bg-emerald-500",
            bg: "bg-emerald-50",
            text: "text-emerald-600",
        },
        {
            label: "Pasien Rawat Inap Aktif",
            value: stats.pasien_ranap_aktif.toLocaleString("id-ID"),
            icon: BedDouble,
            color: "bg-violet-500",
            bg: "bg-violet-50",
            text: "text-violet-600",
        },
        {
            label: "Antrian Loket Menunggu",
            value: stats.antrian_menunggu.toLocaleString("id-ID"),
            icon: List,
            color: "bg-amber-500",
            bg: "bg-amber-50",
            text: "text-amber-600",
        },
    ] : [];

    return (
        <div className="flex h-screen bg-slate-50">
            <Sidebar onLogout={handleLogout} />

            <div className="flex-1 flex flex-col overflow-hidden">
                {/* Header */}
                <header className="bg-white border-b border-slate-200 h-16 flex items-center px-6 justify-between">
                    <div>
                        <h1 className="font-semibold text-slate-800">Dashboard</h1>
                        <p className="text-xs text-slate-400">
                            {new Date().toLocaleDateString("id-ID", { weekday: "long", year: "numeric", month: "long", day: "numeric" })}
                        </p>
                    </div>
                    <div className="flex items-center gap-3">
                        <button
                            onClick={fetchStats}
                            className="p-2 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Refresh data"
                        >
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                        <div className="text-right">
                            <div className="text-sm font-semibold text-slate-800">{user?.nama || "User"}</div>
                            <div className="text-xs text-slate-400">{user?.jabatan || ""}</div>
                        </div>
                        <div className="w-9 h-9 bg-gradient-to-br from-blue-500 to-indigo-600 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {(user?.nama || "U")[0].toUpperCase()}
                        </div>
                        <button
                            onClick={handleLogout}
                            className="p-2 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Keluar"
                        >
                            <LogOut className="w-4 h-4" />
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        {/* Stats Cards */}
                        {loading ? (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map((i) => (
                                    <div key={i} className="bg-white rounded-xl border border-slate-100 p-5 animate-pulse">
                                        <div className="h-4 bg-slate-200 rounded w-3/4 mb-3" />
                                        <div className="h-8 bg-slate-100 rounded w-1/2" />
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                                {cards.map((card) => {
                                    const Icon = card.icon;
                                    return (
                                        <div key={card.label} className="bg-white rounded-xl border border-slate-100 p-5 shadow-sm hover:shadow-md transition-shadow">
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-xs text-slate-500 font-medium leading-tight">{card.label}</p>
                                                <div className={`w-8 h-8 ${card.bg} rounded-lg flex items-center justify-center`}>
                                                    <Icon className={`w-4 h-4 ${card.text}`} />
                                                </div>
                                            </div>
                                            <div className={`text-3xl font-bold ${card.text}`}>{card.value}</div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* Quick Actions */}
                        <div>
                            <h2 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Akses Cepat</h2>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                {[
                                    { label: "Data Pasien", path: "/pasien", icon: Users, color: "text-blue-600", bg: "bg-blue-50 hover:bg-blue-100" },
                                    { label: "Registrasi Baru", path: "/registrasi", icon: ClipboardList, color: "text-emerald-600", bg: "bg-emerald-50 hover:bg-emerald-100" },
                                    { label: "Antrian Loket", path: "/antrian", icon: List, color: "text-amber-600", bg: "bg-amber-50 hover:bg-amber-100" },
                                    { label: "Laporan", path: "/laporan", icon: TrendingUp, color: "text-violet-600", bg: "bg-violet-50 hover:bg-violet-100" },
                                ].map((item) => {
                                    const Icon = item.icon;
                                    return (
                                        <button
                                            key={item.path}
                                            onClick={() => navigate(item.path)}
                                            className={`${item.bg} rounded-xl p-4 flex flex-col items-center gap-2 transition-colors`}
                                        >
                                            <Icon className={`w-6 h-6 ${item.color}`} />
                                            <span className={`text-sm font-medium ${item.color}`}>{item.label}</span>
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
