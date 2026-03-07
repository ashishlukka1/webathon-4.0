// services/embeddingService.js

let env, AutoTokenizer, AutoModel;

const embeddingCache = new Map();
let model = null;
let tokenizer = null;
let useFallbackEmbedding = process.env.VERCEL === "1" || process.env.DISABLE_LOCAL_MODELS === "true";

// Load transformers dynamically (fix for ESM module)
async function loadTransformers() {
  if (!AutoTokenizer || !AutoModel) {
    const transformers = await import("@xenova/transformers");

    env = transformers.env;
    AutoTokenizer = transformers.AutoTokenizer;
    AutoModel = transformers.AutoModel;

    env.allowLocalModels = true;
    env.allowRemoteModels = true;
  }
}

async function initializeModel() {
  if (useFallbackEmbedding) return;
  if (model && tokenizer) return;

  try {
    await loadTransformers();

    console.log("Loading MiniLM model...");

    tokenizer = await AutoTokenizer.from_pretrained(
      "Xenova/all-MiniLM-L6-v2"
    );

    model = await AutoModel.from_pretrained(
      "Xenova/all-MiniLM-L6-v2"
    );

    console.log("MiniLM loaded successfully!");
  } catch (err) {
    console.error("Model initialization failed:", err);
    useFallbackEmbedding = true;
  }
}

function createFallbackEmbedding(text, dimensions = 128) {
  const vec = new Array(dimensions).fill(0);
  const tokens = text.toLowerCase().split(/\W+/).filter(Boolean);
  for (const token of tokens) {
    let hash = 0;
    for (let i = 0; i < token.length; i++) {
      hash = (hash * 31 + token.charCodeAt(i)) >>> 0;
    }
    vec[hash % dimensions] += 1;
  }
  return normalizeVector(vec);
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
  const embeddingDim = 384;

  const meanPooled = new Array(embeddingDim).fill(0);
  let validTokens = 0;

  for (let i = 0; i < seqLength; i++) {

    if (attentionMask && !attentionMask[i]) continue;

    validTokens++;

    for (let j = 0; j < embeddingDim; j++) {
      meanPooled[j] += data[i * embeddingDim + j];
    }
  }

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
    console.log(`Cache hit: ${trimmed.substring(0, 30)}...`);
    return embeddingCache.get(trimmed);
  }

  try {

    if (!model || !tokenizer) {
      await initializeModel();
    }

    if (useFallbackEmbedding || !model || !tokenizer) {
      const fallback = createFallbackEmbedding(trimmed);
      embeddingCache.set(trimmed, fallback);
      return fallback;
    }

    console.log(`Generating embedding for: ${trimmed.substring(0, 50)}...`);

    const encoded = tokenizer(trimmed, {
      padding: true,
      truncation: true
    });

    const { last_hidden_state, attention_mask } = await model(encoded);

    const embeddingArray = meanPooling(
      last_hidden_state,
      attention_mask?.data || attention_mask
    );

    const normalizedEmbedding = normalizeVector(embeddingArray);

    embeddingCache.set(trimmed, normalizedEmbedding);

    console.log(
      `Embedding generated with dimension: ${normalizedEmbedding.length}`
    );

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

  const dotProduct = vecA.reduce(
    (sum, a, i) => sum + a * vecB[i],
    0
  );

  const magnitudeA = Math.sqrt(
    vecA.reduce((sum, a) => sum + a * a, 0)
  );

  const magnitudeB = Math.sqrt(
    vecB.reduce((sum, b) => sum + b * b, 0)
  );

  if (magnitudeA === 0 || magnitudeB === 0) return 0;

  return dotProduct / (magnitudeA * magnitudeB);
};

const calculateCentroid = (embeddings) => {

  if (!embeddings || embeddings.length === 0) return null;

  const dimensions = embeddings[0].length;

  const centroid = new Array(dimensions).fill(0);

  for (let i = 0; i < dimensions; i++) {
    centroid[i] =
      embeddings.reduce((sum, emb) => sum + emb[i], 0) /
      embeddings.length;
  }

  return normalizeVector(centroid);
};

module.exports = generateEmbedding;
module.exports.cosineSimilarity = cosineSimilarity;
module.exports.calculateCentroid = calculateCentroid;
module.exports.normalizeVector = normalizeVector;
