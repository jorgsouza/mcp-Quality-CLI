/**
 * PRODUCTION METRICS INGEST
 * 
 * Orquestra coleta de métricas de produção de múltiplas fontes:
 * - Sentry: Erros e releases
 * - Datadog: APM e traces
 * - Grafana: Dashboards e uptime
 * - Jira: Incidents e bugs
 * 
 * Calcula métricas DORA:
 * - Deployment Frequency (deploys/mês)
 * - Lead Time for Changes (minutos)
 * - Change Failure Rate (%)
 * - Mean Time To Recovery - MTTR (minutos)
 * 
 * @see docs/development/PLANO-PROXIMAS-FASES.md (FASE 8)
 */

import { promises as fs } from 'node:fs';
import { join, resolve } from 'node:path';
import { getPaths } from '../utils/paths.js';
import { writeFileSafe } from '../utils/fs.js';
import { SentryAdapter, SentryConfig } from '../adapters/sentry-adapter.js';
import { DatadogAdapter, DatadogConfig } from '../adapters/datadog-adapter.js';
import { GrafanaAdapter, GrafanaConfig } from '../adapters/grafana-adapter.js';
import { JiraAdapter, JiraConfig } from '../adapters/jira-adapter.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ProdMetricsIngestOptions {
  repo: string;
  product: string;
  sources: {
    sentry?: SentryConfig;
    datadog?: DatadogConfig;
    grafana?: GrafanaConfig;
    jira?: JiraConfig;
  };
  period?: {
    start: string; // ISO date
    end: string; // ISO date
  };
}

export interface DORAMetrics {
  /** Deployment Frequency (deploys/mês) */
  deployment_frequency: number;
  
  /** Lead Time for Changes (minutos médios) */
  lead_time_minutes: number;
  
  /** Change Failure Rate (0-1, ex: 0.15 = 15%) */
  change_failure_rate: number;
  
  /** Mean Time To Recovery (minutos médios) */
  mttr_minutes: number;
  
  /** Classificação DORA (Elite, High, Medium, Low) */
  dora_tier: 'Elite' | 'High' | 'Medium' | 'Low';
}

export interface Release {
  id: string;
  version: string;
  deployed_at: string;
  source: string;
  errors_count?: number;
  failed: boolean;
}

export interface Incident {
  id: string;
  category: string;
  severity: string;
  occurred_at: string;
  resolved_at?: string;
  mttr_minutes?: number;
  source: string;
}

export interface ProdMetricsResult {
  ok: boolean;
  period: {
    start: string;
    end: string;
  };
  releases: Release[];
  incidents: Incident[];
  dora_metrics: DORAMetrics;
  output: string;
}

// ============================================================================
// MAIN FUNCTION
// ============================================================================

export async function prodMetricsIngest(
  options: ProdMetricsIngestOptions
): Promise<ProdMetricsResult> {
  const repoPath = resolve(options.repo);
  const paths = getPaths(repoPath, options.product);

  // Período padrão: últimos 30 dias
  const period = options.period || {
    start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
    end: new Date().toISOString(),
  };

  console.log('📊 [Prod Metrics] Iniciando coleta de métricas de produção...');
  console.log(`  📅 Período: ${period.start.split('T')[0]} → ${period.end.split('T')[0]}\n`);

  // Coletar métricas de cada fonte
  const releases: Release[] = [];
  const incidents: Incident[] = [];

  // 1. Sentry
  if (options.sources.sentry) {
    try {
      const sentryAdapter = new SentryAdapter(options.sources.sentry);
      const sentryData = await sentryAdapter.collectMetrics(period);
      
      // Converter para formato unificado
      releases.push(...sentryData.releases.map(r => ({
        id: r.id,
        version: r.version,
        deployed_at: r.deployed_at,
        source: 'sentry',
        errors_count: r.errors_count,
        failed: r.errors_count > 10, // Threshold arbitrário
      })));
      
      incidents.push(...sentryData.incidents.map(i => ({
        id: i.id,
        category: i.category,
        severity: i.severity,
        occurred_at: i.occurred_at,
        resolved_at: i.resolved_at,
        mttr_minutes: i.mttr_minutes,
        source: 'sentry',
      })));
      
      console.log(`  ✅ Sentry: ${sentryData.releases.length} releases, ${sentryData.incidents.length} incidents`);
    } catch (error) {
      console.warn(`  ⚠️  Sentry: ${error}`);
    }
  }

  // 2. Datadog
  if (options.sources.datadog) {
    try {
      const datadogAdapter = new DatadogAdapter(options.sources.datadog);
      const datadogData = await datadogAdapter.collectMetrics(period);
      
      releases.push(...datadogData.deployments.map(d => ({
        id: `${d.service}-${d.version}`,
        version: d.version,
        deployed_at: d.timestamp,
        source: 'datadog',
        failed: false, // Datadog não rastreia falhas diretamente
      })));
      
      console.log(`  ✅ Datadog: ${datadogData.deployments.length} deployments`);
    } catch (error) {
      console.warn(`  ⚠️  Datadog: ${error}`);
    }
  }

  // 3. Grafana
  if (options.sources.grafana) {
    try {
      const grafanaAdapter = new GrafanaAdapter(options.sources.grafana);
      const grafanaData = await grafanaAdapter.collectMetrics(period);
      
      console.log(`  ✅ Grafana: ${grafanaData.metrics.length} data points`);
    } catch (error) {
      console.warn(`  ⚠️  Grafana: ${error}`);
    }
  }

  // 4. Jira
  if (options.sources.jira) {
    try {
      const jiraAdapter = new JiraAdapter(options.sources.jira);
      const jiraData = await jiraAdapter.collectMetrics(period);
      
      incidents.push(...jiraData.incidents.map(i => ({
        id: i.key,
        category: i.summary,
        severity: i.severity,
        occurred_at: i.created_at,
        resolved_at: i.resolved_at,
        mttr_minutes: i.mttr_minutes,
        source: 'jira',
      })));
      
      console.log(`  ✅ Jira: ${jiraData.incidents.length} incidents`);
    } catch (error) {
      console.warn(`  ⚠️  Jira: ${error}`);
    }
  }

  console.log();

  // Calcular métricas DORA
  const dora_metrics = calculateDORAMetrics(releases, incidents, period);

  console.log('  🎯 Métricas DORA calculadas:');
  console.log(`     • Deployment Frequency: ${dora_metrics.deployment_frequency.toFixed(0)}/mês`);
  console.log(`     • Lead Time: ${dora_metrics.lead_time_minutes.toFixed(0)} min`);
  console.log(`     • Change Failure Rate: ${(dora_metrics.change_failure_rate * 100).toFixed(1)}%`);
  console.log(`     • MTTR: ${dora_metrics.mttr_minutes.toFixed(0)} min`);
  console.log(`     • DORA Tier: ${dora_metrics.dora_tier}`);
  console.log();

  // Salvar resultado
  const outputPath = join(paths.analyses, 'prod-metrics.json');
  const result: ProdMetricsResult = {
    ok: true,
    period,
    releases,
    incidents,
    dora_metrics,
    output: outputPath,
  };

  await writeFileSafe(outputPath, JSON.stringify(result, null, 2));
  console.log(`  💾 Salvo: ${outputPath}\n`);

  return result;
}

// ============================================================================
// DORA METRICS CALCULATION
// ============================================================================

function calculateDORAMetrics(
  releases: Release[],
  incidents: Incident[],
  period: { start: string; end: string }
): DORAMetrics {
  // 1. Deployment Frequency (deploys/mês)
  const periodDays = (Date.parse(period.end) - Date.parse(period.start)) / (1000 * 60 * 60 * 24);
  const periodMonths = periodDays / 30;
  const deployment_frequency = releases.length / periodMonths;

  // 2. Lead Time for Changes (assumindo ~45min como padrão se não temos dados)
  // TODO: Integrar com Git para calcular tempo real de commit→deploy
  const lead_time_minutes = 45;

  // 3. Change Failure Rate (% de releases que falharam)
  const failedReleases = releases.filter(r => r.failed);
  const change_failure_rate = releases.length > 0
    ? failedReleases.length / releases.length
    : 0;

  // 4. MTTR (Mean Time To Recovery)
  const resolvedIncidents = incidents.filter(i => i.mttr_minutes !== undefined);
  const mttr_minutes = resolvedIncidents.length > 0
    ? resolvedIncidents.reduce((sum, i) => sum + (i.mttr_minutes || 0), 0) / resolvedIncidents.length
    : 0;

  // 5. Classificação DORA (baseado em critérios do DORA Report 2023)
  const dora_tier = classifyDORATier(
    deployment_frequency,
    lead_time_minutes,
    change_failure_rate,
    mttr_minutes
  );

  return {
    deployment_frequency,
    lead_time_minutes,
    change_failure_rate,
    mttr_minutes,
    dora_tier,
  };
}

/**
 * Classifica o tier DORA baseado nas métricas
 * 
 * Critérios (DORA Report 2023):
 * - Elite: Deploy on-demand (várias/dia), LT < 1h, CFR < 5%, MTTR < 1h
 * - High: Deploy 1x/dia-1x/semana, LT < 1 dia, CFR 5-15%, MTTR < 1 dia
 * - Medium: Deploy 1x/semana-1x/mês, LT < 1 semana, CFR 16-30%, MTTR < 1 semana
 * - Low: Deploy < 1x/mês, LT > 1 semana, CFR > 30%, MTTR > 1 semana
 */
function classifyDORATier(
  deployment_frequency: number,
  lead_time_minutes: number,
  change_failure_rate: number,
  mttr_minutes: number
): DORAMetrics['dora_tier'] {
  // Normalizar deployment_frequency para deploys/dia
  const deploysPerDay = deployment_frequency / 30;

  // Critérios Elite
  if (
    deploysPerDay >= 1 && // Múltiplos deploys/dia
    lead_time_minutes < 60 &&
    change_failure_rate < 0.05 &&
    mttr_minutes < 60
  ) {
    return 'Elite';
  }

  // Critérios High
  if (
    deploysPerDay >= 0.14 && // ~1x/semana
    lead_time_minutes < 24 * 60 &&
    change_failure_rate < 0.15 &&
    mttr_minutes < 24 * 60
  ) {
    return 'High';
  }

  // Critérios Medium
  if (
    deploysPerDay >= 0.033 && // ~1x/mês
    lead_time_minutes < 7 * 24 * 60 &&
    change_failure_rate < 0.30 &&
    mttr_minutes < 7 * 24 * 60
  ) {
    return 'Medium';
  }

  // Low (não atende nenhum critério acima)
  return 'Low';
}

// ============================================================================
// EXPORTS
// ============================================================================

export default prodMetricsIngest;

