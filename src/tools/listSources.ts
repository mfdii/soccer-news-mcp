import { z } from 'zod';
import { SourceRepository } from '../database/repositories/SourceRepository.js';

const ListSourcesSchema = z.object({
  activeOnly: z.boolean().optional(),
});

export const listSourcesTool = {
  name: 'list-sources',
  description: 'List configured RSS feed sources with statistics',
  inputSchema: {
    type: 'object',
    properties: {
      activeOnly: {
        type: 'boolean',
        description: 'Only show active sources',
      },
    },
  },
};

export async function handleListSources(
  args: unknown,
  sourceRepo: SourceRepository
): Promise<string> {
  const params = ListSourcesSchema.parse(args);

  const sources = await sourceRepo.findAll(params.activeOnly ?? false);

  const formatted = {
    totalSources: sources.length,
    activeSources: sources.filter((s) => s.active).length,
    sources: sources.map((s) => ({
      id: s.id,
      name: s.name,
      url: s.rssUrl,
      category: s.category,
      active: s.active,
      fetchCount: s.fetchCount,
      lastFetched: s.lastFetched,
      lastError: s.lastError,
    })),
  };

  return JSON.stringify(formatted, null, 2);
}
