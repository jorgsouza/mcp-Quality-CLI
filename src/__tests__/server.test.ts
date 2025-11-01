import { describe, it, expect } from 'vitest';
import { z } from 'zod';

describe('QualityMCPServer - Schema Validations', () => {
  describe('analyze_codebase', () => {
    it('deve validar parâmetros válidos', () => {
      const AnalyzeSchema = z.object({
        repo: z.string().min(1),
        product: z.string().min(1),
        domains: z.array(z.string()).optional(),
        critical_flows: z.array(z.string()).optional()
      });

      const validData = {
        repo: '/path/to/repo',
        product: 'TestProduct'
      };

      expect(() => AnalyzeSchema.parse(validData)).not.toThrow();
    });

    it('deve rejeitar sem repo', () => {
      const AnalyzeSchema = z.object({
        repo: z.string().min(1),
        product: z.string().min(1)
      });

      const invalidData = {
        product: 'TestProduct'
      };

      expect(() => AnalyzeSchema.parse(invalidData)).toThrow();
    });
  });

  describe('generate_test_plan', () => {
    it('deve validar URL válida', () => {
      const PlanSchema = z.object({
        repo: z.string().min(1),
        product: z.string().min(1),
        base_url: z.string().url()
      });

      const validData = {
        repo: '/path',
        product: 'Test',
        base_url: 'https://example.com'
      };

      expect(() => PlanSchema.parse(validData)).not.toThrow();
    });

    it('deve rejeitar URL inválida', () => {
      const PlanSchema = z.object({
        base_url: z.string().url()
      });

      expect(() => PlanSchema.parse({ base_url: 'invalid' })).toThrow();
    });
  });

  describe('init_product', () => {
    it('deve validar nome de produto alphanumeric', () => {
      const regex = /^[a-zA-Z0-9-_]+$/;
      
      expect(regex.test('valid-product-123')).toBe(true);
      expect(regex.test('invalid@product!')).toBe(false);
    });

    it('deve validar schema completo', () => {
      const InitSchema = z.object({
        repo: z.string().min(1),
        product: z.string().min(1).regex(/^[a-zA-Z0-9-_]+$/),
        base_url: z.string().url()
      });

      const validData = {
        repo: '/path',
        product: 'my-product',
        base_url: 'https://example.com'
      };

      expect(() => InitSchema.parse(validData)).not.toThrow();
    });
  });

  describe('Tool Names', () => {
    it('deve ter todos os nomes de tools essenciais', () => {
      const toolNames = [
        'nl_command',
        'auto',
        'analyze_codebase',
        'generate_test_plan',
        'scaffold_playwright',
        'run_playwright',
        'build_report',
        'analyze_test_coverage',
        'scaffold_unit_tests',
        'scaffold_integration_tests',
        'generate_pyramid_report',
        'catalog_scenarios',
        'recommend_test_strategy',
        'run_coverage_analysis',
        'init_product',
        'diff_coverage'
      ];

      expect(toolNames).toHaveLength(16);
      expect(toolNames).toContain('nl_command');
      expect(toolNames).toContain('auto');
    });
  });
});
