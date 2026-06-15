import { useCallback, useEffect, useRef, useState } from "react";
import { BETS, fmt, fmtShort } from "./dadu/constants";
import { Store } from "./dadu/store";
import { playDiceLand, playLose, playWin } from "./sounds";
import GameLogsPanel from "./GameLogsPanel";
import useIsMobile from "./useIsMobile";

const BASE_CARDS = 3;
const MAX_CARDS = 12;
const CARD_REVEAL_MS = 720;
const DECOY_CARDS = [
  "2C",
  "3S",
  "4D",
  "5C",
  "6S",
  "7D",
  "8C",
  "9S",
  "TC",
  "2D",
  "3C",
  "4S",
];

function randomHeartIndex(cardCount) {
  return Math.floor(Math.random() * cardCount);
}

function cardLabel(index) {
  return `Kartu ${index + 1}`;
}

function cardGridColumns(cardCount, mobile) {
  if (mobile) return "repeat(3, minmax(0, 1fr))";
  if (cardCount <= 4) return `repeat(${cardCount}, minmax(104px, 148px))`;
  if (cardCount <= 9) return "repeat(3, minmax(110px, 150px))";
  return "repeat(4, minmax(98px, 132px))";
}

function cardAsset(index, isHeart) {
  const card = isHeart ? "AH" : DECOY_CARDS[index % DECOY_CARDS.length];
  return `/cardsjs/${card}.svg`;
}

function HiddenCard({ index, disabled, selected, revealed, isHeart, onPick }) {
  const faceUp = revealed;
  const cardSrc = faceUp ? cardAsset(index, isHeart) : "/cardsjs/RED_BACK.svg";

  return (
    <button
      type="button"
      style={{
        ...s.card,
        ...(selected ? s.cardSelected : {}),
        ...(disabled ? s.cardDisabled : {}),
        ...(faceUp ? s.cardRevealed : {}),
      }}
      onClick={() => onPick(index)}
      disabled={disabled}
      aria-label={cardLabel(index)}
    >
      {!faceUp && <span style={s.cardCorner}>{index + 1}</span>}
      <img
        src={cardSrc}
        alt={faceUp ? (isHeart ? "As Hati" : "Kartu kosong") : "Kartu tertutup"}
        draggable="false"
        style={s.cardImg}
      />
    </button>
  );
}

export default function FindTheHeart({ onTopUp }) {
  const [balance, setBalance] = useState(null);
  const [bet, setBet] = useState(1000);
  const [phase, setPhase] = useState("bet");
  const [cardCount, setCardCount] = useState(BASE_CARDS);
  const [doubleCount, setDoubleCount] = useState(0);
  const [roundStake, setRoundStake] = useState(0);
  const [heartIndex, setHeartIndex] = useState(randomHeartIndex(BASE_CARDS));
  const [selectedIndex, setSelectedIndex] = useState(null);
  const [outcome, setOutcome] = useState(null);
  const [toast, setToast] = useState(null);
  const [latestLog, setLatestLog] = useState(null);
  const isMobile = useIsMobile();

  const balRef = useRef(null);
  const roundStartBal = useRef(0);
  const forcedRef = useRef({ win: false, lose: false });
  const revealTimer = useRef(null);
  const actionLock = useRef(false);

  useEffect(() => {
    let alive = true;
    Store.load().then((value) => {
      if (!alive) return;
      balRef.current = value;
      setBalance(value);
    });
    return () => {
      alive = false;
      clearTimeout(revealTimer.current);
    };
  }, []);

  const flash = useCallback((type, text) => {
    setToast({ type, text });
    setTimeout(() => setToast(null), 2600);
  }, []);

  const updateBalance = useCallback((next) => {
    balRef.current = next;
    setBalance(next);
    Store.save(next);
  }, []);

  const startRound = async () => {
    if (phase !== "bet" || balance == null || balance < bet || actionLock.current) return;
    actionLock.current = true;

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
      /* The game remains playable if the control API is unavailable. */
    }

    roundStartBal.current = balRef.current;
    forcedRef.current = { win: forcedWin, lose: forcedLose && !forcedWin };
    updateBalance(balRef.current - bet);
    setCardCount(BASE_CARDS);
    setDoubleCount(0);
    setRoundStake(bet);
    setHeartIndex(randomHeartIndex(BASE_CARDS));
    setSelectedIndex(null);
    setOutcome(null);
    setPhase("playing");
    playDiceLand();
    actionLock.current = false;
  };

  const doublePrice = () => {
    if (phase !== "playing" || selectedIndex != null) return;
    const cardsToAdd = doubleCount + 1;
    const nextCards = cardCount + cardsToAdd;

    if (nextCards > MAX_CARDS) {
      flash("warn", `Maksimal ${MAX_CARDS} kartu di meja.`);
      return;
    }
    if (balRef.current < roundStake) {
      flash("warn", "Saldo tidak cukup untuk double.");
      return;
    }

    const nextStake = roundStake * 2;
    updateBalance(balRef.current - roundStake);
    setRoundStake(nextStake);
    setCardCount(nextCards);
    setDoubleCount((count) => count + 1);
    setHeartIndex(randomHeartIndex(nextCards));
    playDiceLand();
  };

  const pickCard = (index) => {
    if (phase !== "playing" || selectedIndex != null) return;

    let finalHeart = heartIndex;
    if (forcedRef.current.win) {
      finalHeart = index;
    } else if (forcedRef.current.lose) {
      finalHeart = Array.from({ length: cardCount }, (_, i) => i).find((i) => i !== index) ?? index;
    }

    const won = index === finalHeart;
    const payout = won ? roundStake * 2 : 0;
    const delta = payout - roundStake;
    const finalBalance = balRef.current + payout;

    setSelectedIndex(index);
    setHeartIndex(finalHeart);
    setOutcome(null);
    setPhase("revealing");
    clearTimeout(revealTimer.current);
    revealTimer.current = setTimeout(() => {
      updateBalance(finalBalance);
      setOutcome({ won, delta, payout, selectedIndex: index, heartIndex: finalHeart });
      setPhase("done");

      if (won) {
        flash("win", `As Hati ditemukan! +${fmt(delta)} koin`);
        playWin(doubleCount >= 2);
      } else {
        flash("lose", `As Hati ada di ${cardLabel(finalHeart)}. -${fmt(roundStake)} koin`);
        playLose();
      }

      const logEntry = {
        game: "find-the-heart",
        bet: roundStake,
        result: won ? "win" : "lose",
        delta,
        details: {
          cardCount,
          doubleCount,
          selectedCard: index + 1,
          heartCard: finalHeart + 1,
          multiplier: won ? 2 : 0,
        },
        forced: forcedRef.current.win || forcedRef.current.lose,
        createdAt: new Date().toISOString(),
      };
      setLatestLog(logEntry);
      fetch("/api/user/log", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("gf_token")}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...logEntry,
          balanceBefore: roundStartBal.current,
          balanceAfter: finalBalance,
        }),
      }).catch(() => {});
    }, CARD_REVEAL_MS);
  };

  const resetRound = () => {
    clearTimeout(revealTimer.current);
    setPhase("bet");
    setCardCount(BASE_CARDS);
    setDoubleCount(0);
    setRoundStake(0);
    setHeartIndex(randomHeartIndex(BASE_CARDS));
    setSelectedIndex(null);
    setOutcome(null);
    forcedRef.current = { win: false, lose: false };
  };

  const loading = balance == null;
  const canStart = phase === "bet" && !loading && balance >= bet;
  const nextDoubleCards = doubleCount + 1;
  const canDouble = phase === "playing"
    && selectedIndex == null
    && !loading
    && balance >= roundStake
    && cardCount + nextDoubleCards <= MAX_CARDS;
  const potentialWin = phase === "playing" ? roundStake * 2 : bet * 2;
  const gridStyle = {
    ...s.cardGrid,
    gridTemplateColumns: cardGridColumns(cardCount, isMobile),
  };

  return (
    <div style={{ ...s.root, padding: isMobile ? "12px 10px 40px" : "24px 20px 48px" }}>
      <style>{globalCss}</style>
      <div style={isMobile ? s.layoutMobile : s.layout}>
        <main style={s.table}>
          <header style={s.header}>
            <div style={s.brand}>
              <span style={s.brandIcon}>♥</span>
              <h1 style={s.title}>Find the Heart</h1>
            </div>
            <button style={s.wallet} onClick={() => onTopUp?.()} disabled={loading}>
              <span style={s.walletLabel}>Saldo</span>
              <span style={s.walletAmt}>{loading ? "-" : (isMobile ? fmtShort(balance) : fmt(balance))}</span>
              <span style={s.walletCoin}>koin</span>
            </button>
          </header>

          <section style={s.statusBar}>
            <div style={s.stat}>
              <span style={s.statLabel}>Kartu</span>
              <strong style={s.statValue}>{cardCount}</strong>
            </div>
            <div style={s.stat}>
              <span style={s.statLabel}>Double</span>
              <strong style={s.statValue}>{doubleCount}x</strong>
            </div>
            <div style={s.stat}>
              <span style={s.statLabel}>Taruhan</span>
              <strong style={s.statValue}>{phase === "bet" ? fmt(bet) : fmt(roundStake)}</strong>
            </div>
            <div style={s.stat}>
              <span style={s.statLabel}>Hadiah</span>
              <strong style={s.statValue}>{fmt(potentialWin)}</strong>
            </div>
          </section>

          <section style={s.playArea}>
            <div style={gridStyle}>
              {Array.from({ length: cardCount }, (_, index) => (
                <HiddenCard
                  key={`${cardCount}-${index}`}
                  index={index}
                  disabled={phase !== "playing" || selectedIndex != null}
                  selected={selectedIndex === index}
                  revealed={phase === "done"}
                  isHeart={index === heartIndex}
                  onPick={pickCard}
                />
              ))}
            </div>

            <div style={s.messageDock}>
              {phase === "bet" && <span>Pilih taruhan, mulai ronde, lalu cari As Hati.</span>}
              {phase === "playing" && selectedIndex == null && (
                <span>Pilih satu kartu, atau gandakan untuk menaikkan taruhan dan menambah kartu.</span>
              )}
              {phase === "revealing" && <span>Membuka kartu...</span>}
              {phase === "done" && outcome && (
                <strong style={outcome.won ? s.winText : s.loseText}>
                  {outcome.won ? "Tebakan benar" : `Tebakan meleset. As Hati di ${cardLabel(outcome.heartIndex)}.`}
                </strong>
              )}
            </div>
          </section>

          {phase === "bet" && (
            <section style={s.controls}>
              <div style={s.sectionLabel}>Jumlah taruhan</div>
              <div style={s.betGrid}>
                {BETS.map((amount) => {
                  const tooMuch = !loading && amount > balance;
                  return (
                    <button
                      key={amount}
                      type="button"
                      style={{
                        ...s.betBtn,
                        ...(bet === amount ? s.betOn : {}),
                        ...(tooMuch ? s.betOff : {}),
                      }}
                      onClick={() => !tooMuch && setBet(amount)}
                      disabled={tooMuch}
                    >
                      {fmt(amount)}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                style={{ ...s.primaryBtn, ...(!canStart ? s.primaryOff : {}) }}
                onClick={startRound}
                disabled={!canStart}
              >
                {loading ? "Loading..." : balance < bet ? "Saldo tidak cukup" : `Mulai ronde - ${fmt(bet)} koin`}
              </button>
            </section>
          )}

          {phase === "playing" && (
            <section style={s.actions}>
              <button
                type="button"
                style={{ ...s.doubleBtn, ...(!canDouble ? s.actionOff : {}) }}
                onClick={doublePrice}
                disabled={!canDouble}
              >
                Double Price
                <span style={s.actionHint}>+{nextDoubleCards} kartu, taruhan x2</span>
              </button>
            </section>
          )}

          {phase === "done" && (
            <section style={s.actions}>
              <button type="button" style={s.primaryBtn} onClick={resetRound}>
                Main Lagi
              </button>
            </section>
          )}

          {balance === 0 && phase === "bet" && (
            <p style={s.broke}>Saldo habis. Klik saldo untuk top-up koin.</p>
          )}
        </main>

        <GameLogsPanel game="find-the-heart" newEntry={latestLog} mobile={isMobile} />
      </div>

      {toast && <div className={`fth-toast fth-toast--${toast.type}`}>{toast.text}</div>}
    </div>
  );
}

const C = {
  ink: "#14110E",
  panel: "#211C17",
  felt: "#1f3b2e",
  card: "#1A1612",
  gold: "#D8A24A",
  goldHi: "#F2CB72",
  cream: "#F2EBDD",
  muted: "#9C8E78",
  line: "#3A322A",
  red: "#C83737",
  green: "#74C690",
};

const s = {
  root: {
    width: "100%",
    minHeight: "calc(100vh - 60px)",
    background: "radial-gradient(120% 90% at 50% -10%, #2a231b 0%, #14110E 55%)",
    display: "flex",
    alignItems: "flex-start",
    justifyContent: "center",
    boxSizing: "border-box",
    fontFamily: "'DM Sans', system-ui, sans-serif",
  },
  layout: {
    display: "flex",
    flexDirection: "row",
    gap: 24,
    alignItems: "flex-start",
    width: "100%",
    maxWidth: 980,
  },
  layoutMobile: {
    display: "flex",
    flexDirection: "column",
    gap: 16,
    width: "100%",
  },
  table: {
    flex: "1 1 auto",
    background: C.panel,
    border: `1px solid ${C.line}`,
    borderRadius: 18,
    overflow: "hidden",
    boxSizing: "border-box",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 12,
    padding: "16px 20px",
    borderBottom: `1px solid ${C.line}`,
  },
  brand: { display: "flex", alignItems: "center", gap: 10, minWidth: 0 },
  brandIcon: {
    width: 30,
    height: 30,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    color: "#fff",
    background: `linear-gradient(145deg, ${C.red}, #7a1111)`,
    fontSize: 18,
    flexShrink: 0,
  },
  title: {
    fontFamily: "'Fraunces', serif",
    fontWeight: 700,
    fontSize: 18,
    color: C.cream,
    margin: 0,
  },
  wallet: {
    display: "flex",
    alignItems: "center",
    gap: 6,
    background: C.card,
    border: `1px solid ${C.gold}44`,
    borderRadius: 10,
    padding: "7px 14px",
    cursor: "pointer",
    flexShrink: 0,
  },
  walletLabel: { fontSize: 10, color: C.muted, textTransform: "uppercase", letterSpacing: "1px" },
  walletAmt: { fontFamily: "'Space Mono', monospace", fontWeight: 700, fontSize: 14, color: C.goldHi },
  walletCoin: { fontSize: 10, color: C.muted },
  statusBar: {
    display: "grid",
    gridTemplateColumns: "repeat(4, minmax(0, 1fr))",
    gap: 1,
    background: C.line,
  },
  stat: {
    background: "#1A1612",
    padding: "10px 12px",
    display: "flex",
    flexDirection: "column",
    gap: 3,
    minWidth: 0,
  },
  statLabel: {
    fontSize: 9,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: "1px",
  },
  statValue: {
    fontFamily: "'Space Mono', monospace",
    fontSize: 13,
    color: C.cream,
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  playArea: {
    padding: "24px 20px 18px",
    background: `radial-gradient(70% 45% at 50% 18%, #255540 0%, ${C.felt} 45%, #142a21 100%)`,
  },
  cardGrid: {
    display: "grid",
    gap: 12,
    alignItems: "stretch",
    justifyContent: "center",
  },
  card: {
    position: "relative",
    aspectRatio: "5 / 7",
    minHeight: 0,
    borderRadius: 9,
    border: "none",
    background: "transparent",
    color: C.cream,
    cursor: "pointer",
    boxShadow: "0 14px 26px -18px #000",
    overflow: "visible",
    transform: "translateY(0)",
    transition: "transform .18s ease, border-color .18s ease, box-shadow .18s ease, filter .18s ease",
    fontFamily: "'Space Mono', monospace",
    padding: 0,
  },
  cardSelected: {
    transform: "translateY(-4px)",
    boxShadow: "0 18px 30px -16px #000, 0 0 0 3px #F2CB72aa",
  },
  cardDisabled: {
    cursor: "default",
  },
  cardRevealed: {
    boxShadow: "0 16px 28px -17px #000",
  },
  cardImg: {
    width: "100%",
    height: "100%",
    display: "block",
    objectFit: "contain",
    borderRadius: 9,
    userSelect: "none",
    pointerEvents: "none",
  },
  cardCorner: {
    position: "absolute",
    top: 8,
    left: 8,
    zIndex: 2,
    minWidth: 22,
    height: 22,
    padding: "0 6px",
    display: "grid",
    placeItems: "center",
    borderRadius: 999,
    background: "#ffffffec",
    color: C.red,
    fontSize: 10,
    fontWeight: 800,
    boxSizing: "border-box",
    boxShadow: "0 5px 12px -8px #000",
  },
  cardBackSeal: {
    position: "absolute",
    inset: 0,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 3,
    zIndex: 2,
  },
  cardBackHeart: {
    width: 34,
    height: 34,
    display: "grid",
    placeItems: "center",
    borderRadius: "50%",
    background: "#ffffff14",
    border: "1px solid #ffffff26",
    color: "#fb7185",
    fontSize: 19,
    lineHeight: 1,
  },
  cardBackMark: {
    fontSize: 13,
    fontWeight: 700,
    letterSpacing: "1.5px",
    color: "#dce8ff",
  },
  cardBackPattern: {
    position: "absolute",
    inset: 8,
    borderRadius: 9,
    border: "1px solid #ffffff22",
    background: [
      "linear-gradient(135deg, #ffffff14 0 1px, transparent 1px 10px)",
      "repeating-linear-gradient(135deg, #173e6a 0, #173e6a 7px, #102d4f 7px, #102d4f 14px)",
    ].join(", "),
  },
  face: {
    position: "absolute",
    inset: 0,
    display: "grid",
    placeItems: "center",
  },
  faceCornerTop: {
    position: "absolute",
    top: 8,
    left: 9,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 0,
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1,
  },
  faceCornerBottom: {
    position: "absolute",
    bottom: 8,
    right: 9,
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: 0,
    fontSize: 12,
    fontWeight: 800,
    lineHeight: 1,
    transform: "rotate(180deg)",
  },
  faceCenter: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    justifyContent: "center",
    gap: 5,
    transform: "translateY(2px)",
  },
  centerRank: {
    fontSize: 28,
    fontWeight: 900,
    lineHeight: 0.85,
  },
  centerSuit: {
    fontSize: 34,
    lineHeight: 1,
    opacity: 0.95,
  },
  centerSuitHeart: {
    fontSize: 40,
    filter: "drop-shadow(0 5px 8px #c8373726)",
  },
  messageDock: {
    marginTop: 16,
    minHeight: 42,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    textAlign: "center",
    color: "#d8d0bd",
    fontSize: 13,
    lineHeight: 1.45,
  },
  winText: { color: C.green },
  loseText: { color: "#DC7C68" },
  controls: {
    padding: "16px 20px 20px",
  },
  sectionLabel: {
    fontSize: 11,
    color: C.muted,
    textTransform: "uppercase",
    letterSpacing: "1px",
    marginBottom: 10,
  },
  betGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(3, minmax(0, 1fr))",
    gap: 8,
    marginBottom: 12,
  },
  betBtn: {
    padding: "10px 0",
    background: C.card,
    border: `1px solid ${C.line}`,
    borderRadius: 10,
    cursor: "pointer",
    color: C.cream,
    fontFamily: "'Space Mono', monospace",
    fontWeight: 700,
    fontSize: 12,
  },
  betOn: { background: `${C.gold}22`, border: `1px solid ${C.gold}`, color: C.goldHi },
  betOff: { opacity: 0.3, cursor: "not-allowed" },
  primaryBtn: {
    width: "100%",
    padding: "13px 16px",
    background: `linear-gradient(135deg, ${C.gold}, ${C.goldHi})`,
    border: "none",
    borderRadius: 12,
    cursor: "pointer",
    color: C.ink,
    fontFamily: "'Space Mono', monospace",
    fontWeight: 700,
    fontSize: 14,
  },
  primaryOff: { opacity: 0.45, cursor: "not-allowed" },
  actions: {
    padding: "16px 20px 20px",
  },
  doubleBtn: {
    width: "100%",
    padding: "13px 16px",
    background: C.card,
    border: `1px solid ${C.gold}88`,
    borderRadius: 12,
    cursor: "pointer",
    color: C.goldHi,
    fontFamily: "'Space Mono', monospace",
    fontWeight: 700,
    fontSize: 14,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  actionHint: {
    color: C.muted,
    fontSize: 11,
    fontWeight: 500,
  },
  actionOff: { opacity: 0.4, cursor: "not-allowed" },
  broke: {
    color: "#DC7C68",
    textAlign: "center",
    fontSize: 12,
    margin: "0 20px 20px",
  },
};

const globalCss = `
  .fth-toast {
    position: fixed;
    left: 50%;
    top: 22px;
    transform: translateX(-50%);
    padding: 10px 14px;
    border-radius: 10px;
    font-family: 'DM Sans', system-ui, sans-serif;
    font-size: 13px;
    font-weight: 700;
    z-index: 80;
    box-shadow: 0 18px 38px -18px #000;
  }
  .fth-toast--win { background: #143523; color: #74C690; border: 1px solid #74C69066; }
  .fth-toast--lose { background: #3a1714; color: #DC7C68; border: 1px solid #DC7C6866; }
  .fth-toast--warn { background: #3a2a0a; color: #F2CB72; border: 1px solid #D8A24A66; }
  @media (max-width: 560px) {
    .fth-toast { width: calc(100% - 32px); text-align: center; box-sizing: border-box; }
  }
`;
