import { useState, useEffect, useCallback, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
    Bell, AlertTriangle, CheckCircle2, Info,
    Loader2, X, ExternalLink, RefreshCw,
    FlaskConical, CreditCard, BedDouble, Siren, Users,
} from "lucide-react";
import clsx from "clsx";

interface Notifikasi {
    id: string; kategori: string; judul: string; pesan: string;
    waktu: string; level: string; link_to: string; data_ref: string;
}
interface NotifSummary {
    total: number; antrian_menunggu: number; lab_pending: number;
    billing_pending: number; ranap_baru: number; igd_belum_triase: number;
}

const levelConfig = {
    danger: { badge: "bg-red-500", icon: AlertTriangle, ring: "border-red-200 bg-red-50", text: "text-red-700", dot: "bg-red-400" },
    warning: { badge: "bg-amber-500", icon: AlertTriangle, ring: "border-amber-200 bg-amber-50", text: "text-amber-700", dot: "bg-amber-400" },
    info: { badge: "bg-blue-500", icon: Info, ring: "border-blue-200 bg-blue-50", text: "text-blue-700", dot: "bg-blue-400" },
    success: { badge: "bg-emerald-500", icon: CheckCircle2, ring: "border-emerald-200 bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-400" },
};

const kategoriIcon: Record<string, React.ElementType> = {
    antrian: Users, lab: FlaskConical, kasir: CreditCard,
    ranap: BedDouble, igd: Siren, bpjs: Info,
};

interface NotifBellProps {
    onNavigate: (path: string) => void;
}

export function NotificationBell({ onNavigate }: NotifBellProps) {
    const [open, setOpen] = useState(false);
    const [summary, setSummary] = useState<NotifSummary | null>(null);
    const [notifs, setNotifs] = useState<Notifikasi[]>([]);
    const [loading, setLoading] = useState(false);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());
    const ref = useRef<HTMLDivElement>(null);

    const fetchSummary = useCallback(async () => {
        try {
            const s = await invoke<NotifSummary>("get_notif_summary");
            setSummary(s);
        } catch { /* silently ignore if DB not connected */ }
    }, []);

    const fetchNotifs = useCallback(async () => {
        setLoading(true);
        try {
            const n = await invoke<Notifikasi[]>("get_notifikasi");
            setNotifs(n);
        } catch { setNotifs([]); }
        finally { setLoading(false); }
    }, []);

    // Poll summary every 30 seconds
    useEffect(() => {
        fetchSummary();
        const interval = setInterval(fetchSummary, 30_000);
        return () => clearInterval(interval);
    }, [fetchSummary]);

    // Fetch full list when panel opens
    useEffect(() => {
        if (open) fetchNotifs();
    }, [open, fetchNotifs]);

    // Close on outside click
    useEffect(() => {
        function handleClick(e: MouseEvent) {
            if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
        }
        if (open) document.addEventListener("mousedown", handleClick);
        return () => document.removeEventListener("mousedown", handleClick);
    }, [open]);

    const visible = notifs.filter(n => !dismissed.has(n.id));
    const count = (summary?.total ?? 0);

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen(o => !o)}
                className="relative p-2 text-slate-500 hover:text-slate-700 hover:bg-slate-100 rounded-xl transition-colors"
            >
                <Bell className="w-5 h-5" />
                {count > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                        {count > 99 ? "99+" : count}
                    </span>
                )}
            </button>

            {open && (
                <div className="absolute right-0 top-10 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 bg-slate-50 border-b border-slate-200">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-slate-600" />
                            <span className="font-semibold text-slate-700 text-sm">Notifikasi</span>
                            {count > 0 && (
                                <span className="bg-red-100 text-red-700 text-xs px-1.5 py-0.5 rounded-full font-bold">{count}</span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            <button onClick={fetchNotifs} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                                <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
                            </button>
                            <button onClick={() => setOpen(false)} className="p-1 text-slate-400 hover:text-slate-600 rounded-lg">
                                <X className="w-3.5 h-3.5" />
                            </button>
                        </div>
                    </div>

                    {/* Summary pills */}
                    {summary && summary.total > 0 && (
                        <div className="px-4 py-2 flex flex-wrap gap-1.5 border-b border-slate-100 bg-slate-50/50">
                            {[
                                { label: "Antrian", val: summary.antrian_menunggu, color: "bg-amber-100 text-amber-700" },
                                { label: "Lab", val: summary.lab_pending, color: "bg-blue-100 text-blue-700" },
                                { label: "Billing", val: summary.billing_pending, color: "bg-red-100 text-red-700" },
                                { label: "Ranap", val: summary.ranap_baru, color: "bg-emerald-100 text-emerald-700" },
                                { label: "IGD", val: summary.igd_belum_triase, color: "bg-rose-100 text-rose-700" },
                            ].filter(i => i.val > 0).map(({ label, val, color }) => (
                                <span key={label} className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${color}`}>
                                    {label}: {val}
                                </span>
                            ))}
                        </div>
                    )}

                    {/* Notif list */}
                    <div className="max-h-80 overflow-y-auto divide-y divide-slate-100">
                        {loading ? (
                            <div className="flex items-center justify-center py-8 gap-2 text-slate-400">
                                <Loader2 className="w-4 h-4 animate-spin" />
                                <span className="text-sm">Memuat notifikasi...</span>
                            </div>
                        ) : visible.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-10 text-slate-300 gap-2">
                                <CheckCircle2 className="w-8 h-8 opacity-40" />
                                <span className="text-sm">Semua sudah beres! 🎉</span>
                            </div>
                        ) : visible.map((n) => {
                            const cfg = levelConfig[n.level as keyof typeof levelConfig] || levelConfig.info;
                            const KIcon = kategoriIcon[n.kategori] || Bell;
                            return (
                                <div key={n.id} className={clsx("flex gap-3 px-4 py-3 hover:bg-slate-50 transition-colors border-l-2", cfg.ring)}>
                                    <div className={clsx("w-8 h-8 rounded-full flex items-center justify-center shrink-0 mt-0.5", cfg.ring)}>
                                        <KIcon className={`w-4 h-4 ${cfg.text}`} />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`text-xs font-bold uppercase tracking-wide ${cfg.text}`}>{n.judul}</span>
                                            {n.waktu && (
                                                <span className="text-[10px] text-slate-400 shrink-0">{n.waktu}</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-slate-600 mt-0.5 leading-snug">{n.pesan}</p>
                                        <div className="flex items-center gap-2 mt-1.5">
                                            <button
                                                onClick={() => { onNavigate(n.link_to); setOpen(false); }}
                                                className={clsx("text-[10px] font-semibold flex items-center gap-1 hover:underline", cfg.text)}
                                            >
                                                Buka <ExternalLink className="w-2.5 h-2.5" />
                                            </button>
                                            <button
                                                onClick={() => setDismissed(d => new Set([...d, n.id]))}
                                                className="text-[10px] text-slate-400 hover:text-slate-600"
                                            >
                                                Abaikan
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>

                    {visible.length > 0 && (
                        <div className="px-4 py-2 border-t border-slate-100 bg-slate-50">
                            <button
                                onClick={() => setDismissed(new Set(notifs.map(n => n.id)))}
                                className="text-xs text-slate-400 hover:text-slate-600 transition-colors"
                            >
                                Abaikan semua
                            </button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
