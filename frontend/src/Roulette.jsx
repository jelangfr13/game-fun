import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { BETS, fmt, fmtShort } from "./dadu/constants";
import { Store } from "./dadu/store";
import { startSlotSpin, playReelStop, playWin, playLose } from "./sounds";
import GameLogsPanel from "./GameLogsPanel";
import useIsMobile from "./useIsMobile";

const WHEEL = [0, 32, 15, 19, 4, 21, 2, 25, 17, 34, 6, 27, 13, 36, 11, 30, 8, 23, 10, 5, 24, 16, 33, 1, 20, 14, 31, 9, 22, 18, 29, 7, 28, 12, 35, 3, 26];
const RED = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);
const SEGMENT = 360 / WHEEL.length;
const SPIN_MS = 3200;

const BET_OPTIONS = [
  { type: "color", value: "red", label: "Merah", hint: "2x", tone: "red" },
  { type: "color", value: "black", label: "Hitam", hint: "2x", tone: "black" },
  { type: "parity", value: "odd", label: "Ganjil", hint: "2x" },
  { type: "parity", value: "even", label: "Genap", hint: "2x" },
  { type: "range", value: "low", label: "1-18", hint: "2x" },
  { type: "range", value: "high", label: "19-36", hint: "2x" },
  { type: "dozen", value: 1, label: "Lusin 1", hint: "3x" },
  { type: "dozen", value: 2, label: "Lusin 2", hint: "3x" },
  { type: "dozen", value: 3, label: "Lusin 3", hint: "3x" },
  { type: "column", value: 1, label: "Kolom 1", hint: "3x" },
  { type: "column", value: 2, label: "Kolom 2", hint: "3x" },
  { type: "column", value: 3, label: "Kolom 3", hint: "3x" },
];

function numberColor(n) {
  if (n === 0) return "green";
  return RED.has(n) ? "red" : "black";
}

function labelBet(bet) {
  if (bet.type === "straight") return `Angka ${bet.value}`;
  const option = BET_OPTIONS.find(o => o.type === bet.type && o.value === bet.value);
  return option?.label ?? "Taruhan";
}

function payoutMultiplier(bet) {
  if (bet.type === "straight") return 36;
  if (bet.type === "dozen" || bet.type === "column") return 3;
  return 2;
}

function isWinningBet(bet, n) {
  if (bet.type === "straight") return n === bet.value;
  if (n === 0) return false;
  if (bet.type === "color") return numberColor(n) === bet.value;
  if (bet.type === "parity") return bet.value === "odd" ? n % 2 === 1 : n % 2 === 0;
  if (bet.type === "range") return bet.value === "low" ? n >= 1 && n <= 18 : n >= 19 && n <= 36;
  if (bet.type === "dozen") return Math.ceil(n / 12) === bet.value;
  if (bet.type === "column") return ((n - 1) % 3) + 1 === bet.value;
  return false;
}

function pickNumberForBet(bet, wantWin) {
  const candidates = Array.from({ length: 37 }, (_, n) => n).filter(n => isWinningBet(bet, n) === wantWin);
  return candidates[Math.floor(Math.random() * candidates.length)];
}

function randomNumber() {
  return Math.floor(Math.random() * 37);
}

export default function Roulette({ onTopUp }) {
  const [balance, setBalance] = useState(null);
  const [bet, setBet] = useState(1000);
  const [selection, setSelection] = useState({ type: "color", value: "red" });
  const [spinning, setSpinning] = useState(false);
  const [rotation, setRotation] = useState(0);
  const [displayNumber, setDisplayNumber] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [toast, setToast] = useState(null);
  const [latestLog, setLatestLog] = useState(null);
  const isMobile = useIsMobile();

  const spinLock = useRef(false);
  const stopSound = useRef(null);
  const spinTimer = useRef(null);
  const tickTimer = useRef(null);

  useEffect(() => {
    let alive = true;
    Store.load().then(v => { if (alive) setBalance(v); });
    return () => {
      alive = false;
      clearTimeout(spinTimer.current);
      clearInterval(tickTimer.current);
      stopSound.current?.();
    };
  }, []);

  const flash = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const updateBalance = useCallback((next) => {
    setBalance(next);
    Store.save(next);
  }, []);

  const wheelGradient = useMemo(() => {
    return WHEEL.map((n, i) => {
      const color = n === 0 ? C.green : RED.has(n) ? C.red : C.black;
      const start = i * SEGMENT;
      const end = (i + 1) * SEGMENT;
      return `${color} ${start}deg ${end}deg`;
    }).join(", ");
  }, []);

  const spin = async () => {
    if (spinLock.current || spinning || balance == null || balance < bet) return;
    spinLock.current = true;

    let forcedWin = false;
    let forcedLose = false;
    try {
      const token = localStorage.getItem("gf_token");
      const [wRes, lRes] = await Promise.all([
        fetch("/api/user/claim-win", { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/user/claim-lose", { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (wRes.ok) forcedWin = (await wRes.json()).win;
      if (lRes.ok) forcedLose = (await lRes.json()).lose;
    } catch {
      /* Ignore control API failures; random roulette continues. */
    }

    const number = forcedWin
      ? pickNumberForBet(selection, true)
      : forcedLose
      ? pickNumberForBet(selection, false)
      : randomNumber();
    const won = isWinningBet(selection, number);
    const multiplier = won ? payoutMultiplier(selection) : 0;
    const payout = bet * multiplier;
    const delta = payout - bet;
    const color = numberColor(number);
    const index = WHEEL.indexOf(number);
    const targetAngle = 360 - (index * SEGMENT + SEGMENT / 2);
    const currentAngle = ((rotation % 360) + 360) % 360;
    const targetRotation = rotation + 1440 + ((targetAngle - currentAngle + 360) % 360);

    setOutcome(null);
    setSpinning(true);
    setBalance(balance - bet);
    setDisplayNumber(null);
    setRotation(targetRotation);
    stopSound.current = startSlotSpin();

    clearInterval(tickTimer.current);
    tickTimer.current = setInterval(() => setDisplayNumber(randomNumber()), 90);

    clearTimeout(spinTimer.current);
    spinTimer.current = setTimeout(() => {
      clearInterval(tickTimer.current);
      stopSound.current?.();
      stopSound.current = null;
      playReelStop();
      spinLock.current = false;
      setSpinning(false);
      setDisplayNumber(number);

      const finalBalance = balance - bet + payout;
      updateBalance(finalBalance);
      const spinResult = { number, color, bet: selection, won, multiplier, payout, delta };
      setOutcome(spinResult);

      if (won) {
        flash("win", `Menang! +${fmt(delta)} koin`);
        playWin(multiplier >= 36);
      } else {
        flash("lose", `-${fmt(bet)} koin`);
        playLose();
      }

      const logEntry = {
        game: "roulette",
        bet,
        result: won ? "win" : "lose",
        delta,
        details: { number, color, betType: selection.type, betValue: selection.value, multiplier },
        forced: forcedWin || forcedLose,
        createdAt: new Date().toISOString(),
      };
      setLatestLog(logEntry);
      fetch("/api/user/log", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("gf_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...logEntry, balanceBefore: balance, balanceAfter: finalBalance }),
      }).catch(() => {});
    }, SPIN_MS);
  };

  const loading = balance == null;
  const canSpin = !spinning && !loading && balance >= bet;
  const activeLabel = labelBet(selection);

  return (
    <div className="roulette-root" style={{ ...s.root, ...(isMobile ? s.rootMobile : {}) }}>
      <style>{globalCss}</style>
      <div className="roulette-layout" style={isMobile ? s.layoutMobile : s.layout}>
        <main className="roulette-table" style={isMobile ? { ...s.table, width: "100%" } : s.table}>
          <header style={s.header}>
            <div style={s.brand}>
              <span style={s.brandIcon}>◉</span>
              <h1 style={s.brandTitle}>Roulette</h1>
            </div>
            <button style={s.wallet} onClick={() => onTopUp?.()} disabled={loading}>
              <span style={s.walletLabel}>Saldo</span>
              <span style={s.walletAmt}>{loading ? "-" : (isMobile ? fmtShort(balance) : fmt(balance))}</span>
              <span style={s.walletUnit}>koin</span>
            </button>
          </header>

          <div className="roulette-board" style={isMobile ? undefined : s.desktopBoard}>
            <section className="roulette-wheel-panel" style={isMobile ? s.wheelPanel : { ...s.wheelPanel, ...s.wheelPanelDesktop }}>
              <div style={s.wheelWrap}>
                <div style={s.pointer} />
                <div
                  style={{
                    ...s.wheel,
                    background: `conic-gradient(${wheelGradient})`,
                    transform: `rotate(${rotation}deg)`,
                    transition: spinning ? `transform ${SPIN_MS}ms cubic-bezier(.12,.72,.18,1)` : "none",
                  }}
                >
                  <div style={s.innerRing}>
                    <span style={s.innerText}>{spinning ? "SPIN" : "GF"}</span>
                  </div>
                  {WHEEL.map((n, i) => (
                    <span
                      key={n}
                      style={{
                        ...s.pocketLabel,
                        transform: `rotate(${i * SEGMENT + SEGMENT / 2}deg) translateY(-112px) rotate(90deg)`,
                      }}
                    >
                      {n}
                    </span>
                  ))}
                </div>
              </div>
              <div style={s.resultDock}>
                <div style={{ ...s.resultBall, ...s[`ball_${numberColor(displayNumber ?? 0)}`] }}>
                  {displayNumber ?? "-"}
                </div>
              <div style={s.resultText}>
                <span style={s.resultKicker}>{spinning ? "Bola berputar" : outcome ? "Hasil putaran" : "Taruhan aktif"}</span>
                <strong style={s.resultTitle}>
                  {outcome ? `${outcome.number} · ${outcome.color === "red" ? "Merah" : outcome.color === "black" ? "Hitam" : "Hijau"}` : activeLabel}
                </strong>
                  <span style={{ ...s.resultSub, ...(outcome?.won ? s.winText : outcome ? s.loseText : {}) }}>
                    {outcome ? (outcome.won ? `+${fmt(outcome.delta)} koin` : "Taruhan kalah") : `${payoutMultiplier(selection)}x pembayaran`}
                </span>
              </div>
            </div>
            <div style={s.guide}>
              <div style={s.guideHead}>
                <span style={s.guideIcon}>?</span>
                <span>Petunjuk permainan</span>
              </div>
              <div style={s.guideGrid}>
                <span>Pilih angka tunggal untuk pembayaran 36x.</span>
                <span>Merah, hitam, ganjil, genap, 1-18, dan 19-36 membayar 2x.</span>
                <span>Lusin dan kolom membayar 3x.</span>
                <span>Angka 0 hanya menang jika dipilih langsung.</span>
              </div>
            </div>
          </section>

            <div className="roulette-controls" style={isMobile ? undefined : s.desktopControls}>
              <section style={s.block}>
                <div style={s.blockLabel}>Pilih angka</div>
                <div className="roulette-number-grid" style={isMobile ? s.numberGridMobile : s.numberGrid}>
                  <button
                    className="roulette-zero"
                    style={{
                      ...s.zeroBtn,
                      ...(isMobile ? s.zeroBtnMobile : {}),
                      ...(selection.type === "straight" && selection.value === 0 ? s.selectedGreen : {}),
                    }}
                    onClick={() => setSelection({ type: "straight", value: 0 })}
                    disabled={spinning}
                  >
                    0
                  </button>
                  {Array.from({ length: 36 }, (_, i) => i + 1).map(n => {
                    const color = numberColor(n);
                    const selected = selection.type === "straight" && selection.value === n;
                    return (
                      <button
                        key={n}
                        style={{
                          ...s.numBtn,
                          ...(color === "red" ? s.numRed : s.numBlack),
                          ...(selected ? (color === "red" ? s.selectedRed : s.selectedBlack) : {}),
                        }}
                        onClick={() => setSelection({ type: "straight", value: n })}
                        disabled={spinning}
                      >
                        {n}
                      </button>
                    );
                  })}
                </div>
              </section>

              <section style={s.block}>
                <div style={s.blockLabel}>Taruhan luar</div>
                <div className="roulette-option-grid" style={isMobile ? s.optionGridMobile : s.optionGrid}>
                  {BET_OPTIONS.map(option => {
                    const selected = selection.type === option.type && selection.value === option.value;
                    return (
                      <button
                        key={`${option.type}-${option.value}`}
                        style={{
                          ...s.optionBtn,
                          ...(option.tone === "red" ? s.optionRed : {}),
                          ...(option.tone === "black" ? s.optionBlack : {}),
                          ...(selected ? s.optionSelected : {}),
                        }}
                        onClick={() => setSelection({ type: option.type, value: option.value })}
                        disabled={spinning}
                      >
                        <span>{option.label}</span>
                        <small>{option.hint}</small>
                      </button>
                    );
                  })}
                </div>
              </section>

              <section style={s.block}>
                <div style={s.blockLabel}>Jumlah taruhan</div>
                <div className="roulette-bets" style={isMobile ? s.betsMobile : s.bets}>
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
                  <span>ALL IN</span>
                  {!loading && balance > 0 && (
                    <span style={s.allInAmt}>{isMobile ? fmtShort(balance) : fmt(balance)} koin</span>
                  )}
                </button>
              </section>

              <button style={{ ...s.spinBtn, ...(!canSpin ? s.spinDisabled : {}) }} onClick={spin} disabled={!canSpin}>
                {spinning ? "Memutar roda..." : balance < bet ? "Saldo tidak cukup" : `Putar · ${fmt(bet)} koin`}
              </button>

              {balance === 0 && !spinning && (
                <p style={s.broke}>Saldo habis. Klik tombol Saldo untuk top-up.</p>
              )}
            </div>
          </div>
        </main>

        <div className="roulette-logs">
          <GameLogsPanel game="roulette" newEntry={latestLog} mobile={isMobile} />
        </div>
      </div>
      {toast && <div style={{ ...s.toast, ...s[`toast_${toast.type}`] }}>{toast.text}</div>}
    </div>
  );
}

const C = {
  ink: "#10130f",
  panel: "#181d17",
  panel2: "#20281f",
  green: "#16895f",
  greenHi: "#44c28e",
  red: "#b63a32",
  black: "#171717",
  gold: "#D8A24A",
  goldHi: "#F2CB72",
  cream: "#F2EBDD",
  muted: "#96a08d",
  line: "#334034",
  win: "#74C690",
  lose: "#DC7C68",
};

const s = {
  root: {
    minHeight: "calc(100vh - 74px)",
    width: "100%",
    background: `radial-gradient(120% 90% at 50% -10%, #24402f 0%, ${C.ink} 58%)`,
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: C.cream,
    display: "flex",
    justifyContent: "center",
    alignItems: "flex-start",
    padding: "20px 24px 40px",
    boxSizing: "border-box",
  },
  rootMobile: { padding: "12px 10px 40px" },
  layout: { display: "flex", gap: 24, alignItems: "flex-start", width: "100%", maxWidth: 1220 },
  layoutMobile: { display: "flex", flexDirection: "column", gap: 16, width: "100%", overflow: "hidden" },
  table: { width: 900, flex: "0 0 auto" },
  header: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 18 },
  brand: { display: "flex", alignItems: "center", gap: 10 },
  brandIcon: { fontSize: 28, color: C.red, textShadow: `0 0 18px ${C.red}` },
  brandTitle: { fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 24, margin: 0, color: C.cream },
  wallet: {
    display: "flex", alignItems: "baseline", gap: 6,
    background: "linear-gradient(180deg, #222a21, #141a13)",
    border: `1px solid ${C.line}`, borderRadius: 14,
    padding: "9px 14px", cursor: "pointer", color: C.cream,
  },
  walletLabel: { fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "1px" },
  walletAmt: { fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 17, color: C.goldHi },
  walletUnit: { fontSize: 10, color: C.muted },
  wheelPanel: {
    background: `radial-gradient(120% 120% at 50% 0%, ${C.panel2}, ${C.panel})`,
    border: `1px solid ${C.line}`, borderRadius: 22,
    padding: 20, marginBottom: 16,
    boxShadow: "0 20px 50px -22px #000, inset 0 1px 0 #ffffff12",
  },
  wheelPanelDesktop: {
    width: 372,
    flex: "0 0 372px",
    marginBottom: 0,
    padding: 18,
    boxSizing: "border-box",
  },
  desktopBoard: {
    display: "grid",
    gridTemplateColumns: "372px minmax(0, 1fr)",
    gap: 16,
    alignItems: "start",
  },
  desktopControls: {
    background: "linear-gradient(180deg, #172017, #111610)",
    border: `1px solid ${C.line}`,
    borderRadius: 18,
    padding: 16,
    boxSizing: "border-box",
    boxShadow: "0 18px 42px -24px #000",
  },
  wheelWrap: {
    width: 292, height: 292, margin: "0 auto", position: "relative",
    display: "flex", alignItems: "center", justifyContent: "center",
  },
  pointer: {
    position: "absolute", top: -2, left: "50%", transform: "translateX(-50%)",
    width: 0, height: 0, borderLeft: "10px solid transparent", borderRight: "10px solid transparent",
    borderTop: `22px solid ${C.goldHi}`, zIndex: 5, filter: "drop-shadow(0 2px 4px #0008)",
  },
  wheel: {
    width: 270, height: 270, borderRadius: "50%", position: "relative",
    border: `10px solid ${C.gold}`, boxShadow: "inset 0 0 0 8px #111, 0 16px 34px -16px #000",
  },
  innerRing: {
    position: "absolute", inset: 74, borderRadius: "50%", background: "radial-gradient(circle, #2b3a27, #10130f)",
    border: `5px solid ${C.goldHi}`, display: "flex", alignItems: "center", justifyContent: "center",
    zIndex: 2,
  },
  innerText: { fontFamily: "'Space Mono', monospace", color: C.goldHi, fontWeight: 700, fontSize: 16, letterSpacing: "1px" },
  pocketLabel: {
    position: "absolute", left: "50%", top: "50%", width: 24, marginLeft: -12, marginTop: -8,
    color: "#fff", fontSize: 9, fontFamily: "'Space Mono', monospace", fontWeight: 700,
    textAlign: "center", transformOrigin: "50% 8px", textShadow: "0 1px 2px #000",
  },
  resultDock: {
    marginTop: 14, display: "flex", alignItems: "center", justifyContent: "center", gap: 12,
  },
  resultBall: {
    width: 52, height: 52, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center",
    fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 18,
    border: "2px solid #ffffff66", boxShadow: "0 8px 20px -10px #000",
  },
  ball_red: { background: C.red, color: "#fff" },
  ball_black: { background: "#111", color: "#fff" },
  ball_green: { background: C.green, color: "#fff" },
  resultText: { display: "flex", flexDirection: "column", gap: 2, minWidth: 150 },
  resultKicker: { color: C.muted, fontSize: 11, textTransform: "uppercase", letterSpacing: "1px" },
  resultTitle: { color: C.cream, fontSize: 16 },
  resultSub: { color: C.goldHi, fontSize: 13 },
  winText: { color: C.win },
  loseText: { color: C.lose },
  guide: {
    marginTop: 14,
    padding: "11px 12px",
    borderRadius: 12,
    background: "#10170f99",
    border: `1px solid ${C.line}`,
  },
  guideHead: {
    display: "flex",
    alignItems: "center",
    gap: 7,
    marginBottom: 8,
    color: C.goldHi,
    fontSize: 12,
    fontWeight: 700,
  },
  guideIcon: {
    width: 18,
    height: 18,
    borderRadius: "50%",
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    border: `1px solid ${C.gold}88`,
    fontFamily: "'Space Mono', monospace",
    fontSize: 11,
  },
  guideGrid: {
    display: "grid",
    gridTemplateColumns: "1fr",
    gap: 5,
    color: C.muted,
    fontSize: 11,
    lineHeight: 1.35,
  },
  block: { marginBottom: 12 },
  blockLabel: { fontSize: 11, textTransform: "uppercase", letterSpacing: "1.3px", color: C.muted, marginBottom: 8 },
  numberGrid: {
    display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 5,
  },
  numberGridMobile: {
    display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6,
  },
  zeroBtn: {
    gridColumn: "span 12", minHeight: 34, borderRadius: 8, cursor: "pointer",
    border: `1px solid ${C.greenHi}66`, background: "#133a2b", color: "#fff",
    fontFamily: "'Space Mono', monospace", fontWeight: 700,
  },
  zeroBtnMobile: { gridColumn: "span 6" },
  numBtn: {
    aspectRatio: "1 / 1", minWidth: 0, borderRadius: 7, cursor: "pointer",
    border: "1px solid #ffffff18", color: "#fff", fontFamily: "'Space Mono', monospace",
    fontWeight: 700, fontSize: 12,
  },
  numRed: { background: C.red },
  numBlack: { background: C.black },
  selectedRed: { boxShadow: `0 0 0 2px ${C.goldHi}`, borderColor: C.goldHi, background: "#d24a40" },
  selectedBlack: { boxShadow: `0 0 0 2px ${C.goldHi}`, borderColor: C.goldHi, background: "#2a2a2a" },
  selectedGreen: { boxShadow: `0 0 0 2px ${C.goldHi}`, borderColor: C.goldHi, background: C.green },
  optionGrid: { display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 7 },
  optionGridMobile: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 },
  optionBtn: {
    minHeight: 44, borderRadius: 10, border: `1px solid ${C.line}`,
    background: C.panel, color: C.cream, cursor: "pointer",
    display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 2,
    fontWeight: 700,
  },
  optionRed: { borderColor: "#b63a3266", background: "#301716" },
  optionBlack: { borderColor: "#ffffff22", background: "#151515" },
  optionSelected: { borderColor: C.goldHi, color: C.goldHi, boxShadow: `0 0 0 1px ${C.goldHi}` },
  bets: { display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 },
  betsMobile: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: 8 },
  betBtn: {
    background: C.panel, border: `1px solid ${C.line}`, borderRadius: 10, padding: "11px 4px",
    color: C.cream, fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13, cursor: "pointer",
  },
  betActive: { border: `1px solid ${C.gold}`, color: C.ink, background: `linear-gradient(180deg, ${C.goldHi}, ${C.gold})` },
  betDisabled: { opacity: 0.32, cursor: "not-allowed" },
  allIn: {
    width: "100%", marginTop: 8, padding: "11px 16px",
    background: "linear-gradient(135deg, #2e1e06, #1e1408)", border: "1px solid #D8A24A88",
    borderRadius: 10, cursor: "pointer", color: C.goldHi,
    fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 13,
    display: "flex", alignItems: "center", justifyContent: "space-between",
  },
  allInActive: { background: `linear-gradient(135deg, ${C.gold}, ${C.goldHi})`, color: C.ink, boxShadow: "0 0 22px -8px #D8A24Aaa" },
  allInOff: { opacity: 0.35, cursor: "not-allowed" },
  allInAmt: { fontSize: 12, fontWeight: 400, opacity: 0.8 },
  spinBtn: {
    width: "100%", marginBottom: 8, padding: 15, border: "none", borderRadius: 14, cursor: "pointer",
    fontFamily: "'Fraunces', serif", fontWeight: 700, fontSize: 18, color: C.ink,
    background: `linear-gradient(180deg, ${C.goldHi}, ${C.gold})`,
    boxShadow: `0 10px 28px -10px ${C.gold}`,
  },
  spinDisabled: { background: "#20281f", color: C.muted, boxShadow: "none", cursor: "not-allowed" },
  broke: { textAlign: "center", color: C.lose, fontSize: 13, marginTop: 8 },
  toast: {
    position: "fixed", left: "50%", top: 28, transform: "translateX(-50%)",
    padding: "12px 22px", borderRadius: 999, fontWeight: 700, fontSize: 14,
    fontFamily: "'Space Mono', monospace", boxShadow: "0 12px 30px -10px #000", zIndex: 30,
    whiteSpace: "nowrap",
  },
  toast_win: { background: C.win, color: "#0c2415" },
  toast_lose: { background: C.lose, color: "#2a0c08" },
};

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=DM+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
  button:disabled { cursor: not-allowed; }
  @media (max-width: 768px) {
    .roulette-root {
      padding: 12px 10px 40px !important;
      display: block !important;
      overflow-x: hidden !important;
    }
    .roulette-layout {
      display: flex !important;
      flex-direction: column !important;
      gap: 16px !important;
      width: 100% !important;
      max-width: 100% !important;
      overflow: hidden !important;
    }
    .roulette-table {
      width: 100% !important;
      max-width: 100% !important;
      flex: 1 1 auto !important;
      min-width: 0 !important;
    }
    .roulette-board {
      display: block !important;
      width: 100% !important;
    }
    .roulette-wheel-panel,
    .roulette-controls {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
    }
    .roulette-wheel-panel {
      margin-bottom: 16px !important;
      padding: 16px 12px !important;
    }
    .roulette-controls {
      padding: 0 !important;
      background: transparent !important;
      border: 0 !important;
      box-shadow: none !important;
    }
    .roulette-number-grid {
      display: grid !important;
      grid-template-columns: repeat(6, minmax(0, 1fr)) !important;
      gap: 6px !important;
    }
    .roulette-zero {
      grid-column: span 6 !important;
    }
    .roulette-option-grid,
    .roulette-bets {
      display: grid !important;
      grid-template-columns: repeat(2, minmax(0, 1fr)) !important;
      gap: 8px !important;
    }
    .roulette-logs {
      width: 100% !important;
      max-width: 100% !important;
      min-width: 0 !important;
    }
    .roulette-logs > div {
      width: 100% !important;
      max-width: 100% !important;
      box-sizing: border-box !important;
      position: static !important;
      max-height: 320px !important;
      flex-shrink: 1 !important;
    }
    button { min-height: 34px; }
  }
`;
