import { Router } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { getDb } from "../db.js";

const router = Router();

const sign = (payload) =>
  jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: "7d" });

// POST /api/auth/register
router.post("/register", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password)
    return res.status(400).json({ error: "Username dan password wajib diisi." });
  if (username.length < 3)
    return res.status(400).json({ error: "Username minimal 3 karakter." });
  if (password.length < 6)
    return res.status(400).json({ error: "Password minimal 6 karakter." });

  try {
    const db = await getDb();
    const users = db.collection("users");

    const existing = await users.findOne({ username });
    if (existing)
      return res.status(400).json({ error: "Username sudah dipakai." });

    const hashed = await bcrypt.hash(password, 10);
    const result = await users.insertOne({
      username,
      password: hashed,
      coins: 10000,
      newPlayerWins: 3,
      createdAt: new Date(),
    });

    const token = sign({ id: result.insertedId.toString(), username });
    res.json({ token, user: { id: result.insertedId.toString(), username } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

// POST /api/auth/login
router.post("/login", async (req, res) => {
  const { username, password } = req.body ?? {};
  if (!username || !password)
    return res.status(400).json({ error: "Username dan password wajib diisi." });

  try {
    const db = await getDb();
    const user = await db.collection("users").findOne({ username });
    if (!user)
      return res.status(400).json({ error: "Username atau password salah." });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid)
      return res.status(400).json({ error: "Username atau password salah." });

    const token = sign({ id: user._id.toString(), username });
    res.json({ token, user: { id: user._id.toString(), username } });
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Server error." });
  }
});

// GET /api/auth/me  (verify token)
router.get("/me", (req, res) => {
  const auth = req.headers.authorization ?? "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : null;
  if (!token) return res.status(401).json({ error: "Unauthorized" });

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    res.json({ user: { id: payload.id, username: payload.username } });
  } catch {
    res.status(401).json({ error: "Token tidak valid." });
  }
});

export default router;
