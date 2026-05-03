export interface RSSSource {
  id: number;
  name: string;
  rssUrl: string;
  category: string;
  active: boolean;
  lastFetched: Date | null;
  lastError: string | null;
  fetchCount: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface RSSArticle {
  guid: string;
  url: string;
  title: string;
  content: string | null;
  summary: string | null;
  author: string | null;
  publishedDate: Date;
  imageUrl: string | null;
  categories: string[];
}

export interface FetchResult {
  sourceId: number;
  sourceName: string;
  articlesProcessed: number;
  articlesSaved: number;
  errors: string[];
}
