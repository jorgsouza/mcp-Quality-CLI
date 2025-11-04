import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runMutationTests } from '../run-mutation-tests.js';
import * as fs from 'node:fs/promises';
import * as paths from '../../utils/paths.js';

vi.mock('node:fs/promises');
vi.mock('../../utils/paths.js');
vi.mock('../../runners/mutation-runner.js');
vi.mock('../../adapters/index.js');

describe('runMutationTests', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock getPaths
    vi.mocked(paths.getPaths).mockReturnValue({
      root: '/test/qa/TestProduct',
      analyses: '/test/qa/TestProduct/tests/analyses',
      reports: '/test/qa/TestProduct/tests/reports',
    } as any);
  });

  it('deve executar mutation tests com sucesso', async () => {
    // Mock fileExists
    vi.spyOn(fs, 'access').mockResolvedValue(undefined);
    
    // Mock readFile para risk-register.json
    vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({
      high_risk: [
        { file: 'src/payment.ts', risk_score: 95 }
      ]
    }));
    
    // Mock mutation runner
    const { runMutationAuto } = await import('../../runners/mutation-runner.js');
    vi.mocked(runMutationAuto).mockResolvedValue({
      ok: true,
      language: 'typescript',
      framework: 'stryker',
      total_mutants: 100,
      killed: 60,
      survived: 30,
      timeout: 10,
      score: 60,
      output: '/test/mutation.json'
    } as any);
    
    // Mock getLanguageAdapter
    const { getLanguageAdapter } = await import('../../adapters/index.js');
    vi.mocked(getLanguageAdapter).mockResolvedValue({
      language: 'typescript',
      detectFramework: vi.fn().mockResolvedValue({ name: 'vitest' })
    } as any);
    
    const result = await runMutationTests({
      repo: '/test',
      product: 'TestProduct',
      minScore: 0.5
    });
    
    expect(result.ok).toBe(true);
    expect(result.overallScore).toBeGreaterThanOrEqual(0);
    expect(result.passed).toBe(true);
  });

  it('deve retornar passed=false se score < minScore', async () => {
    vi.spyOn(fs, 'access').mockResolvedValue(undefined);
    vi.spyOn(fs, 'readFile').mockResolvedValue(JSON.stringify({ high_risk: [] }));
    
    const { runMutationAuto } = await import('../../runners/mutation-runner.js');
    vi.mocked(runMutationAuto).mockResolvedValue({
      ok: true,
      language: 'typescript',
      framework: 'stryker',
      total_mutants: 100,
      killed: 30, // 30% score
      survived: 70,
      timeout: 0,
      score: 30,
      output: '/test/mutation.json'
    } as any);
    
    const { getLanguageAdapter } = await import('../../adapters/index.js');
    vi.mocked(getLanguageAdapter).mockResolvedValue({
      language: 'typescript',
      detectFramework: vi.fn().mockResolvedValue({ name: 'vitest' })
    } as any);
    
    const result = await runMutationTests({
      repo: '/test',
      product: 'TestProduct',
      minScore: 0.5 // 50% required
    });
    
    expect(result.ok).toBe(true);
    expect(result.passed).toBe(false);
    expect(result.overallScore).toBe(30);
  });

  it('deve lidar com erro graciosamente', async () => {
    vi.spyOn(fs, 'access').mockRejectedValue(new Error('File not found'));
    
    const result = await runMutationTests({
      repo: '/test',
      product: 'TestProduct',
      minScore: 0.5
    });
    
    expect(result.ok).toBe(false);
  });
});

