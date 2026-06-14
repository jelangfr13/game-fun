import React, { useState, useEffect, useRef, useCallback } from "react";
import { BETS, fmt } from "./dadu/constants";
import { Store } from "./dadu/store";
import { startSlotSpin, playReelStop, playWin, playLose } from "./sounds";
import GameLogsPanel from "./GameLogsPanel";
import useIsMobile from "./useIsMobile";

// ── SYMBOLS ───────────────────────────────────────────────────────────────────

const SYMBOLS = [
  { id: "cherry",  emoji: "🍒", label: "Cherry",  weight: 35 },
  { id: "lemon",   emoji: "🍋", label: "Lemon",   weight: 28 },
  { id: "grapes",  emoji: "🍇", label: "Anggur",  weight: 20 },
  { id: "bell",    emoji: "🔔", label: "Lonceng", weight: 10 },
  { id: "star",    emoji: "⭐", label: "Bintang", weight: 5  },
  { id: "diamond", emoji: "💎", label: "Berlian", weight: 1.5},
  { id: "seven",   emoji: "7️⃣", label: "Lucky 7", weight: 0.5},
];

const SYM = Object.fromEntries(SYMBOLS.map(s => [s.id, s]));
const POOL = SYMBOLS.flatMap(s => Array(Math.round(s.weight * 4)).fill(s.id));

// multiplier × bet = total returned to player
const PAYOUTS = {
  cherry:  { 3: 3,   2: 1 },
  lemon:   { 3: 4 },
  grapes:  { 3: 8 },
  bell:    { 3: 15 },
  star:    { 3: 30 },
  diamond: { 3: 75 },
  seven:   { 3: 200 },
};

const PAYOUT_DISPLAY = [
  { sym: "seven",   multi: 200, label: "JACKPOT" },
  { sym: "diamond", multi: 75  },
  { sym: "star",    multi: 30  },
  { sym: "bell",    multi: 15  },
  { sym: "grapes",  multi: 8   },
  { sym: "lemon",   multi: 4   },
  { sym: "cherry",  multi: 3   },
  { sym: "cherry",  multi: 1, count: 2, note: "×2" },
];

const STOP_TIMES = [1100, 1650, 2200];

function randSym() {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

// reels[col][row], 3 cols × 3 rows
function makeReels() {
  return Array.from({ length: 3 }, () => [randSym(), randSym(), randSym()]);
}

// Reels whose payline has no winning combination
function makeLoseReels() {
  const FALLBACK = ["cherry", "lemon", "grapes"]; // guaranteed no match
  for (let attempt = 0; attempt < 30; attempt++) {
    const r = makeReels();
    if (calcWin([r[0][1], r[1][1], r[2][1]], 1).multi === 0) return r;
  }
  return [
    [randSym(), FALLBACK[0], randSym()],
    [randSym(), FALLBACK[1], randSym()],
    [randSym(), FALLBACK[2], randSym()],
  ];
}

function calcWin(payline, bet) {
  const counts = {};
  payline.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
  let best = { sym: null, count: 0, multi: 0, win: 0 };
  for (const [sym, count] of Object.entries(counts)) {
    const multi = PAYOUTS[sym]?.[count] ?? 0;
    if (multi > best.multi) best = { sym, count, multi, win: multi * bet };
  }
  return best;
}

// ── COMPONENT ─────────────────────────────────────────────────────────────────

export default function SlotMachine({ onTopUp }) {
  const [balance, setBalance]       = useState(null);
  const [bet, setBet]               = useState(1000);
  const [reels, setReels]           = useState(makeReels);
  const [stopped, setStopped]       = useState([true, true, true]);
  const [spinning, setSpinning]     = useState(false);
  const [outcome, setOutcome]       = useState(null);
  const [toast, setToast]           = useState(null);
  const [latestLog, setLatestLog]   = useState(null);
  const [showPayouts, setShowPayouts] = useState(false);
  const isMobile = useIsMobile();

  const intv        = useRef([null, null, null]);
  const tmrs        = useRef([]);
  const spinBalance = useRef(null);
  const stopSpin    = useRef(null);
  const spinLock    = useRef(false); // prevents double-spin during async API await

  useEffect(() => {
    let alive = true;
    Store.load().then(v => { if (alive) setBalance(v); });
    return () => {
      alive = false;
      intv.current.forEach(clearInterval);
      tmrs.current.forEach(clearTimeout);
      stopSpin.current?.();
    };
  }, []);

  const flash = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const updateBalance = useCallback((next) => {
    setBalance(next);
    Store.save(next);
  }, []);

  const spin = async () => {
    if (spinLock.current || spinning || balance == null || balance < bet) return;
    spinLock.current = true;

    // Check pending jackpot, forced win, forced lose (jackpot > win > lose > random)
    let forceJackpot = false;
    let forceWin     = false;
    let forceLose    = false;
    try {
      const token = localStorage.getItem("gf_token");
      const [jRes, wRes, lRes] = await Promise.all([
        fetch("/api/user/claim-jackpot", { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/user/claim-win",     { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/user/claim-lose",    { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (jRes.ok) forceJackpot = (await jRes.json()).jackpot;
      if (wRes.ok) forceWin     = (await wRes.json()).win;
      if (lRes.ok) forceLose    = (await lRes.json()).lose;
    } catch (e) {}

    // Build final reels — jackpot > forced win > forced lose > random
    let finalReels;
    if (forceJackpot) {
      finalReels = [
        [randSym(), "seven", randSym()],
        [randSym(), "seven", randSym()],
        [randSym(), "seven", randSym()],
      ];
    } else if (forceWin) {
      finalReels = [
        [randSym(), "bell", randSym()],
        [randSym(), "bell", randSym()],
        [randSym(), "bell", randSym()],
      ];
    } else if (forceLose) {
      finalReels = makeLoseReels();
    } else {
      finalReels = makeReels();
    }
    const payline = [finalReels[0][1], finalReels[1][1], finalReels[2][1]];
    const result  = calcWin(payline, bet);
    spinBalance.current = balance;

    setOutcome(null);
    setSpinning(true);
    setStopped([false, false, false]);
    setBalance(balance - bet); // optimistic UI only — DB saved once at spin end
    stopSpin.current = startSlotSpin();

    // start cycling each reel
    intv.current.forEach(clearInterval);
    tmrs.current.forEach(clearTimeout);
    tmrs.current = [];

    for (let c = 0; c < 3; c++) {
      intv.current[c] = setInterval(() => {
        setReels(prev => {
          const next = prev.map(col => [...col]);
          next[c] = [randSym(), randSym(), randSym()];
          return next;
        });
      }, 75);
    }

    STOP_TIMES.forEach((delay, c) => {
      const t = setTimeout(() => {
        clearInterval(intv.current[c]);
        setReels(prev => {
          const next = prev.map(col => [...col]);
          next[c] = finalReels[c];
          return next;
        });
        setStopped(prev => { const n = [...prev]; n[c] = true; return n; });

        playReelStop();

        if (c === 2) {
          stopSpin.current?.();
          stopSpin.current = null;
          spinLock.current = false;
          setSpinning(false);
          setOutcome(result);
          const base = spinBalance.current;
          let finalBalance, net;
          if (result.win > 0) {
            finalBalance = base - bet + result.win;
            net = result.win - bet;
            updateBalance(finalBalance);
            if (result.multi >= 100) {
              flash("win", `🎰 JACKPOT! +${fmt(net)} koin`); playWin(true);
            } else if (net > 0) {
              flash("win", `Menang! +${fmt(net)} koin`); playWin(false);
            } else {
              flash("warn", `Impas · ${fmt(result.win)} koin kembali`);
            }
          } else {
            finalBalance = base - bet;
            net = -bet;
            updateBalance(finalBalance);
            flash("lose", `-${fmt(bet)} koin`);
            playLose();
          }
          // Optimistic panel update + fire-and-forget log
          const isJackpot = result.sym === "seven" && result.count === 3;
          const logResult = isJackpot ? "jackpot" : result.win > 0 ? (net === 0 ? "impas" : "win") : "lose";
          const logEntry = {
            game: "slot", bet, result: logResult, delta: net,
            details: { payline, symbol: result.sym ?? null, multiplier: result.multi ?? 0 },
            forced: forceJackpot || forceWin || forceLose,
            createdAt: new Date().toISOString(),
          };
          setLatestLog(logEntry);
          fetch("/api/user/log", {
            method: "POST",
            headers: { Authorization: `Bearer ${localStorage.getItem("gf_token")}`, "Content-Type": "application/json" },
            body: JSON.stringify({ ...logEntry, balanceBefore: base, balanceAfter: finalBalance }),
          }).catch(() => {});
        }
      }, delay);
      tmrs.current.push(t);
    });
  };

  const loading  = balance == null;
  const canSpin  = !spinning && !loading && balance >= bet;

  // payline symbols for win highlight
  const payline      = [reels[0][1], reels[1][1], reels[2][1]];
  const winSym       = outcome?.sym ?? null;
  const winningCols  = winSym
    ? payline.reduce((acc, s, i) => { if (s === winSym) acc.push(i); return acc; }, [])
    : [];

  return (
    <div style={{ ...s.root, ...(isMobile ? { padding: "12px 10px 40px" } : {}) }}>
      <style>{globalCss}</style>
      <div style={isMobile ? s.layoutMobile : s.layout}>

        {/* LEFT: PAYOUT TABLE — desktop only */}
        {!isMobile && (
          <div style={s.payoutsPanel}>
            <p style={s.payoutsPanelTitle}>Tabel Bayar</p>
            <div style={s.payoutGrid}>
              {PAYOUT_DISPLAY.map((p, i) => (
                <div key={i} style={s.payoutRow}>
                  <span style={s.payoutSyms}>
                    {p.note
                      ? <>{SYM[p.sym].emoji} {SYM[p.sym].emoji}</>
                      : <>{SYM[p.sym].emoji} {SYM[p.sym].emoji} {SYM[p.sym].emoji}</>
                    }
                  </span>
                  <span style={s.payoutMult}>
                    {p.multi}×
                    {p.label && <span style={s.payoutLabel}> {p.label}</span>}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* CENTER / TOP: MACHINE */}
        <div style={isMobile ? { ...s.machine, maxWidth: "100%" } : s.machine}>

        {/* HEADER */}
        <header style={s.header}>
          <div style={s.brand}>
            <span style={s.brandIcon}>🎰</span>
            <h1 style={s.brandTitle}>Mesin Slot</h1>
          </div>
          <button style={s.wallet} onClick={() => onTopUp?.()} disabled={loading}>
            <span style={s.walletLabel}>Saldo</span>
            <span style={s.walletAmt}>{loading ? "—" : fmt(balance)}</span>
            <span style={s.walletUnit}>koin</span>
          </button>
        </header>

        {/* REEL TRAY */}
        <div style={s.tray}>
          <div style={s.reelWindow}>
            {[0, 1, 2].map(row => (
              <div key={row} style={{ ...s.reelRow, ...(row === 1 ? s.paylineRow : {}) }}>
                {row === 1 && <div style={s.paylineBar} />}
                {[0, 1, 2].map(col => {
                  const isPayline  = row === 1;
                  const isWin      = isPayline && winningCols.includes(col);
                  const isSpinning = !stopped[col];
                  return (
                    <div
                      key={col}
                      className={isPayline ? "slot-cell-pl" : "slot-cell"}
                      style={{
                        ...s.cell,
                        ...(isPayline ? s.cellPayline : {}),
                        ...(isSpinning ? s.cellSpin : {}),
                        ...(isWin ? s.cellWin : {}),
                      }}
                    >
                      {SYM[reels[col][row]]?.emoji}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>

          {/* OUTCOME */}
          <div style={s.verdict}>
            {spinning ? (
              <span style={s.verdictSpin}>Memutar…</span>
            ) : outcome ? (
              outcome.win > 0 ? (
                <div style={s.verdictWin}>
                  <span style={s.verdictSymbol}>{SYM[outcome.sym]?.emoji}</span>
                  <div style={s.verdictText}>
                    <span style={s.verdictTitle}>
                      {outcome.count === 3 ? "3 Sejenis" : "2 Cherry"} · {outcome.multi}×
                    </span>
                    <span style={s.verdictSub}>+{fmt(outcome.win - bet)} koin</span>
                  </div>
                </div>
              ) : (
                <span style={s.verdictLose}>Coba lagi</span>
              )
            ) : (
              <span style={s.verdictIdle}>Tekan putar untuk mulai</span>
            )}
          </div>
        </div>

        {/* BET */}
        <div style={s.section}>
          <div style={s.sectionLabel}>Jumlah taruhan</div>
          <div style={s.bets} className="slot-bets">
            {BETS.map(b => {
              const tooMuch = !loading && b > balance;
              return (
                <button
                  key={b}
                  style={{ ...s.betBtn, ...(bet === b ? s.betActive : {}), ...(tooMuch ? s.betDisabled : {}) }}
                  onClick={() => setBet(b)}
                  disabled={spinning || tooMuch}
                >
                  {fmt(b)}
                </button>
              );
            })}
          </div>
          <button
            style={{
              ...s.allIn,
              ...(bet === balance && !loading ? s.allInActive : {}),
              ...((loading || balance === 0) ? s.allInOff : {}),
            }}
            onClick={() => !loading && balance > 0 && setBet(balance)}
            disabled={spinning || loading || balance === 0}
          >
            <span>💰 ALL IN</span>
            {!loading && balance > 0 && (
              <span style={s.allInAmt}>{fmt(balance)} koin</span>
            )}
          </button>
        </div>

        {/* SPIN BUTTON */}
        <button style={{ ...s.spinBtn, ...(!canSpin ? s.spinDisabled : {}) }} onClick={spin} disabled={!canSpin}>
          {spinning
            ? "Memutar…"
            : balance < bet
            ? "Saldo tidak cukup"
            : `🎰 Putar · ${fmt(bet)} koin`}
        </button>

        {balance === 0 && !spinning && (
          <p style={s.broke}>Saldo habis. Klik tombol Saldo untuk top-up.</p>
        )}

        {/* Mobile: collapsible payout table */}
        {isMobile && (
          <div style={s.payoutSection}>
            <button style={s.payoutToggle} onClick={() => setShowPayouts(p => !p)}>
              {showPayouts ? "▲" : "▼"} Tabel Pembayaran
            </button>
            {showPayouts && (
              <div style={s.payoutGrid}>
                {PAYOUT_DISPLAY.map((p, i) => (
                  <div key={i} style={s.payoutRow}>
                    <span style={s.payoutSyms}>
                      {p.note
                        ? <>{SYM[p.sym].emoji} {SYM[p.sym].emoji}</>
                        : <>{SYM[p.sym].emoji} {SYM[p.sym].emoji} {SYM[p.sym].emoji}</>
                      }
                    </span>
                    <span style={s.payoutMult}>
                      {p.multi}×
                      {p.label && <span style={s.payoutLabel}> {p.label}</span>}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        </div>{/* end machine */}

        {/* RIGHT / BOTTOM: LOGS */}
        <GameLogsPanel game="slot" newEntry={latestLog} mobile={isMobile} />

      </div>{/* end layout */}

      {toast && <div style={{ ...s.toast, ...s[`toast_${toast.type}`] }}>{toast.text}</div>}
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const C = {
  ink: "#0e0b18", panel: "#1a1628", felt: "#16102a", felt2: "#1e1438",
  gold: "#D8A24A", goldHi: "#F2CB72", cream: "#F2EBDD",
  muted: "#8a7fa0", line: "#2e2840",
  win: "#74C690", lose: "#DC7C68",
  purple: "#7c5cbf", purpleHi: "#a87de8",
};

const s = {
  root: {
    minHeight: "100vh", width: "100%",
    background: `radial-gradient(130% 100% at 50% -5%, #1e1438 0%, ${C.ink} 60%)`,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: C.cream, display: "flex", justifyContent: "center",
    alignItems: "flex-start", padding: "32px 24px 48px", boxSizing: "border-box",
  },
  layout: {
    display: "flex", gap: 24, alignItems: "flex-start",
    width: "100%", maxWidth: 1040,
  },
  layoutMobile: {
    display: "flex", flexDirection: "column", gap: 16,
    width: "100%",
  },
  machine: { flex: "0 0 auto", width: "100%", maxWidth: 480 },

  // PAYOUTS PANEL (left)
  payoutsPanel: {
    width: 200, flexShrink: 0,
    background: C.panel, border: `1px solid ${C.line}`,
    borderRadius: 20, padding: 14,
    display: "flex", flexDirection: "column", gap: 0,
    position: "sticky", top: 32,
  },
  payoutsPanelTitle: {
    fontFamily: "'Fraunces', serif", fontWeight: 600,
    fontSize: 14, color: C.cream, margin: "0 0 10px",
    paddingBottom: 10, borderBottom: `1px solid ${C.line}`,
  },

  // HEADER
  header: {
    display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 22,
  },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  brandIcon: { fontSize: 28 },
  brandTitle: {
    fontFamily: "'Fraunces', serif", fontWeight: 700,
    fontSize: 22, margin: 0, color: C.cream,
  },
  wallet: {
    display: "flex", alignItems: "baseline", gap: 6,
    background: "linear-gradient(180deg, #231d36, #160f28)",
    border: `1px solid ${C.line}`, borderRadius: 14,
    padding: "9px 14px", cursor: "pointer", color: C.cream,
  },
  walletLabel: { fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "1px" },
  walletAmt: { fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 17, color: C.goldHi },
  walletUnit: { fontSize: 10, color: C.muted },

  // TRAY
  tray: {
    background: `radial-gradient(130% 120% at 50% 0%, ${C.felt2}, ${C.felt})`,
    border: `1px solid #3a2860`, borderRadius: 24,
    padding: "24px 20px 20px",
    boxShadow: "0 20px 50px -20px #000, inset 0 1px 0 #ffffff10",
    marginBottom: 20,
  },
  reelWindow: {
    display: "flex", flexDirection: "column", gap: 4,
    position: "relative",
  },
  reelRow: {
    display: "flex", gap: 10, justifyContent: "center",
    position: "relative",
  },
  paylineRow: { zIndex: 2 },
  paylineBar: {
    position: "absolute", inset: "-3px -10px",
    border: `2px solid ${C.gold}88`,
    borderRadius: 14, pointerEvents: "none",
    boxShadow: `0 0 14px ${C.gold}44`,
    zIndex: -1,
  },

  cell: {
    width: 80, height: 72, borderRadius: 14,
    background: "linear-gradient(180deg, #1c1530, #130f22)",
    border: `1px solid #2e2840`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontSize: 32, lineHeight: 1,
    transition: "filter .15s",
    userSelect: "none",
  },
  cellPayline: {
    width: 88, height: 82, fontSize: 38,
    border: `1px solid ${C.gold}55`,
    background: "linear-gradient(180deg, #231840, #1a1030)",
    boxShadow: `0 0 20px -8px ${C.purple}`,
  },
  cellSpin: { filter: "blur(1.5px)", opacity: 0.85 },
  cellWin: {
    border: `2px solid ${C.goldHi}`,
    background: `linear-gradient(180deg, #2e2218, #1e1610)`,
    boxShadow: `0 0 24px -4px ${C.gold}`,
    filter: "drop-shadow(0 0 8px #F2CB72aa)",
  },

  verdict: {
    minHeight: 52, display: "flex", alignItems: "center", justifyContent: "center",
    marginTop: 16,
  },
  verdictIdle: { color: `${C.cream}66`, fontSize: 13 },
  verdictSpin: { color: C.purpleHi, fontFamily: "'Space Mono', monospace", fontSize: 14, letterSpacing: "1px" },
  verdictWin: { display: "flex", alignItems: "center", gap: 12 },
  verdictSymbol: { fontSize: 36 },
  verdictText: { display: "flex", flexDirection: "column", gap: 2 },
  verdictTitle: { fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, color: C.goldHi, letterSpacing: "0.5px" },
  verdictSub: { fontSize: 13, color: C.win },
  verdictLose: { color: `${C.lose}cc`, fontSize: 14 },

  // BET
  section: { marginBottom: 16 },
  sectionLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "1.4px", color: C.muted, marginBottom: 9 },
  bets: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 8 },
  betBtn: {
    background: C.panel, border: `1px solid ${C.line}`,
    borderRadius: 12, padding: "12px 4px",
    color: C.cream, fontFamily: "'Space Mono', monospace",
    fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  betActive: {
    border: `1px solid ${C.gold}`, color: C.ink,
    background: `linear-gradient(180deg, ${C.goldHi}, ${C.gold})`,
  },
  betDisabled: { opacity: 0.3, cursor: "not-allowed" },

  // ALL IN
  allIn: {
    width: "100%", marginTop: 8, padding: "11px 16px",
    background: "linear-gradient(135deg, #2e1e06, #1e1408)",
    border: "1px solid #D8A24A88",
    borderRadius: 12, cursor: "pointer",
    color: "#F2CB72", fontFamily: "'Space Mono', monospace",
    fontWeight: 700, fontSize: 13, letterSpacing: "1px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  allInActive: {
    background: "linear-gradient(135deg, #D8A24A, #F2CB72)",
    border: "1px solid #F2CB72",
    color: "#0e0b18",
    boxShadow: "0 0 24px -6px #D8A24Aaa",
  },
  allInOff: { opacity: 0.35, cursor: "not-allowed" },
  allInAmt: { fontSize: 12, fontWeight: 400, letterSpacing: "0.5px", opacity: 0.8 },

  // SPIN BUTTON
  spinBtn: {
    width: "100%", marginBottom: 8, padding: 17,
    border: "none", borderRadius: 16, cursor: "pointer",
    fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 18,
    color: C.ink,
    background: `linear-gradient(180deg, ${C.goldHi}, ${C.gold})`,
    boxShadow: `0 10px 28px -10px ${C.gold}, inset 0 1px 0 #ffffff60`,
    transition: "transform .12s, filter .15s",
  },
  spinDisabled: {
    background: "#231d36", color: C.muted,
    boxShadow: "none", cursor: "not-allowed",
  },
  broke: { textAlign: "center", color: C.lose, fontSize: 13, marginTop: 8 },

  // PAYOUT TABLE
  payoutSection: { marginTop: 8 },
  payoutToggle: {
    width: "100%", background: "none", border: `1px solid ${C.line}`,
    borderRadius: 10, padding: "8px 0", cursor: "pointer",
    color: C.muted, fontSize: 12, letterSpacing: "0.5px",
  },
  payoutGrid: {
    marginTop: 8, background: C.panel, border: `1px solid ${C.line}`,
    borderRadius: 14, overflow: "hidden",
  },
  payoutRow: {
    display: "flex", justifyContent: "space-between", alignItems: "center",
    padding: "9px 16px", borderBottom: `1px solid ${C.line}44`,
  },
  payoutSyms: { fontSize: 16, letterSpacing: "2px" },
  payoutMult: { fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, color: C.goldHi },
  payoutLabel: { fontFamily: "'DM Sans', sans-serif", fontWeight: 400, fontSize: 11, color: C.muted },

  // TOAST
  toast: {
    position: "fixed", left: "50%", top: 28,
    transform: "translateX(-50%)",
    padding: "12px 22px", borderRadius: 999,
    fontWeight: 700, fontSize: 14,
    fontFamily: "'Space Mono', monospace",
    boxShadow: "0 12px 30px -10px #000", zIndex: 30,
    animation: "rise .25s ease",
    whiteSpace: "nowrap",
  },
  toast_win:  { background: C.win,  color: "#0c2415" },
  toast_lose: { background: C.lose, color: "#2a0c08" },
  toast_warn: { background: "#E8C26A", color: "#2a1f08" },
};

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=DM+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
  @keyframes rise { from { opacity:0; transform:translate(-50%,-10px); } to { opacity:1; transform:translate(-50%,0); } }
  @media (max-width: 480px) {
    .slot-cell        { width:64px !important; height:58px !important; font-size:26px !important; border-radius:10px !important; }
    .slot-cell-pl     { width:72px !important; height:66px !important; font-size:30px !important; }
    .slot-bets        { grid-template-columns: repeat(2,1fr) !important; }
  }
`;
