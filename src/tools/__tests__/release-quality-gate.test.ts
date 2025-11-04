import { describe, it, expect, vi, beforeEach } from 'vitest';
import { releaseQualityGate } from '../release-quality-gate.js';
import * as fs from 'node:fs/promises';
import * as paths from '../../utils/paths.js';

vi.mock('node:fs/promises');
vi.mock('../../utils/paths.js');
vi.mock('../../utils/fs.js');

describe('releaseQualityGate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    vi.mocked(paths.getPaths).mockReturnValue({
      root: '/test/qa/TestProduct',
      analyses: '/test/qa/TestProduct/tests/analyses',
      reports: '/test/qa/TestProduct/tests/reports',
    } as any);
  });

  it('deve retornar exit_code=0 quando todos os gates passam', async () => {
    // Mock fileExists e writeFileSafe
    const { fileExists, writeFileSafe } = await import('../../utils/fs.js');
    vi.mocked(fileExists).mockResolvedValue(false); // Não há thresholds.json customizado
    vi.mocked(writeFileSafe).mockResolvedValue(undefined); // 🆕
    
    // Mock readFile com métricas boas
    vi.spyOn(fs, 'readFile').mockImplementation(async (path: any) => {
      if (path.includes('coverage')) {
        return JSON.stringify({
          lines: { pct: 85 },
          branches: { pct: 80 },
          functions: { pct: 85 }
        });
      }
      if (path.includes('mutation')) {
        return JSON.stringify({
          overallScore: 60,
          criticalScore: 70
        });
      }
      return JSON.stringify({});
    });
    
    const result = await releaseQualityGate({
      repo: '/test',
      product: 'TestProduct'
    });
    
    expect(result.exit_code).toBe(0);
    expect(result.summary.blocking_violations).toBe(0);
  });

  it('deve retornar exit_code=1 com violações bloqueantes', async () => {
    const { fileExists, writeFileSafe } = await import('../../utils/fs.js');
    vi.mocked(fileExists).mockImplementation(async (path: any) => {
      if (path.includes('thresholds.json')) return false;
      if (path.includes('mutation-score.json')) return true;
      if (path.includes('coverage-analysis.json')) return true;
      return false;
    });
    vi.mocked(writeFileSafe).mockResolvedValue(undefined);
    
    // Mock fs.readFile para retornar dados mockados
    vi.spyOn(fs, 'readFile').mockImplementation(async (path: any) => {
      const pathStr = path.toString();
      if (pathStr.includes('mutation')) {
        return JSON.stringify({
          overallScore: 55,
          criticalScore: 40, // < 60% (bloqueante!)
          passed: false
        });
      }
      if (pathStr.includes('coverage')) {
        return JSON.stringify({
          coverage: {
            lines: 85
          },
          lines: 85
        });
      }
      return JSON.stringify({});
    });
    
    const result = await releaseQualityGate({
      repo: '/test',
      product: 'TestProduct'
    });
    
    expect(result.exit_code).toBe(1);
    expect(result.summary.blocking_violations).toBeGreaterThan(0);
  });

  it('deve retornar exit_code=2 com apenas warnings', async () => {
    const { fileExists, writeFileSafe } = await import('../../utils/fs.js');
    vi.mocked(fileExists).mockImplementation(async (path: any) => {
      if (path.includes('thresholds.json')) return false;
      if (path.includes('mutation-score.json')) return true;
      if (path.includes('coverage-analysis.json')) return true;
      return false;
    });
    vi.mocked(writeFileSafe).mockResolvedValue(undefined);
    
    vi.spyOn(fs, 'readFile').mockImplementation(async (path: any) => {
      const pathStr = path.toString();
      if (pathStr.includes('coverage')) {
        return JSON.stringify({
          coverage: {
            lines: 70 // < 80% (warning)
          },
          lines: 70
        });
      }
      if (pathStr.includes('mutation')) {
        return JSON.stringify({
          overallScore: 65, // OK
          criticalScore: 65 // OK
        });
      }
      return JSON.stringify({});
    });
    
    const result = await releaseQualityGate({
      repo: '/test',
      product: 'TestProduct'
    });
    
    expect(result.exit_code).toBe(2);
    expect(result.summary.non_blocking_violations).toBeGreaterThan(0);
  });
});

