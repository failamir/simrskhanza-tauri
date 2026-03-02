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
    List,
} from "lucide-react";
import { Link, useLocation } from "react-router-dom";
import clsx from "clsx";
import { useSession } from "../App";

interface MenuItem {
    icon: any;
    label: string;
    path: string;
    roles?: string[]; // Arrays of job titles/keywords allowed
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
            { icon: ClipboardList, label: "Registrasi & Jadwal", path: "/registrasi", roles: ["pendaftaran", "admin", "rekam medis", "kasir"] },
            { icon: List, label: "Antrian Loket", path: "/antrian", roles: ["pendaftaran", "admin", "rekam medis", "kasir"] },
            { icon: Stethoscope, label: "Rawat Jalan (Poliklinik)", path: "/ralan", roles: ["dokter", "perawat", "admin", "klinik", "poli"] },
            { icon: BedDouble, label: "Rawat Inap (Bangsal)", path: "/ranap", roles: ["dokter", "perawat", "admin", "ranap", "ruang"] },
            { icon: Building2, label: "IGD & Gawat Darurat", path: "/igd", roles: ["dokter", "perawat", "admin", "igd"] },
        ]
    },
    {
        title: "Pelayanan Medis",
        items: [
            { icon: Stethoscope, label: "Rekam Medis (RME)", path: "/rme", roles: ["dokter", "perawat", "admin", "rekam medis", "poli"] },
            { icon: Syringe, label: "Tranfusi Darah", path: "/tranfusi", roles: ["admin", "perawat", "laborat"] },
            { icon: TestTube, label: "Laboratorium", path: "/lab", roles: ["laborat", "admin"] },
            { icon: Activity, label: "Radiologi", path: "/radiologi", roles: ["radiologi", "admin"] },
        ]
    },
    {
        title: "Penunjang & Operasional",
        items: [
            { icon: Users, label: "Kepegawaian", path: "/kepegawaian", roles: ["hrd", "manajemen", "admin", "personalia"] },
            { icon: Wallet, label: "Kasir & Billing", path: "/kasir", roles: ["kasir", "manajemen", "admin", "keuangan"] },
            { icon: Pill, label: "Farmasi & Obat", path: "/farmasi", roles: ["apoteker", "farmasi", "admin"] },
            { icon: Package, label: "Aset & Inventaris", path: "/inventaris", roles: ["logistik", "admin", "gudang", "inventaris"] },
            { icon: Wrench, label: "IPSRS (Maintenance)", path: "/ipsrs", roles: ["ipsrs", "admin", "teknisi"] },
            { icon: Car, label: "Manajemen Parkir", path: "/parkir", roles: ["satpam", "parkir", "admin"] },
            { icon: BookOpen, label: "Perpustakaan", path: "/perpustakaan", roles: ["perpus", "admin", "diklat"] },
            { icon: FileText, label: "Surat Menyurat", path: "/surat", roles: ["tata usaha", "admin", "sekretariat"] },
        ]
    },
    {
        title: "Pelaporan & Integrasi",
        items: [
            { icon: BarChart3, label: "Laporan", path: "/laporan", roles: ["manajemen", "direktur", "admin", "rekam medis", "keuangan"] },
            { icon: Info, label: "Informasi Publik", path: "/informasi" }, // open to all
            { icon: Link2, label: "Bridging (BPJS)", path: "/bridging", roles: ["casemix", "admin", "pendaftaran", "kasir"] },
            { icon: QrCode, label: "Barcode System", path: "/barcode", roles: ["admin", "rekam medis"] },
            { icon: MessageSquare, label: "SMS Gateway", path: "/sms", roles: ["admin", "humas"] },
            { icon: DatabaseBackup, label: "Backup & Restore", path: "/backup", roles: ["admin"] },
            { icon: Settings, label: "Pengaturan & User", path: "/settings", roles: ["admin"] },
        ]
    }
];

export function Sidebar({ onLogout }: { onLogout: () => void }) {
    const location = useLocation();
    const { user } = useSession();

    // Check if item is allowed for current user
    const isAllowed = (item: MenuItem) => {
        if (!item.roles || item.roles.length === 0) return true; // public
        if (!user) return false;

        const uLevel = user.level.toLowerCase();
        const uJab = user.jabatan.toLowerCase();

        // Admin overrides all
        if (uLevel === "admin" || uJab.includes("admin") || uJab.includes("administrator")) {
            return true;
        }

        return item.roles.some((r) => {
            const rLow = r.toLowerCase();
            return uJab.includes(rLow) || uLevel.includes(rLow);
        });
    };

    return (
        <aside className="w-64 bg-white border-r border-slate-200 hidden md:flex flex-col h-full">
            <div className="p-6 border-b border-slate-100 flex items-center gap-3">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white font-bold shadow-sm">
                    K
                </div>
                <div>
                    <div className="font-bold text-slate-800 leading-tight">SIMRS Khanza</div>
                    <div className="text-[10px] text-slate-400 font-medium font-mono truncate w-40">
                        {user ? `${user.jabatan}` : "Tauri Edition"}
                    </div>
                </div>
            </div>

            <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
                {menuGroups.map((group, groupIndex) => {
                    // Filter items within group
                    const allowedItems = group.items.filter(isAllowed);
                    if (allowedItems.length === 0) return null;

                    return (
                        <div key={groupIndex}>
                            <div className="px-3 mb-2 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                                {group.title}
                            </div>
                            <div className="space-y-0.5">
                                {allowedItems.map((item, itemIndex) => {
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
                    );
                })}
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
