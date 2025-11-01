/**
 * Testes E2E para nl-command-flow
 * Valida o fluxo completo de comandos em linguagem natural
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { nlCommand } from '../../src/tools/nl-command.js';

describe('E2E: nl-command-flow', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'nl-command-e2e-'));
    
    // Cria estrutura mínima de projeto
    await writeFile(join(tempDir, 'package.json'), JSON.stringify({
      name: 'test-project',
      version: '1.0.0',
      description: 'Test project for nl-command E2E',
      devDependencies: {
        vitest: '^2.0.0'
      }
    }));

    // Cria alguns arquivos de código de exemplo
    await mkdir(join(tempDir, 'src'), { recursive: true });
    await writeFile(join(tempDir, 'src', 'index.ts'), 
      'export function hello() { return "world"; }'
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('Comandos PT simples', () => {
    it('should detect FULL mode from "analise meu repositório"', async () => {
      const result = await nlCommand({
        query: 'analise meu repositório',
        defaults: { repo: tempDir, skipScaffold: true, skipRun: true }
      });

      expect(result.success).toBe(true);
      expect(result.detected_mode).toBe('full');
      expect(result.final_params.mode).toBe('full');
    });

    it('should detect FULL mode from "auditar o projeto"', async () => {
      const result = await nlCommand({
        query: 'auditar o projeto',
        defaults: { repo: tempDir, skipScaffold: true, skipRun: true }
      });

      expect(result.success).toBe(true);
      expect(result.detected_mode).toBe('full');
    });

    it('should detect ANALYZE mode from "apenas analisar o código"', async () => {
      const result = await nlCommand({
        query: 'apenas analisar o código',
        defaults: { repo: tempDir }
      });

      expect(result.success).toBe(true);
      expect(result.detected_mode).toBe('analyze');
      expect(result.final_params.mode).toBe('analyze');
    });

    it('should detect PLAN mode from "criar plano de testes"', async () => {
      const result = await nlCommand({
        query: 'criar plano de testes',
        defaults: { repo: tempDir }
      });

      expect(result.success).toBe(true);
      expect(result.detected_mode).toBe('plan');
      expect(result.final_params.mode).toBe('plan');
    });

    it('should detect RUN mode from "rodar testes e calcular cobertura"', async () => {
      const result = await nlCommand({
        query: 'rodar testes e calcular cobertura',
        defaults: { repo: tempDir, skipRun: true }
      });

      expect(result.success).toBe(true);
      expect(result.detected_mode).toBe('run');
      expect(result.final_params.mode).toBe('run');
    });
  });

  describe('Comandos EN simples', () => {
    it('should detect FULL mode from "run all tests"', async () => {
      const result = await nlCommand({
        query: 'run all tests',
        defaults: { repo: tempDir, skipScaffold: true, skipRun: true }
      });

      expect(result.success).toBe(true);
      expect(result.detected_mode).toBe('full');
    });

    it('should detect ANALYZE mode from "only analyze"', async () => {
      const result = await nlCommand({
        query: 'only analyze the code',
        defaults: { repo: tempDir }
      });

      expect(result.success).toBe(true);
      expect(result.detected_mode).toBe('analyze');
    });

    it('should detect PLAN mode from "generate test plan"', async () => {
      const result = await nlCommand({
        query: 'generate test plan',
        defaults: { repo: tempDir }
      });

      expect(result.success).toBe(true);
      expect(result.detected_mode).toBe('plan');
    });
  });

  describe('Overrides no texto', () => {
    it('should extract repo override', async () => {
      const result = await nlCommand({
        query: `analise o projeto repo:${tempDir}`,
        defaults: { skipScaffold: true, skipRun: true }
      });

      expect(result.success).toBe(true);
      expect(result.extracted_params.repo).toBe(tempDir);
      expect(result.final_params.repo).toBe(tempDir);
    });

    it('should extract product override', async () => {
      const result = await nlCommand({
        query: 'criar plano product:MyCustomProduct',
        defaults: { repo: tempDir }
      });

      expect(result.success).toBe(true);
      expect(result.extracted_params.product).toBe('MyCustomProduct');
      expect(result.final_params.product).toBe('MyCustomProduct');
    });

    it('should extract mode override', async () => {
      const result = await nlCommand({
        query: 'rodar testes mode:run',
        defaults: { repo: tempDir, skipRun: true }
      });

      expect(result.success).toBe(true);
      expect(result.extracted_params.mode).toBe('run');
      expect(result.final_params.mode).toBe('run');
    });

    it('should extract multiple overrides', async () => {
      const result = await nlCommand({
        query: 'analise repo:/tmp/test product:TestApp mode:analyze',
        defaults: { skipScaffold: true, skipRun: true }
      });

      expect(result.success).toBe(true);
      expect(result.extracted_params.repo).toBe('/tmp/test');
      expect(result.extracted_params.product).toBe('TestApp');
      expect(result.extracted_params.mode).toBe('analyze');
    });
  });

  describe('Defaults globais', () => {
    it('should apply defaults when no override present', async () => {
      const result = await nlCommand({
        query: 'analise meu repositório',
        defaults: {
          repo: tempDir,
          product: 'DefaultProduct',
          skipScaffold: true,
          skipRun: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.final_params.repo).toBe(tempDir);
      expect(result.final_params.product).toBe('DefaultProduct');
    });

    it('should prioritize explicit overrides over defaults', async () => {
      const result = await nlCommand({
        query: 'analise produto product:ExplicitProduct',
        defaults: {
          repo: tempDir,
          product: 'DefaultProduct',
          skipScaffold: true,
          skipRun: true
        }
      });

      expect(result.success).toBe(true);
      expect(result.final_params.product).toBe('ExplicitProduct');
      expect(result.final_params.product).not.toBe('DefaultProduct');
    });
  });

  describe('Error handling', () => {
    it('should handle empty query gracefully', async () => {
      const result = await nlCommand({
        query: '',
        defaults: { repo: tempDir, skipScaffold: true, skipRun: true }
      });

      // Query vazia pode ter comportamentos diferentes
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });

    it('should handle query with only whitespace', async () => {
      const result = await nlCommand({
        query: '   ',
        defaults: { repo: tempDir, skipScaffold: true, skipRun: true }
      });

      // Whitespace deve ser tratado
      expect(result).toBeDefined();
      expect(result.success).toBeDefined();
    });
  });
});
