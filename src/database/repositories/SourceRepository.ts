import { query } from '../client.js';
import { RSSSource } from '../../types/rss.js';
import { logger } from '../../utils/logger.js';

export class SourceRepository {
  async findAll(activeOnly = false): Promise<RSSSource[]> {
    const queryText = activeOnly
      ? 'SELECT * FROM sources WHERE active = true ORDER BY name'
      : 'SELECT * FROM sources ORDER BY name';

    const result = await query<RSSSource>(queryText);
    return result.rows.map(this.mapRow);
  }

  async findById(id: number): Promise<RSSSource | null> {
    const result = await query<RSSSource>(
      'SELECT * FROM sources WHERE id = $1',
      [id]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async findByUrl(url: string): Promise<RSSSource | null> {
    const result = await query<RSSSource>(
      'SELECT * FROM sources WHERE rss_url = $1',
      [url]
    );
    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async create(
    name: string,
    rssUrl: string,
    category: string = 'general'
  ): Promise<RSSSource> {
    const result = await query<RSSSource>(
      `INSERT INTO sources (name, rss_url, category)
       VALUES ($1, $2, $3)
       RETURNING *`,
      [name, rssUrl, category]
    );

    logger.info('RSS source created', { name, rssUrl });
    return this.mapRow(result.rows[0]);
  }

  async update(
    id: number,
    updates: {
      name?: string;
      rssUrl?: string;
      category?: string;
      active?: boolean;
    }
  ): Promise<RSSSource | null> {
    const fields: string[] = [];
    const values: unknown[] = [];
    let paramIndex = 1;

    if (updates.name !== undefined) {
      fields.push(`name = $${paramIndex++}`);
      values.push(updates.name);
    }
    if (updates.rssUrl !== undefined) {
      fields.push(`rss_url = $${paramIndex++}`);
      values.push(updates.rssUrl);
    }
    if (updates.category !== undefined) {
      fields.push(`category = $${paramIndex++}`);
      values.push(updates.category);
    }
    if (updates.active !== undefined) {
      fields.push(`active = $${paramIndex++}`);
      values.push(updates.active);
    }

    if (fields.length === 0) {
      return this.findById(id);
    }

    fields.push(`updated_at = CURRENT_TIMESTAMP`);
    values.push(id);

    const result = await query<RSSSource>(
      `UPDATE sources SET ${fields.join(', ')} WHERE id = $${paramIndex} RETURNING *`,
      values
    );

    return result.rows.length > 0 ? this.mapRow(result.rows[0]) : null;
  }

  async updateFetchStatus(
    id: number,
    error: string | null = null
  ): Promise<void> {
    await query(
      `UPDATE sources
       SET last_fetched = CURRENT_TIMESTAMP,
           last_error = $2,
           fetch_count = fetch_count + 1,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [id, error]
    );
  }

  async findConsistentlyFailing(minFetches: number = 5): Promise<RSSSource[]> {
    const result = await query<any>(
      `SELECT * FROM sources
       WHERE active = true
         AND last_error IS NOT NULL
         AND fetch_count >= $1
       ORDER BY last_fetched DESC`,
      [minFetches]
    );
    return result.rows.map((row) => this.mapRow(row));
  }

  async delete(id: number): Promise<boolean> {
    const result = await query('DELETE FROM sources WHERE id = $1', [id]);
    return (result.rowCount ?? 0) > 0;
  }

  private mapRow(row: any): RSSSource {
    return {
      id: row.id,
      name: row.name,
      rssUrl: row.rss_url,
      category: row.category,
      active: row.active,
      lastFetched: row.last_fetched ? new Date(row.last_fetched) : null,
      lastError: row.last_error,
      fetchCount: row.fetch_count,
      createdAt: new Date(row.created_at),
      updatedAt: new Date(row.updated_at),
    };
  }
}
