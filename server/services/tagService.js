const generateEmbedding = require("./embeddingService");
const { cosineSimilarity } = require("./embeddingService");

const extractTags = async (text) => {
  try {
    // Use keyword extraction based on embeddings and frequency
    const keywords = await extractKeywordsWithEmbeddings(text);
    return keywords;
  } catch (err) {
    console.error("Tag extraction error:", err.message);
    return extractKeywordsSimple(text);
  }
};

const extractKeywordsWithEmbeddings = async (text) => {
  // Split into sentences/phrases
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  
  if (sentences.length <= 1) {
    return extractKeywordsSimple(text);
  }

  try {
    // Get embeddings for main text and sentences
    const mainEmbedding = await generateEmbedding(text);
    
    const sentenceEmbeddings = await Promise.all(
      sentences.map(sent => generateEmbedding(sent.trim()))
    );

    // Calculate similarity of each sentence to main text
    const similarities = sentenceEmbeddings.map(sentEmb => 
      cosineSimilarity(mainEmbedding, sentEmb)
    );

    // Get top sentences
    const topSentences = sentences
      .map((sent, idx) => ({ text: sent.trim(), similarity: similarities[idx] }))
      .sort((a, b) => b.similarity - a.similarity)
      .slice(0, 2)
      .map(s => s.text);

    // Extract keywords from top sentences
    const keywords = new Set();
    topSentences.forEach(sent => {
      extractKeywordsSimple(sent).forEach(kw => keywords.add(kw));
    });

    return Array.from(keywords).slice(0, 5);
  } catch (err) {
    console.error("Embedding-based tag extraction failed:", err);
    return extractKeywordsSimple(text);
  }
};

const extractKeywordsSimple = (text) => {
  const stopWords = new Set([
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "is", "are", "was", "were", "be", "been", "being", "have", "has", "had",
    "do", "does", "did", "will", "would", "should", "could", "may", "might",
    "can", "must", "i", "you", "he", "she", "it", "we", "they", "this", "that",
    "from", "with", "by", "of", "as", "about", "when", "where", "why", "how",
    "all", "each", "every", "both", "few", "more", "most", "some", "any",
    "just", "only", "very", "too", "so", "not", "no", "yes", "if", "then"
  ]);

  const words = text
    .toLowerCase()
    .split(/[\s\W]+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  // Count word frequencies
  const wordFreq = {};
  words.forEach(word => {
    wordFreq[word] = (wordFreq[word] || 0) + 1;
  });

  // Get top words by frequency
  const topWords = Object.entries(wordFreq)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([word]) => word);

  return topWords;
};

module.exports = extractTags;