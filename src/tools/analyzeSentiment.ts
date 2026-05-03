import { z } from 'zod';
import { SentimentService } from '../services/SentimentService.js';
import { ArticleRepository } from '../database/repositories/ArticleRepository.js';
import { SentimentRepository } from '../database/repositories/SentimentRepository.js';
import { logger } from '../utils/logger.js';

const AnalyzeSentimentSchema = z.object({
  articleIds: z.array(z.number()).optional(),
  limit: z.number().optional(),
  reanalyze: z.boolean().optional(),
});

export const analyzeSentimentTool = {
  name: 'analyze-sentiment',
  description: 'Analyze sentiment for specific articles',
  inputSchema: {
    type: 'object',
    properties: {
      articleIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Article IDs to analyze',
      },
      limit: {
        type: 'number',
        description: 'Limit number of articles to analyze if no IDs provided',
      },
      reanalyze: {
        type: 'boolean',
        description: 'Force reanalysis even if cached',
      },
    },
  },
};

export async function handleAnalyzeSentiment(
  args: unknown,
  sentimentService: SentimentService,
  articleRepo: ArticleRepository,
  sentimentRepo: SentimentRepository
): Promise<string> {
  const params = AnalyzeSentimentSchema.parse(args);

  let articles;
  if (params.articleIds && params.articleIds.length > 0) {
    articles = await Promise.all(
      params.articleIds.map((id) => articleRepo.findById(id))
    );
    articles = articles.filter((a) => a !== null);
  } else {
    articles = await articleRepo.findRecent(params.limit || 20);
  }

  const modelName = sentimentService.getModelName();
  const results = [];

  for (const article of articles) {
    if (!article) continue;

    try {
      let sentiment;

      if (!params.reanalyze) {
        const cached = await sentimentRepo.findByArticleId(article.id, modelName);
        if (cached) {
          results.push({
            articleId: article.id,
            title: article.title,
            sentimentLabel: cached.sentimentLabel,
            sentimentScore: cached.sentimentScore,
            cached: true,
          });
          continue;
        }
      }

      const text = sentimentService.prepareTextForSentiment(
        article.title,
        article.content || article.summary
      );

      sentiment = await sentimentService.analyzeSentiment(text);

      await sentimentRepo.create(
        article.id,
        sentiment.label,
        sentiment.score,
        modelName
      );

      results.push({
        articleId: article.id,
        title: article.title,
        sentimentLabel: sentiment.label,
        sentimentScore: sentiment.score,
        cached: false,
      });
    } catch (err) {
      logger.error('Sentiment analysis failed for article', {
        articleId: article.id,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  const summary = {
    totalAnalyzed: results.length,
    results,
    distribution: {
      positive: results.filter((r) => r.sentimentLabel === 'positive').length,
      negative: results.filter((r) => r.sentimentLabel === 'negative').length,
    },
  };

  return JSON.stringify(summary, null, 2);
}
