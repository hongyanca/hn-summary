#!/usr/bin/env node

import { urlToCleanMarkdown } from '../src/urlToCleanMarkdown.js';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Special demo to convert an archive.is page to Markdown
 */
async function archiveToMarkdownDemo() {
  console.log('📑 Archive.is to Markdown Converter Demo');
  console.log('========================================');

  // Default URL from the request
  const url = process.argv[2] || 'https://archive.is/eRc3M';
  console.log(`📌 Processing URL: ${url}`);

  try {
    console.log('⏳ Fetching and converting...');
    const startTime = performance.now();

    // Convert the URL to Markdown with special handling for archive.is
    const result = await urlToCleanMarkdown(url, {
      removeSelectors: [
        // Archive.is specific selectors
        '#HEADER',
        '#FOOTER',
        '#TOOLS',
        '.NavigationBar',

        // Common elements to remove
        'header',
        'nav',
        'footer',
        'figure',
        'img',
        'a',
        '.header',
        '.footer',
        '.navigation',
        '.sidebar',
        '.ads',
        '.cookie-notice',
        '.subscription-prompt',
        '.paywall',
        '.social-share',
        '.related-articles',
        '#comments',
        '.comments',

        // Technical elements
        'script',
        'style',
        'noscript',
        'iframe',
        'svg'
      ],
      includeImages: false,
      cleanupWhitespace: true,
      removeConsecutiveLinks: true,
      addTitleHeading: false
    });

    const endTime = performance.now();
    console.log(`✅ Conversion completed in ${(endTime - startTime).toFixed(2)}ms`);

    // Create output directory if it doesn't exist
    await fs.mkdir('output', { recursive: true });

    // Create output filename from URL and timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const urlSegment = new URL(url).pathname
      .replace(/^\//, '')  // Remove leading slash
      .replace(/\//g, '_') // Replace remaining slashes
      .substring(0, 20);   // Limit length

    const fileName = `output/archive-${urlSegment}-${timestamp}.md`;
    await fs.writeFile(fileName, result.markdown);

    console.log('\n📝 Conversion Summary:');
    console.log(`- Title: ${result.title}`);
    console.log(`- Archive Domain: ${result.metadata.domain}`);
    console.log(`- Conversion Time: ${new Date(result.metadata.convertedAt).toLocaleString()}`);
    console.log(`- Markdown Length: ${result.markdown.length} characters`);
    console.log(`\n💾 Markdown saved to: ${fileName}`);

    // Show preview
    console.log('\n📄 Markdown Preview (first 500 chars):');
    console.log('-'.repeat(50));
    console.log(result.markdown.substring(0, 500) + '...');
    console.log('-'.repeat(50));

    // If you want to automatically open the file in some environments
    console.log('\n💡 You can view the full markdown file in your editor of choice.');

  } catch (error) {
    console.error(`❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the demo
archiveToMarkdownDemo();

