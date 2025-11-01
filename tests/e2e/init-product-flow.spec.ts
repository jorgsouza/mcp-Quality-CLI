import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { initProduct } from '../../src/tools/init-product.js';

/**
 * E2E Test: init-product flow
 * Testa o fluxo completo de inicialização de produto
 */
describe('E2E: quality init-product', () => {
  let testRepoPath: string;

  beforeAll(async () => {
    // Cria repositório temporário para testes
    testRepoPath = join(tmpdir(), `e2e-init-product-${Date.now()}`);
    await fs.mkdir(testRepoPath, { recursive: true });
  });

  afterAll(async () => {
    // Limpa diretório temporário
    await fs.rm(testRepoPath, { recursive: true, force: true });
  });

  it('deve criar estrutura completa de QA', async () => {
    const result = await initProduct({
      repo: testRepoPath,
      product: 'EcommerceApp',
      base_url: 'https://www.ecommerce.com'
    });

    // Verifica resultado
    expect(result.ok).toBe(true);
    expect(result.path).toContain('EcommerceApp');
  });

  it('deve criar mcp-settings.json com configurações corretas', async () => {
    const settingsPath = join(testRepoPath, 'qa/EcommerceApp/mcp-settings.json');
    const settingsContent = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(settingsContent);

    expect(settings).toMatchObject({
      product: 'EcommerceApp',
      base_url: 'https://www.ecommerce.com',
      targets: {
        diff_coverage_min: 80,
        flaky_pct_max: 5,
        ci_p95_min: 8
      }
    });

    expect(settings.environments).toHaveProperty('dev');
    expect(settings.environments).toHaveProperty('stg');
    expect(settings.environments).toHaveProperty('prod');
  });

  it('deve criar estrutura de diretórios completa', async () => {
    const qaDir = join(testRepoPath, 'qa/EcommerceApp');

    // Verifica diretórios criados
    const expectedDirs = [
      'tests/unit',
      'tests/integration',
      'tests/e2e',
      'tests/analyses',
      'tests/reports',
      'fixtures/auth'
    ];

    for (const dir of expectedDirs) {
      const dirPath = join(qaDir, dir);
      const exists = await fs.stat(dirPath).then(() => true).catch(() => false);
      expect(exists).toBe(true);
    }
  });

  it('deve criar GETTING_STARTED.md com documentação', async () => {
    const gettingStartedPath = join(testRepoPath, 'qa/EcommerceApp/GETTING_STARTED.md');
    const content = await fs.readFile(gettingStartedPath, 'utf-8');

    expect(content).toContain('EcommerceApp');
    expect(content).toContain('Quality MCP');
    expect(content).toContain('analyze');
  });

  it('deve criar README.md', async () => {
    const readmePath = join(testRepoPath, 'qa/EcommerceApp/README.md');
    const exists = await fs.stat(readmePath).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('deve criar .gitignore apropriado', async () => {
    const gitignorePath = join(testRepoPath, 'qa/EcommerceApp/.gitignore');
    const content = await fs.readFile(gitignorePath, 'utf-8');

    expect(content).toContain('node_modules/');
    expect(content).toContain('coverage/');
    expect(content).toContain('playwright-report/');
    expect(content).toContain('.env');
  });

  it('não deve sobrescrever mcp-settings.json existente', async () => {
    // Modifica settings existente
    const settingsPath = join(testRepoPath, 'qa/EcommerceApp/mcp-settings.json');
    const originalSettings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
    originalSettings.custom_field = 'should_persist';
    await fs.writeFile(settingsPath, JSON.stringify(originalSettings, null, 2));

    // Executa init-product novamente
    await initProduct({
      repo: testRepoPath,
      product: 'EcommerceApp',
      base_url: 'https://www.ecommerce.com'
    });

    // Verifica que custom_field ainda existe
    const newSettings = JSON.parse(await fs.readFile(settingsPath, 'utf-8'));
    expect(newSettings.custom_field).toBe('should_persist');
  });

  it('deve permitir criar múltiplos produtos no mesmo repo', async () => {
    // Cria segundo produto
    await initProduct({
      repo: testRepoPath,
      product: 'PaymentService',
      base_url: 'https://api.payment.com'
    });

    // Verifica que ambos produtos existem
    const ecommerceExists = await fs.stat(join(testRepoPath, 'qa/EcommerceApp')).then(() => true).catch(() => false);
    const paymentExists = await fs.stat(join(testRepoPath, 'qa/PaymentService')).then(() => true).catch(() => false);

    expect(ecommerceExists).toBe(true);
    expect(paymentExists).toBe(true);

    // Verifica que configurações são diferentes
    const ecommerceSettings = JSON.parse(
      await fs.readFile(join(testRepoPath, 'qa/EcommerceApp/mcp-settings.json'), 'utf-8')
    );
    const paymentSettings = JSON.parse(
      await fs.readFile(join(testRepoPath, 'qa/PaymentService/mcp-settings.json'), 'utf-8')
    );

    expect(ecommerceSettings.product).toBe('EcommerceApp');
    expect(ecommerceSettings.base_url).toBe('https://www.ecommerce.com');
    expect(paymentSettings.product).toBe('PaymentService');
    expect(paymentSettings.base_url).toBe('https://api.payment.com');
  });
});
