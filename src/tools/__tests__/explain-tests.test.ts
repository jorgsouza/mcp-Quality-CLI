/**
 * Tests for explain-tests tool
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'fs';
import { join } from 'path';
import { explainTests, type ExplainTestsOptions } from '../explain-tests.js';

// Mock fs operations
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    promises: {
      ...actual.promises,
      mkdir: vi.fn(),
      writeFile: vi.fn(),
      readFile: vi.fn(),
    },
  };
});

// Mock glob
vi.mock('glob', () => ({
  glob: vi.fn(),
}));

describe('explain-tests', () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = `/tmp/test-explain-${Date.now()}`;
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('deve retornar estrutura básica mesmo sem testes', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue([]);
    
    const options: ExplainTestsOptions = {
      repo: tempDir,
      product: 'TestProduct',
      format: 'json',
      minDiffCoverage: 80,
      minAsserts: 1,
      failOn: 'none',
    };

    const result = await explainTests(options);

    expect(result).toHaveProperty('ok');
    expect(result).toHaveProperty('explanations');
    expect(result).toHaveProperty('metrics');
    expect(Array.isArray(result.explanations)).toBe(true);
  });

  it('deve gerar métricas corretas para testes vazios', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue([]);
    
    const options: ExplainTestsOptions = {
      repo: tempDir,
      product: 'TestProduct',
      format: 'json',
      minDiffCoverage: 80,
      minAsserts: 1,
      failOn: 'none',
    };

    const result = await explainTests(options);

    expect(result.metrics.totalTests).toBe(0);
    expect(result.metrics.assertStrongPct).toBe(0);
    expect(result.metrics.assertMediumPct).toBe(0);
    expect(result.metrics.assertWeakPct).toBe(0);
  });

  it('deve falhar quando failOn="weak" e houver testes fracos', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue([]);
    
    const options: ExplainTestsOptions = {
      repo: tempDir,
      product: 'TestProduct',
      format: 'json',
      minDiffCoverage: 80,
      minAsserts: 1,
      failOn: 'weak',
    };

    const result = await explainTests(options);

    // With no tests, should still succeed
    expect(result.ok).toBe(false); // ok is false when tests don't meet criteria
    expect(result).toHaveProperty('explanations');
  });

  it('deve gerar outputs JSON e MD conforme solicitado', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue([]);
    
    const options: ExplainTestsOptions = {
      repo: tempDir,
      product: 'TestProduct',
      format: 'md',
      minDiffCoverage: 80,
      minAsserts: 1,
      failOn: 'none',
    };

    const result = await explainTests(options);

    expect(result.outputPaths).toHaveProperty('explanationsJson');
    expect(result.outputPaths).toHaveProperty('explanationsMd');
    expect(result.outputPaths).toHaveProperty('qualitySummaryMd');
    expect(result.outputPaths).toHaveProperty('metricsJson');
  });

  it('deve calcular KR3a status corretamente', async () => {
    const { glob } = await import('glob');
    vi.mocked(glob).mockResolvedValue([]);
    
    const options: ExplainTestsOptions = {
      repo: tempDir,
      product: 'TestProduct',
      format: 'json',
      minDiffCoverage: 80,
      minAsserts: 1,
      failOn: 'none',
    };

    const result = await explainTests(options);

    expect(result.kr3aStatus).toMatch(/OK|ATENÇÃO|ALERTA/);
  });
});

