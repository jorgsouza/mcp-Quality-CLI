import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { glob } from 'glob';
vi.mock('glob');
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { catalogScenarios } from '../catalog';

describe('catalogScenarios', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `/tmp/catalog-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
    await fs.mkdir(join(testDir, 'tests'), { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve listar cenários de teste', async () => {
    // Criar alguns arquivos de teste
    await fs.mkdir(join(testDir, 'tests/unit'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'tests/unit/user.test.ts'),
      `
      describe('User', () => {
        it('should create user', () => {});
        it('should update user', () => {});
      });
      `
    );
    vi.mocked(glob).mockResolvedValue(['tests/unit/user.test.ts']);

    const result = await catalogScenarios({
      repo: testDir,
      product: 'TestApp',
      squads: ['Squad A', 'Squad B']
    });

    expect(result.total_scenarios).toBeGreaterThan(0);
  });

  it('deve atribuir squads aos cenários', async () => {
    await fs.mkdir(join(testDir, 'tests/unit'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'tests/unit/auth.test.ts'),
      `
      describe('Auth', () => {
        it('should login', () => {});
      });
      `
    );

    vi.mocked(glob).mockResolvedValue(['tests/unit/auth.test.ts']);

    const result = await catalogScenarios({
      repo: testDir,
      product: 'TestApp',
      squads: ['Squad Auth', 'Squad User']
    });

    expect(Object.keys(result.by_squad).length).toBeGreaterThan(0);
  });

  it('deve detectar cenários duplicados', async () => {
    await fs.mkdir(join(testDir, 'tests/unit'), { recursive: true });
    await fs.mkdir(join(testDir, 'tests/integration'), { recursive: true });
    
    const testContent = `
      describe('Login', () => {
        it('should login successfully', () => {});
      });
    `;
    
    await fs.writeFile(join(testDir, 'tests/unit/login.test.ts'), testContent);
    vi.mocked(glob).mockResolvedValue(['tests/unit/login.test.ts', 'tests/integration/login.test.ts']);

    const result = await catalogScenarios({
      repo: testDir,
      product: 'TestApp',
      squads: ['Squad A']
    });

    expect(result.duplicates).toBeDefined();
  });

  it('deve gerar matriz de responsabilidades', async () => {
    await fs.mkdir(join(testDir, 'tests/unit'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'tests/unit/feature.test.ts'),
      `
      describe('Feature', () => {
        it('should work', () => {});
      });
      `
    );

    vi.mocked(glob).mockResolvedValue(['tests/unit/feature.test.ts']);

    const result = await catalogScenarios({
      repo: testDir,
      product: 'TestApp',
      squads: ['Squad A', 'Squad B']
    });


    const matrixPath = join(testDir, 'tests/analyses/RESPONSIBILITY-MATRIX.md');
    const exists = await fs.access(matrixPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const content = await fs.readFile(matrixPath, 'utf-8');
    expect(content).toContain('Matriz de Responsabilidade - Testes');
    expect(content).toContain('Squad A');

  });

  it('deve salvar catálogo em Markdown', async () => {
    await fs.mkdir(join(testDir, 'tests/unit'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'tests/unit/test.test.ts'),
      `
      describe('Test', () => {
        it('should pass', () => {});
      });
      `
    );

    vi.mocked(glob).mockResolvedValue(['tests/unit/test.test.ts']);

    const result = await catalogScenarios({
      repo: testDir,
      product: 'TestApp',
      squads: ['Squad A']
    });


    const catalogPath = join(testDir, 'tests/analyses/SCENARIO-CATALOG.md');
    const exists = await fs.access(catalogPath).then(() => true).catch(() => false);
    expect(exists).toBe(true);

    const content = await fs.readFile(catalogPath, 'utf-8');
    expect(content).toContain('Catálogo de Cenários');
    expect(content).toContain('TestApp');
  });

  it('deve lidar com repositório sem testes', async () => {
    vi.mocked(glob).mockResolvedValue([]);

    const result = await catalogScenarios({
      repo: testDir,
      product: 'TestApp',
      squads: ['Squad A']
    });

    expect(result.total_scenarios).toBe(0);
  });

  it('deve contar cenários por squad', async () => {
    await fs.mkdir(join(testDir, 'tests/unit'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'tests/unit/feature1.test.ts'),
      `
      describe('Feature 1', () => {
        it('test 1', () => {});
        it('test 2', () => {});
      });
      `
    );
    await fs.writeFile(
      join(testDir, 'tests/unit/feature2.test.ts'),
      `
      describe('Feature 2', () => {
        it('test 3', () => {});
      });
      `
    );
    vi.mocked(glob).mockResolvedValue(['tests/unit/feature1.test.ts', 'tests/unit/feature2.test.ts']);

    const result = await catalogScenarios({
      repo: testDir,
      product: 'TestApp',
      squads: ['Squad A', 'Squad B']
    });

    expect(result.total_scenarios).toBeGreaterThan(0);
  });

  it('deve identificar cenários por prioridade', async () => {
    await fs.mkdir(join(testDir, 'tests/unit'), { recursive: true });
    await fs.writeFile(
      join(testDir, 'tests/unit/critical.test.ts'),
      `
      describe('Critical Feature', () => {
        it('should handle payment', () => {});
      });
      `
    );

    vi.mocked(glob).mockResolvedValue(['tests/unit/critical.test.ts']);

    const result = await catalogScenarios({
      repo: testDir,
      product: 'TestApp',
      squads: ['Squad Payment']
    });

    expect(result.by_priority.P1.length).toBeGreaterThan(0);
  });
});

