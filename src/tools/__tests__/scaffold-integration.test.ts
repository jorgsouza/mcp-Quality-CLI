import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { scaffoldIntegrationTests } from '../scaffold-integration';

describe('scaffoldIntegrationTests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `/tmp/integration-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
    // Criar package.json para que seja detectado como TypeScript
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({ name: 'test-project', devDependencies: { vitest: '^0.34.0' } })
    );
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve criar diretório de testes de integração', async () => {
    const result = await scaffoldIntegrationTests({
      repo: testDir,
      product: 'TestApp',
      base_url: 'https://api.test.com',
      endpoints: ['/users', '/posts']
    });

    expect(result.ok).toBe(true);

    // [FASE 2] scaffold-integration agora usa paths.integration (qa/<product>/tests/integration)
    const integrationDir = join(testDir, 'qa/TestApp/tests/integration');
    const exists = await fs.access(integrationDir).then(() => true).catch(() => false);
    expect(exists).toBe(true);
  });

  it('deve gerar testes para endpoints especificados', async () => {
    const result = await scaffoldIntegrationTests({
      repo: testDir,
      product: 'TestApp',
      base_url: 'https://api.test.com',
      endpoints: ['/users', '/posts', '/comments']
    });

    expect(result.ok).toBe(true);
    expect(result.generated.length).toBeGreaterThan(0);
  });

  it('deve criar API client', async () => {
    const result = await scaffoldIntegrationTests({
      repo: testDir,
      product: 'TestApp',
      base_url: 'https://api.test.com',
      endpoints: ['/users']
    });

    expect(result.ok).toBe(true);

    // [FASE 2] scaffold-integration agora usa paths.integration
    const clientPath = join(testDir, 'qa/TestApp/tests/integration/helpers/api-client.ts');
    const exists = await fs.access(clientPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const content = await fs.readFile(clientPath, 'utf-8');
    expect(content).toContain('baseURL');
    
    // Verifica se a URL está no arquivo setup.ts
    const setupPath = join(testDir, 'qa/TestApp/tests/integration/setup.ts');
    const setupContent = await fs.readFile(setupPath, 'utf-8');
    expect(setupContent).toContain('https://api.test.com');
  });

  it('deve adicionar testes de contrato', async () => {
    const result = await scaffoldIntegrationTests({
      repo: testDir,
      product: 'TestApp',
      base_url: 'https://api.test.com',
      endpoints: ['/users']
    });

    expect(result.ok).toBe(true);

    // [FASE 2] scaffold-integration agora usa paths.integration
    const contractPath = join(testDir, 'qa/TestApp/tests/integration/contract/api-contract.test.ts');
    const contractExists = await fs.access(contractPath).then(() => true).catch(() => false);
    expect(contractExists).toBe(true);
  });

  it('deve atualizar package.json com scripts de integração', async () => {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({ name: 'test', scripts: {} })
    );

    const result = await scaffoldIntegrationTests({
      repo: testDir,
      product: 'TestApp',
      base_url: 'https://api.test.com',
      endpoints: ['/users']
    });

    expect(result.ok).toBe(true);

    const packageJson = JSON.parse(await fs.readFile(join(testDir, 'package.json'), 'utf-8'));
    expect(packageJson.scripts).toBeDefined();
    expect(packageJson.scripts['test:integration']).toBeDefined();
  });

  it('deve lidar com base_url inválida', async () => {
    await expect(scaffoldIntegrationTests({
      repo: testDir,
      product: 'TestApp',
      base_url: 'invalid-url',
      endpoints: ['/users']
    })).rejects.toThrow();
  });

  it('deve gerar guia de testes de integração', async () => {
    const result = await scaffoldIntegrationTests({
      repo: testDir,
      product: 'TestApp',
      base_url: 'https://api.test.com',
      endpoints: ['/users']
    });

    expect(result.ok).toBe(true);

    // [FASE 2] scaffold-integration usa paths.reports
    const guidePath = join(testDir, 'qa/TestApp/tests/reports/INTEGRATION-TESTING-GUIDE.md');
    const exists = await fs.access(guidePath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const content = await fs.readFile(guidePath, 'utf-8');
    expect(content).toContain('Integration Testing');
    expect(content).toContain('TestApp');
  });

  it('deve lidar com endpoints vazios', async () => {
    const result = await scaffoldIntegrationTests({
      repo: testDir,
      product: 'TestApp',
      base_url: 'https://api.test.com',
      endpoints: []
    });

    expect(result.ok).toBe(true);
    expect(result.generated.length).toBe(0);
  });
});

