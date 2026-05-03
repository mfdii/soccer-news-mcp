# Quick Start Guide

## 1. Setup PostgreSQL with pgvector

```bash
# Create database
createdb soccer_news

# Install pgvector
psql soccer_news -c "CREATE EXTENSION vector;"

# Configure environment
cp .env.example .env
# Edit .env with your database credentials
```

## 2. Initialize Database

```bash
# Run migrations
npm run migrate

# Seed RSS sources
npm run seed
```

## 3. Start the Server

```bash
# Development mode (hot reload)
npm run dev

# Or production mode
npm run build
npm start
```

Server will start on http://localhost:3000

## 4. Test the Server

```bash
# Health check
curl http://localhost:3000/health

# List RSS sources (via MCP)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": {
        "name": "test-client",
        "version": "1.0.0"
      }
    },
    "jsonrpc": "2.0",
    "id": 1
  }'
```

## 5. Fetch News

Once the server is running, use the MCP tools:

- `fetch-feeds`: Pull latest articles from RSS sources
- `search-news`: Semantic search with RAG
- `analyze-sentiment`: Run sentiment analysis
- `list-sources`: View configured sources
- `get-recent-news`: Time-based article retrieval
- `manage-sources`: Add/update/remove sources

## Optional: Test RSS Feeds

```bash
npm run test:feeds
```

This will test connectivity to all 10 configured RSS sources.
