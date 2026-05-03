-- HNSW index for vector similarity search
-- Create after initial data load for better performance
-- m=16: connections per layer, ef_construction=64: quality during construction
CREATE INDEX IF NOT EXISTS idx_articles_embedding ON articles
USING hnsw (embedding vector_cosine_ops)
WITH (m = 16, ef_construction = 64);
