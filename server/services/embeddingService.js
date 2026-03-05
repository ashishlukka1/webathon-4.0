// filepath: c:\Users\lukka\OneDrive\Desktop\webat\webat\server\services\embeddingService.js
const { env, AutoTokenizer, AutoModel } = require("@xenova/transformers");

env.allowLocalModels = true;
env.allowRemoteModels = true;

const embeddingCache = new Map();
let model = null;
let tokenizer = null;

async function initializeModel() {
  if (model && tokenizer) return;
  
  try {
    console.log("Loading MiniLM model...");
    tokenizer = await AutoTokenizer.from_pretrained("Xenova/all-MiniLM-L6-v2");
    model = await AutoModel.from_pretrained("Xenova/all-MiniLM-L6-v2");
    console.log("MiniLM loaded successfully!");
  } catch (err) {
    console.error("Model initialization failed:", err);
    throw err;
  }
}

// Normalize vector to unit length
function normalizeVector(vec) {
  if (!vec || vec.length === 0) return vec;
  
  const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
  if (magnitude === 0) return vec;
  return vec.map(v => v / magnitude);
}

// Mean pooling across tokens
function meanPooling(lastHiddenState, attentionMask) {
  const data = lastHiddenState.data || lastHiddenState;
  const dims = lastHiddenState.dims || [lastHiddenState.length / 384];
  
  const seqLength = dims[0];
  const embeddingDim = 384; // MiniLM output dimension
  
  const meanPooled = new Array(embeddingDim).fill(0);
  let validTokens = 0;

  for (let i = 0; i < seqLength; i++) {
    // Check attention mask if provided
    if (attentionMask && !attentionMask[i]) continue;
    
    validTokens++;
    for (let j = 0; j < embeddingDim; j++) {
      meanPooled[j] += data[i * embeddingDim + j];
    }
  }

  // Average the pooled embeddings
  if (validTokens > 0) {
    for (let i = 0; i < embeddingDim; i++) {
      meanPooled[i] /= validTokens;
    }
  }

  return meanPooled;
}

const generateEmbedding = async (text) => {
  if (!text || typeof text !== "string") {
    throw new Error("Invalid text for embedding");
  }

  const trimmed = text.trim().slice(0, 512);
  
  if (embeddingCache.has(trimmed)) {
    console.log(`Cache hit for: "${trimmed.substring(0, 30)}..."`);
    return embeddingCache.get(trimmed);
  }

  try {
    if (!model || !tokenizer) {
      await initializeModel();
    }

    console.log(`Generating embedding for: "${trimmed.substring(0, 50)}..."`);
    
    const encoded = tokenizer(trimmed, { padding: true, truncation: true });
    const { last_hidden_state, attention_mask } = await model(encoded);
    
    // Use mean pooling to get single embedding
    const embeddingArray = meanPooling(last_hidden_state, attention_mask?.data || attention_mask);
    
    // Normalize to unit vector
    const normalizedEmbedding = normalizeVector(embeddingArray);
    
    embeddingCache.set(trimmed, normalizedEmbedding);
    console.log(`Embedding generated with dimension: ${normalizedEmbedding.length}`);
    
    return normalizedEmbedding;
  } catch (err) {
    console.error("Embedding generation failed:", err);
    throw err;
  }
};

const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length) {
    return 0;
  }

  const dotProduct = vecA.reduce((sum, a, i) => sum + a * vecB[i], 0);
  const magnitudeA = Math.sqrt(vecA.reduce((sum, a) => sum + a * a, 0));
  const magnitudeB = Math.sqrt(vecB.reduce((sum, b) => sum + b * b, 0));

  if (magnitudeA === 0 || magnitudeB === 0) return 0;
  return dotProduct / (magnitudeA * magnitudeB);
};

const calculateCentroid = (embeddings) => {
  if (!embeddings || embeddings.length === 0) return null;

  const dimensions = embeddings[0].length;
  const centroid = new Array(dimensions).fill(0);

  for (let i = 0; i < dimensions; i++) {
    centroid[i] =
      embeddings.reduce((sum, emb) => sum + emb[i], 0) / embeddings.length;
  }

  return normalizeVector(centroid);
};

module.exports = generateEmbedding;
module.exports.cosineSimilarity = cosineSimilarity;
module.exports.calculateCentroid = calculateCentroid;
module.exports.normalizeVector = normalizeVector;