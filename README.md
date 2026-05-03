# Soccer News MCP Server

An MCP (Model Context Protocol) server for soccer news with RAG (Retrieval Augmented Generation) and sentiment analysis capabilities.

## Features

- **RSS Feed Fetching**: Fetch soccer news from 10+ free RSS sources (BBC Sport, ESPN, The Guardian, etc.)
- **Vector Embeddings**: Store articles with 384-dimensional embeddings using local ML models
- **Semantic Search**: Query articles using vector similarity search (RAG)
- **Sentiment Analysis**: Analyze positive/negative sentiment of articles with caching
- **Local ML Models**: Uses Xenova/transformers.js (no API costs, runs locally)
- **PostgreSQL + pgvector**: Efficient vector similarity search with HNSW indexes

## Architecture

- **Database**: PostgreSQL 16+ with pgvector extension
- **Embeddings**: Xenova/all-MiniLM-L6-v2 (384-dim, 80MB model)
- **Sentiment**: Xenova/distilbert-base-uncased-finetuned-sst-2-english (250MB model)
- **MCP SDK**: @modelcontextprotocol/sdk with HTTP transport
- **Server**: Express.js with session management

## Prerequisites

- Node.js 18+
- PostgreSQL 16+ with pgvector extension
- 2-4GB RAM (for ML models)

## Installation

```bash
# Clone or navigate to the project
cd ./mcp-soccer-news

# Install dependencies
npm install

# Copy environment file
cp .env.example .env

# Edit .env with your database credentials
vim .env
```

## Database Setup

```bash
# Create PostgreSQL database
createdb soccer_news

# Install pgvector extension
psql soccer_news -c "CREATE EXTENSION vector;"

# Run migrations
npm run migrate

# Seed RSS sources
npm run seed
```

## Running

```bash
# Development mode (with tsx)
npm run dev

# Production build
npm run build
npm start
```

## MCP Tools

### 1. fetch-feeds
Fetch and process RSS feeds, store articles with embeddings.

**Inputs:**
- `sourceIds` (optional): Array of source IDs to fetch
- `maxArticlesPerSource` (optional): Limit articles per source
- `skipEmbeddings` (optional): Skip embedding generation

### 2. search-news
Semantic search across stored articles using vector similarity.

**Inputs:**
- `query` (required): Search query
- `limit` (optional): Max results (default: 10)
- `minSimilarity` (optional): Min similarity 0-1 (default: 0.5)
- `sourceIds`, `dateFrom`, `dateTo`, `sentimentFilter`, `includeSentiment`

### 3. analyze-sentiment
Analyze sentiment for specific articles.

**Inputs:**
- `articleIds` (optional): Specific article IDs
- `limit` (optional): Number of articles if no IDs
- `reanalyze` (optional): Force reanalysis even if cached

### 4. list-sources
List configured RSS feed sources with statistics.

**Inputs:**
- `activeOnly` (optional): Show only active sources

### 5. get-recent-news
Get most recent articles without semantic search.

**Inputs:**
- `limit`, `sourceIds`, `hoursBack`, `includeSentiment`

### 6. manage-sources
Add, update, or remove RSS feed sources.

**Inputs:**
- `action` (required): add, update, delete, toggle
- `sourceId`, `name`, `rssUrl`, `category`, `active`

## API Endpoints

- `GET /health`: Health check
- `GET /ready`: Readiness check (verifies DB connection)
- `POST /sse`: SSE connection for MCP sessions
- `POST /message`: MCP message handling

## Environment Variables

See `.env.example` for all configuration options.

## Performance

- Embedding generation: < 200ms per article
- Vector search: < 50ms for 10k articles
- Sentiment analysis: < 500ms per article
- RSS fetching: < 15s for all 10 feeds (parallel)

## License

MIT
