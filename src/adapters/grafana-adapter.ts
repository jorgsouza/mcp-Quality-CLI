/**
 * GRAFANA ADAPTER
 * 
 * Coleta métricas de dashboards do Grafana.
 * 
 * Métricas coletadas:
 * - Uptime/Availability
 * - Response time
 * - Error rate
 * 
 * @see https://grafana.com/docs/grafana/latest/http_api/
 * @see src/tools/prod-metrics-ingest.ts
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface GrafanaConfig {
  url: string;
  token: string;
  dashboardId?: string;
}

export interface GrafanaMetric {
  timestamp: string;
  availability: number; // 0-1 (ex: 0.9995 = 99.95%)
  avg_response_time_ms: number;
  error_rate: number; // 0-1
}

export interface GrafanaMetrics {
  metrics: GrafanaMetric[];
  avg_availability: number;
  avg_response_time_ms: number;
  period: {
    start: string;
    end: string;
  };
}

// ============================================================================
// GRAFANA ADAPTER
// ============================================================================

export class GrafanaAdapter {
  private config: GrafanaConfig;

  constructor(config: GrafanaConfig) {
    this.config = config;
  }

  /**
   * Coleta métricas de dashboards do Grafana
   */
  async collectMetrics(period: { start: string; end: string }): Promise<GrafanaMetrics> {
    console.log('  📊 [Grafana] Coletando métricas...');

    try {
      if (!this.config.token) {
        console.log('  ⚠️  [Grafana] Token não fornecido, retornando dados mock');
        return this.getMockMetrics(period);
      }

      // Coleta real (requer token)
      const metrics = await this.fetchDashboardMetrics(period);
      const avg_availability = this.calculateAvgAvailability(metrics);
      const avg_response_time_ms = this.calculateAvgResponseTime(metrics);

      return {
        metrics,
        avg_availability,
        avg_response_time_ms,
        period,
      };
    } catch (error) {
      console.warn('  ⚠️  [Grafana] Erro ao coletar métricas:', error);
      return this.getMockMetrics(period);
    }
  }

  /**
   * Busca métricas de dashboard do Grafana
   */
  private async fetchDashboardMetrics(period: { start: string; end: string }): Promise<GrafanaMetric[]> {
    // TODO: Implementar chamada real
    // const response = await fetch(`${this.config.url}/api/datasources/proxy/...`, {
    //   headers: { 'Authorization': `Bearer ${this.config.token}` }
    // });
    
    return [];
  }

  /**
   * Calcula availability média
   */
  private calculateAvgAvailability(metrics: GrafanaMetric[]): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + m.availability, 0);
    return sum / metrics.length;
  }

  /**
   * Calcula response time médio
   */
  private calculateAvgResponseTime(metrics: GrafanaMetric[]): number {
    if (metrics.length === 0) return 0;
    const sum = metrics.reduce((acc, m) => acc + m.avg_response_time_ms, 0);
    return sum / metrics.length;
  }

  /**
   * Retorna métricas mock para testes
   */
  private getMockMetrics(period: { start: string; end: string }): GrafanaMetrics {
    return {
      metrics: [
        {
          timestamp: new Date(period.start).toISOString(),
          availability: 0.9985,
          avg_response_time_ms: 245,
          error_rate: 0.0015,
        },
      ],
      avg_availability: 0.9985,
      avg_response_time_ms: 245,
      period,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default GrafanaAdapter;

