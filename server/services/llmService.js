const Groq = require("groq-sdk");

let classifier = null;
let pipeline = null;

// Category labels for BART classification
const label_map = {
  strategic: "long-term business strategy or expansion decision",
  financial: "money, budget, investment or cost related decision",
  operational: "internal workflow, process or management decision",
  client: "customer, contract or client relationship decision",
  pricing: "pricing, discount, or rate decision",
  "customer-service": "customer support or service quality decision",
  product: "product development, feature or design decision"
};

// Dynamically load transformers (fix for ESM module)
const loadTransformers = async () => {
  if (!pipeline) {
    const transformers = await import("@xenova/transformers");
    pipeline = transformers.pipeline;
  }
};

// Initialize BART classifier
const initializeClassifier = async () => {
  if (!classifier) {
    console.log("🔄 Loading BART classifier model...");

    try {
      await loadTransformers();

      classifier = await pipeline(
        "zero-shot-classification",
        "Xenova/bart-large-mnli"
      );

      console.log("✓ BART classifier loaded successfully");

    } catch (err) {
      console.error("✗ Failed to load BART classifier:", err.message);
      throw err;
    }
  }

  return classifier;
};

// Classify text using BART
const classifyCategory = async (userMessage) => {

  try {
    const clf = await initializeClassifier();

    const labels = Object.values(label_map);
    const keys = Object.keys(label_map);

    console.log("🤖 Classifying message with BART...");
    console.log(`Message: "${userMessage.substring(0, 60)}..."`);

    const result = await clf(userMessage, labels, {
      hypothesis: "This text is about {}."
    });

    const allScores = {};

    result.labels.forEach((label, idx) => {
      const categoryKey = keys[labels.indexOf(label)];
      allScores[categoryKey] = result.scores[idx];
    });

    const bestLabelIndex = labels.indexOf(result.labels[0]);
    const rawCategory = keys[bestLabelIndex];
    const confidence = result.scores[0];
    const detectedCategory = confidence >= 0.35 ? rawCategory : "general";

    console.log(`✓ Best match: ${detectedCategory}`);

    return {
      category: detectedCategory,
      confidence,
      allScores
    };

  } catch (err) {

    console.error("✗ Classification error:", err.message);

    return {
      category: "general",
      confidence: 0,
      allScores: {},
      error: err.message
    };
  }
};

const generateAIResponse = async (userMessage, contextData = null) => {

  try {
    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set");
    }

    const groq = new Groq({ apiKey });

    let contextString = "";
    let mostRecentContext = "";
    const userName = contextData?.memory?.name || "";

    if (contextData && contextData.contexts && contextData.contexts.length > 0) {

      contextString = "\nRECENT CONTEXT:\n";
      contextString += "─────────────────\n";

      contextData.contexts.slice(0, 3).forEach((ctx, idx) => {

        if (ctx.type === "group") {

          contextString += `[${idx + 1}] Group: ${ctx.category}\n`;

        } else {

          contextString += `[${idx + 1}] Q: "${ctx.userMessage}"\n`;
          contextString += `A: "${ctx.aiResponse}"\n`;

          if (idx === 0) {
            mostRecentContext = ctx.aiResponse;
          }
        }

      });

      contextString += "─────────────────\n";

      if (mostRecentContext) {
        contextString += `Most recent: "${mostRecentContext}"\n`;
      }
    }

    const systemPrompt = `You are a concise and direct professional advisor.

RESPONSE STYLE:
- Keep responses SHORT and PRECISE (2-3 sentences max)
- No bullet points
- No lists
- Direct answers only

MEMORY RULE:
- If user identity is known from prior messages, use it accurately.
- Never claim missing identity data if memory explicitly provides it.

${userName ? `KNOWN USER NAME: ${userName}` : ""}

${contextString}`;

    console.log("✓ Generating response with Groq...");

    const chatCompletion = await groq.chat.completions.create({

      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage }
      ],

      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 300

    });

    const responseText = chatCompletion.choices[0]?.message?.content || "";

    if (!responseText) {
      throw new Error("Empty response from Groq API");
    }

    return responseText;

  } catch (err) {

    console.error("✗ LLM generation error:", err.message);

    throw new Error(`Failed to generate AI response: ${err.message}`);
  }
};

// Validate API key
const validateAPIKey = async () => {

  try {

    const apiKey = process.env.GROQ_API_KEY;

    if (!apiKey) {
      return { valid: false, message: "GROQ_API_KEY not set" };
    }

    const groq = new Groq({ apiKey });

    const result = await groq.chat.completions.create({
      messages: [{ role: "user", content: "Say OK" }],
      model: "llama-3.3-70b-versatile",
      max_tokens: 10
    });

    const text = result.choices[0]?.message?.content || "";

    return {
      valid: true,
      message: "Groq API key is valid ✓",
      response: text,
      provider: "Groq (Llama 3.3 70B)"
    };

  } catch (err) {

    return {
      valid: false,
      message: `API validation failed: ${err.message}`,
      provider: "Groq"
    };
  }
};

module.exports = generateAIResponse;
module.exports.validateAPIKey = validateAPIKey;
module.exports.classifyCategory = classifyCategory;
module.exports.initializeClassifier = initializeClassifier;
