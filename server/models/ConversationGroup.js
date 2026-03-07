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
    tags: {
      type: [String],
      default: [],
    },
    conversationCount: {
      type: Number,
      default: 0,
    },
    centroidEmbedding: {
      type: [Number],
      default: [],
    },
    conversationIds: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Conversation",
      },
    ],
    summary: {
      type: String,
      default: "",
    },
  },
  { timestamps: true }
);

conversationGroupSchema.index({ userId: 1, category: 1 });

module.exports = mongoose.model("ConversationGroup", conversationGroupSchema);
