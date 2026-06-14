import React, { useState, useEffect, useCallback } from "react";
import { fmt } from "../dadu/constants";

const AMOUNTS = [5000, 10000, 20000, 50000, 100000];

function authHeader() {
  return { Authorization: `Bearer ${localStorage.getItem("gf_token")}` };
}

// ── ROOT ──────────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState("codes"); // "codes" | "users" | "jackpot"

  return (
    <div style={s.root}>
      <div style={s.container}>
        <div style={s.tabs}>
          <button
            style={{ ...s.tab, ...(tab === "codes" ? s.tabActive : {}) }}
            onClick={() => setTab("codes")}
          >
            🎟️ Code Generator
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
            🎰 Jackpot Control
          </button>
        </div>

        {tab === "codes" && <CodesTab />}
        {tab === "users" && <UsersTab />}
        {tab === "jackpot" && <JackpotTab />}
      </div>
    </div>
  );
}

// ── CODES TAB ─────────────────────────────────────────────────────────────────

function CodesTab() {
  const [amount, setAmount] = useState(10000);
  const [custom, setCustom] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [generated, setGenerated] = useState(null);
  const [codes, setCodes] = useState([]);
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState(null);

  const finalAmount = useCustom ? (parseInt(custom, 10) || 0) : amount;

  const fetchCodes = useCallback(async () => {
    try {
      const res = await fetch("/api/admin/codes", { headers: authHeader() });
      if (res.ok) setCodes((await res.json()).codes);
    } catch (e) {}
  }, []);

  useEffect(() => { fetchCodes(); }, [fetchCodes]);

  const generate = async () => {
    if (finalAmount < 1000) { setError("Nominal minimal 1.000."); return; }
    setError(null);
    setGenerating(true);
    try {
      const res = await fetch("/api/admin/codes", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ amount: finalAmount }),
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

  return (
    <>
      <div style={s.card}>
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
              <span style={s.resultAmount}>🪙 {fmt(generated.amount)} koin</span>
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

      <div style={s.card}>
        <div style={s.rowBetween}>
          <h3 style={s.cardTitle}>Semua Kode</h3>
          <button style={s.refreshBtn} onClick={fetchCodes}>↻ Refresh</button>
        </div>

        {codes.length === 0 ? (
          <p style={s.empty}>Belum ada kode.</p>
        ) : (
          <div style={s.table}>
            <div style={{ ...s.tableRow, ...s.tableHead }}>
              <span>Kode</span>
              <span>Nominal</span>
              <span>Status</span>
            </div>
            {codes.map((c) => (
              <div key={c._id} style={s.tableRow}>
                <code style={s.codeCell}>{c.code}</code>
                <span style={{ fontSize: 13, color: C.cream }}>🪙 {fmt(c.amount)}</span>
                <span>{c.usedBy
                  ? <span style={s.badgeUsed}>Digunakan</span>
                  : <span style={s.badgeAvail}>Tersedia</span>}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}

// ── USERS TAB ─────────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null); // { userId, mode: "coins"|"password" }
  const [inputVal, setInputVal] = useState("");
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState({}); // { [userId]: { type, msg } }

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

  if (loading) return <div style={s.card}><p style={s.empty}>Memuat data pengguna…</p></div>;

  return (
    <div style={s.card}>
      <div style={s.rowBetween}>
        <h3 style={s.cardTitle}>Pengguna <span style={s.countBadge}>{users.length}</span></h3>
        <button style={s.refreshBtn} onClick={fetchUsers}>↻ Refresh</button>
      </div>

      {users.length === 0 ? (
        <p style={s.empty}>Belum ada pengguna.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {users.map((u) => {
            const isEditing = editing?.userId === String(u._id);
            const fb = feedback[String(u._id)];
            return (
              <div key={u._id} style={s.userBlock}>
                {/* USER ROW */}
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

                {/* FEEDBACK */}
                {fb && (
                  <p style={{ ...s.feedbackMsg, ...(fb.type === "ok" ? s.feedbackOk : s.feedbackErr) }}>
                    {fb.type === "ok" ? "✓ " : "✕ "}{fb.msg}
                  </p>
                )}

                {/* EDIT PANEL */}
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
    </div>
  );
}

// ── JACKPOT TAB ───────────────────────────────────────────────────────────────

function JackpotTab() {
  const [users, setUsers]       = useState([]);
  const [jackpots, setJackpots] = useState([]);
  const [wins, setWins]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [busy, setBusy]         = useState(null); // userId being processed

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [uRes, jRes, wRes] = await Promise.all([
        fetch("/api/admin/users",   { headers: authHeader() }),
        fetch("/api/admin/jackpot", { headers: authHeader() }),
        fetch("/api/admin/win",     { headers: authHeader() }),
      ]);
      if (uRes.ok) setUsers((await uRes.json()).users);
      if (jRes.ok) setJackpots((await jRes.json()).jackpots);
      if (wRes.ok) setWins((await wRes.json()).wins);
    } catch (e) {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const jackpotIds = new Set(jackpots.map(j => j.userId));
  const winIds     = new Set(wins.map(w => w.userId));

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
      const res = await fetch(`/api/admin/jackpot/${userId}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (res.ok) await fetchAll();
    } catch (e) {}
    finally { setBusy(null); }
  };

  const setWin = async (userId, username) => {
    setBusy(userId + "_win");
    try {
      const res = await fetch("/api/admin/win", {
        method: "POST",
        headers: { ...authHeader(), "Content-Type": "application/json" },
        body: JSON.stringify({ userId, username }),
      });
      if (res.ok) await fetchAll();
    } catch (e) {}
    finally { setBusy(null); }
  };

  const cancelWin = async (userId) => {
    setBusy(userId + "_win");
    try {
      const res = await fetch(`/api/admin/win/${userId}`, {
        method: "DELETE",
        headers: authHeader(),
      });
      if (res.ok) await fetchAll();
    } catch (e) {}
    finally { setBusy(null); }
  };

  if (loading) return <div style={s.card}><p style={s.empty}>Memuat data…</p></div>;

  const activeCount = wins.length + jackpots.length;

  return (
    <>
      {/* ACTIVE STATUS SUMMARY */}
      <div style={s.card}>
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

        {wins.length === 0 && jackpots.length === 0 ? (
          <p style={s.empty}>Tidak ada kontrol aktif saat ini.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {wins.map(w => (
              <div key={w.userId} style={s.winActiveRow}>
                <div style={s.jackpotInfo}>
                  <span style={{ fontSize: 24 }}>🏆</span>
                  <div>
                    <p style={s.jackpotUser}>{w.username}</p>
                    <p style={{ ...s.jackpotNote, color: C.win }}>Menang pada game berikutnya</p>
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
      <div style={s.card}>
        <h3 style={s.cardTitle}>Kontrol per User</h3>
        <p style={{ fontSize: 12, color: C.muted, margin: 0 }}>
          🏆 Menang — user pasti menang di game berikutnya (berlaku untuk semua game).<br />
          🎰 Jackpot — slot menampilkan 7️⃣×3 pada spin berikutnya (lebih prioritas).
        </p>

        {users.length === 0 ? (
          <p style={s.empty}>Belum ada pengguna.</p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {users.map(u => {
              const uid = String(u._id);
              const hasWin     = winIds.has(uid);
              const hasJackpot = jackpotIds.has(uid);
              const busyWin    = busy === uid + "_win";
              const busyJackpot = busy === uid + "_jackpot";

              let blockStyle = s.userBlock;
              if (hasJackpot) blockStyle = { ...s.userBlock, ...s.userBlockActive };
              else if (hasWin) blockStyle = { ...s.userBlock, ...s.userBlockWin };

              return (
                <div key={uid} style={blockStyle}>
                  <div style={s.userRow}>
                    <div style={s.userAvatar}>{u.username[0].toUpperCase()}</div>
                    <div style={s.userInfo}>
                      <span style={s.userName}>{u.username}</span>
                      <span style={s.userCoins}>🪙 {fmt(u.coins ?? 10000)}</span>
                    </div>
                  </div>

                  {/* CONTROLS ROW */}
                  <div style={s.controlsRow}>
                    {/* WIN */}
                    <div style={s.controlGroup}>
                      <span style={{ ...s.controlLabel, color: hasWin ? C.win : C.muted }}>🏆 Menang</span>
                      {hasWin ? (
                        <button
                          style={{ ...s.cancelWinBtn, fontSize: 11, padding: "4px 10px", ...(busyWin ? s.btnDisabled : {}) }}
                          onClick={() => cancelWin(uid)}
                          disabled={busyWin}
                        >
                          {busyWin ? "…" : "Aktif · Batalkan"}
                        </button>
                      ) : (
                        <button
                          style={{ ...s.setWinBtn, fontSize: 11, padding: "5px 10px", ...(busyWin ? s.btnDisabled : {}) }}
                          onClick={() => setWin(uid, u.username)}
                          disabled={busyWin}
                        >
                          {busyWin ? "…" : "Atur"}
                        </button>
                      )}
                    </div>

                    <div style={s.controlDivider} />

                    {/* JACKPOT */}
                    <div style={s.controlGroup}>
                      <span style={{ ...s.controlLabel, color: hasJackpot ? "#f87171" : C.muted }}>🎰 Jackpot</span>
                      {hasJackpot ? (
                        <button
                          style={{ ...s.cancelJackpotBtn, fontSize: 11, padding: "4px 10px", ...(busyJackpot ? s.btnDisabled : {}) }}
                          onClick={() => cancelJackpot(uid)}
                          disabled={busyJackpot}
                        >
                          {busyJackpot ? "…" : "Aktif · Batalkan"}
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
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
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
};
