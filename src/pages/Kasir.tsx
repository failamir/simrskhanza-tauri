import { useState, useEffect, useCallback } from "react";
import { invoke } from "@tauri-apps/api/core";
import { useNavigate } from "react-router-dom";
import {
    Wallet, RefreshCw, CheckCircle2, AlertCircle,
    Loader2, ChevronDown, ChevronUp, Receipt, TrendingUp,
    Clock, CreditCard, Printer,
} from "lucide-react";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import { Sidebar } from "../components/Sidebar";
import clsx from "clsx";

interface TagihanRow {
    no_rawat: string; nm_pasien: string; nm_poli: string; nm_dokter: string;
    tgl_registrasi: string; png_jawab: string; tipe: string;
    total_billing: number; sudah_bayar: boolean;
}
interface BillingItem {
    nm_perawatan: string; jumlah: number; biaya: number; totalbiaya: number; status: string;
}
interface SummaryKasir {
    total_masuk_hari_ini: number; jumlah_transaksi: number;
    total_ralan: number; total_ranap: number; pending_bayar: number;
}
interface RsSetting {
    nama_instansi: string; alamat_instansi: string; kabupaten: string;
    propinsi: string; kontak: string; email: string;
}

const statusColor: Record<string, string> = {
    Laborat: "bg-purple-100 text-purple-700",
    Obat: "bg-rose-100 text-rose-700",
    Kamar: "bg-teal-100 text-teal-700",
    Radiologi: "bg-blue-100 text-blue-700",
    Administrasi: "bg-slate-100 text-slate-600",
    Tagihan: "bg-indigo-100 text-indigo-700",
};

function rupiah(n: number) {
    return "Rp" + n.toLocaleString("id-ID");
}

export function Kasir() {
    const navigate = useNavigate();
    const today = new Date().toISOString().split("T")[0];
    const [tanggal, setTanggal] = useState(today);
    const [tagihanList, setTagihanList] = useState<TagihanRow[]>([]);
    const [summary, setSummary] = useState<SummaryKasir | null>(null);
    const [loading, setLoading] = useState(false);
    const [expanded, setExpanded] = useState<string | null>(null);
    const [expandedItems, setExpandedItems] = useState<BillingItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    const [processingId, setProcessingId] = useState<string | null>(null);
    const [printingId, setPrintingId] = useState<string | null>(null);
    const [toast, setToast] = useState<{ ok: boolean; text: string } | null>(null);
    const [filterBelum, setFilterBelum] = useState(false);

    const showToast = (ok: boolean, text: string) => {
        setToast({ ok, text });
        setTimeout(() => setToast(null), 3500);
    };

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const [tagihan, sum] = await Promise.all([
                invoke<TagihanRow[]>("get_tagihan_list", { tanggal }),
                invoke<SummaryKasir>("get_summary_kasir", { tanggal }),
            ]);
            setTagihanList(tagihan);
            setSummary(sum);
        } catch (e) { console.error(e); }
        finally { setLoading(false); }
    }, [tanggal]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const toggleExpand = async (noRawat: string) => {
        if (expanded === noRawat) { setExpanded(null); return; }
        setExpanded(noRawat);
        setLoadingItems(true);
        try {
            const items = await invoke<BillingItem[]>("get_billing_detail", { noRawat });
            setExpandedItems(items);
        } catch { setExpandedItems([]); }
        finally { setLoadingItems(false); }
    };

    const handleBayar = async (noRawat: string) => {
        setProcessingId(noRawat);
        try {
            const naNota = await invoke<string>("bayar_ralan", { noRawat });
            showToast(true, `Pembayaran berhasil! No Nota: ${naNota}`);
            fetchAll();
            setExpanded(null);
        } catch (e) { showToast(false, String(e)); }
        finally { setProcessingId(null); }
    };

    const handleCetakPDF = async (tagihan: TagihanRow, items: BillingItem[]) => {
        setPrintingId(tagihan.no_rawat);
        try {
            // Get RS config for header
            const rs = await invoke<RsSetting>("get_setting_rs");

            const doc = new jsPDF({
                orientation: "portrait",
                unit: "mm",
                format: "a4" // or 'a5' for receipt
            });

            const pageWidth = doc.internal.pageSize.width;

            // --- HEADER ---
            doc.setFont("helvetica", "bold");
            doc.setFontSize(14);
            doc.text(rs.nama_instansi, pageWidth / 2, 15, { align: "center" });

            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            doc.text(`${rs.alamat_instansi}, ${rs.kabupaten}, ${rs.propinsi}`, pageWidth / 2, 20, { align: "center" });
            doc.text(`Tlp: ${rs.kontak} | Email: ${rs.email}`, pageWidth / 2, 24, { align: "center" });

            doc.setLineWidth(0.5);
            doc.line(10, 27, pageWidth - 10, 27);

            // --- TITLE ---
            doc.setFont("helvetica", "bold");
            doc.setFontSize(11);
            doc.text("NOTA PEMBAYARAN RAWAT JALAN/INAP", pageWidth / 2, 35, { align: "center" });

            // --- PATIENT INFO ---
            doc.setFont("helvetica", "normal");
            doc.setFontSize(9);
            const startY = 45;
            doc.text(`No. Rawat : ${tagihan.no_rawat}`, 15, startY);
            doc.text(`Nama Pasien: ${tagihan.nm_pasien}`, 15, startY + 5);
            doc.text(`Poli / Ruang: ${tagihan.nm_poli}`, 15, startY + 10);

            doc.text(`Tgl Daftar : ${tagihan.tgl_registrasi}`, pageWidth - 15, startY, { align: "right" });
            doc.text(`Tipe Pasien: ${tagihan.png_jawab}`, pageWidth - 15, startY + 5, { align: "right" });
            doc.text(`Dokter : ${tagihan.nm_dokter}`, pageWidth - 15, startY + 10, { align: "right" });

            // --- TABLE DATA ---
            const tableBody = items.map((itm, i) => [
                (i + 1).toString(),
                itm.nm_perawatan,
                itm.status,
                rupiah(itm.totalbiaya)
            ]);

            const totalAmount = items.reduce((sum, item) => sum + item.totalbiaya, 0);

            autoTable(doc, {
                startY: startY + 15,
                head: [["No", "Nama Tindakan / Item", "Kategori", "Total Biaya"]],
                body: tableBody,
                theme: "grid",
                headStyles: { fillColor: [79, 70, 229] }, // Indigo 600
                styles: { fontSize: 8, cellPadding: 2 },
                columnStyles: {
                    0: { cellWidth: 10, halign: "center" },
                    2: { cellWidth: 30 },
                    3: { halign: "right", cellWidth: 40 }
                },
                foot: [
                    [{ content: "TOTAL TAGIHAN", colSpan: 3, styles: { halign: "right", fontStyle: "bold" } },
                    { content: rupiah(totalAmount), styles: { halign: "right", fontStyle: "bold" } }]
                ],
            });

            // --- FOOTER SIG ---
            const finalY = (doc as any).lastAutoTable.finalY + 15;
            doc.text("Petugas Kasir", pageWidth - 35, finalY, { align: "center" });
            doc.text("(_________________)", pageWidth - 35, finalY + 15, { align: "center" });

            // Otw Buka PDF
            doc.save(`Nota_${tagihan.no_rawat.replace(/\//g, "")}.pdf`);

        } catch (e) {
            showToast(false, `Gagal cetak: ${String(e)}`);
        } finally {
            setPrintingId(null);
        }
    };

    const displayed = filterBelum
        ? tagihanList.filter((t) => !t.sudah_bayar)
        : tagihanList;

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
                        <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                            <Wallet className="w-4 h-4 text-emerald-600" />
                        </div>
                        <div>
                            <h1 className="font-semibold text-slate-800">Kasir &amp; Billing</h1>
                            <p className="text-xs text-slate-400">
                                {tagihanList.length} transaksi · {tagihanList.filter(t => !t.sudah_bayar).length} belum dibayar
                            </p>
                        </div>
                    </div>
                    <div className="flex items-center gap-3">
                        <label className="flex items-center gap-2 text-sm text-slate-600 cursor-pointer">
                            <input type="checkbox" checked={filterBelum} onChange={(e) => setFilterBelum(e.target.checked)}
                                className="rounded" />
                            Hanya Belum Bayar
                        </label>
                        <input type="date" value={tanggal} onChange={(e) => setTanggal(e.target.value)}
                            className="px-3 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500" />
                        <button onClick={fetchAll} className="p-2 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
                        </button>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-5xl mx-auto space-y-5">
                        {/* Summary Cards */}
                        {summary && (
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                {[
                                    { label: "Total Pemasukan", val: rupiah(summary.total_masuk_hari_ini), icon: TrendingUp, color: "text-emerald-600", bg: "bg-emerald-50" },
                                    { label: "Transaksi Lunas", val: String(summary.jumlah_transaksi), icon: CheckCircle2, color: "text-blue-600", bg: "bg-blue-50" },
                                    { label: "Total Ralan", val: rupiah(summary.total_ralan), icon: Receipt, color: "text-indigo-600", bg: "bg-indigo-50" },
                                    { label: "Total Ranap", val: rupiah(summary.total_ranap), icon: CreditCard, color: "text-teal-600", bg: "bg-teal-50" },
                                    { label: "Pending Bayar", val: String(summary.pending_bayar), icon: Clock, color: "text-amber-600", bg: "bg-amber-50" },
                                ].map(({ label, val, icon: Icon, color, bg }) => (
                                    <div key={label} className={`${bg} rounded-xl p-4 border border-slate-200`}>
                                        <div className="flex items-center gap-2 mb-1">
                                            <Icon className={`w-4 h-4 ${color}`} />
                                            <span className="text-xs text-slate-500">{label}</span>
                                        </div>
                                        <div className={`text-lg font-bold ${color}`}>{val}</div>
                                    </div>
                                ))}
                            </div>
                        )}

                        {/* Tagihan List */}
                        {loading ? (
                            <div className="flex justify-center py-12 text-slate-400 gap-2">
                                <Loader2 className="w-5 h-5 animate-spin" />Memuat tagihan...
                            </div>
                        ) : displayed.length === 0 ? (
                            <div className="flex flex-col items-center py-12 text-slate-300 gap-2">
                                <Wallet className="w-10 h-10 opacity-40" /><span>Tidak ada tagihan</span>
                            </div>
                        ) : displayed.map((t) => {
                            const isExp = expanded === t.no_rawat;
                            return (
                                <div key={t.no_rawat} className={clsx(
                                    "bg-white rounded-xl border shadow-sm overflow-hidden",
                                    t.sudah_bayar ? "border-slate-200" : "border-amber-200 shadow-amber-50"
                                )}>
                                    <div className="flex items-center gap-4 px-5 py-4">
                                        <div className={clsx("w-10 h-10 rounded-full flex items-center justify-center shrink-0",
                                            t.sudah_bayar ? "bg-emerald-100" : "bg-amber-100")}>
                                            {t.sudah_bayar ? <CheckCircle2 className="w-5 h-5 text-emerald-600" /> : <Clock className="w-5 h-5 text-amber-600" />}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center gap-2">
                                                <span className="font-semibold text-slate-800">{t.nm_pasien}</span>
                                                <span className={clsx("text-xs px-2 py-0.5 rounded-full font-medium",
                                                    t.tipe === "Ranap" ? "bg-teal-100 text-teal-700" : "bg-indigo-100 text-indigo-700"
                                                )}>{t.tipe}</span>
                                            </div>
                                            <div className="text-xs text-slate-400 truncate">
                                                {t.nm_poli} · Dr. {t.nm_dokter} · {t.png_jawab}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-3 shrink-0">
                                            <div className="text-right">
                                                <div className="font-bold text-slate-800">{rupiah(t.total_billing)}</div>
                                                <div className="text-xs text-slate-400 font-mono">{t.no_rawat.slice(-6)}</div>
                                            </div>
                                            <button onClick={() => toggleExpand(t.no_rawat)}
                                                className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-lg">
                                                {isExp ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                                            </button>
                                        </div>
                                    </div>

                                    {isExp && (
                                        <div className="border-t border-slate-100 bg-slate-50 px-5 py-4 space-y-3">
                                            {loadingItems ? (
                                                <div className="flex items-center gap-2 text-slate-400 text-sm">
                                                    <Loader2 className="w-4 h-4 animate-spin" />Memuat rincian...
                                                </div>
                                            ) : expandedItems.length === 0 ? (
                                                <p className="text-sm text-slate-400">Belum ada rincian billing</p>
                                            ) : (
                                                <div className="space-y-1">
                                                    {/* Group by status */}
                                                    {Array.from(new Set(expandedItems.map(i => i.status))).map((grp) => (
                                                        <div key={grp}>
                                                            <div className={clsx("inline-block text-[10px] px-2 py-0.5 rounded-full font-semibold mb-1",
                                                                statusColor[grp] || "bg-slate-100 text-slate-600")}>
                                                                {grp}
                                                            </div>
                                                            {expandedItems.filter(i => i.status === grp).map((item, idx) => (
                                                                <div key={idx} className="flex justify-between text-sm py-1 border-b border-slate-100 last:border-0">
                                                                    <span className="text-slate-700">{item.nm_perawatan}</span>
                                                                    <span className="text-slate-500 font-mono">{rupiah(item.totalbiaya)}</span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    ))}
                                                    <div className="flex justify-between pt-2 border-t border-slate-200 font-semibold">
                                                        <span className="text-slate-700">Total</span>
                                                        <span className="text-emerald-700">{rupiah(expandedItems.reduce((s, i) => s + i.totalbiaya, 0))}</span>
                                                    </div>
                                                </div>
                                            )}

                                            {!t.sudah_bayar && (
                                                <button
                                                    onClick={() => handleBayar(t.no_rawat)}
                                                    disabled={processingId === t.no_rawat}
                                                    className="w-full py-2.5 bg-emerald-600 text-white rounded-lg text-sm font-semibold hover:bg-emerald-700 disabled:opacity-50 flex items-center justify-center gap-2 transition-colors"
                                                >
                                                    {processingId === t.no_rawat
                                                        ? <><Loader2 className="w-4 h-4 animate-spin" />Memproses...</>
                                                        : <><CreditCard className="w-4 h-4" />Proses Pembayaran</>
                                                    }
                                                </button>
                                            )}
                                            {t.sudah_bayar && (
                                                <div className="flex items-center justify-between mt-2 pt-3 border-t border-slate-200">
                                                    <div className="flex items-center gap-2 text-emerald-600 text-sm font-medium">
                                                        <CheckCircle2 className="w-4 h-4" /> Sudah dibayar lunas
                                                    </div>
                                                    <button
                                                        onClick={() => handleCetakPDF(t, expandedItems)}
                                                        disabled={printingId === t.no_rawat}
                                                        className="px-4 py-2 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 rounded-lg text-sm font-semibold transition-colors flex items-center gap-2"
                                                    >
                                                        {printingId === t.no_rawat ? <Loader2 className="w-4 h-4 animate-spin" /> : <Printer className="w-4 h-4" />}
                                                        Cetak Struk PDF
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </main>
            </div>
        </div>
    );
}
