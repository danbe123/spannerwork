import request from 'supertest';
import { app } from '../../src/app.js';

describe('Health endpoint', () => {
  it('returns valid health status', async () => {
    const res = await request(app).get('/health');

    // Health endpoint returns 200 (ok) or 503 (degraded) depending on dependencies
    // In test environment, Redis may not be available, resulting in degraded status
    expect([200, 503]).toContain(res.status);
    expect(['ok', 'degraded']).toContain(res.body.status);
    
    // Verify health response structure
    expect(res.body).toHaveProperty('timestamp');
    expect(res.body).toHaveProperty('uptime');
    expect(res.body).toHaveProperty('system');
    expect(res.body).toHaveProperty('dependencies');
    expect(res.body.dependencies).toHaveProperty('database');
    expect(res.body.dependencies).toHaveProperty('redis');
  });

  it('reports correct dependency status format', async () => {
    const res = await request(app).get('/health');

    // Verify dependency statuses are valid values
    expect(['ok', 'error']).toContain(res.body.dependencies.database);
    expect(['ok', 'error']).toContain(res.body.dependencies.redis);
    expect(['ok', 'error', 'unknown']).toContain(res.body.dependencies.workers);
    expect(['ok', 'error', 'unconfigured']).toContain(res.body.dependencies.storage);
  });
});
