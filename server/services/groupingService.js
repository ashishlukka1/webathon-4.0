const Conversation = require("../models/Conversation");
const ConversationGroup = require("../models/ConversationGroup");
const { calculateCentroid, cosineSimilarity } = require("./embeddingService");
const extractTags = require("./tagService");

const groupConversations = async (userId) => {
  try {
    console.log(`Starting grouping for userId: ${userId}`);

    // Get all conversations without a group, ordered by creation
    const ungroupedConvos = await Conversation.find({
      userId,
      groupId: null,
      embedding: { $ne: null },
    }).sort({ createdAt: -1 });

    if (ungroupedConvos.length < 10) {
      return { message: `Only ${ungroupedConvos.length} conversations. Need at least 10 to group.` };
    }

    // Group by category
    const groupedByCategory = {};
    ungroupedConvos.forEach((convo) => {
      const category = convo.category || "general";
      if (!groupedByCategory[category]) {
        groupedByCategory[category] = [];
      }
      groupedByCategory[category].push(convo);
    });

    console.log("Categories:", Object.keys(groupedByCategory));

    const createdGroups = [];

    // Process each category
    for (const [category, conversations] of Object.entries(groupedByCategory)) {
      console.log(`Processing category: ${category} with ${conversations.length} conversations`);

      if (conversations.length >= 10) {
        // Extract tags for conversations
        const conversationsWithTags = await Promise.all(
          conversations.map(async (convo) => {
            if (!convo.tags || convo.tags.length === 0) {
              const tags = await extractTags(convo.userMessage);
              convo.tags = tags;
            }
            return convo;
          })
        );

        // Cluster by embedding similarity
        const clusters = clusterConversations(conversationsWithTags);

        console.log(`Created ${clusters.length} clusters for category: ${category}`);

        // Create groups for each cluster
        for (const cluster of clusters) {
          const embeddings = cluster
            .map((c) => c.embedding)
            .filter(e => e && e.length > 0);

          if (embeddings.length === 0) continue;

          const centroid = calculateCentroid(embeddings);
          if (!centroid) continue;

          const tags = [...new Set(cluster.flatMap((c) => c.tags || []))];
          const avgSuccessScore =
            cluster.reduce((sum, c) => sum + (c.outcome?.successScore || 0.5), 0) /
            cluster.length;
          const sentiments = cluster.map((c) => c.sentiment || "neutral");
          const avgSentiment = getAverageSentiment(sentiments);

          const group = await ConversationGroup.create({
            userId,
            category,
            tags,
            centroidEmbedding: centroid,
            conversationIds: cluster.map((c) => c._id),
            conversationCount: cluster.length,
            summary: generateSummary(cluster),
            averageSentiment: avgSentiment,
            averageSuccessScore: avgSuccessScore,
          });

          // Update conversations with groupId
          await Conversation.updateMany(
            { _id: { $in: cluster.map((c) => c._id) } },
            { groupId: group._id, contextSource: "rag-groups" }
          );

          createdGroups.push({
            groupId: group._id,
            category,
            conversationCount: cluster.length,
            centroidDim: centroid.length,
          });

          console.log(`Created group: ${group._id} with ${cluster.length} conversations`);
        }
      }
    }

    return {
      message: "Grouping completed successfully",
      groupsCreated: createdGroups.length,
      groups: createdGroups,
    };
  } catch (err) {
    console.error("Grouping error:", err);
    throw err;
  }
};

const clusterConversations = (conversations) => {
  const clusters = [];
  const used = new Set();

  for (let i = 0; i < conversations.length; i++) {
    if (used.has(i)) continue;

    const cluster = [conversations[i]];
    used.add(i);

    for (let j = i + 1; j < conversations.length; j++) {
      if (used.has(j)) continue;

      // Check if embedding exists
      if (!conversations[i].embedding || !conversations[j].embedding) {
        continue;
      }

      const similarity = cosineSimilarity(
        conversations[i].embedding,
        conversations[j].embedding
      );

      // Cluster if similarity > 0.7 and same category/tags
      if (similarity > 0.7) {
        const commonTags = (conversations[i].tags || []).filter((tag) =>
          (conversations[j].tags || []).includes(tag)
        );

        if (commonTags.length > 0 || similarity > 0.85) {
          cluster.push(conversations[j]);
          used.add(j);
        }
      }
    }

    // Only add cluster if it has at least 3 conversations
    if (cluster.length >= 3) {
      clusters.push(cluster);
    }
  }

  return clusters;
};

const generateSummary = (conversations) => {
  const categories = [...new Set(conversations.map((c) => c.category || "general"))];
  const tags = [...new Set(conversations.flatMap((c) => c.tags || []))];
  const count = conversations.length;
  return `${count} conversations | Categories: ${categories.join(", ")} | Tags: ${tags.slice(0, 5).join(", ")}`;
};

const getAverageSentiment = (sentiments) => {
  const counts = {
    positive: sentiments.filter((s) => s === "positive").length,
    neutral: sentiments.filter((s) => s === "neutral").length,
    negative: sentiments.filter((s) => s === "negative").length,
  };

  if (counts.positive > counts.negative && counts.positive > counts.neutral) {
    return "positive";
  } else if (counts.negative > counts.neutral) {
    return "negative";
  }
  return "neutral";
};

module.exports = { groupConversations };