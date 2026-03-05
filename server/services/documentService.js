const fs = require("fs");
const path = require("path");

/* ==============================
   EXTRACT IMAGE TEXT (OCR)
============================== */
const extractImageText = async (imagePath) => {
  try {
    console.log("🖼️ Extracting text from image...");

    const Tesseract = require("tesseract.js");
    
    const result = await Tesseract.recognize(imagePath, "eng", {
      logger: (m) => {
        const progress = Math.round(m.progress * 100);
        if (progress % 20 === 0 && progress > 0) {
          console.log(`  📊 OCR Progress: ${progress}%`);
        }
      },
    });

    const extractedText = result.data.text || "";
    console.log(`✓ Extracted ${extractedText.length} characters from image`);

    return extractedText || "No text found in image";
  } catch (err) {
    console.error("✗ Image extraction error:", err.message);
    throw new Error(`Image extraction failed: ${err.message}`);
  }
};

/* ==============================
   ANALYZE SPREADSHEET DATA
============================== */
const analyzeData = async (filePath, fileName) => {
  try {
    console.log("📊 Analyzing spreadsheet data...");

    let data = [];
    let content = "";
    let sheetName = "";

    if (fileName.toLowerCase().includes(".csv")) {
      console.log("  📋 Processing CSV file...");
      try {
        const csvParse = require("csv-parse/sync");
        const fileContent = fs.readFileSync(filePath, "utf-8");
        data = csvParse.parse(fileContent, { 
          columns: true,
          skip_empty_lines: true,
          trim: true,
        });
        sheetName = fileName.replace(".csv", "");
        content = `CSV file with ${data.length} rows. Columns: ${Object.keys(data[0] || {}).join(", ")}`;
      } catch (csvErr) {
        console.error("CSV parsing error:", csvErr.message);
        throw new Error(`CSV parsing failed: ${csvErr.message}`);
      }
    } else if (fileName.toLowerCase().includes(".xlsx") || fileName.toLowerCase().includes(".xls")) {
      console.log("  📗 Processing Excel file...");
      try {
        const xlsx = require("xlsx");
        const workbook = xlsx.readFile(filePath);
        sheetName = workbook.SheetNames[0] || "Sheet1";
        const worksheet = workbook.Sheets[sheetName];
        data = xlsx.utils.sheet_to_json(worksheet);
        
        const cols = Object.keys(data[0] || {});
        content = `Excel file "${sheetName}" with ${data.length} rows. Columns: ${cols.join(", ")}`;
      } catch (xlsxErr) {
        console.error("Excel parsing error:", xlsxErr.message);
        throw new Error(`Excel parsing failed: ${xlsxErr.message}`);
      }
    } else {
      throw new Error("Unsupported spreadsheet format");
    }

    if (data.length === 0) {
      throw new Error("No data found in spreadsheet");
    }

    const vizData = analyzeForVisualization(data, Object.keys(data[0] || {}));

    console.log(`✓ Data analyzed: ${data.length} rows, ${vizData.vizType} recommended`);

    return {
      content,
      data: {
        rows: data.slice(0, 100),
        totalRows: data.length,
        columns: Object.keys(data[0] || {}),
        vizType: vizData.vizType,
        stats: vizData.stats,
        sheetName,
      },
    };
  } catch (err) {
    console.error("✗ Data analysis error:", err.message);
    throw new Error(`Data analysis failed: ${err.message}`);
  }
};

/* ==============================
   ANALYZE FOR VISUALIZATION TYPE
============================== */
const analyzeForVisualization = (data, columns) => {
  if (data.length === 0 || columns.length === 0) {
    return { vizType: "table", stats: {} };
  }

  const stats = {};
  let vizType = "table";
  let numericCount = 0;
  let categoricalCount = 0;

  columns.forEach((col) => {
    try {
      const values = data.map((row) => row[col]);
      const numericValues = values
        .map((v) => {
          const num = Number(v);
          return !isNaN(num) && v !== "" && v !== null ? num : null;
        })
        .filter((v) => v !== null);

      if (numericValues.length > values.length * 0.7) {
        // Mostly numeric
        stats[col] = {
          type: "numeric",
          min: Math.min(...numericValues),
          max: Math.max(...numericValues),
          avg: (numericValues.reduce((a, b) => a + b, 0) / numericValues.length).toFixed(2),
          median: getMedian(numericValues),
          sum: numericValues.reduce((a, b) => a + b, 0),
          count: numericValues.length,
        };
        numericCount++;
      } else {
        // Categorical
        const counts = {};
        values.forEach((v) => {
          if (v) {
            counts[v] = (counts[v] || 0) + 1;
          }
        });

        stats[col] = {
          type: "categorical",
          uniqueValues: Object.keys(counts).length,
          topValues: Object.entries(counts)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([val, cnt]) => ({ value: val, count: cnt })),
        };
        categoricalCount++;
      }
    } catch (colErr) {
      console.warn(`Warning: Could not analyze column ${col}:`, colErr.message);
      stats[col] = { type: "unknown", error: colErr.message };
    }
  });

  // Determine best visualization
  if (numericCount >= 3) {
    vizType = "scatter-3d";
  } else if (numericCount >= 2) {
    if (data.length > 50) {
      vizType = "scatter-plot";
    } else {
      vizType = "bubble-chart";
    }
  } else if (numericCount === 1) {
    if (data.length > 30) {
      vizType = "histogram";
    } else {
      vizType = "bar-chart";
    }
  } else if (categoricalCount >= 2) {
    vizType = "sunburst";
  } else {
    vizType = "table";
  }

  return { vizType, stats };
};

/* ==============================
   GET MEDIAN
============================== */
const getMedian = (values) => {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
};

/* ==============================
   EXTRACT PDF TEXT
============================== */
const extractPdfText = async (filePath) => {
  try {
    console.log("  📕 Processing PDF...");
    const pdfParse = require("pdf-parse");
    const dataBuffer = fs.readFileSync(filePath);
    
    const pdfData = await pdfParse(dataBuffer);
    
    const text = pdfData.text || "";
    console.log(`  ✓ PDF extracted: ${text.length} chars, ${pdfData.numpages} pages`);
    
    if (!text || text.trim().length === 0) {
      throw new Error("PDF contains no extractable text");
    }
    
    return text;
  } catch (err) {
    console.error("✗ PDF parsing error:", err.message);
    throw new Error(`PDF parsing failed: ${err.message}`);
  }
};

/* ==============================
   EXTRACT TEXT FILE
============================== */
const extractTextFile = async (filePath) => {
  try {
    console.log("  📄 Processing text file...");
    const content = fs.readFileSync(filePath, "utf-8");
    
    if (!content || content.trim().length === 0) {
      throw new Error("Text file is empty");
    }
    
    console.log(`  ✓ Text file read: ${content.length} characters`);
    return content;
  } catch (err) {
    console.error("✗ Text file reading error:", err.message);
    throw new Error(`Text file reading failed: ${err.message}`);
  }
};

/* ==============================
   SUMMARIZE DOCUMENT
============================== */
const summarizeDocument = async (content) => {
  try {
    console.log("📝 Summarizing document...");

    const generateAIResponse = require("./llmService");

    // Truncate content to reasonable size
    const maxLength = 3000;
    const truncatedContent = content.substring(0, maxLength);

    const summaryPrompt = `Provide a brief 2-3 sentence summary of this content:

${truncatedContent}

Summary:`;

    const summary = await generateAIResponse(summaryPrompt);
    
    if (!summary || summary.trim().length === 0) {
      throw new Error("Failed to generate summary");
    }
    
    console.log(`✓ Summary generated: ${summary.length} characters`);

    return summary;
  } catch (err) {
    console.error("✗ Summarization error:", err.message);
    // Return a default summary if AI fails
    return `Content extracted successfully. ${content.substring(0, 100)}...`;
  }
};

/* ==============================
   EXTRACT KEY INSIGHTS
============================== */
const extractKeyInsights = async (content) => {
  try {
    console.log("💡 Extracting key insights...");

    const generateAIResponse = require("./llmService");

    const insightPrompt = `Extract 2-3 key insights from this content:

${content.substring(0, 1500)}

Insights (as bullet points):`;

    const response = await generateAIResponse(insightPrompt);
    
    // Parse as simple array
    const insights = response
      .split('\n')
      .filter(line => line.trim().length > 0 && (line.includes('•') || line.includes('-')))
      .slice(0, 5)
      .map((line, idx) => ({
        insight: line.replace(/^[•\-\*]\s*/, '').trim(),
        importance: idx === 0 ? "high" : idx === 1 ? "medium" : "low",
      }));

    console.log(`✓ Extracted ${insights.length} insights`);
    return insights.length > 0 ? insights : [];
  } catch (err) {
    console.error("✗ Insight extraction error:", err.message);
    return [];
  }
};

module.exports = {
  extractImageText,
  analyzeData,
  extractPdfText,
  extractTextFile,
  summarizeDocument,
  extractKeyInsights,
  analyzeForVisualization,
};