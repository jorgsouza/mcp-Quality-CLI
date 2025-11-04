/**
 * RELEASE QUALITY GATE
 * 
 * Valida quality gates para bloquear releases ruins.
 * Suporta múltiplos tipos de gates: coverage, mutation, CDC, suite health, portfolio.
 * 
 * Exit Codes:
 * - 0: All gates passed ✅
 * - 1: Blocking violation ❌ (CFR, mutation critical, breaking changes)
 * - 2: Non-blocking violation ⚠️ (flakiness, E2E%, slow tests)
 * 
 * @see src/schemas/thresholds-schema.ts
 * @see docs/development/PLANO-PROXIMAS-FASES.md (FASE 10)
 */

import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { getPaths } from '../utils/paths.js';
import { fileExists, writeFileSafe } from '../utils/fs.js';
import {
  QualityGateThresholds,
  DEFAULT_THRESHOLDS,
  mergeThresholds,
  validateThresholds,
} from '../schemas/thresholds-schema.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ReleaseQualityGateOptions {
  repo: string;
  product: string;
  /** Caminho para thresholds.json customizado (opcional) */
  thresholdsFile?: string;
  /** Modo estrito (falha em qualquer violação, não apenas blocking) */
  strict?: boolean;
}

export interface GateViolation {
  gate: string;
  category: 'production' | 'mutation' | 'contracts' | 'suite_health' | 'portfolio' | 'coverage';
  severity: 'blocking' | 'non-blocking';
  expected: number | boolean;
  actual: number | boolean;
  message: string;
}

export interface GateMetrics {
  // Production (DORA)
  cfr?: number;
  mttr_minutes?: number;
  deployment_frequency?: number;
  lead_time_minutes?: number;

  // Mutation
  mutation_score?: number;
  critical_mutation_score?: number;

  // Contracts (CDC)
  contract_verification_rate?: number;
  breaking_changes_count?: number;

  // Suite Health
  flakiness?: number;
  suite_runtime_minutes?: number;
  parallelism?: number;

  // Portfolio
  unit_percent?: number;
  integration_percent?: number;
  e2e_percent?: number;

  // Coverage
  lines_coverage?: number;
  branches_coverage?: number;
  functions_coverage?: number;
  diff_coverage?: number;
}

export interface ReleaseQualityGateResult {
  passed: boolean;
  exit_code: 0 | 1 | 2;
  timestamp: string;
  violations: GateViolation[];
  metrics: GateMetrics;
  thresholds: QualityGateThresholds;
  summary: {
    total_gates: number;
    passed_gates: number;
    failed_gates: number;
    blocking_violations: number;
    non_blocking_violations: number;
  };
  output_path: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function releaseQualityGate(
  options: ReleaseQualityGateOptions
): Promise<ReleaseQualityGateResult> {
  const repoPath = resolve(options.repo);
  const paths = getPaths(repoPath, options.product);

  console.log('🚦 [Release Quality Gate] Iniciando validação...\n');

  // 1. Carregar thresholds
  const thresholds = await loadThresholds(paths, options.thresholdsFile);
  console.log('  📋 Thresholds carregados\n');

  // 2. Coletar métricas de todos os relatórios
  const metrics = await collectMetrics(paths);
  console.log('  📊 Métricas coletadas\n');

  // 3. Validar cada gate
  const violations: GateViolation[] = [];

  // 3.1. Coverage Gates
  if (thresholds.coverage) {
    violations.push(...validateCoverageGates(metrics, thresholds.coverage));
  }

  // 3.2. Mutation Gates
  if (thresholds.mutation) {
    violations.push(...validateMutationGates(metrics, thresholds.mutation));
  }

  // 3.3. Contracts Gates (CDC/Pact)
  if (thresholds.contracts) {
    violations.push(...validateContractsGates(metrics, thresholds.contracts));
  }

  // 3.4. Suite Health Gates
  if (thresholds.suite_health) {
    violations.push(...validateSuiteHealthGates(metrics, thresholds.suite_health));
  }

  // 3.5. Portfolio Gates (Test Pyramid)
  if (thresholds.portfolio) {
    violations.push(...validatePortfolioGates(metrics, thresholds.portfolio));
  }

  // 3.6. Production Gates (DORA) - apenas se houver métricas
  if (thresholds.production && hasProductionMetrics(metrics)) {
    violations.push(...validateProductionGates(metrics, thresholds.production));
  }

  // 4. Calcular resultado final
  const blockingViolations = violations.filter(v => v.severity === 'blocking');
  const nonBlockingViolations = violations.filter(v => v.severity === 'non-blocking');
  
  const passed = options.strict
    ? violations.length === 0
    : blockingViolations.length === 0;
  
  const exit_code: 0 | 1 | 2 = passed
    ? 0
    : blockingViolations.length > 0
    ? 1
    : 2;

  // 5. Gerar resultado
  const result: ReleaseQualityGateResult = {
    passed,
    exit_code,
    timestamp: new Date().toISOString(),
    violations,
    metrics,
    thresholds,
    summary: {
      total_gates: countTotalGates(thresholds),
      passed_gates: countTotalGates(thresholds) - violations.length,
      failed_gates: violations.length,
      blocking_violations: blockingViolations.length,
      non_blocking_violations: nonBlockingViolations.length,
    },
    output_path: join(paths.reports, 'quality-gate.json'),
  };

  // 6. Salvar relatório JSON
  await writeFileSafe(result.output_path, JSON.stringify(result, null, 2));
  console.log(`  💾 Relatório salvo: ${result.output_path}\n`);

  // 7. Log de resultado
  if (passed) {
    console.log('  ✅ Todos os quality gates APROVADOS!');
  } else if (blockingViolations.length > 0) {
    console.log(`  ❌ ${blockingViolations.length} violação(ões) BLOQUEANTE(s)!`);
    blockingViolations.forEach(v => {
      console.log(`     🔴 ${v.gate}: ${v.message}`);
    });
  }
  
  if (nonBlockingViolations.length > 0) {
    console.log(`  ⚠️  ${nonBlockingViolations.length} violação(ões) NÃO-BLOQUEANTE(s):`);
    nonBlockingViolations.forEach(v => {
      console.log(`     🟡 ${v.gate}: ${v.message}`);
    });
  }

  console.log(`\n  📊 Gates: ${result.summary.passed_gates}/${result.summary.total_gates} passaram`);
  console.log(`  🚦 Exit Code: ${exit_code}\n`);

  return result;
}

// ============================================================================
// THRESHOLD LOADING
// ============================================================================

async function loadThresholds(
  paths: ReturnType<typeof getPaths>,
  customPath?: string
): Promise<QualityGateThresholds> {
  // 1. Tentar carregar do caminho customizado
  if (customPath && await fileExists(customPath)) {
    const content = await fs.readFile(customPath, 'utf-8');
    const custom = JSON.parse(content);
    return mergeThresholds(custom);
  }

  // 2. Tentar carregar do qa/<product>/thresholds.json
  const defaultPath = join(paths.root, 'thresholds.json');
  if (await fileExists(defaultPath)) {
    const content = await fs.readFile(defaultPath, 'utf-8');
    const custom = JSON.parse(content);
    return mergeThresholds(custom);
  }

  // 3. Usar defaults
  console.log('  ℹ️  Usando thresholds padrão (nenhum thresholds.json encontrado)');
  return DEFAULT_THRESHOLDS;
}

// ============================================================================
// METRICS COLLECTION
// ============================================================================

async function collectMetrics(
  paths: ReturnType<typeof getPaths>
): Promise<GateMetrics> {
  const metrics: GateMetrics = {};

  // Coverage
  const coveragePath = join(paths.analyses, 'coverage-analysis.json');
  if (await fileExists(coveragePath)) {
    const content = await fs.readFile(coveragePath, 'utf-8');
    const data = JSON.parse(content);
    metrics.lines_coverage = data.coverage?.lines || data.lines || 0;
    metrics.branches_coverage = data.coverage?.branches || data.branches || 0;
    metrics.functions_coverage = data.coverage?.functions || data.functions || 0;
  }

  // Mutation
  const mutationPath = join(paths.reports, 'mutation-score.json');
  if (await fileExists(mutationPath)) {
    const content = await fs.readFile(mutationPath, 'utf-8');
    const data = JSON.parse(content);
    metrics.mutation_score = data.overallScore || 0;
    metrics.critical_mutation_score = data.criticalScore || 0;
  }

  // Contracts (CDC)
  const contractsPath = join(paths.reports, 'contracts-verify.json');
  if (await fileExists(contractsPath)) {
    const content = await fs.readFile(contractsPath, 'utf-8');
    const data = JSON.parse(content);
    metrics.contract_verification_rate = data.verification_rate || 0;
    metrics.breaking_changes_count = data.breaking_changes?.length || 0;
  }

  // Suite Health
  const healthPath = join(paths.reports, 'suite-health.json');
  if (await fileExists(healthPath)) {
    const content = await fs.readFile(healthPath, 'utf-8');
    const data = JSON.parse(content);
    metrics.flakiness = data.instability_index || 0;
    metrics.suite_runtime_minutes = (data.total_runtime_sec || 0) / 60;
    metrics.parallelism = data.parallelism || 1;
  }

  // Portfolio (Test Pyramid)
  const pyramidPath = join(paths.analyses, 'coverage-analysis.json');
  if (await fileExists(pyramidPath)) {
    const content = await fs.readFile(pyramidPath, 'utf-8');
    const data = JSON.parse(content);
    if (data.pyramid) {
      metrics.unit_percent = data.pyramid.unit || 0;
      metrics.integration_percent = data.pyramid.integration || 0;
      metrics.e2e_percent = data.pyramid.e2e || 0;
    }
  }

  // Production (DORA) - opcional
  const prodMetricsPath = join(paths.analyses, 'prod-metrics.json');
  if (await fileExists(prodMetricsPath)) {
    const content = await fs.readFile(prodMetricsPath, 'utf-8');
    const data = JSON.parse(content);
    if (data.dora_metrics) {
      metrics.cfr = data.dora_metrics.change_failure_rate;
      metrics.mttr_minutes = data.dora_metrics.mttr_minutes;
      metrics.deployment_frequency = data.dora_metrics.deployment_frequency;
      metrics.lead_time_minutes = data.dora_metrics.lead_time_minutes;
    }
  }

  return metrics;
}

// ============================================================================
// GATE VALIDATORS
// ============================================================================

function validateCoverageGates(
  metrics: GateMetrics,
  thresholds: NonNullable<QualityGateThresholds['coverage']>
): GateViolation[] {
  const violations: GateViolation[] = [];

  if (metrics.lines_coverage !== undefined && metrics.lines_coverage < thresholds.lines_min) {
    violations.push({
      gate: 'coverage.lines',
      category: 'coverage',
      severity: 'blocking',
      expected: thresholds.lines_min,
      actual: metrics.lines_coverage,
      message: `Cobertura de linhas ${metrics.lines_coverage.toFixed(1)}% < ${thresholds.lines_min}%`,
    });
  }

  if (metrics.branches_coverage !== undefined && metrics.branches_coverage < thresholds.branches_min) {
    violations.push({
      gate: 'coverage.branches',
      category: 'coverage',
      severity: 'blocking',
      expected: thresholds.branches_min,
      actual: metrics.branches_coverage,
      message: `Cobertura de branches ${metrics.branches_coverage.toFixed(1)}% < ${thresholds.branches_min}%`,
    });
  }

  if (metrics.functions_coverage !== undefined && metrics.functions_coverage < thresholds.functions_min) {
    violations.push({
      gate: 'coverage.functions',
      category: 'coverage',
      severity: 'non-blocking',
      expected: thresholds.functions_min,
      actual: metrics.functions_coverage,
      message: `Cobertura de funções ${metrics.functions_coverage.toFixed(1)}% < ${thresholds.functions_min}%`,
    });
  }

  return violations;
}

function validateMutationGates(
  metrics: GateMetrics,
  thresholds: NonNullable<QualityGateThresholds['mutation']>
): GateViolation[] {
  const violations: GateViolation[] = [];

  if (metrics.mutation_score !== undefined && metrics.mutation_score < (thresholds.min_score * 100)) {
    violations.push({
      gate: 'mutation.overall_score',
      category: 'mutation',
      severity: 'non-blocking',
      expected: thresholds.min_score * 100,
      actual: metrics.mutation_score,
      message: `Mutation score ${metrics.mutation_score.toFixed(1)}% < ${(thresholds.min_score * 100).toFixed(0)}%`,
    });
  }

  if (metrics.critical_mutation_score !== undefined && metrics.critical_mutation_score < (thresholds.critical_modules_min_score * 100)) {
    violations.push({
      gate: 'mutation.critical_modules_score',
      category: 'mutation',
      severity: 'blocking',
      expected: thresholds.critical_modules_min_score * 100,
      actual: metrics.critical_mutation_score,
      message: `Mutation score crítico ${metrics.critical_mutation_score.toFixed(1)}% < ${(thresholds.critical_modules_min_score * 100).toFixed(0)}%`,
    });
  }

  return violations;
}

function validateContractsGates(
  metrics: GateMetrics,
  thresholds: NonNullable<QualityGateThresholds['contracts']>
): GateViolation[] {
  const violations: GateViolation[] = [];

  if (metrics.contract_verification_rate !== undefined && metrics.contract_verification_rate < thresholds.verification_rate_min) {
    violations.push({
      gate: 'contracts.verification_rate',
      category: 'contracts',
      severity: 'blocking',
      expected: thresholds.verification_rate_min,
      actual: metrics.contract_verification_rate,
      message: `Taxa de verificação de contratos ${(metrics.contract_verification_rate * 100).toFixed(1)}% < ${(thresholds.verification_rate_min * 100).toFixed(0)}%`,
    });
  }

  if (thresholds.zero_breaking_changes && metrics.breaking_changes_count !== undefined && metrics.breaking_changes_count > 0) {
    violations.push({
      gate: 'contracts.breaking_changes',
      category: 'contracts',
      severity: 'blocking',
      expected: 0,
      actual: metrics.breaking_changes_count,
      message: `${metrics.breaking_changes_count} breaking change(s) detectado(s)`,
    });
  }

  return violations;
}

function validateSuiteHealthGates(
  metrics: GateMetrics,
  thresholds: NonNullable<QualityGateThresholds['suite_health']>
): GateViolation[] {
  const violations: GateViolation[] = [];

  if (metrics.flakiness !== undefined && metrics.flakiness > thresholds.flakiness_max) {
    violations.push({
      gate: 'suite_health.flakiness',
      category: 'suite_health',
      severity: 'non-blocking',
      expected: thresholds.flakiness_max,
      actual: metrics.flakiness,
      message: `Flakiness ${(metrics.flakiness * 100).toFixed(2)}% > ${(thresholds.flakiness_max * 100).toFixed(0)}%`,
    });
  }

  if (metrics.suite_runtime_minutes !== undefined && metrics.suite_runtime_minutes > thresholds.total_runtime_max_minutes) {
    violations.push({
      gate: 'suite_health.runtime',
      category: 'suite_health',
      severity: 'non-blocking',
      expected: thresholds.total_runtime_max_minutes,
      actual: metrics.suite_runtime_minutes,
      message: `Runtime da suite ${metrics.suite_runtime_minutes.toFixed(1)}min > ${thresholds.total_runtime_max_minutes}min`,
    });
  }

  if (metrics.parallelism !== undefined && metrics.parallelism < thresholds.parallelism_min) {
    violations.push({
      gate: 'suite_health.parallelism',
      category: 'suite_health',
      severity: 'non-blocking',
      expected: thresholds.parallelism_min,
      actual: metrics.parallelism,
      message: `Paralelismo ${metrics.parallelism} workers < ${thresholds.parallelism_min} workers`,
    });
  }

  return violations;
}

function validatePortfolioGates(
  metrics: GateMetrics,
  thresholds: NonNullable<QualityGateThresholds['portfolio']>
): GateViolation[] {
  const violations: GateViolation[] = [];

  if (metrics.e2e_percent !== undefined && metrics.e2e_percent > thresholds.e2e_max_percent) {
    violations.push({
      gate: 'portfolio.e2e_percent',
      category: 'portfolio',
      severity: 'non-blocking',
      expected: thresholds.e2e_max_percent,
      actual: metrics.e2e_percent,
      message: `Testes E2E ${metrics.e2e_percent.toFixed(1)}% > ${thresholds.e2e_max_percent}%`,
    });
  }

  if (metrics.unit_percent !== undefined && metrics.unit_percent < thresholds.unit_min_percent) {
    violations.push({
      gate: 'portfolio.unit_percent',
      category: 'portfolio',
      severity: 'non-blocking',
      expected: thresholds.unit_min_percent,
      actual: metrics.unit_percent,
      message: `Testes unitários ${metrics.unit_percent.toFixed(1)}% < ${thresholds.unit_min_percent}%`,
    });
  }

  return violations;
}

function validateProductionGates(
  metrics: GateMetrics,
  thresholds: NonNullable<QualityGateThresholds['production']>
): GateViolation[] {
  const violations: GateViolation[] = [];

  if (metrics.cfr !== undefined && metrics.cfr > thresholds.cfr_max) {
    violations.push({
      gate: 'production.cfr',
      category: 'production',
      severity: 'blocking',
      expected: thresholds.cfr_max,
      actual: metrics.cfr,
      message: `Change Failure Rate ${(metrics.cfr * 100).toFixed(1)}% > ${(thresholds.cfr_max * 100).toFixed(0)}%`,
    });
  }

  if (metrics.mttr_minutes !== undefined && metrics.mttr_minutes > thresholds.mttr_max_minutes) {
    violations.push({
      gate: 'production.mttr',
      category: 'production',
      severity: 'blocking',
      expected: thresholds.mttr_max_minutes,
      actual: metrics.mttr_minutes,
      message: `MTTR ${metrics.mttr_minutes.toFixed(0)}min > ${thresholds.mttr_max_minutes}min`,
    });
  }

  return violations;
}

// ============================================================================
// HELPERS
// ============================================================================

function hasProductionMetrics(metrics: GateMetrics): boolean {
  return !!(metrics.cfr !== undefined || metrics.mttr_minutes !== undefined);
}

function countTotalGates(thresholds: QualityGateThresholds): number {
  let count = 0;

  if (thresholds.coverage) {
    count += 3; // lines, branches, functions
  }
  if (thresholds.mutation) {
    count += 2; // overall, critical
  }
  if (thresholds.contracts) {
    count += 2; // verification_rate, breaking_changes
  }
  if (thresholds.suite_health) {
    count += 3; // flakiness, runtime, parallelism
  }
  if (thresholds.portfolio) {
    count += 2; // e2e%, unit%
  }
  if (thresholds.production) {
    count += 2; // cfr, mttr
  }

  return count;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default releaseQualityGate;

