import { query } from '../client.js';
import { SentimentResult } from '../../types/sentiment.js';
import { logger } from '../../utils/logger.js';

export class SentimentRepository {
  async findByArticleId(
    articleId: number,
    modelName: string
  ): Promise<SentimentResult | null> {
    const result = await query<any>(
      `SELECT * FROM sentiment_cache
       WHERE article_id = $1 AND model_name = $2`,
      [articleId, modelName]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async findByArticleIds(
    articleIds: number[],
    modelName: string
  ): Promise<Map<number, SentimentResult>> {
    if (articleIds.length === 0) {
      return new Map();
    }

    const result = await query<any>(
      `SELECT * FROM sentiment_cache
       WHERE article_id = ANY($1) AND model_name = $2`,
      [articleIds, modelName]
    );

    const map = new Map<number, SentimentResult>();
    result.rows.forEach((row) => {
      map.set(row.article_id, this.mapRow(row));
    });

    return map;
  }

  async create(
    articleId: number,
    sentimentLabel: string,
    sentimentScore: number,
    modelName: string,
    modelVersion?: string
  ): Promise<SentimentResult> {
    const result = await query<any>(
      `INSERT INTO sentiment_cache (
        article_id, sentiment_label, sentiment_score,
        model_name, model_version
      ) VALUES ($1, $2, $3, $4, $5)
      ON CONFLICT (article_id, model_name)
      DO UPDATE SET
        sentiment_label = EXCLUDED.sentiment_label,
        sentiment_score = EXCLUDED.sentiment_score,
        model_version = EXCLUDED.model_version,
        analyzed_at = CURRENT_TIMESTAMP
      RETURNING *`,
      [articleId, sentimentLabel, sentimentScore, modelName, modelVersion]
    );

    logger.debug('Sentiment cached', { articleId, label: sentimentLabel });
    return this.mapRow(result.rows[0]);
  }

  async deleteBySentiment(sentimentLabel: string): Promise<number> {
    const result = await query(
      'DELETE FROM sentiment_cache WHERE sentiment_label = $1',
      [sentimentLabel]
    );
    return result.rowCount ?? 0;
  }

  private mapRow(row: any): SentimentResult {
    return {
      articleId: row.article_id,
      sentimentLabel: row.sentiment_label,
      sentimentScore: row.sentiment_score,
      modelName: row.model_name,
      modelVersion: row.model_version,
      analyzedAt: new Date(row.analyzed_at),
    };
  }
}
