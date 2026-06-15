import { useState, useEffect, useCallback, useRef } from "react";
import { useAuth } from "../context/AuthContext";
import DaduGanjilGenap from "../DaduGanjilGenap";
import SlotMachine from "../SlotMachine";
import Blackjack from "../Blackjack";
import Roulette from "../Roulette";
import FindTheHeart from "../FindTheHeart";
import ProfilePage from "./ProfilePage";
import TopUpPage from "./TopUpPage";
import AdminPage from "./AdminPage";
import LoginPage from "./LoginPage";
import { fmt, fmtShort } from "../dadu/constants";
import useIsMobile from "../useIsMobile";

const GAMES = [
  {
    id: "dadu",
    path: "/dadu",
    title: "Ganjil · Genap",
    description: "Tebak total dua dadu: ganjil atau genap",
    emoji: "🎲",
    tag: "Tersedia",
    component: DaduGanjilGenap,
  },
  {
    id: "slot",
    path: "/mesin-slot",
    title: "Mesin Slot",
    description: "Putar gulungan dan raih jackpot",
    emoji: "🎰",
    tag: "Tersedia",
    component: SlotMachine,
  },
  {
    id: "blackjack",
    path: "/blackjack",
    title: "Blackjack",
    description: "Kalahkan dealer tanpa melebihi 21",
    emoji: "🃏",
    tag: "Tersedia",
    component: Blackjack,
  },
  {
    id: "roulette",
    path: "/roulette",
    title: "Roulette",
    description: "Taruhan angka atau warna bola",
    emoji: "🔴",
    tag: "Tersedia",
    component: Roulette,
  },
  {
    id: "find-the-heart",
    path: "/find-the-heart",
    title: "Find the Heart",
    description: "Temukan As Hati dari kartu tertutup",
    emoji: "♥️",
    tag: "Tersedia",
    component: FindTheHeart,
  },
];

const ROUTES = {
  dashboard: "/dashboard",
  login: "/login",
  profile: "/profile",
  topup: "/top-up",
  admin: "/admin",
};

const PROTECTED_ROUTES = new Set([
  ROUTES.profile,
  ROUTES.topup,
  ROUTES.admin,
  ...GAMES.map((game) => game.path),
]);

const KNOWN_ROUTES = new Set([
  ...Object.values(ROUTES),
  ...GAMES.map((game) => game.path),
]);

const ROUTE_ALIASES = {
  "/slot": "/mesin-slot",
  "/topup": "/top-up",
};

function normalizePath(path) {
  if (!path || path === "/") return ROUTES.dashboard;
  const cleanPath = path.replace(/\/+$/, "");
  return ROUTE_ALIASES[cleanPath] || cleanPath || ROUTES.dashboard;
}

function getCurrentPath() {
  return normalizePath(window.location.pathname);
}

async function readCoins() {
  const token = localStorage.getItem("gf_token");
  if (!token) return null;
  try {
    const res = await fetch("/api/user/coins", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const data = await res.json();
    return data.coins;
  } catch {
    return null;
  }
}

export default function Dashboard() {
  const { user, logout } = useAuth();
  const [routePath, setRoutePath] = useState(getCurrentPath);
  const [postLoginPath, setPostLoginPath] = useState(ROUTES.dashboard);
  const [coins, setCoins] = useState(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const isMobile = useIsMobile();
  const activeGame = GAMES.find((game) => game.path === routePath);

  const fetchCoins = useCallback(async () => {
    setCoins(await readCoins());
  }, []);

  useEffect(() => {
    if (window.location.pathname === routePath) return undefined;
    window.history.replaceState({}, "", routePath);
    return undefined;
  }, [routePath]);

  useEffect(() => {
    const handler = () => {
      setRoutePath(getCurrentPath());
      setDropdownOpen(false);
    };
    window.addEventListener("popstate", handler);
    return () => window.removeEventListener("popstate", handler);
  }, []);

  useEffect(() => {
    if (!user || routePath !== ROUTES.dashboard) return undefined;
    let alive = true;
    readCoins().then((latestCoins) => {
      if (alive) setCoins(latestCoins);
    });
    return () => {
      alive = false;
    };
  }, [routePath, user]);

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

  const navigate = useCallback((path, options = {}) => {
    const nextPath = normalizePath(path);
    if (PROTECTED_ROUTES.has(nextPath) && !user) {
      setPostLoginPath(nextPath);
      setRoutePath(ROUTES.login);
      setDropdownOpen(false);
      window.history.pushState({}, "", ROUTES.login);
      return;
    }
    setRoutePath(nextPath);
    setDropdownOpen(false);
    if (options.replace) {
      window.history.replaceState({}, "", nextPath);
    } else {
      window.history.pushState({}, "", nextPath);
    }
  }, [user]);

  const handlePlayGame = (game) => {
    navigate(game.path);
  };

  const handleBackToDashboard = () => {
    navigate(ROUTES.dashboard);
    fetchCoins();
  };

  const handleLogout = () => {
    logout();
    setCoins(null);
    setDropdownOpen(false);
    navigate(ROUTES.dashboard, { replace: true });
  };

  useEffect(() => {
    let redirectPath = null;
    let pendingPostLoginPath = null;

    if (!KNOWN_ROUTES.has(routePath)) {
      redirectPath = ROUTES.dashboard;
    } else if (routePath === ROUTES.login && user) {
      redirectPath = ROUTES.dashboard;
    } else if (routePath === ROUTES.admin && user?.username !== "admin") {
      redirectPath = ROUTES.dashboard;
    } else if (PROTECTED_ROUTES.has(routePath) && !user) {
      pendingPostLoginPath = routePath;
      redirectPath = ROUTES.login;
    }

    if (!redirectPath) return undefined;

    let alive = true;
    Promise.resolve().then(() => {
      if (!alive) return;
      if (pendingPostLoginPath) setPostLoginPath(pendingPostLoginPath);
      navigate(redirectPath, { replace: true });
    });

    return () => {
      alive = false;
    };
  }, [navigate, routePath, user]);

  if (PROTECTED_ROUTES.has(routePath) && !user) {
    return <LoginPage onSuccess={() => navigate(routePath, { replace: true })} />;
  }

  if (routePath === ROUTES.login && !user) {
    return <LoginPage onSuccess={() => navigate(postLoginPath, { replace: true })} />;
  }

  // Game view — full screen, no navbar
  if (activeGame) {
    const Game = activeGame.component;
    const handleTopUpFromGame = () => {
      navigate(ROUTES.topup);
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
      <div style={{ ...s.navBrand, cursor: "pointer" }} onClick={() => navigate(ROUTES.dashboard)} role="button">
        <div style={s.navDie}>
          <span style={s.navPip} /><span style={s.navPip} /><span style={s.navPip} />
        </div>
        <span style={s.navTitle}>GameFun</span>
      </div>
      <div style={s.navRight}>
        {user ? (
          <>
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
                  <button style={s.dropItem} onClick={() => navigate(ROUTES.profile)}>
                    <span style={s.dropIcon}>👤</span> Profil
                  </button>
                  <button style={s.dropItem} onClick={() => navigate(ROUTES.topup)}>
                    <span style={s.dropIcon}>🪙</span> Top Up
                  </button>
                  {user?.username === "admin" && (
                    <>
                      <div style={s.dropDivider} />
                      <button style={{ ...s.dropItem, ...s.dropItemAdmin }} onClick={() => navigate(ROUTES.admin)}>
                        <span style={s.dropIcon}>⚙️</span> Admin Panel
                      </button>
                    </>
                  )}
                  <div style={s.dropDivider} />
                  <button style={{ ...s.dropItem, ...s.dropItemDanger }} onClick={handleLogout}>
                    <span style={s.dropIcon}>🚪</span> Keluar
                  </button>
                </div>
              )}
            </div>
          </>
        ) : (
          <button style={s.loginBtn} onClick={() => navigate(ROUTES.login)}>
            Masuk
          </button>
        )}
      </div>
    </nav>
  );

  // Profile page
  if (routePath === ROUTES.profile) {
    return (
      <div style={s.root}>
        <style>{globalCss}</style>
        {navbar}
        <div style={s.pageHeader}>
          <button style={s.backLink} onClick={() => navigate(ROUTES.dashboard)}>← Dashboard</button>
          <h1 style={s.pageTitle}>Profil</h1>
        </div>
        <ProfilePage coins={coins} />
      </div>
    );
  }

  // Admin page
  if (routePath === ROUTES.admin && user?.username === "admin") {
    return (
      <div style={s.root}>
        <style>{globalCss}</style>
        {navbar}
        <div style={s.pageHeader}>
          <button style={s.backLink} onClick={() => navigate(ROUTES.dashboard)}>← Dashboard</button>
          <h1 style={s.pageTitle}>Admin Panel</h1>
        </div>
        <AdminPage />
      </div>
    );
  }

  // Top Up page
  if (routePath === ROUTES.topup) {
    return (
      <div style={s.root}>
        <style>{globalCss}</style>
        {navbar}
        <div style={s.pageHeader}>
          <button style={s.backLink} onClick={() => navigate(ROUTES.dashboard)}>← Dashboard</button>
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
        <p style={s.heroSub}>{user ? "Selamat datang kembali," : "Selamat datang di"}</p>
        <h1 style={s.heroTitle}>{user ? `${user.username} 👋` : "GameFun"}</h1>
        <p style={s.heroDesc}>Pilih permainan favoritmu. Masuk diperlukan saat mulai bermain.</p>
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
                onClick={() => available && handlePlayGame(game)}
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
  loginBtn: {
    background: `linear-gradient(135deg, ${C.goldHi}, ${C.gold})`,
    border: "none",
    borderRadius: 8,
    color: C.ink,
    cursor: "pointer",
    fontSize: 14,
    fontWeight: 700,
    padding: "9px 16px",
  },
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
