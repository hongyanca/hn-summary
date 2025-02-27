#!/usr/bin/env node

import { extractComments, isPaywalled } from '../src/commentExtractor.js';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Demonstrate the comment extraction functionality
 * @param {string} url - Hacker News URL to extract comments from
 */
async function demonstrateExtraction(url) {
  console.log('\n📋 COMMENT EXTRACTION DEMO');
  console.log('----------------------------');
  console.log(`📌 Using URL: ${url}`);
  console.log('⏳ Fetching comments...');

  try {
    const startTime = performance.now();

    // Extract comments
    const markdownComments = await extractComments(url);

    const endTime = performance.now();
    console.log(`✅ Extraction completed in ${(endTime - startTime).toFixed(2)}ms`);
    console.log('----------------------------');

    // Display results
    console.log('📝 Extracted Comments (Markdown):');
    console.log(markdownComments);

    // Create output directory if it doesn't exist
    await fs.mkdir('output', { recursive: true });

    // Save to file
    const fileName = `output/hn_comments_${new Date().toISOString().replace(/[:.]/g, '-')}.md`;
    await fs.writeFile(fileName, markdownComments);
    console.log(`\n💾 Comments saved to: ${fileName}`);

    // Generate stats
    const commentCount = markdownComments.split('- ').length - 1;
    console.log(`\n📊 Stats: ${commentCount} comments extracted`);

  } catch (error) {
    console.error(`❌ Comment Extraction Error: ${error.message}`);
    return false;
  }

  return true;
}

/**
 * Demonstrate the paywall detection functionality
 * @param {string} url - Hacker News URL to check for paywall
 */
async function demonstratePaywallCheck(url) {
  console.log('\n🔍 PAYWALL DETECTION DEMO');
  console.log('----------------------------');
  console.log(`📌 Using URL: ${url}`);

  try {
    console.log('🕵️ Checking for paywall indicators...');
    const startTime = performance.now();

    // Check if likely paywalled
    const paywallCheck = await isPaywalled(url);

    const endTime = performance.now();
    console.log(`✅ Check completed in ${(endTime - startTime).toFixed(2)}ms`);
    console.log('----------------------------');

    // Display results
    if (paywallCheck.isPaywalled) {
      console.log('🔒 RESULT: Content appears to be paywalled');
      console.log(`💡 Archive link found: ${paywallCheck.url}`);

      // Save the archive link to a file
      await fs.mkdir('output', { recursive: true });
      const fileName = `output/archive_link_${new Date().toISOString().replace(/[:.]/g, '-')}.txt`;
      await fs.writeFile(fileName, `Original HN URL: ${url}\nArchive Link: ${paywallCheck.url}\n`);
      console.log(`\n💾 Archive link saved to: ${fileName}`);
    } else {
      console.log('🔓 RESULT: No paywall indicators found');
      console.log('💡 The content appears to be freely accessible');
    }
  } catch (error) {
    console.error(`❌ Paywall Check Error: ${error.message}`);
    return false;
  }

  return true;
}

/**
 * Main function to run the demo
 */
async function runDemo() {
  console.log('🚀 HN Comment Extractor Demo');
  console.log('===========================');

  // Get command line arguments
  const args = process.argv.slice(2);
  const command = args[0]?.toLowerCase() || 'all';
  const url = args[1] || 'https://news.ycombinator.com/item?id=43186406';

  if (!url.includes('news.ycombinator.com/item')) {
    console.error('❌ Error: Invalid Hacker News URL');
    console.log('Usage: node demo.js [all|extract|paywall] [url]');
    process.exit(1);
  }

  let success = true;

  // Run the requested demo(s)
  switch (command) {
    case 'extract':
      success = await demonstrateExtraction(url);
      break;

    case 'paywall':
      success = await demonstratePaywallCheck(url);
      break;

    case 'all':
    default:
      success = await demonstratePaywallCheck(url) && await demonstrateExtraction(url);
      break;
  }

  console.log('\n===========================');
  if (success) {
    console.log('✨ Demo completed successfully');
  } else {
    console.log('⚠️ Demo completed with errors');
    process.exit(1);
  }
}

// Run the demo
runDemo();

