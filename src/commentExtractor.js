import * as cheerio from 'cheerio';

// List of known paywalled sites
export const KNOWN_PAYWALLED_SITES = [
  'bloomberg.com',
  'wsj.com',
  'ft.com',
  'nytimes.com',
  'newyorker.com',
  'economist.com',
  'washingtonpost.com',
  'wired.com',
  'medium.com',
  'businessinsider.com',
  'theatlantic.com',
  'forbes.com',
  'thetimes.co.uk',
  'telegraph.co.uk',
  'latimes.com',
  'hbr.org',
  'technologyreview.com',
  'barrons.com',
  'theinformation.com',
  'seekingalpha.com'
];

/**
 * Check if a Hacker News thread contains archive links suggesting the original article might be paywalled
 * 
 * @param {string} url - Hacker News comment page URL
 * @returns {Promise<Object>} - Object containing isPaywalled status, archive URL if found, and site info
 */
export async function isPaywalled(url) {
  try {
    // Validate URL
    if (!url || !url.includes('news.ycombinator.com/item')) {
      throw new Error('Invalid Hacker News URL');
    }

    // Fetch the page with timeout
    let response;
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      response = await fetch(url, {
        signal: controller.signal,
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
        }
      });

      clearTimeout(timeoutId);
    } catch (error) {
      if (error.name === 'AbortError') {
        throw new Error('Request timed out after 10 seconds');
      }
      throw new Error(`Network error: ${error.message}`);
    }

    if (!response.ok) {
      throw new Error(`HTTP error: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Load HTML with Cheerio
    const $ = cheerio.load(html);

    // Extract the site domain from sitestr
    let siteDomain = '';
    const sitestrElement = $('.sitestr').first();
    if (sitestrElement.length) {
      siteDomain = sitestrElement.text().trim().toLowerCase();
    }

    // Determine if this is a known paywalled site
    const isKnownPaywalledSite = KNOWN_PAYWALLED_SITES.some(site =>
      siteDomain.includes(site)
    );

    // Set search depth based on whether it's a known paywalled site
    // For known paywalled sites, check all comments
    // For other sites, check first 20 comments
    const maxCommentsToCheck = isKnownPaywalledSite ?
      Number.MAX_SAFE_INTEGER : 20;

    // Get the comments to check
    const commentElements = $('.commtext').slice(0, maxCommentsToCheck);
    let archiveUrl = '';
    let found = false;

    // Check each comment for archive links
    commentElements.each((_, element) => {
      if (found) return; // Skip if we already found an archive link

      const $element = $(element);
      const links = $element.find('a');
      const textNodes = $element.contents().filter(function () {
        return this.type === 'text';
      });

      // For known paywalled sites, be more aggressive - look for any archive link
      // For other sites, only consider comments with minimal text (likely just a link)
      const shouldCheckLinks = isKnownPaywalledSite ||
        textNodes.text().trim().length < 15;

      if (links.length > 0 && shouldCheckLinks) {
        // Look for archive links
        links.each((_, link) => {
          if (found) return; // Skip if we already found an archive link

          const href = $(link).attr('href');
          if (href &&
            (href.toLowerCase().includes('archive') ||
              href.toLowerCase().includes('12ft.io') ||
              href.toLowerCase().includes('outline.com') ||
              href.toLowerCase().includes('webcache.googleusercontent.com'))) {
            archiveUrl = href;
            found = true;
          }
        });
      }
    });

    return {
      url: archiveUrl,
      isPaywalled: found || isKnownPaywalledSite,
      site: siteDomain,
      knownPaywalledSite: isKnownPaywalledSite
    };

  } catch (error) {
    throw new Error(`Error checking for paywall: ${error.message}`);
  }
}

/**
 * Extract comments from a Hacker News URL and convert to a Markdown bullet list
 * @param {string} url - Hacker News comment page URL
 * @returns {Promise<string>} - Markdown formatted bullet list of comments
 */
export async function extractComments(url) {
  try {
    // Validate URL
    if (!url || !url.includes('news.ycombinator.com/item')) {
      throw new Error('Invalid Hacker News URL');
    }

    // Fetch the page
    const response = await fetch(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.status} ${response.statusText}`);
    }

    const html = await response.text();

    // Load HTML with Cheerio
    const $ = cheerio.load(html);

    // Extract comments from the page
    const comments = [];
    $('.commtext').each((_, element) => {
      // Get the text content and trim whitespace
      const commentText = $(element).text().trim();

      // Only add non-empty comments
      if (commentText) {
        comments.push(commentText);
      }
    });

    if (comments.length === 0) {
      return "No comments found on this page.";
    }

    // Format as Markdown bullet list
    const markdownList = comments
      .map(comment => `- ${comment.replace(/\n/g, '\n  ')}`)
      .join('\n');

    return markdownList;
  } catch (error) {
    throw new Error(`Error extracting comments: ${error.message}`);
  }
}

