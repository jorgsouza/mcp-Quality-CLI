/**
 * risk-register.ts
 * Gera Risk Register cruzando CUJs, SLOs e cobertura de testes
 * 
 * FASE 1 - MVP: Identifica top 5 riscos críticos baseado em:
 * - Criticidade do CUJ (critical > high)
 * - SLOs rigorosos (latency < 200ms, availability > 99.9%)
 * - Cobertura baixa (< 80% para critical, < 60% para high)
 * - Número de dependências (> 3)
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPaths, ensurePaths } from '../utils/paths.js';
import {
  RiskRegisterSchema,
  CUJCatalogSchema,
  SLOsSchema,
  calculateRiskScore,
  type Risk,
  type RiskRegister,
  type CUJCatalog,
  type SLOs,
} from '../schemas/cuj-schemas.js';

export interface RiskRegisterParams {
  repo: string;
  product: string;
  cuj_file?: string; // Path para cuj-catalog.json
  slos_file?: string; // Path para slos.json
  coverage_file?: string; // Path para coverage-analysis.json (opcional)
}

export interface RiskRegisterResult {
  ok: boolean;
  output: string;
  total_risks: number;
  critical_risks: number;
  top_5_risk_ids: string[];
  error?: string;
}

/**
 * Gera Risk Register baseado em CUJs, SLOs e cobertura
 */
export async function riskRegister(params: RiskRegisterParams): Promise<RiskRegisterResult> {
  const { repo, product } = params;

  try {
    const paths = getPaths(repo, product);
    await ensurePaths(paths);

    console.log('📂 [1/4] Carregando dados...');
    const cujFilePath = params.cuj_file || join(paths.analyses, 'cuj-catalog.json');
    const slosFilePath = params.slos_file || join(paths.analyses, 'slos.json');
    const coverageFilePath = params.coverage_file || join(paths.analyses, 'coverage-analysis.json');

    const cujCatalog = await loadCUJCatalog(cujFilePath);
    const slosData = await loadSLOs(slosFilePath);
    const coverageData = await loadCoverageOptional(coverageFilePath);

    console.log(`   ${cujCatalog.cujs.length} CUJs, ${slosData.slos.length} SLOs carregados`);

    console.log('🎯 [2/4] Calculando riscos...');
    const risks = calculateRisks(cujCatalog, slosData, coverageData);
    console.log(`   ${risks.length} riscos identificados`);

    console.log('📊 [3/4] Priorizando riscos...');
    const top5Ids = getTop5CriticalRiskIds(risks);
    const criticalCount = risks.filter(r => r.risk_score >= 75).length;
    console.log(`   ${criticalCount} riscos críticos (score ≥ 75)`);

    console.log('💾 [4/4] Salvando Risk Register...');
    const totalRiskScore = risks.reduce((sum, r) => sum + r.risk_score, 0);
    const coverageGaps = identifyCoverageGaps(risks, coverageData);
    
    const riskRegisterData: RiskRegister = {
      timestamp: new Date().toISOString(),
      repo,
      product,
      risks,
      top_5_critical: top5Ids,
      total_risk_score: totalRiskScore,
      coverage_gaps: coverageGaps,
    };

    // Validar com schema
    const validated = RiskRegisterSchema.parse(riskRegisterData);

    const outputPath = join(paths.analyses, 'risk-register.json');
    await writeFile(outputPath, JSON.stringify(validated, null, 2));

    console.log(`✅ ${risks.length} riscos salvos: ${outputPath}`);

    return {
      ok: true,
      output: outputPath,
      total_risks: risks.length,
      critical_risks: criticalCount,
      top_5_risk_ids: top5Ids,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro ao gerar Risk Register:', message);
    return {
      ok: false,
      output: '',
      total_risks: 0,
      critical_risks: 0,
      top_5_risk_ids: [],
      error: message,
    };
  }
}

/**
 * Carrega catálogo de CUJs
 */
async function loadCUJCatalog(filePath: string): Promise<CUJCatalog> {
  const content = await readFile(filePath, 'utf-8');
  const data = JSON.parse(content);
  return CUJCatalogSchema.parse(data);
}

/**
 * Carrega SLOs
 */
async function loadSLOs(filePath: string): Promise<SLOs> {
  const content = await readFile(filePath, 'utf-8');
  const data = JSON.parse(content);
  return SLOsSchema.parse(data);
}

/**
 * Carrega análise de cobertura (opcional)
 */
async function loadCoverageOptional(filePath: string): Promise<any | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    // Arquivo não existe, retornar null
    return null;
  }
}

/**
 * Calcula riscos para cada CUJ
 */
function calculateRisks(
  cujCatalog: CUJCatalog,
  slosData: SLOs,
  coverageData: any | null
): Risk[] {
  const risks: Risk[] = [];

  for (const cuj of cujCatalog.cujs) {
    const slo = slosData.slos.find(s => s.cuj_id === cuj.id);
    
    // Determinar impacto baseado em criticidade + SLO
    const impact = determineImpact(cuj, slo);
    
    // Determinar probabilidade baseado em cobertura + dependências
    const probability = determineProbability(cuj, coverageData);
    
    // Calcular score
    const risk_score = calculateRiskScore(impact, probability);

    // Gerar estratégias de mitigação
    const mitigation_strategies = generateMitigationStrategies(cuj, slo, coverageData);

    // Módulos afetados (baseado em endpoints)
    const affected_modules = cuj.endpoints?.map((e: any) => e.file || e.path).filter(Boolean) || [];

    // Tipos de teste recomendados
    const recommended_tests = recommendTestTypes(cuj, slo, coverageData);

    // Criar Risk completo
    risks.push({
      id: `risk-${cuj.id}`,
      cuj_id: cuj.id,
      title: `Risco: ${cuj.name}`,
      description: generateRiskDescription(cuj, impact, probability),
      impact,
      probability,
      risk_score,
      affected_modules,
      mitigation_strategies,
      test_coverage: getCoverageForCUJ(cuj, coverageData),
      mutation_score: undefined, // TODO: Implementar mutation scoring
      has_cdc: false, // TODO: Detectar se tem CDC
      recommended_tests,
    });
  }

  // Ordenar por score descendente
  return risks.sort((a, b) => b.risk_score - a.risk_score);
}

/**
 * Determina impacto baseado em criticidade e SLO
 */
function determineImpact(cuj: any, slo: any): 'critical' | 'high' | 'medium' | 'low' {
  // Se CUJ é critical E tem SLO rigoroso (p99 < 200ms OU availability > 99.9%)
  if (cuj.criticality === 'critical') {
    if (slo?.latency_p99_ms && slo.latency_p99_ms < 200) return 'critical';
    if (slo?.availability_min && slo.availability_min > 0.999) return 'critical';
    return 'high'; // CUJ critical mas SLO relaxado
  }

  // Se CUJ é high
  if (cuj.criticality === 'high') {
    return 'high';
  }

  // Se CUJ é medium
  if (cuj.criticality === 'medium') {
    return 'medium';
  }

  return 'low';
}

/**
 * Determina probabilidade baseado em cobertura e dependências
 */
function determineProbability(cuj: any, coverageData: any | null): 'very-high' | 'high' | 'medium' | 'low' {
  const dependenciesCount = cuj.dependencies?.length || 0;

  // Se não tem dados de cobertura, assume médio risco
  if (!coverageData) {
    if (dependenciesCount > 5) return 'high';
    if (dependenciesCount > 3) return 'medium';
    return 'low';
  }

  // Tentar encontrar cobertura dos endpoints do CUJ
  const coverage = getCoverageForCUJ(cuj, coverageData);

  // Probabilidade baseado em cobertura + dependências
  if (coverage !== undefined) {
    if (coverage < 60 && dependenciesCount > 3) return 'very-high';
    if (coverage < 60) return 'high';
    if (coverage < 80 && dependenciesCount > 3) return 'high';
    if (coverage < 80) return 'medium';
    return 'low';
  }

  // Fallback: baseado apenas em dependências
  if (dependenciesCount > 5) return 'high';
  if (dependenciesCount > 3) return 'medium';
  return 'low';
}

/**
 * Busca cobertura para um CUJ (heurística: procura por file dos endpoints)
 */
function getCoverageForCUJ(cuj: any, coverageData: any): number | undefined {
  if (!cuj.endpoints || cuj.endpoints.length === 0) return undefined;

  const files = cuj.endpoints.map((e: any) => e.file).filter((f: string) => f);
  if (files.length === 0) return undefined;

  // Buscar coverage dos files (simplificado para MVP)
  // TODO: Implementar lógica real baseada em coverage-analysis.json
  return undefined; // Por enquanto retorna undefined
}

/**
 * Gera descrição do risco
 */
function generateRiskDescription(cuj: any, impact: string, probability: string): string {
  return `${cuj.name} apresenta impacto ${impact} e probabilidade ${probability} de falha. ` +
    `Este CUJ possui ${cuj.endpoints?.length || 0} endpoints e ${cuj.dependencies?.length || 0} dependências.`;
}

/**
 * Recomenda tipos de teste baseado no contexto
 */
function recommendTestTypes(
  cuj: any,
  slo: any,
  coverageData: any | null
): Array<'unit' | 'integration' | 'e2e' | 'cdc' | 'property' | 'chaos'> {
  const tests: Array<'unit' | 'integration' | 'e2e' | 'cdc' | 'property' | 'chaos'> = [];

  // Sempre recomendar unit tests
  tests.push('unit');

  // Se tem dependências, recomendar integration + CDC
  if (cuj.dependencies && cuj.dependencies.length > 0) {
    tests.push('integration');
    tests.push('cdc');
  }

  // Se é critical, recomendar E2E
  if (cuj.criticality === 'critical') {
    tests.push('e2e');
  }

  // Se tem SLO rigoroso, recomendar property tests
  if (slo?.latency_p99_ms && slo.latency_p99_ms < 200) {
    tests.push('property');
  }

  // Se é critical com muitas dependências, recomendar chaos
  if (cuj.criticality === 'critical' && cuj.dependencies && cuj.dependencies.length > 3) {
    tests.push('chaos');
  }

  return tests;
}

/**
 * Gera estratégias de mitigação baseado no contexto
 */
function generateMitigationStrategies(cuj: any, slo: any, coverageData: any | null): string[] {
  const strategies: string[] = [];

  // Se tem dependências complexas
  if (cuj.dependencies && cuj.dependencies.length > 3) {
    strategies.push('Implementar Circuit Breaker para dependências externas');
    strategies.push('Adicionar testes de contrato (CDC) para APIs upstream');
  }

  // Se SLO rigoroso
  if (slo?.latency_p99_ms && slo.latency_p99_ms < 200) {
    strategies.push('Adicionar cache para reduzir latência');
    strategies.push('Implementar timeout e retry policies');
  }

  // Se cobertura baixa (assumir se não tem coverage data)
  if (!coverageData || getCoverageForCUJ(cuj, coverageData) === null) {
    strategies.push('Aumentar cobertura de testes unitários e integração');
    strategies.push('Adicionar testes E2E para validar user flow completo');
  }

  // Se é critical
  if (cuj.criticality === 'critical') {
    strategies.push('Implementar feature flag para rollback rápido');
    strategies.push('Configurar alertas de monitoramento (SLO violations)');
  }

  return strategies;
}

/**
 * Retorna IDs dos top 5 riscos críticos (score ≥ 75)
 */
function getTop5CriticalRiskIds(risks: Risk[]): string[] {
  return risks
    .filter(r => r.risk_score >= 75)
    .slice(0, 5)
    .map(r => r.id);
}

/**
 * Identifica gaps de cobertura
 */
function identifyCoverageGaps(risks: Risk[], coverageData: any | null): Array<{
  module: string;
  current_coverage: number;
  target_coverage: number;
  gap: number;
}> {
  const gaps: Array<{
    module: string;
    current_coverage: number;
    target_coverage: number;
    gap: number;
  }> = [];

  // Para MVP, retornar gaps vazios (TODO: implementar lógica real)
  // Aqui você faria:
  // 1. Listar todos os módulos dos riscos críticos
  // 2. Buscar coverage atual de cada módulo
  // 3. Comparar com target (80% para critical, 60% para high)
  // 4. Calcular gap

  return gaps;
}

/**
 * Retorna top 5 riscos críticos (score ≥ 75)
 */
function getTop5CriticalRisks(risks: Risk[]): Risk[] {
  return risks
    .filter(r => r.risk_score >= 75)
    .slice(0, 5);
}
