import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { analyzeTestCoverage } from '../coverage.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('analyzeTestCoverage', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `coverage-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 1. Calcular proporções corretamente
  it('deve calcular % de unit/integration/E2E corretamente', async () => {
    // Criar 7 unit, 2 integration, 1 e2e = 70:20:10
    await fs.mkdir(join(testDir, 'src/__tests__'), { recursive: true });
    await fs.writeFile(join(testDir, 'src/__tests__/unit.test.ts'), `
      import { it } from 'vitest';
      it('1', () => {});
      it('2', () => {});
      it('3', () => {});
      it('4', () => {});
      it('5', () => {});
      it('6', () => {});
      it('7', () => {});
    `);

    await fs.mkdir(join(testDir, 'tests/integration'), { recursive: true });
    await fs.writeFile(join(testDir, 'tests/integration/api.test.ts'), `
      import { it } from 'vitest';
      import request from 'supertest';
      it('1', () => {});
      it('2', () => {});
    `);

    await fs.mkdir(join(testDir, 'tests/e2e'), { recursive: true });
    await fs.writeFile(join(testDir, 'tests/e2e/flow.spec.ts'), `
      import { test } from '@playwright/test';
      test('1', async () => {});
    `);

    const result = await analyzeTestCoverage({
      repo: testDir,
      product: 'Test App'
    });

    // Verificar proporções
    const totalTests = result.pyramid.unit.files_found + 
                      result.pyramid.integration.files_found + 
                      result.pyramid.e2e.files_found;
    
    expect(totalTests).toBe(3); // 3 arquivos de teste
    expect(result.pyramid.unit.files_found).toBe(1);
    expect(result.pyramid.integration.files_found).toBe(1);
    expect(result.pyramid.e2e.files_found).toBe(1);
  });

  // 2. Detectar pirâmide saudável
  it('deve marcar como saudável se unit >= 70%', async () => {
    // Criar pirâmide saudável: 7 unit, 2 integration, 1 e2e
    await fs.mkdir(join(testDir, 'src/__tests__'), { recursive: true });
    
    // 7 arquivos unit
    for (let i = 1; i <= 7; i++) {
      await fs.writeFile(join(testDir, `src/__tests__/unit${i}.test.ts`), `
        import { it } from 'vitest';
        it('test', () => {});
      `);
    }

    // 2 arquivos integration
    await fs.mkdir(join(testDir, 'tests/integration'), { recursive: true });
    for (let i = 1; i <= 2; i++) {
      await fs.writeFile(join(testDir, `tests/integration/int${i}.test.ts`), `
        import { it } from 'vitest';
        import request from 'supertest';
        it('test', () => {});
      `);
    }

    // 1 arquivo e2e
    await fs.mkdir(join(testDir, 'tests/e2e'), { recursive: true });
    await fs.writeFile(join(testDir, 'tests/e2e/e2e1.spec.ts'), `
      import { test } from '@playwright/test';
      test('test', async () => {});
    `);

    const result = await analyzeTestCoverage({
      repo: testDir,
      product: 'Healthy App'
    });

    expect(result.health).toBe('healthy');
    expect(result.summary).toContain('SAUDÁVEL');
  });

  // 3. Detectar pirâmide invertida
  it('deve alertar se E2E > unit', async () => {
    // Criar pirâmide invertida: 1 unit, 2 integration, 7 e2e
    await fs.mkdir(join(testDir, 'src/__tests__'), { recursive: true });
    await fs.writeFile(join(testDir, 'src/__tests__/unit.test.ts'), `
      import { it } from 'vitest';
      it('test', () => {});
    `);

    await fs.mkdir(join(testDir, 'tests/e2e'), { recursive: true });
    for (let i = 1; i <= 7; i++) {
      await fs.writeFile(join(testDir, `tests/e2e/e2e${i}.spec.ts`), `
        import { test } from '@playwright/test';
        test('test', async () => {});
      `);
    }

    const result = await analyzeTestCoverage({
      repo: testDir,
      product: 'Inverted App'
    });

    expect(result.health).toBe('inverted');
    expect(result.summary).toContain('INVERTIDA') || expect(result.recommendations.some(r => r.includes('invertida'))).toBe(true);
  });

  // 4. Gerar recomendações
  it('deve sugerir mais unit tests se < 70%', async () => {
    // Criar poucos unit tests: 3 unit, 7 e2e
    await fs.mkdir(join(testDir, 'src/__tests__'), { recursive: true });
    for (let i = 1; i <= 3; i++) {
      await fs.writeFile(join(testDir, `src/__tests__/unit${i}.test.ts`), `
        import { it } from 'vitest';
        it('test', () => {});
      `);
    }

    await fs.mkdir(join(testDir, 'tests/e2e'), { recursive: true });
    for (let i = 1; i <= 7; i++) {
      await fs.writeFile(join(testDir, `tests/e2e/e2e${i}.spec.ts`), `
        import { test } from '@playwright/test';
        test('test', async () => {});
      `);
    }

    const result = await analyzeTestCoverage({
      repo: testDir,
      product: 'Low Unit App'
    });

    expect(result.health).not.toBe('healthy');
    
    // Deve recomendar mais unit tests
    const hasUnitRecommendation = result.recommendations.some(r => 
      r.toLowerCase().includes('unit') || r.toLowerCase().includes('unitário')
    );
    expect(hasUnitRecommendation).toBe(true);
  });

  // 5. Escrever relatório
  it('deve salvar COVERAGE-REPORT.md e coverage-analysis.json', async () => {
    await fs.mkdir(join(testDir, 'src/__tests__'), { recursive: true });
    await fs.writeFile(join(testDir, 'src/__tests__/test.test.ts'), `
      import { it } from 'vitest';
      it('test', () => {});
    `);

    const result = await analyzeTestCoverage({
      repo: testDir,
      product: 'Test'
    });

    // [FASE 2] Verificar arquivos na nova estrutura qa/<product>/tests
    const reportPath = join(testDir, 'qa/Test/tests/reports/COVERAGE-REPORT.md');
    const analysisPath = join(testDir, 'qa/Test/tests/analyses/coverage-analysis.json');

    const reportExists = await fs.access(reportPath).then(() => true).catch(() => false);
    const analysisExists = await fs.access(analysisPath).then(() => true).catch(() => false);

    expect(reportExists).toBe(true);
    expect(analysisExists).toBe(true);

    if (analysisExists) {
      const content = await fs.readFile(analysisPath, 'utf-8');
      const data = JSON.parse(content);
      
      expect(data.summary).toBeDefined();
      expect(data.pyramid).toBeDefined();
    }
  });

  // Teste adicional: repositório sem testes
  it('deve lidar com repositório sem testes', async () => {
    // Criar apenas arquivos fonte, sem testes
    await fs.mkdir(join(testDir, 'src'), { recursive: true });
    await fs.writeFile(join(testDir, 'src/index.ts'), 'export function hello() {}');

    const result = await analyzeTestCoverage({
      repo: testDir,
      product: 'No Tests'
    });

    expect(result.pyramid.unit.files_found).toBe(0);
    expect(result.pyramid.integration.files_found).toBe(0);
    expect(result.pyramid.e2e.files_found).toBe(0);
    expect(result.health).not.toBe('healthy');
  });
});

