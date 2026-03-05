const mongoose = require("mongoose");

const conversationGroupSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    category: {
      type: String,
      required: true,
      index: true,
    },
    tags: [String],
    conversationCount: {
      type: Number,
      default: 0,
    },
    centroidEmbedding: [Number],
    conversationIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
      },
    ],
    summary: String,
    averageSentiment: {
      type: String,
      enum: ["positive", "neutral", "negative"],
      default: "neutral",
    },
    averageSuccessScore: {
      type: Number,
      min: 0,
      max: 1,
      default: 0.5,
    },
  },
  { timestamps: true }
);

conversationGroupSchema.index({ userId: 1, category: 1 });
conversationGroupSchema.index({ userId: 1, tags: 1 });

module.exports = mongoose.model("ConversationGroup", conversationGroupSchema);