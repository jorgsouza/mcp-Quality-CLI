import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { runCoverageAnalysis } from '../run-coverage';

describe('runCoverageAnalysis', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `/tmp/coverage-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve executar cobertura e analisar resultados com status excellent', async () => {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        scripts: { 'test:coverage': 'echo ok' },
        devDependencies: { vitest: '^2.0.0' }
      })
    );

    await fs.mkdir(join(testDir, 'coverage'), { recursive: true });
    await fs.mkdir(join(testDir, 'tests/analyses'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'coverage/coverage-summary.json'),
      JSON.stringify({
        total: {
          lines: { total: 100, covered: 85, pct: 85 },
          functions: { total: 20, covered: 18, pct: 90 },
          branches: { total: 40, covered: 35, pct: 87.5 },
          statements: { total: 100, covered: 85, pct: 85 }
        }
      })
    );

    const result = await runCoverageAnalysis({ repo: testDir });

    expect(result.ok).toBe(true);
    expect(result.summary.lines.pct).toBe(85);
    expect(result.analysis.status).toBe('excellent');
    expect(result.analysis.meetsThresholds).toBe(true);
  });

  it('deve identificar gaps quando cobertura baixa (critical)', async () => {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        scripts: { 'test:coverage': 'echo ok' },
        devDependencies: { vitest: '^2.0.0' }
      })
    );

    await fs.mkdir(join(testDir, 'coverage'), { recursive: true });
    await fs.mkdir(join(testDir, 'tests/analyses'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'coverage/coverage-summary.json'),
      JSON.stringify({
        total: {
          lines: { total: 100, covered: 40, pct: 40 },
          functions: { total: 20, covered: 8, pct: 40 },
          branches: { total: 40, covered: 16, pct: 40 },
          statements: { total: 100, covered: 40, pct: 40 }
        }
      })
    );

    const result = await runCoverageAnalysis({ repo: testDir });

    expect(result.ok).toBe(true);
    expect(result.analysis.status).toBe('critical');
    expect(result.analysis.meetsThresholds).toBe(false);
    expect(result.analysis.gaps.length).toBeGreaterThan(0);
    expect(result.analysis.recommendations.length).toBeGreaterThan(0);
  });

  it('deve identificar status good quando cobertura está entre 70-80%', async () => {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        scripts: { 'test:coverage': 'echo ok' },
        devDependencies: { vitest: '^2.0.0' }
      })
    );

    await fs.mkdir(join(testDir, 'coverage'), { recursive: true });
    await fs.mkdir(join(testDir, 'tests/analyses'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'coverage/coverage-summary.json'),
      JSON.stringify({
        total: {
          lines: { total: 100, covered: 75, pct: 75 },
          functions: { total: 20, covered: 15, pct: 75 },
          branches: { total: 40, covered: 30, pct: 75 },
          statements: { total: 100, covered: 75, pct: 75 }
        }
      })
    );

    const result = await runCoverageAnalysis({ repo: testDir });

    expect(result.ok).toBe(true);
    expect(result.analysis.status).toBe('good');
    expect(result.analysis.meetsThresholds).toBe(true);
  });

  it('deve priorizar arquivos com menor cobertura', async () => {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        scripts: { 'test:coverage': 'echo ok' },
        devDependencies: { vitest: '^2.0.0' }
      })
    );

    await fs.mkdir(join(testDir, 'coverage'), { recursive: true });
    await fs.mkdir(join(testDir, 'tests/analyses'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'coverage/coverage-summary.json'),
      JSON.stringify({
        total: {
          lines: { total: 200, covered: 100, pct: 50 },
          functions: { total: 40, covered: 20, pct: 50 },
          branches: { total: 80, covered: 40, pct: 50 },
          statements: { total: 200, covered: 100, pct: 50 }
        },
        'src/file1.ts': {
          lines: { total: 100, covered: 10, pct: 10 },
          functions: { total: 20, covered: 2, pct: 10 },
          branches: { total: 40, covered: 4, pct: 10 },
          statements: { total: 100, covered: 10, pct: 10 }
        },
        'src/file2.ts': {
          lines: { total: 100, covered: 90, pct: 90 },
          functions: { total: 20, covered: 18, pct: 90 },
          branches: { total: 40, covered: 36, pct: 90 },
          statements: { total: 100, covered: 90, pct: 90 }
        }
      })
    );

    const result = await runCoverageAnalysis({ repo: testDir });

    expect(result.files.length).toBe(2);
    expect(result.files[0].path).toContain('file1');
    expect(result.files[0].lines).toBe(10);
    expect(result.analysis.priorities.length).toBeGreaterThan(0);
    expect(result.analysis.priorities[0].priority).toBe('high');
  });

  it('deve gerar relatório detalhado em Markdown', async () => {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        scripts: { 'test:coverage': 'echo ok' },
        devDependencies: { vitest: '^2.0.0' }
      })
    );

    await fs.mkdir(join(testDir, 'coverage'), { recursive: true });
    await fs.mkdir(join(testDir, 'tests/analyses'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'coverage/coverage-summary.json'),
      JSON.stringify({
        total: {
          lines: { total: 100, covered: 70, pct: 70 },
          functions: { total: 20, covered: 14, pct: 70 },
          branches: { total: 40, covered: 28, pct: 70 },
          statements: { total: 100, covered: 70, pct: 70 }
        }
      })
    );

    const result = await runCoverageAnalysis({ repo: testDir });

    expect(result.reportPath).toBeDefined();
    expect(result.reportPath).toContain('COVERAGE-ANALYSIS.md');

    const reportExists = await fs
      .access(result.reportPath)
      .then(() => true)
      .catch(() => false);
    expect(reportExists).toBe(true);

    const reportContent = await fs.readFile(result.reportPath, 'utf-8');
    expect(reportContent).toContain('Relatório de Cobertura');
    expect(reportContent).toContain('70');
  });

  it('deve usar thresholds customizados', async () => {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        scripts: { 'test:coverage': 'echo ok' },
        devDependencies: { vitest: '^2.0.0' }
      })
    );

    await fs.mkdir(join(testDir, 'coverage'), { recursive: true });
    await fs.mkdir(join(testDir, 'tests/analyses'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'coverage/coverage-summary.json'),
      JSON.stringify({
        total: {
          lines: { total: 100, covered: 60, pct: 60 },
          functions: { total: 20, covered: 12, pct: 60 },
          branches: { total: 40, covered: 24, pct: 60 },
          statements: { total: 100, covered: 60, pct: 60 }
        }
      })
    );

    const result = await runCoverageAnalysis({
      repo: testDir,
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50
      }
    });

    expect(result.ok).toBe(true);
    expect(result.analysis.meetsThresholds).toBe(true);
  });

  it('deve lidar com arquivo de cobertura inexistente', async () => {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        scripts: { 'test:coverage': 'exit 1' },
        devDependencies: { vitest: '^2.0.0' }
      })
    );

    await fs.mkdir(join(testDir, 'tests/analyses'), { recursive: true });

    const result = await runCoverageAnalysis({ repo: testDir });

    expect(result.ok).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('deve calcular gaps corretamente', async () => {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        scripts: { 'test:coverage': 'echo ok' },
        devDependencies: { vitest: '^2.0.0' }
      })
    );

    await fs.mkdir(join(testDir, 'coverage'), { recursive: true });
    await fs.mkdir(join(testDir, 'tests/analyses'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'coverage/coverage-summary.json'),
      JSON.stringify({
        total: {
          lines: { total: 1000, covered: 500, pct: 50 },
          functions: { total: 100, covered: 60, pct: 60 },
          branches: { total: 200, covered: 120, pct: 60 },
          statements: { total: 1000, covered: 500, pct: 50 }
        }
      })
    );

    const result = await runCoverageAnalysis({ repo: testDir });

    expect(result.ok).toBe(true);
    const linesGap = result.analysis.recommendations.find(g => g.includes('linhas'));
    expect(linesGap).toBeDefined();
    expect(linesGap).toContain('200 linhas');
  });

  it('deve gerar recomendações específicas baseadas nos gaps', async () => {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        scripts: { 'test:coverage': 'echo ok' },
        devDependencies: { vitest: '^2.0.0' }
      })
    );

    await fs.mkdir(join(testDir, 'coverage'), { recursive: true });
    await fs.mkdir(join(testDir, 'tests/analyses'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'coverage/coverage-summary.json'),
      JSON.stringify({
        total: {
          lines: { total: 100, covered: 45, pct: 45 },
          functions: { total: 20, covered: 12, pct: 60 },
          branches: { total: 40, covered: 25, pct: 62.5 },
          statements: { total: 100, covered: 45, pct: 45 }
        },
        'src/critical.ts': {
          lines: { total: 50, covered: 5, pct: 10 },
          functions: { total: 10, covered: 1, pct: 10 },
          branches: { total: 20, covered: 2, pct: 10 },
          statements: { total: 50, covered: 5, pct: 10 }
        }
      })
    );

    const result = await runCoverageAnalysis({ repo: testDir });

    expect(result.ok).toBe(true);
    expect(result.analysis.recommendations.length).toBeGreaterThan(0);
    expect(result.analysis.recommendations.some(r => r.includes('testes'))).toBe(true);
  });

  it('deve classificar prioridades corretamente (high, medium, low)', async () => {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        scripts: { 'test:coverage': 'echo ok' },
        devDependencies: { vitest: '^2.0.0' }
      })
    );

    await fs.mkdir(join(testDir, 'coverage'), { recursive: true });
    await fs.mkdir(join(testDir, 'tests/analyses'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'coverage/coverage-summary.json'),
      JSON.stringify({
        total: {
          lines: { total: 300, covered: 150, pct: 50 },
          functions: { total: 60, covered: 30, pct: 50 },
          branches: { total: 120, covered: 60, pct: 50 },
          statements: { total: 300, covered: 150, pct: 50 }
        },
        'src/critical.ts': {
          lines: { total: 100, covered: 20, pct: 20 },
          functions: { total: 20, covered: 4, pct: 20 },
          branches: { total: 40, covered: 8, pct: 20 },
          statements: { total: 100, covered: 20, pct: 20 }
        },
        'src/medium.ts': {
          lines: { total: 100, covered: 55, pct: 55 },
          functions: { total: 20, covered: 11, pct: 55 },
          branches: { total: 40, covered: 22, pct: 55 },
          statements: { total: 100, covered: 55, pct: 55 }
        },
        'src/good.ts': {
          lines: { total: 100, covered: 75, pct: 75 },
          functions: { total: 20, covered: 15, pct: 75 },
          branches: { total: 40, covered: 30, pct: 75 },
          statements: { total: 100, covered: 75, pct: 75 }
        }
      })
    );

    const result = await runCoverageAnalysis({ repo: testDir });

    expect(result.ok).toBe(true);
    expect(result.analysis.priorities.length).toBe(3);
    
    const highPriority = result.analysis.priorities.find(p => p.priority === 'high');
    const mediumPriority = result.analysis.priorities.find(p => p.priority === 'medium');
    const lowPriority = result.analysis.priorities.find(p => p.priority === 'low');
    
    expect(highPriority).toBeDefined();
    expect(mediumPriority).toBeDefined();
    expect(lowPriority).toBeDefined();
  });
});

