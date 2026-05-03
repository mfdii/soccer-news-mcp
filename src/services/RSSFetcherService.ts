import Parser from 'rss-parser';
import { RSSArticle, FetchResult } from '../types/rss.js';
import { logger } from '../utils/logger.js';
import { SourceRepository } from '../database/repositories/SourceRepository.js';
import { ArticleRepository } from '../database/repositories/ArticleRepository.js';

export class RSSFetcherService {
  private parser: Parser;
  private sourceRepo: SourceRepository;
  private articleRepo: ArticleRepository;

  constructor(
    sourceRepo: SourceRepository,
    articleRepo: ArticleRepository
  ) {
    this.parser = new Parser({
      timeout: 10000,
      maxRedirects: 5,
    });
    this.sourceRepo = sourceRepo;
    this.articleRepo = articleRepo;
  }

  async fetchFeed(
    sourceId: number,
    maxArticles?: number
  ): Promise<FetchResult> {
    const source = await this.sourceRepo.findById(sourceId);
    if (!source) {
      throw new Error(`Source ${sourceId} not found`);
    }

    if (!source.active) {
      logger.warn('Skipping inactive source', { sourceId, name: source.name });
      return {
        sourceId,
        sourceName: source.name,
        articlesProcessed: 0,
        articlesSaved: 0,
        errors: ['Source is inactive'],
      };
    }

    const result: FetchResult = {
      sourceId,
      sourceName: source.name,
      articlesProcessed: 0,
      articlesSaved: 0,
      errors: [],
    };

    try {
      logger.info('Fetching RSS feed', { source: source.name, url: source.rssUrl });
      const feed = await this.parser.parseURL(source.rssUrl);

      const items = maxArticles ? feed.items.slice(0, maxArticles) : feed.items;
      result.articlesProcessed = items.length;

      for (const item of items) {
        try {
          const article = this.parseItem(item);
          if (!article) {
            continue;
          }

          const existing = await this.articleRepo.findByGuid(article.guid);
          if (existing) {
            logger.debug('Article already exists', { guid: article.guid });
            continue;
          }

          await this.articleRepo.create(sourceId, article);
          result.articlesSaved++;
        } catch (err) {
          const errorMsg = err instanceof Error ? err.message : String(err);
          logger.error('Failed to save article', { error: errorMsg, item: item.title });
          result.errors.push(`Article "${item.title}": ${errorMsg}`);
        }
      }

      await this.sourceRepo.updateFetchStatus(sourceId, null);
      logger.info('Feed fetch completed', {
        source: source.name,
        processed: result.articlesProcessed,
        saved: result.articlesSaved,
      });
    } catch (err) {
      const errorMsg = err instanceof Error ? err.message : String(err);
      logger.error('Feed fetch failed', { source: source.name, error: errorMsg });
      result.errors.push(errorMsg);
      await this.sourceRepo.updateFetchStatus(sourceId, errorMsg);
    }

    return result;
  }

  async fetchMultipleFeeds(
    sourceIds?: number[],
    maxArticlesPerSource?: number
  ): Promise<FetchResult[]> {
    const sources = sourceIds
      ? await Promise.all(sourceIds.map((id) => this.sourceRepo.findById(id)))
      : await this.sourceRepo.findAll(true);

    const validSources = sources.filter((s) => s !== null);

    logger.info('Fetching multiple feeds', { count: validSources.length });

    const results = await Promise.all(
      validSources.map((source) =>
        this.fetchFeed(source!.id, maxArticlesPerSource)
      )
    );

    const totalProcessed = results.reduce((sum, r) => sum + r.articlesProcessed, 0);
    const totalSaved = results.reduce((sum, r) => sum + r.articlesSaved, 0);

    logger.info('Multiple feed fetch completed', {
      feeds: validSources.length,
      totalProcessed,
      totalSaved,
    });

    return results;
  }

  private parseItem(item: Parser.Item): RSSArticle | null {
    if (!item.guid && !item.link) {
      logger.warn('Item missing guid and link', { title: item.title });
      return null;
    }

    const guid = item.guid || item.link || '';
    const url = item.link || item.guid || '';
    const title = item.title || 'Untitled';
    const content = item.content || item.contentSnippet || null;
    const summary = item.contentSnippet || item.content?.substring(0, 500) || null;
    const author = item.creator || (item as any).author || null;

    // Filter out non-soccer content
    if (!this.isSoccerRelated(title, content, summary)) {
      logger.debug('Skipping non-soccer article', { title });
      return null;
    }

    // Parse and validate published date
    let publishedDate = new Date();
    if (item.pubDate) {
      // Normalize timezone abbreviations that JavaScript doesn't recognize
      let normalizedDate = item.pubDate
        .replace(/\s+BST$/, ' GMT+0100')  // British Summer Time
        .replace(/\s+GMT$/, ' GMT+0000'); // Greenwich Mean Time

      const parsed = new Date(normalizedDate);
      if (!isNaN(parsed.getTime())) {
        publishedDate = parsed;
      } else {
        logger.warn('Invalid pubDate, using current time', {
          title: item.title,
          pubDate: item.pubDate,
          normalized: normalizedDate
        });
      }
    }

    const imageUrl = item.enclosure?.url || null;
    const categories = item.categories || [];

    return {
      guid,
      url,
      title,
      content,
      summary,
      author,
      publishedDate,
      imageUrl,
      categories,
    };
  }

  private isSoccerRelated(title: string, content: string | null, summary: string | null): boolean {
    const text = `${title} ${content || ''} ${summary || ''}`.toLowerCase();

    // Exclude articles about known non-soccer personalities
    const nonSoccerPersonalities = [
      'mcilroy', 'rory mcilroy', 'tiger woods', 'djokovic', 'nadal', 'federer',
      'verstappen', 'hamilton', 'lebron', 'curry', 'brady', 'mahomes'
    ];

    for (const person of nonSoccerPersonalities) {
      if (text.includes(person)) {
        return false;
      }
    }

    // Exclude non-soccer sports
    const excludeKeywords = [
      'snooker', 'golf', 'cricket', 'tennis', 'rugby', 'formula 1', 'f1 ',
      'nascar', 'boxing', 'ufc', 'mma', 'baseball', 'basketball', 'nba',
      'nfl', 'american football', 'hockey', 'nhl', 'cycling', 'athletics',
      'swimming', 'motorsport', 'horse racing', 'darts', 'badminton',
      // More specific exclusions
      'pga tour', 't20 world cup', 'french open', 'wimbledon', 'us open',
      'masters golf', 'formula e', 'nascar cup', 'slam dunk', 'three-point',
      'free throw', 'pitcher', 'quarterback', 'grand prix', 'pole position'
    ];

    for (const keyword of excludeKeywords) {
      if (text.includes(keyword)) {
        return false;
      }
    }

    // Include if soccer-related keywords present
    const includeKeywords = [
      'football', 'soccer', 'premier league', 'champions league', 'uefa',
      'fifa', 'world cup', 'la liga', 'bundesliga', 'serie a', 'ligue 1',
      'mls', 'arsenal', 'chelsea', 'liverpool', 'manchester', 'tottenham',
      'barcelona', 'real madrid', 'bayern', 'psg', 'juventus', 'milan',
      'striker', 'midfielder', 'defender', 'goalkeeper', 'transfer', 'goal'
    ];

    for (const keyword of includeKeywords) {
      if (text.includes(keyword)) {
        return true;
      }
    }

    // Default to true for feeds that are supposed to be soccer-only
    return true;
  }
}
