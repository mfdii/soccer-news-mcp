export interface ModelConfig {
  embeddingModel: string;
  sentimentModel: string;
  embeddingDimensions: number;
  maxBatchSize: number;
  modelCachePath: string;
}

export const getModelConfig = (): ModelConfig => {
  return {
    embeddingModel: process.env.EMBEDDING_MODEL || 'Xenova/all-MiniLM-L6-v2',
    sentimentModel: process.env.SENTIMENT_MODEL || 'Xenova/distilbert-base-uncased-finetuned-sst-2-english',
    embeddingDimensions: parseInt(process.env.EMBEDDING_DIMENSIONS || '384'),
    maxBatchSize: parseInt(process.env.MAX_BATCH_SIZE || '50'),
    modelCachePath: process.env.MODEL_CACHE_PATH || '/tmp/transformers-cache',
  };
};
