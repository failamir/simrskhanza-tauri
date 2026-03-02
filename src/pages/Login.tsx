import { useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { LogIn, User, Lock, Loader2, AlertCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useSession, UserSession } from "../App";

export function Login() {
    const [user, setUser] = useState("");
    const [pass, setPass] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    const navigate = useNavigate();
    const { setUser: setSession } = useSession();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError("");
        try {
            const info = await invoke<UserSession>("check_login", { user, pass });
            setSession(info);
            navigate("/dashboard");
        } catch (err) {
            setError(String(err));
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-blue-600 via-blue-700 to-indigo-800 flex items-center justify-center p-4">
            <div className="w-full max-w-md">
                {/* Logo/Brand */}
                <div className="text-center mb-8">
                    <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl mx-auto flex items-center justify-center shadow-xl mb-4">
                        <span className="text-4xl font-black text-white">K</span>
                    </div>
                    <h1 className="text-3xl font-bold text-white">SIMRS Khanza</h1>
                    <p className="text-blue-200 text-sm mt-1">Sistem Informasi Manajemen Rumah Sakit</p>
                </div>

                {/* Card */}
                <div className="bg-white rounded-2xl shadow-2xl p-8 space-y-5">
                    <div className="text-center">
                        <h2 className="text-xl font-bold text-slate-800">Masuk ke Sistem</h2>
                        <p className="text-slate-400 text-sm mt-1">Silakan masukkan username dan password</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Username</label>
                            <div className="relative group">
                                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="text"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-700 text-sm"
                                    placeholder="Masukkan username"
                                    value={user}
                                    onChange={(e) => setUser(e.target.value)}
                                    required
                                    autoFocus
                                />
                            </div>
                        </div>

                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Password</label>
                            <div className="relative group">
                                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
                                <input
                                    type="password"
                                    className="w-full pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all text-slate-700 text-sm"
                                    placeholder="••••••••"
                                    value={pass}
                                    onChange={(e) => setPass(e.target.value)}
                                    required
                                />
                            </div>
                        </div>

                        {error && (
                            <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-100 p-3 rounded-lg">
                                <AlertCircle className="w-4 h-4 shrink-0" />
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-gradient-to-r from-blue-600 to-indigo-600 text-white font-semibold py-2.5 rounded-xl hover:shadow-lg hover:shadow-blue-500/30 active:scale-[0.98] transition-all disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2 text-sm"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Masuk...
                                </>
                            ) : (
                                <>
                                    <LogIn className="w-4 h-4" />
                                    Masuk
                                </>
                            )}
                        </button>
                    </form>
                </div>

                <p className="text-center text-blue-300 text-xs mt-6">
                    SIMRS Khanza Tauri Edition &copy; 2026
                </p>
            </div>
        </div>
    );
}
