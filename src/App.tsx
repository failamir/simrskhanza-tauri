import { useState, useEffect, createContext, useContext } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Settings } from "lucide-react";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { PatientList } from "./pages/PatientList";
import { Registrasi } from "./pages/Registrasi";
import { AntrianLoket } from "./pages/AntrianLoket";
import { RawatJalan } from "./pages/RawatJalan";
import { Farmasi } from "./pages/Farmasi";
import { SettingsModal } from "./components/SettingsModal";
import "./App.css";

// ─── Session Context ───────────────────────────────────────
export interface UserSession {
  id_user: string;
  nama: string;
  jabatan: string;
  level: string;
}

interface SessionCtx {
  user: UserSession | null;
  setUser: (u: UserSession | null) => void;
}

export const SessionContext = createContext<SessionCtx>({
  user: null,
  setUser: () => { },
});

export function useSession() {
  return useContext(SessionContext);
}

// ─── App ───────────────────────────────────────────────────
function AppContent() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [checking, setChecking] = useState(true);
  const [user, setUser] = useState<UserSession | null>(() => {
    const saved = localStorage.getItem("session");
    return saved ? JSON.parse(saved) : null;
  });

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem("dbConfig");
      if (saved) {
        try {
          const config = JSON.parse(saved);
          await invoke("init_connection", { config });
          setDbConnected(true);
        } catch {
          setDbConnected(false);
        }
      } else {
        setIsSettingsOpen(true);
      }
      setChecking(false);
    };
    init();
  }, []);

  const handleSetUser = (u: UserSession | null) => {
    setUser(u);
    if (u) localStorage.setItem("session", JSON.stringify(u));
    else localStorage.removeItem("session");
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="text-slate-500 text-sm">Menghubungkan ke database...</div>
      </div>
    );
  }

  return (
    <SessionContext.Provider value={{ user, setUser: handleSetUser }}>
      <div className="absolute top-4 right-4 z-40">
        <button
          onClick={() => setIsSettingsOpen(true)}
          className="p-2 bg-white/50 backdrop-blur rounded-full hover:bg-white text-slate-600 shadow-sm transition-all"
          title="Database Settings"
        >
          <Settings className="w-5 h-5" />
        </button>
      </div>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
        onSave={() => setDbConnected(true)}
      />

      <HashRouter>
        <Routes>
          <Route path="/" element={<Login />} />
          <Route
            path="/dashboard"
            element={dbConnected && user ? <Dashboard /> : <Navigate to="/" replace />}
          />
          <Route
            path="/pasien"
            element={dbConnected && user ? <PatientList /> : <Navigate to="/" replace />}
          />
          <Route
            path="/registrasi"
            element={dbConnected && user ? <Registrasi /> : <Navigate to="/" replace />}
          />
          <Route
            path="/antrian"
            element={dbConnected && user ? <AntrianLoket /> : <Navigate to="/" replace />}
          />
          <Route
            path="/ralan"
            element={dbConnected && user ? <RawatJalan /> : <Navigate to="/" replace />}
          />
          <Route
            path="/farmasi"
            element={dbConnected && user ? <Farmasi /> : <Navigate to="/" replace />}
          />
          <Route path="*" element={<Navigate to={user ? "/dashboard" : "/"} replace />} />
        </Routes>
      </HashRouter>
    </SessionContext.Provider>
  );
}

export default function App() {
  return <AppContent />;
}
