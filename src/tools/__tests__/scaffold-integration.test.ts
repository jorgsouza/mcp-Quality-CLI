import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { scaffoldIntegrationTests } from '../scaffold-integration';

describe('scaffoldIntegrationTests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `/tmp/integration-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
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

    const integrationDir = join(testDir, 'tests/integration');
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

    const clientPath = join(testDir, 'tests/integration/api-client.ts');
    const exists = await fs.access(clientPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const content = await fs.readFile(clientPath, 'utf-8');
    expect(content).toContain('baseURL');
    expect(content).toContain('https://api.test.com');
  });

  it('deve adicionar testes de contrato', async () => {
    const result = await scaffoldIntegrationTests({
      repo: testDir,
      product: 'TestApp',
      base_url: 'https://api.test.com',
      endpoints: ['/users']
    });

    expect(result.ok).toBe(true);

    const files = await fs.readdir(join(testDir, 'tests/integration'));
    const hasTestFiles = files.some(f => f.endsWith('.test.ts') || f.endsWith('.spec.ts'));
    expect(hasTestFiles).toBe(true);
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

    const guidePath = join(testDir, 'tests/analyses/INTEGRATION-TESTING-GUIDE.md');
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

