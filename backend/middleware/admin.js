export function requireAdmin(req, res, next) {
  if (req.user?.username !== "admin") {
    return res.status(403).json({ error: "Akses ditolak." });
  }
  next();
}
