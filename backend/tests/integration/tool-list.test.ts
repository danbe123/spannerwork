import request from 'supertest';
import { app } from '../../src/app.js';
import { toolService } from '../../src/services/tool.service.js';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('Tool routes', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('GET /api/v1/tools returns tool list', async () => {
    const listMock = vi.spyOn(toolService, 'list').mockResolvedValue({
      data: [
        {
          id: 'tool-1',
          name: 'Cordless Drill',
        },
      ],
      pagination: {
        page: 1,
        limit: 20,
        total: 1,
        totalPages: 1,
      },
    } as any);

    const res = await request(app).get('/api/v1/tools');

    expect(res.status).toBe(200);
    expect(listMock).toHaveBeenCalled();
    expect(res.body.data[0].id).toBe('tool-1');
  });
});
