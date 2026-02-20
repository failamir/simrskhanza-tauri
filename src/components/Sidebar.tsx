import {
    LayoutDashboard,
    Stethoscope,
    Syringe,
    TestTube,
    Activity,
    Users,
    Wallet,
    Pill,
    Package,
    Wrench,
    Car,
    BookOpen,
    FileText,
    BarChart3,
    Info,
    Link2,
    QrCode,
    LogOut,
    Settings,
    DatabaseBackup,
    MessageSquare,
    BedDouble,
    Building2,
    ClipboardList,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";

interface MenuItem {
    icon: any;
    label: string;
    path: string;
}

interface MenuGroup {
    title: string;
    items: MenuItem[];
}

const menuGroups: MenuGroup[] = [
    {
        title: "Utama",
        items: [
            { icon: LayoutDashboard, label: "Dashboard", path: "/dashboard" },
            { icon: Users, label: "Data Pasien", path: "/pasien" },
            { icon: ClipboardList, label: "Registrasi & Jadwal", path: "/registrasi" },
            { icon: Stethoscope, label: "Rawat Jalan (Poliklinik)", path: "/ralan" },
            { icon: BedDouble, label: "Rawat Inap (Bangsal)", path: "/ranap" },
            { icon: Building2, label: "IGD & Unit Gawat Darurat", path: "/igd" },
        ]
    },
    {
        title: "Pelayanan Medis",
        items: [
            { icon: Stethoscope, label: "Rekam Medis (RME)", path: "/rme" },
            { icon: Syringe, label: "Tranfusi Darah", path: "/tranfusi" },
            { icon: TestTube, label: "Permintaan Lab/Rad", path: "/permintaan" },
            { icon: Activity, label: "Grafik & Analisa", path: "/analisa" },
        ]
    },
    {
        title: "Penunjang & Operasional",
        items: [
            { icon: Users, label: "Kepegawaian", path: "/kepegawaian" },
            { icon: Wallet, label: "Keuangan & Billing", path: "/keuangan" },
            { icon: Pill, label: "Farmasi & Obat", path: "/farmasi" },
            { icon: Package, label: "Aset & Inventaris", path: "/inventaris" },
            { icon: Wrench, label: "IPSRS (Maintenance)", path: "/ipsrs" },
            { icon: Car, label: "Manajemen Parkir", path: "/parkir" },
            { icon: BookOpen, label: "Perpustakaan", path: "/perpustakaan" },
            { icon: FileText, label: "Surat Menyurat", path: "/surat" },
        ]
    },
    {
        title: "Pelaporan & Integrasi",
        items: [
            { icon: BarChart3, label: "Laporan", path: "/laporan" },
            { icon: Info, label: "Informasi Publik", path: "/informasi" },
            { icon: Link2, label: "Bridging (BPJS)", path: "/bridging" },
            { icon: QrCode, label: "Barcode System", path: "/barcode" },
            { icon: MessageSquare, label: "SMS Gateway", path: "/sms" },
            { icon: DatabaseBackup, label: "Backup & Restore", path: "/backup" },
            { icon: Settings, label: "Pengaturan & User", path: "/settings" },
        ]
    }
];

export function Sidebar({ onLogout }: { onLogout: () => void }) {
    const location = useLocation();

    return (
        <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
                    K
                </div>
                <div>
                    <div className="font-bold text-slate-800 leading-tight">SIMRS Khanza</div>
                    <div className="text-[10px] text-slate-400 font-medium">Tauri Edition</div>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
                {menuGroups.map((group, groupIndex) => (
                    <div key={groupIndex}>
                        <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                            {group.title}
                        </div>
                        <div className="space-y-0.5">
                            {group.items.map((item, itemIndex) => {
                                const isActive = location.pathname === item.path;
                                const Icon = item.icon;
                                return (
                                    <Link
                                        key={itemIndex}
                                        to={item.path}
                                        className={clsx(
                                            "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                                            isActive
                                                ? "bg-blue-50 text-blue-700"
                                                : "text-slate-600 hover:bg-slate-50 hover:text-slate-900"
                                        )}
                                    >
                                        <Icon className={clsx("w-4 h-4", isActive ? "text-blue-600" : "text-slate-400 group-hover:text-slate-600")} />
                                        {item.label}
                                    </Link>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </nav>

            <div className="p-4 border-t border-slate-100">
                <button
                    onClick={onLogout}
                    className="flex items-center gap-3 px-3 py-2 text-slate-600 hover:text-red-600 hover:bg-red-50 w-full transition-colors font-medium rounded-lg text-sm"
                >
                    <LogOut className="w-4 h-4" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
}
