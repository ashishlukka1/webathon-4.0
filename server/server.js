require("dotenv").config();

const dns = require("dns");
dns.setServers(["1.1.1.1", "8.8.8.8"]);

const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const chatRoutes = require("./routes/chatRoutes");
const testRoutes = require("./routes/testRoutes");
const userRoutes = require("./routes/userRoutes");
const speechRoutes = require("./routes/speech");
const fileRoutes = require("./routes/fileRoutes");

const app = express();

connectDB();

app.use(cors());
app.use(express.json());

// Create uploads directory if it doesn't exist
const fs = require("fs");
if (!fs.existsSync("uploads")) {
  fs.mkdirSync("uploads");
  console.log("📁 Created uploads directory");
}

app.use("/api/speech", speechRoutes);
app.use("/api/files", fileRoutes);

// Routes
app.use("/api/chat", chatRoutes);
app.use("/api/test", testRoutes);
app.use("/api/auth", userRoutes);

// Health check
app.get("/api/health", (req, res) => {
  res.json({ status: "✓ Server OK", timestamp: new Date() });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`\n🚀 Server running on http://localhost:${PORT}`);
  console.log(`\n📝 Available endpoints:`);
  console.log(`   POST /api/files/upload - Upload file`);
  console.log(`   GET /api/files/history - Get file history`);
  console.log(`   GET /api/files/:fileId/visualization - Get visualization data`);
  console.log(`   POST /api/files/:fileId/ask - Ask questions about file\n`);
});