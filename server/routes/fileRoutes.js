const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const mongoose = require("mongoose");

const router = express.Router();

/* ================= MULTER CONFIG ================= */

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }
});

/* ================= FILE SCHEMA ================= */

const fileSchema = new mongoose.Schema({
  userId: String,
  originalName: String,
  fileType: String,
  extractedData: mongoose.Schema.Types.Mixed,
  createdAt: { type: Date, default: Date.now }
});

const File = mongoose.model("File", fileSchema);

/* ================= UPLOAD FILE ================= */

router.post("/upload", upload.single("file"), async (req, res) => {
  try {
    const { userId } = req.body;
    const filePath = req.file.path;
    const mime = req.file.mimetype;

    let extracted = null;

    // CSV
    if (mime === "text/csv") {
      const content = fs.readFileSync(filePath, "utf8");
      const rows = content.split("\n").map(r => r.split(","));
      const headers = rows[0];

      extracted = rows.slice(1).map(row => {
        let obj = {};
        headers.forEach((h, i) => {
          obj[h.trim()] = isNaN(row[i]) ? row[i] : Number(row[i]);
        });
        return obj;
      });
    }

    // PDF
    else if (mime === "application/pdf") {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);

      extracted = {
        pages: data.numpages,
        textPreview: data.text.substring(0, 2000)
      };
    }

    else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    fs.unlinkSync(filePath);

    const savedFile = await File.create({
      userId,
      originalName: req.file.originalname,
      fileType: mime,
      extractedData: extracted
    });

    res.json({
      success: true,
      fileId: savedFile._id
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "File upload failed" });
  }
});

/* ================= FILE HISTORY ================= */

router.get("/history", async (req, res) => {
  try {
    const { userId } = req.query;

    const files = await File.find({ userId })
      .select("_id originalName fileType createdAt")
      .sort({ createdAt: -1 });

    res.json({ files });

  } catch (err) {
    res.status(500).json({ error: "Failed to fetch history" });
  }
});

/* ================= VISUALIZATION DATA ================= */

router.get("/:fileId/visualization", async (req, res) => {
  try {
    const file = await File.findById(req.params.fileId);

    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    res.json({
      fileType: file.fileType,
      data: file.extractedData
    });

  } catch (err) {
    res.status(500).json({ error: "Visualization fetch failed" });
  }
});

/* ================= ASK ABOUT FILE ================= */

router.post("/:fileId/ask", async (req, res) => {
  try {
    const { question } = req.body;

    const file = await File.findById(req.params.fileId);
    if (!file) {
      return res.status(404).json({ error: "File not found" });
    }

    // Simple baseline answer (replace with LLM later)
    const answer = `You asked: "${question}". 
File contains ${Array.isArray(file.extractedData)
      ? file.extractedData.length + " rows."
      : "text content."}`;

    res.json({ answer });

  } catch (err) {
    res.status(500).json({ error: "File Q&A failed" });
  }
});

module.exports = router;