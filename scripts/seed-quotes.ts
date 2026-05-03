#!/usr/bin/env node
import { QuoteRepository } from '../src/database/repositories/QuoteRepository.js';
import { EmbeddingService } from '../src/services/EmbeddingService.js';
import { FAMOUS_MANAGER_QUOTES } from '../src/config/quotes.js';
import { logger } from '../src/utils/logger.js';
import { closePool } from '../src/database/client.js';

async function seedQuotes(): Promise<void> {
  const quoteRepo = new QuoteRepository();
  const embeddingService = new EmbeddingService();

  try {
    await embeddingService.initialize();
    logger.info('Seeding manager quotes', { count: FAMOUS_MANAGER_QUOTES.length });

    for (const quoteData of FAMOUS_MANAGER_QUOTES) {
      try {
        // Generate embedding for the quote
        const text = `${quoteData.quote} - ${quoteData.managerName}`;
        const embeddingResult = await embeddingService.generateEmbedding(text);

        await quoteRepo.create(
          quoteData.quote,
          quoteData.managerName,
          quoteData.context,
          embeddingResult.embedding
        );

        logger.info('Quote created', {
          manager: quoteData.managerName,
          preview: quoteData.quote.substring(0, 50)
        });
      } catch (error) {
        logger.error('Failed to create quote', {
          manager: quoteData.managerName,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    logger.info('Quote seeding completed');
  } catch (error) {
    logger.error('Seeding failed', {
      error: error instanceof Error ? error.message : String(error),
    });
    throw error;
  } finally {
    await closePool();
  }
}

seedQuotes().catch((error) => {
  console.error('Seeding error:', error);
  process.exit(1);
});
