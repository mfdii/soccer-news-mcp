import { z } from 'zod';
import { SourceRepository } from '../database/repositories/SourceRepository.js';

const ManageSourcesSchema = z.object({
  action: z.enum(['add', 'update', 'delete', 'toggle']),
  sourceId: z.number().optional(),
  name: z.string().optional(),
  rssUrl: z.string().optional(),
  category: z.string().optional(),
  active: z.boolean().optional(),
});

export const manageSourcesTool = {
  name: 'manage-sources',
  description: 'Add, update, or remove RSS feed sources',
  inputSchema: {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['add', 'update', 'delete', 'toggle'],
        description: 'Action to perform',
      },
      sourceId: {
        type: 'number',
        description: 'Source ID (required for update/delete/toggle)',
      },
      name: {
        type: 'string',
        description: 'Source name (required for add)',
      },
      rssUrl: {
        type: 'string',
        description: 'RSS feed URL (required for add)',
      },
      category: {
        type: 'string',
        description: 'Category for the source',
      },
      active: {
        type: 'boolean',
        description: 'Whether the source is active',
      },
    },
    required: ['action'],
  },
};

export async function handleManageSources(
  args: unknown,
  sourceRepo: SourceRepository
): Promise<string> {
  const params = ManageSourcesSchema.parse(args);

  switch (params.action) {
    case 'add': {
      if (!params.name || !params.rssUrl) {
        throw new Error('name and rssUrl are required for add action');
      }

      const existing = await sourceRepo.findByUrl(params.rssUrl);
      if (existing) {
        return JSON.stringify({
          success: false,
          error: 'Source with this URL already exists',
          existingSource: existing,
        });
      }

      const source = await sourceRepo.create(
        params.name,
        params.rssUrl,
        params.category
      );

      return JSON.stringify({
        success: true,
        action: 'added',
        source,
      });
    }

    case 'update': {
      if (!params.sourceId) {
        throw new Error('sourceId is required for update action');
      }

      const source = await sourceRepo.update(params.sourceId, {
        name: params.name,
        rssUrl: params.rssUrl,
        category: params.category,
        active: params.active,
      });

      if (!source) {
        return JSON.stringify({
          success: false,
          error: 'Source not found',
        });
      }

      return JSON.stringify({
        success: true,
        action: 'updated',
        source,
      });
    }

    case 'delete': {
      if (!params.sourceId) {
        throw new Error('sourceId is required for delete action');
      }

      const deleted = await sourceRepo.delete(params.sourceId);

      return JSON.stringify({
        success: deleted,
        action: 'deleted',
        sourceId: params.sourceId,
      });
    }

    case 'toggle': {
      if (!params.sourceId) {
        throw new Error('sourceId is required for toggle action');
      }

      const current = await sourceRepo.findById(params.sourceId);
      if (!current) {
        return JSON.stringify({
          success: false,
          error: 'Source not found',
        });
      }

      const source = await sourceRepo.update(params.sourceId, {
        active: !current.active,
      });

      return JSON.stringify({
        success: true,
        action: 'toggled',
        source,
      });
    }

    default:
      throw new Error(`Unknown action: ${params.action}`);
  }
}
