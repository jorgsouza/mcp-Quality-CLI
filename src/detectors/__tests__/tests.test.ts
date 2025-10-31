import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findExistingTests, isPyramidHealthy } from '../tests.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('findExistingTests', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = join(tmpdir(), `tests-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 1. Vitest files
  it('deve detectar arquivos *.test.ts com vitest', async () => {
    await fs.mkdir(join(testDir, 'src/__tests__'), { recursive: true });
    await fs.writeFile(join(testDir, 'src/__tests__/utils.test.ts'), `
      import { describe, it, expect } from 'vitest';
      
      describe('utils', () => {
        it('should work', () => {
          expect(true).toBe(true);
        });
        
        it('should also work', () => {
          expect(1 + 1).toBe(2);
        });
      });
    `);

    const coverage = await findExistingTests(testDir);

    expect(coverage.unit).toHaveLength(1);
    expect(coverage.unit[0].framework).toBe('vitest');
    expect(coverage.unit[0].testCount).toBe(2);
    expect(coverage.summary.unitCount).toBe(2);
  });

  // 2. Jest files
  it('deve detectar arquivos *.spec.ts com jest', async () => {
    await fs.mkdir(join(testDir, 'tests'), { recursive: true });
    await fs.writeFile(join(testDir, 'tests/service.spec.ts'), `
      import { describe, it, expect } from 'jest';
      
      describe('Service', () => {
        it('creates instance', () => {
          expect(true).toBe(true);
        });
        
        test('works correctly', () => {
          expect(1).toBe(1);
        });
      });
    `);

    const coverage = await findExistingTests(testDir);

    expect(coverage.unit).toHaveLength(1);
    expect(coverage.unit[0].framework).toBe('jest');
    expect(coverage.unit[0].testCount).toBe(2); // it + test
  });

  // 3. Mocha files
  it('deve detectar arquivos *Test.ts com mocha', async () => {
    await fs.mkdir(join(testDir, 'test'), { recursive: true });
    await fs.writeFile(join(testDir, 'test/utilsTest.ts'), `
      import { describe, it } from 'mocha';
      import { expect } from 'chai';
      
      describe('Utils', () => {
        it('should work', () => {
          expect(true).to.be.true;
        });
      });
    `);

    const coverage = await findExistingTests(testDir);

    expect(coverage.unit).toHaveLength(1);
    expect(coverage.unit[0].framework).toBe('mocha');
    expect(coverage.unit[0].testCount).toBe(1);
  });

  // 4. Playwright E2E
  it('deve detectar testes Playwright em tests/', async () => {
    await fs.mkdir(join(testDir, 'tests/e2e'), { recursive: true });
    await fs.writeFile(join(testDir, 'tests/e2e/login.spec.ts'), `
      import { test, expect } from '@playwright/test';
      
      test('user can login', async ({ page }) => {
        await page.goto('/login');
        await expect(page).toHaveTitle(/Login/);
      });
      
      test('user can logout', async ({ page }) => {
        await page.goto('/logout');
      });
    `);

    const coverage = await findExistingTests(testDir);

    expect(coverage.e2e).toHaveLength(1);
    expect(coverage.e2e[0].framework).toBe('playwright');
    expect(coverage.e2e[0].testCount).toBe(2);
    expect(coverage.summary.e2eCount).toBe(2);
  });

  // 5. Filtrar por layer (unit/integration/e2e)
  it('deve separar testes por camada corretamente', async () => {
    // Unit test
    await fs.mkdir(join(testDir, 'src/__tests__'), { recursive: true });
    await fs.writeFile(join(testDir, 'src/__tests__/unit.test.ts'), `
      import { it } from 'vitest';
      it('unit test', () => {});
    `);

    // Integration test
    await fs.mkdir(join(testDir, 'tests/integration'), { recursive: true });
    await fs.writeFile(join(testDir, 'tests/integration/api.test.ts'), `
      import { it } from 'vitest';
      import request from 'supertest';
      it('integration test', () => {});
    `);

    // E2E test
    await fs.mkdir(join(testDir, 'tests/e2e'), { recursive: true });
    await fs.writeFile(join(testDir, 'tests/e2e/flow.spec.ts'), `
      import { test } from '@playwright/test';
      test('e2e test', async () => {});
    `);

    const coverage = await findExistingTests(testDir);

    expect(coverage.unit).toHaveLength(1);
    expect(coverage.integration).toHaveLength(1);
    expect(coverage.e2e).toHaveLength(1);
    expect(coverage.summary.totalTests).toBe(3);
  });

  // 6. Contar describe/it blocks
  it('deve contar número de test cases por arquivo', async () => {
    await fs.mkdir(join(testDir, 'tests'), { recursive: true });
    await fs.writeFile(join(testDir, 'tests/multiple.test.ts'), `
      import { describe, it, test } from 'vitest';
      
      describe('Group 1', () => {
        it('test 1', () => {});
        it('test 2', () => {});
        test('test 3', () => {});
      });
      
      describe('Group 2', () => {
        it('test 4', () => {});
        it('test 5', () => {});
      });
    `);

    const coverage = await findExistingTests(testDir);

    expect(coverage.unit).toHaveLength(1);
    expect(coverage.unit[0].testCount).toBe(5); // 5 test cases (it + test)
  });

  // 7. Repositório sem testes
  it('deve retornar estrutura vazia se não houver testes', async () => {
    // Criar arquivo que não é teste
    await fs.mkdir(join(testDir, 'src'), { recursive: true });
    await fs.writeFile(join(testDir, 'src/index.ts'), `
      export function hello() {
        return 'world';
      }
    `);

    const coverage = await findExistingTests(testDir);

    expect(coverage.unit).toEqual([]);
    expect(coverage.integration).toEqual([]);
    expect(coverage.e2e).toEqual([]);
    expect(coverage.summary.totalTests).toBe(0);
    expect(coverage.summary.ratio).toBe('0:0:0');
  });

  // Teste adicional: calcular ratio corretamente
  it('deve calcular ratio da pirâmide corretamente', async () => {
    // 7 unit, 2 integration, 1 e2e = 70:20:10
    await fs.mkdir(join(testDir, 'tests'), { recursive: true });
    
    // 7 unit tests
    await fs.writeFile(join(testDir, 'tests/unit.test.ts'), `
      import { it } from 'vitest';
      it('1', () => {});
      it('2', () => {});
      it('3', () => {});
      it('4', () => {});
      it('5', () => {});
      it('6', () => {});
      it('7', () => {});
    `);
    
    // 2 integration tests
    await fs.mkdir(join(testDir, 'tests/integration'), { recursive: true });
    await fs.writeFile(join(testDir, 'tests/integration/api.test.ts'), `
      import { it } from 'vitest';
      import request from 'supertest';
      it('1', () => {});
      it('2', () => {});
    `);
    
    // 1 e2e test
    await fs.mkdir(join(testDir, 'tests/e2e'), { recursive: true });
    await fs.writeFile(join(testDir, 'tests/e2e/flow.spec.ts'), `
      import { test } from '@playwright/test';
      test('1', async () => {});
    `);

    const coverage = await findExistingTests(testDir);

    expect(coverage.summary.unitCount).toBe(7);
    expect(coverage.summary.integrationCount).toBe(2);
    expect(coverage.summary.e2eCount).toBe(1);
    expect(coverage.summary.ratio).toBe('70:20:10');
  });
});

describe('isPyramidHealthy', () => {
  // Teste 1: Pirâmide saudável
  it('deve marcar como saudável se proporções estão corretas', () => {
    const coverage = {
      unit: [],
      integration: [],
      e2e: [],
      component: [],
      summary: {
        totalTests: 100,
        unitCount: 70,
        integrationCount: 20,
        e2eCount: 10,
        componentCount: 0,
        ratio: '70:20:10'
      }
    };

    const result = isPyramidHealthy(coverage);

    expect(result.healthy).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  // Teste 2: Pirâmide invertida
  it('deve alertar se E2E > unit (pirâmide invertida)', () => {
    const coverage = {
      unit: [],
      integration: [],
      e2e: [],
      component: [],
      summary: {
        totalTests: 100,
        unitCount: 10,
        integrationCount: 20,
        e2eCount: 70,
        componentCount: 0,
        ratio: '10:20:70'
      }
    };

    const result = isPyramidHealthy(coverage);

    expect(result.healthy).toBe(false);
    expect(result.issues).toContain('⚠️ Pirâmide INVERTIDA: mais testes E2E que unitários');
    expect(result.recommendations).toContain('Priorize criação de testes unitários para balancear a pirâmide');
  });

  // Teste 3: Poucos testes unitários
  it('deve alertar se unit < 50%', () => {
    const coverage = {
      unit: [],
      integration: [],
      e2e: [],
      component: [],
      summary: {
        totalTests: 100,
        unitCount: 40,
        integrationCount: 40,
        e2eCount: 20,
        componentCount: 0,
        ratio: '40:40:20'
      }
    };

    const result = isPyramidHealthy(coverage);

    expect(result.healthy).toBe(false);
    expect(result.issues.some(i => i.includes('Poucos testes unitários'))).toBe(true);
  });

  // Teste 4: Nenhum teste
  it('deve alertar se não houver testes', () => {
    const coverage = {
      unit: [],
      integration: [],
      e2e: [],
      component: [],
      summary: {
        totalTests: 0,
        unitCount: 0,
        integrationCount: 0,
        e2eCount: 0,
        componentCount: 0,
        ratio: '0:0:0'
      }
    };

    const result = isPyramidHealthy(coverage);

    expect(result.healthy).toBe(false);
    expect(result.issues).toContain('Nenhum teste detectado no repositório');
    expect(result.recommendations).toContain('Comece criando testes unitários para funções críticas');
  });
});

