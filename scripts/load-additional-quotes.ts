import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { QuoteRepository } from '../src/database/repositories/QuoteRepository.js';
import { EmbeddingService } from '../src/services/EmbeddingService.js';
import { getPool, closePool } from '../src/database/client.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface QuoteRow {
  quote: string;
  manager_name: string;
  context: string;
  topics: string;
}

function parseCSV(content: string): QuoteRow[] {
  const lines = content.split('\n');
  const rows: QuoteRow[] = [];

  // Skip header
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Parse CSV line handling quoted fields
    const fields: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];

      if (char === '"') {
        inQuotes = !inQuotes;
      } else if (char === ',' && !inQuotes) {
        fields.push(current.trim());
        current = '';
      } else {
        current += char;
      }
    }
    fields.push(current.trim());

    if (fields.length >= 4) {
      rows.push({
        quote: fields[0],
        manager_name: fields[1],
        context: fields[2],
        topics: fields[3],
      });
    }
  }

  return rows;
}

async function loadQuotes() {
  console.log('🏁 Starting quote loading process...');

  // Read CSV file
  const csvPath = join(__dirname, '../data/additional-quotes.csv');
  const csvContent = readFileSync(csvPath, 'utf-8');
  const rows = parseCSV(csvContent);

  console.log(`📄 Parsed ${rows.length} quotes from CSV`);

  // Initialize services
  const pool = getPool();
  await pool.query('SELECT 1');
  console.log('✅ Database connected');

  const embeddingService = new EmbeddingService();
  await embeddingService.initialize();
  console.log('✅ Embedding service initialized');

  const quoteRepo = new QuoteRepository();

  // Check for duplicates
  const existingQuotes = await quoteRepo.findAll();
  const existingQuoteTexts = new Set(existingQuotes.map(q => q.quote));

  let inserted = 0;
  let skipped = 0;

  for (const row of rows) {
    if (existingQuoteTexts.has(row.quote)) {
      console.log(`⏭️  Skipping duplicate: "${row.quote.substring(0, 50)}..."`);
      skipped++;
      continue;
    }

    try {
      // Generate embedding
      const embeddingResult = await embeddingService.generateEmbedding(row.quote);

      // Parse topics
      const topics = row.topics
        .split('|')
        .map(t => t.trim())
        .filter(t => t.length > 0);

      // Insert quote with embedding and topics
      await pool.query(
        `INSERT INTO manager_quotes (quote, manager_name, context, embedding, topics)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          row.quote,
          row.manager_name,
          row.context || null,
          `[${embeddingResult.embedding.join(',')}]`,
          topics.length > 0 ? topics : null,
        ]
      );

      console.log(`✅ Loaded: "${row.quote.substring(0, 50)}..." - ${row.manager_name} [${topics.join(', ')}]`);
      inserted++;

    } catch (error) {
      console.error(`❌ Error loading quote: "${row.quote.substring(0, 50)}..."`, error);
    }
  }

  console.log('\n📊 Summary:');
  console.log(`  ✅ Inserted: ${inserted}`);
  console.log(`  ⏭️  Skipped (duplicates): ${skipped}`);
  console.log(`  📦 Total in CSV: ${rows.length}`);

  await closePool();
  console.log('\n🏁 Quote loading complete!');
}

loadQuotes().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
