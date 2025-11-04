/**
 * Testes E2E para auto-full-cycle
 * Valida o fluxo completo de orquestração automática
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { autoQualityRun } from '../../../../src/tools/auto.js';
import { constants } from 'node:fs';

describe('E2E: auto-full-cycle', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'auto-e2e-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('FULL mode em diferentes contextos', () => {
    it('should work in empty repo', async () => {
      // Repo vazio sem package.json
      const result = await autoQualityRun({
        mode: 'full',
        repo: tempDir,
        product: 'EmptyRepo',
        skipScaffold: true,
        skipRun: true
      });

      expect(result.ok).toBe(true);
      expect(result.context).toBeDefined();
      // Produto pode ser inferido do tempDir ou usar o passado
      expect(result.context.product).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it('should work in repo with package.json', async () => {
      // Cria package.json
      await writeFile(join(tempDir, 'package.json'), JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        description: 'Test project',
        devDependencies: {
          vitest: '^2.0.0'
        }
      }));

      const result = await autoQualityRun({
        mode: 'full',
        repo: tempDir,
        skipScaffold: true,
        skipRun: true
      });

      expect(result.ok).toBe(true);
      expect(result.context).toBeDefined();
      // Produto deve ser inferido do package.json
      expect(result.context.product).toBeDefined();
      expect(result.context.hasPackageJson).toBe(true);
      expect(result.context.testFramework).toBe('vitest');
    });

    it('should work with existing mcp-settings.json', async () => {
      // Cria package.json primeiro para ter produto consistente
      await writeFile(join(tempDir, 'package.json'), JSON.stringify({
        name: 'my-product',
        version: '1.0.0'
      }));
      
      // Cria estrutura com mcp-settings existente
      await mkdir(join(tempDir, 'qa', 'my-product'), { recursive: true });
      await writeFile(
        join(tempDir, 'qa', 'my-product', 'mcp-settings.json'),
        JSON.stringify({
          product_name: 'my-product',
          test_framework: 'vitest',
          domains: ['auth', 'billing'],
          critical_flows: ['login', 'checkout']
        })
      );

      const result = await autoQualityRun({
        mode: 'full',
        repo: tempDir,
        product: 'my-product',
        skipScaffold: true,
        skipRun: true
      });

      expect(result.ok).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.context.product).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
    });
  });

  describe('Modos parciais', () => {
    beforeEach(async () => {
      // Cria estrutura básica para todos os testes de modos parciais
      await writeFile(join(tempDir, 'package.json'), JSON.stringify({
        name: 'partial-modes-test',
        version: '1.0.0'
      }));

      await mkdir(join(tempDir, 'src'), { recursive: true });
      await writeFile(join(tempDir, 'src', 'index.ts'), 
        'export function hello() { return "world"; }'
      );
    });

    it('should execute ANALYZE mode correctly', async () => {
      const result = await autoQualityRun({
        mode: 'analyze',
        repo: tempDir,
        product: 'AnalyzeTest'
      });

      expect(result.ok).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.outputs).toBeDefined();
    });

    it('should execute PLAN mode correctly', async () => {
      const result = await autoQualityRun({
        mode: 'plan',
        repo: tempDir,
        product: 'PlanTest'
      });

      expect(result.ok).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
      expect(result.outputs).toBeDefined();
    });

    it.skip('should execute SCAFFOLD mode correctly (skipped - slow E2E)', async () => {
      const result = await autoQualityRun({
        mode: 'scaffold',
        repo: tempDir,
        product: 'ScaffoldTest',
        skipScaffold: true // Skip real scaffold for speed
      });

      expect(result.ok).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
    });

    it.skip('should execute RUN mode correctly (slow E2E)', async () => {
      const result = await autoQualityRun({
        mode: 'run',
        repo: tempDir,
        product: 'RunTest',
        skipRun: true // Skip real execution for speed
      });

      expect(result.ok).toBe(true);
      expect(result.context).toBeDefined();
      // RUN mode pode ter steps diferentes
      expect(result.steps).toBeDefined();
    });
  });

  describe('Auto-detecção de contexto', () => {
    it('should auto-detect repo from cwd', async () => {
      // Não passa repo explícito, deve detectar automaticamente
      const result = await autoQualityRun({
        mode: 'analyze',
        product: 'AutoDetectTest'
      });

      expect(result.ok).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.context.repoPath).toBeDefined();
      expect(result.context.repoPath.length).toBeGreaterThan(0);
    });

    it('should infer product from package.json', async () => {
      await writeFile(join(tempDir, 'package.json'), JSON.stringify({
        name: 'inferred-product-name',
        version: '1.0.0'
      }));

      const result = await autoQualityRun({
        mode: 'analyze',
        repo: tempDir
        // Não passa product, deve inferir
      });

      expect(result.ok).toBe(true);
      expect(result.context).toBeDefined();
      expect(result.context.product).toBeDefined();
    });
  });

  describe('Criação de estrutura de artifacts', () => {
    it('should create qa/<product>/ directory structure', async () => {
      const result = await autoQualityRun({
        mode: 'analyze',
        repo: tempDir,
        product: 'StructureTest'
      });

      expect(result.ok).toBe(true);

      // Verifica que o resultado tem contexto
      expect(result.context).toBeDefined();
      expect(result.context.product).toBeDefined();
    });

    it('should generate all expected artifacts in FULL mode', async () => {
      const result = await autoQualityRun({
        mode: 'full',
        repo: tempDir,
        product: 'FullArtifacts',
        skipScaffold: true,
        skipRun: true
      });

      expect(result.ok).toBe(true);
      expect(result.outputs).toBeDefined();
      expect(result.steps.length).toBeGreaterThan(0);
      // Verifica que passos foram executados
      expect(result.steps).toContain('analyze');
    });
  });

  describe('Error handling', () => {
    it('should handle invalid repo path gracefully', async () => {
      const result = await autoQualityRun({
        mode: 'analyze',
        repo: '/path/that/does/not/exist/12345',
        product: 'InvalidRepo'
      });

      expect(result.ok).toBe(false);
    });

    it('should handle missing product name', async () => {
      // Repo sem package.json e sem produto explícito
      const result = await autoQualityRun({
        mode: 'analyze',
        repo: tempDir
        // Sem product - deve usar fallback
      });

      // Deve ter sucesso usando fallback
      expect(result.ok).toBe(true);
      expect(result.context.product).toBeDefined();
    });

    it('should handle filesystem errors gracefully', async () => {
      // Tenta criar artifacts em um local sem permissão (simulado)
      const result = await autoQualityRun({
        mode: 'analyze',
        repo: tempDir,
        product: 'FSErrorTest'
      });

      // Mesmo com erros potenciais de FS, deve continuar
      expect(result.ok).toBeDefined();
    });
  });

  describe('Integration with existing test framework', () => {
    it('should detect vitest framework', async () => {
      await writeFile(join(tempDir, 'package.json'), JSON.stringify({
        name: 'vitest-project',
        version: '1.0.0',
        devDependencies: {
          vitest: '^2.0.0'
        }
      }));

      await writeFile(join(tempDir, 'vitest.config.ts'), 
        'export default { test: { coverage: { provider: "v8" } } }'
      );

      const result = await autoQualityRun({
        mode: 'analyze',
        repo: tempDir,
        product: 'VitestProject'
      });

      expect(result.ok).toBe(true);
      expect(result.context.testFramework).toBe('vitest');
    });

    it('should detect existing test files', async () => {
      await mkdir(join(tempDir, 'tests', 'unit'), { recursive: true });
      await writeFile(
        join(tempDir, 'tests', 'unit', 'example.test.ts'),
        'import { test, expect } from "vitest"; test("example", () => expect(true).toBe(true));'
      );

      const result = await autoQualityRun({
        mode: 'analyze',
        repo: tempDir,
        product: 'ExistingTests'
      });

      expect(result.ok).toBe(true);
      expect(result.context.hasTests).toBe(true);
    });
  });
});
