const express = require("express");
const router = express.Router();
const Conversation = require("../models/Conversation");

router.post("/", async (req, res) => {
  try {
    const { text, userId } = req.body;

    if (!text || text.trim() === "") {
      return res.status(400).json({ success: false, error: "No text received" });
    }
    if (!userId) {
      return res.status(400).json({ success: false, error: "userId is required" });
    }

    console.log("📝 Saving:", text);

    const conversation = await Conversation.create({
      userId,
      userMessage: text,
      aiResponse: "",
      category: "voice_reflection",
      tags: ["voice"],
    });

    res.json({ success: true, conversationId: conversation._id });

  } catch (err) {
    console.error("❌ Error:", err);
    res.status(500).json({ success: false, error: "Server error" });
  }
});

module.exports = router;
