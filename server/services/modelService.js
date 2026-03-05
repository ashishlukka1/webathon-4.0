import { pipeline, env } from '@xenova/transformers';
import dotenv from 'dotenv';

dotenv.config(); // Loads variables from .env

// Configuration
env.allowLocalModels = true;
const HF_TOKEN = process.env.HF_TOKEN; 

let classifier;

const label_map = {
    "strategic": "long-term business strategy or expansion decision",
    "financial": "money, budget, investment or cost related decision",
    "operational": "internal workflow, process or management decision",
    "client": "customer, contract or client relationship decision",
    "personal": "individual career or personal life decision"
};
console.log("Label map for classification:", label_map);
export async function classifyEmail(text) {
    if (!classifier) {
        // Using the BART model logic from your Python code
        classifier = await pipeline('zero-shot-classification', 'Xenova/bart-large-mnli');
    }

    const labels = Object.values(label_map);
    const keys = Object.keys(label_map);

    const result = await classifier(text, labels, {
        hypothesis: "This text is about a {}."
    });

    // Match the descriptive labels back to your short keys
    const bestLabelIndex = labels.indexOf(result.labels[0]);
    
    return {
        label: keys[bestLabelIndex],
        confidence: result.scores[0],
        all_scores: result.scores
    };
}