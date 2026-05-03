import { z } from 'zod';
import { RSSFetcherService } from '../services/RSSFetcherService.js';
import { EmbeddingService } from '../services/EmbeddingService.js';
import { ArticleRepository } from '../database/repositories/ArticleRepository.js';
import { logger } from '../utils/logger.js';

const FetchFeedsSchema = z.object({
  sourceIds: z.array(z.number()).optional(),
  maxArticlesPerSource: z.number().optional(),
  skipEmbeddings: z.boolean().optional(),
});

export const fetchFeedsTool = {
  name: 'fetch-feeds',
  description: 'Fetch and process RSS feeds, store articles with embeddings',
  inputSchema: {
    type: 'object',
    properties: {
      sourceIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Optional array of source IDs to fetch. If omitted, fetches all active sources.',
      },
      maxArticlesPerSource: {
        type: 'number',
        description: 'Maximum number of articles to fetch per source',
      },
      skipEmbeddings: {
        type: 'boolean',
        description: 'Skip generating embeddings for new articles',
      },
    },
  },
};

export async function handleFetchFeeds(
  args: unknown,
  rssFetcher: RSSFetcherService,
  embeddingService: EmbeddingService,
  articleRepo: ArticleRepository
): Promise<string> {
  const params = FetchFeedsSchema.parse(args);

  const results = await rssFetcher.fetchMultipleFeeds(
    params.sourceIds,
    params.maxArticlesPerSource
  );

  if (!params.skipEmbeddings) {
    const articlesWithoutEmbeddings = await articleRepo.findWithoutEmbeddings(100);

    if (articlesWithoutEmbeddings.length > 0) {
      logger.info('Generating embeddings for new articles', {
        count: articlesWithoutEmbeddings.length,
      });

      for (const article of articlesWithoutEmbeddings) {
        try {
          const text = embeddingService.prepareTextForEmbedding(
            article.title,
            article.content || article.summary
          );
          const result = await embeddingService.generateEmbedding(text);
          await articleRepo.updateEmbedding(article.id, result.embedding);
        } catch (err) {
          logger.error('Failed to generate embedding', {
            articleId: article.id,
            error: err instanceof Error ? err.message : String(err),
          });
        }
      }
    }
  }

  const summary = {
    feedsProcessed: results.length,
    totalArticlesProcessed: results.reduce((sum, r) => sum + r.articlesProcessed, 0),
    totalArticlesSaved: results.reduce((sum, r) => sum + r.articlesSaved, 0),
    errors: results.flatMap((r) => r.errors),
    results: results.map((r) => ({
      source: r.sourceName,
      processed: r.articlesProcessed,
      saved: r.articlesSaved,
      errors: r.errors.length,
    })),
  };

  return JSON.stringify(summary, null, 2);
}
