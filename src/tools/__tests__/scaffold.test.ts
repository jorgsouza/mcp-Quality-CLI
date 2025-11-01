import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { scaffoldPlaywright } from '../scaffold';

describe('scaffoldPlaywright', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `/tmp/scaffold-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve criar diretórios de testes', async () => {
    const result = await scaffoldPlaywright({
      repo: testDir,
      plan_file: 'plan/TEST-PLAN.md',
      out_dir: 'e2e'
    });

    expect(result.ok).toBe(true);

    const authExists = await fs.access(join(testDir, 'e2e/tests/auth')).then(() => true).catch(() => false);
    const claimExists = await fs.access(join(testDir, 'e2e/tests/claim')).then(() => true).catch(() => false);
    const searchExists = await fs.access(join(testDir, 'e2e/tests/search')).then(() => true).catch(() => false);
    const fixturesExists = await fs.access(join(testDir, 'e2e/fixtures')).then(() => true).catch(() => false);

    expect(authExists).toBe(true);
    expect(claimExists).toBe(true);
    expect(searchExists).toBe(true);
    expect(fixturesExists).toBe(true);
  });

  it('deve gerar playwright.config.ts', async () => {
    const result = await scaffoldPlaywright({
      repo: testDir,
      plan_file: 'plan/TEST-PLAN.md',
      out_dir: 'e2e'
    });

    expect(result.ok).toBe(true);

    const configPath = join(testDir, 'e2e/playwright.config.ts');
    const configExists = await fs.access(configPath).then(() => true).catch(() => false);
    expect(configExists).toBe(true);

    const configContent = await fs.readFile(configPath, 'utf-8');
    expect(configContent).toContain('defineConfig');
    expect(configContent).toContain('timeout');
    expect(configContent).toContain('baseURL');
  });

  it('deve criar fixture de autenticação', async () => {
    const result = await scaffoldPlaywright({
      repo: testDir,
      plan_file: 'plan/TEST-PLAN.md',
      out_dir: 'e2e'
    });

    expect(result.ok).toBe(true);

    const fixturePath = join(testDir, 'e2e/fixtures/auth.ts');
    const fixtureExists = await fs.access(fixturePath).then(() => true).catch(() => false);
    expect(fixtureExists).toBe(true);

    const fixtureContent = await fs.readFile(fixturePath, 'utf-8');
    expect(fixtureContent).toContain('base');
    expect(fixtureContent).toContain('deprecated');
  });

  it('deve gerar spec de login', async () => {
    const result = await scaffoldPlaywright({
      repo: testDir,
      plan_file: 'plan/TEST-PLAN.md',
      out_dir: 'e2e'
    });

    expect(result.ok).toBe(true);

    const loginPath = join(testDir, 'e2e/tests/auth/login.spec.ts');
    const loginExists = await fs.access(loginPath).then(() => true).catch(() => false);
    expect(loginExists).toBe(true);

    const loginContent = await fs.readFile(loginPath, 'utf-8');
    expect(loginContent).toContain('test');
    expect(loginContent).toContain('login');
    expect(loginContent).toContain('Email');
    expect(loginContent).toContain('Senha');
  });

  it('deve gerar spec de reclamação', async () => {
    const result = await scaffoldPlaywright({
      repo: testDir,
      plan_file: 'plan/TEST-PLAN.md',
      out_dir: 'e2e'
    });

    expect(result.ok).toBe(true);

    const claimPath = join(testDir, 'e2e/tests/claim/open-claim.spec.ts');
    const claimExists = await fs.access(claimPath).then(() => true).catch(() => false);
    expect(claimExists).toBe(true);

    const claimContent = await fs.readFile(claimPath, 'utf-8');
    expect(claimContent).toContain('test');
    expect(claimContent).toContain('reclamação');
  });

  it('deve gerar spec de busca', async () => {
    const result = await scaffoldPlaywright({
      repo: testDir,
      plan_file: 'plan/TEST-PLAN.md',
      out_dir: 'e2e'
    });

    expect(result.ok).toBe(true);

    const searchPath = join(testDir, 'e2e/tests/search/search-company.spec.ts');
    const searchExists = await fs.access(searchPath).then(() => true).catch(() => false);
    expect(searchExists).toBe(true);

    const searchContent = await fs.readFile(searchPath, 'utf-8');
    expect(searchContent).toContain('test');
    expect(searchContent).toContain('buscar empresa');
  });

  it('deve retornar caminho do diretório E2E', async () => {
    const result = await scaffoldPlaywright({
      repo: testDir,
      plan_file: 'plan/TEST-PLAN.md',
      out_dir: 'e2e'
    });

    expect(result.ok).toBe(true);
    expect(result.e2e_dir).toContain('e2e');
  });

  it('deve configurar reporters no playwright.config.ts', async () => {
    const result = await scaffoldPlaywright({
      repo: testDir,
      plan_file: 'plan/TEST-PLAN.md',
      out_dir: 'e2e'
    });

    expect(result.ok).toBe(true);

    const configContent = await fs.readFile(join(testDir, 'e2e/playwright.config.ts'), 'utf-8');
    expect(configContent).toContain('reporter');
    expect(configContent).toContain('html');
    expect(configContent).toContain('junit');
    expect(configContent).toContain('json');
  });

  it('deve configurar retry e timeout no playwright.config.ts', async () => {
    const result = await scaffoldPlaywright({
      repo: testDir,
      plan_file: 'plan/TEST-PLAN.md',
      out_dir: 'e2e'
    });

    expect(result.ok).toBe(true);

    const configContent = await fs.readFile(join(testDir, 'e2e/playwright.config.ts'), 'utf-8');
    expect(configContent).toContain('retries');
    expect(configContent).toContain('timeout');
  });

  it('deve configurar trace e screenshot no playwright.config.ts', async () => {
    const result = await scaffoldPlaywright({
      repo: testDir,
      plan_file: 'plan/TEST-PLAN.md',
      out_dir: 'e2e'
    });

    expect(result.ok).toBe(true);

    const configContent = await fs.readFile(join(testDir, 'e2e/playwright.config.ts'), 'utf-8');
    expect(configContent).toContain('trace');
    expect(configContent).toContain('screenshot');
    expect(configContent).toContain('video');
  });
});

