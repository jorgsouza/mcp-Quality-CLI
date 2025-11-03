/**
 * Schemas Zod para CUJs (Critical User Journeys), SLOs e Risk Register
 */

import { z } from 'zod';

/**
 * Critical User Journey
 */
export const CUJSchema = z.object({
  id: z.string().describe('Identificador único (e.g., "checkout-purchase")'),
  name: z.string().describe('Nome legível da jornada'),
  description: z.string().optional().describe('Descrição detalhada'),
  criticality: z.enum(['critical', 'high', 'medium', 'low']).describe('Nível de criticidade'),
  endpoints: z.array(z.string()).describe('Endpoints HTTP envolvidos'),
  dependencies: z.array(z.string()).describe('Serviços/módulos dependentes'),
  user_flow: z.array(z.string()).optional().describe('Steps da jornada'),
  traffic_volume: z.enum(['very-high', 'high', 'medium', 'low']).optional().describe('Volume de tráfego'),
  revenue_impact: z.enum(['critical', 'high', 'medium', 'low']).optional().describe('Impacto em receita'),
});

export const CUJCatalogSchema = z.object({
  timestamp: z.string().datetime().describe('Quando foi gerado'),
  repo: z.string().describe('Repositório analisado'),
  product: z.string().describe('Nome do produto'),
  sources: z.array(z.enum(['routes', 'openapi', 'telemetry', 'readme'])).describe('Fontes usadas'),
  cujs: z.array(CUJSchema).describe('Lista de CUJs identificados'),
  auto_detected: z.number().describe('Quantos foram auto-detectados'),
  manual_review_needed: z.boolean().describe('Se precisa revisão manual'),
});

/**
 * Service Level Objective
 */
export const SLOSchema = z.object({
  cuj_id: z.string().describe('ID do CUJ associado'),
  latency_p50_ms: z.number().min(0).optional().describe('Latência P50 em ms'),
  latency_p95_ms: z.number().min(0).optional().describe('Latência P95 em ms'),
  latency_p99_ms: z.number().min(0).optional().describe('Latência P99 em ms'),
  error_rate_max: z.number().min(0).max(1).describe('Taxa de erro máxima (0-1)'),
  availability_min: z.number().min(0).max(1).describe('Disponibilidade mínima (0-1)'),
  throughput_min_rps: z.number().min(0).optional().describe('Throughput mínimo em req/s'),
  custom_metrics: z.record(z.number()).optional().describe('Métricas customizadas'),
});

export const SLOsSchema = z.object({
  timestamp: z.string().datetime(),
  repo: z.string(),
  product: z.string(),
  slos: z.array(SLOSchema),
  defaults_applied: z.boolean().describe('Se usou valores padrão'),
});

/**
 * Risk Register Entry
 */
export const RiskSchema = z.object({
  id: z.string().describe('ID único do risco'),
  cuj_id: z.string().describe('CUJ afetado'),
  title: z.string().describe('Título do risco'),
  description: z.string().describe('Descrição detalhada'),
  impact: z.enum(['critical', 'high', 'medium', 'low']).describe('Impacto no negócio'),
  probability: z.enum(['very-high', 'high', 'medium', 'low', 'very-low']).describe('Probabilidade de ocorrer'),
  risk_score: z.number().min(0).max(100).describe('Score calculado (0-100)'),
  affected_modules: z.array(z.string()).describe('Módulos/serviços afetados'),
  mitigation_strategies: z.array(z.string()).describe('Estratégias de mitigação'),
  test_coverage: z.number().min(0).max(1).optional().describe('Cobertura de testes atual'),
  mutation_score: z.number().min(0).max(1).optional().describe('Mutation score atual'),
  has_cdc: z.boolean().optional().describe('Se tem CDC (Contract-Driven)'),
  recommended_tests: z.array(z.enum(['unit', 'integration', 'e2e', 'cdc', 'property', 'chaos'])).describe('Tipos de teste recomendados'),
});

export const RiskRegisterSchema = z.object({
  timestamp: z.string().datetime(),
  repo: z.string(),
  product: z.string(),
  risks: z.array(RiskSchema),
  top_5_critical: z.array(z.string()).describe('IDs dos 5 riscos mais críticos'),
  total_risk_score: z.number().describe('Score total agregado'),
  coverage_gaps: z.array(z.object({
    module: z.string(),
    current_coverage: z.number(),
    target_coverage: z.number(),
    gap: z.number(),
  })).describe('Gaps de cobertura identificados'),
});

/**
 * Types derivados dos schemas
 */
export type CUJ = z.infer<typeof CUJSchema>;
export type CUJCatalog = z.infer<typeof CUJCatalogSchema>;
export type SLO = z.infer<typeof SLOSchema>;
export type SLOs = z.infer<typeof SLOsSchema>;
export type Risk = z.infer<typeof RiskSchema>;
export type RiskRegister = z.infer<typeof RiskRegisterSchema>;

/**
 * Defaults para SLOs (baseado em práticas SRE do Google)
 */
export const DEFAULT_SLOS = {
  // APIs web típicas
  web_api: {
    latency_p50_ms: 100,
    latency_p95_ms: 300,
    latency_p99_ms: 500,
    error_rate_max: 0.01, // 1%
    availability_min: 0.995, // 99.5%
  },
  // Processos batch/background
  batch: {
    latency_p99_ms: 5000,
    error_rate_max: 0.05, // 5%
    availability_min: 0.99, // 99%
  },
  // APIs críticas (pagamento, autenticação)
  critical: {
    latency_p50_ms: 50,
    latency_p95_ms: 150,
    latency_p99_ms: 300,
    error_rate_max: 0.001, // 0.1%
    availability_min: 0.999, // 99.9%
  },
} as const;

/**
 * Matriz de cálculo de Risk Score
 * Impact × Probability = Risk Score (0-100)
 */
export const RISK_SCORE_MATRIX = {
  impact: {
    critical: 25,
    high: 15,
    medium: 10,
    low: 5,
  },
  probability: {
    'very-high': 4,
    high: 3,
    medium: 2,
    low: 1,
    'very-low': 0.5,
  },
} as const;

/**
 * Calcula risk score baseado em impacto e probabilidade
 */
export function calculateRiskScore(
  impact: Risk['impact'],
  probability: Risk['probability']
): number {
  const impactScore = RISK_SCORE_MATRIX.impact[impact];
  const probabilityMultiplier = RISK_SCORE_MATRIX.probability[probability];
  return impactScore * probabilityMultiplier;
}
