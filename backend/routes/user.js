import { Router } from "express";
import { ObjectId } from "mongodb";
import bcrypt from "bcryptjs";
import { getDb } from "../db.js";
import { requireAuth } from "../middleware/auth.js";

const STARTING_BALANCE = 10000;

const router = Router();

router.get("/coins", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: new ObjectId(req.user.id) });
    if (!user) return res.status(404).json({ error: "User tidak ditemukan." });
    res.json({ coins: user.coins ?? STARTING_BALANCE });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

router.patch("/coins", requireAuth, async (req, res) => {
  const { coins } = req.body ?? {};
  if (typeof coins !== "number" || !isFinite(coins))
    return res.status(400).json({ error: "Coins harus berupa angka." });
  try {
    const db = await getDb();
    await db.collection("users").updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: { coins: Math.round(coins) } }
    );
    res.json({ coins: Math.round(coins) });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

router.post("/redeem", requireAuth, async (req, res) => {
  const { code } = req.body ?? {};
  if (!code) return res.status(400).json({ error: "Kode wajib diisi." });
  try {
    const db = await getDb();
    const trimmedCode = code.trim().toUpperCase();

    // New format: multi-use code (has useCount field)
    let result = await db.collection("codes").findOneAndUpdate(
      {
        code: trimmedCode,
        useCount: { $exists: true },
        "uses.userId": { $ne: req.user.id },   // user hasn't already redeemed
        $or: [
          { maxUses: null },                    // limitless
          { $expr: { $lt: ["$useCount", "$maxUses"] } },
        ],
      },
      {
        $inc: { useCount: 1 },
        $push: { uses: { userId: req.user.id, usedAt: new Date() } },
      },
      { returnDocument: "before" }
    );

    // Legacy format: single-use code (usedBy: null)
    if (!result) {
      result = await db.collection("codes").findOneAndUpdate(
        { code: trimmedCode, usedBy: null },
        { $set: { usedBy: req.user.id, usedAt: new Date() } },
        { returnDocument: "before" }
      );
    }

    if (!result)
      return res.status(400).json({ error: "Kode tidak valid, sudah habis, atau sudah pernah kamu gunakan." });

    const amount = result.amount;
    const user = await db.collection("users").findOne({ _id: new ObjectId(req.user.id) });
    const newCoins = (user.coins ?? STARTING_BALANCE) + amount;
    await db.collection("users").updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: { coins: newCoins } }
    );
    res.json({ coins: newCoins, amount });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

// Atomic: check + consume pending forced win for current user
router.post("/claim-win", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const doc = await db.collection("wins").findOneAndDelete({ userId: req.user.id });
    res.json({ win: !!doc });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

// Atomic: check + consume pending jackpot for current user
router.post("/claim-jackpot", requireAuth, async (req, res) => {
  try {
    const db = await getDb();
    const doc = await db.collection("jackpots").findOneAndDelete({ userId: req.user.id });
    res.json({ jackpot: !!doc });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

router.patch("/password", requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (!currentPassword || !newPassword)
    return res.status(400).json({ error: "Password lama dan baru wajib diisi." });
  if (newPassword.length < 6)
    return res.status(400).json({ error: "Password baru minimal 6 karakter." });
  try {
    const db = await getDb();
    const user = await db.collection("users").findOne({ _id: new ObjectId(req.user.id) });
    if (!user) return res.status(404).json({ error: "User tidak ditemukan." });
    const valid = await bcrypt.compare(currentPassword, user.password);
    if (!valid) return res.status(400).json({ error: "Password lama salah." });
    const hashed = await bcrypt.hash(newPassword, 10);
    await db.collection("users").updateOne(
      { _id: new ObjectId(req.user.id) },
      { $set: { password: hashed } }
    );
    res.json({ message: "Password berhasil diubah." });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

export default router;
