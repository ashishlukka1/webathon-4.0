require("dotenv").config();

// Force DNS (helps MongoDB Atlas resolution issues)
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const express = require("express");
const cors = require("cors");

const connectDB = require("./config/db");

const chatRoutes = require("./routes/chatRoutes");
const testRoutes = require("./routes/testRoutes");
const userRoutes = require("./routes/userRoutes");
const speechRoutes = require("./routes/speech");

const app = express();

const allowedOrigins = [
  process.env.CLIENT_URL,
  "https://webathon-4-0-client.vercel.app",
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    if (!origin) return callback(null, true);
    if (allowedOrigins.includes(origin)) return callback(null, true);
    try {
      const hostname = new URL(origin).hostname;
      if (hostname.endsWith(".vercel.app")) return callback(null, true);
    } catch (_) {}
    return callback(null, false);
  },
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
  credentials: true,
};

// Middleware
app.use(cors(corsOptions));
app.options("*", cors(corsOptions));
app.use(express.json());

// Connect DB
connectDB();

// Routes
app.use("/api/speech", speechRoutes);
app.use("/api/chat", chatRoutes);
app.use("/api/test", testRoutes);
app.use("/api/auth", userRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({
    status: "✓ Server OK",
    timestamp: new Date()
  });
});

// Global error handler (prevents unhandled route errors from returning opaque platform responses)
app.use((err, req, res, next) => {
  console.error("Unhandled server error:", err);
  if (res.headersSent) return next(err);
  return res.status(500).json({
    error: "Internal server error",
    details: err?.message || "Unknown error",
  });
});

/*
LOCAL SERVER
Runs only when NOT on Vercel
*/
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`\n📝 Available endpoints:`);
    console.log(`   POST /api/auth/login`);
    console.log(`   POST /api/auth/register`);
    console.log(`   POST /api/chat`);
    console.log(`   GET  /api/chat/history\n`);
  });
}

// Export for Vercel
module.exports = app;
