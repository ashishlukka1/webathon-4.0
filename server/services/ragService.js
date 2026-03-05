const Conversation = require("../models/Conversation");
const ConversationGroup = require("../models/ConversationGroup");
const generateEmbedding = require("./embeddingService");
const { cosineSimilarity } = require("./embeddingService");

const retrieveContext = async (userId, userQuery, category = null, topK = 5) => {
  try {
    console.log(`🔍 Retrieving context for query: "${userQuery.substring(0, 50)}..."`);

    // Generate embedding for the query
    const queryEmbedding = await generateEmbedding(userQuery);

    // Build filter
    const filter = { userId };
    if (category) {
      filter.category = category;
    }

    // Get all conversations for this user
    const allConversations = await Conversation.find(filter)
      .sort({ createdAt: -1 })
      .lean();

    if (allConversations.length === 0) {
      console.log("ℹ️ No conversations found for user");
      return { contexts: [], source: "none" };
    }

    console.log(`📚 Found ${allConversations.length} conversations to search`);

    // Calculate scores with multiple factors - INCREASED RECENCY WEIGHT
    const scoredConversations = allConversations.map((conv, index) => {
      // 1. Semantic similarity
      const semanticSimilarity = cosineSimilarity(queryEmbedding, conv.embedding) || 0;

      // 2. Recency score (more recent = higher score) - EXPONENTIAL FOR STRONGER WEIGHTING
      // Convert to 0-1 scale where newest = 1, oldest = 0
      const timeDiff = Date.now() - new Date(conv.createdAt).getTime();
      const maxTimeDiff = Date.now() - new Date(allConversations[allConversations.length - 1].createdAt).getTime();
      let recencyScore = 1 - (timeDiff / (maxTimeDiff + 1)); // +1 to avoid division by zero
      
      // Apply exponential decay for stronger recency effect
      // Recent conversations get exponentially higher scores
      recencyScore = Math.pow(recencyScore, 0.5); // Square root to amplify recent conversations
      
      // 3. Category match (if specified)
      const categoryMatch = category && conv.category === category ? 0.05 : 0;

      // 4. Tag overlap (how many tags match)
      const queryTags = userQuery.toLowerCase().split(/\s+/);
      const tagMatches = (conv.tags || []).filter(tag => 
        queryTags.some(qt => tag.toLowerCase().includes(qt) || qt.includes(tag.toLowerCase()))
      ).length;
      const tagScore = Math.min(tagMatches * 0.03, 0.1); // Max 0.1 for tag score

      // Combined score with HIGHER RECENCY WEIGHT
      // Recency: 55%, Semantic similarity: 35%, Category: 5%, Tags: 5%
      const combinedScore = 
        (recencyScore * 0.55) +        // INCREASED from 30% to 55%
        (semanticSimilarity * 0.35) +  // DECREASED from 60% to 35%
        (categoryMatch) + 
        (tagScore);

      return {
        ...conv,
        semanticSimilarity,
        recencyScore,
        tagScore,
        combinedScore,
        index,
      };
    });

    // Sort by combined score (descending) - most relevant first
    const topContexts = scoredConversations
      .sort((a, b) => b.combinedScore - a.combinedScore)
      .slice(0, topK);

    console.log(`✓ Retrieved ${topContexts.length} top contexts (prioritizing recent):`);
    topContexts.forEach((ctx, i) => {
      console.log(`  ${i + 1}. Similarity: ${(ctx.semanticSimilarity * 100).toFixed(0)}% | Recency: ${(ctx.recencyScore * 100).toFixed(0)}% | Combined: ${(ctx.combinedScore * 100).toFixed(0)}%`);
      console.log(`     Q: "${ctx.userMessage.substring(0, 40)}..."`);
      console.log(`     Time: ${new Date(ctx.createdAt).toLocaleString()}`);
    });

    // Format contexts for LLM
    const formattedContexts = topContexts.map((ctx) => ({
      userMessage: ctx.userMessage,
      aiResponse: ctx.aiResponse,
      category: ctx.category,
      tags: ctx.tags,
      similarity: ctx.semanticSimilarity,
      recency: ctx.recencyScore,
      createdAt: ctx.createdAt,
      type: "conversation",
    }));

    return {
      contexts: formattedContexts,
      source: "semantic_search_with_recency_priority",
      totalSearched: allConversations.length,
      scoringMetrics: {
        recencyWeight: 0.55,           // INCREASED
        semanticWeight: 0.35,          // DECREASED
        categoryWeight: 0.05,
        tagWeight: 0.05,
        recencyAmplification: "exponential_decay",
      }
    };
  } catch (err) {
    console.error("✗ RAG retrieval error:", err.message);
    throw err;
  }
};

const findSpecificConversation = async (userId, query) => {
  try {
    console.log(`🔎 Finding specific conversation for query: "${query}"`);

    const queryEmbedding = await generateEmbedding(query);
    
    const conversations = await Conversation.find({ userId })
      .sort({ createdAt: -1 })
      .lean();

    if (conversations.length === 0) {
      return { found: false, conversation: null };
    }

    // Score conversations with INCREASED RECENCY WEIGHT
    const scored = conversations.map((conv) => {
      const similarity = cosineSimilarity(queryEmbedding, conv.embedding) || 0;
      const timeDiff = Date.now() - new Date(conv.createdAt).getTime();
      const maxTimeDiff = Date.now() - new Date(conversations[conversations.length - 1].createdAt).getTime();
      let recencyScore = 1 - (timeDiff / (maxTimeDiff + 1));
      
      // Apply exponential decay
      recencyScore = Math.pow(recencyScore, 0.5);
      
      return {
        ...conv,
        similarity,
        recencyScore,
        combinedScore: (similarity * 0.4) + (recencyScore * 0.6), // RECENCY: 60%, SIMILARITY: 40%
      };
    });

    // Sort and find best match with high confidence
    const bestMatch = scored.sort((a, b) => b.combinedScore - a.combinedScore)[0];

    const confidence = bestMatch.similarity;
    const found = confidence > 0.55; // Slightly lowered threshold

    console.log(`✓ Best match found with ${(confidence * 100).toFixed(0)}% confidence (Recent-priority)`);

    return {
      found,
      conversation: found ? {
        userMessage: bestMatch.userMessage,
        aiResponse: bestMatch.aiResponse,
        category: bestMatch.category,
        tags: bestMatch.tags,
        similarity: confidence,
        recency: bestMatch.recencyScore,
      } : null,
      confidence,
    };
  } catch (err) {
    console.error("✗ Find conversation error:", err.message);
    throw err;
  }
};

module.exports = { retrieveContext, findSpecificConversation };