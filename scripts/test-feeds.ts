#!/usr/bin/env node
import Parser from 'rss-parser';
import { DEFAULT_FEEDS } from '../src/config/feeds.js';
import { logger } from '../src/utils/logger.js';

async function testFeed(name: string, url: string): Promise<void> {
  const parser = new Parser({ timeout: 10000 });

  try {
    console.error(`Testing ${name}...`);
    const feed = await parser.parseURL(url);

    console.error(`  Title: ${feed.title}`);
    console.error(`  Items: ${feed.items.length}`);

    if (feed.items.length > 0) {
      const item = feed.items[0];
      console.error(`  Latest: ${item.title}`);
      console.error(`  Published: ${item.pubDate}`);
    }

    console.error(`  ✓ Success\n`);
  } catch (error) {
    console.error(`  ✗ Failed: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}

async function testAllFeeds(): Promise<void> {
  console.error('Testing all RSS feeds...\n');

  for (const feed of DEFAULT_FEEDS) {
    await testFeed(feed.name, feed.rssUrl);
  }

  console.error('Feed testing completed');
}

testAllFeeds().catch((error) => {
  console.error('Test error:', error);
  process.exit(1);
});
