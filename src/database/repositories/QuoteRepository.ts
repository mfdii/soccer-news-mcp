import { query } from '../client.js';
import { ManagerQuote, QuoteSearchResult } from '../../types/quote.js';
import { logger } from '../../utils/logger.js';

export class QuoteRepository {
  async findById(id: number): Promise<ManagerQuote | null> {
    const result = await query<any>(
      'SELECT * FROM manager_quotes WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async findAll(): Promise<ManagerQuote[]> {
    const result = await query<any>('SELECT * FROM manager_quotes ORDER BY created_at DESC');
    return result.rows.map((row) => this.mapRow(row));
  }

  async getRandomQuote(managerName?: string): Promise<ManagerQuote | null> {
    const queryText = managerName
      ? 'SELECT * FROM manager_quotes WHERE manager_name = $1 ORDER BY RANDOM() LIMIT 1'
      : 'SELECT * FROM manager_quotes ORDER BY RANDOM() LIMIT 1';

    const params = managerName ? [managerName] : [];
    const result = await query<any>(queryText, params);

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async findByTopic(topic: string, limit: number = 1): Promise<ManagerQuote[]> {
    const result = await query<any>(
      'SELECT * FROM manager_quotes WHERE $1 = ANY(topics) ORDER BY RANDOM() LIMIT $2',
      [topic, limit]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async create(
    quote: string,
    managerName: string,
    context?: string,
    embedding?: number[]
  ): Promise<ManagerQuote> {
    const result = await query<any>(
      `INSERT INTO manager_quotes (quote, manager_name, context, embedding)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [
        quote,
        managerName,
        context || null,
        embedding ? `[${embedding.join(',')}]` : null,
      ]
    );

    logger.debug('Quote created', { manager: managerName, preview: quote.substring(0, 50) });
    return this.mapRow(result.rows[0]);
  }

  async updateEmbedding(id: number, embedding: number[]): Promise<void> {
    await query(
      `UPDATE manager_quotes SET embedding = $1 WHERE id = $2`,
      [`[${embedding.join(',')}]`, id]
    );
  }

  async findWithoutEmbeddings(limit: number = 100): Promise<ManagerQuote[]> {
    const result = await query<any>(
      `SELECT * FROM manager_quotes WHERE embedding IS NULL LIMIT $1`,
      [limit]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async searchByVector(
    queryEmbedding: number[],
    limit: number = 3,
    minSimilarity: number = 0.3
  ): Promise<QuoteSearchResult[]> {
    const result = await query<any>(
      'SELECT * FROM manager_quotes WHERE embedding IS NOT NULL'
    );

    // Calculate cosine similarity in-memory
    const resultsWithSimilarity = result.rows
      .map((row) => {
        try {
          // PostgreSQL JSONB is already parsed by pg driver
          let embedding = row.embedding;

          // If it's a string, parse it; otherwise use it directly
          if (typeof embedding === 'string') {
            embedding = JSON.parse(embedding);
          }

          // Skip empty or invalid embeddings
          if (!Array.isArray(embedding) || embedding.length === 0) {
            return null;
          }

          const similarity = this.cosineSimilarity(queryEmbedding, embedding);
          return {
            ...this.mapRow(row),
            similarity,
          };
        } catch (err) {
          logger.warn('Failed to parse embedding', {
            id: row.id,
            error: err instanceof Error ? err.message : String(err),
          });
          return null;
        }
      })
      .filter((r) => r !== null && r.similarity >= minSimilarity)
      .sort((a, b) => b!.similarity - a!.similarity)
      .slice(0, limit) as QuoteSearchResult[];

    return resultsWithSimilarity;
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) {
      return 0;
    }

    let dotProduct = 0;
    let magnitudeA = 0;
    let magnitudeB = 0;

    for (let i = 0; i < a.length; i++) {
      dotProduct += a[i] * b[i];
      magnitudeA += a[i] * a[i];
      magnitudeB += b[i] * b[i];
    }

    const magnitude = Math.sqrt(magnitudeA) * Math.sqrt(magnitudeB);
    return magnitude === 0 ? 0 : dotProduct / magnitude;
  }

  async count(): Promise<number> {
    const result = await query<{ count: string }>(
      'SELECT COUNT(*) as count FROM manager_quotes'
    );
    return parseInt(result.rows[0].count);
  }

  private mapRow(row: any): ManagerQuote {
    return {
      id: row.id,
      quote: row.quote,
      managerName: row.manager_name,
      context: row.context,
      embedding: row.embedding,
      createdAt: new Date(row.created_at),
    };
  }
}
