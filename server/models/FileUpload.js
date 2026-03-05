const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");

const router = express.Router();

const upload = multer({
  dest: "uploads/",
  limits: { fileSize: 10 * 1024 * 1024 }
});

router.post("/", upload.single("file"), async (req, res) => {
  try {
    const filePath = req.file.path;
    const type = req.file.mimetype;

    let result = null;

    // CSV
    if (type === "text/csv") {
      const content = fs.readFileSync(filePath, "utf8");
      const rows = content.split("\n").map(r => r.split(","));
      const headers = rows[0];

      const data = rows.slice(1).map(row => {
        let obj = {};
        headers.forEach((h, i) => {
          obj[h.trim()] = isNaN(row[i]) ? row[i] : Number(row[i]);
        });
        return obj;
      });

      result = data;
    }

    // PDF (basic text extraction)
    else if (type === "application/pdf") {
      const buffer = fs.readFileSync(filePath);
      const data = await pdfParse(buffer);

      result = {
        pages: data.numpages,
        preview: data.text.substring(0, 1000)
      };
    }

    else {
      return res.status(400).json({ error: "Unsupported file type" });
    }

    fs.unlinkSync(filePath);

    res.json({ success: true, data: result });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Processing failed" });
  }
});

module.exports = router;