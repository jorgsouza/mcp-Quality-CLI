/**
 * Testes para nl-command.ts
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Mock das dependências
vi.mock('../auto.js', () => ({
  autoQualityRun: vi.fn(async (options) => ({
    ok: true, // AutoResult usa 'ok' não 'success'
    context: {
      repoPath: options.repo || '/mock/repo',
      product: options.product || 'MockProduct',
      hasTests: false,
      hasPackageJson: true,
    },
    steps: ['Step 1', 'Step 2'],
    duration: 1000,
    outputs: {
      root: `qa/${options.product || 'MockProduct'}`,
      reports: ['/mock/analyze.json'],
      analyses: ['/mock/analyze.json'],
    },
  })),
}));

describe('nl-command', () => {
  let tempDir: string;
  
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), '.test-nl-'));
    vi.clearAllMocks();
  });
  
  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('detectMode', () => {
    it('should detect FULL mode from PT queries', async () => {
      const { detectMode } = await import('../nl-command.js');
      
      expect(detectMode('analise meu repositório')).toBe('full');
      expect(detectMode('auditar o projeto')).toBe('full');
      expect(detectMode('rodar tudo')).toBe('full');
      expect(detectMode('executar completo')).toBe('full');
      expect(detectMode('end to end')).toBe('full');
    });

    it('should detect FULL mode from EN queries', async () => {
      const { detectMode } = await import('../nl-command.js');
      
      expect(detectMode('analyze my repository')).toBe('full');
      expect(detectMode('audit the project')).toBe('full');
      expect(detectMode('run all')).toBe('full');
      expect(detectMode('run everything')).toBe('full');
      expect(detectMode('complete analysis')).toBe('full');
    });

    it('should detect ANALYZE mode from PT queries', async () => {
      const { detectMode } = await import('../nl-command.js');
      
      expect(detectMode('apenas analisar o código')).toBe('analyze');
      expect(detectMode('somente scan')).toBe('analyze');
      expect(detectMode('mapear endpoints')).toBe('analyze');
      expect(detectMode('só analisar o código')).toBe('analyze');
    });

    it('should detect ANALYZE mode from EN queries', async () => {
      const { detectMode } = await import('../nl-command.js');
      
      expect(detectMode('only analyze the code')).toBe('analyze');
      expect(detectMode('just scan')).toBe('analyze');
      expect(detectMode('map endpoints')).toBe('analyze');
      expect(detectMode('analyze project')).toBe('analyze');
    });

    it('should detect PLAN mode from PT queries', async () => {
      const { detectMode } = await import('../nl-command.js');
      
      expect(detectMode('criar plano de testes')).toBe('plan');
      expect(detectMode('gerar estratégia')).toBe('plan');
      expect(detectMode('plano de testes')).toBe('plan');
      expect(detectMode('estratégia de qualidade')).toBe('plan');
    });

    it('should detect PLAN mode from EN queries', async () => {
      const { detectMode } = await import('../nl-command.js');
      
      expect(detectMode('create test plan')).toBe('plan');
      expect(detectMode('generate strategy')).toBe('plan');
      expect(detectMode('test plan')).toBe('plan');
      expect(detectMode('quality strategy')).toBe('plan');
    });

    it('should detect SCAFFOLD mode from PT queries', async () => {
      const { detectMode } = await import('../nl-command.js');
      
      expect(detectMode('scaffold de testes')).toBe('scaffold');
      expect(detectMode('gerar templates de testes')).toBe('scaffold');
      expect(detectMode('criar estruturas de testes')).toBe('scaffold');
      expect(detectMode('templates de testes')).toBe('scaffold');
    });

    it('should detect SCAFFOLD mode from EN queries', async () => {
      const { detectMode } = await import('../nl-command.js');
      
      expect(detectMode('scaffold tests')).toBe('scaffold');
      expect(detectMode('generate test templates')).toBe('scaffold');
      expect(detectMode('create test structures')).toBe('scaffold');
      expect(detectMode('test templates')).toBe('scaffold');
    });

    it('should detect RUN mode from PT queries', async () => {
      const { detectMode } = await import('../nl-command.js');
      
      expect(detectMode('rodar testes')).toBe('run');
      expect(detectMode('executar testes')).toBe('run');
      expect(detectMode('calcular cobertura')).toBe('run');
      expect(detectMode('validar cobertura')).toBe('run');
    });

    it('should detect RUN mode from EN queries', async () => {
      const { detectMode } = await import('../nl-command.js');
      
      expect(detectMode('run tests')).toBe('run');
      expect(detectMode('execute tests')).toBe('run');
      expect(detectMode('calculate coverage')).toBe('run');
      expect(detectMode('validate coverage')).toBe('run');
    });

    it('should default to FULL mode for unrecognized queries', async () => {
      const { detectMode } = await import('../nl-command.js');
      
      expect(detectMode('something random')).toBe('full');
      expect(detectMode('xyz abc')).toBe('full');
      expect(detectMode('')).toBe('full');
    });
  });

  describe('extractOverrides', () => {
    it('should extract repo override', async () => {
      const { extractOverrides } = await import('../nl-command.js');
      
      const result = extractOverrides('analise repo:/home/user/project');
      expect(result.repo).toBe('/home/user/project');
    });

    it('should extract product override', async () => {
      const { extractOverrides } = await import('../nl-command.js');
      
      const result = extractOverrides('analise product:MyApp');
      expect(result.product).toBe('MyApp');
    });

    it('should extract mode override', async () => {
      const { extractOverrides } = await import('../nl-command.js');
      
      const result = extractOverrides('execute mode:analyze');
      expect(result.mode).toBe('analyze');
    });

    it('should extract multiple overrides', async () => {
      const { extractOverrides } = await import('../nl-command.js');
      
      const result = extractOverrides('analise repo:/tmp/test product:Portal mode:plan');
      expect(result.repo).toBe('/tmp/test');
      expect(result.product).toBe('Portal');
      expect(result.mode).toBe('plan');
    });

    it('should return empty object for no overrides', async () => {
      const { extractOverrides } = await import('../nl-command.js');
      
      const result = extractOverrides('apenas analisar o código');
      expect(result).toEqual({});
    });
  });

  describe('nlCommand', () => {
    it('should execute with detected mode from query', async () => {
      const { nlCommand } = await import('../nl-command.js');
      const { autoQualityRun } = await import('../auto.js');
      
      const result = await nlCommand({ query: 'criar plano de testes' });
      
      expect(result.success).toBe(true);
      expect(result.detected_mode).toBe('plan');
      expect(autoQualityRun).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'plan' })
      );
    });

    it('should merge extracted overrides with detected mode', async () => {
      const { nlCommand } = await import('../nl-command.js');
      const { autoQualityRun } = await import('../auto.js');
      
      const result = await nlCommand({ 
        query: 'só mapear repo:/custom/path product:CustomApp' 
      });
      
      expect(result.success).toBe(true);
      expect(result.detected_mode).toBe('analyze'); // "só mapear" = analyze
      expect(result.extracted_params).toEqual({
        repo: '/custom/path',
        product: 'CustomApp',
      });
      expect(result.final_params).toMatchObject({
        mode: 'analyze',
        repo: '/custom/path',
        product: 'CustomApp',
      });
      expect(autoQualityRun).toHaveBeenCalledWith(
        expect.objectContaining({
          mode: 'analyze',
          repo: '/custom/path',
          product: 'CustomApp',
        })
      );
    });

    it('should apply defaults and override with extracted params', async () => {
      const { nlCommand } = await import('../nl-command.js');
      const { autoQualityRun } = await import('../auto.js');
      
      const result = await nlCommand({
        query: 'rodar testes product:MyApp',
        defaults: { 
          product: 'DefaultApp',
          repo: '/default/repo',
        },
      });
      
      expect(result.success).toBe(true);
      expect(result.final_params).toMatchObject({
        mode: 'run',
        product: 'MyApp',        // override vence default
        repo: '/default/repo',   // default é usado
      });
    });

    it('should prioritize explicit mode override over detected mode', async () => {
      const { nlCommand } = await import('../nl-command.js');
      const { autoQualityRun } = await import('../auto.js');
      
      const result = await nlCommand({
        query: 'analise completa mode:analyze', // "completa" sugere full, mas mode: force analyze
      });
      
      expect(result.detected_mode).toBe('full');
      expect(result.final_params.mode).toBe('analyze'); // override vence
      expect(autoQualityRun).toHaveBeenCalledWith(
        expect.objectContaining({ mode: 'analyze' })
      );
    });

    it('should handle errors gracefully', async () => {
      const { nlCommand } = await import('../nl-command.js');
      const { autoQualityRun } = await import('../auto.js');
      
      // Force error
      vi.mocked(autoQualityRun).mockRejectedValueOnce(new Error('Test error'));
      
      const result = await nlCommand({ query: 'analise' });
      
      expect(result.success).toBe(false);
      expect(result.error).toBe('Test error');
    });
  });

  describe('runNLCommand', () => {
    it('should return true on success', async () => {
      const { runNLCommand } = await import('../nl-command.js');
      
      const success = await runNLCommand('analise meu repositório');
      expect(success).toBe(true);
    });

    it('should return false on error', async () => {
      const { runNLCommand } = await import('../nl-command.js');
      const { autoQualityRun } = await import('../auto.js');
      
      // Force error
      vi.mocked(autoQualityRun).mockRejectedValueOnce(new Error('Test error'));
      
      const success = await runNLCommand('analise');
      expect(success).toBe(false);
    });
  });
});
