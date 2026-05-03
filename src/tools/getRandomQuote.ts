import { z } from 'zod';
import { QuoteRepository } from '../database/repositories/QuoteRepository.js';

const GetRandomQuoteSchema = z.object({
  manager: z.string().optional(),
});

export const getRandomQuoteTool = {
  name: 'get-random-quote',
  description: 'Get a random quote from Sir Alex Ferguson or other famous managers (fast, no semantic search)',
  inputSchema: {
    type: 'object' as const,
    properties: {
      manager: {
        type: 'string',
        description: 'Manager name to filter by (optional, default: any manager)',
      },
    },
  },
};

export async function handleGetRandomQuote(
  args: unknown,
  quoteRepo: QuoteRepository
): Promise<string> {
  const params = GetRandomQuoteSchema.parse(args);

  const quote = await quoteRepo.getRandomQuote(params.manager);

  if (!quote) {
    return JSON.stringify({
      error: 'No quotes found',
      manager: params.manager,
    });
  }

  const isSirAlex = quote.managerName === 'Sir Alex Ferguson';
  const formattedResponse = isSirAlex
    ? `As I've always said '${quote.quote}'.`
    : `As my good friend ${quote.managerName} once told me, '${quote.quote}'.`;

  return JSON.stringify(
    {
      response: formattedResponse,
      quote: quote.quote,
      manager: quote.managerName,
      context: quote.context,
    },
    null,
    2
  );
}
