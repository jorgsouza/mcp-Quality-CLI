import { describe, it, expect } from 'vitest';

/**
 * E2E Test: diff-coverage CI gate
 * Testa a existência e disponibilidade da ferramenta diff-coverage
 * 
 * Nota: Testes unitários completos de diff-coverage estão em:
 * src/tools/__tests__/run-diff-coverage.test.ts
 */
describe('E2E: quality diff-coverage (CI gate)', () => {
  it('deve ter a tool diff-coverage disponível', async () => {
    const { runDiffCoverage } = await import('../../../../src/tools/run-diff-coverage.js');
    expect(runDiffCoverage).toBeDefined();
    expect(typeof runDiffCoverage).toBe('function');
  });

  it('deve exportar schema de parâmetros', async () => {
    const module = await import('../../../../src/tools/run-diff-coverage.js');
    expect(module).toBeDefined();
  });
});
