const express = require("express");
const router = express.Router();
const Conversation = require("../models/Conversation");
const generateEmbedding = require("../services/embeddingService");
const { retrieveContext, findSpecificConversation } = require("../services/ragService");
const { groupConversations } = require("../services/groupingService");
const generateAIResponse = require("../services/llmService");
const { validateAPIKey } = require("../services/llmService");
const extractTags = require("../services/tagService");

// Check API Key validity
router.get("/validate-api", async (req, res) => {
  try {
    console.log("Validating API key...");
    const validation = await validateAPIKey();

    if (validation.valid) {
      res.json({
        status: "✓ Valid",
        message: validation.message,
        apiKeySet: !!process.env.GROQ_API_KEY,
      });
    } else {
      res.status(400).json({
        status: "✗ Invalid",
        message: validation.message,
        apiKeySet: !!process.env.GROQ_API_KEY,
      });
    }
  } catch (err) {
    console.error("API validation error:", err);
    res.status(500).json({ error: "Failed to validate API", details: err.message });
  }
});

// Generate AI response - first check state (< 1 or > 1 convos)
router.post("/generate-response", async (req, res) => {
  try {
    const { userMessage, userId } = req.body;

    if (!userMessage || !userId) {
      return res.status(400).json({ error: "userMessage and userId are required" });
    }

    console.log(`Generating response for user: ${userId}`);
    console.log(`User message: ${userMessage}`);

    // Check conversation count
    const conversationCount = await Conversation.countDocuments({ userId });
    console.log(`Total conversations for user: ${conversationCount}`);

    let contextData = null;
    let ragUsed = false;

    // If user has 2+ conversations, use RAG to retrieve context
    if (conversationCount >= 2) {
      try {
        contextData = await retrieveContext(userId, userMessage, null, 3);
        ragUsed = contextData.contexts.length > 0;
        console.log("RAG Context Retrieved:", {
          source: contextData.source,
          contexts: contextData.contexts.length,
        });
      } catch (ragErr) {
        console.error("RAG retrieval failed:", ragErr.message);
        contextData = null;
      }
    } else {
      console.log(`First or second conversation - no RAG context (total: ${conversationCount})`);
    }

    // Generate AI response with context
    try {
      const aiResponse = await generateAIResponse(userMessage, contextData);

      res.json({
        aiResponse,
        ragUsed,
        conversationCount,
        relevantConversations: contextData?.contexts?.length || 0,
        contextSource: contextData?.source || "none",
      });
    } catch (llmErr) {
      console.error("LLM generation failed:", llmErr.message);
      throw llmErr;
    }
  } catch (err) {
    console.error("Generation error:", err);
    res.status(500).json({ 
      error: "Failed to generate response", 
      details: err.message 
    });
  }
});

// Seed with dynamic data
router.post("/seed", async (req, res) => {
  try {
    const { userId, seedData } = req.body;

    if (!userId || !seedData || seedData.length === 0) {
      return res.status(400).json({ error: "userId and seedData array are required" });
    }

    console.log(`Seeding ${seedData.length} conversations for user ${userId}`);

    const conversationsWithEmbeddings = await Promise.all(
      seedData.map(async (data) => {
        try {
          const embedding = await generateEmbedding(data.userMessage);
          const tags = await extractTags(data.userMessage);

          return {
            userId,
            userMessage: data.userMessage,
            aiResponse: data.aiResponse,
            category: data.category || "general",
            tags,
            embedding,
            createdAt: new Date(),
          };
        } catch (embedErr) {
          console.error(`Failed to embed message: ${data.userMessage}`, embedErr.message);
          throw embedErr;
        }
      })
    );

    await Conversation.insertMany(conversationsWithEmbeddings);
    console.log(`✓ Successfully inserted ${conversationsWithEmbeddings.length} conversations`);

    const totalConvos = await Conversation.countDocuments({ userId });
    console.log(`Total conversations for user: ${totalConvos}`);

    // Auto-group if >= 10 conversations
    let groupingResult = null;
    if (totalConvos >= 10) {
      console.log("Auto-grouping conversations...");
      try {
        groupingResult = await groupConversations(userId);
        console.log("✓ Grouping completed:", groupingResult);
      } catch (groupErr) {
        console.error("✗ Grouping failed:", groupErr.message);
      }
    }

    res.json({
      message: "Seeding completed",
      count: conversationsWithEmbeddings.length,
      totalConversations: totalConvos,
      groupingResult,
      embeddingDim: conversationsWithEmbeddings[0]?.embedding?.length || 0,
    });
  } catch (err) {
    console.error("Seeding error:", err);
    res.status(500).json({ error: "Seeding failed", details: err.message });
  }
});

// Retrieve context with RAG
router.get("/rag-context", async (req, res) => {
  try {
    const { userId, message, category } = req.query;

    if (!userId || !message) {
      return res.status(400).json({ error: "userId and message are required" });
    }

    console.log(`Retrieving RAG context for user: ${userId}`);

    const result = await retrieveContext(userId, message, category, 5);

    res.json(result);
  } catch (err) {
    console.error("RAG context error:", err);
    res.status(500).json({ error: "Failed to get context", details: err.message });
  }
});

// Find specific conversation with high confidence
router.get("/find-conversation", async (req, res) => {
  try {
    const { userId, query } = req.query;

    if (!userId || !query) {
      return res.status(400).json({ error: "userId and query are required" });
    }

    console.log(`Finding conversation for user: ${userId}, query: ${query}`);

    const result = await findSpecificConversation(userId, query);

    res.json(result);
  } catch (err) {
    console.error("Find conversation error:", err);
    res.status(500).json({ error: "Failed to find conversation", details: err.message });
  }
});

// Manually trigger grouping
router.post("/group-conversations", async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    console.log(`Grouping conversations for user: ${userId}`);

    const result = await groupConversations(userId);

    res.json(result);
  } catch (err) {
    console.error("Grouping error:", err);
    res.status(500).json({ error: "Grouping failed", details: err.message });
  }
});

// Get conversation statistics
router.get("/stats", async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    const mongoose = require("mongoose");
    const validateId = mongoose.Types.ObjectId.isValid(userId);
    
    if (!validateId) {
      return res.status(400).json({ error: "Invalid userId format" });
    }

    const totalConvos = await Conversation.countDocuments({ userId });
    const totalGroups = await Conversation.countDocuments({
      userId,
      groupId: { $ne: null },
    });

    res.json({
      totalConversations: totalConvos,
      conversationsInGroups: totalGroups,
      groupingEligible: totalConvos >= 10,
      embeddingModel: "MiniLM (Xenova/all-MiniLM-L6-v2)",
    });
  } catch (err) {
    console.error("Stats error:", err);
    res.status(500).json({ error: "Failed to get stats", details: err.message });
  }
});

module.exports = router;
