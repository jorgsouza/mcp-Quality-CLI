/**
 * explain-tests.ts - Análise AST de Testes para KR3a e DORA
 * 
 * Objetivo de negócio:
 * - KR3a: Manter confiabilidade das entregas (máximo 10% falhas, nunca >15%)
 * - DORA: Reduzir CFR e MTTR, sem prejudicar DF e LTC
 * 
 * Como ajuda:
 * - Reforça assertividade e contratos nos arquivos do diff por PR
 * - Eleva diff coverage
 * - Documenta propósito do teste
 * - Reduz probabilidade de rollback/incidentes (CFR↓)
 * - Melhora diagnóstico (MTTR↓)
 * 
 * Pipeline:
 * 1. Descoberta & AST (TS/JS): Mapear casos (describe/it/test), extrair Given/When/Then
 * 2. Cobertura & Diff (PR-aware): Associar teste a arquivos/linhas, calcular coveredInDiff%
 * 3. Contratos (Pact): Relacionar interação e status
 * 4. Força da Asserção (assertStrength): Forte/Média/Fraca
 * 5. Propósito ("para quê?"): Ligar a risco/CUJ/SLO
 * 6. Smells & Sugestões: Marcar problemas, sugerir melhorias
 * 
 * Saídas:
 * - test-explanations.json (detalhado por teste)
 * - TEST-EXPLANATIONS.md (humano)
 * - TEST-QUALITY-SUMMARY.md (KR/DORA)
 * - test-quality-metrics.json (dashboard)
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getPaths } from '../utils/paths.js';
import { fileExists, writeFileSafe } from '../utils/fs.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ExplainTestsOptions {
  repo: string;
  product: string;
  format?: 'md' | 'json';
  outDir?: string;
  baseBranch?: string;
  minDiffCoverage?: number;
  minAsserts?: number;
  failOn?: 'weak' | 'none';
}

export interface TestExplanation {
  file: string;
  name: string;
  functionUnderTest?: string;
  given: string[];
  when: string;
  then: AssertInfo[];
  mocks: string[];
  coverage: {
    files: string[];
    linesCovered: number;
    linesTotal: number;
    coveredInDiffPct: number;
  };
  contracts: {
    pact: boolean;
    failed: number;
    interactions: number;
  };
  risk?: {
    cuj?: string;
    level?: 'baixo' | 'médio' | 'alto';
  };
  assertStrength: 'forte' | 'médio' | 'fraco';
  smells: string[];
  suggestions: string[];
}

export interface AssertInfo {
  type: string; // 'status' | 'body.prop' | 'header' | 'called' | 'generic'
  value?: any;
  path?: string;
  matcher?: string;
}

export interface TestQualityMetrics {
  assertStrongPct: number;
  assertMediumPct: number;
  assertWeakPct: number;
  diffCoveredPct: number;
  contractsProtectedPct: number;
  weakTestsInDiffPct: number;
  criticalEndpointsWithoutContract: number;
  suspectedFlakyPct: number;
  diagnosticAssertsPct: number;
  totalTests: number;
  testsWithAsserts: number;
  testsWithoutAsserts: number;
}

export interface ExplainTestsResult {
  ok: boolean;
  explanations: TestExplanation[];
  metrics: TestQualityMetrics;
  kr3aStatus: 'OK' | 'ATENÇÃO' | 'ALERTA';
  outputPaths: {
    explanationsJson: string;
    explanationsMd: string;
    qualitySummaryMd: string;
    metricsJson: string;
  };
  message?: string;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export async function explainTests(options: ExplainTestsOptions): Promise<ExplainTestsResult> {
  const {
    repo,
    product,
    format = 'md',
    baseBranch = 'main',
    minDiffCoverage = 80,
    minAsserts = 1,
    failOn = 'none',
  } = options;

  console.log('🔍 Explicando testes via AST + Coverage + Contracts...\n');
  console.log(`📁 Repo: ${repo}`);
  console.log(`📦 Product: ${product}`);
  console.log(`🌿 Base Branch: ${baseBranch}`);
  console.log(`📊 Min Diff Coverage: ${minDiffCoverage}%`);
  console.log(`🎯 Fail On: ${failOn}\n`);

  const paths = getPaths(repo, product);

  try {
    // 1. Descobrir arquivos de teste
    console.log('📂 [1/6] Descobrindo arquivos de teste...');
    const testFiles = await discoverTestFiles(repo);
    console.log(`✅ ${testFiles.length} arquivos de teste encontrados\n`);

    // 2. Analisar cada teste (AST + assertStrength)
    console.log('🔬 [2/6] Analisando AST e asserts...');
    const explanations: TestExplanation[] = [];
    for (const testFile of testFiles) {
      const fileExplanations = await analyzeTestFile(testFile, repo);
      explanations.push(...fileExplanations);
    }
    console.log(`✅ ${explanations.length} testes analisados\n`);

    // 3. Associar coverage + diff
    console.log('📊 [3/6] Associando coverage e diff...');
    await enrichWithCoverage(explanations, repo, product, baseBranch);
    console.log(`✅ Coverage associado\n`);

    // 4. Associar contracts (Pact)
    console.log('🤝 [4/6] Associando contratos CDC/Pact...');
    await enrichWithContracts(explanations, paths);
    console.log(`✅ Contracts associados\n`);

    // 5. Associar riscos/CUJs
    console.log('🎯 [5/6] Associando riscos e CUJs...');
    await enrichWithRisks(explanations, paths);
    console.log(`✅ Riscos associados\n`);

    // 6. Calcular métricas e gerar outputs
    console.log('📈 [6/6] Calculando métricas e gerando relatórios...');
    const metrics = calculateMetrics(explanations);
    const kr3aStatus = assessKR3AStatus(metrics, minDiffCoverage);
    
    const outputPaths = await generateOutputs(
      explanations,
      metrics,
      kr3aStatus,
      paths,
      format
    );
    console.log(`✅ Relatórios gerados\n`);

    // 7. Verificar gates
    const weakTestsInDiff = explanations.filter(
      e => e.assertStrength === 'fraco' && e.coverage.coveredInDiffPct > 0
    );

    let shouldFail = false;
    let failureReason = '';

    if (failOn === 'weak' && weakTestsInDiff.length > 0) {
      shouldFail = true;
      failureReason = `${weakTestsInDiff.length} testes fracos no diff`;
    }

    if (metrics.diffCoveredPct < minDiffCoverage) {
      shouldFail = true;
      failureReason = `Diff coverage ${metrics.diffCoveredPct.toFixed(1)}% < ${minDiffCoverage}%`;
    }

    console.log(`\n📊 Métricas Finais:`);
    console.log(`   Testes Fortes: ${metrics.assertStrongPct.toFixed(1)}%`);
    console.log(`   Testes Médios: ${metrics.assertMediumPct.toFixed(1)}%`);
    console.log(`   Testes Fracos: ${metrics.assertWeakPct.toFixed(1)}%`);
    console.log(`   Diff Coverage: ${metrics.diffCoveredPct.toFixed(1)}%`);
    console.log(`   Contracts Protected: ${metrics.contractsProtectedPct.toFixed(1)}%`);
    console.log(`   KR3a Status: ${kr3aStatus}\n`);

    if (shouldFail) {
      console.log(`❌ FALHA: ${failureReason}\n`);
      return {
        ok: false,
        explanations,
        metrics,
        kr3aStatus,
        outputPaths,
        message: failureReason,
      };
    }

    console.log(`✅ Análise concluída com sucesso!\n`);
    console.log(`📄 Relatórios salvos em:`);
    console.log(`   ${outputPaths.explanationsJson}`);
    console.log(`   ${outputPaths.explanationsMd}`);
    console.log(`   ${outputPaths.qualitySummaryMd}`);
    console.log(`   ${outputPaths.metricsJson}\n`);

    return {
      ok: true,
      explanations,
      metrics,
      kr3aStatus,
      outputPaths,
    };
  } catch (error) {
    console.error(`❌ Erro ao explicar testes: ${error instanceof Error ? error.message : error}\n`);
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function discoverTestFiles(repo: string): Promise<string[]> {
  // 🚧 TODO: Implementar descoberta real via glob
  // Por ora, retornar vazio (será implementado incrementalmente)
  return [];
}

async function analyzeTestFile(
  testFile: string,
  repo: string
): Promise<TestExplanation[]> {
  // 🚧 TODO: Implementar parsing AST real
  // Por ora, retornar vazio (será implementado incrementalmente)
  return [];
}

async function enrichWithCoverage(
  explanations: TestExplanation[],
  repo: string,
  product: string,
  baseBranch: string
): Promise<void> {
  // 🚧 TODO: Integrar com LCOV/diff-coverage.json
  // Por ora, skip (será implementado incrementalmente)
}

async function enrichWithContracts(
  explanations: TestExplanation[],
  paths: ReturnType<typeof getPaths>
): Promise<void> {
  // 🚧 TODO: Integrar com contracts-verify.json
  // Por ora, skip (será implementado incrementalmente)
}

async function enrichWithRisks(
  explanations: TestExplanation[],
  paths: ReturnType<typeof getPaths>
): Promise<void> {
  // 🚧 TODO: Integrar com risk-register.json e cujs-catalog.json
  // Por ora, skip (será implementado incrementalmente)
}

function calculateMetrics(explanations: TestExplanation[]): TestQualityMetrics {
  const total = explanations.length;
  if (total === 0) {
    return {
      assertStrongPct: 0,
      assertMediumPct: 0,
      assertWeakPct: 0,
      diffCoveredPct: 0,
      contractsProtectedPct: 0,
      weakTestsInDiffPct: 0,
      criticalEndpointsWithoutContract: 0,
      suspectedFlakyPct: 0,
      diagnosticAssertsPct: 0,
      totalTests: 0,
      testsWithAsserts: 0,
      testsWithoutAsserts: 0,
    };
  }

  const strong = explanations.filter(e => e.assertStrength === 'forte').length;
  const medium = explanations.filter(e => e.assertStrength === 'médio').length;
  const weak = explanations.filter(e => e.assertStrength === 'fraco').length;

  const withAsserts = explanations.filter(e => e.then.length > 0).length;
  const withoutAsserts = total - withAsserts;

  const testsInDiff = explanations.filter(e => e.coverage.coveredInDiffPct > 0);
  const weakInDiff = testsInDiff.filter(e => e.assertStrength === 'fraco').length;

  const testsWithContracts = explanations.filter(e => e.contracts.pact).length;

  return {
    assertStrongPct: (strong / total) * 100,
    assertMediumPct: (medium / total) * 100,
    assertWeakPct: (weak / total) * 100,
    diffCoveredPct: testsInDiff.length > 0
      ? testsInDiff.reduce((sum, t) => sum + t.coverage.coveredInDiffPct, 0) / testsInDiff.length
      : 0,
    contractsProtectedPct: (testsWithContracts / total) * 100,
    weakTestsInDiffPct: testsInDiff.length > 0 ? (weakInDiff / testsInDiff.length) * 100 : 0,
    criticalEndpointsWithoutContract: 0, // TODO: calcular baseado em risk-register
    suspectedFlakyPct: 0, // TODO: calcular baseado em suite-health
    diagnosticAssertsPct: (withAsserts / total) * 100,
    totalTests: total,
    testsWithAsserts: withAsserts,
    testsWithoutAsserts: withoutAsserts,
  };
}

function assessKR3AStatus(
  metrics: TestQualityMetrics,
  minDiffCoverage: number
): 'OK' | 'ATENÇÃO' | 'ALERTA' {
  // KR3a guardrails:
  // - weakTestsInDiffPct ≤ 5%
  // - diffCoveredPct ≥ 80%
  // - contractsProtectedPct ≥ 90%

  const violations: string[] = [];

  if (metrics.weakTestsInDiffPct > 5) {
    violations.push(`weakTestsInDiffPct: ${metrics.weakTestsInDiffPct.toFixed(1)}% > 5%`);
  }

  if (metrics.diffCoveredPct < minDiffCoverage) {
    violations.push(`diffCoveredPct: ${metrics.diffCoveredPct.toFixed(1)}% < ${minDiffCoverage}%`);
  }

  if (metrics.contractsProtectedPct < 90) {
    violations.push(`contractsProtectedPct: ${metrics.contractsProtectedPct.toFixed(1)}% < 90%`);
  }

  if (violations.length === 0) {
    return 'OK';
  } else if (violations.length === 1 || metrics.weakTestsInDiffPct <= 10) {
    return 'ATENÇÃO';
  } else {
    return 'ALERTA';
  }
}

async function generateOutputs(
  explanations: TestExplanation[],
  metrics: TestQualityMetrics,
  kr3aStatus: 'OK' | 'ATENÇÃO' | 'ALERTA',
  paths: ReturnType<typeof getPaths>,
  format: 'md' | 'json'
): Promise<{
  explanationsJson: string;
  explanationsMd: string;
  qualitySummaryMd: string;
  metricsJson: string;
}> {
  // 1. test-explanations.json
  const explanationsJsonPath = join(paths.analyses, 'test-explanations.json');
  await writeFileSafe(explanationsJsonPath, JSON.stringify(explanations, null, 2));

  // 2. TEST-EXPLANATIONS.md
  const explanationsMdPath = join(paths.reports, 'TEST-EXPLANATIONS.md');
  const explanationsMd = generateExplanationsMarkdown(explanations);
  await writeFileSafe(explanationsMdPath, explanationsMd);

  // 3. TEST-QUALITY-SUMMARY.md
  const qualitySummaryMdPath = join(paths.reports, 'TEST-QUALITY-SUMMARY.md');
  const qualitySummaryMd = generateQualitySummaryMarkdown(metrics, kr3aStatus);
  await writeFileSafe(qualitySummaryMdPath, qualitySummaryMd);

  // 4. test-quality-metrics.json
  const metricsJsonPath = join(paths.analyses, 'test-quality-metrics.json');
  await writeFileSafe(metricsJsonPath, JSON.stringify(metrics, null, 2));

  return {
    explanationsJson: explanationsJsonPath,
    explanationsMd: explanationsMdPath,
    qualitySummaryMd: qualitySummaryMdPath,
    metricsJson: metricsJsonPath,
  };
}

function generateExplanationsMarkdown(explanations: TestExplanation[]): string {
  let md = `# 🔍 Explicação dos Testes\n\n`;
  md += `**Total de Testes**: ${explanations.length}\n\n`;
  md += `---\n\n`;

  for (const exp of explanations) {
    md += `## 📝 ${exp.name}\n\n`;
    md += `**Arquivo**: \`${exp.file}\`\n\n`;
    
    if (exp.functionUnderTest) {
      md += `**Função Testada**: \`${exp.functionUnderTest}\`\n\n`;
    }

    md += `### Para quê?\n\n`;
    if (exp.risk?.cuj) {
      md += `Protege o CUJ: **${exp.risk.cuj}** (risco: ${exp.risk.level})\n\n`;
    } else {
      md += `*NÃO DETERMINADO (sem evidência de CUJ)*\n\n`;
    }

    md += `### O que testa?\n\n`;
    md += `**Given** (arranjo):\n`;
    exp.given.forEach(g => md += `- ${g}\n`);
    md += `\n**When** (ação):\n- ${exp.when}\n\n`;
    md += `**Then** (asserts):\n`;
    exp.then.forEach(t => md += `- ${t.type}: ${t.matcher || t.value}\n`);
    md += `\n`;

    md += `### Cobertura\n\n`;
    md += `- **Arquivos cobertos**: ${exp.coverage.files.join(', ') || '*nenhum*'}\n`;
    md += `- **Linhas cobertas**: ${exp.coverage.linesCovered}/${exp.coverage.linesTotal}\n`;
    md += `- **% no diff**: ${exp.coverage.coveredInDiffPct.toFixed(1)}%\n\n`;

    md += `### Força\n\n`;
    md += `**Assert Strength**: ${exp.assertStrength}\n\n`;

    if (exp.mocks.length > 0) {
      md += `**Mocks**: ${exp.mocks.join(', ')}\n\n`;
    }

    if (exp.contracts.pact) {
      md += `**Contratos**: ${exp.contracts.interactions} interações, ${exp.contracts.failed} falhas\n\n`;
    }

    if (exp.smells.length > 0) {
      md += `### ⚠️ Problemas\n\n`;
      exp.smells.forEach(s => md += `- ${s}\n`);
      md += `\n`;
    }

    if (exp.suggestions.length > 0) {
      md += `### 💡 Sugestões\n\n`;
      exp.suggestions.forEach(s => md += `- ${s}\n`);
      md += `\n`;
    }

    md += `---\n\n`;
  }

  return md;
}

function generateQualitySummaryMarkdown(
  metrics: TestQualityMetrics,
  kr3aStatus: 'OK' | 'ATENÇÃO' | 'ALERTA'
): string {
  let md = `# 📊 Sumário de Qualidade dos Testes\n\n`;
  md += `**Data**: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
  md += `---\n\n`;

  md += `## 🎯 KR3a: Confiabilidade em Produção\n\n`;
  md += `**Status**: ${kr3aStatus === 'OK' ? '✅' : kr3aStatus === 'ATENÇÃO' ? '⚠️' : '🚨'} ${kr3aStatus}\n\n`;
  md += `**Meta KR3a**: Máximo 10% das entregas com falhas (nunca >15%)\n\n`;

  md += `## 📈 Métricas de Força dos Testes\n\n`;
  md += `| Força | % | Contagem |\n`;
  md += `|-------|---|----------|\n`;
  md += `| Forte | ${metrics.assertStrongPct.toFixed(1)}% | ${Math.round(metrics.totalTests * metrics.assertStrongPct / 100)} |\n`;
  md += `| Médio | ${metrics.assertMediumPct.toFixed(1)}% | ${Math.round(metrics.totalTests * metrics.assertMediumPct / 100)} |\n`;
  md += `| Fraco | ${metrics.assertWeakPct.toFixed(1)}% | ${Math.round(metrics.totalTests * metrics.assertWeakPct / 100)} |\n\n`;

  md += `**Total de Testes**: ${metrics.totalTests}\n\n`;

  md += `## 🎯 Leading Indicators DORA\n\n`;
  md += `| Indicador | Valor | Meta | Status |\n`;
  md += `|-----------|-------|------|--------|\n`;
  md += `| Testes Fracos no Diff | ${metrics.weakTestsInDiffPct.toFixed(1)}% | ≤ 5% | ${metrics.weakTestsInDiffPct <= 5 ? '✅' : '❌'} |\n`;
  md += `| Diff Coverage | ${metrics.diffCoveredPct.toFixed(1)}% | ≥ 80% | ${metrics.diffCoveredPct >= 80 ? '✅' : '❌'} |\n`;
  md += `| Contracts Protected | ${metrics.contractsProtectedPct.toFixed(1)}% | ≥ 90% | ${metrics.contractsProtectedPct >= 90 ? '✅' : '❌'} |\n`;
  md += `| Diagnostic Asserts | ${metrics.diagnosticAssertsPct.toFixed(1)}% | ≥ 90% | ${metrics.diagnosticAssertsPct >= 90 ? '✅' : '❌'} |\n\n`;

  md += `**Impacto esperado**:\n`;
  md += `- **CFR (Change Failure Rate)**: ${metrics.weakTestsInDiffPct <= 5 && metrics.contractsProtectedPct >= 90 ? 'REDUZIRÁ ↓' : 'RISCO ELEVADO ⚠️'}\n`;
  md += `- **MTTR (Mean Time to Recovery)**: ${metrics.diagnosticAssertsPct >= 90 ? 'REDUZIRÁ ↓' : 'DIAGNÓSTICO LENTO ⚠️'}\n`;
  md += `- **DF (Deploy Frequency)**: ${metrics.diffCoveredPct >= 80 ? 'MANTÉM ✅' : 'RISCO ⚠️'}\n`;
  md += `- **LTC (Lead Time for Changes)**: ${metrics.diffCoveredPct >= 80 ? 'MANTÉM ✅' : 'RISCO ⚠️'}\n\n`;

  md += `## 📊 Detalhamento\n\n`;
  md += `- **Testes com Asserts**: ${metrics.testsWithAsserts}/${metrics.totalTests} (${(metrics.testsWithAsserts / metrics.totalTests * 100).toFixed(1)}%)\n`;
  md += `- **Testes sem Asserts**: ${metrics.testsWithoutAsserts}\n`;
  md += `- **Endpoints Críticos sem Contrato**: ${metrics.criticalEndpointsWithoutContract}\n`;
  md += `- **Suspeita de Flaky**: ${metrics.suspectedFlakyPct.toFixed(1)}%\n\n`;

  md += `---\n\n`;
  md += `**Gerado por**: MCP Quality CLI - explain-tests\n`;

  return md;
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

export async function run(args: Record<string, any>): Promise<ExplainTestsResult> {
  const options: ExplainTestsOptions = {
    repo: args.repo || process.cwd(),
    product: args.product,
    format: args.format || 'md',
    outDir: args.outDir || args.out_dir,
    baseBranch: args.baseBranch || args.base_branch || 'main',
    minDiffCoverage: args.minDiffCoverage || args.min_diff_coverage || 80,
    minAsserts: args.minAsserts || args.min_asserts || 1,
    failOn: args.failOn || args.fail_on || 'none',
  };

  return explainTests(options);
}

