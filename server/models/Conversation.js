const mongoose = require("mongoose");

const conversationSchema = new mongoose.Schema(
  {
    userId: { 
      type: mongoose.Schema.Types.ObjectId, 
      ref: "User",
      required: true,
      index: true
    },
    // Added chatId to group messages into specific conversation threads
    chatId: {
      type: String,
      required: true,
      index: true
    },
    userMessage: {
      type: String,
      required: true
    },
    aiResponse: {
      type: String,
      required: true
    },
    category: {
      type: String,
      enum: ["strategic", "financial", "operational", "client", "personal", "general", "pricing", "customer-service", "product"],
      index: true,
      default: "general"
    },
    decisionType: String,
    tags: [String],
    embedding: {
      type: [Number],
      default: null
    },
    // New grouping fields
    groupId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ConversationGroup",
      index: true
    },
    sentiment: {
      type: String,
      enum: ["positive", "neutral", "negative"],
      default: "neutral"
    },
    // New outcome tracking fields
    outcome: {
      successScore: {
        type: Number,
        min: 0,
        max: 1,
        default: 0.5
      },
      feedback: String,
      updatedAt: {
        type: Date,
        default: Date.now
      }
    },
    // Track if this conversation was used in RAG retrieval
    ragRetrievalCount: {
      type: Number,
      default: 0
    },
    // Track context source
    contextSource: {
      type: String,
      enum: ["first-conversation", "rag-conversations", "rag-groups"],
      default: "first-conversation"
    }
  },
  { timestamps: true }
);

// Updated Compound indexes for high-performance thread and RAG retrieval
conversationSchema.index({ userId: 1, chatId: 1, createdAt: -1 }); 
conversationSchema.index({ userId: 1, category: 1 });
conversationSchema.index({ userId: 1, tags: 1 });
conversationSchema.index({ userId: 1, groupId: 1 });
conversationSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("Conversation", conversationSchema);