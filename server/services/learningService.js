const Learning = require("../models/Learning");
const Conversation = require("../models/Conversation");

const handleTenDayTrigger = async (userId, chatId, tags) => {
  try {
    const tenDaysInMs = 10 * 24 * 60 * 60 * 1000;
    const boundaryDate = new Date(Date.now() - tenDaysInMs);

    // 1. Check if we already triggered a "Learning" for these tags recently
    const lastLearning = await Learning.findOne({
      userId,
      tag: { $in: tags }
    }).sort({ createdAt: -1 });

    // 2. Trigger check
    if (!lastLearning || (Date.now() - new Date(lastLearning.createdAt).getTime()) > tenDaysInMs) {
      console.log("🚀 10-day window reached. Gathering data from Database...");

      // 3. INTERNAL GATHERING: Pull all messages from the last 10 days for these tags
      const rawData = await Conversation.find({
        userId,
        tags: { $in: tags },
        createdAt: { $gte: boundaryDate }
      }).select("userMessage aiResponse -_id").lean();

      // Format the gathered data into a single string
      const gatheredString = rawData
        .map(d => `User: ${d.userMessage}\nAI: ${d.aiResponse}`)
        .join("\n---\n");

      if (!gatheredString) return { triggered: false, context: null };

      // 4. Create the Learning record with the gathered data
      const newLearning = await Learning.create({
        userId,
        chatId,
        tag: tags,
        message: gatheredString 
      });

      return { triggered: true, context: newLearning.message };
    }

    return { triggered: false, context: null };
  } catch (error) {
    console.error("Learning gathering failed:", error);
    return { triggered: false, context: null };
  }
};

module.exports = { handleTenDayTrigger };