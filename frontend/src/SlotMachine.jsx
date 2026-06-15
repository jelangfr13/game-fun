import { useState, useEffect, useRef, useCallback } from "react";
import { BETS, fmt, fmtShort } from "./dadu/constants";
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

// ── OUTCOME SYSTEM ────────────────────────────────────────────────────────────

// 3-of-a-kind with fixed probabilities (total 43%); remaining 57% is random
const THREE_OF_A_KIND = [
  { id: "seven3",   sym: "seven",   n: 3, multi: 10,   isJackpot: true, prob: 0.01 },
  { id: "diamond3", sym: "diamond", n: 3, multi: 5,                     prob: 0.03 },
  { id: "star3",    sym: "star",    n: 3, multi: 3,                     prob: 0.05 },
  { id: "bell3",    sym: "bell",    n: 3, multi: 2.5,                   prob: 0.07 },
  { id: "grapes3",  sym: "grapes",  n: 3, multi: 2,                     prob: 0.08 },
  { id: "lemon3",   sym: "lemon",   n: 3, multi: 1.75,                  prob: 0.09 },
  { id: "cherry3",  sym: "cherry",  n: 3, multi: 1.5,                   prob: 0.10 },
];

// 2-of-a-kind payouts (seven/diamond/star give bonus multiplier)
const TWO_WIN = {
  seven:   { id: "seven2",   sym: "seven",   n: 2, multi: 2    },
  diamond: { id: "diamond2", sym: "diamond", n: 2, multi: 1.5  },
  star:    { id: "star2",    sym: "star",    n: 2, multi: 1.25 },
};
const DRAW = { id: "draw", sym: null, n: 2, multi: 1 };
const LOSE = { id: "lose", sym: null, n: 0, multi: 0 };

const PAYOUT_DISPLAY = [
  { sym: "seven",   n: 3, multi: 10,   label: "JACKPOT" },
  { sym: "diamond", n: 3, multi: 5    },
  { sym: "star",    n: 3, multi: 3    },
  { sym: "bell",    n: 3, multi: 2.5  },
  { sym: "grapes",  n: 3, multi: 2    },
  { sym: "lemon",   n: 3, multi: 1.75 },
  { sym: "cherry",  n: 3, multi: 1.5  },
  null,
  { sym: "seven",   n: 2, multi: 2    },
  { sym: "diamond", n: 2, multi: 1.5  },
  { sym: "star",    n: 2, multi: 1.25 },
  { n: 2, multi: 1, label: "Impas"   },
];

const STOP_TIMES = [1100, 1650, 2200];
const DIFFICULTY_MULTIPLIER = 3;

function randSym() {
  return POOL[Math.floor(Math.random() * POOL.length)];
}

// reels[col][row], 3 cols × 3 rows (initial / spin animation)
function makeReels() {
  return Array.from({ length: 3 }, () => [randSym(), randSym(), randSym()]);
}

function makeLosingPayline() {
  const syms = [];
  while (syms.length < 3) {
    const sym = randSym();
    if (!syms.includes(sym)) syms.push(sym);
  }
  return syms;
}

// Compute outcome from 3 payline symbols (used for the random 57%)
function computeOutcome(syms) {
  const [a, b, c] = syms;
  if (a === b && b === c) {
    return THREE_OF_A_KIND.find(o => o.sym === a) ?? { id: a + "3", sym: a, n: 3, multi: 1.5 };
  }
  const winSym = a === b ? a : b === c ? b : a === c ? a : null;
  if (winSym) return TWO_WIN[winSym] ?? { ...DRAW, sym: winSym };
  return LOSE;
}

// Pick spin: 43% fixed 3-of-a-kind by prob table, 57% truly random
function pickSpin() {
  const r = Math.random();
  let cum = 0;
  for (const o of THREE_OF_A_KIND) {
    cum += o.prob;
    if (r < cum) return { syms: [o.sym, o.sym, o.sym], outcome: o };
  }
  const syms = [randSym(), randSym(), randSym()];
  return { syms, outcome: computeOutcome(syms) };
}

function applyDifficulty(result) {
  if (result.outcome.multi <= 0) return result;
  if (Math.random() < 1 / DIFFICULTY_MULTIPLIER) return result;
  return { syms: makeLosingPayline(), outcome: LOSE };
}

function getWinPositions(paylineSyms) {
  const counts = {};
  paylineSyms.forEach(s => { counts[s] = (counts[s] || 0) + 1; });
  const max = Math.max(...Object.values(counts));
  if (max < 2) return [];
  const winSym = Object.keys(counts).find(s => counts[s] === max);
  return paylineSyms.reduce((acc, s, i) => { if (s === winSym) acc.push(i); return acc; }, []);
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
    let isNewPlayer  = false;
    try {
      const token = localStorage.getItem("gf_token");
      const [jRes, wRes, lRes] = await Promise.all([
        fetch("/api/user/claim-jackpot", { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/user/claim-win",     { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/user/claim-lose",    { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (jRes.ok) forceJackpot = (await jRes.json()).jackpot;
      if (wRes.ok) { const w = await wRes.json(); forceWin = w.win; isNewPlayer = !!w.newPlayer; }
      if (lRes.ok) forceLose    = (await lRes.json()).lose;
    } catch {
      /* Ignore control API failures; the spin continues with the normal random outcome. */
    }

    const RESTRICTED_SYMS = ["seven", "diamond", "star"];

    // Pick outcome — jackpot > forced win > forced lose > random
    let paylineSyms, picked;
    if (forceJackpot) {
      picked      = THREE_OF_A_KIND.find(o => o.id === "seven3");
      paylineSyms = [picked.sym, picked.sym, picked.sym];
    } else if (forceWin) {
      const pool = isNewPlayer
        ? THREE_OF_A_KIND.filter(o => !RESTRICTED_SYMS.includes(o.sym))
        : THREE_OF_A_KIND.filter(o => !o.isJackpot);
      picked      = pool[Math.floor(Math.random() * pool.length)];
      paylineSyms = [picked.sym, picked.sym, picked.sym];
    } else if (forceLose) {
      picked      = LOSE;
      paylineSyms = makeLosingPayline();
    } else {
      const result = applyDifficulty(pickSpin());
      paylineSyms  = result.syms;
      picked       = result.outcome;
    }

    const finalReels = paylineSyms.map(mid => [randSym(), mid, randSym()]);
    const payout       = Math.round(bet * picked.multi);
    const delta        = payout - bet;
    const winPositions = getWinPositions(paylineSyms);
    const spinResult   = { ...picked, paylineSyms, winPositions, payout, delta };

    spinBalance.current = balance;
    setOutcome(null);
    setSpinning(true);
    setStopped([false, false, false]);
    setBalance(balance - bet);
    stopSpin.current = startSlotSpin();

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
          setOutcome(spinResult);

          const base         = spinBalance.current;
          const finalBalance = base - bet + payout;
          updateBalance(finalBalance);

          if (spinResult.isJackpot) {
            flash("win", `🎰 JACKPOT! +${fmt(delta)} koin`); playWin(true);
          } else if (delta > 0) {
            flash("win", `Menang! +${fmt(delta)} koin`); playWin(false);
          } else if (delta === 0) {
            flash("warn", `Impas · ${fmt(payout)} koin kembali`);
          } else {
            flash("lose", `-${fmt(bet)} koin`); playLose();
          }

          const logResult = spinResult.isJackpot ? "jackpot" : delta > 0 ? "win" : delta === 0 ? "impas" : "lose";
          const logEntry = {
            game: "slot", bet, result: logResult, delta,
            details: { payline: paylineSyms, symbol: spinResult.sym ?? null, multiplier: spinResult.multi },
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

  const winningCols = outcome?.winPositions ?? [];

  return (
    <div style={{ ...s.root, ...(isMobile ? { padding: "12px 10px 40px" } : {}) }}>
      <style>{globalCss}</style>
      <div style={isMobile ? s.layoutMobile : s.layout}>

        {/* LEFT: PAYOUT TABLE — desktop only */}
        {!isMobile && (
          <div style={s.payoutsPanel}>
            <p style={s.payoutsPanelTitle}>Tabel Bayar</p>
            <div style={s.payoutGrid}>
              {PAYOUT_DISPLAY.filter(p => p !== null && p.n === 3).map((p, i) => (
                <div key={i} style={s.payoutRow}>
                  <span style={s.payoutSyms}>
                    {`${SYM[p.sym].emoji} ${SYM[p.sym].emoji} ${SYM[p.sym].emoji}`}
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
            <span style={s.walletAmt}>{loading ? "—" : (isMobile ? fmtShort(balance) : fmt(balance))}</span>
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
              outcome.multi === 0 ? (
                <span style={s.verdictLose}>Coba lagi</span>
              ) : outcome.multi === 1 ? (
                <div style={s.verdictWin}>
                  <span style={s.verdictSymbol}>
                    {SYM[outcome.paylineSyms?.[outcome.winPositions?.[0]]]?.emoji}
                  </span>
                  <div style={s.verdictText}>
                    <span style={s.verdictTitle}>2 Sejenis · Impas</span>
                    <span style={s.verdictSub}>{fmt(outcome.payout)} koin kembali</span>
                  </div>
                </div>
              ) : (
                <div style={s.verdictWin}>
                  <span style={s.verdictSymbol}>{SYM[outcome.sym]?.emoji}</span>
                  <div style={s.verdictText}>
                    <span style={s.verdictTitle}>
                      {outcome.n === 3 ? "3 Sejenis" : "2 Sejenis"} · {outcome.multi}×
                    </span>
                    <span style={s.verdictSub}>+{fmt(outcome.delta)} koin</span>
                  </div>
                </div>
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
              <span style={s.allInAmt}>{isMobile ? fmtShort(balance) : fmt(balance)} koin</span>
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
                {PAYOUT_DISPLAY.filter(p => p !== null && p.n === 3).map((p, i) => (
                  <div key={i} style={s.payoutRow}>
                    <span style={s.payoutSyms}>
                      {`${SYM[p.sym].emoji} ${SYM[p.sym].emoji} ${SYM[p.sym].emoji}`}
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
    width: "100%", overflow: "hidden",
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
  bets: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
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
  payoutDivider: { height: 1, background: C.line, margin: "4px 0" },

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
