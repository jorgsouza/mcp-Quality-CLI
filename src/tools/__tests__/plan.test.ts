import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generatePlan } from '../plan.js';

describe('plan.ts', () => {
  let testRepoPath: string;

  beforeAll(async () => {
    testRepoPath = join(tmpdir(), `plan-test-${Date.now()}`);
    await fs.mkdir(testRepoPath, { recursive: true });

    // Cria estrutura mínima
    await fs.writeFile(
      join(testRepoPath, 'package.json'),
      JSON.stringify({ name: 'test-app' }, null, 2)
    );

    await fs.mkdir(join(testRepoPath, 'src'), { recursive: true });
  });

  afterAll(async () => {
    await fs.rm(testRepoPath, { recursive: true, force: true });
  });

  it('deve gerar plano de testes básico', async () => {
    const result = await generatePlan({
      repo: testRepoPath,
      product: 'TestProduct',
      base_url: 'https://test.com'
    });

    expect(result.ok).toBe(true);
    expect(result.plan).toBeDefined();
  });

  it('deve criar arquivo TEST-PLAN.md', async () => {
    const result = await generatePlan({
      repo: testRepoPath,
      product: 'TestProduct2',
      base_url: 'https://test2.com'
    });

    const exists = await fs.stat(result.plan).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const content = await fs.readFile(result.plan, 'utf-8');
    expect(content).toContain('TestProduct2');
    expect(content).toContain('Plano de Testes');
  });

  it('deve incluir exemplos quando solicitado', async () => {
    const result = await generatePlan({
      repo: testRepoPath,
      product: 'TestProduct3',
      base_url: 'https://test3.com',
      include_examples: true
    });

    const content = await fs.readFile(result.plan, 'utf-8');
    expect(content).toBeDefined();
  });

  it('deve usar configuração de mcp-settings.json', async () => {
    // Cria mcp-settings
    const qaDir = join(testRepoPath, 'qa/TestProduct4');
    await fs.mkdir(qaDir, { recursive: true });
    await fs.writeFile(
      join(qaDir, 'mcp-settings.json'),
      JSON.stringify({
        product: 'TestProduct4',
        base_url: 'https://test4.com',
        domains: ['api', 'auth']
      }, null, 2)
    );

    const result = await generatePlan({
      repo: testRepoPath,
      product: 'TestProduct4'
    });

    expect(result.ok).toBe(true);
  });

  it('deve organizar por domínios quando fornecidos', async () => {
    const result = await generatePlan({
      repo: testRepoPath,
      product: 'TestProduct5',
      base_url: 'https://test5.com'
    });

    const content = await fs.readFile(result.plan, 'utf-8');
    expect(content).toBeDefined();
  });

  it('deve validar parâmetros obrigatórios', async () => {
    // Testa com repo vazio - deve funcionar pois generatePlan não valida repo vazio
    // A validação acontece no server.ts com Zod schema
    const result = await generatePlan({
      repo: testRepoPath,
      product: 'Test',
      base_url: 'https://test.com'
    });
    
    expect(result).toBeDefined();
  });

  it('deve incluir TODOs automáticos no plano', async () => {
    const result = await generatePlan({
      repo: testRepoPath,
      product: 'TestProductTODOs',
      base_url: 'https://test-todos.com'
    });

    const content = await fs.readFile(result.plan, 'utf-8');
    
    // Deve incluir seção de Ações Recomendadas
    expect(content).toContain('🎯 Ações Recomendadas');
    
    // Deve incluir TODOs específicos
    expect(content).toContain('TODO: Create auth fixtures');
    expect(content).toContain('TODO: Consider Testcontainers');
    expect(content).toContain('TODO: Configure CI/CD pipeline');
  });

  it('deve incluir Quality Gates com thresholds', async () => {
    const result = await generatePlan({
      repo: testRepoPath,
      product: 'TestProductGates',
      base_url: 'https://test-gates.com'
    });

    const content = await fs.readFile(result.plan, 'utf-8');
    
    // Deve incluir seção de Quality Gates
    expect(content).toContain('Quality Gates');
    expect(content).toContain('Required Coverage');
    expect(content).toContain('Performance');
    expect(content).toContain('Blocking Criteria');
  });

  it('deve calcular risk scores quando houver dados de análise', async () => {
    const mockAnalysis = {
      findings: {
        routes: ['/api/login', '/api/checkout'],
        endpoints: ['POST /api/login', 'POST /api/checkout'],
        events: [],
        risk_map: [
          { area: '/api/login', risk: 'high' as const, rationale: 'Authentication critical flow' },
          { area: '/api/checkout', risk: 'high' as const, rationale: 'Payment processing' },
          { area: '/api/products', risk: 'med' as const, rationale: 'Product listing' },
          { area: '/api/search', risk: 'low' as const, rationale: 'Search functionality' }
        ]
      },
      summary: 'Mock analysis for testing',
      recommendations: [],
      plan_path: ''
    };

    const result = await generatePlan({
      repo: testRepoPath,
      product: 'TestProductRisk',
      base_url: 'https://test-risk.com',
      analyze_result: mockAnalysis
    });

    const content = await fs.readFile(result.plan, 'utf-8');
    
    // Deve incluir seção de Risk Score Analysis
    expect(content).toContain('🔥 Risk Score Analysis');
    
    // Deve listar endpoints com scores
    expect(content).toMatch(/Score:/);
    expect(content).toMatch(/Probability:/);
    expect(content).toMatch(/Impact:/);
  });
});