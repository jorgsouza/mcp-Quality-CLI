import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { analyzeTestCoverage } from '../../src/tools/coverage.js';
import { generatePyramidReport } from '../../src/tools/pyramid-report.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Fluxo: Coverage → Recommendations', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `coverage-integration-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 1. Coverage gera recomendações
  it('deve gerar recomendações baseadas na cobertura atual', async () => {
    // Criar testes com pirâmide invertida
    await fs.mkdir(join(testDir, 'src/__tests__'), { recursive: true });
    await fs.writeFile(join(testDir, 'src/__tests__/unit.test.ts'), `
      import { it } from 'vitest';
      it('test', () => {});
    `);

    await fs.mkdir(join(testDir, 'tests/e2e'), { recursive: true });
    for (let i = 1; i <= 5; i++) {
      await fs.writeFile(join(testDir, `tests/e2e/e2e${i}.spec.ts`), `
        import { test } from '@playwright/test';
        test('test', async () => {});
      `);
    }

    // Executar análise de cobertura
    const coverage = await analyzeTestCoverage({
      repo: testDir,
      product: 'Test App'
    });

    expect(coverage.summary).toBeDefined();
    expect(coverage.summary).toContain('Status:');
    expect(coverage.pyramid.unit.files_found).toBeGreaterThanOrEqual(0);
    expect(coverage.pyramid.e2e.files_found).toBeGreaterThanOrEqual(0);
    
    // Deve detectar pirâmide invertida
    expect(coverage.health).toBe('inverted');
    
    // Deve ter recomendações
    expect(coverage.recommendations.length).toBeGreaterThan(0);
    
    // Deve recomendar mais unit tests
    const hasUnitRecommendation = coverage.recommendations.some(r => 
      r.toLowerCase().includes('unit') || r.toLowerCase().includes('unitário')
    );
    expect(hasUnitRecommendation).toBe(true);
  });

  // 2. Pyramid report usa dados de coverage
  it('deve usar coverage analysis para gerar relatório visual', async () => {
    // Criar pirâmide saudável
    await fs.mkdir(join(testDir, 'src/__tests__'), { recursive: true });
    for (let i = 1; i <= 7; i++) {
      await fs.writeFile(join(testDir, `src/__tests__/unit${i}.test.ts`), `
        import { it } from 'vitest';
        it('test', () => {});
      `);
    }

    await fs.mkdir(join(testDir, 'tests/integration'), { recursive: true });
    for (let i = 1; i <= 2; i++) {
      await fs.writeFile(join(testDir, `tests/integration/int${i}.test.ts`), `
        import { it } from 'vitest';
        import request from 'supertest';
        it('test', () => {});
      `);
    }

    await fs.mkdir(join(testDir, 'tests/e2e'), { recursive: true });
    await fs.writeFile(join(testDir, 'tests/e2e/e2e.spec.ts'), `
      import { test } from '@playwright/test';
      test('test', async () => {});
    `);

    // Passo 1: Executar análise de cobertura
    const coverage = await analyzeTestCoverage({
      repo: testDir,
      product: 'Healthy App'
    });

    expect(coverage.health).toBe('healthy');

    // Passo 2: Gerar relatório visual da pirâmide
    const pyramidReport = await generatePyramidReport({
      repo: testDir,
      product: 'Healthy App',
      output_format: 'html'
    });

    expect(pyramidReport.ok).toBe(true);
    expect(pyramidReport.report_path).toBeDefined();

    // Verificar se relatório HTML foi criado
    const htmlPath = join(testDir, 'tests/analyses/PYRAMID-REPORT.html');
    const htmlExists = await fs.access(htmlPath).then(() => true).catch(() => false);
    
    expect(htmlExists).toBe(true);

    if (htmlExists) {
      const htmlContent = await fs.readFile(htmlPath, 'utf-8');
      
      // HTML deve conter visualização da pirâmide (aceita maiúsculo ou minúsculo)
      expect(
        htmlContent.includes('Pirâmide') || 
        htmlContent.includes('Pyramid')
      ).toBe(true);
      
      expect(
        htmlContent.includes('Unit') || 
        htmlContent.includes('unit') || 
        htmlContent.includes('UNIT')
      ).toBe(true);
      
      expect(
        htmlContent.includes('E2E') || 
        htmlContent.includes('e2e')
      ).toBe(true);
      
      // Deve ter dados de cobertura
      expect(htmlContent.length).toBeGreaterThan(500);
    }
  });

  // Teste adicional: fluxo completo com recomendações específicas
  it('deve gerar recomendações específicas baseadas em gaps', async () => {
    // Criar apenas E2E tests (sem unit/integration)
    await fs.mkdir(join(testDir, 'tests/e2e'), { recursive: true });
    await fs.writeFile(join(testDir, 'tests/e2e/test.spec.ts'), `
      import { test } from '@playwright/test';
      test('test', async () => {});
    `);

    // Criar arquivos fonte sem testes
    await fs.mkdir(join(testDir, 'src'), { recursive: true });
    await fs.writeFile(join(testDir, 'src/utils.ts'), 'export function util() {}');
    await fs.writeFile(join(testDir, 'src/service.ts'), 'export class Service {}');

    const coverage = await analyzeTestCoverage({
      repo: testDir,
      product: 'Gap App'
    });

    // Deve detectar falta de unit tests
    expect(coverage.pyramid.unit.files_found).toBe(0);
    expect(coverage.pyramid.unit.missing_tests.length).toBeGreaterThan(0);
    
    // Deve ter recomendações específicas
    expect(coverage.recommendations.length).toBeGreaterThan(0);

    // Gerar relatório
    const report = await generatePyramidReport({
      repo: testDir,
      product: 'Gap App',
      output_format: 'markdown'
    });

    expect(report.ok).toBe(true);

    const mdPath = join(testDir, 'tests/analyses/PYRAMID-REPORT.md');
    const mdExists = await fs.access(mdPath).then(() => true).catch(() => false);
    
    if (mdExists) {
      const mdContent = await fs.readFile(mdPath, 'utf-8');
      
      // Relatório deve mencionar os gaps
      expect(mdContent.length).toBeGreaterThan(100);
    }
  });
});

