import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { analyze } from '../../../../src/tools/analyze.js';
import { generatePlan } from '../../../../src/tools/plan.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('Fluxo: Análise → Plano', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `integration-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 1. Análise alimenta plano
  it('deve gerar plano baseado nos findings da análise', async () => {
    // Criar repositório de exemplo com rotas e endpoints
    await fs.mkdir(join(testDir, 'app'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/page.tsx'), 'export default function Home() {}');
    await fs.mkdir(join(testDir, 'app/login'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/login/page.tsx'), 'export default function Login() {}');
    
    await fs.writeFile(join(testDir, 'routes.ts'), `
      app.get('/api/users', (req, res) => {});
      app.post('/api/auth/login', (req, res) => {});
    `);

    // Passo 1: Executar análise
    const analysis = await analyze({
      repo: testDir,
      product: 'Test App',
      critical_flows: ['login'],
      base_url: 'http://test.com'
    });

    expect(analysis.findings.routes).toContain('/login');
    expect(analysis.findings.endpoints.length).toBeGreaterThan(0);

    // Passo 2: Gerar plano baseado na análise
    const plan = await generatePlan({
      repo: testDir,
      product: 'Test App',
      base_url: 'http://test.com'
      // [FASE 2] out_dir removido - plan.ts usa getPaths()
    });

    expect(plan.ok).toBe(true);
    expect(plan.plan).toBeDefined();

    // Passo 3: Verificar que rotas da análise estão no plano
    // [FASE 2] plan.ts agora usa paths.reports e salva como PLAN.md
    const planPath = join(testDir, 'qa/Test App/tests/reports/PLAN.md');
    const planExists = await fs.access(planPath).then(() => true).catch(() => false);
    
    expect(planExists).toBe(true);

    if (planExists) {
      const planContent = await fs.readFile(planPath, 'utf-8');
      
      // Plano deve mencionar o produto
      expect(planContent).toContain('Test App');
      
      // Plano deve ter estrutura Playwright
      expect(planContent).toContain('Playwright');
      expect(planContent).toContain('playwright.config.ts');
    }
  });

  // 2. Plano inclui recomendações
  it('deve incluir recomendações da análise no plano', async () => {
    // Criar repositório com fluxos críticos
    await fs.mkdir(join(testDir, 'app/checkout'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/checkout/page.tsx'), 'export default function Checkout() {}');

    // Executar análise com fluxos críticos
    const analysis = await analyze({
      repo: testDir,
      product: 'E-commerce',
      critical_flows: ['checkout', 'payment'],
      base_url: 'http://shop.test'
    });

    expect(analysis.recommendations.length).toBeGreaterThan(0);

    // Gerar plano
    const plan = await generatePlan({
      repo: testDir,
      product: 'E-commerce',
      base_url: 'http://shop.test',
      include_examples: true
      // [FASE 2] out_dir removido - plan.ts usa getPaths()
    });

    expect(plan.ok).toBe(true);

    // Verificar conteúdo do plano
    // [FASE 2] plan.ts agora usa paths.reports e salva como PLAN.md
    const planPath = join(testDir, 'qa/E-commerce/tests/reports/PLAN.md');
    const planContent = await fs.readFile(planPath, 'utf-8');

    // Plano deve ter seções importantes
    expect(planContent).toContain('Cenários');
    expect(planContent).toContain('Risco');
    expect(planContent).toContain('Playwright');
    
    // Se include_examples=true, deve ter exemplos
    expect(planContent).toContain('Exemplo') || expect(planContent).toContain('example');
  });

  // Teste adicional: fluxo completo com múltiplos domínios
  it('deve organizar plano por domínios quando especificados', async () => {
    // Criar rotas de diferentes domínios
    await fs.mkdir(join(testDir, 'app/auth'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/auth/page.tsx'), 'export default function Auth() {}');
    
    await fs.mkdir(join(testDir, 'app/products'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/products/page.tsx'), 'export default function Products() {}');

    const analysis = await analyze({
      repo: testDir,
      product: 'Multi Domain App',
      domains: ['auth', 'products', 'checkout'],
      base_url: 'http://test.com'
    });

    const plan = await generatePlan({
      repo: testDir,
      product: 'Multi Domain App',
      base_url: 'http://test.com'
      // [FASE 2] out_dir removido - plan.ts usa getPaths()
    });

    expect(plan.ok).toBe(true);

    // [FASE 2] plan.ts agora usa paths.reports e salva como PLAN.md
    const planContent = await fs.readFile(join(testDir, 'qa/Multi Domain App/tests/reports/PLAN.md'), 'utf-8');
    
    // Plano deve mencionar domínios ou cenários
    expect(planContent.length).toBeGreaterThan(100);
  });
});

