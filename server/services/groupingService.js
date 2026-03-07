const Conversation = require("../models/Conversation");
const ConversationGroup = require("../models/ConversationGroup");
const { calculateCentroid } = require("./embeddingService");

const groupConversations = async (userId) => {
  try {
    const ungroupedConvos = await Conversation.find({
      userId,
      groupId: null,
      embedding: { $ne: null },
    })
      .sort({ createdAt: 1 })
      .lean();

    if (ungroupedConvos.length < 3) {
      return {
        message: `Only ${ungroupedConvos.length} ungrouped conversations. Need at least 3.`,
        groupsCreated: 0,
        groups: [],
      };
    }

    const groupedByCategory = ungroupedConvos.reduce((acc, convo) => {
      const key = convo.category || "general";
      if (!acc[key]) acc[key] = [];
      acc[key].push(convo);
      return acc;
    }, {});

    const createdGroups = [];

    for (const [category, conversations] of Object.entries(groupedByCategory)) {
      if (conversations.length < 3) continue;

      const embeddings = conversations
        .map((c) => c.embedding)
        .filter((e) => Array.isArray(e) && e.length > 0);

      if (embeddings.length === 0) continue;

      const centroid = calculateCentroid(embeddings);
      if (!centroid) continue;

      const tags = [...new Set(conversations.flatMap((c) => c.tags || []))].slice(0, 20);

      const group = await ConversationGroup.create({
        userId,
        category,
        tags,
        centroidEmbedding: centroid,
        conversationIds: conversations.map((c) => c._id),
        conversationCount: conversations.length,
        summary: `${conversations.length} conversations in ${category}`,
      });

      await Conversation.updateMany(
        { _id: { $in: conversations.map((c) => c._id) } },
        { groupId: group._id }
      );

      createdGroups.push({
        groupId: group._id,
        category,
        conversationCount: conversations.length,
      });
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

module.exports = { groupConversations };
