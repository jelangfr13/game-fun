import { useState } from "react";
import { useAuth } from "../context/AuthContext";

export default function LoginPage({ onSuccess }) {
  const { login } = useAuth();
  const [mode, setMode] = useState("login"); // 'login' | 'register'
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");
      login(data.token, data.user);
      onSuccess?.();
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const toggle = () => {
    setMode((m) => (m === "login" ? "register" : "login"));
    setError("");
    setUsername("");
    setPassword("");
  };

  return (
    <div style={s.root}>
      <style>{globalCss}</style>

      {/* Logo */}
      <div style={s.logo}>
        <div style={s.logoDie}>
          <span style={s.logoPip} />
          <span style={s.logoPip} />
          <span style={s.logoPip} />
        </div>
        <span style={s.logoText}>GameFun</span>
      </div>

      {/* Card */}
      <div style={s.card}>
        <h2 style={s.title}>{mode === "login" ? "Selamat datang" : "Buat akun baru"}</h2>
        <p style={s.sub}>
          {mode === "login"
            ? "Masuk untuk mulai bermain"
            : "Daftar dan mulai bermain gratis"}
        </p>

        <form onSubmit={submit} style={s.form}>
          <label style={s.label}>Username</label>
          <input
            style={s.input}
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            placeholder="Nama pengguna"
            autoFocus
            autoComplete="username"
            spellCheck={false}
            required
          />

          <label style={s.label}>Password</label>
          <input
            style={s.input}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={mode === "register" ? "Min. 6 karakter" : "Password"}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
          />

          {error && <p style={s.error}>{error}</p>}

          <button style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }} type="submit" disabled={loading}>
            {loading ? "Memproses…" : mode === "login" ? "Masuk" : "Daftar"}
          </button>
        </form>

        <p style={s.switchText}>
          {mode === "login" ? "Belum punya akun?" : "Sudah punya akun?"}
          <button style={s.switchBtn} onClick={toggle}>
            {mode === "login" ? " Daftar" : " Masuk"}
          </button>
        </p>
      </div>

      <p style={s.footer}>Hanya untuk hiburan · Tidak menggunakan uang nyata</p>
    </div>
  );
}

const C = {
  ink: "#14110E", panel: "#211C17", felt: "#2C1622",
  gold: "#D8A24A", goldHi: "#F2CB72", cream: "#F2EBDD",
  muted: "#9C8E78", line: "#3A322A", lose: "#DC7C68",
};

const s = {
  root: {
    minHeight: "100vh", width: "100%",
    background: "radial-gradient(120% 90% at 50% -10%, #2a231b 0%, #14110E 55%)",
    display: "flex", flexDirection: "column",
    alignItems: "center", justifyContent: "center",
    padding: "32px 16px", boxSizing: "border-box",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: C.cream,
  },
  logo: {
    display: "flex", alignItems: "center", gap: 12, marginBottom: 36,
  },
  logoDie: {
    width: 42, height: 42, borderRadius: 10,
    background: "linear-gradient(145deg, #FBF7EE, #E7DEC9)",
    boxShadow: "0 6px 14px -4px #000a",
    display: "grid", gridTemplateColumns: "repeat(3,1fr)",
    gridTemplateRows: "repeat(3,1fr)", padding: 6, gap: 3,
    alignItems: "center", justifyItems: "center",
  },
  logoPip: {
    width: 7, height: 7, borderRadius: "50%",
    background: "radial-gradient(circle at 35% 30%, #5a2a1c, #2a0f0a)",
  },
  logoText: {
    fontFamily: "'Fraunces', serif", fontWeight: 700,
    fontSize: 30, letterSpacing: 0.5, color: C.cream,
  },
  card: {
    width: "100%", maxWidth: 400,
    background: C.panel, border: `1px solid ${C.line}`,
    borderRadius: 20, padding: "28px 28px 24px",
    boxShadow: "0 30px 60px -20px #000",
  },
  title: {
    fontFamily: "'Fraunces', serif", fontWeight: 600,
    fontSize: 24, margin: "0 0 4px", color: C.cream,
  },
  sub: { color: C.muted, fontSize: 13, margin: "0 0 22px" },
  form: { display: "flex", flexDirection: "column", gap: 4 },
  label: { fontSize: 11, textTransform: "uppercase", letterSpacing: "1.2px", color: C.muted, marginBottom: 4, marginTop: 12 },
  input: {
    width: "100%", padding: "13px 14px", borderRadius: 12,
    background: C.ink, border: `1px solid ${C.line}`,
    color: C.cream, fontFamily: "'Space Mono', monospace",
    fontSize: 14, letterSpacing: 1, outline: "none",
    boxSizing: "border-box",
  },
  error: {
    color: C.lose, fontSize: 13, margin: "8px 0 0",
    padding: "10px 12px", background: "#dc7c6818",
    borderRadius: 8, border: `1px solid ${C.lose}44`,
  },
  btn: {
    width: "100%", marginTop: 20, padding: 14,
    border: "none", borderRadius: 12, cursor: "pointer",
    fontFamily: "'Fraunces', serif", fontWeight: 600,
    fontSize: 16, color: C.ink,
    background: `linear-gradient(180deg, ${C.goldHi}, ${C.gold})`,
    boxShadow: `0 8px 20px -8px ${C.gold}`,
    transition: "filter .15s ease",
  },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
  switchText: { textAlign: "center", color: C.muted, fontSize: 13, margin: "18px 0 0" },
  switchBtn: {
    background: "none", border: "none", cursor: "pointer",
    color: C.goldHi, fontWeight: 600, fontSize: 13, padding: 0,
  },
  footer: { color: C.muted, fontSize: 11, marginTop: 28, textAlign: "center" },
};

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=DM+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
  input:focus { border-color: #D8A24A !important; }
`;
