export interface SentimentResult {
  articleId: number;
  sentimentLabel: string;
  sentimentScore: number;
  modelName: string;
  modelVersion: string | null;
  analyzedAt: Date;
}

export interface SentimentAnalysis {
  label: string;
  score: number;
}
