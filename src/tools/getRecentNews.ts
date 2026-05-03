import { z } from 'zod';
import { ArticleRepository } from '../database/repositories/ArticleRepository.js';
import { SentimentRepository } from '../database/repositories/SentimentRepository.js';

const GetRecentNewsSchema = z.object({
  limit: z.number().optional(),
  sourceIds: z.array(z.number()).optional(),
  hoursBack: z.number().optional(),
  includeSentiment: z.boolean().optional(),
});

export const getRecentNewsTool = {
  name: 'get-recent-news',
  description: 'Get most recent articles without semantic search (simple time-based)',
  inputSchema: {
    type: 'object',
    properties: {
      limit: {
        type: 'number',
        description: 'Maximum number of articles to return (default: 20)',
      },
      sourceIds: {
        type: 'array',
        items: { type: 'number' },
        description: 'Filter by source IDs',
      },
      hoursBack: {
        type: 'number',
        description: 'Only show articles from the last N hours',
      },
      includeSentiment: {
        type: 'boolean',
        description: 'Include sentiment data in results',
      },
    },
  },
};

export async function handleGetRecentNews(
  args: unknown,
  articleRepo: ArticleRepository,
  sentimentRepo: SentimentRepository
): Promise<string> {
  const params = GetRecentNewsSchema.parse(args);

  const articles = await articleRepo.findRecent(
    params.limit,
    params.sourceIds,
    params.hoursBack
  );

  let results = articles.map((a) => ({
    id: a.id,
    title: a.title,
    url: a.url,
    publishedDate: a.publishedDate,
    summary: a.summary?.substring(0, 200),
    author: a.author,
    categories: a.categories,
  }));

  if (params.includeSentiment && articles.length > 0) {
    const articleIds = articles.map((a) => a.id);
    const sentimentMap = await sentimentRepo.findByArticleIds(
      articleIds,
      'Xenova/distilbert-base-uncased-finetuned-sst-2-english'
    );

    results = results.map((r) => {
      const sentiment = sentimentMap.get(r.id);
      if (sentiment) {
        return {
          ...r,
          sentiment: {
            label: sentiment.sentimentLabel,
            score: sentiment.sentimentScore,
          },
        };
      }
      return r;
    });
  }

  const formatted = {
    count: results.length,
    results,
  };

  return JSON.stringify(formatted, null, 2);
}
