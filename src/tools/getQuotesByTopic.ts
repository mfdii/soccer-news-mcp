import { z } from 'zod';
import { QuoteRepository } from '../database/repositories/QuoteRepository.js';

const GetQuotesByTopicSchema = z.object({
  topic: z.enum([
    'rivalry',
    'passion',
    'leadership',
    'tactics',
    'winning',
    'motivation',
    'philosophy',
  ]),
  limit: z.number().optional(),
});

export const getQuotesByTopicTool = {
  name: 'get-quotes-by-topic',
  description:
    'Get quotes categorized by topic (faster than semantic search, contextually relevant)',
  inputSchema: {
    type: 'object' as const,
    properties: {
      topic: {
        type: 'string',
        enum: [
          'rivalry',
          'passion',
          'leadership',
          'tactics',
          'winning',
          'motivation',
          'philosophy',
        ],
        description: 'Topic category for the quote',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of quotes to return (default: 1)',
      },
    },
    required: ['topic'],
  },
};

export async function handleGetQuotesByTopic(
  args: unknown,
  quoteRepo: QuoteRepository
): Promise<string> {
  const params = GetQuotesByTopicSchema.parse(args);

  const quotes = await quoteRepo.findByTopic(params.topic, params.limit || 1);

  if (quotes.length === 0) {
    // Fallback to random quote
    const randomQuote = await quoteRepo.getRandomQuote();
    if (!randomQuote) {
      return JSON.stringify({ error: 'No quotes found' });
    }
    quotes.push(randomQuote);
  }

  const topQuote = quotes[0];
  const isSirAlex = topQuote.managerName === 'Sir Alex Ferguson';

  const formattedResponse = isSirAlex
    ? `As I've always said '${topQuote.quote}'.`
    : `As my good friend ${topQuote.managerName} once told me, '${topQuote.quote}'.`;

  return JSON.stringify(
    {
      response: formattedResponse,
      quote: topQuote.quote,
      manager: topQuote.managerName,
      context: topQuote.context,
      topic: params.topic,
    },
    null,
    2
  );
}
