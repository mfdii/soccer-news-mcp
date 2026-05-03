import { QuoteSearchResult } from '../types/quote.js';
import { QuoteRepository } from '../database/repositories/QuoteRepository.js';
import { EmbeddingService } from './EmbeddingService.js';
import { logger } from '../utils/logger.js';

export class QuoteSearchService {
  private quoteRepo: QuoteRepository;
  private embeddingService: EmbeddingService;
  private cache = new Map<
    string,
    { result: QuoteSearchResult[]; timestamp: number }
  >();
  private readonly CACHE_TTL = 3600000; // 1 hour

  constructor(quoteRepo: QuoteRepository, embeddingService: EmbeddingService) {
    this.quoteRepo = quoteRepo;
    this.embeddingService = embeddingService;
  }

  async search(
    query: string,
    limit: number = 3,
    minSimilarity: number = 0.3
  ): Promise<QuoteSearchResult[]> {
    // Check cache first
    const cacheKey = `${query.toLowerCase()}:${limit}:${minSimilarity}`;
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      logger.debug('Returning cached quote search', {
        query,
        cacheAge: Date.now() - cached.timestamp,
      });
      return cached.result;
    }

    logger.info('Searching quotes', { query, limit, minSimilarity });
    const start = Date.now();

    const embeddingResult = await this.embeddingService.generateEmbedding(query);

    const results = await this.quoteRepo.searchByVector(
      embeddingResult.embedding,
      limit,
      minSimilarity
    );

    const duration = Date.now() - start;
    logger.info('Quote search completed', {
      query,
      results: results.length,
      duration,
    });

    // Cache the results
    this.cache.set(cacheKey, { result: results, timestamp: Date.now() });

    // Cleanup old cache entries (simple LRU)
    if (this.cache.size > 100) {
      const oldestKey = Array.from(this.cache.entries()).sort(
        (a, b) => a[1].timestamp - b[1].timestamp
      )[0][0];
      this.cache.delete(oldestKey);
    }

    return results;
  }
}
