import { z } from 'zod';
import { QuoteSearchService } from '../services/QuoteSearchService.js';

const AskSirAlexSchema = z.object({
  question: z.string(),
  limit: z.number().optional(),
  minSimilarity: z.number().optional(),
});

export const askSirAlexTool = {
  name: 'ask-sir-alex',
  description: 'Get wisdom from Sir Alex Ferguson and other famous football managers based on your question',
  inputSchema: {
    type: 'object',
    properties: {
      question: {
        type: 'string',
        description: 'Your question or topic to get relevant manager wisdom about',
      },
      limit: {
        type: 'number',
        description: 'Maximum number of quotes to return (default: 3)',
      },
      minSimilarity: {
        type: 'number',
        description: 'Minimum similarity score 0-1 (default: 0.3)',
      },
    },
    required: ['question'],
  },
};

export async function handleAskSirAlex(
  args: unknown,
  quoteSearchService: QuoteSearchService
): Promise<string> {
  const params = AskSirAlexSchema.parse(args);

  const results = await quoteSearchService.search(
    params.question,
    params.limit || 3,
    params.minSimilarity || 0.3
  );

  if (results.length === 0) {
    return JSON.stringify({
      question: params.question,
      response: "I'm afraid I don't have any relevant wisdom on that topic at the moment.",
      quotesFound: 0
    });
  }

  // Format the best match as Sir Alex's response
  const topQuote = results[0];
  const isSirAlex = topQuote.managerName === 'Sir Alex Ferguson';

  const formattedResponse = isSirAlex
    ? `As I've always said '${topQuote.quote}'.`
    : `As my good friend ${topQuote.managerName} once told me, '${topQuote.quote}'.`;

  // Include additional related quotes
  const relatedQuotes = results.slice(1).map((r) => ({
    quote: r.quote,
    manager: r.managerName,
    context: r.context,
    similarity: r.similarity,
  }));

  return JSON.stringify({
    question: params.question,
    response: formattedResponse,
    quotesFound: results.length,
    relatedQuotes,
  }, null, 2);
}
