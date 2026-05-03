#!/usr/bin/env node
import express from 'express';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from './utils/logger.js';
import { getPool, closePool } from './database/client.js';
import { SourceRepository } from './database/repositories/SourceRepository.js';
import { ArticleRepository } from './database/repositories/ArticleRepository.js';
import { SentimentRepository } from './database/repositories/SentimentRepository.js';
import { QuoteRepository } from './database/repositories/QuoteRepository.js';
import { RSSFetcherService } from './services/RSSFetcherService.js';
import { EmbeddingService } from './services/EmbeddingService.js';
import { SentimentService } from './services/SentimentService.js';
import { SearchService } from './services/SearchService.js';
import { QuoteSearchService } from './services/QuoteSearchService.js';
import {
  fetchFeedsTool,
  handleFetchFeeds,
  searchNewsTool,
  handleSearchNews,
  analyzeSentimentTool,
  handleAnalyzeSentiment,
  listSourcesTool,
  handleListSources,
  getRecentNewsTool,
  handleGetRecentNews,
  manageSourcesTool,
  handleManageSources,
  askSirAlexTool,
  handleAskSirAlex,
  getRandomQuoteTool,
  handleGetRandomQuote,
  getQuotesByTopicTool,
  handleGetQuotesByTopic,
} from './tools/index.js';

const PORT = parseInt(process.env.PORT || '3000');
const SESSION_TIMEOUT = parseInt(process.env.SESSION_TIMEOUT || '1800000'); // 30 minutes

interface Session {
  server: Server;
  transport: StreamableHTTPServerTransport;
  lastActivity: number;
}

const sessions = new Map<string, Session>();

const sourceRepo = new SourceRepository();
const articleRepo = new ArticleRepository();
const sentimentRepo = new SentimentRepository();
const quoteRepo = new QuoteRepository();

const rssFetcher = new RSSFetcherService(sourceRepo, articleRepo);
const embeddingService = new EmbeddingService();
const sentimentService = new SentimentService();
const searchService = new SearchService(
  articleRepo,
  sentimentRepo,
  embeddingService
);
const quoteSearchService = new QuoteSearchService(quoteRepo, embeddingService);

function createServer(): Server {
  const server = new Server(
    {
      name: 'soccer-news-mcp',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        fetchFeedsTool,
        searchNewsTool,
        analyzeSentimentTool,
        listSourcesTool,
        getRecentNewsTool,
        manageSourcesTool,
        askSirAlexTool,
        getRandomQuoteTool,
        getQuotesByTopicTool,
      ],
    };
  });

  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    logger.info('Tool call', { tool: name });

    try {
      let result: string;

      switch (name) {
        case 'fetch-feeds':
          result = await handleFetchFeeds(
            args,
            rssFetcher,
            embeddingService,
            articleRepo
          );
          break;

        case 'search-news':
          result = await handleSearchNews(args, searchService);
          break;

        case 'analyze-sentiment':
          result = await handleAnalyzeSentiment(
            args,
            sentimentService,
            articleRepo,
            sentimentRepo
          );
          break;

        case 'list-sources':
          result = await handleListSources(args, sourceRepo);
          break;

        case 'get-recent-news':
          result = await handleGetRecentNews(args, articleRepo, sentimentRepo);
          break;

        case 'manage-sources':
          result = await handleManageSources(args, sourceRepo);
          break;

        case 'ask-sir-alex':
          result = await handleAskSirAlex(args, quoteSearchService);
          break;

        case 'get-random-quote':
          result = await handleGetRandomQuote(args, quoteRepo);
          break;

        case 'get-quotes-by-topic':
          result = await handleGetQuotesByTopic(args, quoteRepo);
          break;

        default:
          throw new Error(`Unknown tool: ${name}`);
      }

      return {
        content: [{ type: 'text', text: result }],
      };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : String(error);
      logger.error('Tool execution failed', {
        tool: name,
        error: errorMessage,
      });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ error: errorMessage }, null, 2),
          },
        ],
        isError: true,
      };
    }
  });

  return server;
}

function cleanupSessions(): void {
  const now = Date.now();
  const expired: string[] = [];

  for (const [sessionId, session] of sessions.entries()) {
    if (now - session.lastActivity > SESSION_TIMEOUT) {
      expired.push(sessionId);
    }
  }

  for (const sessionId of expired) {
    const session = sessions.get(sessionId);
    if (session) {
      session.server.close().catch((err) => {
        logger.error('Error closing session', { sessionId, error: err.message });
      });
      sessions.delete(sessionId);
      logger.info('Session expired and cleaned up', { sessionId });
    }
  }
}

setInterval(cleanupSessions, 60000);

async function initializeServices(): Promise<void> {
  logger.info('Initializing services');

  const pool = getPool();
  await pool.query('SELECT 1');
  logger.info('Database connection verified');

  await embeddingService.initialize();
  await sentimentService.initialize();

  logger.info('All services initialized');
}

const app = express();
app.use(express.json());

app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    sessions: sessions.size,
    timestamp: new Date().toISOString(),
  });
});

app.get('/ready', async (req, res) => {
  try {
    const pool = getPool();
    await pool.query('SELECT 1');
    res.json({
      status: 'ready',
      database: 'connected',
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    res.status(503).json({
      status: 'not ready',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.post('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string;

  if (!sessionId && req.body?.method === 'initialize') {
    if (sessions.size >= 100) {
      return res.status(503).json({ error: 'Session capacity reached' });
    }

    const newSessionId = `session-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const server = createServer();
    const transport = new StreamableHTTPServerTransport({
      enableJsonResponse: true,
      sessionIdGenerator: () => newSessionId,
    });

    server.onclose = () => {
      sessions.delete(newSessionId);
      logger.info('Session closed', { sessionId: newSessionId });
    };

    await server.connect(transport as any);
    sessions.set(newSessionId, { server, transport, lastActivity: Date.now() });
    res.setHeader('mcp-session-id', newSessionId);
    await transport.handleRequest(req, res, req.body);
  } else if (sessionId) {
    const session = sessions.get(sessionId);
    if (!session) return res.status(404).json({ error: 'Session not found' });
    session.lastActivity = Date.now();
    await session.transport.handleRequest(req, res, req.body);
  } else {
    res.status(400).json({ error: 'Session ID required' });
  }
});

app.get('/mcp', async (req, res) => {
  const sessionId = req.headers['mcp-session-id'] as string;
  if (!sessionId) return res.status(400).json({ error: 'Session ID required' });
  const session = sessions.get(sessionId);
  if (!session) return res.status(404).json({ error: 'Session not found' });
  session.lastActivity = Date.now();
  await session.transport.handleRequest(req, res);
});

async function shutdown(): Promise<void> {
  logger.info('Shutting down server');

  for (const [sessionId, session] of sessions.entries()) {
    await session.server.close();
    logger.info('Session closed', { sessionId });
  }

  await closePool();
  process.exit(0);
}

process.on('SIGTERM', shutdown);
process.on('SIGINT', shutdown);

(async () => {
  try {
    await initializeServices();

    app.listen(PORT, () => {
      logger.info('Soccer News MCP server started', { port: PORT });
    });
  } catch (error) {
    logger.error('Failed to start server', {
      error: error instanceof Error ? error.message : String(error),
    });
    process.exit(1);
  }
})();
