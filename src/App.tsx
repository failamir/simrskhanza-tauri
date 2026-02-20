import { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate } from "react-router-dom";
import { invoke } from "@tauri-apps/api/core";
import { Settings } from "lucide-react";
import { Login } from "./pages/Login";
import { Dashboard } from "./pages/Dashboard";
import { PatientList } from "./pages/PatientList";
import { SettingsModal } from "./components/SettingsModal";
import "./App.css";

function AppContent() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [dbConnected, setDbConnected] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    const init = async () => {
      const saved = localStorage.getItem("dbConfig");
      if (saved) {
        try {
          const config = JSON.parse(saved);
          await invoke("init_connection", { config });
          setDbConnected(true);
        } catch (e) {
          console.error("Failed to connect with saved config", e);
          setDbConnected(false);
          // Automatically open settings if connection fails on startup?
          // Maybe just show disconnected state.
        }
      } else {
        setIsSettingsOpen(true);
      }
      setChecking(false);
    };
    init();
  }, []);

  if (checking) {
    return <div className="min-h-screen flex items-center justify-center bg-slate-50">Loading...</div>;
  }

  return (
    <>
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
            element={dbConnected ? <Dashboard /> : <Navigate to="/" replace />}
          />
          <Route
            path="/pasien"
            element={dbConnected ? <PatientList /> : <Navigate to="/" replace />}
          />
        </Routes>
      </HashRouter>
    </>
  );
}

function App() {
  return <AppContent />;
}

export default App;
