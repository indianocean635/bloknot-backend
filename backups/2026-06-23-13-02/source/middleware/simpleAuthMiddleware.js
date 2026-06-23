const jwt = require("jsonwebtoken");

function authMiddleware(req, res, next) {
  const cookies = req.headers.cookie || "";

  const parsed = {};
  cookies.split(";").forEach(c => {
    const [k, v] = c.trim().split("=");
    if (k && v) parsed[k] = decodeURIComponent(v);
  });

  const token = parsed["auth"]; // Используем "auth" cookie

  if (!token) {
    return res.status(401).json({ error: "No auth" });
  }

  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { id: payload.userId };
    next();
  } catch (e) {
    return res.status(401).json({ error: "Invalid token" });
  }
}

module.exports = { authMiddleware };
