/**
 * OpenRouter API client for LLM generation
 */

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import dotenv from 'dotenv';

/**
 * List of fallback models in order of preference
 * If the primary model fails, these will be tried in sequence
 */
export const FALLBACK_MODELS = [
  "google/gemini-2.0-flash-lite-preview-02-05:free",
  "google/gemini-2.0-flash-exp:free",
  "google/gemini-2.0-pro-exp-02-05:free",
  "deepseek/deepseek-chat:free",
];

/**
 * Get API key from environment variables or .env file
 * @returns {Promise<string>} The OpenRouter API key
 */
async function getApiKey() {
  // Check environment variable first
  if (process.env.OPENROUTER_API_KEY) {
    return process.env.OPENROUTER_API_KEY;
  }

  // If not found, try to load from .env file
  try {
    // Get the directory of the current module
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // Path to .env file (at project root)
    const envPath = path.join(__dirname, '..', '.env');

    // Check if .env file exists
    try {
      await fs.access(envPath);
    } catch (error) {
      throw new Error('API key not found in environment variables and no .env file found');
    }

    // Load .env file
    const envConfig = dotenv.parse(await fs.readFile(envPath));

    // Get API key from loaded config
    const apiKey = envConfig.OPENROUTER_API_KEY;
    if (!apiKey) {
      throw new Error('OPENROUTER_API_KEY not found in .env file');
    }

    return apiKey;
  } catch (error) {
    throw new Error(`Error loading API key: ${error.message}`);
  }
}

/**
 * Generate text using OpenRouter API
 * @param {string} [apiKey] - OpenRouter API key (optional, will be loaded from env if not provided)
 * @param {string} [model] - Model name to use for generation (defaults to Gemini flash lite)
 * @param {string} prompt - The prompt to send to the model
 * @param {Object} [options] - Additional options for the API request
 * @returns {Promise<Object>} - The parsed JSON response from OpenRouter
 */
export async function generateText(apiKey, model, prompt, options = {}) {
  // If apiKey is not provided, try to load it
  const key = apiKey || await getApiKey();

  // Default model is now Gemini flash lite
  const modelToUse = model || FALLBACK_MODELS[0]

  if (!prompt) {
    throw new Error('Prompt is required');
  }

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${key}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': options.referer || 'https://github.com',
        'X-Title': options.title || 'HN Digest'
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: [
          {
            role: 'user',
            content: prompt,
          },
        ],
        ...options.parameters
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenRouter API error (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    return result;
  } catch (error) {
    if (error.message.includes('API key')) {
      throw error; // Re-throw API key related errors
    }
    throw new Error(`Error calling OpenRouter API: ${error.message}`);
  }
}

/**
 * Extended version of generateText that extracts just the text content from the response
 * @param {string} [apiKey] - OpenRouter API key (optional, will be loaded from env if not provided)
 * @param {string} [model] - Model name to use for generation (defaults to Gemini flash lite)
 * @param {string} prompt - The prompt to send to the model
 * @param {Object} [options] - Additional options for the API request
 * @returns {Promise<string>} - Just the generated text content
 */
export async function askLLM(apiKey, model, prompt, options = {}) {
  const result = await generateText(apiKey, model, prompt, options);

  if (result &&
    result.choices &&
    result.choices.length > 0 &&
    result.choices[0].message &&
    result.choices[0].message.content) {
    return result.choices[0].message.content;
  }

  // Added console.log to see the unexpected response format
  console.log(result);
  throw new Error('Unexpected response format from OpenRouter API');
}

export default {
  generateText,
  askLLM,
  FALLBACK_MODELS
};

