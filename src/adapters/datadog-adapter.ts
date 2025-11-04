/**
 * DATADOG ADAPTER
 * 
 * Coleta métricas de APM e traces do Datadog.
 * 
 * Métricas coletadas:
 * - Request rate
 * - Error rate
 * - Latency (p50, p95, p99)
 * - Deploy frequency
 * 
 * @see https://docs.datadoghq.com/api/
 * @see src/tools/prod-metrics-ingest.ts
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface DatadogConfig {
  apiKey: string;
  appKey: string;
  site?: string; // datadoghq.com, datadoghq.eu, etc
}

export interface DatadogDeployment {
  timestamp: string;
  version: string;
  service: string;
}

export interface DatadogMetric {
  timestamp: string;
  request_rate: number;
  error_rate: number;
  latency_p50: number;
  latency_p95: number;
  latency_p99: number;
}

export interface DatadogMetrics {
  deployments: DatadogDeployment[];
  metrics: DatadogMetric[];
  deployment_frequency: number; // deploys/month
  avg_error_rate: number;
  avg_latency_p99: number;
  period: {
    start: string;
    end: string;
  };
}

// ============================================================================
// DATADOG ADAPTER
// ============================================================================

export class DatadogAdapter {
  private config: DatadogConfig;

  constructor(config: DatadogConfig) {
    this.config = config;
  }

  /**
   * Coleta métricas de APM do Datadog
   */
  async collectMetrics(period: { start: string; end: string }): Promise<DatadogMetrics> {
    console.log('  📊 [Datadog] Coletando métricas...');

    try {
      if (!this.config.apiKey || !this.config.appKey) {
        console.log('  ⚠️  [Datadog] Credenciais não fornecidas, retornando dados mock');
        return this.getMockMetrics(period);
      }

      // Coleta real (requer API keys)
      const deployments = await this.fetchDeployments(period);
      const metrics = await this.fetchAPMMetrics(period);
      
      const deployment_frequency = this.calculateDeploymentFrequency(deployments, period);
      const avg_error_rate = this.calculateAvgErrorRate(metrics);
      const avg_latency_p99 = this.calculateAvgLatency(metrics);

      return {
        deployments,
        metrics,
        deployment_frequency,
        avg_error_rate,
        avg_latency_p99,
        period,
      };
    } catch (error) {
      console.warn('  ⚠️  [Datadog] Erro ao coletar métricas:', error);
      return this.getMockMetrics(period);
    }
  }

  /**
   * Busca deployments do Datadog
   */
  private async fetchDeployments(period: { start: string; end: string }): Promise<DatadogDeployment[]> {
    // TODO: Implementar chamada real
    // const site = this.config.site || 'datadoghq.com';
    // const response = await fetch(`https://api.${site}/api/v1/events?...`, {
    //   headers: {
    //     'DD-API-KEY': this.config.apiKey,
    //     'DD-APPLICATION-KEY': this.config.appKey
    //   }
    // });
    
    return [];
  }

  /**
   * Busca métricas de APM do Datadog
   */
  private async fetchAPMMetrics(period: { start: string; end: string }): Promise<DatadogMetric[]> {
    // TODO: Implementar chamada real
    // const site = this.config.site || 'datadoghq.com';
    // const response = await fetch(`https://api.${site}/api/v1/query?...`, {
    //   headers: {
    //     'DD-API-KEY': this.config.apiKey,
    //     'DD-APPLICATION-KEY': this.config.appKey
    //   }
    // });
    
    return [];
  }

  /**
   * Calcula deployment frequency (deploys/mês)
   */
  private calculateDeploymentFrequency(
    deployments: DatadogDeployment[],
    period: { start: string; end: string }
  ): number {
    if (deployments.length === 0) return 0;
    
    const periodDays = (Date.parse(period.end) - Date.parse(period.start)) / (1000 * 60 * 60 * 24);
    const periodMonths = periodDays / 30;
    
    return deployments.length / periodMonths;
  }

  /**
   * Calcula error rate médio
   */
  private calculateAvgErrorRate(metrics: DatadogMetric[]): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + m.error_rate, 0);
    return sum / metrics.length;
  }

  /**
   * Calcula latência p99 média
   */
  private calculateAvgLatency(metrics: DatadogMetric[]): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + m.latency_p99, 0);
    return sum / metrics.length;
  }

  /**
   * Retorna métricas mock para testes
   */
  private getMockMetrics(period: { start: string; end: string }): DatadogMetrics {
    return {
      deployments: [
        {
          timestamp: new Date(period.start).toISOString(),
          version: 'v1.3.0',
          service: 'api',
        },
      ],
      metrics: [
        {
          timestamp: new Date(period.start).toISOString(),
          request_rate: 1000,
          error_rate: 0.012,
          latency_p50: 120,
          latency_p95: 450,
          latency_p99: 850,
        },
      ],
      deployment_frequency: 210,
      avg_error_rate: 0.012,
      avg_latency_p99: 850,
      period,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default DatadogAdapter;

