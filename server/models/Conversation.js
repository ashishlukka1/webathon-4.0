const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    userMessage: {
      type: String,
      required: true,
      trim: true,
    },
    aiResponse: {
      type: String,
      required: true,
      trim: true,
    },
    category: {
      type: String,
      default: "general",
      index: true,
    },
    tags: {
      type: [String],
      default: [],
      index: true,
    },
    embedding: {
      type: [Number],
      default: null,
    },
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConversationGroup",
      default: null,
      index: true,
    },
    ragUsed: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

conversationSchema.index({ userId: 1, createdAt: -1 });
conversationSchema.index({ userId: 1, category: 1, createdAt: -1 });
conversationSchema.index({ userId: 1, groupId: 1, createdAt: -1 });

module.exports = mongoose.model("Conversation", conversationSchema);
