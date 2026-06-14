import { Router } from "express";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import { ObjectId } from "mongodb";
import { getDb } from "../db.js";
import { requireAuth } from "../middleware/auth.js";
import { requireAdmin } from "../middleware/admin.js";

const router = Router();

// ── CODES ────────────────────────────────────────────────────────────────────

router.post("/codes", requireAuth, requireAdmin, async (req, res) => {
  const { amount } = req.body ?? {};
  if (typeof amount !== "number" || !isFinite(amount) || amount < 1000)
    return res.status(400).json({ error: "Amount minimal 1.000." });
  try {
    const db = await getDb();
    const code = "GF-" + crypto.randomBytes(4).toString("hex").toUpperCase();
    await db.collection("codes").insertOne({
      code,
      amount: Math.round(amount),
      usedBy: null,
      usedAt: null,
      createdAt: new Date(),
    });
    res.json({ code, amount: Math.round(amount) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

router.get("/codes", requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const codes = await db.collection("codes")
      .find()
      .sort({ createdAt: -1 })
      .toArray();
    res.json({ codes });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

// ── JACKPOT ──────────────────────────────────────────────────────────────────

router.get("/jackpot", requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const jackpots = await db.collection("jackpots").find().sort({ createdAt: -1 }).toArray();
    res.json({ jackpots });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

router.post("/jackpot", requireAuth, requireAdmin, async (req, res) => {
  const { userId, username } = req.body ?? {};
  if (!userId || !username)
    return res.status(400).json({ error: "userId dan username wajib diisi." });
  try {
    const db = await getDb();
    // upsert: satu user hanya boleh punya satu pending jackpot
    await db.collection("jackpots").replaceOne(
      { userId },
      { userId, username, createdAt: new Date() },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

router.delete("/jackpot/:userId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    await db.collection("jackpots").deleteOne({ userId: req.params.userId });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

// ── WINS ─────────────────────────────────────────────────────────────────────

router.get("/win", requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const wins = await db.collection("wins").find().sort({ createdAt: -1 }).toArray();
    res.json({ wins });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

router.post("/win", requireAuth, requireAdmin, async (req, res) => {
  const { userId, username } = req.body ?? {};
  if (!userId || !username)
    return res.status(400).json({ error: "userId dan username wajib diisi." });
  try {
    const db = await getDb();
    await db.collection("wins").replaceOne(
      { userId },
      { userId, username, createdAt: new Date() },
      { upsert: true }
    );
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

router.delete("/win/:userId", requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    await db.collection("wins").deleteOne({ userId: req.params.userId });
    res.json({ ok: true });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

// ── USERS ────────────────────────────────────────────────────────────────────

router.get("/users", requireAuth, requireAdmin, async (req, res) => {
  try {
    const db = await getDb();
    const users = await db.collection("users")
      .find({}, { projection: { password: 0 } })
      .sort({ createdAt: 1 })
      .toArray();
    res.json({ users });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

router.patch("/users/:id/coins", requireAuth, requireAdmin, async (req, res) => {
  const { coins } = req.body ?? {};
  if (typeof coins !== "number" || !isFinite(coins) || coins < 0)
    return res.status(400).json({ error: "Jumlah koin tidak valid." });
  try {
    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { coins: Math.round(coins) } }
    );
    res.json({ coins: Math.round(coins) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

router.patch("/users/:id/password", requireAuth, requireAdmin, async (req, res) => {
  const { newPassword } = req.body ?? {};
  if (!newPassword || newPassword.length < 6)
    return res.status(400).json({ error: "Password minimal 6 karakter." });
  try {
    const db = await getDb();
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.collection("users").updateOne(
      { _id: new ObjectId(req.params.id) },
      { $set: { password: hashed } }
    );
    res.json({ message: "Password berhasil diubah." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

export default router;
