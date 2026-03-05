const mongoose = require("mongoose");

const learningSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, index: true },
    chatId: { type: String, required: true, index: true },
    tag: { type: [String], index: true },
    message: { type: String, required: true },
    embedding: { 
      type: [Number], // Stores the vector data for RAG
      required: true 
    }
  },
  { timestamps: true }
);

// High-speed index for the 10-day timeline
learningSchema.index({ userId: 1, tag: 1, createdAt: -1 });

module.exports = mongoose.model("Learning", learningSchema);