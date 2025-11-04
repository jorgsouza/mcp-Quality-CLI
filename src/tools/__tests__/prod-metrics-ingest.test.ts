import { describe, it, expect, vi, beforeEach } from 'vitest';
import { prodMetricsIngest } from '../prod-metrics-ingest.js';
import * as paths from '../../utils/paths.js';

vi.mock('../../utils/paths.js');
vi.mock('../../utils/fs.js');
vi.mock('../../adapters/sentry-adapter.js');
vi.mock('../../adapters/datadog-adapter.js');

describe('prodMetricsIngest', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(paths.getPaths).mockReturnValue({
      root: '/test/qa/TestProduct',
      analyses: '/test/qa/TestProduct/tests/analyses',
    } as any);
  });

  it('deve coletar métricas e calcular DORA', async () => {
    const { writeFileSafe } = await import('../../utils/fs.js');
    vi.mocked(writeFileSafe).mockResolvedValue(undefined);
    
    const result = await prodMetricsIngest({
      repo: '/test',
      product: 'TestProduct',
      sources: {}
    });
    
    expect(result.ok).toBe(true);
    expect(result.dora_metrics).toBeDefined();
    expect(result.dora_metrics.deployment_frequency).toBeGreaterThanOrEqual(0);
    expect(result.dora_metrics.change_failure_rate).toBeGreaterThanOrEqual(0);
    expect(result.dora_metrics.mttr_minutes).toBeGreaterThanOrEqual(0);
    expect(result.dora_metrics.dora_tier).toMatch(/Elite|High|Medium|Low/);
  });

  it('deve calcular DORA tier corretamente', async () => {
    const { writeFileSafe } = await import('../../utils/fs.js');
    vi.mocked(writeFileSafe).mockResolvedValue(undefined);
    
    const result = await prodMetricsIngest({
      repo: '/test',
      product: 'TestProduct',
      sources: {}
    });
    
    expect(['Elite', 'High', 'Medium', 'Low']).toContain(result.dora_metrics.dora_tier);
  });

  it('deve usar mock data quando credenciais não fornecidas', async () => {
    const { writeFileSafe } = await import('../../utils/fs.js');
    vi.mocked(writeFileSafe).mockResolvedValue(undefined);
    
    const result = await prodMetricsIngest({
      repo: '/test',
      product: 'TestProduct',
      sources: {} // Sem credenciais
    });
    
    expect(result.ok).toBe(true);
    expect(result.releases.length).toBeGreaterThan(0);
  });
});

