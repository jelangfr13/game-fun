import React, { useState, useEffect, useCallback } from "react";
import { fmt } from "../dadu/constants";
import useIsMobile from "../useIsMobile";

const AMOUNTS = [5000, 10000, 20000, 50000, 100000];

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("gf_token")}` };
}

// ── ROOT ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState("codes");
  const isMobile = useIsMobile();

  const rootStyle = isMobile ? { ...s.root, padding: "8px 8px 48px" } : s.root;
  const cardPad   = isMobile ? 14 : 24;

  return (
    <div style={rootStyle}>
      <div style={s.container}>
        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(tab === "codes" ? s.tabActive : {}) }}
            onClick={() => setTab("codes")}
          >
            🎟️ Code
          </button>
          <button
            style={{ ...s.tab, ...(tab === "users" ? s.tabActive : {}) }}
            onClick={() => setTab("users")}
          >
            👥 Users
          </button>
          <button
            style={{ ...s.tab, ...(tab === "jackpot" ? s.tabActive : {}), ...(tab !== "jackpot" ? s.tabJackpot : {}) }}
            onClick={() => setTab("jackpot")}
          >
            🎰 Control
          </button>
          <button
            style={{ ...s.tab, ...(tab === "logs" ? s.tabActive : {}) }}
            onClick={() => setTab("logs")}
          >
            📋 Logs
          </button>
        </div>

        {tab === "codes"   && <CodesTab   isMobile={isMobile} cardPad={cardPad} />}
        {tab === "users"   && <UsersTab   isMobile={isMobile} cardPad={cardPad} />}
        {tab === "jackpot" && <JackpotTab isMobile={isMobile} cardPad={cardPad} />}
        {tab === "logs"    && <LogsTab    isMobile={isMobile} cardPad={cardPad} />}
      </div>
    </div>
  );
}

// ── CODES TAB ─────────────────────────────────────────────────────────────────

// ── SHARED: SEARCH + PAGINATION ──────────────────────────────────────────────

const PAGE_SIZES = [10, 50, 100, 500, 1000];

function SearchInput({ value, onChange, placeholder = "Cari username…" }) {
  return (
    <div style={{ position: "relative" }}>
      <span style={s.searchIcon}>🔍</span>
      <input
        style={s.searchInput}
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      {value && (
        <button style={s.searchClear} onClick={() => onChange("")}>✕</button>
      )}
    </div>
  );
}

function Pagination({ page, pageSize, total, onPage, onPageSize }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to   = Math.min(total, page * pageSize);

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (page > 3) pages.push("…");
    for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) pages.push(i);
    if (page < totalPages - 2) pages.push("…");
    pages.push(totalPages);
  }

  return (
    <div style={s.pagWrap}>
      <div style={s.pagSizes}>
        <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>Per halaman:</span>
        {PAGE_SIZES.map(sz => (
          <button
            key={sz}
            style={{ ...s.pageBtn, ...(pageSize === sz ? s.pageBtnOn : {}) }}
            onClick={() => { onPageSize(sz); onPage(1); }}
          >
            {sz}
          </button>
        ))}
      </div>
      <div style={s.pagNav}>
        <span style={{ fontSize: 11, color: C.muted, whiteSpace: "nowrap" }}>
          {total === 0 ? "Tidak ada data" : `${from}–${to} dari ${total}`}
        </span>
        <button
          style={{ ...s.pageBtn, ...(page <= 1 ? s.pageBtnOff : {}) }}
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
        >‹</button>
        {pages.map((p, i) =>
          p === "…"
            ? <span key={`d${i}`} style={{ color: C.muted, fontSize: 12, padding: "0 2px" }}>…</span>
            : <button
                key={p}
                style={{ ...s.pageBtn, ...(page === p ? s.pageBtnOn : {}) }}
                onClick={() => onPage(p)}
              >{p}</button>
        )}
        <button
          style={{ ...s.pageBtn, ...(page >= totalPages ? s.pageBtnOff : {}) }}
          onClick={() => onPage(page + 1)}
          disabled={page >= totalPages}
        >›</button>
      </div>
    </div>
  );
}

const USE_LIMITS = ["1", "5", "10", "25"];

function codeStatus(c) {
  if (c.useCount !== undefined) {
    const full = c.maxUses !== null && c.useCount >= c.maxUses;
    if (full) return "habis";
    if (c.useCount > 0) return "partial";
    return "avail";
  }
  return c.usedBy ? "habis" : "avail";
}

function codeUses(c) {
  if (c.useCount !== undefined)
    return `${c.useCount} / ${c.maxUses === null ? "♾" : c.maxUses}`;
  return c.usedBy ? "1 / 1" : "0 / 1";
}

function CodesTab({ isMobile = false, cardPad = 24 }) {
  const [amount, setAmount] = useState(10000);
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [maxUsesMode, setMaxUsesMode] = useState("1");
  const [customUses, setCustomUses] = useState("");
  const [generated, setGenerated] = useState(null);
  const [codes, setCodes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const finalAmount = useCustom ? (parseInt(custom, 10) || 0) : amount;
  const finalMaxUses = maxUsesMode === "limitless"
    ? null
    : maxUsesMode === "custom"
      ? (parseInt(customUses, 10) || 1)
      : parseInt(maxUsesMode, 10);

  const fetchCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/codes", { headers: authHeader() });
      if (res.ok) setCodes((await res.json()).codes);
    } catch (e) {}
  }, []);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const generate = async () => {
    if (finalAmount < 1000) { setError("Nominal minimal 1.000."); return; }
    if (maxUsesMode === "custom" && (!customUses || parseInt(customUses, 10) < 1)) {
      setError("Jumlah penggunaan minimal 1."); return;
    }
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ amount: finalAmount, maxUses: finalMaxUses }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      setGenerated(data);
      setCopied(false);
      fetchCodes();
    } catch (e) {
      setError(e.message);
    } finally {
      setGenerating(false);
    }
  };

  const copy = () => {
    navigator.clipboard.writeText(generated.code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const codesCols = isMobile ? "1fr 90px 60px" : "1fr 110px 90px 90px";

  return (
    <>
      <div style={{ ...s.card, padding: cardPad }}>
        <h3 style={s.cardTitle}>Generate Kode Redeem</h3>

        <p style={s.label}>Pilih nominal</p>
        <div style={s.grid}>
          {AMOUNTS.map((a) => (
            <button
              key={a}
              style={{ ...s.chip, ...(!useCustom && amount === a ? s.chipActive : {}) }}
              onClick={() => { setAmount(a); setUseCustom(false); }}
            >
              🪙 {fmt(a)}
            </button>
          ))}
          <button
            style={{ ...s.chip, ...(useCustom ? s.chipActive : {}), ...s.chipFull }}
            onClick={() => setUseCustom(true)}
          >
            ✏️ Nominal custom
          </button>
        </div>

        {useCustom && (
          <>
            <p style={{ ...s.label, marginTop: 4 }}>Nominal custom</p>
            <input
              style={s.input}
              type="number"
              min="1000"
              placeholder="Min. 1.000"
              value={custom}
              onChange={(e) => setCustom(e.target.value)}
              autoFocus
            />
          </>
        )}

        <p style={{ ...s.label, marginTop: 4 }}>Batas penggunaan kode</p>
        <div style={s.grid}>
          {USE_LIMITS.map((n) => (
            <button
              key={n}
              style={{ ...s.chip, ...(maxUsesMode === n ? s.chipActive : {}) }}
              onClick={() => setMaxUsesMode(n)}
            >
              {n}× pakai
            </button>
          ))}
          <button
            style={{ ...s.chip, ...(maxUsesMode === "limitless" ? s.chipActive : {}) }}
            onClick={() => setMaxUsesMode("limitless")}
          >
            ♾ Limitless
          </button>
          <button
            style={{ ...s.chip, ...(maxUsesMode === "custom" ? s.chipActive : {}) }}
            onClick={() => setMaxUsesMode("custom")}
          >
            ✏️ Custom
          </button>
        </div>

        {maxUsesMode === "custom" && (
          <>
            <p style={{ ...s.label, marginTop: 4 }}>Jumlah penggunaan custom</p>
            <input
              style={s.input}
              type="number"
              min="1"
              step="1"
              placeholder="Min. 1"
              value={customUses}
              onChange={(e) => setCustomUses(e.target.value)}
              autoFocus
            />
          </>
        )}

        {error && <p style={s.errorMsg}>✕ {error}</p>}

        <button
          style={{ ...s.btnGold, ...(generating ? s.btnDisabled : {}) }}
          onClick={generate}
          disabled={generating}
        >
          {generating ? "Generating…" : "⚡ Generate Kode"}
        </button>

        {generated && (
          <div style={s.resultBox}>
            <div style={s.resultTop}>
              <span style={s.smallLabel}>Kode berhasil dibuat</span>
              <span style={s.resultAmount}>
                🪙 {fmt(generated.amount)} koin
                {" · "}
                {generated.maxUses === null ? "♾ limitless" : `${generated.maxUses}× pakai`}
              </span>
            </div>
            <div style={s.codeRow}>
              <span style={s.codeText}>{generated.code}</span>
              <button style={s.copyBtn} onClick={copy}>
                {copied ? "✓ Disalin" : "Salin"}
              </button>
            </div>
          </div>
        )}
      </div>

      <div style={{ ...s.card, padding: cardPad }}>
        <div style={s.rowBetween}>
          <h3 style={s.cardTitle}>Semua Kode</h3>
          <button style={s.refreshBtn} onClick={fetchCodes}>↻ Refresh</button>
        </div>

        {codes.length === 0 ? (
          <p style={s.empty}>Belum ada kode.</p>
        ) : (
          <div style={s.table}>
            <div style={{ ...s.tableRow, ...s.tableHead, gridTemplateColumns: codesCols }}>
              <span>Kode</span>
              <span>Nominal</span>
              {!isMobile && <span>Penggunaan</span>}
              <span>Status</span>
            </div>
            {codes.map((c) => {
              const st = codeStatus(c);
              return (
                <div key={c._id} style={{ ...s.tableRow, gridTemplateColumns: codesCols }}>
                  <code style={s.codeCell}>{c.code}</code>
                  <span style={{ fontSize: 13, color: C.cream }}>🪙 {fmt(c.amount)}</span>
                  {!isMobile && <span style={{ fontSize: 12, color: C.muted, fontFamily: "monospace" }}>{codeUses(c)}</span>}
                  <span>
                    {st === "habis"   && <span style={s.badgeUsed}>Habis</span>}
                    {st === "partial" && <span style={s.badgePart}>Sebagian</span>}
                    {st === "avail"   && <span style={s.badgeAvail}>Tersedia</span>}
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}

// ── USERS TAB ─────────────────────────────────────────────────────────────────

function UsersTab({ isMobile = false, cardPad = 24 }) {
  const [users, setUsers]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [editing, setEditing]   = useState(null);
  const [inputVal, setInputVal] = useState("");
  const [saving, setSaving]     = useState(false);
  const [feedback, setFeedback] = useState({});
  const [search, setSearch]     = useState("");
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleSearch  = (v)  => { setSearch(v);   setPage(1); };
  const handlePgSize  = (sz) => { setPageSize(sz); setPage(1); };

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { headers: authHeader() });
      if (res.ok) setUsers((await res.json()).users);
    } catch (e) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchUsers(); }, [fetchUsers]);

  const openEdit = (userId, mode, currentVal = "") => {
    if (editing?.userId === userId && editing?.mode === mode) {
      setEditing(null);
    } else {
      setEditing({ userId, mode });
      setInputVal(mode === "coins" ? String(currentVal) : "");
    }
  };

  const save = async (userId) => {
    const { mode } = editing;
    setSaving(true);
    try {
      let res;
      if (mode === "coins") {
        const coins = parseInt(inputVal, 10);
        if (isNaN(coins) || coins < 0) throw new Error("Jumlah koin tidak valid.");
        res = await fetch(`/api/admin/users/${userId}/coins`, {
          method: "PATCH",
          headers: { ...authHeader(), "Content-Type": "application/json" },
          body: JSON.stringify({ coins }),
        });
      } else {
        if (inputVal.length < 6) throw new Error("Password minimal 6 karakter.");
        res = await fetch(`/api/admin/users/${userId}/password`, {
          method: "PATCH",
          headers: { ...authHeader(), "Content-Type": "application/json" },
          body: JSON.stringify({ newPassword: inputVal }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setFeedback((f) => ({ ...f, [userId]: { type: "ok", msg: mode === "coins" ? `Koin diperbarui → ${fmt(data.coins)}` : "Password berhasil diubah." } }));
      setEditing(null);
      fetchUsers();
      setTimeout(() => setFeedback((f) => { const n = { ...f }; delete n[userId]; return n; }), 3000);
    } catch (e) {
      setFeedback((f) => ({ ...f, [userId]: { type: "err", msg: e.message } }));
      setTimeout(() => setFeedback((f) => { const n = { ...f }; delete n[userId]; return n; }), 3000);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div style={{ ...s.card, padding: cardPad }}><p style={s.empty}>Memuat data pengguna…</p></div>;

  const filtered = users.filter(u => u.username.toLowerCase().includes(search.toLowerCase()));
  const paged    = filtered.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div style={{ ...s.card, padding: cardPad }}>
      <div style={s.rowBetween}>
        <h3 style={s.cardTitle}>Pengguna <span style={s.countBadge}>{users.length}</span></h3>
        <button style={s.refreshBtn} onClick={fetchUsers}>↻ Refresh</button>
      </div>

      <SearchInput value={search} onChange={handleSearch} />

      {filtered.length === 0 ? (
        <p style={s.empty}>{search ? "Pengguna tidak ditemukan." : "Belum ada pengguna."}</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {paged.map((u) => {
            const isEditing = editing?.userId === String(u._id);
            const fb        = feedback[String(u._id)];
            return (
              <div key={u._id} style={s.userBlock}>
                <div style={s.userRow}>
                  <div style={s.userAvatar}>{u.username[0].toUpperCase()}</div>
                  <div style={s.userInfo}>
                    <span style={s.userName}>{u.username}</span>
                    <span style={s.userCoins}>🪙 {fmt(u.coins ?? 10000)}</span>
                  </div>
                  <div style={s.userActions}>
                    <button
                      style={{ ...s.actionBtn, ...(isEditing && editing.mode === "coins" ? s.actionBtnActive : {}) }}
                      onClick={() => openEdit(String(u._id), "coins", u.coins ?? 10000)}
                    >
                      Edit Koin
                    </button>
                    <button
                      style={{ ...s.actionBtn, ...(isEditing && editing.mode === "password" ? s.actionBtnActive : {}) }}
                      onClick={() => openEdit(String(u._id), "password")}
                    >
                      Reset PW
                    </button>
                  </div>
                </div>

                {fb && (
                  <p style={{ ...s.feedbackMsg, ...(fb.type === "ok" ? s.feedbackOk : s.feedbackErr) }}>
                    {fb.type === "ok" ? "✓ " : "✕ "}{fb.msg}
                  </p>
                )}

                {isEditing && (
                  <div style={s.editPanel}>
                    {editing.mode === "coins" ? (
                      <>
                        <label style={s.editLabel}>Jumlah koin baru</label>
                        <input
                          style={s.editInput}
                          type="number"
                          min="0"
                          value={inputVal}
                          onChange={(e) => setInputVal(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && save(String(u._id))}
                          autoFocus
                        />
                      </>
                    ) : (
                      <>
                        <label style={s.editLabel}>Password baru</label>
                        <input
                          style={s.editInput}
                          type="password"
                          placeholder="Min. 6 karakter"
                          value={inputVal}
                          onChange={(e) => setInputVal(e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && save(String(u._id))}
                          autoFocus
                        />
                      </>
                    )}
                    <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                      <button style={s.cancelBtn} onClick={() => setEditing(null)}>Batal</button>
                      <button
                        style={{ ...s.saveBtn, ...(saving ? s.btnDisabled : {}) }}
                        onClick={() => save(String(u._id))}
                        disabled={saving}
                      >
                        {saving ? "Menyimpan…" : "Simpan"}
                      </button>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {filtered.length > 0 && (
        <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={handlePgSize} />
      )}
    </div>
  );
}

// ── JACKPOT TAB ───────────────────────────────────────────────────────────────

function JackpotTab({ isMobile = false, cardPad = 24 }) {
  const [users, setUsers]       = useState([]);
  const [jackpots, setJackpots] = useState([]);
  const [wins, setWins]         = useState([]);
  const [loses, setLoses]       = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(null);
  const [jSearch, setJSearch]   = useState("");
  const [jPage, setJPage]       = useState(1);
  const [jPageSize, setJPageSize] = useState(10);
  const [setModal, setSetModal] = useState(null); // { uid, username, type: "win"|"lose" }
  const [setCount, setSetCount] = useState(1);

  const handleJSearch = (v)  => { setJSearch(v);    setJPage(1); };
  const handleJPgSize = (sz) => { setJPageSize(sz); setJPage(1); };

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, jRes, wRes, lRes] = await Promise.all([
        fetch("/api/admin/users",   { headers: authHeader() }),
        fetch("/api/admin/jackpot", { headers: authHeader() }),
        fetch("/api/admin/win",     { headers: authHeader() }),
        fetch("/api/admin/lose",    { headers: authHeader() }),
      ]);
      if (uRes.ok) setUsers((await uRes.json()).users);
      if (jRes.ok) setJackpots((await jRes.json()).jackpots);
      if (wRes.ok) setWins((await wRes.json()).wins);
      if (lRes.ok) setLoses((await lRes.json()).loses);
    } catch (e) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const jackpotIds = new Set(jackpots.map(j => j.userId));
  const winIds     = new Set(wins.map(w => w.userId));
  const loseIds    = new Set(loses.map(l => l.userId));

  const openSetModal = (uid, username, type) => {
    setSetModal({ uid, username, type });
    setSetCount(1);
  };

  const confirmSet = async () => {
    const { uid, username, type } = setModal;
    setBusy(uid + "_" + type);
    try {
      const endpoint = type === "win" ? "/api/admin/win" : "/api/admin/lose";
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ userId: uid, username, count: setCount }),
      });
      if (res.ok) { await fetchAll(); setSetModal(null); }
    } catch (e) {}
    finally { setBusy(null); }
  };

  const setJackpot = async (userId, username) => {
    setBusy(userId + "_jackpot");
    try {
      const res = await fetch("/api/admin/jackpot", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ userId, username }),
      });
      if (res.ok) await fetchAll();
    } catch (e) {}
    finally { setBusy(null); }
  };

  const cancelJackpot = async (userId) => {
    setBusy(userId + "_jackpot");
    try {
      const res = await fetch(`/api/admin/jackpot/${userId}`, { method: "DELETE", headers: authHeader() });
      if (res.ok) await fetchAll();
    } catch (e) {}
    finally { setBusy(null); }
  };

  const cancelWin = async (userId) => {
    setBusy(userId + "_win");
    try {
      const res = await fetch(`/api/admin/win/${userId}`, { method: "DELETE", headers: authHeader() });
      if (res.ok) await fetchAll();
    } catch (e) {}
    finally { setBusy(null); }
  };

  const cancelLose = async (userId) => {
    setBusy(userId + "_lose");
    try {
      const res = await fetch(`/api/admin/lose/${userId}`, { method: "DELETE", headers: authHeader() });
      if (res.ok) await fetchAll();
    } catch (e) {}
    finally { setBusy(null); }
  };

  if (loading) return <div style={{ ...s.card, padding: cardPad }}><p style={s.empty}>Memuat data…</p></div>;

  const activeCount = wins.length + loses.length + jackpots.length;

  const ctrlRowStyle = isMobile
    ? { ...s.controlsRow, flexDirection: "column" }
    : s.controlsRow;
  const ctrlDivStyle = isMobile
    ? { width: "100%", height: 1, background: `${C.line}88`, flexShrink: 0 }
    : s.controlDivider;

  return (
    <>
      {/* ACTIVE STATUS SUMMARY */}
      <div style={{ ...s.card, padding: cardPad }}>
        <div style={s.rowBetween}>
          <h3 style={s.cardTitle}>
            Status Aktif
            {activeCount > 0 && (
              <span style={{ ...s.countBadge, background: "#a855f722", color: "#c084fc", borderColor: "#c084fc44" }}>
                {activeCount}
              </span>
            )}
          </h3>
          <button style={s.refreshBtn} onClick={fetchAll}>↻ Refresh</button>
        </div>

        {activeCount === 0 ? (
          <p style={s.empty}>Tidak ada kontrol aktif saat ini.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {wins.map(w => (
              <div key={w.userId} style={s.winActiveRow}>
                <div style={s.jackpotInfo}>
                  <span style={{ fontSize: 24 }}>🏆</span>
                  <div>
                    <p style={s.jackpotUser}>{w.username}</p>
                    <p style={{ ...s.jackpotNote, color: C.win }}>
                      Menang {w.count > 1 ? `${w.count}× ` : ""}pada game berikutnya
                    </p>
                  </div>
                </div>
                <button
                  style={{ ...s.cancelWinBtn, ...(busy === w.userId + "_win" ? s.btnDisabled : {}) }}
                  onClick={() => cancelWin(w.userId)}
                  disabled={busy === w.userId + "_win"}
                >
                  Batalkan
                </button>
              </div>
            ))}
            {loses.map(l => (
              <div key={l.userId} style={s.loseActiveRow}>
                <div style={s.jackpotInfo}>
                  <span style={{ fontSize: 24 }}>💀</span>
                  <div>
                    <p style={s.jackpotUser}>{l.username}</p>
                    <p style={{ ...s.jackpotNote, color: C.lose }}>
                      Kalah {l.count > 1 ? `${l.count}× ` : ""}pada game berikutnya
                    </p>
                  </div>
                </div>
                <button
                  style={{ ...s.cancelLoseBtn, ...(busy === l.userId + "_lose" ? s.btnDisabled : {}) }}
                  onClick={() => cancelLose(l.userId)}
                  disabled={busy === l.userId + "_lose"}
                >
                  Batalkan
                </button>
              </div>
            ))}
            {jackpots.map(j => (
              <div key={j.userId} style={s.jackpotActive}>
                <div style={s.jackpotInfo}>
                  <span style={s.jackpotGlow}>🎰</span>
                  <div>
                    <p style={s.jackpotUser}>{j.username}</p>
                    <p style={s.jackpotNote}>Jackpot 7️⃣×3 pada spin slot berikutnya</p>
                  </div>
                </div>
                <button
                  style={{ ...s.cancelJackpotBtn, ...(busy === j.userId + "_jackpot" ? s.btnDisabled : {}) }}
                  onClick={() => cancelJackpot(j.userId)}
                  disabled={busy === j.userId + "_jackpot"}
                >
                  Batalkan
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* USER LIST */}
      <div style={{ ...s.card, padding: cardPad }}>
        <div style={s.rowBetween}>
          <h3 style={s.cardTitle}>Kontrol per User</h3>
          <button style={s.refreshBtn} onClick={fetchAll}>↻ Refresh</button>
        </div>
        <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
          🏆 Menang — user pasti menang di game berikutnya (berlaku untuk semua game).<br />
          🎰 Jackpot — slot menampilkan 7️⃣×3 pada spin berikutnya (lebih prioritas).
        </p>

        <SearchInput value={jSearch} onChange={handleJSearch} />

        {(() => {
          const filteredUsers = users.filter(u => u.username.toLowerCase().includes(jSearch.toLowerCase()));
          const pagedUsers    = filteredUsers.slice((jPage - 1) * jPageSize, jPage * jPageSize);
          return filteredUsers.length === 0 ? (
            <p style={s.empty}>{jSearch ? "Pengguna tidak ditemukan." : "Belum ada pengguna."}</p>
          ) : (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {pagedUsers.map(u => {
                  const uid         = String(u._id);
                  const hasWin      = winIds.has(uid);
                  const hasLose     = loseIds.has(uid);
                  const hasJackpot  = jackpotIds.has(uid);
                  const busyWin     = busy === uid + "_win";
                  const busyLose    = busy === uid + "_lose";
                  const busyJackpot = busy === uid + "_jackpot";
                  const winCount    = wins.find(w => w.userId === uid)?.count || 1;
                  const loseCount   = loses.find(l => l.userId === uid)?.count || 1;
                  const showPicker  = setModal?.uid === uid;

                  let blockStyle = s.userBlock;
                  if (hasJackpot) blockStyle = { ...s.userBlock, ...s.userBlockActive };
                  else if (hasWin) blockStyle = { ...s.userBlock, ...s.userBlockWin };
                  else if (hasLose) blockStyle = { ...s.userBlock, ...s.userBlockLose };

                  return (
                    <div key={uid} style={blockStyle}>
                      <div style={s.userRow}>
                        <div style={s.userAvatar}>{u.username[0].toUpperCase()}</div>
                        <div style={s.userInfo}>
                          <span style={s.userName}>{u.username}</span>
                          <span style={s.userCoins}>🪙 {fmt(u.coins ?? 10000)}</span>
                        </div>
                      </div>

                      {/* WIN | LOSE | JACKPOT controls */}
                      <div style={ctrlRowStyle}>
                        {/* WIN */}
                        <div style={s.controlGroup}>
                          <span style={{ ...s.controlLabel, color: hasWin ? C.win : C.muted }}>
                            🏆{hasWin && winCount > 1 ? ` ×${winCount}` : " Menang"}
                          </span>
                          {hasWin ? (
                            <button
                              style={{ ...s.cancelWinBtn, fontSize: 11, padding: "4px 8px", ...(busyWin ? s.btnDisabled : {}) }}
                              onClick={() => cancelWin(uid)}
                              disabled={busyWin}
                            >
                              {busyWin ? "…" : "Batalkan"}
                            </button>
                          ) : (
                            <button
                              style={{ ...s.setWinBtn, fontSize: 11, padding: "5px 10px", ...(showPicker && setModal.type === "win" ? s.btnDisabled : {}) }}
                              onClick={() => showPicker && setModal.type === "win" ? setSetModal(null) : openSetModal(uid, u.username, "win")}
                            >
                              {showPicker && setModal.type === "win" ? "✕" : "Atur"}
                            </button>
                          )}
                        </div>

                        <div style={ctrlDivStyle} />

                        {/* LOSE */}
                        <div style={s.controlGroup}>
                          <span style={{ ...s.controlLabel, color: hasLose ? C.lose : C.muted }}>
                            💀{hasLose && loseCount > 1 ? ` ×${loseCount}` : " Kalah"}
                          </span>
                          {hasLose ? (
                            <button
                              style={{ ...s.cancelLoseBtn, fontSize: 11, padding: "4px 8px", ...(busyLose ? s.btnDisabled : {}) }}
                              onClick={() => cancelLose(uid)}
                              disabled={busyLose}
                            >
                              {busyLose ? "…" : "Batalkan"}
                            </button>
                          ) : (
                            <button
                              style={{ ...s.setLoseBtn, fontSize: 11, padding: "5px 10px" }}
                              onClick={() => showPicker && setModal.type === "lose" ? setSetModal(null) : openSetModal(uid, u.username, "lose")}
                            >
                              {showPicker && setModal.type === "lose" ? "✕" : "Atur"}
                            </button>
                          )}
                        </div>

                        <div style={ctrlDivStyle} />

                        {/* JACKPOT */}
                        <div style={s.controlGroup}>
                          <span style={{ ...s.controlLabel, color: hasJackpot ? "#f87171" : C.muted }}>🎰 Jackpot</span>
                          {hasJackpot ? (
                            <button
                              style={{ ...s.cancelJackpotBtn, fontSize: 11, padding: "4px 8px", ...(busyJackpot ? s.btnDisabled : {}) }}
                              onClick={() => cancelJackpot(uid)}
                              disabled={busyJackpot}
                            >
                              {busyJackpot ? "…" : "Batalkan"}
                            </button>
                          ) : (
                            <button
                              style={{ ...s.setJackpotBtn, fontSize: 11, padding: "5px 10px", ...(busyJackpot ? s.btnDisabled : {}) }}
                              onClick={() => setJackpot(uid, u.username)}
                              disabled={busyJackpot}
                            >
                              {busyJackpot ? "…" : "Atur"}
                            </button>
                          )}
                        </div>
                      </div>

                      {/* COUNT PICKER (Win / Lose) */}
                      {showPicker && (
                        <div style={s.editPanel}>
                          <label style={s.editLabel}>
                            Jumlah {setModal.type === "win" ? "kemenangan" : "kekalahan"} berturut-turut
                          </label>
                          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
                            {[1, 2, 3, 5, 10].map(n => (
                              <button
                                key={n}
                                style={{ ...s.countChip, ...(setCount === n ? s.countChipOn : {}) }}
                                onClick={() => setSetCount(n)}
                              >{n}×</button>
                            ))}
                            <input
                              type="number" min="1" max="99"
                              value={setCount}
                              style={{ ...s.editInput, width: 72, padding: "6px 10px", fontSize: 13 }}
                              onChange={e => {
                                const v = parseInt(e.target.value, 10);
                                if (!isNaN(v) && v >= 1 && v <= 99) setSetCount(v);
                              }}
                            />
                          </div>
                          <div style={{ display: "flex", gap: 8, marginTop: 8 }}>
                            <button style={s.cancelBtn} onClick={() => setSetModal(null)}>Batal</button>
                            <button
                              style={{
                                ...s.saveBtn,
                                ...(setModal.type === "lose"
                                  ? { background: `linear-gradient(135deg, ${C.lose}, #b85a45)` }
                                  : {}),
                                ...(busy === uid + "_" + setModal.type ? s.btnDisabled : {}),
                              }}
                              onClick={confirmSet}
                              disabled={busy === uid + "_" + setModal.type}
                            >
                              {busy === uid + "_" + setModal.type ? "…" : `Konfirmasi ${setCount}×`}
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
              <Pagination page={jPage} pageSize={jPageSize} total={filteredUsers.length} onPage={setJPage} onPageSize={handleJPgSize} />
            </>
          );
        })()}
      </div>
    </>
  );
}

// ── LOGS TAB ──────────────────────────────────────────────────────────────────

const MONTHS = ["Jan","Feb","Mar","Apr","Mei","Jun","Jul","Agu","Sep","Okt","Nov","Des"];
function fmtTime(iso) {
  const d = new Date(iso);
  const h = String(d.getHours()).padStart(2, "0");
  const m = String(d.getMinutes()).padStart(2, "0");
  return `${d.getDate()} ${MONTHS[d.getMonth()]} ${h}:${m}`;
}

const RESULT_FILTERS = ["semua", "win", "jackpot", "impas", "lose"];
const GAME_FILTERS   = ["semua", "slot", "dadu", "blackjack"];

function LogsTab({ isMobile = false, cardPad = 24 }) {
  const [logs, setLogs]       = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch]   = useState("");
  const [gameF, setGameF]     = useState("semua");
  const [resultF, setResultF] = useState("semua");
  const [page, setPage]       = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const handleSearch  = (v)  => { setSearch(v);    setPage(1); };
  const handlePgSize  = (sz) => { setPageSize(sz); setPage(1); };

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/logs", { headers: authHeader() });
      if (res.ok) setLogs((await res.json()).logs);
    } catch (e) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  if (loading) return <div style={{ ...s.card, padding: cardPad }}><p style={s.empty}>Memuat logs…</p></div>;

  const filtered = logs.filter(l => {
    const matchUser   = l.username.toLowerCase().includes(search.toLowerCase());
    const matchGame   = gameF   === "semua" || l.game   === gameF;
    const matchResult = resultF === "semua" || l.result === resultF;
    return matchUser && matchGame && matchResult;
  });
  const paged = filtered.slice((page - 1) * pageSize, page * pageSize);

  // Stats for current filter
  const totalWin  = filtered.filter(l => l.result === "win" || l.result === "jackpot").length;
  const totalLose = filtered.filter(l => l.result === "lose").length;

  const logCols = isMobile ? "1fr 58px 64px" : "1fr 52px 70px 70px 72px";

  return (
    <div style={{ ...s.card, padding: cardPad }}>
      {/* Header */}
      <div style={s.rowBetween}>
        <h3 style={s.cardTitle}>
          Logs
          <span style={s.countBadge}>{filtered.length}</span>
        </h3>
        <button style={s.refreshBtn} onClick={fetchLogs}>↻ Refresh</button>
      </div>

      {/* Quick stats */}
      <div style={s.logStats}>
        <div style={s.logStat}>
          <span style={{ color: C.win, fontWeight: 700 }}>{totalWin}</span>
          <span style={{ fontSize: 11, color: C.muted }}>Menang</span>
        </div>
        <div style={s.logStatDiv} />
        <div style={s.logStat}>
          <span style={{ color: C.lose, fontWeight: 700 }}>{totalLose}</span>
          <span style={{ fontSize: 11, color: C.muted }}>Kalah</span>
        </div>
      </div>

      {/* Filters */}
      <div style={{ display: "flex", gap: 10 }}>
        <div style={s.filterGroup}>
          <span style={s.filterLabel}>Game</span>
          <select
            value={gameF}
            onChange={e => { setGameF(e.target.value); setPage(1); }}
            style={s.filterSelect}
          >
            <option value="semua">🎮 Semua</option>
            <option value="slot">🎰 Slot</option>
            <option value="dadu">🎲 Dadu</option>
            <option value="blackjack">🃏 Blackjack</option>
          </select>
        </div>
        <div style={s.filterGroup}>
          <span style={s.filterLabel}>Hasil</span>
          <select
            value={resultF}
            onChange={e => { setResultF(e.target.value); setPage(1); }}
            style={s.filterSelect}
          >
            <option value="semua">Semua Hasil</option>
            <option value="win">✅ Menang</option>
            <option value="jackpot">⭐ Jackpot</option>
            <option value="impas">➖ Impas</option>
            <option value="lose">❌ Kalah</option>
          </select>
        </div>
      </div>

      {/* Search */}
      <SearchInput value={search} onChange={handleSearch} />

      {/* Table */}
      {filtered.length === 0 ? (
        <p style={s.empty}>{search || gameF !== "semua" || resultF !== "semua" ? "Tidak ada log yang cocok." : "Belum ada log."}</p>
      ) : (
        <>
          {/* Head */}
          <div style={{ ...s.logRow, ...s.logHead, gridTemplateColumns: logCols }}>
            <span>User</span>
            {!isMobile && <span>Game</span>}
            {!isMobile && <span style={{ textAlign: "right" }}>Bet</span>}
            <span style={{ textAlign: "center" }}>Hasil</span>
            <span style={{ textAlign: "right" }}>Delta</span>
          </div>
          {/* Rows */}
          {paged.map((l) => (
            <div key={l._id} style={{ ...s.logRow, gridTemplateColumns: logCols }}>
              <div>
                <p style={s.logUser}>{l.username}{l.forced && <span style={s.forcedBadge}>F</span>}</p>
                <p style={s.logTime}>{fmtTime(l.createdAt)}</p>
              </div>
              {!isMobile && (
                <span style={{ ...s.logGameBadge, ...(l.game === "slot" ? s.gameBadgeSlot : l.game === "blackjack" ? s.gameBadgeBJ : s.gameBadgeDadu) }}>
                  {l.game === "slot" ? "Slot" : l.game === "blackjack" ? "BJ" : "Dadu"}
                </span>
              )}
              {!isMobile && (
                <span style={{ fontSize: 12, color: C.muted, textAlign: "right" }}>{fmt(l.bet)}</span>
              )}
              <span style={{ textAlign: "center" }}>
                {l.result === "jackpot" && <span style={s.badgeJackpot}>Jackpot</span>}
                {l.result === "win"     && <span style={s.badgeAvail}>Menang</span>}
                {l.result === "impas"   && <span style={s.badgePart}>Impas</span>}
                {l.result === "lose"    && <span style={s.badgeUsed}>Kalah</span>}
              </span>
              <span style={{
                fontSize: 13, fontWeight: 700, textAlign: "right",
                color: l.delta > 0 ? C.win : l.delta < 0 ? C.lose : C.muted,
              }}>
                {l.delta > 0 ? "+" : ""}{fmt(l.delta)}
              </span>
            </div>
          ))}

          <Pagination page={page} pageSize={pageSize} total={filtered.length} onPage={setPage} onPageSize={handlePgSize} />
        </>
      )}
    </div>
  );
}

// ── STYLES ────────────────────────────────────────────────────────────────────

const C = {
  ink: "#14110E", panel: "#211C17", panel2: "#1a1510",
  gold: "#D8A24A", goldHi: "#F2CB72", cream: "#F2EBDD",
  muted: "#9C8E78", line: "#3A322A",
  win: "#74C690", lose: "#DC7C68",
};

const s = {
  root: { padding: "32px 24px 60px", display: "flex", justifyContent: "center" },
  container: { width: "100%", maxWidth: 600, display: "flex", flexDirection: "column", gap: 20 },

  // TABS
  tabs: {
    display: "flex", gap: 4,
    background: C.panel, border: `1px solid ${C.line}`,
    borderRadius: 14, padding: 4,
  },
  tab: {
    flex: 1, padding: "9px 0", borderRadius: 10,
    background: "none", border: "none", cursor: "pointer",
    color: C.muted, fontSize: 14, fontWeight: 600, transition: "all .15s",
  },
  tabActive: {
    background: `${C.gold}22`, color: C.goldHi,
    border: `1px solid ${C.gold}44`,
  },

  // CARD
  card: {
    background: C.panel, border: `1px solid ${C.line}`,
    borderRadius: 20, padding: 24,
    display: "flex", flexDirection: "column", gap: 14,
  },
  cardTitle: {
    fontFamily: "'Fraunces', serif", fontWeight: 600,
    fontSize: 17, color: C.cream, margin: 0,
    display: "flex", alignItems: "center", gap: 8,
  },
  countBadge: {
    fontSize: 12, fontFamily: "system-ui",
    background: `${C.gold}22`, color: C.goldHi,
    border: `1px solid ${C.gold}44`,
    borderRadius: 999, padding: "2px 8px", fontWeight: 700,
  },
  rowBetween: { display: "flex", alignItems: "center", justifyContent: "space-between" },
  refreshBtn: {
    background: "none", border: `1px solid ${C.line}`,
    borderRadius: 8, padding: "5px 12px", cursor: "pointer",
    color: C.muted, fontSize: 13,
  },

  // CODES
  label: { fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px", margin: 0 },
  smallLabel: { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" },
  grid: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 },
  chip: {
    background: C.panel2, border: `1px solid ${C.line}`,
    borderRadius: 10, padding: "11px 8px",
    color: C.cream, fontSize: 13, fontWeight: 600,
    cursor: "pointer", textAlign: "center",
  },
  chipActive: { background: `${C.gold}22`, border: `1px solid ${C.gold}`, color: C.goldHi },
  chipFull: { gridColumn: "span 2" },
  input: {
    width: "100%", padding: "11px 14px", borderRadius: 10,
    background: C.ink, border: `1px solid ${C.line}`,
    color: C.cream, fontSize: 14, outline: "none", boxSizing: "border-box",
  },
  errorMsg: {
    fontSize: 13, color: C.lose, background: "#DC7C6818",
    border: `1px solid ${C.lose}44`, borderRadius: 8, padding: "9px 12px", margin: 0,
  },
  btnGold: {
    width: "100%", padding: "12px 0",
    background: `linear-gradient(135deg, ${C.goldHi}, ${C.gold})`,
    border: "none", borderRadius: 10, cursor: "pointer",
    color: C.ink, fontSize: 15, fontWeight: 700, fontFamily: "'Fraunces', serif",
  },
  btnDisabled: { opacity: 0.4, cursor: "not-allowed" },
  resultBox: {
    background: `${C.gold}12`, border: `1px solid ${C.gold}44`,
    borderRadius: 12, padding: 16,
    display: "flex", flexDirection: "column", gap: 10,
  },
  resultTop: { display: "flex", justifyContent: "space-between", alignItems: "center" },
  resultAmount: { fontSize: 14, fontWeight: 700, color: C.goldHi },
  codeRow: {
    display: "flex", alignItems: "center", justifyContent: "space-between",
    background: C.ink, borderRadius: 10, padding: "10px 14px",
  },
  codeText: { fontFamily: "monospace", fontSize: 20, fontWeight: 700, color: C.cream, letterSpacing: "2px" },
  copyBtn: {
    background: `${C.gold}22`, border: `1px solid ${C.gold}55`,
    borderRadius: 8, padding: "6px 14px", cursor: "pointer",
    color: C.goldHi, fontSize: 13, fontWeight: 600,
  },
  table: { display: "flex", flexDirection: "column" },
  tableHead: {
    fontSize: 11, color: C.muted, textTransform: "uppercase",
    letterSpacing: "0.8px", borderBottom: `1px solid ${C.line}`,
    paddingBottom: 8, marginBottom: 4,
  },
  tableRow: {
    display: "grid", gridTemplateColumns: "1fr 130px 100px",
    padding: "10px 4px", borderBottom: `1px solid ${C.line}22`,
    alignItems: "center", gap: 8,
  },
  tableRowWide: {
    gridTemplateColumns: "1fr 110px 90px 90px",
  },
  codeCell: {
    fontFamily: "monospace", fontSize: 13, fontWeight: 700,
    color: C.goldHi, letterSpacing: "1.5px",
    background: `${C.gold}15`, border: `1px solid ${C.gold}33`,
    borderRadius: 6, padding: "3px 8px",
    display: "inline-block",
  },
  badgeUsed: {
    fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
    background: "#DC7C6820", color: C.lose, border: `1px solid ${C.lose}44`,
  },
  badgeAvail: {
    fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
    background: "#74C69020", color: C.win, border: `1px solid ${C.win}44`,
  },
  badgePart: {
    fontSize: 11, fontWeight: 700, padding: "3px 8px", borderRadius: 999,
    background: "#E8C26A20", color: "#E8C26A", border: "1px solid #E8C26A44",
  },
  empty: { fontSize: 13, color: C.muted, textAlign: "center", padding: "20px 0", margin: 0 },

  // USERS
  userBlock: {
    background: C.panel2, borderRadius: 14,
    border: `1px solid ${C.line}`, overflow: "hidden",
  },
  userRow: {
    display: "flex", alignItems: "center", gap: 14,
    padding: "14px 16px",
  },
  userAvatar: {
    width: 38, height: 38, borderRadius: "50%", flexShrink: 0,
    background: `linear-gradient(135deg, ${C.goldHi}, ${C.gold})`,
    display: "flex", alignItems: "center", justifyContent: "center",
    fontWeight: 700, fontSize: 16, color: C.ink,
  },
  userInfo: { flex: 1, display: "flex", flexDirection: "column", gap: 2 },
  userName: { fontSize: 15, fontWeight: 600, color: C.cream },
  userCoins: { fontSize: 12, color: C.goldHi, fontWeight: 600 },
  userActions: { display: "flex", gap: 6, flexShrink: 0 },
  actionBtn: {
    background: "none", border: `1px solid ${C.line}`,
    borderRadius: 8, padding: "6px 11px", cursor: "pointer",
    color: C.muted, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
  },
  actionBtnActive: {
    background: `${C.gold}18`, border: `1px solid ${C.gold}55`, color: C.goldHi,
  },
  feedbackMsg: {
    fontSize: 13, padding: "8px 16px", margin: 0,
    borderTop: `1px solid ${C.line}22`,
  },
  feedbackOk: { color: C.win, background: "#74C69010" },
  feedbackErr: { color: C.lose, background: "#DC7C6810" },
  editPanel: {
    padding: "14px 16px", borderTop: `1px solid ${C.line}`,
    background: "#16120f",
    display: "flex", flexDirection: "column", gap: 6,
  },
  editLabel: { fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.8px" },
  editInput: {
    width: "100%", padding: "10px 12px", borderRadius: 8,
    background: C.ink, border: `1px solid ${C.line}`,
    color: C.cream, fontSize: 14, outline: "none", boxSizing: "border-box",
  },
  cancelBtn: {
    flex: 1, background: "none", border: `1px solid ${C.line}`,
    borderRadius: 8, padding: "8px 0", cursor: "pointer",
    color: C.muted, fontSize: 13,
  },
  saveBtn: {
    flex: 2,
    background: `linear-gradient(135deg, ${C.goldHi}, ${C.gold})`,
    border: "none", borderRadius: 8, padding: "8px 0",
    cursor: "pointer", color: C.ink, fontSize: 13, fontWeight: 700,
  },

  // JACKPOT TAB
  tabJackpot: { color: "#f87171" },
  userBlockActive: {
    border: "1px solid #f8717155",
    background: "#2a100e",
    boxShadow: "0 0 14px -6px #f8717144",
  },
  userBlockLose: {
    border: `1px solid ${C.lose}55`,
    background: "#2a100e",
    boxShadow: `0 0 14px -6px ${C.lose}44`,
  },
  userBlockWin: {
    border: `1px solid ${C.win}55`,
    background: "#0a2415",
    boxShadow: `0 0 14px -6px ${C.win}44`,
  },
  jackpotActive: {
    background: "#2a100e", border: "1px solid #f8717155",
    borderRadius: 14, padding: "14px 16px",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    boxShadow: "0 0 18px -8px #f8717155",
  },
  winActiveRow: {
    background: "#0a2415", border: `1px solid ${C.win}55`,
    borderRadius: 14, padding: "14px 16px",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    boxShadow: `0 0 18px -8px ${C.win}55`,
  },
  jackpotInfo: { display: "flex", alignItems: "center", gap: 12 },
  jackpotGlow: { fontSize: 28, filter: "drop-shadow(0 0 8px #f8a72a)" },
  jackpotUser: { fontSize: 15, fontWeight: 700, color: C.cream, margin: 0 },
  jackpotNote: { fontSize: 12, color: "#f87171", margin: 0, marginTop: 2 },
  jackpotBadgeWrap: { display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6 },
  jackpotBadge: {
    fontSize: 11, fontWeight: 700, padding: "3px 10px", borderRadius: 999,
    background: "#f8717120", color: "#f87171", border: "1px solid #f8717155",
    whiteSpace: "nowrap",
  },
  setJackpotBtn: {
    background: "linear-gradient(135deg, #f87171, #dc4040)",
    border: "none", borderRadius: 8, padding: "7px 14px",
    cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 700,
    whiteSpace: "nowrap", flexShrink: 0,
  },
  cancelJackpotBtn: {
    background: "none", border: "1px solid #f8717166",
    borderRadius: 8, padding: "6px 12px", cursor: "pointer",
    color: "#f87171", fontSize: 12, fontWeight: 600, flexShrink: 0,
  },
  setWinBtn: {
    background: `linear-gradient(135deg, ${C.win}, #45a868)`,
    border: "none", borderRadius: 8, padding: "7px 14px",
    cursor: "pointer", color: "#0c2415", fontSize: 12, fontWeight: 700,
    whiteSpace: "nowrap", flexShrink: 0,
  },
  cancelWinBtn: {
    background: "none", border: `1px solid ${C.win}66`,
    borderRadius: 8, padding: "6px 12px", cursor: "pointer",
    color: C.win, fontSize: 12, fontWeight: 600, flexShrink: 0,
  },
  setLoseBtn: {
    background: `linear-gradient(135deg, ${C.lose}, #b85a45)`,
    border: "none", borderRadius: 8, padding: "7px 14px",
    cursor: "pointer", color: "#fff", fontSize: 12, fontWeight: 700,
    whiteSpace: "nowrap", flexShrink: 0,
  },
  cancelLoseBtn: {
    background: "none", border: `1px solid ${C.lose}66`,
    borderRadius: 8, padding: "6px 12px", cursor: "pointer",
    color: C.lose, fontSize: 12, fontWeight: 600, flexShrink: 0,
  },
  loseActiveRow: {
    background: "#2a100e", border: `1px solid ${C.lose}55`,
    borderRadius: 14, padding: "14px 16px",
    display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
    boxShadow: `0 0 18px -8px ${C.lose}55`,
  },
  // count picker
  countChip: {
    background: C.panel2, border: `1px solid ${C.line}`,
    borderRadius: 8, padding: "5px 12px", cursor: "pointer",
    color: C.muted, fontSize: 13, fontWeight: 700,
  },
  countChipOn: {
    background: `${C.gold}22`, border: `1px solid ${C.gold}66`, color: C.goldHi,
  },
  controlsRow: {
    display: "flex", alignItems: "center", gap: 0,
    borderTop: `1px solid ${C.line}44`,
    background: "#16120f", borderRadius: "0 0 14px 14px",
  },
  controlGroup: {
    flex: 1, display: "flex", alignItems: "center",
    justifyContent: "space-between", gap: 8,
    padding: "10px 14px",
  },
  controlDivider: {
    width: 1, height: 32, background: `${C.line}88`, flexShrink: 0,
  },
  controlLabel: { fontSize: 12, fontWeight: 600 },

  // LOGS
  logStats: {
    display: "flex", alignItems: "center", gap: 0,
    background: C.panel2, borderRadius: 12, border: `1px solid ${C.line}`,
    overflow: "hidden",
  },
  logStat: {
    flex: 1, display: "flex", flexDirection: "column", alignItems: "center",
    padding: "10px 8px", gap: 2, fontSize: 14,
  },
  logStatDiv: { width: 1, height: 36, background: `${C.line}88`, flexShrink: 0 },
  filterChip: {
    background: "none", border: `1px solid ${C.line}`,
    borderRadius: 8, padding: "5px 10px", cursor: "pointer",
    color: C.muted, fontSize: 12, fontWeight: 600, whiteSpace: "nowrap",
  },
  filterChipOn: { background: `${C.gold}22`, color: C.goldHi, borderColor: `${C.gold}55` },
  filterGroup: {
    flex: 1, display: "flex", flexDirection: "column", gap: 5,
  },
  filterLabel: {
    fontSize: 11, fontWeight: 700, color: C.muted,
    textTransform: "uppercase", letterSpacing: "0.06em", paddingLeft: 2,
  },
  filterSelect: {
    width: "100%", background: C.panel2, border: `1px solid ${C.line}`,
    borderRadius: 10, padding: "9px 32px 9px 12px", cursor: "pointer",
    color: C.cream, fontSize: 13, fontWeight: 600,
    outline: "none", appearance: "none", WebkitAppearance: "none",
    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='10' height='6' fill='none'%3E%3Cpath d='M1 1l4 4 4-4' stroke='%239C8E78' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'/%3E%3C/svg%3E")`,
    backgroundRepeat: "no-repeat", backgroundPosition: "right 12px center",
    boxSizing: "border-box",
  },
  logRow: {
    display: "grid",
    gridTemplateColumns: "1fr 52px 70px 70px 72px",
    gap: 8, alignItems: "center",
    padding: "9px 4px",
    borderBottom: `1px solid ${C.line}22`,
  },
  logHead: {
    fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.7px",
    paddingBottom: 6, borderBottom: `1px solid ${C.line}`,
  },
  logUser: { fontSize: 13, fontWeight: 600, color: C.cream, margin: 0, display: "flex", alignItems: "center", gap: 5 },
  logTime: { fontSize: 11, color: C.muted, margin: 0, marginTop: 1 },
  forcedBadge: {
    fontSize: 9, fontWeight: 700, padding: "1px 5px", borderRadius: 4,
    background: "#a855f722", color: "#c084fc", border: "1px solid #c084fc44",
    letterSpacing: "0.5px",
  },
  logGameBadge: {
    fontSize: 10, fontWeight: 700, padding: "3px 7px", borderRadius: 6,
    textAlign: "center", whiteSpace: "nowrap",
  },
  gameBadgeSlot: { background: "#3b82f622", color: "#60a5fa", border: "1px solid #3b82f644" },
  gameBadgeDadu: { background: "#f59e0b22", color: "#fbbf24", border: "1px solid #f59e0b44" },
  gameBadgeBJ:   { background: "#74C69022", color: "#74C690", border: "1px solid #74C69044" },
  badgeJackpot: {
    fontSize: 11, fontWeight: 700, padding: "3px 7px", borderRadius: 999,
    background: "#a855f722", color: "#c084fc", border: "1px solid #a855f744",
  },

  // SEARCH
  searchInput: {
    width: "100%", padding: "9px 34px 9px 34px",
    borderRadius: 10, background: C.ink, border: `1px solid ${C.line}`,
    color: C.cream, fontSize: 13, outline: "none", boxSizing: "border-box",
  },
  searchIcon: {
    position: "absolute", left: 11, top: "50%", transform: "translateY(-50%)",
    color: C.muted, fontSize: 13, pointerEvents: "none",
  },
  searchClear: {
    position: "absolute", right: 10, top: "50%", transform: "translateY(-50%)",
    background: "none", border: "none", color: C.muted, cursor: "pointer",
    fontSize: 12, padding: "2px 4px", lineHeight: 1,
  },

  // PAGINATION
  pagWrap: {
    display: "flex", flexDirection: "column", gap: 8,
    paddingTop: 10, borderTop: `1px solid ${C.line}33`,
  },
  pagSizes: { display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" },
  pagNav:   { display: "flex", alignItems: "center", gap: 3, flexWrap: "wrap" },
  pageBtn: {
    background: "none", border: `1px solid ${C.line}`,
    borderRadius: 6, padding: "4px 9px", cursor: "pointer",
    color: C.muted, fontSize: 12, fontWeight: 600,
    minWidth: 30, textAlign: "center", lineHeight: 1.4,
  },
  pageBtnOn:  { background: `${C.gold}22`, color: C.goldHi, borderColor: `${C.gold}66` },
  pageBtnOff: { opacity: 0.3, cursor: "not-allowed" },
};
