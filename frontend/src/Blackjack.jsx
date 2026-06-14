import React, { useState, useEffect, useRef, useCallback } from "react";
import { BETS, fmt, fmtShort } from "./dadu/constants";
import { Store } from "./dadu/store";
import GameLogsPanel from "./GameLogsPanel";
import useIsMobile from "./useIsMobile";
import { playWin, playLose, playDiceLand } from "./sounds";

// ── CARD ENGINE ────────────────────────────────────────────────────────────────

const SUITS = ["♠", "♥", "♦", "♣"];
const RANKS = ["A","2","3","4","5","6","7","8","9","10","J","Q","K"];
const RED_S = new Set(["♥","♦"]);

function drawCard() {
  return {
    suit: SUITS[Math.floor(Math.random() * 4)],
    rank: RANKS[Math.floor(Math.random() * 13)],
    uid:  Math.random(),
  };
}

function cardPoints(c) {
  if (!c) return 0;
  if (["J","Q","K"].includes(c.rank)) return 10;
  if (c.rank === "A") return 11;
  return parseInt(c.rank, 10);
}

function handValue(hand) {
  let val = 0, aces = 0;
  for (const c of hand) { val += cardPoints(c); if (c.rank === "A") aces++; }
  while (val > 21 && aces > 0) { val -= 10; aces--; }
  return val;
}

const isNatural = (hand) => hand.length === 2 && handValue(hand) === 21;

// ── HOUSE BIAS ─────────────────────────────────────────────────────────────────
// 72% of the time dealer draws a card that aims to beat/tie player, making it ~3× harder to win

const HOUSE_BIAS = 0.72;

function rankValue(rank, currentTotal) {
  if (["J","Q","K"].includes(rank)) return 10;
  if (rank === "A") return currentTotal + 11 <= 21 ? 11 : 1;
  return parseInt(rank, 10);
}

function makeCard(rank) {
  return { rank, suit: SUITS[Math.floor(Math.random() * 4)], uid: Math.random() };
}

function drawDealer(dealerTotal, playerTotal, forceWin) {
  if (forceWin) {
    // Force dealer to bust: pick rank that puts dealer over 21
    const bustRanks = RANKS.filter(r => dealerTotal + rankValue(r, dealerTotal) > 21);
    if (bustRanks.length > 0)
      return makeCard(bustRanks[Math.floor(Math.random() * bustRanks.length)]);
    return drawCard(); // can't force bust from this total, draw randomly
  }
  if (Math.random() < HOUSE_BIAS) {
    // Prefer ranks that bring dealer to playerTotal..21 (beats or ties player)
    const targetMin = Math.max(17, playerTotal);
    const ideal = RANKS.filter(r => {
      const nxt = dealerTotal + rankValue(r, dealerTotal);
      return nxt >= targetMin && nxt <= 21;
    });
    if (ideal.length > 0) return makeCard(ideal[Math.floor(Math.random() * ideal.length)]);
    // Fallback: at least don't bust
    const safe = RANKS.filter(r => dealerTotal + rankValue(r, dealerTotal) <= 21);
    if (safe.length > 0) return makeCard(safe[Math.floor(Math.random() * safe.length)]);
  }
  return drawCard();
}

// ── CARD COMPONENT ─────────────────────────────────────────────────────────────

function Card({ card, faceDown = false, small = false }) {
  const W = small ? 50 : 62, H = small ? 72 : 88;
  const base = {
    width: W, height: H, borderRadius: 8, flexShrink: 0,
    boxShadow: "2px 4px 12px rgba(0,0,0,0.55), 0 1px 3px rgba(0,0,0,0.3)",
    position: "relative", overflow: "hidden",
    fontFamily: "'Space Mono', monospace", userSelect: "none",
  };
  if (faceDown) return (
    <div style={{ ...base, background: "#1c3a6e", border: "1px solid #2a4d8a" }}>
      <div style={{
        position: "absolute", inset: 4,
        border: "1px solid rgba(255,255,255,0.1)", borderRadius: 4,
        background: "repeating-linear-gradient(135deg,#1c3a6e 0,#1c3a6e 5px,#172f5c 5px,#172f5c 10px)",
      }} />
    </div>
  );
  const red   = RED_S.has(card.suit);
  const color = red ? "#C62828" : "#1a1a2e";
  const rf    = small ? 10 : 12;
  const sf    = small ? 15 : 19;
  return (
    <div style={{ ...base, background: "#FEFCF5", border: "1px solid rgba(0,0,0,0.1)" }}>
      <div style={{ position:"absolute", top:4, left:5, fontSize:rf, fontWeight:700, color, lineHeight:1.15 }}>
        {card.rank}<br/>{card.suit}
      </div>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center", fontSize:sf, color }}>
        {card.suit}
      </div>
      <div style={{ position:"absolute", bottom:4, right:5, fontSize:rf, fontWeight:700, color, lineHeight:1.15, transform:"rotate(180deg)" }}>
        {card.rank}<br/>{card.suit}
      </div>
    </div>
  );
}

// ── COMPONENT ──────────────────────────────────────────────────────────────────

const LOG_RESULT = { blackjack:"jackpot", win:"win", push:"impas", lose:"lose", bust:"lose" };

export default function Blackjack({ onTopUp }) {
  const [balance, setBalance]     = useState(null);
  const [bet, setBet]             = useState(1000);
  const [phase, setPhase]         = useState("bet");   // "bet"|"playing"|"dealer"|"done"
  const [pHand, setPHand]         = useState([]);
  const [dHand, setDHand]         = useState([]);
  const [revealed, setRevealed]   = useState(false);
  const [result, setResult]       = useState(null);
  const [roundBet, setRoundBet]   = useState(0);
  const [toast, setToast]         = useState(null);
  const [latestLog, setLatestLog] = useState(null);
  const isMobile = useIsMobile();

  const balRef      = useRef(null);
  const preDealBal  = useRef(0);
  const totalBetRef = useRef(0);
  const dealerTimer = useRef(null);
  const dealLock    = useRef(false);
  const forceWinRef = useRef(false);

  useEffect(() => {
    let alive = true;
    Store.load().then(v => {
      if (!alive) return;
      balRef.current = v;
      setBalance(v);
    });
    return () => { alive = false; clearTimeout(dealerTimer.current); };
  }, []);

  const flash = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2800);
  }, []);

  const updateBalance = useCallback((next) => {
    balRef.current = next;
    setBalance(next);
    Store.save(next);
  }, []);

  const logRound = useCallback((res, delta, ph, dh, totBet) => {
    const entry = {
      game: "blackjack",
      bet: totBet,
      result: LOG_RESULT[res] ?? "lose",
      delta,
      details: {
        playerCards: ph.map(c => c.rank + c.suit),
        dealerCards:  dh.map(c => c.rank + c.suit),
        playerValue:  handValue(ph),
        dealerValue:  handValue(dh),
      },
      forced: false,
      createdAt: new Date().toISOString(),
    };
    setLatestLog(entry);
    const token = localStorage.getItem("gf_token");
    fetch("/api/user/log", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...entry, balanceBefore: preDealBal.current, balanceAfter: balRef.current }),
    }).catch(() => {});
  }, []);

  const resolve = useCallback((res, ph, dh, totBet) => {
    let payout = 0, delta = 0;
    if (res === "blackjack") {
      const win  = Math.round(totBet * 1.5);
      payout = totBet + win;
      delta  = win;
    } else if (res === "win") {
      payout = totBet * 2;
      delta  = totBet;
    } else if (res === "push") {
      payout = totBet;
      delta  = 0;
    } else {
      payout = 0;
      delta  = -totBet;
    }

    updateBalance(balRef.current + payout);
    setResult(res);
    setPhase("done");

    if      (res === "blackjack") { flash("win",  `🃏 BLACKJACK! +${fmt(delta)} koin`); playWin(true); }
    else if (res === "win")       { flash("win",  `Menang! +${fmt(delta)} koin`);       playWin(); }
    else if (res === "push")      { flash("warn", `Push · ${fmt(totBet)} koin kembali`); }
    else if (res === "bust")      { flash("lose", `Bust! -${fmt(totBet)} koin`);         playLose(); }
    else                          { flash("lose", `-${fmt(totBet)} koin`);               playLose(); }

    logRound(res, delta, ph, dh, totBet);
  }, [updateBalance, flash, logRound]);

  const runDealer = useCallback((initDHand, finalPHand, totBet, forceWin = false) => {
    const pTotal = handValue(finalPHand);
    let cur = [...initDHand];
    const step = () => {
      const dTotal = handValue(cur);
      if (dTotal < 17) {
        cur = [...cur, drawDealer(dTotal, pTotal, forceWin)];
        setDHand([...cur]);
        playDiceLand();
        dealerTimer.current = setTimeout(step, 680);
      } else {
        const pVal = handValue(finalPHand);
        const dVal = handValue(cur);
        const res  = dVal > 21 || pVal > dVal ? "win" : pVal === dVal ? "push" : "lose";
        resolve(res, finalPHand, cur, totBet);
      }
    };
    dealerTimer.current = setTimeout(step, 720);
  }, [resolve]);

  // ── ACTIONS ──────────────────────────────────────────────────────────────────

  const deal = async () => {
    if (balance == null || balance < bet || phase !== "bet" || dealLock.current) return;
    dealLock.current = true;

    let forceWin = false;
    try {
      const token = localStorage.getItem("gf_token");
      const wRes = await fetch("/api/user/claim-win", {
        method: "POST", headers: { Authorization: `Bearer ${token}` },
      });
      if (wRes.ok) { const w = await wRes.json(); forceWin = w.win; }
    } catch (e) {}

    forceWinRef.current = forceWin;
    clearTimeout(dealerTimer.current);
    const ph = [drawCard(), drawCard()];
    const dh = [drawCard(), drawCard()];
    preDealBal.current  = balRef.current;
    totalBetRef.current = bet;
    updateBalance(balRef.current - bet);
    setPHand(ph); setDHand(dh);
    setRevealed(false); setResult(null); setRoundBet(bet);
    playDiceLand();
    dealLock.current = false;

    if (isNatural(ph)) {
      setRevealed(true);
      resolve(isNatural(dh) ? "push" : "blackjack", ph, dh, bet);
      return;
    }
    setPhase("playing");
  };

  const hit = () => {
    if (phase !== "playing") return;
    const newCard = drawCard();
    const newHand = [...pHand, newCard];
    setPHand(newHand);
    playDiceLand();
    if (handValue(newHand) > 21) {
      setRevealed(true);
      resolve("bust", newHand, dHand, totalBetRef.current);
    }
  };

  const stand = () => {
    if (phase !== "playing") return;
    setPhase("dealer"); setRevealed(true);
    runDealer(dHand, pHand, totalBetRef.current, forceWinRef.current);
  };

  const doubleDown = () => {
    if (phase !== "playing" || pHand.length !== 2 || balRef.current < bet) return;
    const newCard = drawCard();
    const newHand = [...pHand, newCard];
    const totBet  = bet * 2;
    totalBetRef.current = totBet;
    updateBalance(balRef.current - bet);
    setPHand(newHand); setRoundBet(totBet);
    playDiceLand();
    if (handValue(newHand) > 21) {
      setRevealed(true);
      resolve("bust", newHand, dHand, totBet);
    } else {
      setPhase("dealer"); setRevealed(true);
      runDealer(dHand, newHand, totBet, forceWinRef.current);
    }
  };

  const resetGame = () => {
    clearTimeout(dealerTimer.current);
    setPhase("bet"); setPHand([]); setDHand([]);
    setRevealed(false); setResult(null); setRoundBet(0);
  };

  // ── DERIVED ───────────────────────────────────────────────────────────────────

  const loading   = balance == null;
  const pVal      = handValue(pHand);
  const dValShow  = revealed ? handValue(dHand) : (dHand[0] ? cardPoints(dHand[0]) : 0);
  const canDeal   = !loading && balance >= bet && phase === "bet";
  const canDouble = phase === "playing" && pHand.length === 2 && !loading && balRef.current >= bet;
  const small     = isMobile;

  // ── RENDER ────────────────────────────────────────────────────────────────────

  return (
    <div style={{ ...s.root, padding: isMobile ? "12px 10px 40px" : "24px 20px 48px" }}>
      <style>{globalCss}</style>
      <div style={isMobile ? s.layoutMobile : s.layout}>

        {/* TABLE */}
        <div style={s.table}>

          {/* HEADER */}
          <header style={s.header}>
            <div style={{ display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:22 }}>🃏</span>
              <h1 style={s.title}>Blackjack</h1>
            </div>
            <button style={s.wallet} onClick={() => onTopUp?.()} disabled={loading}>
              <span style={s.walletLabel}>Saldo</span>
              <span style={s.walletAmt}>{loading ? "—" : (isMobile ? fmtShort(balance) : fmt(balance))}</span>
              <span style={s.walletCoin}>koin</span>
            </button>
          </header>

          {/* DEALER HAND */}
          <div style={s.handSection}>
            <div style={s.handMeta}>
              <span style={s.handTitle}>Dealer</span>
              {dHand.length > 0 && (
                <span style={s.valueBadge}>
                  {revealed ? handValue(dHand) : `${dValShow} + ?`}
                </span>
              )}
            </div>
            <div style={s.cardRow}>
              {dHand.length === 0
                ? <span style={s.placeholder}>Dealer belum dapat kartu</span>
                : dHand.map((c, i) => (
                    <Card key={c.uid} card={c} faceDown={!revealed && i === 1} small={small} />
                  ))
              }
            </div>
          </div>

          {/* RESULT BANNER or divider */}
          {result ? (
            <div style={{ ...s.resultBanner, ...RESULT_STYLE[result] }}>
              {RESULT_LABEL[result]}
            </div>
          ) : (
            <div style={s.divider} />
          )}

          {/* PLAYER HAND */}
          <div style={s.handSection}>
            <div style={s.handMeta}>
              <span style={s.handTitle}>Kamu</span>
              {pHand.length > 0 && (
                <span style={{
                  ...s.valueBadge,
                  ...(pVal > 21 ? s.valueBust : pVal === 21 ? s.valuePerfect : {}),
                }}>
                  {pVal}
                </span>
              )}
              {roundBet > 0 && (
                <span style={s.currentBet}>
                  Bet: {isMobile ? fmtShort(roundBet) : fmt(roundBet)}
                </span>
              )}
            </div>
            <div style={s.cardRow}>
              {pHand.length === 0
                ? <span style={s.placeholder}>Kartumu akan muncul di sini</span>
                : pHand.map(c => <Card key={c.uid} card={c} small={small} />)
              }
            </div>
          </div>

          {/* PHASE-BASED CONTROLS */}
          {phase === "playing" && (
            <>
              <div style={s.actions}>
                <button style={s.actionBtn} onClick={hit}>Hit</button>
                <button style={s.actionBtn} onClick={stand}>Stand</button>
                <button
                  style={{ ...s.actionBtn, ...(canDouble ? {} : s.actionOff) }}
                  onClick={doubleDown} disabled={!canDouble}
                >
                  Double
                </button>
              </div>
              <div style={s.notes}>
                <div style={s.noteItem}>
                  <span style={s.noteKey}>Hit</span>
                  <span style={s.noteDesc}>Minta satu kartu tambahan</span>
                </div>
                <div style={s.noteItem}>
                  <span style={s.noteKey}>Stand</span>
                  <span style={s.noteDesc}>Berhenti dan serahkan giliran ke dealer</span>
                </div>
                <div style={{ ...s.noteItem, ...(canDouble ? {} : s.noteItemOff) }}>
                  <span style={s.noteKey}>Double</span>
                  <span style={s.noteDesc}>Gandakan taruhan, ambil tepat satu kartu lagi</span>
                </div>
              </div>
            </>
          )}

          {phase === "dealer" && (
            <div style={s.dealerStatus}>Dealer mengambil kartu…</div>
          )}

          {phase === "done" && (
            <button style={s.newGameBtn} onClick={resetGame}>🔄 Main Lagi</button>
          )}

          {/* BET SECTION */}
          {phase === "bet" && (
            <div style={s.betSection}>
              <div style={s.sectionLabel}>Jumlah taruhan</div>
              <div style={s.betGrid}>
                {BETS.map(b => {
                  const tooMuch = !loading && b > balance;
                  return (
                    <button
                      key={b}
                      style={{ ...s.betBtn, ...(bet === b ? s.betOn : {}), ...(tooMuch ? s.betOff : {}) }}
                      onClick={() => !tooMuch && setBet(b)}
                      disabled={tooMuch}
                    >
                      {fmt(b)}
                    </button>
                  );
                })}
              </div>
              <button
                style={{ ...s.dealBtn, ...(!canDeal ? s.dealBtnOff : {}) }}
                onClick={deal} disabled={!canDeal}
              >
                {loading ? "Loading…"
                  : balance < bet ? "Saldo tidak cukup"
                  : `🃏 Bagikan · ${isMobile ? fmtShort(bet) : fmt(bet)} koin`}
              </button>
            </div>
          )}

        </div>

        {/* LOGS */}
        <GameLogsPanel game="blackjack" newEntry={latestLog} mobile={isMobile} />
      </div>

      {toast && (
        <div className={`bj-toast bj-toast--${toast.type}`}>{toast.text}</div>
      )}
    </div>
  );
}

// ── RESULT CONFIG ─────────────────────────────────────────────────────────────

const RESULT_LABEL = {
  blackjack: "🃏 BLACKJACK!",
  win:  "Menang!",
  push: "Push — Seri",
  bust: "Bust — Kalah",
  lose: "Kalah",
};

const RESULT_STYLE = {
  blackjack: {
    background: "linear-gradient(135deg,#D8A24A,#F2CB72)",
    color: "#14110E",
    boxShadow: "0 0 24px -6px #D8A24Aaa",
  },
  win:  { background:"#74C69018", color:"#74C690", border:"1px solid #74C69044" },
  push: { background:"#9C8E7818", color:"#C8B898", border:"1px solid #9C8E7844" },
  bust: { background:"#DC7C6818", color:"#DC7C68", border:"1px solid #DC7C6844" },
  lose: { background:"#DC7C6818", color:"#DC7C68", border:"1px solid #DC7C6844" },
};

// ── STYLES ────────────────────────────────────────────────────────────────────

const C = {
  ink:"#14110E", panel:"#211C17", card:"#1A1612",
  gold:"#D8A24A", goldHi:"#F2CB72", cream:"#F2EBDD",
  muted:"#9C8E78", line:"#3A322A",
};

const s = {
  root: {
    width:"100%", minHeight:"calc(100vh - 60px)",
    background:"radial-gradient(120% 90% at 50% -10%,#2a231b 0%,#14110E 55%)",
    display:"flex", alignItems:"flex-start", justifyContent:"center",
    boxSizing:"border-box", fontFamily:"'DM Sans',sans-serif",
  },
  layout: {
    display:"flex", flexDirection:"row", gap:24,
    alignItems:"flex-start", width:"100%", maxWidth:860,
  },
  layoutMobile: { display:"flex", flexDirection:"column", gap:16, width:"100%" },

  table: {
    flex:"1 1 auto",
    background:C.panel, border:`1px solid ${C.line}`, borderRadius:20, overflow:"hidden",
  },
  header: {
    display:"flex", alignItems:"center", justifyContent:"space-between",
    padding:"16px 20px", borderBottom:`1px solid ${C.line}`,
  },
  title: { fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:18, color:C.cream, margin:0 },
  wallet: {
    display:"flex", alignItems:"center", gap:6,
    background:C.card, border:`1px solid ${C.gold}44`,
    borderRadius:10, padding:"7px 14px", cursor:"pointer",
  },
  walletLabel: { fontSize:10, color:C.muted, textTransform:"uppercase", letterSpacing:"1px" },
  walletAmt: { fontFamily:"'Space Mono',monospace", fontWeight:700, fontSize:14, color:C.goldHi },
  walletCoin: { fontSize:10, color:C.muted },

  handSection: { padding:"18px 20px 0" },
  handMeta: { display:"flex", alignItems:"center", gap:8, marginBottom:10 },
  handTitle: { fontSize:11, fontWeight:700, color:C.muted, textTransform:"uppercase", letterSpacing:"1.5px" },
  valueBadge: {
    fontFamily:"'Space Mono',monospace", fontSize:12, fontWeight:700,
    color:C.cream, background:C.card, border:`1px solid ${C.line}`,
    borderRadius:6, padding:"2px 8px",
  },
  valueBust:    { color:"#DC7C68", borderColor:"#DC7C6844", background:"#DC7C6811" },
  valuePerfect: { color:C.goldHi,  borderColor:`${C.gold}55`, background:`${C.gold}11` },
  currentBet: {
    marginLeft:"auto", fontSize:11, color:C.muted,
    fontFamily:"'Space Mono',monospace",
  },
  cardRow: { display:"flex", gap:8, flexWrap:"wrap", minHeight:88, paddingBottom:4 },
  placeholder: { color:C.muted, fontSize:12, fontStyle:"italic", lineHeight:"88px", opacity:0.6 },

  divider: { height:1, background:C.line, margin:"16px 20px" },
  resultBanner: {
    margin:"12px 20px",
    borderRadius:12, padding:"13px 20px",
    fontFamily:"'Fraunces',serif", fontWeight:700, fontSize:20,
    textAlign:"center",
  },

  actions: { display:"flex", gap:10, padding:"18px 20px 10px" },
  notes: {
    margin:"0 20px 16px",
    background:C.card, border:`1px solid ${C.line}`,
    borderRadius:10, padding:"10px 14px",
    display:"flex", flexDirection:"column", gap:6,
  },
  noteItem: { display:"flex", alignItems:"baseline", gap:8 },
  noteItemOff: { opacity:0.35 },
  noteKey: {
    fontFamily:"'Space Mono',monospace", fontSize:11, fontWeight:700,
    color:C.goldHi, minWidth:46,
  },
  noteDesc: { fontSize:12, color:C.muted, lineHeight:1.4 },
  actionBtn: {
    flex:1, padding:"12px 0",
    background:C.card, border:`1px solid ${C.line}`,
    borderRadius:12, cursor:"pointer",
    color:C.cream, fontFamily:"'Space Mono',monospace",
    fontWeight:700, fontSize:14,
  },
  actionOff: { opacity:0.3, cursor:"not-allowed" },

  dealerStatus: {
    padding:"20px", textAlign:"center",
    color:C.muted, fontSize:13, fontStyle:"italic",
  },

  newGameBtn: {
    display:"block", margin:"18px 20px",
    width:"calc(100% - 40px)", boxSizing:"border-box",
    padding:"13px 0",
    background:`linear-gradient(135deg,${C.gold},${C.goldHi})`,
    border:"none", borderRadius:12, cursor:"pointer",
    color:C.ink, fontFamily:"'Space Mono',monospace",
    fontWeight:700, fontSize:14,
  },

  betSection: { padding:"16px 20px 20px" },
  sectionLabel: { fontSize:11, color:C.muted, textTransform:"uppercase", letterSpacing:"1px", marginBottom:10 },
  betGrid: { display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:8, marginBottom:12 },
  betBtn: {
    padding:"10px 0",
    background:C.card, border:`1px solid ${C.line}`,
    borderRadius:10, cursor:"pointer",
    color:C.cream, fontFamily:"'Space Mono',monospace",
    fontWeight:700, fontSize:12,
  },
  betOn:  { background:`${C.gold}22`, border:`1px solid ${C.gold}`, color:C.goldHi },
  betOff: { opacity:0.3, cursor:"not-allowed" },
  dealBtn: {
    width:"100%", padding:"13px 0",
    background:`linear-gradient(135deg,${C.gold},${C.goldHi})`,
    border:"none", borderRadius:12, cursor:"pointer",
    color:C.ink, fontFamily:"'Space Mono',monospace",
    fontWeight:700, fontSize:14,
  },
  dealBtnOff: { opacity:0.4, cursor:"not-allowed" },
};

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,700&family=DM+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
  .bj-toast {
    position: fixed; top: 32px; left: 50%; transform: translateX(-50%);
    padding: 11px 22px; border-radius: 999px;
    font-family: 'DM Sans', sans-serif; font-size: 14px; font-weight: 600;
    z-index: 100; white-space: nowrap;
    box-shadow: 0 8px 24px -4px #000a; pointer-events: none;
  }
  .bj-toast--win  { background:#1a3322; color:#74C690; border:1px solid #74C69044; }
  .bj-toast--lose { background:#3a1a18; color:#DC7C68; border:1px solid #DC7C6844; }
  .bj-toast--warn { background:#2a2010; color:#D8A24A; border:1px solid #D8A24A44; }
`;
