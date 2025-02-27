#!/usr/bin/env node

import { fetchHackerNewsPostsAdvanced } from '../src/hackerNewsApi.js';
import fs from 'node:fs/promises';
import path from 'node:path';

/**
 * Demonstrate the Hacker News API functionality
 * Shows top 10 posts from the past 24 hours
 */
async function hackerNewsRecentTopDemo() {
  console.log('🔥 Hacker News Top Recent Posts Demo');
  console.log('===================================');

  try {
    // Calculate timestamp from 24 hours ago
    const oneDayAgo = new Date();
    oneDayAgo.setHours(oneDayAgo.getHours() - 24);
    const oneDayAgoTimestamp = oneDayAgo.toISOString();

    console.log(`⏳ Fetching top posts from the past 24 hours...`);
    console.log(`   (Since ${new Date(oneDayAgoTimestamp).toLocaleString()})`);

    const startTime = performance.now();

    // Use the advanced function with better error handling and rate limiting
    const allPosts = await fetchHackerNewsPostsAdvanced({
      count: 100, // Fetch more posts initially since we'll filter by date
      delayBetweenRequests: 50
    });

    // Filter for posts from the last 24 hours
    const recentPosts = allPosts.filter(post =>
      post.createdAt >= oneDayAgoTimestamp
    );

    // Sort by points (high to low) and take top 10
    const top10Recent = recentPosts
      .sort((a, b) => b.points - a.points)
      .slice(0, 10);

    const endTime = performance.now();
    console.log(`✅ Found ${recentPosts.length} posts from the last 24 hours`);
    console.log(`   Showing top 10 by points (${(endTime - startTime).toFixed(0)}ms)`);

    // Show top 10 recent posts
    console.log('\n🏆 Top 10 Posts (Past 24 Hours):');
    top10Recent.forEach((post, index) => {
      const postDate = new Date(post.createdAt);
      const hoursAgo = Math.round((Date.now() - postDate.getTime()) / 36000) / 10;

      console.log(`\n#${index + 1}: ${post.articleTitle}`);
      console.log(`   📊 ${post.points} points | 💬 ${post.commentsCount || 0} comments | 👤 ${post.author || 'anonymous'}`);
      console.log(`   🔗 ${post.articleLink}`);
      console.log(`   💬 ${post.commentsLink}`);
      console.log(`   🕒 ${hoursAgo} hours ago`);
    });

    // Save results to file
    await fs.mkdir('output', { recursive: true });
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const fileName = `output/hn_recent_top_posts_${timestamp}.json`;

    await fs.writeFile(
      fileName,
      JSON.stringify(top10Recent, null, 2)
    );

    console.log(`\n💾 Posts saved to: ${fileName}`);

    // Create a simple HTML report
    const htmlReport = `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Hacker News Top Recent Posts</title>
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; max-width: 800px; margin: 0 auto; padding: 20px; }
        h1 { color: #ff6600; }
        .post { border-bottom: 1px solid #eee; padding: 15px 0; }
        .title { font-size: 18px; font-weight: bold; margin-bottom: 5px; }
        .meta { color: #666; font-size: 14px; }
        .link { color: #0366d6; text-decoration: none; }
        .link:hover { text-decoration: underline; }
        .header { background: #f6f8fa; padding: 15px; border-radius: 5px; margin: 20px 0; }
      </style>
    </head>
    <body>
      <h1>Hacker News Top Recent Posts</h1>
      
      <div class="header">
        <p>Top 10 posts from the past 24 hours (by points)</p>
        <p>Generated on ${new Date().toLocaleString()}</p>
      </div>
      
      <h2>Posts</h2>
      ${top10Recent.map((post, i) => {
      const postDate = new Date(post.createdAt);
      const hoursAgo = Math.round((Date.now() - postDate.getTime()) / 36000) / 10;

      return `
        <div class="post">
          <div class="title">${i + 1}. <a class="link" href="${post.articleLink}" target="_blank">${post.articleTitle}</a></div>
          <div class="meta">
            ${post.points} points | 
            <a class="link" href="${post.commentsLink}" target="_blank">${post.commentsCount || 0} comments</a> | 
            by ${post.author || 'anonymous'} | 
            ${hoursAgo} hours ago
          </div>
        </div>
      `}).join('')}
      
      <footer>
        <p><small>Data from Hacker News API - Posts from the past 24 hours only</small></p>
      </footer>
    </body>
    </html>
    `;

    const htmlFileName = `output/hn_recent_top_${timestamp}.html`;
    await fs.writeFile(htmlFileName, htmlReport);
    console.log(`📊 HTML report saved to: ${htmlFileName}`);

  } catch (error) {
    console.error(`\n❌ Error: ${error.message}`);
    process.exit(1);
  }
}

// Run the demo
hackerNewsRecentTopDemo();

