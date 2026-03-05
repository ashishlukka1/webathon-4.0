const Groq = require("groq-sdk");
const { pipeline } = require("@xenova/transformers");

let classifier = null;

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

// Initialize BART classifier
const initializeClassifier = async () => {
  if (!classifier) {
    console.log("🔄 Loading BART classifier model...");
    try {
      classifier = await pipeline('zero-shot-classification', 'Xenova/bart-large-mnli');
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
    console.log(`   Message: "${userMessage.substring(0, 60)}..."`);
    console.log(`   Using ${keys.length} categories`);

    const result = await clf(userMessage, labels, {
      hypothesis: "This text is about {}."
    });

    console.log(`✓ BART Classification Results:`);
    
    // Create score mapping
    const allScores = {};
    result.labels.forEach((label, idx) => {
      const categoryKey = keys[labels.indexOf(label)];
      allScores[categoryKey] = result.scores[idx];
      console.log(`   ${categoryKey}: ${(result.scores[idx] * 100).toFixed(1)}%`);
    });

    // Get best match
    const bestLabelIndex = labels.indexOf(result.labels[0]);
    const detectedCategory = keys[bestLabelIndex];
    const confidence = result.scores[0];

    console.log(`✓ Best match: ${detectedCategory} (${(confidence * 100).toFixed(1)}% confidence)\n`);

    return {
      category: detectedCategory,
      confidence,
      allScores,
    };
  } catch (err) {
    console.error("✗ Classification error:", err.message);
    // Fallback to general if classification fails
    return {
      category: "general",
      confidence: 0,
      allScores: {},
      error: err.message,
    };
  }
};

const generateAIResponse = async (userMessage, contextData = null) => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      throw new Error("GROQ_API_KEY is not set in environment variables");
    }

    const groq = new Groq({ apiKey });

    // Build context string from RAG data - PRIORITIZE RECENCY
    let contextString = "";
    let mostRecentContext = "";
    
    if (contextData && contextData.contexts && contextData.contexts.length > 0) {
      contextString = "\nRECENT CONTEXT:\n";
      contextString += "─────────────────\n";
      
      contextData.contexts.slice(0, 3).forEach((ctx, idx) => {
        if (ctx.type === "group") {
          contextString += `[${idx + 1}] Group: ${ctx.category} | Score: ${(ctx.averageSuccessScore * 100).toFixed(0)}%\n`;
        } else {
          const recencyPercent = ctx.recency ? (ctx.recency * 100).toFixed(0) : '?';
          contextString += `[${idx + 1}] Q: "${ctx.userMessage}"\n`;
          contextString += `    A: "${ctx.aiResponse}"\n`;
          
          if (idx === 0) {
            mostRecentContext = ctx.aiResponse;
          }
        }
      });
      contextString += "─────────────────\n";
      
      if (mostRecentContext && mostRecentContext.length > 0) {
        contextString += `Most recent: "${mostRecentContext}"\n`;
      }
    }

    const systemPrompt = `You are a concise and direct professional advisor.

RESPONSE STYLE:
- Keep responses SHORT and PRECISE (2-3 sentences max)
- Only provide detailed explanations if user specifically asks to "elaborate" or "explain more"
- Be direct and decisive
- No bullet points, no lists, no headers
- Write in natural paragraphs only
- Get straight to the point

CONTEXT RULES:
- Use the MOST RECENT information as current truth
- If user updated something, use the new information
- Prioritize recent context over old context

${contextData ? contextString : ""}`;

    console.log("✓ Generating response with Groq (Llama 3.3 70B)...");
    console.log(`  Context: ${contextData?.contexts?.length || 0} contexts | RAG Source: ${contextData?.source || "none"}`);

    const chatCompletion = await groq.chat.completions.create({
      messages: [
        { 
          role: "system", 
          content: systemPrompt 
        },
        { 
          role: "user", 
          content: userMessage 
        }
      ],
      model: "llama-3.3-70b-versatile",
      temperature: 0.5,
      max_tokens: 300,
      top_p: 1,
      stream: false,
    });

    const responseText = chatCompletion.choices[0]?.message?.content || "";

    if (!responseText) {
      throw new Error("Empty response from Groq API");
    }

    console.log("✓ Response generated successfully");
    return responseText;
  } catch (err) {
    console.error("✗ LLM generation error:", err.message);
    
    if (err.message.includes("401") || err.message.includes("Unauthorized")) {
      console.error("⚠ Unauthorized - Check your GROQ_API_KEY");
    } else if (err.message.includes("429") || err.message.includes("rate")) {
      console.error("⚠ Rate limited - Too many requests");
    }
    
    throw new Error(`Failed to generate AI response: ${err.message}`);
  }
};

// Helper to validate API key
const validateAPIKey = async () => {
  try {
    const apiKey = process.env.GROQ_API_KEY;
    
    if (!apiKey) {
      return { 
        valid: false, 
        message: "GROQ_API_KEY not set"
      };
    }

    const groq = new Groq({ apiKey });
    
    console.log("🔍 Validating Groq API key...");
    const result = await groq.chat.completions.create({
      messages: [
        { role: "user", content: "Say 'OK'" }
      ],
      model: "llama-3.3-70b-versatile",
      max_tokens: 10,
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