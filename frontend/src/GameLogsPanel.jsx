import React, { useState, useEffect, useRef } from "react";
import { fmt } from "./dadu/constants";

const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
function fmtTime(iso) {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${hh}:${mm}`;
}

const RESULT_META = {
  win:     { label: "Menang",  bg: "#74C69020", color: "#74C690", border: "#74C69044" },
  jackpot: { label: "Jackpot", bg: "#a87de820", color: "#a87de8", border: "#a87de844" },
  impas:   { label: "Impas",   bg: "#D8A24A20", color: "#F2CB72", border: "#D8A24A44" },
  lose:    { label: "Kalah",   bg: "#DC7C6820", color: "#DC7C68", border: "#DC7C6844" },
};

const DICE_FACES = ["", "⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
const SYM_EMOJI  = { cherry: "🍒", lemon: "🍋", grapes: "🍇", bell: "🔔", star: "⭐", diamond: "💎", seven: "7️⃣" };

function Badge({ result }) {
  const m = RESULT_META[result] ?? RESULT_META.lose;
  return (
    <span style={{
      fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 999,
      background: m.bg, color: m.color, border: `1px solid ${m.border}`,
      whiteSpace: "nowrap", lineHeight: 1.5,
    }}>
      {m.label}
    </span>
  );
}

function LogDetail({ log }) {
  if (log.game === "slot") {
    const { payline, multiplier } = log.details ?? {};
    if (!payline) return null;
    const emojis = payline.map(s => SYM_EMOJI[s] ?? "?").join(" ");
    return (
      <span style={P.detail}>
        {emojis}{multiplier > 0 ? <span style={P.multi}> {multiplier}×</span> : null}
      </span>
    );
  }
  if (log.game === "dadu") {
    const { dice, sum, parity, choice } = log.details ?? {};
    if (!dice) return null;
    return (
      <span style={P.detail}>
        {DICE_FACES[dice[0]] ?? dice[0]} {DICE_FACES[dice[1]] ?? dice[1]}
        <span style={{ marginLeft: 4 }}>= {sum} ({parity})</span>
        <span style={{ ...P.detail, marginLeft: 4, opacity: 0.7 }}>· {choice}</span>
      </span>
    );
  }
  if (log.game === "blackjack") {
    const { playerCards, dealerCards, playerValue, dealerValue } = log.details ?? {};
    if (!playerCards) return null;
    return (
      <span style={P.detail}>
        {playerCards.join(" ")}
        <span style={{ color: "#F2CB72", fontWeight: 700 }}> {playerValue}</span>
        <span style={{ opacity: 0.5 }}> vs </span>
        {dealerCards.join(" ")}
        <span style={{ opacity: 0.7 }}> {dealerValue}</span>
      </span>
    );
  }
  return null;
}

const P = {
  wrap: {
    width: 240, flexShrink: 0,
    background: "#1a1628", border: "1px solid #2e2840",
    borderRadius: 20, padding: 14,
    display: "flex", flexDirection: "column", gap: 10,
    maxHeight: 660, position: "sticky", top: 32,
  },
  head: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  title: {
    fontFamily: "'Fraunces', serif", fontWeight: 600,
    fontSize: 15, color: "#F2EBDD", margin: 0,
  },
  count: {
    fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999,
    background: "#D8A24A22", color: "#F2CB72", border: "1px solid #D8A24A44",
  },
  list: {
    flex: 1, minHeight: 0, overflowY: "auto", overflowX: "hidden",
    display: "flex", flexDirection: "column", gap: 5,
    paddingRight: 2,
  },
  row: {
    background: "#13101e", border: "1px solid #2e2840", borderRadius: 12,
    padding: "8px 10px", display: "flex", flexDirection: "column", gap: 4,
    flexShrink: 0,
  },
  rowTop: { display: "flex", alignItems: "center", gap: 5 },
  spacer: { flex: 1 },
  delta: (d) => ({
    fontSize: 12, fontWeight: 700, whiteSpace: "nowrap",
    color: d > 0 ? "#74C690" : d < 0 ? "#DC7C68" : "#9C8E78",
  }),
  detail: { fontSize: 11, color: "#9C8E78" },
  multi:  { color: "#F2CB72", fontWeight: 700 },
  bottom: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  bet:    { fontSize: 11, color: "#6a6075" },
  time:   { fontSize: 10, color: "#6a6075" },
  empty:  { textAlign: "center", color: "#8a7fa0", fontSize: 12, padding: "20px 0", margin: 0 },
};

const NO_SCROLL_CSS = `
  .gp-list::-webkit-scrollbar { display: none; }
  .gp-list { -ms-overflow-style: none; scrollbar-width: none; }
`;

export default function GameLogsPanel({ game, newEntry, mobile = false }) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const listRef               = useRef(null);

  useEffect(() => {
    const token = localStorage.getItem("gf_token");
    fetch(`/api/user/logs?game=${game}&limit=50`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then(r => r.ok ? r.json() : { logs: [] })
      .then(d => setLogs(d.logs ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [game]);

  useEffect(() => {
    if (!newEntry) return;
    setLogs(prev => [newEntry, ...prev].slice(0, 50));
    if (listRef.current) listRef.current.scrollTop = 0;
  }, [newEntry]);

  const wrapStyle = mobile
    ? { ...P.wrap, width: "100%", boxSizing: "border-box", position: "static", maxHeight: 320, flexShrink: 1 }
    : P.wrap;

  return (
    <div style={wrapStyle}>
      <style>{NO_SCROLL_CSS}</style>
      <div style={P.head}>
        <p style={P.title}>📋 Riwayat</p>
        <span style={P.count}>{logs.length}</span>
      </div>

      <div style={P.list} className="gp-list" ref={listRef}>
        {loading ? (
          <p style={P.empty}>Memuat…</p>
        ) : logs.length === 0 ? (
          <p style={P.empty}>Belum ada riwayat.</p>
        ) : logs.map((l, i) => (
          <div key={l._id ?? i} style={P.row}>
            <div style={P.rowTop}>
              <Badge result={l.result} />
              <span style={P.spacer} />
              <span style={P.delta(l.delta)}>
                {l.delta > 0 ? "+" : ""}{fmt(l.delta)}
              </span>
            </div>
            <LogDetail log={l} />
            <div style={P.bottom}>
              <span style={P.bet}>Bet: {fmt(l.bet)}</span>
              <span style={P.time}>{fmtTime(l.createdAt)}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
