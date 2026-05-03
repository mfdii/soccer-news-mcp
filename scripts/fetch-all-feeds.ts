#!/usr/bin/env tsx
/**
 * Fetch all active RSS feeds and store articles with embeddings
 * Used by: CronJob for periodic updates, one-time backfill Job
 */

import { getPool, closePool } from '../src/database/client.js';
import { SourceRepository } from '../src/database/repositories/SourceRepository.js';
import { ArticleRepository } from '../src/database/repositories/ArticleRepository.js';
import { RSSFetcherService } from '../src/services/RSSFetcherService.js';
import { EmbeddingService } from '../src/services/EmbeddingService.js';
import { logger } from '../src/utils/logger.js';

async function main() {
  const maxArticlesPerSource = parseInt(process.env.MAX_ARTICLES_PER_SOURCE || '50');
  const skipEmbeddings = process.env.SKIP_EMBEDDINGS === 'true';

  try {
    logger.info('Starting feed fetch job', { maxArticlesPerSource, skipEmbeddings });

    // Initialize database
    const pool = getPool();
    await pool.query('SELECT 1');
    logger.info('Database connected');

    // Initialize services
    const sourceRepo = new SourceRepository();
    const articleRepo = new ArticleRepository();
    const rssFetcher = new RSSFetcherService(sourceRepo, articleRepo);
    const embeddingService = new EmbeddingService();

    if (!skipEmbeddings) {
      await embeddingService.initialize();
      logger.info('Embedding service initialized');
    }

    // Fetch all active feeds
    const results = await rssFetcher.fetchMultipleFeeds(undefined, maxArticlesPerSource);

    // Generate embeddings for new articles
    if (!skipEmbeddings) {
      const articlesWithoutEmbeddings = await articleRepo.findWithoutEmbeddings(1000);

      if (articlesWithoutEmbeddings.length > 0) {
        logger.info('Generating embeddings for new articles', {
          count: articlesWithoutEmbeddings.length
        });

        for (const article of articlesWithoutEmbeddings) {
          const text = `${article.title} ${article.summary || article.content || ''}`;
          const result = await embeddingService.generateEmbedding(text);
          await articleRepo.updateEmbedding(article.id, result.embedding);
        }

        logger.info('Embeddings generated', { count: articlesWithoutEmbeddings.length });
      }
    }

    // Log results
    const totalProcessed = results.reduce((sum, r) => sum + r.articlesProcessed, 0);
    const totalSaved = results.reduce((sum, r) => sum + r.articlesSaved, 0);
    const totalErrors = results.reduce((sum, r) => sum + r.errors.length, 0);

    logger.info('Feed fetch job completed', {
      sources: results.length,
      totalProcessed,
      totalSaved,
      totalErrors,
    });

    // Print summary
    console.log('\n=== Feed Fetch Summary ===');
    console.log(`Sources processed: ${results.length}`);
    console.log(`Articles processed: ${totalProcessed}`);
    console.log(`Articles saved: ${totalSaved}`);
    console.log(`Errors: ${totalErrors}`);
    console.log('\nPer-source results:');

    results.forEach(r => {
      const status = r.errors.length > 0 ? '⚠️' : '✅';
      console.log(`  ${status} ${r.sourceName}: ${r.articlesSaved}/${r.articlesProcessed} saved`);
      if (r.errors.length > 0) {
        r.errors.forEach(err => console.log(`     Error: ${err}`));
      }
    });

    await closePool();
    process.exit(0);
  } catch (error) {
    logger.error('Feed fetch job failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    console.error('Fatal error:', error);
    await closePool();
    process.exit(1);
  }
}

main();
