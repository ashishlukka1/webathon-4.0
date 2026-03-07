const Conversation = require("../models/Conversation");
const generateEmbedding = require("../services/embeddingService");
const { cosineSimilarity } = require("../services/embeddingService");
const { retrieveContext, getUserMemory } = require("../services/ragService");
const generateAIResponse = require("../services/llmService");
const { classifyCategory } = require("../services/llmService");
const extractTags = require("../services/tagService");
const { groupConversations } = require("../services/groupingService");

const escapeRegExp = (value = "") => value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const normalizeText = (text = "") => text.toLowerCase().replace(/\s+/g, " ").trim();

const isNameQuestion = (text = "") =>
  /(what(?:'s| is)\s+my\s+name|who\s+am\s+i|what\s+am\s+i|didn'?t\s+i\s+mention\s+i\s+was|do\s+you\s+know\s+my\s+name)/i.test(text);

const isTopicHistoryQuestion = (text = "") =>
  /(what\s+(questions|things|topics|did)\s+.*\s+ask\s+about|what\s+did\s+i\s+ask\s+about|did\s+i\s+not\s+(talk|ask)\s+ab(?:ou)?t)/i.test(text);

const extractTopicFromQuestion = (text = "") => {
  const patterns = [
    /ask\s+about\s+(.+?)\??$/i,
    /talk\s+ab(?:ou)?t\s+(.+?)\??$/i,
    /questions?\s+.*\s+about\s+(.+?)\??$/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      return match[1].trim().replace(/^the\s+/i, "");
    }
  }
  return null;
};

const isConversationSummaryQuestion = (text = "") =>
  /(summary|summarize|summ|recap|overview|history).*(conversation|chat|discuss|talk)|conversations?.*(till now|so far|up to now)|what have we talked about/i.test(
    text
  );

const isExpandRequest = (text = "") =>
  /(more content|give me more|expand|elaborate|continue|add more|more details)/i.test(text);

const isMetaQuestion = (text = "") =>
  isNameQuestion(text) || isTopicHistoryQuestion(text) || isConversationSummaryQuestion(text) || isExpandRequest(text);

const topicAliases = (topic = "") => {
  const t = topic.toLowerCase();
  if (/(f1|formula\s*1|formula\s*one|grand prix)/i.test(t)) {
    return [
      "f1",
      "formula 1",
      "formula one",
      "grand prix",
      "hamilton",
      "verstappen",
      "championship",
      "abu dhabi",
      "last lap",
    ];
  }
  return [topic];
};

const isF1Query = (text = "") =>
  /(f1|formula\s*1|formula\s*one|grand prix|hamilton|verstappen|abu dhabi|championship)/i.test(text);

const buildTopicHistoryReply = (topic, messages) => {
  if (!messages.length) {
    return `I could not find any earlier questions about ${topic}.`;
  }

  const uniqueQuestions = [...new Set(messages.map((m) => m.userMessage.trim()))];
  const preview = uniqueQuestions.slice(0, 8).join(" | ");
  return `You asked ${uniqueQuestions.length} question${uniqueQuestions.length > 1 ? "s" : ""} related to ${topic}: ${preview}.`;
};

const buildConversationSummaryReply = (conversations) => {
  if (!conversations.length) {
    return "We have not had any saved conversations yet.";
  }

  const nonMetaConversations = conversations.filter(
    (c) => !isMetaQuestion(c.userMessage || "")
  );
  const base = nonMetaConversations.length ? nonMetaConversations : conversations;
  const uniqueCategories = [...new Set(base.map((c) => c.category).filter(Boolean))];
  const topicCounts = {};
  base.forEach((c) => {
    (c.tags || []).forEach((tag) => {
      topicCounts[tag] = (topicCounts[tag] || 0) + 1;
    });
    if (isF1Query(c.userMessage || "")) {
      topicCounts.f1 = (topicCounts.f1 || 0) + 1;
    }
  });
  const topTopics = Object.entries(topicCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)
    .map(([k]) => k);

  const recentQuestions = base
    .slice(-5)
    .map((c) => c.userMessage.trim())
    .filter(Boolean);

  const categoryPart = uniqueCategories.length
    ? `Main categories involved: ${uniqueCategories.slice(0, 4).join(", ")}.`
    : "";
  const recentPart = recentQuestions.length
    ? `Most recent topics you asked: ${recentQuestions.join(" | ")}.`
    : "";
  const topTopicsPart = topTopics.length ? `Frequent themes: ${topTopics.join(", ")}.` : "";

  return `We have ${conversations.length} saved conversations so far (${base.length} substantive requests). ${categoryPart} ${topTopicsPart} ${recentPart}`.trim();
};

const chat = async (req, res) => {
  try {
    const { userId, message, category = "general" } = req.body;

    if (!userId || !message) {
      return res.status(400).json({ error: "userId and message are required" });
    }

    console.log(`Chat request from user: ${userId}`);

    const messageEmbedding = await generateEmbedding(message);
    const tags = await extractTags(message);

    let detectedCategory = category;
    let classificationConfidence = 0;
    let classificationScores = {};
    const normalizedMessage = normalizeText(message);
    const metaQuery = isMetaQuestion(normalizedMessage);

    try {
      const classification = await classifyCategory(message);
      detectedCategory =
        classification.confidence >= 0.35 && !metaQuery
          ? classification.category || category || "general"
          : "general";
      classificationConfidence = classification.confidence || 0;
      classificationScores = classification.allScores || {};
    } catch (classificationErr) {
      console.warn("Classification failed, using fallback category:", classificationErr.message);
    }

    const conversationCount = await Conversation.countDocuments({ userId });

    let contextData = null;
    let userMemory = await getUserMemory(userId);
    let ragUsed = false;

    if (conversationCount >= 2) {
      try {
        contextData = await retrieveContext(userId, message, detectedCategory, 5);
        if (!contextData?.contexts?.length) {
          contextData = await retrieveContext(userId, message, null, 5);
        }
        ragUsed = (contextData?.contexts || []).length > 0;
        userMemory = contextData?.memory || userMemory;
      } catch (ragErr) {
        console.error("RAG retrieval failed:", ragErr.message);
        contextData = null;
      }
    }

    let aiResponse;
    try {
      if (isNameQuestion(message) && userMemory?.name) {
        aiResponse = `You said your name is ${userMemory.name}.`;
      } else if (isNameQuestion(message) && !userMemory?.name) {
        aiResponse = "You have not shared your name with me yet.";
      } else if (isTopicHistoryQuestion(normalizedMessage)) {
        const topic = extractTopicFromQuestion(message);
        if (topic) {
          const aliases = topicAliases(topic);
          const keywordRegexes = aliases.map((a) => new RegExp(escapeRegExp(a), "i"));
          const topicMessages = await Conversation.find({ userId })
            .sort({ createdAt: 1 })
            .select("userMessage embedding")
            .lean();

          let matched = topicMessages.filter((row) =>
            keywordRegexes.some(
              (rx) => rx.test(row.userMessage || "")
            )
          );

          if (matched.length < 3) {
            const topicEmbedding = await generateEmbedding(topic);
            const semanticMatches = topicMessages
              .map((row) => ({
                ...row,
                score: Array.isArray(row.embedding)
                  ? cosineSimilarity(topicEmbedding, row.embedding)
                  : 0,
              }))
              .filter((row) => row.score > 0.45)
              .sort((a, b) => b.score - a.score)
              .slice(0, 8);
            matched = [...matched, ...semanticMatches];
          }

          aiResponse = buildTopicHistoryReply(topic, matched);
        } else {
          aiResponse = "Please mention the topic you want me to search in your past questions.";
        }
      } else if (isConversationSummaryQuestion(normalizedMessage)) {
        const allConversations = await Conversation.find({ userId })
          .sort({ createdAt: 1 })
          .select("userMessage category tags")
          .lean();

        aiResponse = buildConversationSummaryReply(allConversations);
      } else if (isExpandRequest(normalizedMessage)) {
        const latestAiConversation = await Conversation.find({ userId })
          .sort({ createdAt: -1 })
          .limit(20)
          .select("userMessage aiResponse")
          .lean();

        const expandable = (latestAiConversation || []).find(
          (row) => row.aiResponse && !isMetaQuestion(row.userMessage || "")
        );

        if (expandable?.aiResponse) {
          const expandPrompt = `Expand the following content into two concise paragraphs with more useful detail:\n\n${expandable.aiResponse}`;
          aiResponse = await generateAIResponse(expandPrompt, {
            ...(contextData || { contexts: [], source: "none" }),
            memory: userMemory || {},
          });
        } else {
          aiResponse = "I do not have earlier content to expand yet. Ask me for a topic first.";
        }
      } else {
        aiResponse = await generateAIResponse(message, {
          ...(contextData || { contexts: [], source: "none" }),
          memory: userMemory || {},
        });
      }
    } catch (llmErr) {
      aiResponse = `I encountered an issue generating a response: ${llmErr.message}. Please try again or rephrase your question.`;
    }

    const conversation = new Conversation({
      userId,
      userMessage: message,
      aiResponse,
      category: detectedCategory,
      tags,
      embedding: messageEmbedding,
      ragUsed,
    });

    await conversation.save();

    const totalConvos = await Conversation.countDocuments({ userId });
    const ungroupedConvos = await Conversation.countDocuments({ userId, groupId: null });

    let groupingResult = null;
    let groupingTriggered = false;

    if (totalConvos >= 10 && ungroupedConvos >= 3) {
      try {
        groupingResult = await groupConversations(userId);
        groupingTriggered = (groupingResult?.groupsCreated || 0) > 0;
      } catch (groupErr) {
        console.error("Grouping failed:", groupErr.message);
      }
    }

    return res.json({
      success: true,
      message: aiResponse,
      conversationId: conversation._id,
      metadata: {
        autoSaved: true,
        ragUsed,
        contextCount: contextData?.contexts?.length || 0,
        contextSource: contextData?.source || "none",
        memoryUsed: Boolean(userMemory?.name),
        tagsExtracted: tags,
        totalConversations: totalConvos,
        groupingTriggered,
        groupingResult,
        categoryDetected: detectedCategory,
        classificationConfidence,
        classificationScores,
      },
    });
  } catch (err) {
    console.error("Chat error:", err);
    return res.status(500).json({
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

    const conversations = await Conversation.find({ userId })
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    return res.json({
      success: true,
      count: conversations.length,
      conversations: conversations.map((conv) => ({
        _id: conv._id,
        userMessage: conv.userMessage,
        aiResponse: conv.aiResponse,
        category: conv.category,
        tags: conv.tags,
        ragUsed: conv.ragUsed,
        createdAt: conv.createdAt,
      })),
    });
  } catch (err) {
    console.error("History fetch error:", err);
    return res.status(500).json({
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

    const conversation = await Conversation.findById(conversationId).lean();

    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    return res.json({
      success: true,
      conversation: {
        id: conversation._id,
        userMessage: conversation.userMessage,
        aiResponse: conversation.aiResponse,
        category: conversation.category,
        tags: conversation.tags,
        ragUsed: conversation.ragUsed,
        createdAt: conversation.createdAt,
      },
    });
  } catch (err) {
    console.error("Conversation details error:", err);
    return res.status(500).json({
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
