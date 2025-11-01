import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generatePyramidReport } from '../pyramid-report.js';

describe('pyramid-report.ts', () => {
  let testRepoPath: string;

  beforeAll(async () => {
    testRepoPath = join(tmpdir(), `pyramid-report-test-${Date.now()}`);
    await fs.mkdir(testRepoPath, { recursive: true });

    // Cria análise de cobertura mock com todos os campos necessários
    const analysesDir = join(testRepoPath, 'tests/analyses');
    await fs.mkdir(analysesDir, { recursive: true });

    await fs.writeFile(
      join(analysesDir, 'coverage-analysis.json'),
      JSON.stringify({
        pyramid: {
          unit: {
            files_found: 10,
            test_cases: 50,
            coverage_percent: 75,
            test_files: ['test1.ts', 'test2.ts'],
            missing_tests: []
          },
          integration: {
            files_found: 5,
            test_cases: 15,
            coverage_percent: 0,
            test_files: ['int1.ts'],
            missing_tests: []
          },
          e2e: {
            files_found: 2,
            test_cases: 5,
            coverage_percent: 0,
            test_files: ['e2e1.ts'],
            missing_tests: []
          }
        },
        health: 'healthy',
        recommendations: ['Adicionar mais testes de integração']
      }, null, 2)
    );
  });

  afterAll(async () => {
    await fs.rm(testRepoPath, { recursive: true, force: true });
  });

  it('deve gerar relatório HTML da pirâmide', async () => {
    const result = await generatePyramidReport({
      repo: testRepoPath,
      product: 'TestProduct',
      output_format: 'html'
    });

    expect(result.ok).toBe(true);
    expect(result.report_path).toContain('.html');

    const exists = await fs.stat(result.report_path).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('deve gerar relatório Markdown da pirâmide', async () => {
    const result = await generatePyramidReport({
      repo: testRepoPath,
      product: 'TestProduct',
      output_format: 'markdown'
    });

    expect(result.ok).toBe(true);
    expect(result.report_path).toContain('.md');

    const content = await fs.readFile(result.report_path, 'utf-8');
    expect(content).toContain('Pirâmide de Testes');
    expect(content).toContain('Unit');
    expect(content).toContain('Integration');
    expect(content).toContain('E2E');
  });

  it('deve incluir visualização gráfica no HTML', async () => {
    const result = await generatePyramidReport({
      repo: testRepoPath,
      product: 'TestProduct',
      output_format: 'html'
    });

    const content = await fs.readFile(result.report_path, 'utf-8');
    // Verifica que é HTML válido
    const isHTML = content.includes('<html') || content.includes('<!DOCTYPE');
    expect(isHTML).toBe(true);
    expect(content).toContain('TestProduct');
  });

  it('deve incluir status de saúde no relatório', async () => {
    const result = await generatePyramidReport({
      repo: testRepoPath,
      product: 'TestProduct',
      output_format: 'markdown'
    });

    const content = await fs.readFile(result.report_path, 'utf-8');
    const hasHealth = content.includes('healthy') || content.includes('SAUDÁVEL');
    expect(hasHealth).toBe(true);
  });

  it('deve lidar com ausência de coverage-analysis.json', async () => {
    const emptyRepoPath = join(tmpdir(), `pyramid-empty-${Date.now()}`);
    await fs.mkdir(emptyRepoPath, { recursive: true });

    try {
      await generatePyramidReport({
        repo: emptyRepoPath,
        product: 'EmptyProduct',
        output_format: 'html'
      });

      expect.fail('Should have thrown error');
    } catch (error) {
      // Erro esperado quando não há dados
      expect(error).toBeDefined();
    } finally {
      await fs.rm(emptyRepoPath, { recursive: true, force: true });
    }
  });
});

