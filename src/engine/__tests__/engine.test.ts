/**
 * 🧪 Testes do Engine Modular
 */

import { describe, it, expect, vi } from 'vitest';
import { detectLanguage, runPipeline } from '../index.js';
import type { LanguageAdapter } from '../capabilities.js';

describe('Engine Modular', () => {
  describe('detectLanguage', () => {
    it('deve detectar adapter baseado no método detect', async () => {
      const mockAdapter1: LanguageAdapter = {
        language: 'python',
        frameworks: ['pytest'],
        detect: vi.fn().mockResolvedValue(false),
        detectFramework: vi.fn(),
        capabilities: {},
      };

      const mockAdapter2: LanguageAdapter = {
        language: 'typescript',
        frameworks: ['vitest'],
        detect: vi.fn().mockResolvedValue(true),
        detectFramework: vi.fn(),
        capabilities: {},
      };

      const result = await detectLanguage('/fake/repo', [mockAdapter1, mockAdapter2]);

      expect(result).toBe(mockAdapter2);
      expect(result?.language).toBe('typescript');
    });

    it('deve retornar null se nenhum adapter detectar', async () => {
      const mockAdapter: LanguageAdapter = {
        language: 'python',
        frameworks: ['pytest'],
        detect: vi.fn().mockResolvedValue(false),
        detectFramework: vi.fn(),
        capabilities: {},
      };

      const result = await detectLanguage('/fake/repo', [mockAdapter]);

      expect(result).toBeNull();
    });
  });

  describe('runPipeline', () => {
    it('deve lançar erro se linguagem não detectada', async () => {
      const mockAdapter: LanguageAdapter = {
        language: 'python',
        frameworks: ['pytest'],
        detect: vi.fn().mockResolvedValue(false),
        detectFramework: vi.fn(),
        capabilities: {},
      };

      const result = await runPipeline(
        { repo: '/fake/repo', product: 'test' },
        [mockAdapter]
      );

      expect(result.ok).toBe(false);
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('não detectada');
    });

    it('deve executar pipeline com adapter válido (stub)', async () => {
      const mockAdapter: LanguageAdapter = {
        language: 'typescript',
        frameworks: ['vitest'],
        detect: vi.fn().mockResolvedValue(true),
        detectFramework: vi.fn().mockResolvedValue('vitest'),
        capabilities: {
          functions: vi.fn().mockResolvedValue([]),
          tests: vi.fn().mockResolvedValue([]),
          cases: vi.fn().mockResolvedValue([]),
        },
      };

      const result = await runPipeline(
        { repo: '/fake/repo', product: 'test', profile: 'ci-fast' },
        [mockAdapter]
      );

      expect(result.ok).toBe(true);
      expect(result.language).toBe('typescript');
      expect(result.framework).toBe('vitest');
      expect(result.execution.stepsExecuted).toContain('functions');
      expect(result.execution.stepsExecuted).toContain('tests');
      expect(result.execution.stepsExecuted).toContain('cases');
    });

    it('deve pular mutation em perfil ci-fast', async () => {
      const mockAdapter: LanguageAdapter = {
        language: 'typescript',
        frameworks: ['vitest'],
        detect: vi.fn().mockResolvedValue(true),
        detectFramework: vi.fn().mockResolvedValue('vitest'),
        capabilities: {
          functions: vi.fn().mockResolvedValue([]),
          tests: vi.fn().mockResolvedValue([]),
          mutation: vi.fn().mockResolvedValue({ score: 75, killed: 75, survived: 25, timeout: 0, noCoverage: 0, survivors: [] }),
        },
      };

      const result = await runPipeline(
        { repo: '/fake/repo', product: 'test', profile: 'ci-fast' },
        [mockAdapter]
      );

      expect(result.execution.stepsSkipped).toContain('mutation');
      expect(mockAdapter.capabilities.mutation).not.toHaveBeenCalled();
    });

    it('deve executar mutation em perfil ci-strict', async () => {
      const mockAdapter: LanguageAdapter = {
        language: 'typescript',
        frameworks: ['vitest'],
        detect: vi.fn().mockResolvedValue(true),
        detectFramework: vi.fn().mockResolvedValue('vitest'),
        capabilities: {
          functions: vi.fn().mockResolvedValue([]),
          tests: vi.fn().mockResolvedValue([]),
          mutation: vi.fn().mockResolvedValue({ 
            score: 75, 
            killed: 75, 
            survived: 25, 
            timeout: 0, 
            noCoverage: 0, 
            survivors: [] 
          }),
        },
      };

      const result = await runPipeline(
        { repo: '/fake/repo', product: 'test', profile: 'ci-strict' },
        [mockAdapter]
      );

      expect(result.execution.stepsExecuted).toContain('mutation');
      expect(mockAdapter.capabilities.mutation).toHaveBeenCalled();
      expect(result.report.metrics.mutationScore).toBe(75);
    });

    it('deve calcular quality score corretamente', async () => {
      const mockAdapter: LanguageAdapter = {
        language: 'typescript',
        frameworks: ['vitest'],
        detect: vi.fn().mockResolvedValue(true),
        detectFramework: vi.fn().mockResolvedValue('vitest'),
        capabilities: {
          functions: vi.fn().mockResolvedValue([
            { name: 'fn1', filePath: 'src/fn1.ts', criticality: 'CRITICAL', startLine: 1, endLine: 10, params: [], isExported: true, isAsync: false }
          ]),
          tests: vi.fn().mockResolvedValue([
            { name: 'test1', filePath: 'test/fn1.test.ts', assertions: [], hasSpies: false, hasMocks: false }
          ]),
          cases: vi.fn().mockResolvedValue([
            { functionName: 'fn1', happy: true, error: true, edge: true, sideEffects: true, gaps: [] }
          ]),
          coverage: vi.fn().mockResolvedValue({
            lines: 85,
            branches: 80,
            functions: 90,
            statements: 85,
            uncoveredLines: []
          }),
          mutation: vi.fn().mockResolvedValue({
            score: 70,
            killed: 70,
            survived: 30,
            timeout: 0,
            noCoverage: 0,
            survivors: []
          }),
        },
      };

      const result = await runPipeline(
        { repo: '/fake/repo', product: 'test', profile: 'ci-strict' },
        [mockAdapter]
      );

      expect(result.report.metrics.qualityScore).toBeGreaterThan(0);
      expect(result.report.metrics.grade).toMatch(/[ABCDF]/);
    });
  });
});
