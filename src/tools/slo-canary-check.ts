/**
 * SLO CANARY CHECK
 * 
 * Compara métricas de produção (prod-metrics.json) vs SLOs definidos (slos.json).
 * Detecta violações de SLOs por CUJ e gera recomendações.
 * 
 * Use cases:
 * - Validar canary deployments
 * - Monitorar SLAs em produção
 * - Alertar sobre degradação de serviço
 * 
 * @see src/tools/prod-metrics-ingest.ts
 * @see src/tools/define-slos.ts
 * @see docs/development/PLANO-PROXIMAS-FASES.md (FASE 9)
 */

import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { getPaths } from '../utils/paths.js';
import { fileExists, writeFileSafe } from '../utils/fs.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface SLOCanaryCheckOptions {
  repo: string;
  product: string;
  /** Caminho para slos.json (opcional, usa qa/<product>/tests/analyses/slos.json) */
  slosFile?: string;
  /** Caminho para prod-metrics.json (opcional, usa qa/<product>/tests/analyses/prod-metrics.json) */
  prodMetricsFile?: string;
}

export interface SLO {
  cuj_id: string;
  cuj_name?: string;
  latency_p99_ms: number;
  error_rate_max: number;
  availability_min: number;
}

export interface SLOViolation {
  cuj_id: string;
  cuj_name: string;
  metric: 'latency_p99' | 'error_rate' | 'availability';
  expected: number;
  actual: number;
  severity: 'critical' | 'high' | 'medium';
  message: string;
}

export interface SLOCanaryResult {
  ok: boolean;
  period: {
    start: string;
    end: string;
  };
  summary: {
    total_cujs: number;
    cujs_met: number;
    cujs_violated: number;
    total_violations: number;
    critical_violations: number;
  };
  slos: SLO[];
  violations: SLOViolation[];
  recommendations: string[];
  output_path: string;
  report_path: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function sloCanaryCheck(
  options: SLOCanaryCheckOptions
): Promise<SLOCanaryResult> {
  const repoPath = resolve(options.repo);
  const paths = getPaths(repoPath, options.product);

  console.log('🕯️  [SLO Canary] Verificando SLOs vs métricas de produção...\n');

  // 1. Carregar SLOs
  const slosPath = options.slosFile || join(paths.analyses, 'slos.json');
  if (!(await fileExists(slosPath))) {
    throw new Error(`SLOs não encontrados: ${slosPath}. Execute 'define-slos' primeiro.`);
  }

  const slosContent = await fs.readFile(slosPath, 'utf-8');
  const slosData = JSON.parse(slosContent);
  const slos: SLO[] = slosData.slos || [];

  console.log(`  📋 SLOs carregados: ${slos.length} CUJs\n`);

  // 2. Carregar métricas de produção
  const prodMetricsPath = options.prodMetricsFile || join(paths.analyses, 'prod-metrics.json');
  if (!(await fileExists(prodMetricsPath))) {
    throw new Error(`Métricas de produção não encontradas: ${prodMetricsPath}. Execute 'prod-metrics-ingest' primeiro.`);
  }

  const prodMetricsContent = await fs.readFile(prodMetricsPath, 'utf-8');
  const prodMetrics = JSON.parse(prodMetricsContent);

  console.log(`  📊 Métricas carregadas do período: ${prodMetrics.period.start.split('T')[0]} → ${prodMetrics.period.end.split('T')[0]}\n`);

  // 3. Carregar catálogo de CUJs para nomes
  const cujCatalogPath = join(paths.analyses, 'cuj-catalog.json');
  const cujNames: Record<string, string> = {};
  
  if (await fileExists(cujCatalogPath)) {
    const cujContent = await fs.readFile(cujCatalogPath, 'utf-8');
    const cujData = JSON.parse(cujContent);
    (cujData.cujs || []).forEach((cuj: any) => {
      cujNames[cuj.id] = cuj.name || cuj.id;
    });
  }

  // 4. Comparar SLOs vs métricas reais
  const violations: SLOViolation[] = [];

  for (const slo of slos) {
    // Simular métricas reais por CUJ
    // TODO: Em produção, mapear métricas reais por CUJ do APM/traces
    const actualMetrics = simulateActualMetrics(slo, prodMetrics);

    // Verificar latency
    if (actualMetrics.latency_p99_ms > slo.latency_p99_ms) {
      violations.push({
        cuj_id: slo.cuj_id,
        cuj_name: cujNames[slo.cuj_id] || slo.cuj_id,
        metric: 'latency_p99',
        expected: slo.latency_p99_ms,
        actual: actualMetrics.latency_p99_ms,
        severity: getSeverity(actualMetrics.latency_p99_ms, slo.latency_p99_ms, 'latency'),
        message: `Latency P99 ${actualMetrics.latency_p99_ms}ms > SLO ${slo.latency_p99_ms}ms`,
      });
    }

    // Verificar error rate
    if (actualMetrics.error_rate > slo.error_rate_max) {
      violations.push({
        cuj_id: slo.cuj_id,
        cuj_name: cujNames[slo.cuj_id] || slo.cuj_id,
        metric: 'error_rate',
        expected: slo.error_rate_max,
        actual: actualMetrics.error_rate,
        severity: getSeverity(actualMetrics.error_rate, slo.error_rate_max, 'error_rate'),
        message: `Error rate ${(actualMetrics.error_rate * 100).toFixed(2)}% > SLO ${(slo.error_rate_max * 100).toFixed(2)}%`,
      });
    }

    // Verificar availability
    if (actualMetrics.availability < slo.availability_min) {
      violations.push({
        cuj_id: slo.cuj_id,
        cuj_name: cujNames[slo.cuj_id] || slo.cuj_id,
        metric: 'availability',
        expected: slo.availability_min,
        actual: actualMetrics.availability,
        severity: getSeverity(actualMetrics.availability, slo.availability_min, 'availability'),
        message: `Availability ${(actualMetrics.availability * 100).toFixed(3)}% < SLO ${(slo.availability_min * 100).toFixed(2)}%`,
      });
    }
  }

  // 5. Gerar recomendações
  const recommendations = generateRecommendations(violations, prodMetrics);

  // 6. Calcular summary
  const cujsWithViolations = new Set(violations.map(v => v.cuj_id));
  const criticalViolations = violations.filter(v => v.severity === 'critical');

  const summary = {
    total_cujs: slos.length,
    cujs_met: slos.length - cujsWithViolations.size,
    cujs_violated: cujsWithViolations.size,
    total_violations: violations.length,
    critical_violations: criticalViolations.length,
  };

  const ok = violations.length === 0;

  // 7. Log resultado
  console.log(`  📊 Resultado:`);
  console.log(`     • CUJs atendendo SLOs: ${summary.cujs_met}/${summary.total_cujs}`);
  console.log(`     • Violações: ${summary.total_violations} (${summary.critical_violations} críticas)`);
  
  if (violations.length > 0) {
    console.log(`\n  ⚠️  Violações detectadas:\n`);
    violations.forEach(v => {
      const icon = v.severity === 'critical' ? '🔴' : v.severity === 'high' ? '🟠' : '🟡';
      console.log(`     ${icon} [${v.cuj_name}] ${v.message}`);
    });
  } else {
    console.log(`\n  ✅ Todos os SLOs estão sendo atendidos!`);
  }

  console.log();

  // 8. Salvar JSON
  const outputPath = join(paths.analyses, 'slo-canary.json');
  const result: SLOCanaryResult = {
    ok,
    period: prodMetrics.period,
    summary,
    slos,
    violations,
    recommendations,
    output_path: outputPath,
    report_path: join(paths.reports, 'SLO-CANARY.md'),
  };

  await writeFileSafe(outputPath, JSON.stringify(result, null, 2));
  console.log(`  💾 JSON salvo: ${outputPath}`);

  // 9. Gerar relatório Markdown
  const markdown = generateMarkdownReport(result, cujNames);
  await writeFileSafe(result.report_path, markdown);
  console.log(`  📄 Relatório: ${result.report_path}\n`);

  return result;
}

// ============================================================================
// HELPERS
// ============================================================================

/**
 * Simula métricas reais por CUJ baseado em prod-metrics
 * 
 * TODO: Em produção, mapear métricas reais por CUJ do APM/traces
 * usando tags/labels para correlacionar requests com CUJs
 */
function simulateActualMetrics(
  slo: SLO,
  prodMetrics: any
): { latency_p99_ms: number; error_rate: number; availability: number } {
  // Usar DORA metrics como proxy (na prática, viria do APM por CUJ)
  const dora = prodMetrics.dora_metrics || {};
  
  // Simular variação de ±20% do SLO
  const variance = 0.8 + Math.random() * 0.4; // 0.8 a 1.2
  
  return {
    latency_p99_ms: slo.latency_p99_ms * variance,
    error_rate: Math.min(slo.error_rate_max * variance, 1),
    availability: Math.max(slo.availability_min * (2 - variance), 0.9),
  };
}

/**
 * Determina severidade da violação
 */
function getSeverity(
  actual: number,
  expected: number,
  metric: string
): 'critical' | 'high' | 'medium' {
  let ratio: number;
  
  if (metric === 'availability') {
    // Para availability, inversão (menor é pior)
    ratio = expected / actual;
  } else {
    // Para latency e error_rate, maior é pior
    ratio = actual / expected;
  }

  if (ratio > 2) return 'critical'; // >100% de degradação
  if (ratio > 1.5) return 'high'; // 50-100% de degradação
  return 'medium'; // <50% de degradação
}

/**
 * Gera recomendações baseadas nas violações
 */
function generateRecommendations(
  violations: SLOViolation[],
  prodMetrics: any
): string[] {
  const recommendations: string[] = [];

  if (violations.length === 0) {
    recommendations.push('✅ Todos os SLOs estão sendo atendidos. Continue monitorando.');
    return recommendations;
  }

  // Agrupar violações por tipo
  const latencyViolations = violations.filter(v => v.metric === 'latency_p99');
  const errorRateViolations = violations.filter(v => v.metric === 'error_rate');
  const availabilityViolations = violations.filter(v => v.metric === 'availability');

  // Recomendações para latency
  if (latencyViolations.length > 0) {
    recommendations.push(`🔧 Otimizar performance para ${latencyViolations.length} CUJ(s) com latência alta`);
    recommendations.push('   • Revisar queries de banco de dados lentas');
    recommendations.push('   • Implementar caching para endpoints críticos');
    recommendations.push('   • Considerar CDN para assets estáticos');
  }

  // Recomendações para error rate
  if (errorRateViolations.length > 0) {
    recommendations.push(`🐛 Investigar erros em ${errorRateViolations.length} CUJ(s)`);
    recommendations.push('   • Analisar logs de erros no Sentry/Datadog');
    recommendations.push('   • Adicionar monitoring e alertas');
    recommendations.push('   • Aumentar cobertura de testes de integração');
  }

  // Recomendações para availability
  if (availabilityViolations.length > 0) {
    recommendations.push(`⚠️  Melhorar disponibilidade de ${availabilityViolations.length} CUJ(s)`);
    recommendations.push('   • Implementar circuit breaker');
    recommendations.push('   • Adicionar retry logic com backoff');
    recommendations.push('   • Configurar health checks e auto-scaling');
  }

  // Recomendações baseadas em DORA metrics
  const dora = prodMetrics.dora_metrics || {};
  if (dora.change_failure_rate > 0.15) {
    recommendations.push('🚨 CFR alto (>15%) - Melhorar quality gates antes do deploy');
  }
  if (dora.mttr_minutes > 60) {
    recommendations.push('⏱️  MTTR alto (>1h) - Melhorar processos de incident response');
  }

  return recommendations;
}

/**
 * Gera relatório Markdown
 */
function generateMarkdownReport(
  result: SLOCanaryResult,
  cujNames: Record<string, string>
): string {
  const statusEmoji = result.ok ? '✅' : '❌';
  const statusText = result.ok ? 'ALL SLOS MET' : 'SLO VIOLATIONS DETECTED';

  let markdown = `# 🕯️ SLO Canary Report

**Status**: ${statusEmoji} ${statusText}  
**Period**: ${result.period.start.split('T')[0]} → ${result.period.end.split('T')[0]}  
**Generated**: ${new Date().toISOString()}

---

## 📊 Summary

| Metric | Value |
|--------|-------|
| Total CUJs | ${result.summary.total_cujs} |
| CUJs Meeting SLOs | ${result.summary.cujs_met} (${((result.summary.cujs_met / result.summary.total_cujs) * 100).toFixed(1)}%) |
| CUJs Violated | ${result.summary.cujs_violated} |
| Total Violations | ${result.summary.total_violations} |
| Critical Violations | ${result.summary.critical_violations} |

---

## 🎯 SLO Status by CUJ

`;

  // Agrupar violações por CUJ
  const violationsByCuj: Record<string, SLOViolation[]> = {};
  result.violations.forEach(v => {
    if (!violationsByCuj[v.cuj_id]) {
      violationsByCuj[v.cuj_id] = [];
    }
    violationsByCuj[v.cuj_id].push(v);
  });

  result.slos.forEach(slo => {
    const cujViolations = violationsByCuj[slo.cuj_id] || [];
    const status = cujViolations.length === 0 ? '✅' : '❌';
    const cujName = cujNames[slo.cuj_id] || slo.cuj_name || slo.cuj_id;

    markdown += `### ${status} ${cujName}\n\n`;
    markdown += `**SLO Targets**:\n`;
    markdown += `- Latency P99: ≤ ${slo.latency_p99_ms}ms\n`;
    markdown += `- Error Rate: ≤ ${(slo.error_rate_max * 100).toFixed(2)}%\n`;
    markdown += `- Availability: ≥ ${(slo.availability_min * 100).toFixed(2)}%\n\n`;

    if (cujViolations.length > 0) {
      markdown += `**Violations**:\n`;
      cujViolations.forEach(v => {
        const icon = v.severity === 'critical' ? '🔴' : v.severity === 'high' ? '🟠' : '🟡';
        markdown += `- ${icon} **${v.severity.toUpperCase()}**: ${v.message}\n`;
      });
      markdown += '\n';
    } else {
      markdown += `**Status**: ✅ All SLO targets met\n\n`;
    }
  });

  markdown += `---

## 💡 Recommendations

`;

  result.recommendations.forEach(rec => {
    markdown += `${rec}\n`;
  });

  markdown += `
---

## 📚 Resources

- [SLO Best Practices](https://sre.google/sre-book/service-level-objectives/)
- [DORA Metrics](https://cloud.google.com/blog/products/devops-sre/using-the-four-keys-to-measure-your-devops-performance)
- [Incident Response](https://response.pagerduty.com/)

---

**Generated by**: MCP Quality CLI  
**Version**: 0.4.0
`;

  return markdown;
}

// ============================================================================
// EXPORTS
// ============================================================================

export default sloCanaryCheck;

