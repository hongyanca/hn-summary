import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { extractComments } from '../src/commentExtractor.js';

// Mock global fetch
describe('Comment Extractor Tests', async () => {
  // Original fetch function
  let originalFetch;

  beforeEach(() => {
    // Store the original fetch
    originalFetch = global.fetch;

    // Sample HTML content for testing
    const mockHtml = `
    <!DOCTYPE html>
    <html>
      <body>
        <div class="commtext">This is comment 1</div>
        <div>Not a comment</div>
        <div class="commtext">This is comment 2 with
        multiple lines</div>
        <div class="commtext">This is comment 3</div>
      </body>
    </html>
    `;

    // Mock the fetch function
    global.fetch = async () => {
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        text: async () => mockHtml
      };
    };
  });

  afterEach(() => {
    // Restore the original fetch
    global.fetch = originalFetch;
  });

  it('should extract comments and format them as markdown bullet points', async () => {
    const url = 'https://news.ycombinator.com/item?id=43186406';
    const result = await extractComments(url);

    const expected = `- This is comment 1
- This is comment 2 with
  multiple lines
- This is comment 3`;

    assert.strictEqual(result, expected);
  });

  it('should throw an error for invalid URLs', async () => {
    try {
      await extractComments('https://example.com');
      assert.fail('Expected an error but none was thrown');
    } catch (error) {
      assert.strictEqual(error.message, 'Error extracting comments: Invalid Hacker News URL');
    }
  });
});

// Run the tests
console.log('Running tests...');

