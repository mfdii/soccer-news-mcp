-- Enable pgvector extension
CREATE EXTENSION IF NOT EXISTS vector;

-- RSS feed sources table
CREATE TABLE sources (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL UNIQUE,
    rss_url TEXT NOT NULL UNIQUE,
    category VARCHAR(100) DEFAULT 'general',
    active BOOLEAN DEFAULT true,
    last_fetched TIMESTAMP,
    last_error TEXT,
    fetch_count INTEGER DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_sources_active ON sources(active);

-- Articles table with vector embeddings
CREATE TABLE articles (
    id SERIAL PRIMARY KEY,
    source_id INTEGER NOT NULL REFERENCES sources(id) ON DELETE CASCADE,
    guid VARCHAR(512) NOT NULL UNIQUE,
    url TEXT NOT NULL,
    title TEXT NOT NULL,
    content TEXT,
    summary TEXT,
    author VARCHAR(255),
    published_date TIMESTAMP NOT NULL,
    fetched_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    embedding vector(384),
    image_url TEXT,
    categories TEXT[],
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_articles_source_id ON articles(source_id);
CREATE INDEX idx_articles_published_date ON articles(published_date DESC);
CREATE INDEX idx_articles_guid ON articles(guid);

-- Sentiment analysis cache
CREATE TABLE sentiment_cache (
    id SERIAL PRIMARY KEY,
    article_id INTEGER NOT NULL REFERENCES articles(id) ON DELETE CASCADE,
    sentiment_label VARCHAR(20) NOT NULL,
    sentiment_score FLOAT NOT NULL,
    model_name VARCHAR(255) NOT NULL,
    model_version VARCHAR(50),
    analyzed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(article_id, model_name)
);

CREATE INDEX idx_sentiment_cache_article_id ON sentiment_cache(article_id);
CREATE INDEX idx_sentiment_cache_label ON sentiment_cache(sentiment_label);
