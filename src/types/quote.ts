export interface ManagerQuote {
  id: number;
  quote: string;
  managerName: string;
  context?: string | null;
  embedding?: number[] | null;
  createdAt: Date;
}

export interface QuoteSearchResult extends ManagerQuote {
  similarity: number;
}
