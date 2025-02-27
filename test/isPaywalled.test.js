import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { isPaywalled, KNOWN_PAYWALLED_SITES } from '../src/commentExtractor.js';

describe('isPaywalled Tests with Updated Settings', async () => {
  // Original fetch function
  let originalFetch;

  beforeEach(() => {
    // Store the original fetch
    originalFetch = global.fetch;
  });

  afterEach(() => {
    // Restore the original fetch
    global.fetch = originalFetch;
  });

  it('should detect archive links in comments', async () => {
    // Mock HTML with archive links
    global.fetch = async (url, options) => {
      // Verify correct user agent is being used
      assert.strictEqual(
        options.headers['User-Agent'],
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/133.0.0.0 Safari/537.36'
      );

      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => `
          <!DOCTYPE html>
          <html>
            <body>
              <span class="sitestr">example.com</span>
              <div class="commtext">This is a normal comment with no archive link.</div>
              <div class="commtext">
                <a href="https://example.com">Not an archive link</a>
              </div>
              <div class="commtext">
                <a href="https://archive.is/abcde">Archive link here</a>
              </div>
            </body>
          </html>
        `
      };
    };

    const url = 'https://news.ycombinator.com/item?id=43186050';
    const result = await isPaywalled(url);

    assert.strictEqual(result.isPaywalled, true);
    assert.strictEqual(result.url, 'https://archive.is/abcde');
    assert.strictEqual(result.site, 'example.com');
    assert.strictEqual(result.knownPaywalledSite, false);
  });

  it('should identify known paywalled sites even without archive links', async () => {
    // Mock HTML with a known paywalled site but no archive links
    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => `
          <!DOCTYPE html>
          <html>
            <body>
              <span class="sitestr">nytimes.com</span>
              <div class="commtext">This is just a normal comment.</div>
              <div class="commtext">Another comment with <a href="https://example.com">regular link</a>.</div>
            </body>
          </html>
        `
      };
    };

    const url = 'https://news.ycombinator.com/item?id=12345678';
    const result = await isPaywalled(url);

    assert.strictEqual(result.isPaywalled, true);
    assert.strictEqual(result.url, '');
    assert.strictEqual(result.site, 'nytimes.com');
    assert.strictEqual(result.knownPaywalledSite, true);
  });

  it('should search all comments for archive links on known paywalled sites', async () => {
    // Mock HTML with a known paywalled site and an archive link in a later comment
    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => {
          // Create 30 regular comments
          let comments = '';
          for (let i = 0; i < 30; i++) {
            comments += `<div class="commtext">Regular comment ${i}</div>`;
          }

          // Then add a comment with an archive link
          comments += `<div class="commtext">Here's the <a href="https://archive.is/bloomberg-article">archive link</a> for those who need it.</div>`;

          return `
            <!DOCTYPE html>
            <html>
              <body>
                <span class="sitestr">bloomberg.com</span>
                ${comments}
              </body>
            </html>
          `;
        }
      };
    };

    const url = 'https://news.ycombinator.com/item?id=12345678';
    const result = await isPaywalled(url);

    assert.strictEqual(result.isPaywalled, true);
    assert.strictEqual(result.url, 'https://archive.is/bloomberg-article');
    assert.strictEqual(result.site, 'bloomberg.com');
    assert.strictEqual(result.knownPaywalledSite, true);
  });

  it('should check up to 20 comments for non-paywalled sites', async () => {
    // Mock HTML with an unknown site and an archive link in the 15th comment (within 20)
    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => {
          // Create 30 regular comments
          let comments = '';
          for (let i = 0; i < 30; i++) {
            comments += `<div class="commtext">Regular comment ${i}</div>`;
          }

          // Add a comment with an archive link as the 15th comment
          comments = comments.replace('Regular comment 14', 'Here\'s the <a href="https://archive.is/article">archive link</a>');

          return `
            <!DOCTYPE html>
            <html>
              <body>
                <span class="sitestr">example.com</span>
                ${comments}
              </body>
            </html>
          `;
        }
      };
    };

    const url = 'https://news.ycombinator.com/item?id=12345678';
    const result = await isPaywalled(url);

    // Should find the archive link because it's within the first 20 comments
    assert.strictEqual(result.isPaywalled, true);
    assert.strictEqual(result.url, 'https://archive.is/article');
    assert.strictEqual(result.site, 'example.com');
    assert.strictEqual(result.knownPaywalledSite, false);
  });

  it('should not find archive links beyond 20 comments for non-paywalled sites', async () => {
    // Mock HTML with an unknown site and an archive link in the 25th comment (beyond 20)
    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => {
          // Create 30 regular comments
          let comments = '';
          for (let i = 0; i < 30; i++) {
            comments += `<div class="commtext">Regular comment ${i}</div>`;
          }

          // Add a comment with an archive link as the 25th comment
          comments = comments.replace('Regular comment 24', 'Here\'s the <a href="https://archive.is/article">archive link</a>');

          return `
            <!DOCTYPE html>
            <html>
              <body>
                <span class="sitestr">example.com</span>
                ${comments}
              </body>
            </html>
          `;
        }
      };
    };

    const url = 'https://news.ycombinator.com/item?id=12345678';
    const result = await isPaywalled(url);

    // Should NOT find the archive link because it's beyond the first 20 comments
    assert.strictEqual(result.isPaywalled, false);
    assert.strictEqual(result.url, '');
    assert.strictEqual(result.site, 'example.com');
    assert.strictEqual(result.knownPaywalledSite, false);
  });

  it('should verify KNOWN_PAYWALLED_SITES is exported as a constant', () => {
    // Check that KNOWN_PAYWALLED_SITES exists and is an array
    assert(Array.isArray(KNOWN_PAYWALLED_SITES));

    // Check it contains the expected sites
    assert(KNOWN_PAYWALLED_SITES.includes('nytimes.com'));
    assert(KNOWN_PAYWALLED_SITES.includes('bloomberg.com'));
    assert(KNOWN_PAYWALLED_SITES.length > 5); // Should have multiple entries
  });

  it('should throw an error for invalid URLs', async () => {
    try {
      await isPaywalled('https://example.com');
      assert.fail('Expected an error but none was thrown');
    } catch (error) {
      assert.strictEqual(error.message, 'Error checking for paywall: Invalid Hacker News URL');
    }
  });

  it('should handle network errors properly', async () => {
    // Simulate network error
    global.fetch = async () => {
      throw new Error('Network failure');
    };

    try {
      await isPaywalled('https://news.ycombinator.com/item?id=12345678');
      assert.fail('Expected an error but none was thrown');
    } catch (error) {
      assert.strictEqual(error.message, 'Error checking for paywall: Network error: Network failure');
    }
  });

  it('should handle HTTP errors properly', async () => {
    // Simulate HTTP error
    global.fetch = async () => {
      return {
        ok: false,
        status: 404,
        statusText: 'Not Found'
      };
    };

    try {
      await isPaywalled('https://news.ycombinator.com/item?id=12345678');
      assert.fail('Expected an error but none was thrown');
    } catch (error) {
      assert.strictEqual(error.message, 'Error checking for paywall: HTTP error: 404 Not Found');
    }
  });
});

