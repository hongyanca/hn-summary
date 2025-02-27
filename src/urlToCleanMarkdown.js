/**
 * URL to Clean Markdown converter
 * Uses native Node.js fetch and Turndown library
 */

import TurndownService from 'turndown';
import { JSDOM } from 'jsdom';

/**
 * Convert the HTML content of a URL to Markdown
 * 
 * @param {string} url - The URL to fetch and convert to Markdown
 * @param {Object} [options] - Additional options for the conversion
 * @param {boolean} [options.includeImages=true] - Whether to include image references in the Markdown
 * @param {boolean} [options.cleanupWhitespace=true] - Whether to clean up excessive whitespace
 * @param {string[]} [options.removeSelectors=[]] - CSS selectors for elements to remove before conversion
 * @returns {Promise<Object>} - Object containing the markdown, title, and metadata
 */
export async function convertUrlToMarkdown(url, options = {}) {
  // Default options
  const settings = {
    includeImages: true,
    cleanupWhitespace: true,
    removeSelectors: [],
    ...options
  };

  try {
    // Validate URL
    const urlObj = new URL(url);

    // Fetch the webpage with a realistic user agent
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      },
      redirect: 'follow'
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    // Get the HTML content
    const html = await response.text();

    // Create a DOM from the HTML
    const dom = new JSDOM(html);
    const document = dom.window.document;

    // Extract metadata
    const title = document.querySelector('title')?.textContent || '';
    const metaDescription = document.querySelector('meta[name="description"]')?.getAttribute('content') || '';
    const canonicalUrl = document.querySelector('link[rel="canonical"]')?.getAttribute('href') || url;

    // Apply pre-processing if needed (remove unwanted elements)
    if (settings.removeSelectors.length > 0) {
      settings.removeSelectors.forEach(selector => {
        document.querySelectorAll(selector).forEach(el => {
          el.remove();
        });
      });
    }

    // Create a new TurndownService instance
    const turndownService = new TurndownService({
      headingStyle: 'atx', // Use # style headings
      hr: '---', // Use --- for horizontal rules
      bulletListMarker: '-', // Use - for bullet lists
      codeBlockStyle: 'fenced', // Use ``` style code blocks
      emDelimiter: '*' // Use * for emphasis
    });

    // Configure Turndown based on options
    if (!settings.includeImages) {
      turndownService.remove('img');
    }

    // Add special rule for pre tags to maintain code formatting
    turndownService.addRule('pre', {
      filter: ['pre'],
      replacement: function (content, node) {
        const language = node.getAttribute('data-language') ||
          node.className.match(/language-(\w+)/) ?
          node.className.match(/language-(\w+)/)[1] : '';
        return `\n\n\`\`\`:markdown-math{single="true" encoded="%7Blanguage%7D%5Cn"}{content}\n\`\`\`\n\n`;
      }
    });

    // Convert HTML to Markdown
    let markdown = turndownService.turndown(document.body);

    // Post-processing
    if (settings.cleanupWhitespace) {
      // Replace multiple empty lines with a single empty line
      markdown = markdown.replace(/\n{3,}/g, '\n\n');
      // Remove whitespace at the beginning and end
      markdown = markdown.trim();
    }

    // Return the markdown along with metadata
    return {
      title,
      markdown,
      metadata: {
        description: metaDescription,
        canonicalUrl,
        convertedAt: new Date().toISOString(),
        sourceUrl: url,
        domain: urlObj.hostname,
      }
    };
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out');
    }
    throw new Error(`Error converting HTML to Markdown: ${error.message}`);
  }
}

/**
 * Clean up a Markdown document with additional refinements
 * 
 * @param {string} markdown - The markdown content to clean up
 * @param {Object} [options] - Options for cleaning
 * @param {boolean} [options.removeConsecutiveLinks=true] - Remove consecutive links that likely represent navbars or footers
 * @param {boolean} [options.addTitleHeading=true] - Add the page title as a level 1 heading if not present
 * @param {string} [options.title] - The title to use if addTitleHeading is true
 * @returns {string} - Cleaned up markdown
 */
export function cleanupMarkdown(markdown, options = {}) {
  const settings = {
    removeConsecutiveLinks: true,
    addTitleHeading: true,
    title: null,
    ...options
  };

  let cleanMarkdown = markdown;

  // Remove sections with many consecutive links (likely navigation or footer)
  if (settings.removeConsecutiveLinks) {
    // Pattern to find sections with many consecutive links (likely nav/footer)
    const consecutiveLinksPattern = /(:markdown-math{block="true" encoded=".*%3F"}:markdown-math{encoded=".*%3F"}[\s\n]*){5,}/g;
    cleanMarkdown = cleanMarkdown.replace(consecutiveLinksPattern, '\n\n');
  }

  // Add title as heading if needed
  if (settings.addTitleHeading && settings.title) {
    // Only add if there isn't already a level 1 heading at the start
    if (!cleanMarkdown.trim().startsWith('# ')) {
      cleanMarkdown = `# ${settings.title}\n\n${cleanMarkdown}`;
    }
  }

  // Final cleanup
  return cleanMarkdown.trim();
}

/**
 * Special handler for archive.is URLs
 * 
 * @param {string} url - The archive.is URL to process
 * @param {Object} [options] - Conversion options
 * @returns {Promise<Object>} - Object containing the cleaned markdown and metadata
 */
export async function processArchiveIsUrl(url, options = {}) {
  try {
    // Verify it's an archive.is URL
    if (!url.includes('archive.is/') && !url.includes('archive.ph/') && !url.includes('archive.today/')) {
      throw new Error('Not an archive.is/ph/today URL');
    }

    // Default options specifically for archive.is
    const archiveOptions = {
      removeSelectors: [
        '#HEADER',
        '#FOOTER',
        '#TOOLS',
        '.NavigationBar',
        '[id^="readability"]', // Remove readability elements
        'script',
        'style',
        'iframe',
        '.toolbar',
        '#wm-ipp-base', // Wayback machine toolbar
        '#wm-ipp',
        '#donato',
        '#ad_top',
        ...options.removeSelectors || []
      ],
      ...options
    };

    // Get the content
    const result = await convertUrlToMarkdown(url, archiveOptions);

    // For archive.is, extract the original URL and title more carefully
    let originalUrl = '';
    let originalTitle = result.title;

    // Archive.is usually includes the original URL in the title
    if (originalTitle.includes(' |') || originalTitle.includes(' - ')) {
      // Try to extract a cleaner title
      const titleParts = originalTitle.split(/\s[|\-]\s/);
      if (titleParts.length > 1) {
        originalTitle = titleParts[0].trim();
      }
    }

    // Clean up the markdown
    const cleanMarkdown = cleanupMarkdown(result.markdown, {
      ...options,
      title: originalTitle
    });

    return {
      ...result,
      markdown: cleanMarkdown,
      metadata: {
        ...result.metadata,
        originalUrl,
        isArchive: true,
        archiveType: 'archive.is'
      }
    };
  } catch (error) {
    throw new Error(`Error processing archive.is URL: ${error.message}`);
  }
}

/**
 * Full pipeline to convert a URL to clean Markdown
 * 
 * @param {string} url - The URL to convert
 * @param {Object} [options] - Options for the conversion and cleanup
 * @returns {Promise<Object>} - Object containing the clean markdown and metadata
 */
export async function urlToCleanMarkdown(url, options = {}) {
  // Handle special cases
  if (url.includes('archive.is/') || url.includes('archive.ph/') || url.includes('archive.today/')) {
    return processArchiveIsUrl(url, options);
  }

  // Standard conversion for other URLs
  const result = await convertUrlToMarkdown(url, options);

  // Clean up the markdown
  const cleanMarkdown = cleanupMarkdown(result.markdown, {
    ...options,
    title: result.title
  });

  return {
    ...result,
    markdown: cleanMarkdown
  };
}

// Export default function for simplicity
export default urlToCleanMarkdown;

