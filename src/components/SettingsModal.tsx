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
    const defaultProfile = { host: "localhost", port: 3306, user: "root", pass: "", dbname: "sik" };
    const [profiles, setProfiles] = useState<{ profile1: DbConfig, profile2: DbConfig }>({
        profile1: { ...defaultProfile },
        profile2: { ...defaultProfile }
    });
    const [activeProfile, setActiveProfile] = useState<"profile1" | "profile2">("profile1");

    const [status, setStatus] = useState<"idle" | "testing" | "success" | "error">("idle");
    const [message, setMessage] = useState("");

    useEffect(() => {
        if (!isOpen) return;

        const saved1 = localStorage.getItem("dbConfig_profile1");
        const saved2 = localStorage.getItem("dbConfig_profile2");
        let p1 = { ...defaultProfile };
        let p2 = { ...defaultProfile };

        if (saved1) {
            try { p1 = { ...p1, ...JSON.parse(saved1) }; } catch (e) { console.error(e); }
        }
        if (saved2) {
            try { p2 = { ...p2, ...JSON.parse(saved2) }; } catch (e) { console.error(e); }
        }

        const active = localStorage.getItem("dbConfig_active") as "profile1" | "profile2";
        if (active === "profile1" || active === "profile2") {
            setActiveProfile(active);
        }

        // Migration from old single config
        const legacy = localStorage.getItem("dbConfig");
        if (legacy && !saved1 && !saved2) {
            try { p1 = { ...p1, ...JSON.parse(legacy) }; } catch (e) { console.error(e); }
        }

        setProfiles({ profile1: p1, profile2: p2 });
        setStatus("idle");
        setMessage("");
    }, [isOpen]);

    if (!isOpen) return null;

    const config = profiles[activeProfile];

    const handleChange = (field: keyof DbConfig, value: string | number) => {
        setProfiles((prev) => ({
            ...prev,
            [activeProfile]: {
                ...prev[activeProfile],
                [field]: value
            }
        }));
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

            localStorage.setItem("dbConfig_profile1", JSON.stringify(profiles.profile1));
            localStorage.setItem("dbConfig_profile2", JSON.stringify(profiles.profile2));
            localStorage.setItem("dbConfig_active", activeProfile);
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
                    {/* Multi-profile Selector */}
                    <div className="flex bg-slate-100 p-1 rounded-lg">
                        <button
                            onClick={() => setActiveProfile("profile1")}
                            className={twMerge(
                                "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                                activeProfile === "profile1" ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                            )}
                        >
                            Setting 1
                        </button>
                        <button
                            onClick={() => setActiveProfile("profile2")}
                            className={twMerge(
                                "flex-1 py-1.5 text-sm font-medium rounded-md transition-all",
                                activeProfile === "profile2" ? "bg-white shadow text-blue-600" : "text-slate-500 hover:text-slate-700 hover:bg-slate-200/50"
                            )}
                        >
                            Setting 2
                        </button>
                    </div>

                    <div className="grid grid-cols-2 gap-4 pt-2">
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
                                onChange={(e) => handleChange("port", parseInt(e.target.value) || 3306)}
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
                            <span className="break-all">{message}</span>
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
