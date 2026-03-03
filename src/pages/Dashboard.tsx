import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
    Users,
    LogOut, Search, X, ChevronDown,
    Calendar, Stethoscope, ShieldAlert, Timer,
    FlaskConical, Tablets, Microscope, FileText,
    ScanText, UserCog, Activity,
    ExternalLink, Download, HeartPulse, History,
    Settings, Pill, Building2, BookOpen,
    Car, Wrench, BarChart3,
    QrCode, Home, PackageOpen,
} from "lucide-react";
import { useSession } from "../App";

interface MenuItem {
    icon: any;
    label: string;
    path: string;
    group: number;
    color: string;
    bg: string;
}

const MENU_GROUPS = [
    "[A] Registrasi, Tagihan Ranap & Ralan, Pelayanan & Billing Pasien",
    "[B] Input Data Tindakan, Obat & BHP Via Barcode No.Rawat",
    "[C] Presensi, Manajemen & Penggajian Pegawai Rumah Sakit",
    "[D] Transaksi Inventory Obat, BHP Medis, Alat Kesehatan Pasien",
    "[E] Transaksi Inventory Barang Non Medis dan Penunjang ( Lab & RO )",
    "[F] Aset, Inventaris Barang & Instalasi Kesehatan Lingkungan",
    "[G] Menejemen Parkir Kendaraan Pasien & Karyawan",
    "[H] Olah Data Tagihan Rawat Inap & Rawat Jalan",
    "[I] Olah Data Penyakit, Laporan DKK, Laporan RL & Laporan Internal",
    "[J] Tarif Pelayanan, Menejemen Keuangan & Akuntansi",
    "[K] Bridging VClaim, Aplicare, PCare, INACBG, Kemenkes & Pihak Ke 3",
    "[L] Olah Data Pasien",
    "[M] Unit Pelayanan Tranfusi Darah",
    "[N] Analisa, Dashboard & Info Grafik",
    "[O] Manajemen Surat Masuk & Keluar",
    "[P] Manajemen Perpustakaan & Koleksi Pustaka Digital",
    "[Q] Pengaturan Program Aplikasi HMS",
];

const ALL_MENU_ITEMS: MenuItem[] = [
    // GROUP [A]
    { icon: Home, label: "Informasi Kamar", path: "/kamar", group: 0, color: "#3b82f6", bg: "#eff6ff" },
    { icon: Calendar, label: "Jadwal Praktek", path: "/jadwal", group: 0, color: "#10b981", bg: "#ecfdf5" },
    { icon: FileText, label: "Registrasi", path: "/registrasi", group: 0, color: "#f97316", bg: "#fff7ed" },
    { icon: Timer, label: "Booking Registrasi", path: "/booking", group: 0, color: "#f43f5e", bg: "#fff1f2" },
    { icon: ShieldAlert, label: "IGD/UGD", path: "/igd", group: 0, color: "#ef4444", bg: "#fef2f2" },
    { icon: Stethoscope, label: "Tindakan Ralan", path: "/ralan", group: 0, color: "#06b6d4", bg: "#ecfeff" },
    { icon: Home, label: "Kamar Inap", path: "/ranap", group: 0, color: "#6366f1", bg: "#eef2ff" },
    { icon: Activity, label: "Jadwal Operasi", path: "/operasi", group: 0, color: "#8b5cf6", bg: "#f5f3ff" },
    { icon: FlaskConical, label: "Permintaan Lab", path: "/lab", group: 0, color: "#f59e0b", bg: "#fffbeb" },
    { icon: Tablets, label: "Tarif Lab Andrologi", path: "/lab-andro", group: 0, color: "#ec4899", bg: "#fdf2f8" },
    { icon: Microscope, label: "Periksa Lab Andrologi", path: "/lab-andro-p", group: 0, color: "#a855f7", bg: "#faf5ff" },
    { icon: ScanText, label: "Permintaan Lab Andrologi", path: "/lab-andro-req", group: 0, color: "#d946ef", bg: "#fdf4ff" },
    { icon: ScanText, label: "Permintaan Radiologi", path: "/radiologi", group: 0, color: "#2563eb", bg: "#eff6ff" },
    { icon: UserCog, label: "DPJP Ranap", path: "/dpjp", group: 0, color: "#059669", bg: "#ecfdf5" },
    { icon: Activity, label: "Tindakan Ranap", path: "/ranap-tindakan", group: 0, color: "#4f46e5", bg: "#eef2ff" },
    { icon: HeartPulse, label: "Operasi/VK", path: "/operasi-vk", group: 0, color: "#e11d48", bg: "#fff1f2" },
    { icon: ExternalLink, label: "Rujukan Keluar", path: "/rujukan-keluar", group: 0, color: "#d97706", bg: "#fffbeb" },
    { icon: Download, label: "Rujukan Masuk", path: "/rujukan-masuk", group: 0, color: "#0d9488", bg: "#f0fdfa" },
    { icon: Pill, label: "Beri Obat/BHP", path: "/beri-obat", group: 0, color: "#dc2626", bg: "#fef2f2" },
    { icon: History, label: "Resep Pulang", path: "/resep-pulang", group: 0, color: "#1d4ed8", bg: "#eff6ff" },

    // GROUP [B]
    { icon: QrCode, label: "Barcode Ralan", path: "/barcode-ralan", group: 1, color: "#374151", bg: "#f9fafb" },
    { icon: QrCode, label: "Barcode Ranap", path: "/barcode-ranap", group: 1, color: "#374151", bg: "#f9fafb" },

    // GROUP [C]
    { icon: Users, label: "Data Pegawai", path: "/pegawai", group: 2, color: "#3b82f6", bg: "#eff6ff" },
    { icon: UserCog, label: "Data Dokter", path: "/dokter", group: 2, color: "#10b981", bg: "#ecfdf5" },
    { icon: QrCode, label: "Barcode Presensi", path: "/presensi", group: 2, color: "#f97316", bg: "#fff7ed" },

    // GROUP [D]
    { icon: Pill, label: "Obat & BHP", path: "/farmasi", group: 3, color: "#059669", bg: "#ecfdf5" },
    { icon: PackageOpen, label: "Stok Obat", path: "/stok", group: 3, color: "#2563eb", bg: "#eff6ff" },

    // GROUP [F]
    { icon: Building2, label: "Aset Rumah Sakit", path: "/aset", group: 5, color: "#4f46e5", bg: "#eef2ff" },
    { icon: Wrench, label: "Perbaikan Alat", path: "/ipsrs", group: 5, color: "#64748b", bg: "#f8fafc" },

    // GROUP [G]
    { icon: Car, label: "Manajemen Parkir", path: "/parkir", group: 6, color: "#374151", bg: "#f9fafb" },

    // GROUP [N]
    { icon: BarChart3, label: "Grafik Kunjungan", path: "/grafik", group: 13, color: "#2563eb", bg: "#eff6ff" },

    // GROUP [P]
    { icon: BookOpen, label: "Perpustakaan", path: "/perpustakaan", group: 15, color: "#b45309", bg: "#fffbeb" },

    // GROUP [Q]
    { icon: Settings, label: "Pengaturan Aplikasi", path: "/settings", group: 16, color: "#475569", bg: "#f8fafc" },
];

export function Dashboard() {
    const navigate = useNavigate();
    const { user, setUser } = useSession();
    const [selectedGroup, setSelectedGroup] = useState(0);
    const [searchQuery, setSearchQuery] = useState("");
    const [isSearchActive, setIsSearchActive] = useState(false);
    const [hoveredIdx, setHoveredIdx] = useState<number | null>(null);

    const filteredItems = useMemo(() => {
        if (isSearchActive && searchQuery.trim()) {
            return ALL_MENU_ITEMS.filter(item =>
                item.label.toLowerCase().includes(searchQuery.toLowerCase())
            );
        }
        return ALL_MENU_ITEMS.filter(item => item.group === selectedGroup);
    }, [selectedGroup, searchQuery, isSearchActive]);

    const handleLogout = () => {
        setUser(null);
        navigate("/");
    };

    return (
        <div style={{
            height: "100vh",
            width: "100vw",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column",
            background: "linear-gradient(160deg, #dbeafe 0%, #e0f2fe 30%, #d1fae5 70%, #ede9fe 100%)",
            fontFamily: "'Segoe UI', 'Tahoma', 'Geneva', Verdana, sans-serif",
        }}>
            {/* Honeycomb pattern via SVG background */}
            <div style={{
                position: "fixed",
                inset: 0,
                backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='84' height='48'%3E%3Cpath d='M0 24 L21 0 L63 0 L84 24 L63 48 L21 48 Z' fill='none' stroke='rgba(148,163,184,0.25)' stroke-width='1'/%3E%3Cpath d='M0 24 L-21 48 M0 24 L-21 0' fill='none' stroke='rgba(148,163,184,0.25)' stroke-width='1'/%3E%3C/svg%3E")`,
                backgroundSize: "84px 48px",
                pointerEvents: "none",
                zIndex: 0,
            }} />

            {/* Content */}
            <div style={{ position: "relative", zIndex: 1, display: "flex", flexDirection: "column", height: "100%" }}>

                {/* HEADER */}
                <header style={{
                    flexShrink: 0,
                    height: 56,
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    padding: "0 16px",
                    background: "rgba(255, 255, 255, 0.75)",
                    borderBottom: "1px solid rgba(203, 213, 225, 0.8)",
                    boxShadow: "0 1px 6px rgba(0,0,0,0.07)",
                }}>
                    {/* X button */}
                    <button onClick={() => window.location.reload()} style={{
                        width: 28, height: 28, borderRadius: 6, border: "none", background: "transparent",
                        cursor: "pointer", color: "#ef4444", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <X size={17} />
                    </button>

                    {/* Title */}
                    <span style={{ fontSize: 11, fontWeight: 700, color: "#64748b", letterSpacing: "0.1em", whiteSpace: "nowrap" }}>
                        ::[ Menu Utama ]::
                    </span>

                    <div style={{ width: 12 }} />

                    {/* Search or Dropdown */}
                    {isSearchActive ? (
                        <div style={{ flex: 1, position: "relative", maxWidth: 500 }}>
                            <Search size={13} style={{ position: "absolute", left: 9, top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                            <input
                                autoFocus
                                type="text"
                                placeholder="Cari menu..."
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                                style={{
                                    width: "100%", boxSizing: "border-box",
                                    padding: "6px 10px 6px 28px",
                                    border: "1.5px solid #93c5fd",
                                    borderRadius: 8, fontSize: 13,
                                    background: "#fff", outline: "none",
                                    color: "#1e293b",
                                }}
                            />
                        </div>
                    ) : (
                        <div style={{ flex: 1, display: "flex", alignItems: "center", gap: 8 }}>
                            <span style={{ fontSize: 12, fontWeight: 600, color: "#475569", whiteSpace: "nowrap" }}>
                                Tampilkan Menu :
                            </span>
                            <div style={{ position: "relative", flex: 1, maxWidth: 540 }}>
                                <select
                                    value={selectedGroup}
                                    onChange={e => setSelectedGroup(parseInt(e.target.value))}
                                    style={{
                                        width: "100%",
                                        appearance: "none",
                                        WebkitAppearance: "none",
                                        padding: "6px 32px 6px 10px",
                                        border: "1.5px solid #cbd5e1",
                                        borderRadius: 8, fontSize: 13,
                                        background: "#fff", outline: "none",
                                        cursor: "pointer", color: "#1e293b",
                                    }}
                                >
                                    {MENU_GROUPS.map((g, i) => (
                                        <option key={i} value={i}>{g}</option>
                                    ))}
                                </select>
                                <ChevronDown size={13} style={{
                                    position: "absolute", right: 8, top: "50%",
                                    transform: "translateY(-50%)", color: "#94a3b8", pointerEvents: "none",
                                }} />
                            </div>
                        </div>
                    )}

                    {/* Search toggle */}
                    <button
                        onClick={() => { setIsSearchActive(v => !v); setSearchQuery(""); }}
                        style={{
                            width: 32, height: 32, borderRadius: 8, border: "none",
                            background: isSearchActive ? "#3b82f6" : "rgba(241,245,249,0.9)",
                            color: isSearchActive ? "#fff" : "#64748b",
                            cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                            flexShrink: 0,
                        }}
                    >
                        <Search size={14} />
                    </button>

                    <div style={{ flex: 1 }} />

                    {/* User info */}
                    <div style={{ marginRight: 8, textAlign: "right" }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#1e293b", lineHeight: 1 }}>
                            {user?.nama || "USER"}
                        </div>
                        <div style={{ fontSize: 9, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
                            {user?.jabatan || "OFFICER"}
                        </div>
                    </div>

                    {/* Avatar */}
                    <div style={{
                        width: 32, height: 32, borderRadius: "50%",
                        background: "linear-gradient(135deg, #3b82f6, #6366f1)",
                        color: "#fff", display: "flex", alignItems: "center", justifyContent: "center",
                        fontWeight: 700, fontSize: 13, flexShrink: 0,
                        boxShadow: "0 2px 8px rgba(99,102,241,0.35)",
                    }}>
                        {(user?.nama || "U")[0].toUpperCase()}
                    </div>

                    {/* Logout */}
                    <button onClick={handleLogout} style={{
                        width: 32, height: 32, borderRadius: 8, border: "none",
                        background: "transparent", color: "#94a3b8",
                        cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
                    }}>
                        <LogOut size={16} />
                    </button>

                    {/* Padding spacer so it doesn't collide with App.tsx floating icons */}
                    <div style={{ width: 10 }} />
                </header>

                {/* MENU GRID */}
                <main style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
                    <div style={{
                        display: "grid",
                        gridTemplateColumns: "repeat(auto-fill, minmax(120px, 1fr))",
                        gap: 20,
                        maxWidth: 1400,
                        margin: "0 auto",
                    }}>
                        {filteredItems.map((item, idx) => {
                            const Icon = item.icon;
                            const isHovered = hoveredIdx === idx;
                            return (
                                <button
                                    key={`${item.path}-${idx}`}
                                    onClick={() => navigate(item.path)}
                                    onMouseEnter={() => setHoveredIdx(idx)}
                                    onMouseLeave={() => setHoveredIdx(null)}
                                    style={{
                                        display: "flex",
                                        flexDirection: "column",
                                        alignItems: "center",
                                        gap: 10,
                                        padding: "14px 10px",
                                        borderRadius: 16,
                                        border: `1.5px solid ${isHovered ? item.color + "60" : "rgba(203,213,225,0.7)"}`,
                                        background: isHovered ? item.bg : "rgba(255,255,255,0.75)",
                                        cursor: "pointer",
                                        transform: isHovered ? "translateY(-4px)" : "translateY(0)",
                                        transition: "transform 0.18s ease, box-shadow 0.18s ease, background 0.18s ease, border-color 0.18s ease",
                                        boxShadow: isHovered
                                            ? `0 8px 24px rgba(0,0,0,0.12), 0 2px 6px ${item.color}30`
                                            : "0 1px 4px rgba(0,0,0,0.06)",
                                    }}
                                >
                                    {/* Icon circle */}
                                    <div style={{
                                        width: 68, height: 68,
                                        borderRadius: 18,
                                        background: item.bg,
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        boxShadow: `inset 0 1px 3px rgba(0,0,0,0.05), 0 2px 8px ${item.color}25`,
                                        flexShrink: 0,
                                    }}>
                                        <Icon size={36} color={item.color} />
                                    </div>
                                    {/* Label */}
                                    <span style={{
                                        fontSize: 11.5,
                                        fontWeight: 700,
                                        color: isHovered ? item.color : "#334155",
                                        textAlign: "center",
                                        lineHeight: 1.35,
                                        transition: "color 0.18s ease",
                                    }}>
                                        {item.label}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </main>

                {/* FOOTER */}
                <footer style={{
                    flexShrink: 0,
                    padding: "10px 32px 14px",
                    background: "rgba(255,255,255,0.4)",
                    borderTop: "1px solid rgba(203,213,225,0.5)",
                }}>
                    <div style={{ fontSize: 20, fontWeight: 900, color: "rgba(71,85,105,0.15)", textTransform: "uppercase", letterSpacing: "0.18em", userSelect: "none" }}>
                        RUMAH SAKIT SADEWA DEVELOP
                    </div>
                    <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(71,85,105,0.25)", textTransform: "uppercase", letterSpacing: "0.15em", userSelect: "none" }}>
                        IT SADewa · Innovative Healthcare System · {new Date().getFullYear()}
                    </div>
                </footer>
            </div>
        </div>
    );
}
