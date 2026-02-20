import { Menu } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { Sidebar } from "../components/Sidebar";

export function Dashboard() {
    const navigate = useNavigate();

    const handleLogout = () => {
        // Clear session logic here
        navigate("/");
    };

    return (
        <div className="flex h-screen bg-slate-50">
            {/* Sidebar */}
            <Sidebar onLogout={handleLogout} />

            {/* Main Content */}
            <div className="flex-1 flex flex-col overflow-hidden">
                <header className="bg-white border-b border-slate-200 h-16 flex items-center px-6 justify-between">
                    <button className="md:hidden p-2 text-slate-600">
                        <Menu className="w-6 h-6" />
                    </button>
                    <div className="flex items-center gap-4 ml-auto">
                        <div className="text-right">
                            <div className="text-sm font-semibold text-slate-800">Administrator</div>
                            <div className="text-xs text-slate-500">IT Department</div>
                        </div>
                        <div className="w-10 h-10 bg-slate-200 rounded-full"></div>
                    </div>
                </header>

                <main className="flex-1 overflow-y-auto p-6">
                    <div className="max-w-7xl mx-auto space-y-6">
                        <h1 className="text-2xl font-bold text-slate-800">Dashboard Overview</h1>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-slate-500 text-sm font-medium">Total Pasien</h3>
                                <div className="text-3xl font-bold text-slate-800 mt-2">1,234</div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-slate-500 text-sm font-medium">Rawat Jalan</h3>
                                <div className="text-3xl font-bold text-blue-600 mt-2">856</div>
                            </div>
                            <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
                                <h3 className="text-slate-500 text-sm font-medium">Rawat Inap</h3>
                                <div className="text-3xl font-bold text-emerald-600 mt-2">378</div>
                            </div>
                        </div>
                    </div>
                </main>
            </div>
        </div>
    );
}
