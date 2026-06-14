import React, { useState } from "react";
import { fmt } from "../dadu/constants";

const AMOUNTS = [5000, 10000, 20000, 50000, 100000];
const WA_LINK = "https://wa.me/6281387578552";

export default function TopUpPage({ onCoinsUpdated }) {
  const [stage, setStage] = useState(1);
  const [selected, setSelected] = useState(null);
  const [custom, setCustom] = useState("");
  const [code, setCode] = useState("");
  const [status, setStatus] = useState(null); // { type: "ok"|"err", msg }
  const [loading, setLoading] = useState(false);

  const amount = selected === "custom" ? (parseInt(custom, 10) || 0) : (selected || 0);
  const canNext = amount >= 1000;

  const handleRedeem = async () => {
    if (!code.trim()) {
      setStatus({ type: "err", msg: "Masukkan kode top-up terlebih dahulu." });
      return;
    }
    setLoading(true);
    setStatus(null);
    try {
      const token = localStorage.getItem("gf_token");
      const res = await fetch("/api/user/redeem", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ code: code.trim() }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Gagal memproses top-up.");
      setStatus({ type: "ok", msg: `Berhasil! +${fmt(data.amount)} koin ditambahkan ke akunmu.` });
      setCode("");
      onCoinsUpdated?.(data.coins);
    } catch (e) {
      setStatus({ type: "err", msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.root}>
      <div style={s.container}>

        <div style={s.header}>
          <h2 style={s.title}>Isi Koin</h2>
          <p style={s.sub}>Tambah saldo koinmu untuk terus bermain</p>
        </div>

        {/* STEP INDICATOR */}
        <div style={s.steps}>
          <div style={{ ...s.step, ...(stage >= 1 ? s.stepActive : {}) }}>
            <span style={s.stepNum}>1</span>
            <span style={s.stepLabel}>Pilih Jumlah</span>
          </div>
          <div style={s.stepLine} />
          <div style={{ ...s.step, ...(stage >= 2 ? s.stepActive : {}) }}>
            <span style={s.stepNum}>2</span>
            <span style={s.stepLabel}>Konfirmasi</span>
          </div>
        </div>

        {stage === 1 && (
          <div style={s.card}>
            <p style={s.cardLabel}>Pilih nominal top-up</p>
            <div style={s.grid}>
              {AMOUNTS.map((a) => (
                <button
                  key={a}
                  style={{ ...s.chip, ...(selected === a ? s.chipActive : {}) }}
                  onClick={() => { setSelected(a); setCustom(""); }}
                >
                  <span style={s.chipCoin}>🪙</span>
                  <span style={s.chipAmt}>{fmt(a)}</span>
                </button>
              ))}
              <button
                style={{ ...s.chip, ...(selected === "custom" ? s.chipActive : {}), ...s.chipFull }}
                onClick={() => setSelected("custom")}
              >
                ✏️ Nominal lain
              </button>
            </div>

            {selected === "custom" && (
              <>
                <label style={s.label}>Masukkan nominal</label>
                <input
                  style={s.input}
                  type="number"
                  min="1000"
                  placeholder="Min. 1.000 koin"
                  value={custom}
                  onChange={(e) => setCustom(e.target.value)}
                  autoFocus
                />
              </>
            )}

            <button
              style={{ ...s.btnGold, ...(!canNext ? s.btnDisabled : {}), marginTop: 8 }}
              onClick={() => canNext && setStage(2)}
              disabled={!canNext}
            >
              Lanjut →
            </button>
          </div>
        )}

        {stage === 2 && (
          <div style={s.card}>
            <div style={s.amountBox}>
              <span style={s.amountLabel}>Jumlah top-up</span>
              <span style={s.amountValue}>🪙 {fmt(amount)} koin</span>
            </div>

            <div style={s.waBox}>
              <p style={s.waTitle}>Langkah konfirmasi</p>
              <p style={s.waText}>
                Hubungi kami melalui WhatsApp untuk mengkonfirmasi top-up sebelum memasukkan kode:
              </p>
              <a href={WA_LINK} target="_blank" rel="noreferrer" style={s.waBtn}>
                💬 Hubungi via WhatsApp
              </a>
              <p style={s.waNote}>
                Setelah dikonfirmasi, kamu akan mendapatkan kode top-up. Masukkan di bawah ini.
              </p>
            </div>

            <label style={s.label}>Kode Top-up</label>
            <input
              style={s.input}
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !loading && handleRedeem()}
              placeholder="Masukkan kode top-up"
              autoFocus
              spellCheck={false}
            />

            {status && (
              <p style={{ ...s.statusMsg, ...(status.type === "ok" ? s.statusOk : s.statusErr) }}>
                {status.type === "ok" ? "✓ " : "✕ "}{status.msg}
              </p>
            )}

            <div style={s.row}>
              <button style={s.btnGhost} onClick={() => { setStage(1); setStatus(null); setCode(""); }}>
                ← Kembali
              </button>
              <button
                style={{ ...s.btnGold, ...( loading ? s.btnDisabled : {}) }}
                onClick={handleRedeem}
                disabled={loading}
              >
                {loading ? "Memproses…" : "Tukarkan"}
              </button>
            </div>
          </div>
        )}

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
  header: {},
  title: {
    fontFamily: "'Fraunces', serif", fontWeight: 700,
    fontSize: 28, color: C.cream, margin: "0 0 6px",
  },
  sub: { fontSize: 14, color: C.muted, margin: 0 },

  steps: {
    display: "flex", alignItems: "center", gap: 0,
  },
  step: {
    display: "flex", alignItems: "center", gap: 8, opacity: 0.35,
    transition: "opacity .2s",
  },
  stepActive: { opacity: 1 },
  stepNum: {
    width: 28, height: 28, borderRadius: "50%",
    background: `${C.gold}33`, border: `1px solid ${C.gold}66`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 12, fontWeight: 700, color: C.goldHi,
  },
  stepLabel: { fontSize: 13, color: C.cream, fontWeight: 500 },
  stepLine: {
    flex: 1, height: 1, background: C.line, margin: "0 12px",
  },

  card: {
    background: C.panel, border: `1px solid ${C.line}`,
    borderRadius: 20, padding: "24px",
    display: "flex", flexDirection: "column", gap: 14,
  },
  cardLabel: { fontSize: 13, color: C.muted, margin: 0 },

  grid: {
    display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10,
  },
  chip: {
    background: "#1a1510", border: `1px solid ${C.line}`,
    borderRadius: 12, padding: "14px 10px",
    color: C.cream, cursor: "pointer",
    display: "flex", flexDirection: "column", alignItems: "center", gap: 4,
    transition: "all .15s",
  },
  chipActive: {
    background: `${C.gold}22`, border: `1px solid ${C.gold}`,
    color: C.goldHi,
  },
  chipFull: { gridColumn: "span 2", flexDirection: "row", justifyContent: "center", fontSize: 14, fontWeight: 600 },
  chipCoin: { fontSize: 18 },
  chipAmt: { fontSize: 14, fontWeight: 700 },

  label: {
    fontSize: 11, textTransform: "uppercase",
    letterSpacing: "1.2px", color: C.muted,
  },
  input: {
    width: "100%", padding: "12px 14px", borderRadius: 10,
    background: C.ink, border: `1px solid ${C.line}`,
    color: C.cream, fontSize: 14, outline: "none",
    boxSizing: "border-box",
  },

  amountBox: {
    background: `${C.gold}15`, border: `1px solid ${C.gold}44`,
    borderRadius: 12, padding: "16px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  amountLabel: { fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" },
  amountValue: { fontSize: 20, fontWeight: 700, color: C.goldHi },

  waBox: {
    background: "#1a2a1a", border: "1px solid #2a4a2a",
    borderRadius: 12, padding: "18px",
    display: "flex", flexDirection: "column", gap: 10,
  },
  waTitle: { fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "1px", margin: 0 },
  waText: { fontSize: 13, color: C.cream, margin: 0, lineHeight: 1.6 },
  waBtn: {
    display: "flex", alignItems: "center", justifyContent: "center",
    gap: 8, background: "#25D366", color: "#fff",
    fontWeight: 700, fontSize: 14, textDecoration: "none",
    borderRadius: 10, padding: "11px 16px",
  },
  waNote: { fontSize: 12, color: C.muted, margin: 0, lineHeight: 1.5 },

  statusMsg: {
    fontSize: 13, borderRadius: 8, padding: "10px 12px", margin: 0,
  },
  statusOk: { color: C.win, background: "#74C69018", border: `1px solid ${C.win}44` },
  statusErr: { color: C.lose, background: "#DC7C6818", border: `1px solid ${C.lose}44` },

  row: { display: "flex", gap: 10 },
  btnGhost: {
    flex: 1, background: "none", border: `1px solid ${C.line}`,
    borderRadius: 10, padding: "12px 0", cursor: "pointer",
    color: C.muted, fontSize: 14, fontWeight: 500,
  },
  btnGold: {
    flex: 1, background: `linear-gradient(135deg, ${C.goldHi}, ${C.gold})`,
    border: "none", borderRadius: 10, padding: "12px 0",
    cursor: "pointer", color: C.ink, fontSize: 14, fontWeight: 700,
  },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed" },
};
