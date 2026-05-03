export interface EmbeddingResult {
  embedding: number[];
  dimensions: number;
  modelName: string;
}

export interface Article {
  id: number;
  sourceId: number;
  guid: string;
  url: string;
  title: string;
  content: string | null;
  summary: string | null;
  author: string | null;
  publishedDate: Date;
  fetchedAt: Date;
  embedding: number[] | null;
  imageUrl: string | null;
  categories: string[];
  createdAt: Date;
}

export interface SearchResult extends Article {
  similarity: number;
  sentiment?: {
    label: string;
    score: number;
  };
}
