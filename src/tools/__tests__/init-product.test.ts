import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { initProduct } from '../init-product.js';
import { fileExists } from '../../utils/fs.js';

describe('initProduct', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(process.cwd(), `test-init-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve criar estrutura completa de QA para produto', async () => {
    const result = await initProduct({
      repo: testDir,
      product: 'TestProduct',
      base_url: 'https://www.example.com'
    });

    expect(result.ok).toBe(true);
    expect(result.path).toBe(join(testDir, 'qa', 'TestProduct'));
  });

  it('deve criar diretórios de testes', async () => {
    await initProduct({
      repo: testDir,
      product: 'TestProduct',
      base_url: 'https://www.example.com'
    });

    const qaDir = join(testDir, 'qa', 'TestProduct');
    
    expect(await fileExists(join(qaDir, 'tests', 'unit'))).toBe(true);
    expect(await fileExists(join(qaDir, 'tests', 'integration'))).toBe(true);
    expect(await fileExists(join(qaDir, 'tests', 'e2e'))).toBe(true);
    expect(await fileExists(join(qaDir, 'tests', 'analyses'))).toBe(true);
    expect(await fileExists(join(qaDir, 'tests', 'reports'))).toBe(true);
    expect(await fileExists(join(qaDir, 'fixtures', 'auth'))).toBe(true);
  });

  it('deve criar mcp-settings.json com configurações corretas', async () => {
    await initProduct({
      repo: testDir,
      product: 'TestProduct',
      base_url: 'https://www.example.com',
      domains: ['auth', 'users'],
      critical_flows: ['login', 'signup']
    });

    const settingsPath = join(testDir, 'qa', 'TestProduct', 'mcp-settings.json');
    expect(await fileExists(settingsPath)).toBe(true);

    const content = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);

    expect(settings.product).toBe('TestProduct');
    expect(settings.base_url).toBe('https://www.example.com');
    expect(settings.domains).toEqual(['auth', 'users']);
    expect(settings.critical_flows).toEqual(['login', 'signup']);
    expect(settings.targets).toBeDefined();
    expect(settings.targets.diff_coverage_min).toBe(80);
    expect(settings.targets.flaky_pct_max).toBe(5);
    expect(settings.targets.ci_p95_min).toBe(8);
  });

  it('deve criar GETTING_STARTED.md', async () => {
    await initProduct({
      repo: testDir,
      product: 'TestProduct',
      base_url: 'https://www.example.com'
    });

    const gettingStartedPath = join(testDir, 'qa', 'TestProduct', 'GETTING_STARTED.md');
    expect(await fileExists(gettingStartedPath)).toBe(true);

    const content = await fs.readFile(gettingStartedPath, 'utf-8');
    expect(content).toContain('TestProduct');
    expect(content).toContain('https://www.example.com');
    expect(content).toContain('Responsabilidades');
    expect(content).toContain('Quality Gates');
  });

  it('deve criar README.md', async () => {
    await initProduct({
      repo: testDir,
      product: 'TestProduct',
      base_url: 'https://www.example.com'
    });

    const readmePath = join(testDir, 'qa', 'TestProduct', 'README.md');
    expect(await fileExists(readmePath)).toBe(true);

    const content = await fs.readFile(readmePath, 'utf-8');
    expect(content).toContain('TestProduct');
    expect(content).toContain('Quick Start');
  });

  it('deve criar .gitignore apropriado', async () => {
    await initProduct({
      repo: testDir,
      product: 'TestProduct',
      base_url: 'https://www.example.com'
    });

    const gitignorePath = join(testDir, 'qa', 'TestProduct', '.gitignore');
    expect(await fileExists(gitignorePath)).toBe(true);

    const content = await fs.readFile(gitignorePath, 'utf-8');
    expect(content).toContain('storageState.json');
    expect(content).toContain('*.bak');
    expect(content).toContain('node_modules');
  });

  it('não deve sobrescrever mcp-settings.json existente', async () => {
    const settingsPath = join(testDir, 'qa', 'TestProduct', 'mcp-settings.json');
    
    // Primeira execução
    await initProduct({
      repo: testDir,
      product: 'TestProduct',
      base_url: 'https://www.example.com'
    });

    // Modifica o arquivo
    const originalContent = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(originalContent);
    settings.custom_field = 'test';
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2));

    // Segunda execução
    await initProduct({
      repo: testDir,
      product: 'TestProduct',
      base_url: 'https://www.example.com'
    });

    // Verifica que não foi sobrescrito
    const finalContent = await fs.readFile(settingsPath, 'utf-8');
    const finalSettings = JSON.parse(finalContent);
    expect(finalSettings.custom_field).toBe('test');
  });

  it('deve criar environments corretos baseado na base_url', async () => {
    await initProduct({
      repo: testDir,
      product: 'TestProduct',
      base_url: 'https://www.example.com'
    });

    const settingsPath = join(testDir, 'qa', 'TestProduct', 'mcp-settings.json');
    const content = await fs.readFile(settingsPath, 'utf-8');
    const settings = JSON.parse(content);

    expect(settings.environments).toBeDefined();
    expect(settings.environments.dev.url).toBe('https://dev.example.com');
    expect(settings.environments.stg.url).toBe('https://stg.example.com');
    expect(settings.environments.prod.url).toBe('https://www.example.com');
  });
});
