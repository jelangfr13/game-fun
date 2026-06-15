import React, { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import DaduGanjilGenap from "../DaduGanjilGenap";
import SlotMachine from "../SlotMachine";
import Blackjack from "../Blackjack";
import Roulette from "../Roulette";
import ProfilePage from "./ProfilePage";
import TopUpPage from "./TopUpPage";
import AdminPage from "./AdminPage";
import { fmt, fmtShort } from "../dadu/constants";
import useIsMobile from "../useIsMobile";

const GAMES = [
  {
    id: "dadu",
    title: "Ganjil · Genap",
    description: "Tebak total dua dadu: ganjil atau genap",
    emoji: "🎲",
    tag: "Tersedia",
    component: DaduGanjilGenap,
  },
  {
    id: "slot",
    title: "Mesin Slot",
    description: "Putar gulungan dan raih jackpot",
    emoji: "🎰",
    tag: "Tersedia",
    component: SlotMachine,
  },
  {
    id: "blackjack",
    title: "Blackjack",
    description: "Kalahkan dealer tanpa melebihi 21",
    emoji: "🃏",
    tag: "Tersedia",
    component: Blackjack,
  },
  {
    id: "roulette",
    title: "Roulette",
    description: "Taruhan angka atau warna bola",
    emoji: "🔴",
    tag: "Tersedia",
    component: Roulette,
  },
];

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [activeGame, setActiveGame] = useState(null);
  const [page, setPage] = useState("dashboard"); // "dashboard" | "profile" | "topup"
  const [coins, setCoins] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const isMobile = useIsMobile();

  const fetchCoins = useCallback(async () => {
    const token = localStorage.getItem("gf_token");
    if (!token) return;
    try {
      const res = await fetch("/api/user/coins", {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (res.ok) {
        const data = await res.json();
        setCoins(data.coins);
      }
    } catch (e) {}
  }, []);

  useEffect(() => {
    fetchCoins();
  }, [fetchCoins]);

  // Refresh coins when returning to dashboard
  useEffect(() => {
    if (page === "dashboard") fetchCoins();
  }, [page, fetchCoins]);

  // Close dropdown on outside click
  useEffect(() => {
    if (!dropdownOpen) return;
    const handler = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [dropdownOpen]);

  const navigate = (dest) => {
    setPage(dest);
    setDropdownOpen(false);
  };

  const handleBackToDashboard = () => {
    setActiveGame(null);
    fetchCoins();
  };

  // Game view — full screen, no navbar
  if (activeGame) {
    const Game = activeGame.component;
    const handleTopUpFromGame = () => {
      setActiveGame(null);
      setPage("topup");
    };
    return (
      <div style={s.gameWrap}>
        <button style={s.backBtn} onClick={handleBackToDashboard}>
          ← Kembali ke Dashboard
        </button>
        <Game onTopUp={handleTopUpFromGame} />
      </div>
    );
  }

  const navbar = (
    <nav style={s.nav}>
      <div style={s.navBrand} onClick={() => navigate("dashboard")} role="button" style={{ ...s.navBrand, cursor: "pointer" }}>
        <div style={s.navDie}>
          <span style={s.navPip} /><span style={s.navPip} /><span style={s.navPip} />
        </div>
        <span style={s.navTitle}>GameFun</span>
      </div>
      <div style={s.navRight}>
        <div style={s.coinBadge}>
          <span style={s.coinIcon}>🪙</span>
          <span style={s.coinAmt}>{coins == null ? "—" : (isMobile ? fmtShort(coins) : fmt(coins))}</span>
        </div>
        <div style={s.navDivider} />

        {/* DROPDOWN */}
        <div ref={dropdownRef} style={s.dropdownWrap}>
          <button style={s.profileBtn} onClick={() => setDropdownOpen((o) => !o)}>
            <div style={s.avatar}>{user?.username?.[0]?.toUpperCase()}</div>
            <span style={s.navUser}>{user?.username}</span>
            <span style={{ ...s.chevron, ...(dropdownOpen ? s.chevronUp : {}) }}>▾</span>
          </button>

          {dropdownOpen && (
            <div style={s.dropdown}>
              <button style={s.dropItem} onClick={() => navigate("profile")}>
                <span style={s.dropIcon}>👤</span> Profil
              </button>
              <button style={s.dropItem} onClick={() => navigate("topup")}>
                <span style={s.dropIcon}>🪙</span> Top Up
              </button>
              {user?.username === "admin" && (
                <>
                  <div style={s.dropDivider} />
                  <button style={{ ...s.dropItem, ...s.dropItemAdmin }} onClick={() => navigate("admin")}>
                    <span style={s.dropIcon}>⚙️</span> Admin Panel
                  </button>
                </>
              )}
              <div style={s.dropDivider} />
              <button style={{ ...s.dropItem, ...s.dropItemDanger }} onClick={logout}>
                <span style={s.dropIcon}>🚪</span> Keluar
              </button>
            </div>
          )}
        </div>
      </div>
    </nav>
  );

  // Profile page
  if (page === "profile") {
    return (
      <div style={s.root}>
        <style>{globalCss}</style>
        {navbar}
        <div style={s.pageHeader}>
          <button style={s.backLink} onClick={() => navigate("dashboard")}>← Dashboard</button>
          <h1 style={s.pageTitle}>Profil</h1>
        </div>
        <ProfilePage coins={coins} />
      </div>
    );
  }

  // Admin page
  if (page === "admin") {
    return (
      <div style={s.root}>
        <style>{globalCss}</style>
        {navbar}
        <div style={s.pageHeader}>
          <button style={s.backLink} onClick={() => navigate("dashboard")}>← Dashboard</button>
          <h1 style={s.pageTitle}>Admin Panel</h1>
        </div>
        <AdminPage />
      </div>
    );
  }

  // Top Up page
  if (page === "topup") {
    return (
      <div style={s.root}>
        <style>{globalCss}</style>
        {navbar}
        <div style={s.pageHeader}>
          <button style={s.backLink} onClick={() => navigate("dashboard")}>← Dashboard</button>
          <h1 style={s.pageTitle}>Top Up Koin</h1>
        </div>
        <TopUpPage onCoinsUpdated={(newCoins) => setCoins(newCoins)} />
      </div>
    );
  }

  // Dashboard home
  return (
    <div style={s.root}>
      <style>{globalCss}</style>
      {navbar}

      <section style={s.hero}>
        <p style={s.heroSub}>Selamat datang kembali,</p>
        <h1 style={s.heroTitle}>{user?.username} 👋</h1>
        <p style={s.heroDesc}>Pilih permainan favoritmu dan raih kemenangan hari ini.</p>
      </section>

      <section style={s.section}>
        <h2 style={s.sectionTitle}>Semua Permainan</h2>
        <div style={s.grid}>
          {GAMES.map((game) => {
            const available = !!game.component;
            return (
              <div
                key={game.id}
                style={{ ...s.card, ...(available ? s.cardAvailable : s.cardSoon) }}
                onClick={() => available && setActiveGame(game)}
              >
                <div style={s.cardEmoji}>{game.emoji}</div>
                <span style={{ ...s.cardTag, ...(available ? s.tagAvailable : s.tagSoon) }}>
                  {game.tag}
                </span>
                <h3 style={s.cardTitle}>{game.title}</h3>
                <p style={s.cardDesc}>{game.description}</p>
                {available && <button style={s.playBtn}>Mainkan →</button>}
              </div>
            );
          })}
        </div>
      </section>

      <footer style={s.footer}>
        <p style={s.footerText}>GameFun · Hanya untuk hiburan · Tidak menggunakan uang nyata</p>
      </footer>
    </div>
  );
}

const C = {
  ink: "#14110E", panel: "#211C17", felt: "#2C1622",
  gold: "#D8A24A", goldHi: "#F2CB72", cream: "#F2EBDD",
  muted: "#9C8E78", line: "#3A322A", win: "#74C690", lose: "#DC7C68",
};

const s = {
  root: {
    minHeight: "100vh", width: "100%",
    background: "radial-gradient(120% 90% at 50% -10%, #2a231b 0%, #14110E 55%)",
    fontFamily: "'DM Sans', system-ui, sans-serif",
    color: C.cream, boxSizing: "border-box",
  },

  // NAVBAR
  nav: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    padding: "16px 32px", borderBottom: `1px solid ${C.line}`,
    background: "#14110Ecc", backdropFilter: "blur(8px)",
    position: "sticky", top: 0, zIndex: 10,
  },
  navBrand: { display: "flex", alignItems: "center", gap: 10 },
  navDie: {
    width: 32, height: 32, borderRadius: 7,
    background: "linear-gradient(145deg, #FBF7EE, #E7DEC9)",
    boxShadow: "0 4px 10px -3px #000a",
    display: "grid", gridTemplateColumns: "repeat(3,1fr)",
    gridTemplateRows: "repeat(3,1fr)", padding: 5, gap: 2,
    alignItems: "center", justifyItems: "center",
  },
  navPip: {
    width: 5, height: 5, borderRadius: "50%",
    background: "radial-gradient(circle at 35% 30%, #5a2a1c, #2a0f0a)",
  },
  navTitle: {
    fontFamily: "'Fraunces', serif", fontWeight: 700,
    fontSize: 20, color: C.cream,
  },
  navRight: { display: "flex", alignItems: "center", gap: 12 },
  coinBadge: {
    display: "flex", alignItems: "center", gap: 6,
    background: "#2C1622", border: `1px solid ${C.gold}44`,
    borderRadius: 999, padding: "5px 12px",
  },
  coinIcon: { fontSize: 14, lineHeight: 1 },
  coinAmt: { fontSize: 13, fontWeight: 700, color: C.goldHi, fontVariantNumeric: "tabular-nums" },
  navDivider: { width: 1, height: 20, background: C.line },

  // DROPDOWN
  dropdownWrap: { position: "relative" },
  profileBtn: {
    display: "flex", alignItems: "center", gap: 8,
    background: "none", border: "none", cursor: "pointer",
    padding: "4px 6px", borderRadius: 10,
  },
  avatar: {
    width: 34, height: 34, borderRadius: "50%",
    background: `linear-gradient(135deg, ${C.goldHi}, ${C.gold})`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 14, color: C.ink, flexShrink: 0,
  },
  navUser: { fontSize: 14, color: C.cream, fontWeight: 500 },
  chevron: { fontSize: 12, color: C.muted, transition: "transform .2s", display: "inline-block" },
  chevronUp: { transform: "rotate(180deg)" },
  dropdown: {
    position: "absolute", right: 0, top: "calc(100% + 8px)",
    background: C.panel, border: `1px solid ${C.line}`,
    borderRadius: 14, padding: "6px",
    minWidth: 160,
    boxShadow: "0 16px 40px -10px #000",
    zIndex: 50,
  },
  dropItem: {
    display: "flex", alignItems: "center", gap: 10,
    width: "100%", padding: "10px 12px", borderRadius: 8,
    background: "none", border: "none", cursor: "pointer",
    color: C.cream, fontSize: 14, fontWeight: 500,
    textAlign: "left",
  },
  dropItemDanger: { color: C.lose },
  dropItemAdmin: { color: C.goldHi },
  dropIcon: { fontSize: 16, width: 20, textAlign: "center" },
  dropDivider: { height: 1, background: C.line, margin: "4px 0" },

  // PAGE HEADER
  pageHeader: {
    padding: "24px 32px 0",
    display: "flex", alignItems: "center", gap: 16,
  },
  backLink: {
    background: "none", border: `1px solid ${C.line}`,
    borderRadius: 8, padding: "6px 12px", cursor: "pointer",
    color: C.muted, fontSize: 13, fontWeight: 500,
  },
  pageTitle: {
    fontFamily: "'Fraunces', serif", fontWeight: 700,
    fontSize: 24, color: C.cream, margin: 0,
  },

  // HERO
  hero: { textAlign: "center", padding: "60px 24px 40px" },
  heroSub: { color: C.muted, fontSize: 14, margin: "0 0 6px", letterSpacing: "1px", textTransform: "uppercase" },
  heroTitle: {
    fontFamily: "'Fraunces', serif", fontWeight: 700,
    fontSize: 42, margin: "0 0 12px", color: C.cream, letterSpacing: "-0.5px",
  },
  heroDesc: { color: C.muted, fontSize: 15, margin: 0 },

  // SECTION
  section: { padding: "0 32px 60px", maxWidth: 1100, margin: "0 auto", width: "100%", boxSizing: "border-box" },
  sectionTitle: {
    fontFamily: "'Fraunces', serif", fontWeight: 600,
    fontSize: 20, color: C.cream, margin: "0 0 20px",
    paddingBottom: 12, borderBottom: `1px solid ${C.line}`,
  },

  // GRID
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))",
    gap: 18,
  },
  card: {
    background: C.panel, border: `1px solid ${C.line}`,
    borderRadius: 18, padding: "22px 20px",
    display: "flex", flexDirection: "column", gap: 8,
    transition: "all .2s ease", boxSizing: "border-box",
  },
  cardAvailable: { cursor: "pointer" },
  cardSoon: { opacity: 0.5, cursor: "default" },
  cardEmoji: { fontSize: 32, lineHeight: 1, marginBottom: 4 },
  cardTag: {
    display: "inline-block", fontSize: 10, fontWeight: 700,
    letterSpacing: "1.2px", textTransform: "uppercase",
    padding: "3px 8px", borderRadius: 999,
  },
  tagAvailable: { background: "#74C69022", color: C.win, border: "1px solid #74C69055" },
  tagSoon: { background: "#9C8E7820", color: C.muted, border: `1px solid ${C.line}` },
  cardTitle: {
    fontFamily: "'Fraunces', serif", fontWeight: 600,
    fontSize: 19, margin: 0, color: C.cream,
  },
  cardDesc: { fontSize: 13, color: C.muted, margin: 0, lineHeight: 1.5 },
  playBtn: {
    marginTop: "auto", padding: "10px 0",
    background: "none", border: `1px solid ${C.gold}`,
    borderRadius: 10, cursor: "pointer",
    color: C.goldHi, fontWeight: 600, fontSize: 14,
    transition: "all .15s",
  },

  // GAME WRAP
  gameWrap: {
    minHeight: "100vh", width: "100%",
    background: "radial-gradient(120% 90% at 50% -10%, #2a231b 0%, #14110E 55%)",
    display: "flex", flexDirection: "column",
  },
  backBtn: {
    alignSelf: "flex-start", margin: "16px 20px",
    background: "none", border: `1px solid #3A322A`,
    borderRadius: 10, padding: "8px 16px", cursor: "pointer",
    color: "#9C8E78", fontSize: 13, fontWeight: 500,
  },

  // FOOTER
  footer: { padding: "24px 32px", borderTop: `1px solid ${C.line}` },
  footerText: { textAlign: "center", color: C.muted, fontSize: 12, margin: 0 },
};

const globalCss = `
  @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,600;9..144,700&family=DM+Sans:wght@400;500;600&family=Space+Mono:wght@400;700&display=swap');
  button:hover { opacity: 0.9; }
  input:focus { border-color: #D8A24A !important; }
`;
