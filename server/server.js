require("dotenv").config();

// Force DNS (helps MongoDB Atlas resolution issues)
const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const express = require("express");
const cors = require("cors");
const fs = require("fs");

const connectDB = require("./config/db");

const chatRoutes = require("./routes/chatRoutes");
const testRoutes = require("./routes/testRoutes");
const userRoutes = require("./routes/userRoutes");
const speechRoutes = require("./routes/speech");
const fileRoutes = require("./routes/fileRoutes");

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// Create uploads folder if missing (local only)
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
  console.log("📁 Created uploads directory");
}

// Connect DB
connectDB();

// Routes
app.use("/api/speech", speechRoutes);
app.use("/api/files", fileRoutes);
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

/*
LOCAL SERVER
Runs only when NOT on Vercel
*/
if (!process.env.VERCEL) {
  const PORT = process.env.PORT || 5000;

  app.listen(PORT, () => {
    console.log(`\n🚀 Server running on http://localhost:${PORT}`);
    console.log(`\n📝 Available endpoints:`);
    console.log(`   POST /api/files/upload`);
    console.log(`   GET /api/files/history`);
    console.log(`   GET /api/files/:fileId/visualization`);
    console.log(`   POST /api/files/:fileId/ask\n`);
  });
}

// Export for Vercel
module.exports = app;