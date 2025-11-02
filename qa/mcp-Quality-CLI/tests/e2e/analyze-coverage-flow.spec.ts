import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initProduct } from '../../../../src/tools/init-product.js';
import { analyze } from '../../../../src/tools/analyze.js';
import { analyzeTestCoverage } from '../../../../src/tools/coverage.js';
import { generatePlan } from '../../../../src/tools/plan.js';

/**
 * E2E Test: analyze → coverage pipeline
 * Testa o fluxo completo de análise e cobertura
 */
describe('E2E: quality analyze → quality coverage', () => {
  let testRepoPath: string;

  beforeAll(async () => {
    // Cria repositório temporário simulando projeto TypeScript
    testRepoPath = join(tmpdir(), `e2e-analyze-coverage-${Date.now()}`);
    await fs.mkdir(testRepoPath, { recursive: true });

    // Cria package.json
    await fs.writeFile(
      join(testRepoPath, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        scripts: {
          test: 'vitest',
          'test:coverage': 'vitest run --coverage'
        },
        devDependencies: {
          vitest: '^2.0.0'
        }
      }, null, 2)
    );

    // Cria estrutura de código simulada
    await fs.mkdir(join(testRepoPath, 'src/api'), { recursive: true });
    await fs.writeFile(
      join(testRepoPath, 'src/api/users.ts'),
      `export async function getUsers() {
  return fetch('/api/users').then(r => r.json());
}

export async function createUser(data: any) {
  return fetch('/api/users', { 
    method: 'POST', 
    body: JSON.stringify(data) 
  }).then(r => r.json());
}`
    );

    await fs.writeFile(
      join(testRepoPath, 'src/api/products.ts'),
      `export async function getProducts() {
  return fetch('/api/products').then(r => r.json());
}`
    );

    // Cria testes simulados
    await fs.mkdir(join(testRepoPath, 'tests/unit'), { recursive: true });
    await fs.writeFile(
      join(testRepoPath, 'tests/unit/users.test.ts'),
      `import { describe, it, expect } from 'vitest';
import { getUsers } from '../../../../src/api/users';

describe('Users API', () => {
  it('should get users', async () => {
    expect(getUsers).toBeDefined();
  });
});`
    );

    await fs.mkdir(join(testRepoPath, 'tests/e2e'), { recursive: true });
    await fs.writeFile(
      join(testRepoPath, 'tests/e2e/login.spec.ts'),
      `import { test, expect } from '@playwright/test';

test('should login successfully', async ({ page }) => {
  await page.goto('/login');
  expect(page).toBeDefined();
});`
    );

    // Inicializa produto QA
    await initProduct({
      repo: testRepoPath,
      product: 'TestApp',
      base_url: 'https://test.app'
    });
  });

  afterAll(async () => {
    await fs.rm(testRepoPath, { recursive: true, force: true });
  });

  it('deve executar analyze e detectar endpoints', async () => {
    const result = await analyze({
      repo: testRepoPath,
      product: 'TestApp',
      base_url: 'https://test.app'
    });

    expect(result.findings).toBeDefined();
  });

  it('deve criar analyze.json com findings', async () => {
    // [FASE 2] analyze.ts usa paths.analyses (qa/<product>/tests/analyses)
    const analyzePath = join(testRepoPath, 'qa/TestApp/tests/analyses/analyze.json');
    const exists = await fs.stat(analyzePath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const content = JSON.parse(await fs.readFile(analyzePath, 'utf-8'));
    expect(content).toHaveProperty('findings');
  });

  it('deve executar coverage e analisar pirâmide de testes', async () => {
    const result = await analyzeTestCoverage({
      repo: testRepoPath,
      product: 'TestApp'
    });

    expect(result.pyramid).toBeDefined();
    expect(result.pyramid.unit).toBeDefined();
    expect(result.pyramid.integration).toBeDefined();
    expect(result.pyramid.e2e).toBeDefined();
  });

  it('deve criar coverage-analysis.json com métricas', async () => {
    // [FASE 2] coverage.ts usa paths.analyses (qa/<product>/tests/analyses)
    const coveragePath = join(testRepoPath, 'qa/TestApp/tests/analyses/coverage-analysis.json');
    const exists = await fs.stat(coveragePath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const content = JSON.parse(await fs.readFile(coveragePath, 'utf-8'));
    expect(content).toHaveProperty('pyramid');
    expect(content.pyramid).toHaveProperty('unit');
    expect(content.pyramid).toHaveProperty('integration');
    expect(content.pyramid).toHaveProperty('e2e');
    expect(content).toHaveProperty('health');
  });

  it('deve criar COVERAGE-REPORT.md legível', async () => {
    // [FASE 2] coverage.ts usa paths.reports (qa/<product>/tests/reports)
    const reportPath = join(testRepoPath, 'qa/TestApp/tests/reports/COVERAGE-REPORT.md');
    const exists = await fs.stat(reportPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const content = await fs.readFile(reportPath, 'utf-8');
    // Verifica que contém cabeçalho e produto
    expect(content).toContain('TestApp');
    expect(content).toContain('Pirâmide');
    expect(content).toContain('Saúde');
    expect(content).toContain('Quality MCP');
  });

  it('deve permitir pipeline completo: analyze → coverage → plan', async () => {
    // 1. Analyze
    const analyzeResult = await analyze({
      repo: testRepoPath,
      product: 'TestApp',
      base_url: 'https://test.app'
    });
    expect(analyzeResult.findings).toBeDefined();

    // 2. Coverage
    const coverageResult = await analyzeTestCoverage({
      repo: testRepoPath,
      product: 'TestApp'
    });
    expect(coverageResult.pyramid).toBeDefined();

    // 3. Plan
    const planResult = await generatePlan({
      repo: testRepoPath,
      product: 'TestApp',
      base_url: 'https://test.app'
    });
    expect(planResult.plan).toBeDefined();

    // [FASE 2] Verifica que diretório qa/<product>/tests foi criado
    const testsDir = join(testRepoPath, 'qa/TestApp/tests');
    const exists = await fs.stat(testsDir).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('deve usar configuração centralizada de mcp-settings.json', async () => {
    // Modifica mcp-settings para adicionar domínios
    const settingsPath = join(testRepoPath, 'qa/TestApp/mcp-settings.json');
    const settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
    settings.domains = ['api', 'auth'];
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

    // Executa analyze novamente
    const result = await analyze({
      repo: testRepoPath,
      product: 'TestApp'
    });

    // Deve carregar settings do arquivo
    expect(result.findings).toBeDefined();
  });

  it('deve validar health da pirâmide corretamente', async () => {
    // Executa coverage para garantir que o arquivo existe
    const result = await analyzeTestCoverage({
      repo: testRepoPath,
      product: 'TestApp'
    });

    // Verifica lógica de health no resultado
    expect(['healthy', 'inverted', 'needs_attention']).toContain(result.health);

    if (result.pyramid.unit.test_cases > result.pyramid.e2e.test_cases) {
      expect(result.health).not.toBe('inverted');
    }
  });
});
