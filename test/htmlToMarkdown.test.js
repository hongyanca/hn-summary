import assert from 'node:assert';
import { describe, it, beforeEach, afterEach } from 'node:test';
import { convertUrlToMarkdown, cleanupMarkdown, urlToCleanMarkdown } from '../src/htmlToMarkdown.js';

describe('HTML to Markdown Tests', async () => {
  // Original fetch function
  let originalFetch;

  beforeEach(() => {
    // Store the original fetch
    originalFetch = global.fetch;

    // Mock the fetch function
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
            <head>
              <title>Test Page Title</title>
              <meta name="description" content="This is a test page description">
              <link rel="canonical" href="https://example.com/canonical">
            </head>
            <body>
              <header>
                <nav>
                  <a href="/home">Home</a>
                  <a href="/about">About</a>
                  <a href="/contact">Contact</a>
                  <a href="/blog">Blog</a>
                  <a href="/products">Products</a>
                </nav>
              </header>
              <main>
                <h1>Welcome to Test Page</h1>
                <p>This is a <strong>test</strong> paragraph with <em>emphasis</em>.</p>
                <img src="/image.jpg" alt="Test Image">
                <h2>A Secondary Heading</h2>
                <ul>
                  <li>Item 1</li>
                  <li>Item 2</li>
                  <li>Item 3</li>
                </ul>
                <pre data-language="javascript">
                  function test() {
                    return 'Hello World';
                  }
                </pre>
              </main>
              <footer>
                <a href="/terms">Terms</a>
                <a href="/privacy">Privacy</a>
                <a href="/cookies">Cookies</a>
                <a href="/sitemap">Sitemap</a>
                <a href="/help">Help</a>
              </footer>
            </body>
          </html>
        `
      };
    };
  });

  afterEach(() => {
    // Restore the original fetch
    global.fetch = originalFetch;
  });

  it('should convert HTML to Markdown', async () => {
    const url = 'https://example.com/test';
    const result = await convertUrlToMarkdown(url);

    // Check metadata
    assert.strictEqual(result.title, 'Test Page Title');
    assert.strictEqual(result.metadata.description, 'This is a test page description');
    assert.strictEqual(result.metadata.canonicalUrl, 'https://example.com/canonical');
    assert.strictEqual(result.metadata.domain, 'example.com');

    // Check markdown content
    assert(result.markdown.includes('# Welcome to Test Page'));
    assert(result.markdown.includes('**test**'));
    assert(result.markdown.includes('*emphasis*'));
    assert(result.markdown.includes('![Test Image]'));
    assert(result.markdown.includes('## A Secondary Heading'));
    assert(result.markdown.includes('- Item 1'));
    assert(result.markdown.includes('```javascript'));
  });

  it('should exclude images when specified', async () => {
    const url = 'https://example.com/test';
    const result = await convertUrlToMarkdown(url, { includeImages: false });

    assert(!result.markdown.includes('![Test Image]'));
  });

  it('should remove specified elements', async () => {
    const url = 'https://example.com/test';
    const result = await convertUrlToMarkdown(url, {
      removeSelectors: ['header', 'footer']
    });

    assert(!result.markdown.includes('Home'));
    assert(!result.markdown.includes('Terms'));
    assert(result.markdown.includes('Welcome to Test Page')); // Content should still exist
  });

  it('should clean up markdown', () => {
    const markdown = `
    # Title
    
    
    
    Text here
    
    [Link 1](http://example.com)
    [Link 2](http://example.com)
    [Link 3](http://example.com)
    [Link 4](http://example.com)
    [Link 5](http://example.com)
    [Link 6](http://example.com)
    
    More content
    `;

    const cleaned = cleanupMarkdown(markdown, { title: 'Ignored Title' });

    // Should remove excessive newlines
    assert(!cleaned.includes('\n\n\n'));

    // Should remove consecutive links
    assert(!cleaned.includes('[Link 6]'));

    // Shouldn't add title since there's already a heading
    assert(!cleaned.startsWith('# Ignored Title\n\n# Title'));
  });

  it('should add title when missing', () => {
    const markdown = `Text here without heading`;

    const cleaned = cleanupMarkdown(markdown, {
      title: 'Added Title',
      addTitleHeading: true
    });

    assert(cleaned.startsWith('# Added Title'));
  });

  it('should provide a full pipeline', async () => {
    const url = 'https://example.com/test';
    const result = await urlToCleanMarkdown(url, {
      removeSelectors: ['footer'],
      removeConsecutiveLinks: true
    });

    // Should have title
    assert(result.markdown.includes('# Test Page Title'));

    // Should have cleaned up navigation links
    assert(!result.markdown.includes('Terms'));
  });

  it('should handle network errors', async () => {
    // Simulate network error
    global.fetch = async () => {
      throw new Error('Network failure');
    };

    try {
      await convertUrlToMarkdown('https://example.com/test');
      assert.fail('Expected an error but none was thrown');
    } catch (error) {
      assert.strictEqual(error.message, 'Error converting HTML to Markdown: Network failure');
    }
  });
});

