import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/auth.js";
import userRoutes from "./routes/user.js";
import adminRoutes from "./routes/admin.js";

const app = express();

app.use(cors({
  origin: (origin, cb) => {
    // Allow: no-origin requests (server-to-server), localhost, and *.vercel.app
    if (
      !origin ||
      origin.startsWith("http://localhost") ||
      origin.endsWith(".vercel.app") ||
      origin === process.env.FRONTEND_URL
    ) {
      cb(null, true);
    } else {
      cb(new Error(`CORS: ${origin} tidak diizinkan`));
    }
  },
  credentials: true,
}));
app.use(express.json());

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);

app.get("/api/health", (_, res) => res.json({ ok: true }));

// Vercel serverless: export app (tanpa listen)
// Lokal: jalankan server seperti biasa
if (process.env.NODE_ENV !== "production") {
  const PORT = process.env.PORT || 4000;
  app.listen(PORT, () => console.log(`Server berjalan di http://localhost:${PORT}`));
}

export default app;
