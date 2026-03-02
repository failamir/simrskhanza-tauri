import { useState, useEffect } from "react";
import { invoke } from "@tauri-apps/api/core";
import { Settings, Save, Database, X, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { twMerge } from "tailwind-merge";

interface DbConfig {
    host: string;
    port: number;
    user: string;
    pass: string;
    dbname: string;
}

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: () => void;
}

export function SettingsModal({ isOpen, onClose, onSave }: SettingsModalProps) {
    const [config, setConfig] = useState<DbConfig>({
        host: "localhost",
        port: 3306,
        user: "root",
        pass: "",
        dbname: "sik",
    });
    const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    useEffect(() => {
        const saved = localStorage.getItem("dbConfig");
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                setConfig({ ...config, ...parsed }); // Merge to ensure types
            } catch (e) {
                console.error("Failed to parse config", e);
            }
        }
    }, []);

    if (!isOpen) return null;

    const handleChange = (field: keyof DbConfig, value: string | number) => {
        setConfig((prev) => ({ ...prev, [field]: value }));
        setStatus("idle");
        setMessage("");
    };

    const testConnection = async () => {
        setStatus("testing");
        setMessage("Testing connection...");
        try {
            const res = await invoke<string>("test_connection", { config });
            setStatus("success");
            setMessage(res);
        } catch (err) {
            setStatus("error");
            setMessage(String(err));
        }
    };

    const saveConfig = async () => {
        setStatus("testing");
        try {
            await invoke("init_connection", { config });
            localStorage.setItem("dbConfig", JSON.stringify(config));
            setStatus("success");
            setMessage("Configuration saved and connected.");
            setTimeout(() => {
                onSave();
                onClose();
            }, 1000);
        } catch (err) {
            setStatus("error");
            setMessage(String(err));
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden animate-in fade-in zoom-in duration-200">
                <div className="flex items-center justify-between p-4 border-b">
                    <h2 className="text-lg font-semibold flex items-center gap-2 text-slate-800">
                        <Settings className="w-5 h-5 text-slate-500" />
                        Database Configuration
                    </h2>
                    <button onClick={onClose} className="text-slate-400 hover:text-slate-600">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500 uppercase">Host</label>
                            <input
                                type="text"
                                value={config.host}
                                onChange={(e) => handleChange("host", e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-slate-50"
                                placeholder="localhost"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500 uppercase">Port</label>
                            <input
                                type="number"
                                value={config.port}
                                onChange={(e) => handleChange("port", parseInt(e.target.value))}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-slate-50"
                                placeholder="3306"
                            />
                        </div>
                    </div>

                    <div className="space-y-1">
                        <label className="text-xs font-medium text-slate-500 uppercase">Database Name</label>
                        <input
                            type="text"
                            value={config.dbname}
                            onChange={(e) => handleChange("dbname", e.target.value)}
                            className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-slate-50"
                            placeholder="sik"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500 uppercase">Username</label>
                            <input
                                type="text"
                                value={config.user}
                                onChange={(e) => handleChange("user", e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-slate-50"
                                placeholder="root"
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-xs font-medium text-slate-500 uppercase">Password</label>
                            <input
                                type="password"
                                value={config.pass}
                                onChange={(e) => handleChange("pass", e.target.value)}
                                className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none text-slate-700 bg-slate-50"
                                placeholder="••••••"
                            />
                        </div>
                    </div>

                    {/* Status Message */}
                    {status !== "idle" && (
                        <div className={twMerge(
                            "flex items-center gap-2 text-sm p-3 rounded-lg",
                            status === "testing" && "bg-blue-50 text-blue-700",
                            status === "success" && "bg-green-50 text-green-700",
                            status === "error" && "bg-red-50 text-red-700"
                        )}>
                            {status === "testing" && <Loader2 className="w-4 h-4 animate-spin" />}
                            {status === "success" && <CheckCircle2 className="w-4 h-4" />}
                            {status === "error" && <AlertCircle className="w-4 h-4" />}
                            <span>{message}</span>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-50 border-t flex justify-between items-center text-sm">
                    <button
                        onClick={testConnection}
                        disabled={status === "testing"}
                        className="flex items-center gap-2 text-slate-600 hover:text-slate-900 font-medium px-3 py-2 rounded-lg hover:bg-slate-200 transition-colors"
                    >
                        <Database className="w-4 h-4" />
                        Test Connection
                    </button>
                    <button
                        onClick={saveConfig}
                        disabled={status === "testing"}
                        className="flex items-center gap-2 bg-blue-600 text-white hover:bg-blue-700 font-medium px-4 py-2 rounded-lg transition-colors shadow-sm disabled:opacity-50"
                    >
                        <Save className="w-4 h-4" />
                        Save & Connect
                    </button>
                </div>
            </div>
        </div>
    );
}
