/**
 * portfolio-plan.ts
 * Redesenha a pirâmide de testes baseado em riscos e cobertura
 * 
 * FASE 2 - Portfolio Planning: Analisa distribuição atual de testes e recomenda
 * rebalanceamento seguindo princípios de Fowler (pirâmide 70/20/10) e riscos identificados.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPaths, ensurePaths } from '../utils/paths.js';
import type { Risk, RiskRegister } from '../schemas/cuj-schemas.js';

export interface PortfolioPlanParams {
  repo: string;
  product: string;
  risk_file?: string; // Path para risk-register.json
  coverage_file?: string; // Path para coverage-analysis.json (opcional)
  targets?: {
    unit_percent?: number; // default 70
    service_percent?: number; // default 20
    e2e_percent?: number; // default 10
    max_ci_time_min?: number; // default 12
  };
}

export interface PortfolioPlanResult {
  ok: boolean;
  output: string;
  current_distribution: {
    unit_percent: number;
    integration_percent: number;
    e2e_percent: number;
  };
  target_distribution: {
    unit_percent: number;
    integration_percent: number;
    e2e_percent: number;
  };
  recommendations_count: number;
  error?: string;
}

interface TestDistribution {
  unit: number;
  integration: number;
  e2e: number;
  total: number;
}

interface ModuleRecommendation {
  module: string;
  current_tests: {
    unit: number;
    integration: number;
    e2e: number;
  };
  recommended_tests: {
    unit: number;
    integration: number;
    e2e: number;
    cdc?: number;
    property?: number;
    approval?: number;
  };
  reasoning: string[];
  priority: 'critical' | 'high' | 'medium' | 'low';
}

/**
 * Gera plano de portfolio de testes
 */
export async function portfolioPlan(params: PortfolioPlanParams): Promise<PortfolioPlanResult> {
  const { repo, product, targets = {} } = params;

  // Defaults baseados em Fowler's Test Pyramid
  const targetDistribution = {
    unit_percent: targets.unit_percent ?? 70,
    service_percent: targets.service_percent ?? 20,
    e2e_percent: targets.e2e_percent ?? 10,
    max_ci_time_min: targets.max_ci_time_min ?? 12,
  };

  try {
    const paths = getPaths(repo, product);
    await ensurePaths(paths);

    console.log('📊 [1/5] Carregando dados...');
    const riskFilePath = params.risk_file || join(paths.analyses, 'risk-register.json');
    const coverageFilePath = params.coverage_file || join(paths.analyses, 'coverage-analysis.json');

    const riskRegister = await loadRiskRegister(riskFilePath);
    const coverageData = await loadCoverageOptional(coverageFilePath);

    console.log(`   ${riskRegister.risks.length} riscos identificados`);

    console.log('🔍 [2/5] Analisando distribuição atual...');
    const currentDist = await analyzeCurrentDistribution(repo, paths, coverageData);
    console.log(`   Unit: ${currentDist.unit_percent.toFixed(1)}%, Integration: ${currentDist.integration_percent.toFixed(1)}%, E2E: ${currentDist.e2e_percent.toFixed(1)}%`);

    console.log('🎯 [3/5] Calculando gaps...');
    const gaps = calculateGaps(currentDist, targetDistribution);

    console.log('💡 [4/5] Gerando recomendações...');
    const recommendations = generateRecommendations(riskRegister, currentDist, targetDistribution, coverageData);
    console.log(`   ${recommendations.length} recomendações geradas`);

    console.log('📝 [5/5] Gerando relatório...');
    const reportContent = buildPortfolioReport(
      currentDist,
      targetDistribution,
      gaps,
      recommendations,
      riskRegister
    );

    const outputPath = join(paths.reports, 'PORTFOLIO-PLAN.md');
    await writeFile(outputPath, reportContent);

    console.log(`✅ Portfolio plan gerado: ${outputPath}`);

    return {
      ok: true,
      output: outputPath,
      current_distribution: {
        unit_percent: currentDist.unit_percent,
        integration_percent: currentDist.integration_percent,
        e2e_percent: currentDist.e2e_percent,
      },
      target_distribution: {
        unit_percent: targetDistribution.unit_percent,
        integration_percent: targetDistribution.service_percent,
        e2e_percent: targetDistribution.e2e_percent,
      },
      recommendations_count: recommendations.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro ao gerar portfolio plan:', message);
    return {
      ok: false,
      output: '',
      current_distribution: { unit_percent: 0, integration_percent: 0, e2e_percent: 0 },
      target_distribution: { unit_percent: 70, integration_percent: 20, e2e_percent: 10 },
      recommendations_count: 0,
      error: message,
    };
  }
}

/**
 * Carrega risk register
 */
async function loadRiskRegister(filePath: string): Promise<RiskRegister> {
  const content = await readFile(filePath, 'utf-8');
  return JSON.parse(content);
}

/**
 * Carrega coverage analysis (opcional)
 */
async function loadCoverageOptional(filePath: string): Promise<any | null> {
  try {
    const content = await readFile(filePath, 'utf-8');
    return JSON.parse(content);
  } catch {
    return null;
  }
}

/**
 * Analisa distribuição atual de testes
 */
async function analyzeCurrentDistribution(
  repo: string,
  paths: any,
  coverageData: any | null
): Promise<TestDistribution & { unit_percent: number; integration_percent: number; e2e_percent: number }> {
  // Contar arquivos de teste em cada diretório
  const unitTests = await countTestFiles(paths.unit);
  const integrationTests = await countTestFiles(paths.integration);
  const e2eTests = await countTestFiles(paths.e2e);

  const total = unitTests + integrationTests + e2eTests;

  if (total === 0) {
    return {
      unit: 0,
      integration: 0,
      e2e: 0,
      total: 0,
      unit_percent: 0,
      integration_percent: 0,
      e2e_percent: 0,
    };
  }

  return {
    unit: unitTests,
    integration: integrationTests,
    e2e: e2eTests,
    total,
    unit_percent: (unitTests / total) * 100,
    integration_percent: (integrationTests / total) * 100,
    e2e_percent: (e2eTests / total) * 100,
  };
}

/**
 * Conta arquivos de teste em um diretório
 */
async function countTestFiles(dirPath: string): Promise<number> {
  try {
    const { readdir } = await import('node:fs/promises');
    const { stat } = await import('node:fs/promises');
    
    const entries = await readdir(dirPath, { withFileTypes: true });
    let count = 0;

    for (const entry of entries) {
      const fullPath = join(dirPath, entry.name);
      
      if (entry.isDirectory()) {
        count += await countTestFiles(fullPath);
      } else if (entry.isFile() && isTestFile(entry.name)) {
        count++;
      }
    }

    return count;
  } catch {
    return 0; // Diretório não existe
  }
}

/**
 * Verifica se é arquivo de teste
 */
function isTestFile(filename: string): boolean {
  return /\.(test|spec)\.(ts|js|tsx|jsx|py|java|go)$/.test(filename);
}

/**
 * Calcula gaps entre atual e target
 */
function calculateGaps(
  current: TestDistribution & { unit_percent: number; integration_percent: number; e2e_percent: number },
  target: { unit_percent: number; service_percent: number; e2e_percent: number }
) {
  return {
    unit_gap: target.unit_percent - current.unit_percent,
    integration_gap: target.service_percent - current.integration_percent,
    e2e_gap: target.e2e_percent - current.e2e_percent,
  };
}

/**
 * Gera recomendações por módulo baseado em riscos
 */
function generateRecommendations(
  riskRegister: RiskRegister,
  currentDist: any,
  targetDist: any,
  coverageData: any | null
): ModuleRecommendation[] {
  const recommendations: ModuleRecommendation[] = [];

  // Agrupar riscos por módulo
  const risksByModule = new Map<string, Risk[]>();
  
  for (const risk of riskRegister.risks) {
    for (const module of risk.affected_modules) {
      if (!risksByModule.has(module)) {
        risksByModule.set(module, []);
      }
      risksByModule.get(module)!.push(risk);
    }
  }

  // Gerar recomendações por módulo
  for (const [module, risks] of risksByModule.entries()) {
    const highestRisk = risks.reduce((max, r) => r.risk_score > max.risk_score ? r : max);
    
    const recommendation: ModuleRecommendation = {
      module,
      current_tests: {
        unit: 0, // TODO: Extract from coverage data
        integration: 0,
        e2e: 0,
      },
      recommended_tests: {
        unit: 0,
        integration: 0,
        e2e: 0,
      },
      reasoning: [],
      priority: highestRisk.impact,
    };

    // Recomendar baseado em risk score e tipo
    if (highestRisk.risk_score >= 75) {
      // Riscos críticos: cobertura completa
      recommendation.recommended_tests.unit = 80;
      recommendation.recommended_tests.integration = 15;
      recommendation.recommended_tests.e2e = 2;
      recommendation.reasoning.push(`Risco crítico (score: ${highestRisk.risk_score}) requer cobertura abrangente`);
    } else if (highestRisk.risk_score >= 50) {
      // Riscos altos: foco em unit + integration
      recommendation.recommended_tests.unit = 50;
      recommendation.recommended_tests.integration = 10;
      recommendation.recommended_tests.e2e = 1;
      recommendation.reasoning.push(`Risco alto (score: ${highestRisk.risk_score}) requer testes robustos`);
    } else {
      // Riscos médios/baixos: unit básico
      recommendation.recommended_tests.unit = 20;
      recommendation.recommended_tests.integration = 5;
      recommendation.recommended_tests.e2e = 0;
      recommendation.reasoning.push(`Risco moderado (score: ${highestRisk.risk_score}) com testes essenciais`);
    }

    // Adicionar recomendações de tipos especiais
    if (highestRisk.recommended_tests.includes('cdc')) {
      recommendation.recommended_tests.cdc = 5;
      recommendation.reasoning.push('CDC (Pact) recomendado para validar contratos de API');
    }

    if (highestRisk.recommended_tests.includes('property')) {
      recommendation.recommended_tests.property = 3;
      recommendation.reasoning.push('Property-based tests para validar invariantes');
    }

    if (highestRisk.recommended_tests.includes('chaos')) {
      recommendation.reasoning.push('Considerar chaos engineering para resiliência');
    }

    recommendations.push(recommendation);
  }

  // Ordenar por prioridade (crítico > alto > médio > baixo)
  return recommendations.sort((a, b) => {
    const priorityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
    return priorityOrder[a.priority] - priorityOrder[b.priority];
  });
}

/**
 * Constrói relatório markdown do portfolio
 */
function buildPortfolioReport(
  current: TestDistribution & { unit_percent: number; integration_percent: number; e2e_percent: number },
  target: any,
  gaps: any,
  recommendations: ModuleRecommendation[],
  riskRegister: RiskRegister
): string {
  const timestamp = new Date().toISOString();

  let report = `# Test Portfolio Plan\n\n`;
  report += `**Generated**: ${timestamp}\n`;
  report += `**Repository**: ${riskRegister.repo}\n`;
  report += `**Product**: ${riskRegister.product}\n\n`;

  report += `---\n\n`;

  // Current State
  report += `## 📊 Current State\n\n`;
  report += `| Test Type | Count | Percentage | Target | Gap |\n`;
  report += `|-----------|-------|------------|--------|-----|\n`;
  report += `| **Unit** | ${current.unit} | ${current.unit_percent.toFixed(1)}% | ${target.unit_percent}% | ${gaps.unit_gap > 0 ? '+' : ''}${gaps.unit_gap.toFixed(1)}% |\n`;
  report += `| **Integration** | ${current.integration} | ${current.integration_percent.toFixed(1)}% | ${target.service_percent}% | ${gaps.integration_gap > 0 ? '+' : ''}${gaps.integration_gap.toFixed(1)}% |\n`;
  report += `| **E2E** | ${current.e2e} | ${current.e2e_percent.toFixed(1)}% | ${target.e2e_percent}% | ${gaps.e2e_gap > 0 ? '+' : ''}${gaps.e2e_gap.toFixed(1)}% |\n`;
  report += `| **TOTAL** | ${current.total} | 100% | 100% | - |\n\n`;

  // Target Distribution (Fowler's Pyramid)
  report += `## 🎯 Target Distribution (Fowler's Test Pyramid)\n\n`;
  report += `\`\`\`\n`;
  report += `        /\\     E2E (${target.e2e_percent}%)\n`;
  report += `       /  \\    Slow, brittle, expensive\n`;
  report += `      /----\\   \n`;
  report += `     /      \\  Integration (${target.service_percent}%)\n`;
  report += `    /        \\ Moderate speed, integration points\n`;
  report += `   /----------\\\n`;
  report += `  /            \\ Unit (${target.unit_percent}%)\n`;
  report += ` /              \\ Fast, reliable, cheap\n`;
  report += `/________________\\\n`;
  report += `\`\`\`\n\n`;

  // Summary
  report += `## 📋 Summary\n\n`;
  
  if (gaps.unit_gap > 5) {
    report += `- ⚠️  **Add ${Math.abs(gaps.unit_gap).toFixed(0)}% more unit tests** (currently ${current.unit_percent.toFixed(1)}%, target ${target.unit_percent}%)\n`;
  } else if (gaps.unit_gap < -5) {
    report += `- ✅ Unit tests coverage is healthy (${current.unit_percent.toFixed(1)}%)\n`;
  }

  if (gaps.e2e_gap < -5) {
    report += `- 🔻 **Remove ${Math.abs(gaps.e2e_gap).toFixed(0)}% E2E tests** (currently ${current.e2e_percent.toFixed(1)}%, target ${target.e2e_percent}%) - likely duplicated by service tests\n`;
  }

  if (gaps.integration_gap > 5) {
    report += `- ⚠️  **Add ${Math.abs(gaps.integration_gap).toFixed(0)}% more integration tests** (currently ${current.integration_percent.toFixed(1)}%, target ${target.service_percent}%)\n`;
  }

  report += `\n`;

  // Module-by-Module Recommendations
  report += `## 🎯 Module Recommendations\n\n`;
  report += `Based on ${riskRegister.risks.length} identified risks, prioritized by impact:\n\n`;

  for (const rec of recommendations.slice(0, 10)) { // Top 10
    report += `### ${getPriorityEmoji(rec.priority)} ${rec.module}\n\n`;
    report += `**Priority**: ${rec.priority}\n\n`;
    
    report += `**Current Tests**:\n`;
    report += `- Unit: ${rec.current_tests.unit}\n`;
    report += `- Integration: ${rec.current_tests.integration}\n`;
    report += `- E2E: ${rec.current_tests.e2e}\n\n`;
    
    report += `**Recommended Tests**:\n`;
    report += `- Unit: ${rec.recommended_tests.unit}\n`;
    report += `- Integration: ${rec.recommended_tests.integration}\n`;
    report += `- E2E: ${rec.recommended_tests.e2e}\n`;
    
    if (rec.recommended_tests.cdc) {
      report += `- **CDC (Pact)**: ${rec.recommended_tests.cdc} contracts\n`;
    }
    if (rec.recommended_tests.property) {
      report += `- **Property-based**: ${rec.recommended_tests.property} invariants\n`;
    }
    if (rec.recommended_tests.approval) {
      report += `- **Approval**: ${rec.recommended_tests.approval} golden masters\n`;
    }
    
    report += `\n**Reasoning**:\n`;
    for (const reason of rec.reasoning) {
      report += `- ${reason}\n`;
    }
    report += `\n`;
  }

  // Top 5 Critical Risks
  report += `## 🚨 Top 5 Critical Risks\n\n`;
  const top5Risks = riskRegister.risks
    .filter(r => r.risk_score >= 75)
    .slice(0, 5);

  if (top5Risks.length > 0) {
    report += `| Risk | CUJ | Score | Impact | Mitigation |\n`;
    report += `|------|-----|-------|--------|------------|\n`;
    for (const risk of top5Risks) {
      const mitigations = risk.mitigation_strategies.slice(0, 2).join(', ');
      report += `| ${risk.title} | ${risk.cuj_id} | ${risk.risk_score} | ${risk.impact} | ${mitigations} |\n`;
    }
  } else {
    report += `No critical risks identified (score ≥ 75).\n`;
  }

  report += `\n`;

  // Action Items
  report += `## ✅ Action Items\n\n`;
  report += `1. **Rebalance pyramid**: Focus on unit tests (target ${target.unit_percent}%)\n`;
  report += `2. **Address critical risks**: Implement recommended tests for top ${Math.min(5, recommendations.length)} modules\n`;
  report += `3. **Add CDC tests**: Validate API contracts for critical integrations\n`;
  report += `4. **Reduce E2E overhead**: Remove duplicated E2E tests (target ${target.e2e_percent}%)\n`;
  report += `5. **Monitor CI time**: Keep total suite runtime ≤ ${target.max_ci_time_min} min\n\n`;

  report += `---\n\n`;
  report += `**Generated by**: MCP Quality CLI - Portfolio Planning\n`;
  report += `**Reference**: [Fowler's Test Pyramid](https://martinfowler.com/articles/practical-test-pyramid.html)\n`;

  return report;
}

/**
 * Retorna emoji baseado na prioridade
 */
function getPriorityEmoji(priority: string): string {
  switch (priority) {
    case 'critical': return '🔴';
    case 'high': return '🟡';
    case 'medium': return '🟢';
    case 'low': return '⚪';
    default: return '🔵';
  }
}
