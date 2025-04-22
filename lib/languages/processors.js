const axios = require('axios');
const chalk = require('chalk');
const _ = require('lodash');

// Helper for batched operations with delays
async function processBatches(items, processFn, batchSize = 15, delayMs = 2000) {
  const results = [];
  
  for (let i = 0; i < items.length; i += batchSize) {
    const batch = items.slice(i, i + batchSize);
    console.log(chalk.blue(`Processing batch ${Math.floor(i/batchSize) + 1}/${Math.ceil(items.length/batchSize)}...`));
    
    try {
      const batchResults = await processFn(batch);
      results.push(...batchResults);
      
      if (i + batchSize < items.length) {
        await new Promise(resolve => setTimeout(resolve, delayMs));
      }
    } catch (err) {
      console.error(chalk.red(`Error processing batch: ${err.message}`));
      throw err;
    }
  }
  
  return results;
}

// Translate using Gemini API
async function translateWithGemini(texts, targetLang, apiKey) {
  if (!texts || texts.length === 0) return [];
  
  // Map language codes to names for Gemini
  const langNameMap = {
    es: 'Spanish',
    zh: 'Chinese (Simplified)',
    hi: 'Hindi',
    fr: 'French',
    de: 'German',
    ja: 'Japanese',
    ko: 'Korean',
    pt: 'Portuguese',
    ru: 'Russian',
    ar: 'Arabic'
  };
  
  const langName = langNameMap[targetLang] || 'Spanish';
  
  // Prepare the prompt for Gemini
  const prompt = `Translate the following English phrases to ${langName}. 
Return only the translations as a JSON array in the exact same order, with no additional text or explanation.
Example: ["translation1", "translation2", ...]

Phrases to translate:
${JSON.stringify(texts)}`;
  
  // Prepare request to Gemini API
  try {
    const response = await axios.post(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
      {
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generation_config: {
          temperature: 0.2,
          top_k: 1,
          top_p: 0.8,
          max_output_tokens: 1024
        }
      },
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
    
    if (response.data.candidates && response.data.candidates.length > 0) {
      const responseText = response.data.candidates[0].content.parts[0].text;
      
      // Extract JSON array from response
      const match = responseText.match(/\[([\s\S]*)\]/);
      if (match) {
        const arrayText = `[${match[1]}]`;
        return JSON.parse(arrayText);
      } else {
        return JSON.parse(responseText);
      }
    }
    
    throw new Error('Unexpected response format from Gemini API');
    
  } catch (err) {
    if (err.response) {
      throw new Error(`Gemini API error: ${err.response.status} - ${err.response.data.error || err.response.statusText}`);
    }
    throw err;
  }
}

// Translate using Google Translate API (if Gemini fails)
async function translateWithGoogle(texts, targetLang, apiKey) {
  // Implementation for Google Translate API as backup
  // Note: Requires different API key for Google Cloud
  throw new Error('Google Translate backup not implemented');
}

// Main translation function
async function translateStrings(strings, targetLang, apiKey, service = 'gemini') {
  if (!strings || strings.length === 0) return {};
  
  console.log(chalk.blue(`🌐 Translating ${strings.length} strings to ${targetLang} using ${service}...`));
  
  // Group strings by context (namespace)
  const namespaces = {
    common: [],
    navigation: [],
    components: [],
    messages: [],
    forms: [],
    errors: []
  };
  
  // Simple categorization of strings
  strings.forEach(str => {
    // Convert to lowercase for categorization
    const lowerStr = str.toLowerCase();
    
    // Check for common patterns
    if (lowerStr.includes('error') || lowerStr.includes('fail') || lowerStr.includes('invalid')) {
      namespaces.errors.push(str);
    } else if (lowerStr.includes('home') || lowerStr.includes('about') || lowerStr.includes('contact')) {
      namespaces.navigation.push(str);
    } else if (lowerStr.includes('submit') || lowerStr.includes('cancel') || lowerStr.includes('save')) {
      namespaces.forms.push(str);
    } else if (lowerStr.includes('loading') || lowerStr.includes('success') || lowerStr.includes('warning')) {
      namespaces.messages.push(str);
    } else if (str.length < 20) {
      namespaces.common.push(str);
    } else {
      namespaces.components.push(str);
    }
  });
  
  // Flatten for translation
  const allStrings = [];
  const indexMap = {};
  let index = 0;
  
  Object.keys(namespaces).forEach(namespace => {
    namespaces[namespace].forEach(str => {
      allStrings.push(str);
      indexMap[index] = { namespace, original: str };
      index++;
    });
  });
  
  // Translate in batches
  let translations = [];
  
  try {
    if (service === 'gemini') {
      translations = await processBatches(allStrings, 
        batch => translateWithGemini(batch, targetLang, apiKey));
    } else if (service === 'google') {
      translations = await processBatches(allStrings, 
        batch => translateWithGoogle(batch, targetLang, apiKey));
    } else {
      throw new Error(`Unsupported translation service: ${service}`);
    }
  } catch (err) {
    console.error(chalk.red(`Translation failed: ${err.message}`));
    throw err;
  }
  
  // Regroup translations by namespace
  const translatedObject = {};
  
  translations.forEach((translation, idx) => {
    const { namespace, original } = indexMap[idx];
    if (!translatedObject[namespace]) {
      translatedObject[namespace] = {};
    }
    
    // Create a key from the original string
    const key = _.camelCase(original.substring(0, 30));
    translatedObject[namespace][key] = translation;
  });
  
  return translatedObject;
}

// Language expansion analysis
function analyzeTextExpansion(sourceStrings, translatedStrings, language) {
  if (!sourceStrings || !translatedStrings) return {};
  
  const analysis = {
    language,
    totalOriginalLength: 0,
    totalTranslatedLength: 0,
    expansionFactor: 1.0,
    criticalExpansions: []
  };
  
  // Compare lengths for each string
  sourceStrings.forEach((source, idx) => {
    const translated = translatedStrings[idx];
    if (!translated) return;
    
    const sourceLength = source.length;
    const translatedLength = translated.length;
    const expansionFactor = translatedLength / sourceLength;
    
    analysis.totalOriginalLength += sourceLength;
    analysis.totalTranslatedLength += translatedLength;
    
    // Flag critical expansions (> 150% expansion)
    if (expansionFactor > 1.5 && sourceLength > 5) {
      analysis.criticalExpansions.push({
        source,
        translated,
        expansionFactor: expansionFactor.toFixed(2)
      });
    }
  });
  
  if (analysis.totalOriginalLength > 0) {
    analysis.expansionFactor = 
      (analysis.totalTranslatedLength / analysis.totalOriginalLength).toFixed(2);
  }
  
  return analysis;
}

module.exports = {
  translateStrings,
  analyzeTextExpansion
};