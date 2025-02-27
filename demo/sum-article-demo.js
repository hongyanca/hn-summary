#!/usr/bin/env node

import { askLLM } from '../src/openrouterClient.js';
import fs from 'node:fs/promises';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

/**
 * Run the OpenRouter LLM demo with user input
 */
async function runOpenRouterDemo() {
  console.log('🤖 OpenRouter LLM API Demo');
  console.log('===========================');

  // Fixed model - no more CLI arguments
  // const model = 'google/gemini-2.0-flash-lite-preview-02-05:free';
  const model = 'google/gemini-2.0-pro-exp-02-05:free';
  console.log(`📌 Using Model: ${model}`);

  // Create readline interface for user input
  const rl = readline.createInterface({ input, output });

  try {
    // Prompt the user for input
    console.log('\n💬 Enter your prompt below (type on multiple lines, press Ctrl+D when finished):');

    let userPrompt = '';
    rl.on('line', (line) => {
      userPrompt += line + '\n';
    });

    // Wait for user to finish input (Ctrl+D)
    await new Promise(resolve => rl.once('close', resolve));

    // Trim any extra whitespace
    userPrompt = userPrompt.trim();

    // Validate input
    if (!userPrompt) {
      throw new Error('Prompt cannot be empty');
    }

    console.log('\n📝 Your prompt:');
    // console.log('--------------');
    // console.log(userPrompt);
    console.log('--------------');

    console.log('\n⏳ Generating response...');
    const startTime = performance.now();

    // Call the LLM with fixed settings
    const response = await askLLM(
      null, // Use environment variable
      model,
      userPrompt,
      {
        title: 'HN Digest',
        parameters: {
          temperature: 0.1,  // Low temperature for more deterministic output
          // This sets the upper limit for the number of tokens the model can
          // generate in response. It won’t produce more than this limit. The
          // maximum value is the context length minus the prompt length.
          max_tokens: 32768
        }
      }
    );

    const endTime = performance.now();
    console.log(`✅ Response received in ${(endTime - startTime).toFixed(2)}ms`);
    console.log('\n🔍 Response:');
    console.log('-------------');
    console.log(response);
    console.log('-------------');

    // Save the response to a file
    try {
      await fs.mkdir('output', { recursive: true });
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const fileName = `output/llm_response_${timestamp}.txt`;

      await fs.writeFile(fileName,
        // `Prompt:\n${userPrompt}\n\n` +
        // `Model: ${model}\n\n` +
        `Response:\n${response}\n`
      );

      console.log(`\n💾 Response saved to: ${fileName}`);
    } catch (error) {
      console.error(`\n⚠️ Couldn't save response: ${error.message}`);
    }

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);

    if (error.message.includes('API key')) {
      console.log('\n💡 Setup Instructions:');
      console.log('1. Get an API key from https://openrouter.ai');
      console.log('2. Set it as an environment variable: export OPENROUTER_API_KEY=your-key-here');  // Fixed typo
      console.log('   Or create a .env file in the project root with: OPENROUTER_API_KEY=your-key-here');  // Fixed typo
    }

    process.exit(1);
  }
}

// Run the demo
runOpenRouterDemo();

