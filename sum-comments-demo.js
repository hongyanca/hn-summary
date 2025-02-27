#!/usr/bin/env node

import { extractComments } from './src/commentExtractor.js';
import { askLLM, FALLBACK_MODELS } from './src/openrouterClient.js';
import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * Demo that extracts HN comments and summarizes them with LLM using a user-provided prompt
 */
async function hnSummaryDemo() {
  console.log('🔍 HN Comment Summarizer');
  console.log('========================');

  // Get URL from command line or use default
  const url = process.argv[2] || 'https://news.ycombinator.com/item?id=43186406';

  // Preferred model
  // const model = "google/gemini-2.0-pro-exp-02-05:free";
  const model = "deepseek/deepseek-chat:free";

  console.log(`📌 Processing HN discussion: ${url}`);

  try {
    // Step 1: Extract comments
    console.log('⏳ Extracting comments...');
    const startExtract = performance.now();
    const comments = await extractComments(url);
    const endExtract = performance.now();

    console.log(`✅ Extracted comments in ${(endExtract - startExtract).toFixed(2)}ms`);
    console.log(`📊 Found ${comments.split('- ').length - 1} comments`);

    // Save comments to file
    await fs.mkdir('output', { recursive: true });
    const commentsFileName = `output/hn_comments_${Date.now()}.md`;
    await fs.writeFile(commentsFileName, comments);
    console.log(`💾 Comments saved to: ${commentsFileName}`);

    // Create readline interface for user input
    const rl = readline.createInterface({ input, output });

    // Show a preview of the comments
    console.log('\n📝 Preview of extracted comments:');
    console.log('---------------------------------');
    const previewLines = comments.split('\n').slice(0, 5); // Show first 5 lines
    console.log(previewLines.join('\n') + (comments.split('\n').length > 5 ? '\n...' : ''));
    console.log('---------------------------------');

    // Default prompt suggestion
    const defaultPrompt = `I have extracted comments from a Hacker News discussion. Please analyze these comments and provide:

1. A concise summary of the main discussion points (3-5 bullet points)
2. The key insights or perspectives shared 
3. Any interesting disagreements or debates within the comments
4. Technical details mentioned (if applicable)`;

    // Ask user if they want to use the default prompt or create their own
    console.log('\n💡 You can use the default prompt or create your own to analyze the comments.');
    const useDefault = await rl.question('Use default prompt? (Y/n): ');

    let userPrompt = '';

    if (useDefault.toLowerCase() === 'n' || useDefault.toLowerCase() === 'no') {
      // User wants to create their own prompt
      console.log('\n📝 Enter your custom prompt below:');
      console.log('(Type on multiple lines, press Ctrl+D when finished)');

      rl.on('line', (line) => {
        userPrompt += line + '\n';
      });

      // Wait for user to finish input (Ctrl+D)
      await new Promise(resolve => rl.once('close', resolve));

      // Trim any extra whitespace
      userPrompt = userPrompt.trim();

      // Validate input
      if (!userPrompt) {
        console.log('⚠️ Empty prompt provided, using default instead.');
        userPrompt = defaultPrompt;
      }
    } else {
      // Use the default prompt
      userPrompt = defaultPrompt;
      rl.close();
    }

    // Append the comments to the user's prompt
    const fullPrompt = `${userPrompt}

The comments are formatted as a markdown bullet list. Here they are:

${comments.substring(0, 15000)} ${comments.length > 15000 ? '...[truncated due to length]' : ''}`;

    console.log('\n⏳ Generating analysis with Gemini...');

    // Step 2: Generate summary with LLM
    const startSummary = performance.now();

    // Call the LLM
    const summary = await askLLM(
      null, // Use environment variable for API key
      model,
      fullPrompt,
      {
        title: 'HN Digest',
        parameters: {
          temperature: 0.1,    // Low temperature for more deterministic output
          max_tokens: 4000     // Limit summary length
        }
      }
    );

    const endSummary = performance.now();
    console.log(`✅ Generated analysis in ${(endSummary - startSummary).toFixed(2)}ms`);

    // Save summary and prompt to file
    const summaryFileName = `output/hn_analysis_${Date.now()}.md`;
    await fs.writeFile(summaryFileName,
      `# Hacker News Discussion Analysis\n\n` +
      `**Source:** ${url}\n\n` +
      `**Generated:** ${new Date().toISOString()}\n\n` +
      `**Model:** ${model}\n\n` +
      `## Prompt Used\n\n\`\`\`\n${userPrompt}\n\`\`\`\n\n` +
      `## Analysis\n\n${summary}\n\n` +
      `---\n\n` +
      `*Generated using HN Comment Summarizer*`
    );

    console.log(`💾 Analysis saved to: ${summaryFileName}`);

    // Display summary
    console.log('\n📝 Analysis:');
    console.log('-------------');
    console.log(summary);
    console.log('-------------');

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);

    // Try to provide helpful error messages
    if (error.message.includes('API key')) {
      console.log('\n💡 OpenRouter Setup Instructions:');
      console.log('1. Get an API key from https://openrouter.ai');
      console.log('2. Set it as an environment variable: export OPENROUTER_API_KEY=your-key-here');
      console.log('   Or create a .env file in the project root with: OPENROUTER_API_KEY=your-key-here');
    }
    else if (error.message.includes('fetch')) {
      console.log('\n💡 Connectivity issue. Please check your internet connection.');
    }

    process.exit(1);
  }
}

/**
 * Try summarization with fallback models if the primary model fails
 * @param {string} prompt - The full prompt including comments
 * @returns {Promise<{summary: string, modelUsed: string}>} - The summary and model used
 */
async function analyzeWithFallback(prompt) {
  // Try the primary model first
  let primaryModel = "google/gemini-2.0-pro-exp-02-05:free";

  try {
    console.log(`🤖 Trying model: ${primaryModel}`);
    const summary = await askLLM(null, primaryModel, prompt, {
      title: 'HN Digest',
      parameters: { temperature: 0.1, max_tokens: 4000 }
    });

    return {
      summary,
      modelUsed: primaryModel
    };
  } catch (primaryError) {
    console.error(`⚠️ Primary model error: ${primaryError.message}`);
    console.log('Trying fallback models...');

    // Try each fallback model in sequence
    for (const fallbackModel of FALLBACK_MODELS) {
      try {
        console.log(`🤖 Trying fallback model: ${fallbackModel}`);
        const summary = await askLLM(null, fallbackModel, prompt, {
          title: 'HN Digest',
          parameters: { temperature: 0.1, max_tokens: 4000 }
        });

        return {
          summary,
          modelUsed: fallbackModel
        };
      } catch (fallbackError) {
        console.error(`⚠️ Fallback model error with ${fallbackModel}: ${fallbackError.message}`);
        // Continue to the next fallback model
      }
    }

    // If we get here, all models failed
    throw new Error('All models failed to generate an analysis');
  }
}

// Run the demo
hnSummaryDemo();

