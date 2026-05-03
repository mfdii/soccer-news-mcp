#!/usr/bin/env node
import { ArticleRepository } from '../src/database/repositories/ArticleRepository.js';
import { EmbeddingService } from '../src/services/EmbeddingService.js';
import { logger } from '../src/utils/logger.js';
import { closePool } from '../src/database/client.js';

async function rebuildEmbeddings(): Promise<void> {
  const articleRepo = new ArticleRepository();
  const embeddingService = new EmbeddingService();

  try {
    await embeddingService.initialize();
    logger.info('Embedding service initialized');

    const articles = await articleRepo.findWithoutEmbeddings(1000);
    logger.info('Found articles without embeddings', { count: articles.length });

    if (articles.length === 0) {
      logger.info('No articles need embeddings');
      return;
    }

    let processed = 0;
    for (const article of articles) {
      try {
        const text = embeddingService.prepareTextForEmbedding(
          article.title,
          article.content || article.summary
        );

        const result = await embeddingService.generateEmbedding(text);
        await articleRepo.updateEmbedding(article.id, result.embedding);

        processed++;

        if (processed % 10 === 0) {
          logger.info('Progress', { processed, total: articles.length });
        }
      } catch (error) {
        logger.error('Failed to generate embedding', {
          articleId: article.id,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Embedding rebuild completed', {
      processed,
      total: articles.length,
    });
  } catch (error) {
    logger.error('Rebuild failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await closePool();
  }
}

rebuildEmbeddings().catch((error) => {
  console.error('Rebuild error:', error);
  process.exit(1);
});
