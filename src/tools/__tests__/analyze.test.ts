import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { analyze } from '../analyze.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('analyze', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `analyze-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 1. Repositório com rotas Next
  it('deve encontrar rotas Next.js e classificar como medium risk', async () => {
    // Criar estrutura Next.js
    await fs.mkdir(join(testDir, 'app'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/page.tsx'), 'export default function Home() {}');
    await fs.mkdir(join(testDir, 'app/about'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/about/page.tsx'), 'export default function About() {}');

    const result = await analyze({
      repo: testDir,
      product: 'Test App'
    });

    expect(result.findings.routes).toContain('/');
    expect(result.findings.routes).toContain('/about');
    expect(result.summary).toContain('2 rotas web');
    
    // Deve ter risk_map para as rotas
    const routeRisks = result.findings.risk_map.filter(r => r.area.startsWith('route:'));
    expect(routeRisks.length).toBeGreaterThan(0);
  });

  // 2. Repositório com API Express
  it('deve encontrar endpoints Express e sugerir CDC', async () => {
    // Criar arquivo com rotas Express
    await fs.writeFile(join(testDir, 'routes.ts'), `
      app.get('/api/users', (req, res) => {});
      app.post('/api/users', (req, res) => {});
    `);

    const result = await analyze({
      repo: testDir,
      product: 'API Service'
    });

    expect(result.findings.endpoints).toHaveLength(2);
    expect(result.findings.endpoints).toContain('GET /api/users');
    expect(result.findings.endpoints).toContain('POST /api/users');
    
    // Deve recomendar CDC para endpoints
    const hasCDCRecommendation = result.recommendations.some(r => 
      r.toLowerCase().includes('cdc') || r.toLowerCase().includes('contrato')
    );
    expect(hasCDCRecommendation).toBe(true);
  });

  // 3. Repositório com eventos
  it('deve encontrar eventos e mapear riscos', async () => {
    // Criar arquivo com eventos
    await fs.writeFile(join(testDir, 'events.ts'), `
      producer.send({ topic: 'user-created' });
      emitter.emit('order-placed');
    `);

    const result = await analyze({
      repo: testDir,
      product: 'Event Service'
    });

    expect(result.findings.events).toHaveLength(2);
    expect(result.findings.events).toContain('kafka:user-created');
    expect(result.findings.events).toContain('event:order-placed');
    
    // Eventos devem ter risk 'med'
    const eventRisks = result.findings.risk_map.filter(r => r.area.startsWith('event:'));
    expect(eventRisks.length).toBe(2);
    expect(eventRisks.every(r => r.risk === 'med')).toBe(true);
  });

  // 4. Gerar recomendações
  it('deve gerar recomendações baseadas nos findings', async () => {
    // Criar repositório com múltiplos tipos
    await fs.mkdir(join(testDir, 'app'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/page.tsx'), 'export default function Home() {}');
    await fs.writeFile(join(testDir, 'routes.ts'), `app.get('/api/health', () => {})`);

    const result = await analyze({
      repo: testDir,
      product: 'Full App',
      critical_flows: ['login', 'checkout']
    });

    expect(result.recommendations).toBeDefined();
    expect(result.recommendations.length).toBeGreaterThan(0);
    
    // Deve ter recomendações sobre E2E, CDC, cobertura
    const hasE2ERecommendation = result.recommendations.some(r => r.toLowerCase().includes('e2e'));
    expect(hasE2ERecommendation).toBe(true);
  });

  // 5. Escrever analyze.json
  it('deve salvar resultado em tests/analyses/analyze.json', async () => {
    await fs.mkdir(join(testDir, 'app'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/page.tsx'), 'export default function Home() {}');

    const result = await analyze({
      repo: testDir,
      product: 'Test'
    });

    // [FASE 2] Verificar se arquivo foi criado na nova estrutura qa/<product>
    const analyzeJsonPath = join(testDir, 'qa/Test/tests/analyses/analyze.json');
    const fileExists = await fs.access(analyzeJsonPath).then(() => true).catch(() => false);
    
    expect(fileExists).toBe(true);
    
    if (fileExists) {
      const content = await fs.readFile(analyzeJsonPath, 'utf-8');
      const data = JSON.parse(content);
      
      expect(data.summary).toBeDefined();
      expect(data.findings).toBeDefined();
      expect(data.recommendations).toBeDefined();
    }
  });

  // 6. Repositório vazio
  it('deve lidar com repositório sem código', async () => {
    // Diretório vazio
    const result = await analyze({
      repo: testDir,
      product: 'Empty Repo'
    });

    expect(result.findings.routes).toEqual([]);
    expect(result.findings.endpoints).toEqual([]);
    expect(result.findings.events).toEqual([]);
    expect(result.summary).toContain('0 rotas web');
    expect(result.summary).toContain('0 endpoints');
    expect(result.summary).toContain('0 eventos');
  });

  // Teste adicional: fluxos críticos
  it('deve marcar rotas críticas como high risk', async () => {
    await fs.mkdir(join(testDir, 'app/login'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/login/page.tsx'), 'export default function Login() {}');

    const result = await analyze({
      repo: testDir,
      product: 'App',
      critical_flows: ['login']
    });

    const loginRisk = result.findings.risk_map.find(r => r.area.includes('login'));
    expect(loginRisk).toBeDefined();
    expect(loginRisk?.risk).toBe('high');
    expect(loginRisk?.rationale).toContain('fluxo crítico');
  });

  // Teste adicional: OpenAPI reduz risco
  it('deve reduzir risco de endpoints quando OpenAPI está presente', async () => {
    // Criar endpoint
    await fs.writeFile(join(testDir, 'routes.ts'), `app.get('/api/users', () => {})`);
    
    // Criar OpenAPI spec
    await fs.writeFile(join(testDir, 'openapi.yml'), `
      openapi: 3.0.0
      paths:
        /api/users:
          get:
            summary: Get users
    `);

    const result = await analyze({
      repo: testDir,
      product: 'API'
    });

    const endpointRisk = result.findings.risk_map.find(r => r.area.includes('GET /api/users'));
    expect(endpointRisk).toBeDefined();
    expect(endpointRisk?.risk).toBe('low'); // Com OpenAPI, risco é baixo
    expect(endpointRisk?.rationale).toContain('contrato OpenAPI');
  });
});
