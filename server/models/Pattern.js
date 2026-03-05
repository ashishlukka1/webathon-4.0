const mongoose = require("mongoose");

const patternSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    name: String,
    description: String,
    count: { type: Number, default: 1 }
  },
  { timestamps: true }
);

module.exports = mongoose.model("Pattern", patternSchema);