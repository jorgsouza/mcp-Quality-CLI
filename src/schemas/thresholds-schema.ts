/**
 * THRESHOLDS SCHEMA
 * 
 * Define o schema Zod para validação de thresholds de quality gates.
 * 
 * Quality Gates são os critérios mínimos que o código deve atender para ser aprovado.
 * Este schema define os thresholds configuráveis para cada tipo de gate.
 * 
 * @see src/tools/release-quality-gate.ts
 * @see docs/development/PLANO-PROXIMAS-FASES.md (FASE 10)
 */

import { z } from 'zod';

// ============================================================================
// SCHEMAS
// ============================================================================

/**
 * Schema para thresholds de métricas de produção (DORA)
 */
export const ProductionThresholdsSchema = z.object({
  /** Change Failure Rate máximo (0-1, ex: 0.15 = 15%) */
  cfr_max: z.number().min(0).max(1).default(0.15),
  
  /** Mean Time To Recovery máximo (em minutos) */
  mttr_max_minutes: z.number().min(0).default(60),
  
  /** Deployment Frequency mínimo (deploys/mês) */
  deployment_frequency_min: z.number().min(0).optional(),
  
  /** Lead Time máximo (em minutos) */
  lead_time_max_minutes: z.number().min(0).optional(),
});

/**
 * Schema para thresholds de mutation testing
 */
export const MutationThresholdsSchema = z.object({
  /** Mutation score mínimo geral (0-1, ex: 0.5 = 50%) */
  min_score: z.number().min(0).max(1).default(0.5),
  
  /** Mutation score mínimo para módulos críticos (0-1, ex: 0.6 = 60%) */
  critical_modules_min_score: z.number().min(0).max(1).default(0.6),
});

/**
 * Schema para thresholds de contract testing (CDC/Pact)
 */
export const ContractsThresholdsSchema = z.object({
  /** Taxa mínima de verificação de contratos (0-1, ex: 0.95 = 95%) */
  verification_rate_min: z.number().min(0).max(1).default(0.95),
  
  /** Não permitir breaking changes */
  zero_breaking_changes: z.boolean().default(true),
  
  /** Número máximo de breaking changes permitidos (se zero_breaking_changes = false) */
  max_breaking_changes: z.number().min(0).optional(),
});

/**
 * Schema para thresholds de suite health
 */
export const SuiteHealthThresholdsSchema = z.object({
  /** Taxa máxima de flakiness (0-1, ex: 0.03 = 3%) */
  flakiness_max: z.number().min(0).max(1).default(0.03),
  
  /** Tempo máximo de execução da suíte (em minutos) */
  total_runtime_max_minutes: z.number().min(0).default(12),
  
  /** Número mínimo de workers de paralelismo */
  parallelism_min: z.number().min(1).default(4),
  
  /** Taxa máxima de testes lentos (>5s) */
  slow_tests_max: z.number().min(0).max(1).optional(),
});

/**
 * Schema para thresholds de portfolio de testes (pirâmide)
 */
export const PortfolioThresholdsSchema = z.object({
  /** Percentual máximo de testes E2E (0-100, ex: 15 = 15%) */
  e2e_max_percent: z.number().min(0).max(100).default(15),
  
  /** Percentual mínimo de testes unitários (0-100, ex: 60 = 60%) */
  unit_min_percent: z.number().min(0).max(100).default(60),
  
  /** Percentual mínimo de testes de integração */
  integration_min_percent: z.number().min(0).max(100).optional(),
});

/**
 * Schema para thresholds de cobertura
 */
export const CoverageThresholdsSchema = z.object({
  /** Cobertura mínima de linhas (0-100, ex: 80 = 80%) */
  lines_min: z.number().min(0).max(100).default(80),
  
  /** Cobertura mínima de branches (0-100, ex: 75 = 75%) */
  branches_min: z.number().min(0).max(100).default(75),
  
  /** Cobertura mínima de funções (0-100, ex: 80 = 80%) */
  functions_min: z.number().min(0).max(100).default(80),
  
  /** Cobertura mínima do diff (PR) */
  diff_coverage_min: z.number().min(0).max(100).optional(),
});

/**
 * Schema completo de thresholds de quality gates
 */
export const QualityGateThresholdsSchema = z.object({
  /** Thresholds de produção (DORA metrics) */
  production: ProductionThresholdsSchema.optional(),
  
  /** Thresholds de mutation testing */
  mutation: MutationThresholdsSchema.optional(),
  
  /** Thresholds de contract testing */
  contracts: ContractsThresholdsSchema.optional(),
  
  /** Thresholds de suite health */
  suite_health: SuiteHealthThresholdsSchema.optional(),
  
  /** Thresholds de portfolio de testes */
  portfolio: PortfolioThresholdsSchema.optional(),
  
  /** Thresholds de cobertura */
  coverage: CoverageThresholdsSchema.optional(),
});

// ============================================================================
// TYPES
// ============================================================================

export type ProductionThresholds = z.infer<typeof ProductionThresholdsSchema>;
export type MutationThresholds = z.infer<typeof MutationThresholdsSchema>;
export type ContractsThresholds = z.infer<typeof ContractsThresholdsSchema>;
export type SuiteHealthThresholds = z.infer<typeof SuiteHealthThresholdsSchema>;
export type PortfolioThresholds = z.infer<typeof PortfolioThresholdsSchema>;
export type CoverageThresholds = z.infer<typeof CoverageThresholdsSchema>;
export type QualityGateThresholds = z.infer<typeof QualityGateThresholdsSchema>;

// ============================================================================
// DEFAULTS
// ============================================================================

/**
 * Thresholds padrão recomendados para quality gates
 */
export const DEFAULT_THRESHOLDS: QualityGateThresholds = {
  production: {
    cfr_max: 0.15, // 15% máximo
    mttr_max_minutes: 60, // 1 hora
  },
  mutation: {
    min_score: 0.5, // 50% mínimo
    critical_modules_min_score: 0.6, // 60% para críticos
  },
  contracts: {
    verification_rate_min: 0.95, // 95% mínimo
    zero_breaking_changes: true,
  },
  suite_health: {
    flakiness_max: 0.03, // 3% máximo
    total_runtime_max_minutes: 12, // 12 minutos
    parallelism_min: 4, // 4 workers
  },
  portfolio: {
    e2e_max_percent: 15, // 15% máximo
    unit_min_percent: 60, // 60% mínimo
  },
  coverage: {
    lines_min: 80, // 80% mínimo
    branches_min: 75, // 75% mínimo
    functions_min: 80, // 80% mínimo
  },
};

// ============================================================================
// VALIDATION HELPERS
// ============================================================================

/**
 * Valida e retorna thresholds com defaults aplicados
 */
export function validateThresholds(
  thresholds: unknown
): QualityGateThresholds {
  try {
    return QualityGateThresholdsSchema.parse(thresholds);
  } catch (error) {
    console.warn('⚠️  Thresholds inválidos, usando defaults:', error);
    return DEFAULT_THRESHOLDS;
  }
}

/**
 * Merge thresholds customizados com defaults
 */
export function mergeThresholds(
  custom: Partial<QualityGateThresholds>
): QualityGateThresholds {
  return {
    production: custom.production ? {
      ...DEFAULT_THRESHOLDS.production,
      ...custom.production,
    } : DEFAULT_THRESHOLDS.production,
    mutation: custom.mutation ? {
      ...DEFAULT_THRESHOLDS.mutation,
      ...custom.mutation,
    } : DEFAULT_THRESHOLDS.mutation,
    contracts: custom.contracts ? {
      ...DEFAULT_THRESHOLDS.contracts,
      ...custom.contracts,
    } : DEFAULT_THRESHOLDS.contracts,
    suite_health: custom.suite_health ? {
      ...DEFAULT_THRESHOLDS.suite_health,
      ...custom.suite_health,
    } : DEFAULT_THRESHOLDS.suite_health,
    portfolio: custom.portfolio ? {
      ...DEFAULT_THRESHOLDS.portfolio,
      ...custom.portfolio,
    } : DEFAULT_THRESHOLDS.portfolio,
    coverage: custom.coverage ? {
      ...DEFAULT_THRESHOLDS.coverage,
      ...custom.coverage,
    } : DEFAULT_THRESHOLDS.coverage,
  };
}

// ============================================================================
// EXPORTS
// ============================================================================

export default {
  ProductionThresholdsSchema,
  MutationThresholdsSchema,
  ContractsThresholdsSchema,
  SuiteHealthThresholdsSchema,
  PortfolioThresholdsSchema,
  CoverageThresholdsSchema,
  QualityGateThresholdsSchema,
  DEFAULT_THRESHOLDS,
  validateThresholds,
  mergeThresholds,
};

