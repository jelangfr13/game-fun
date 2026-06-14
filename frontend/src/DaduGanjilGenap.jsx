import React, { useState, useEffect, useRef, useCallback } from "react";
import { BETS, fmt } from "./dadu/constants";
import { Store } from "./dadu/store";
import Die from "./dadu/Die";
import css from "./dadu/styles";
import { startDiceRoll, playDiceLand, playWin, playLose } from "./sounds";
import GameLogsPanel from "./GameLogsPanel";
import useIsMobile from "./useIsMobile";

export default function DaduGanjilGenap({ onTopUp }) {
  const [balance, setBalance] = useState(null);
  const [bet, setBet] = useState(1000);
  const [choice, setChoice] = useState(null);
  const [dice, setDice] = useState([1, 1]);
  const [rolling, setRolling] = useState(false);
  const [outcome, setOutcome] = useState(null);
  const [toast, setToast]         = useState(null);
  const [latestLog, setLatestLog] = useState(null);
  const isMobile   = useIsMobile();
  const rollTimer  = useRef(null);
  const spinTimer  = useRef(null);
  const stopSound  = useRef(null);
  const rollLock   = useRef(false); // prevents double-roll during async API await

  useEffect(() => {
    let active = true;
    Store.load().then((v) => {
      if (active) setBalance(v);
    });
    return () => {
      active = false;
      clearTimeout(rollTimer.current);
      clearInterval(spinTimer.current);
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

  const canPlay = balance != null && !rolling && balance >= bet && choice;

  const roll = async () => {
    if (!choice) {
      flash("warn", "Pilih dulu Ganjil atau Genap.");
      return;
    }
    if (balance < bet) {
      flash("warn", "Saldo tidak cukup untuk taruhan ini.");
      return;
    }
    if (rollLock.current || rolling) return;
    rollLock.current = true;

    // Claim forced win / lose before animation starts (win takes priority)
    let forcedWin  = false;
    let forcedLose = false;
    try {
      const token = localStorage.getItem("gf_token");
      const [wRes, lRes] = await Promise.all([
        fetch("/api/user/claim-win",  { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
        fetch("/api/user/claim-lose", { method: "POST", headers: { Authorization: `Bearer ${token}` } }),
      ]);
      if (wRes.ok) forcedWin  = (await wRes.json()).win;
      if (lRes.ok) forcedLose = (await lRes.json()).lose;
    } catch (e) {}

    let d1 = 1 + Math.floor(Math.random() * 6);
    let d2 = 1 + Math.floor(Math.random() * 6);

    if (forcedWin) {
      // Ensure sum parity matches player's choice
      const wantEven = choice === "genap";
      if (((d1 + d2) % 2 === 0) !== wantEven) {
        d2 = d2 < 6 ? d2 + 1 : d2 - 1;
      }
    } else if (forcedLose) {
      // Ensure sum parity does NOT match player's choice
      const wantEven = choice === "genap";
      if (((d1 + d2) % 2 === 0) === wantEven) {
        d2 = d2 < 6 ? d2 + 1 : d2 - 1;
      }
    }

    const sum = d1 + d2;
    const parity = sum % 2 === 0 ? "genap" : "ganjil";
    const won = parity === choice;
    const delta = won ? bet : -bet;

    setOutcome(null);
    setRolling(true);
    stopSound.current = startDiceRoll();

    spinTimer.current = setInterval(() => {
      setDice([1 + Math.floor(Math.random() * 6), 1 + Math.floor(Math.random() * 6)]);
    }, 80);

    rollTimer.current = setTimeout(() => {
      clearInterval(spinTimer.current);
      stopSound.current?.();
      stopSound.current = null;
      rollLock.current = false;
      playDiceLand();
      setDice([d1, d2]);
      setRolling(false);
      const next = balance + delta;
      updateBalance(next);
      setOutcome({ sum, parity, won, delta });
      if (won) { flash("win", `Menang! +${fmt(delta)} koin`); playWin(); }
      else { flash("lose", `Kalah. ${fmt(delta)} koin`); playLose(); }
      // Optimistic panel update + fire-and-forget log
      const logEntry = {
        game: "dadu", bet, result: won ? "win" : "lose", delta,
        details: { dice: [d1, d2], sum, parity, choice },
        forced: forcedWin || forcedLose,
        createdAt: new Date().toISOString(),
      };
      setLatestLog(logEntry);
      fetch("/api/user/log", {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("gf_token")}`, "Content-Type": "application/json" },
        body: JSON.stringify({ ...logEntry, balanceBefore: balance, balanceAfter: next }),
      }).catch(() => {});
    }, 950);
  };

  const loading = balance == null;

  return (
    <div className="dg-root">
      <style>{css}</style>

      <div style={{ display: "flex", flexDirection: isMobile ? "column" : "row", gap: 16, alignItems: "flex-start", width: isMobile ? "100%" : undefined }}>
      <div className="table" style={{ flex: isMobile ? "1 1 auto" : "0 0 auto", width: isMobile ? "100%" : undefined }}>
        {/* HEADER */}
        <header className="hd">
          <div className="hd__brand">
            <span className="hd__pip" />
            <h1 className="hd__title">Ganjil&nbsp;·&nbsp;Genap</h1>
          </div>
          <button className="wallet" onClick={() => onTopUp?.()} disabled={loading}>
            <span className="wallet__label">Saldo</span>
            <span className="wallet__amt">{loading ? "—" : fmt(balance)}</span>
            <span className="wallet__coin">koin</span>
          </button>
        </header>

        {/* TRAY DADU */}
        <section className="tray">
          <div className="tray__felt">
            <Die value={dice[0]} rolling={rolling} />
            <Die value={dice[1]} rolling={rolling} />
          </div>

          <div className="verdict">
            {rolling ? (
              <span className="verdict__rolling">Melempar…</span>
            ) : outcome ? (
              <div className={"verdict__box verdict__box--" + (outcome.won ? "win" : "lose")}>
                <span className="verdict__sum">{outcome.sum}</span>
                <span className="verdict__parity">{outcome.parity.toUpperCase()}</span>
                <span className="verdict__msg">
                  {outcome.won ? "Tebakan benar" : "Tebakan meleset"}
                </span>
              </div>
            ) : (
              <span className="verdict__idle">Tebak total kedua dadu</span>
            )}
          </div>
        </section>

        {/* PILIH TEBAKAN */}
        <section className="block">
          <div className="block__label">Pilih tebakan</div>
          <div className="choices">
            {["ganjil", "genap"].map((c) => (
              <button
                key={c}
                className={"choice" + (choice === c ? " choice--on" : "")}
                onClick={() => setChoice(c)}
                disabled={rolling}
              >
                {c === "ganjil" ? "Ganjil" : "Genap"}
                <small>{c === "ganjil" ? "3 · 5 · 7 · 9 · 11" : "2 · 4 · 6 · 8 · 10 · 12"}</small>
              </button>
            ))}
          </div>
        </section>

        {/* PILIH TARUHAN */}
        <section className="block">
          <div className="block__label">Jumlah taruhan</div>
          <div className="bets">
            {BETS.map((b) => {
              const tooMuch = !loading && b > balance;
              return (
                <button
                  key={b}
                  className={"bet" + (bet === b ? " bet--on" : "")}
                  onClick={() => setBet(b)}
                  disabled={rolling || tooMuch}
                  title={tooMuch ? "Saldo tidak cukup" : ""}
                >
                  {fmt(b)}
                </button>
              );
            })}
          </div>
          <button
            style={bet === balance && !loading
              ? allInStyle.active
              : (!loading && balance > 0 ? allInStyle.base : allInStyle.disabled)}
            onClick={() => !loading && balance > 0 && setBet(balance)}
            disabled={rolling || loading || balance === 0}
          >
            💰 ALL IN
            {!loading && balance > 0 && (
              <span style={allInStyle.amount}>{fmt(balance)} koin</span>
            )}
          </button>
        </section>

        {/* TOMBOL LEMPAR */}
        <button className="roll" onClick={roll} disabled={!canPlay}>
          {rolling
            ? "Dadu menggelinding…"
            : !choice
            ? "Pilih ganjil / genap dulu"
            : balance < bet
            ? "Saldo tidak cukup"
            : `Lempar dadu · ${fmt(bet)} koin`}
        </button>

        {balance === 0 && !rolling && (
          <p className="broke">Saldo habis. Klik tombol Saldo untuk top-up koin.</p>
        )}
      </div>{/* end table */}

      <GameLogsPanel game="dadu" newEntry={latestLog} mobile={isMobile} />
      </div>{/* end flex row */}

      {toast && <div className={"toast toast--" + toast.type}>{toast.text}</div>}
    </div>
  );
}

const allInStyle = {
  base: {
    width: "100%", marginTop: 8, padding: "11px 16px",
    background: "linear-gradient(135deg, #3a2a0a, #2a1c06)",
    border: "1px solid #D8A24A88",
    borderRadius: 12, cursor: "pointer",
    color: "#F2CB72", fontFamily: "'Space Mono', monospace",
    fontWeight: 700, fontSize: 13, letterSpacing: "1px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    transition: "all .15s",
  },
  active: {
    width: "100%", marginTop: 8, padding: "11px 16px",
    background: "linear-gradient(135deg, #D8A24A, #F2CB72)",
    border: "1px solid #F2CB72",
    borderRadius: 12, cursor: "pointer",
    color: "#14110E", fontFamily: "'Space Mono', monospace",
    fontWeight: 700, fontSize: 13, letterSpacing: "1px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    boxShadow: "0 0 20px -6px #D8A24Aaa",
  },
  disabled: {
    width: "100%", marginTop: 8, padding: "11px 16px",
    background: "transparent", border: "1px solid #3A322A",
    borderRadius: 12, cursor: "not-allowed",
    color: "#9C8E78", fontFamily: "'Space Mono', monospace",
    fontWeight: 700, fontSize: 13, letterSpacing: "1px",
    display: "flex", alignItems: "center", justifyContent: "space-between",
    opacity: 0.4,
  },
  amount: {
    fontSize: 12, fontWeight: 400, letterSpacing: "0.5px",
    opacity: 0.8,
  },
};
