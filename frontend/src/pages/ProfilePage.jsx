import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { fmt } from "../dadu/constants";

export default function ProfilePage({ coins }) {
  const { user } = useAuth();

  const [cur, setCur] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [status, setStatus] = useState(null); // { type: "ok"|"err", msg }
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setStatus(null);
    if (next !== confirm) {
      setStatus({ type: "err", msg: "Konfirmasi password tidak cocok." });
      return;
    }
    setLoading(true);
    try {
      const token = localStorage.getItem("gf_token");
      const res = await fetch("/api/user/password", {
        method: "PATCH",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ currentPassword: cur, newPassword: next }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Terjadi kesalahan.");
      setStatus({ type: "ok", msg: "Password berhasil diubah." });
      setCur(""); setNext(""); setConfirm("");
    } catch (e) {
      setStatus({ type: "err", msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.root}>
      <div style={s.container}>

        {/* PROFILE CARD */}
        <div style={s.profileCard}>
          <div style={s.avatar}>{user?.username?.[0]?.toUpperCase()}</div>
          <div style={s.info}>
            <h2 style={s.username}>{user?.username}</h2>
            <span style={s.badge}>Member</span>
          </div>
          <div style={s.coinBox}>
            <span style={s.coinLabel}>Saldo Koin</span>
            <span style={s.coinValue}>🪙 {coins == null ? "—" : fmt(coins)}</span>
          </div>
        </div>

        {/* CHANGE PASSWORD */}
        <div style={s.section}>
          <h3 style={s.sectionTitle}>Ganti Password</h3>
          <form onSubmit={handleChangePassword} style={s.form}>
            <label style={s.label}>Password Lama</label>
            <input
              style={s.input}
              type="password"
              value={cur}
              onChange={(e) => setCur(e.target.value)}
              placeholder="Masukkan password lama"
              required
            />

            <label style={s.label}>Password Baru</label>
            <input
              style={s.input}
              type="password"
              value={next}
              onChange={(e) => setNext(e.target.value)}
              placeholder="Min. 6 karakter"
              required
            />

            <label style={s.label}>Konfirmasi Password Baru</label>
            <input
              style={s.input}
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              placeholder="Ulangi password baru"
              required
            />

            {status && (
              <p style={{ ...s.statusMsg, ...(status.type === "ok" ? s.statusOk : s.statusErr) }}>
                {status.type === "ok" ? "✓ " : "✕ "}{status.msg}
              </p>
            )}

            <button
              style={{ ...s.btn, ...(loading ? s.btnDisabled : {}) }}
              type="submit"
              disabled={loading}
            >
              {loading ? "Menyimpan…" : "Simpan Password"}
            </button>
          </form>
        </div>

      </div>
    </div>
  );
}

const C = {
  ink: "#14110E", panel: "#211C17",
  gold: "#D8A24A", goldHi: "#F2CB72", cream: "#F2EBDD",
  muted: "#9C8E78", line: "#3A322A",
  win: "#74C690", lose: "#DC7C68",
};

const s = {
  root: {
    padding: "40px 24px 60px",
    display: "flex", justifyContent: "center",
  },
  container: {
    width: "100%", maxWidth: 480,
    display: "flex", flexDirection: "column", gap: 24,
  },

  profileCard: {
    background: C.panel, border: `1px solid ${C.line}`,
    borderRadius: 20, padding: "24px 24px",
    display: "flex", alignItems: "center", gap: 18,
    flexWrap: "wrap",
  },
  avatar: {
    width: 60, height: 60, borderRadius: "50%", flexShrink: 0,
    background: `linear-gradient(135deg, ${C.goldHi}, ${C.gold})`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 26, color: C.ink,
  },
  info: { display: "flex", flexDirection: "column", gap: 6, flex: 1 },
  username: {
    fontFamily: "'Fraunces', serif", fontWeight: 700,
    fontSize: 22, color: C.cream, margin: 0,
  },
  badge: {
    display: "inline-block", fontSize: 10, fontWeight: 700,
    letterSpacing: "1.2px", textTransform: "uppercase",
    padding: "3px 10px", borderRadius: 999,
    background: `${C.gold}22`, color: C.goldHi,
    border: `1px solid ${C.gold}44`, width: "fit-content",
  },
  coinBox: {
    display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4,
  },
  coinLabel: { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" },
  coinValue: { fontSize: 18, fontWeight: 700, color: C.goldHi },

  section: {
    background: C.panel, border: `1px solid ${C.line}`,
    borderRadius: 20, padding: "24px",
  },
  sectionTitle: {
    fontFamily: "'Fraunces', serif", fontWeight: 600,
    fontSize: 18, color: C.cream, margin: "0 0 20px",
    paddingBottom: 14, borderBottom: `1px solid ${C.line}`,
  },
  form: { display: "flex", flexDirection: "column", gap: 4 },
  label: {
    fontSize: 11, textTransform: "uppercase",
    letterSpacing: "1.2px", color: C.muted,
    marginBottom: 4, marginTop: 14,
  },
  input: {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    background: C.ink, border: `1px solid ${C.line}`,
    color: C.cream, fontSize: 14, outline: "none",
    boxSizing: "border-box",
  },
  statusMsg: {
    fontSize: 13, borderRadius: 8, padding: "10px 12px",
    marginTop: 8,
  },
  statusOk: {
    color: C.win, background: "#74C69018", border: `1px solid ${C.win}44`,
  },
  statusErr: {
    color: C.lose, background: "#DC7C6818", border: `1px solid ${C.lose}44`,
  },
  btn: {
    width: "100%", marginTop: 20, padding: "13px 0",
    border: "none", borderRadius: 12, cursor: "pointer",
    fontFamily: "'Fraunces', serif", fontWeight: 600,
    fontSize: 15, color: C.ink,
    background: `linear-gradient(135deg, ${C.goldHi}, ${C.gold})`,
  },
  btnDisabled: { opacity: 0.5, cursor: "not-allowed" },
};
