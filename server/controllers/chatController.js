const Conversation = require("../models/Conversation");
const ConversationGroup = require("../models/ConversationGroup");
const generateEmbedding = require("../services/embeddingService");
const { cosineSimilarity } = require("../services/embeddingService");
const { retrieveContext } = require("../services/ragService");
const generateAIResponse = require("../services/llmService");
const extractTags = require("../services/tagService");
const { groupConversations } = require("../services/groupingService");

const chat = async (req, res) => {
  try {
    const { userId, message, category = "general" } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ 
        error: "userId and message are required" 
      });
    }

    console.log(`\n📝 Chat request from user: ${userId}`);
    console.log(`   Message: ${message}`);
    console.log(`   Category: ${category}`);

    // Generate embedding for the user message
    console.log("🔄 Generating embedding...");
    const messageEmbedding = await generateEmbedding(message);
    console.log(`✓ Embedding generated (dimension: ${messageEmbedding.length})`);

    // Extract tags
    console.log("🏷️ Extracting tags...");
    const tags = await extractTags(message);
    console.log(`✓ Tags extracted: ${tags.join(", ")}`);

    // Check conversation count for RAG
    const conversationCount = await Conversation.countDocuments({ userId });
    console.log(`📊 Total conversations for user: ${conversationCount}`);

    let contextData = null;
    let ragUsed = false;

    // Use RAG if user has 2+ conversations
    if (conversationCount >= 2) {
      console.log("🔍 Retrieving context with RAG...");
      try {
        contextData = await retrieveContext(userId, message, category, 5);
        ragUsed = contextData.contexts.length > 0;
        console.log(`✓ RAG retrieved ${contextData.contexts.length} contexts`);
        console.log(`  Source: ${contextData.source}`);
      } catch (ragErr) {
        console.error("⚠️ RAG retrieval failed:", ragErr.message);
        contextData = null;
      }
    } else {
      console.log("ℹ️ Not enough conversations for RAG (need 2+)");
    }

    // Generate AI response
    console.log("🤖 Generating AI response...");
    let aiResponse;
    try {
      aiResponse = await generateAIResponse(message, contextData);
      console.log("✓ AI response generated successfully");
    } catch (llmErr) {
      console.error("⚠️ AI generation failed:", llmErr.message);
      aiResponse = `I encountered an issue generating a response: ${llmErr.message}. Please try again or rephrase your question.`;
    }

    // Save conversation to database AUTOMATICALLY
    console.log("💾 Auto-saving conversation...");
    const conversation = new Conversation({
      userId,
      userMessage: message,
      aiResponse,
      category,
      tags,
      embedding: messageEmbedding,
      chatId: `chat-${Date.now()}`,
      sentiment: "neutral",
      outcome: { successScore: 0.8 },
      ragUsed,
      ragRetrievalCount: ragUsed ? 1 : 0,
    });

    await conversation.save();
    console.log(`✓ Conversation saved with ID: ${conversation._id}`);

    // Check if we should trigger grouping (10+ conversations)
    const totalConvos = await Conversation.countDocuments({ userId });
    console.log(`📊 Total conversations now: ${totalConvos}`);

    let groupingResult = null;
    if (totalConvos === 10) {
      console.log("🎯 10 conversations reached - Triggering auto-grouping...");
      try {
        groupingResult = await groupConversations(userId);
        console.log(`✓ Grouping completed: ${groupingResult.groupsCreated} groups created`);
      } catch (groupErr) {
        console.error("⚠️ Grouping failed:", groupErr.message);
      }
    }

    // Send response
    res.json({
      success: true,
      message: aiResponse,
      conversationId: conversation._id,
      metadata: {
        autoSaved: true,
        ragUsed,
        contextCount: contextData?.contexts?.length || 0,
        contextSource: contextData?.source || "none",
        tagsExtracted: tags,
        totalConversations: totalConvos,
        groupingTriggered: totalConvos === 10,
        groupingResult: groupingResult || null,
      },
    });

    console.log("✅ Chat response sent successfully\n");
  } catch (err) {
    console.error("❌ Chat error:", err);
    res.status(500).json({
      error: "Chat failed",
      details: err.message,
    });
  }
};

const getChatHistory = async (req, res) => {
  try {
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: "userId is required" });
    }

    console.log(`📖 Fetching chat history for user: ${userId}`);

    const conversations = await Conversation.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50);

    console.log(`✓ Retrieved ${conversations.length} conversations`);

    res.json({
      success: true,
      count: conversations.length,
      conversations: conversations.map((conv) => ({
        id: conv._id,
        userMessage: conv.userMessage,
        aiResponse: conv.aiResponse,
        category: conv.category,
        tags: conv.tags,
        sentiment: conv.sentiment,
        ragUsed: conv.ragUsed,
        createdAt: conv.createdAt,
      })),
    });
  } catch (err) {
    console.error("History fetch error:", err);
    res.status(500).json({
      error: "Failed to fetch chat history",
      details: err.message,
    });
  }
};

const getConversationDetails = async (req, res) => {
  try {
    const { conversationId } = req.params;

    if (!conversationId) {
      return res.status(400).json({ error: "conversationId is required" });
    }

    const conversation = await Conversation.findById(conversationId);

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    res.json({
      success: true,
      conversation: {
        id: conversation._id,
        userMessage: conversation.userMessage,
        aiResponse: conversation.aiResponse,
        category: conversation.category,
        tags: conversation.tags,
        sentiment: conversation.sentiment,
        ragUsed: conversation.ragUsed,
        successScore: conversation.outcome?.successScore,
        createdAt: conversation.createdAt,
      },
    });
  } catch (err) {
    console.error("Conversation details error:", err);
    res.status(500).json({
      error: "Failed to fetch conversation details",
      details: err.message,
    });
  }
};

module.exports = {
  chat,
  getChatHistory,
  getConversationDetails,
};