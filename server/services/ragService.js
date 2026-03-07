const Conversation = require("../models/Conversation");
const generateEmbedding = require("./embeddingService");
const { cosineSimilarity } = require("./embeddingService");

const extractNameFromText = (text = "") => {
  const patterns = [
    /\bmy name is\s+([a-z][a-z'-]{1,30})\b/i,
    /\bi am\s+([a-z][a-z'-]{1,30})\b/i,
    /\bi'm\s+([a-z][a-z'-]{1,30})\b/i,
    /\bthis is\s+([a-z][a-z'-]{1,30})\b/i,
  ];

  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match && match[1]) {
      const name = match[1].trim();
      if (!["a", "an", "the"].includes(name.toLowerCase())) {
        return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
      }
    }
  }
  return null;
};

const getUserMemory = async (userId) => {
  const conversations = await Conversation.find({ userId })
    .sort({ createdAt: -1 })
    .limit(250)
    .select("userMessage createdAt")
    .lean();

  let name = null;
  for (const conv of conversations) {
    const parsed = extractNameFromText(conv.userMessage || "");
    if (parsed) {
      name = parsed;
      break;
    }
  }

  return { name };
};

const retrieveContext = async (userId, userQuery, category = null, topK = 5) => {
  try {
    let queryEmbedding = null;
    try {
      queryEmbedding = await generateEmbedding(userQuery);
    } catch (err) {
      console.warn("Query embedding failed, using recency-only context:", err.message);
    }

    const filter = { userId };
    if (category) filter.category = category;

    const allConversations = await Conversation.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    if (allConversations.length === 0) {
      return { contexts: [], source: "none" };
    }

    const oldestTs = new Date(allConversations[allConversations.length - 1].createdAt).getTime();

    const scoredConversations = allConversations.map((conv) => {
      const semanticSimilarity = queryEmbedding && Array.isArray(conv.embedding)
        ? cosineSimilarity(queryEmbedding, conv.embedding) || 0
        : 0;

      const timeDiff = Date.now() - new Date(conv.createdAt).getTime();
      const maxTimeDiff = Date.now() - oldestTs;
      let recencyScore = 1 - (timeDiff / (maxTimeDiff + 1));
      recencyScore = Math.pow(recencyScore, 0.5);

      const categoryMatch = category && conv.category === category ? 0.05 : 0;
      const queryTags = userQuery.toLowerCase().split(/\s+/);
      const tagMatches = (conv.tags || []).filter((tag) =>
        queryTags.some((qt) => tag.toLowerCase().includes(qt) || qt.includes(tag.toLowerCase()))
      ).length;
      const tagScore = Math.min(tagMatches * 0.03, 0.1);

      const combinedScore = recencyScore * 0.55 + semanticSimilarity * 0.35 + categoryMatch + tagScore;

      return {
        ...conv,
        semanticSimilarity,
        recencyScore,
        combinedScore,
      };
    });

    const recentContexts = allConversations.slice(0, Math.min(3, allConversations.length));

    const semanticContexts = scoredConversations
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, topK);

    const mergedMap = new Map();
    [...recentContexts, ...semanticContexts].forEach((ctx) => {
      mergedMap.set(String(ctx._id), ctx);
    });
    const topContexts = Array.from(mergedMap.values()).slice(0, Math.max(topK, 5));

    return {
      contexts: topContexts.map((ctx) => ({
        userMessage: ctx.userMessage,
        aiResponse: ctx.aiResponse,
        category: ctx.category,
        tags: ctx.tags,
        similarity: ctx.semanticSimilarity,
        recency: ctx.recencyScore,
        createdAt: ctx.createdAt,
        type: "conversation",
      })),
      source: "semantic_search_with_recency_priority",
      memory: await getUserMemory(userId),
    };
  } catch (err) {
    console.error("RAG retrieval error:", err.message);
    throw err;
  }
};

const findSpecificConversation = async (userId, query) => {
  try {
    const queryEmbedding = await generateEmbedding(query);

    const conversations = await Conversation.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    if (conversations.length === 0) {
      return { found: false, conversation: null };
    }

    const oldestTs = new Date(conversations[conversations.length - 1].createdAt).getTime();

    const scored = conversations.map((conv) => {
      const similarity = Array.isArray(conv.embedding) ? cosineSimilarity(queryEmbedding, conv.embedding) || 0 : 0;
      const timeDiff = Date.now() - new Date(conv.createdAt).getTime();
      const maxTimeDiff = Date.now() - oldestTs;
      let recencyScore = 1 - timeDiff / (maxTimeDiff + 1);
      recencyScore = Math.pow(recencyScore, 0.5);

      return {
        ...conv,
        similarity,
        recencyScore,
        combinedScore: similarity * 0.4 + recencyScore * 0.6,
      };
    });

    const bestMatch = scored.sort((a, b) => b.combinedScore - a.combinedScore)[0];
    const confidence = bestMatch.similarity;
    const found = confidence > 0.55;

    return {
      found,
      conversation: found
        ? {
            userMessage: bestMatch.userMessage,
            aiResponse: bestMatch.aiResponse,
            category: bestMatch.category,
            tags: bestMatch.tags,
            similarity: confidence,
            recency: bestMatch.recencyScore,
          }
        : null,
      confidence,
    };
  } catch (err) {
    console.error("Find conversation error:", err.message);
    throw err;
  }
};

module.exports = { retrieveContext, findSpecificConversation, getUserMemory };
