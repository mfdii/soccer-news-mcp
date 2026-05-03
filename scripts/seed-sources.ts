#!/usr/bin/env node
import { SourceRepository } from '../src/database/repositories/SourceRepository.js';
import { DEFAULT_FEEDS } from '../src/config/feeds.js';
import { logger } from '../src/utils/logger.js';
import { closePool } from '../src/database/client.js';

async function seedSources(): Promise<void> {
  const sourceRepo = new SourceRepository();

  try {
    logger.info('Seeding RSS sources', { count: DEFAULT_FEEDS.length });

    for (const feed of DEFAULT_FEEDS) {
      try {
        const existing = await sourceRepo.findByUrl(feed.rssUrl);
        if (existing) {
          logger.info('Source already exists, skipping', { name: feed.name });
          continue;
        }

        await sourceRepo.create(feed.name, feed.rssUrl, feed.category);
        logger.info('Source created', { name: feed.name });
      } catch (error) {
        logger.error('Failed to create source', {
          name: feed.name,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Source seeding completed');
  } catch (error) {
    logger.error('Seeding failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await closePool();
  }
}

seedSources().catch((error) => {
  console.error('Seeding error:', error);
  process.exit(1);
});
