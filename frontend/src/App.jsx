import React from "react";
import { AuthProvider, useAuth } from "./context/AuthContext";
import LoginPage from "./pages/LoginPage";
import Dashboard from "./pages/Dashboard";

function AppInner() {
  const { user, loading } = useAuth();

  if (loading) return <Splash />;
  if (!user) return <LoginPage />;
  return <Dashboard />;
}

export default function App() {
  return (
    <AuthProvider>
      <AppInner />
    </AuthProvider>
  );
}

function Splash() {
  return (
    <div style={{
      minHeight: "100vh", width: "100%",
      background: "radial-gradient(120% 90% at 50% -10%, #2a231b 0%, #14110E 55%)",
      display: "flex", alignItems: "center", justifyContent: "center",
    }}>
      <div style={{
        width: 42, height: 42, borderRadius: 10,
        background: "linear-gradient(145deg, #FBF7EE, #E7DEC9)",
        animation: "spin 1s linear infinite",
      }} />
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}
