const express = require("express");
const router = express.Router();
const Conversation = require("../models/Conversation");

router.post("/", async (req, res) => {
  try {
    const { text } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ success: false, error: "No text received" });
    }

    console.log("📝 Saving:", text);

    const conversation = await Conversation.create({
      userMessage: text,
      category: "voice_reflection",
      decisionType: "general",
      tags: ["voice"],
    });

    res.json({ success: true, conversationId: conversation._id });

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;