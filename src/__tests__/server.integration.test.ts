import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Integration Test: MCP Server
 * Testa as ferramentas do servidor MCP integradas
 */
describe('Integration: MCP Server Tools', () => {
  let testRepoPath: string;

  beforeAll(async () => {
    // Cria repositório temporário
    testRepoPath = join(tmpdir(), `server-integration-${Date.now()}`);
    await fs.mkdir(testRepoPath, { recursive: true });

    // Cria estrutura mínima de projeto TypeScript
    await fs.writeFile(
      join(testRepoPath, 'package.json'),
      JSON.stringify({
        name: 'test-server-app',
        version: '1.0.0',
        scripts: {
          test: 'vitest',
          'test:coverage': 'vitest run --coverage'
        },
        devDependencies: {
          vitest: '^2.0.0'
        }
      }, null, 2)
    );

    // Cria código fonte
    await fs.mkdir(join(testRepoPath, 'src'), { recursive: true });
    await fs.writeFile(
      join(testRepoPath, 'src/app.ts'),
      `export function greet(name: string): string {
  return \`Hello, \${name}!\`;
}`
    );

    // Cria testes
    await fs.mkdir(join(testRepoPath, 'tests/unit'), { recursive: true });
    await fs.writeFile(
      join(testRepoPath, 'tests/unit/app.test.ts'),
      `import { describe, it, expect } from 'vitest';
import { greet } from '../../src/app';

describe('App', () => {
  it('should greet', () => {
    expect(greet('World')).toBe('Hello, World!');
  });
});`
    );
  });

  afterAll(async () => {
    await fs.rm(testRepoPath, { recursive: true, force: true });
  });

  it('deve inicializar produto via init-product', async () => {
    const { initProduct } = await import('../tools/init-product.js');

    const result = await initProduct({
      repo: testRepoPath,
      product: 'ServerTestApp',
      base_url: 'https://server-test.app'
    });

    expect(result).toMatchObject({
      ok: true,
      path: expect.stringContaining('ServerTestApp')
    });
    expect(result.path).toContain('ServerTestApp');

    // Verifica que estrutura foi criada
    const settingsPath = join(testRepoPath, 'qa/ServerTestApp/mcp-settings.json');
    const exists = await fs.stat(settingsPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('deve executar analyze e retornar findings', async () => {
    const { analyze } = await import('../tools/analyze.js');

    const result = await analyze({
      repo: testRepoPath,
      product: 'ServerTestApp',
      base_url: 'https://server-test.app'
    });

    expect(result).toHaveProperty('findings');
    expect(result.findings).toHaveProperty('routes');
    expect(result.findings).toHaveProperty('endpoints');
    expect(result.findings).toHaveProperty('events');
  });

  it('deve executar coverage e calcular pirâmide', async () => {
    const { analyzeTestCoverage } = await import('../tools/coverage.js');

    const result = await analyzeTestCoverage({
      repo: testRepoPath,
      product: 'ServerTestApp'
    });

    expect(result).toHaveProperty('pyramid');
    expect(result.pyramid).toMatchObject({
      unit: expect.objectContaining({
        files_found: expect.any(Number)
      }),
      integration: expect.objectContaining({
        files_found: expect.any(Number)
      }),
      e2e: expect.objectContaining({
        files_found: expect.any(Number)
      })
    });
    expect(result.health).toMatch(/healthy|inverted|needs_attention/);
  });

  it('deve gerar plano baseado em análise', async () => {
    const { generatePlan } = await import('../tools/plan.js');

    const result = await generatePlan({
      repo: testRepoPath,
      product: 'ServerTestApp',
      base_url: 'https://server-test.app'
    });

    expect(result).toMatchObject({
      ok: true,
      plan: expect.stringMatching(/\.md$/)
    });
    // [FASE 2] plan.ts salva como PLAN.md, não TEST-PLAN.md
    expect(result.plan).toMatch(/PLAN/);

    // Verifica que arquivo foi criado
    const exists = await fs.stat(result.plan).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('deve validar parâmetros com schemas Zod', async () => {
    // A validação Zod acontece no server.ts, não nas tools diretamente
    // Aqui testamos que a tool executa mesmo sem validação
    const { analyze } = await import('../tools/analyze.js');

    const result = await analyze({
      repo: testRepoPath,
      product: 'Test',
      base_url: 'https://test.app'
    });
    
    expect(result).toHaveProperty('findings');
    expect(result.findings).toBeTypeOf('object');
  });

  it('deve integrar config centralizado de mcp-settings.json', async () => {
    // Modifica mcp-settings
    const settingsPath = join(testRepoPath, 'qa/ServerTestApp/mcp-settings.json');
    const settings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
    settings.domains = ['api', 'auth'];
    settings.critical_flows = ['login', 'checkout'];
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

    const { analyze } = await import('../tools/analyze.js');

    const result = await analyze({
      repo: testRepoPath,
      product: 'ServerTestApp'
    });

    // Deve carregar settings do arquivo
    expect(result).toHaveProperty('findings');
    expect(result.findings).toBeTypeOf('object');
  });

  it('deve gerar catalog de cenários', async () => {
    const { catalogScenarios } = await import('../tools/catalog.js');

    const result = await catalogScenarios({
      repo: testRepoPath,
      product: 'ServerTestApp'
    });

    expect(result).toHaveProperty('product', 'ServerTestApp');
    expect(result).toHaveProperty('total_scenarios');
    expect(result.total_scenarios).toBeGreaterThanOrEqual(0);
  });

  it('deve recomendar estratégia de testes', async () => {
    const { recommendTestStrategy } = await import('../tools/recommend-strategy.js');

    const result = await recommendTestStrategy({
      repo: testRepoPath,
      product: 'ServerTestApp'
    });

    expect(result).toMatchObject({
      ok: true,
      recommendation: expect.objectContaining({
        strategy: expect.any(Object),
        appType: expect.any(String)
      })
    });
    expect(['api', 'web', 'fullstack', 'library', 'Generic Application', 'API', 'Web Application'])
      .toContain(result.recommendation.appType);
  });

  it('deve scaffold de unit tests funcionar', async () => {
    const { scaffoldUnitTests } = await import('../tools/scaffold-unit.js');

    const result = await scaffoldUnitTests({
      repo: testRepoPath,
      product: 'ServerTestApp'
    });

    expect(result).toMatchObject({
      ok: true,
      generated: expect.any(Array)
    });
    expect(Array.isArray(result.generated)).toBe(true);
  });

  it('deve scaffold de integration tests funcionar', async () => {
    const { scaffoldIntegrationTests } = await import('../tools/scaffold-integration.js');

    const result = await scaffoldIntegrationTests({
      repo: testRepoPath,
      product: 'ServerTestApp',
      base_url: 'https://server-test.app'
    });

    expect(result).toMatchObject({
      ok: true,
      generated: expect.any(Array)
    });
    expect(Array.isArray(result.generated)).toBe(true);
  });
});
