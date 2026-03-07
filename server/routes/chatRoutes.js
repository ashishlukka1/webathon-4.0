const express = require("express");
const router = express.Router();
const { chat, getChatHistory, getConversationDetails } = require("../controllers/chatController");

router.post("/", chat);
router.get("/history", getChatHistory);
router.get("/:conversationId", getConversationDetails);

module.exports = router;
