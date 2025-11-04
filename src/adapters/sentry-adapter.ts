/**
 * SENTRY ADAPTER
 * 
 * Coleta métricas de erros e releases do Sentry.
 * 
 * Métricas coletadas:
 * - Error rate por release
 * - Incidents por categoria
 * - Deploy tracking
 * 
 * @see https://docs.sentry.io/api/
 * @see src/tools/prod-metrics-ingest.ts
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface SentryConfig {
  dsn: string;
  project: string;
  organization?: string;
  authToken?: string;
}

export interface SentryRelease {
  id: string;
  version: string;
  deployed_at: string;
  errors_count: number;
  users_affected: number;
}

export interface SentryIncident {
  id: string;
  category: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  occurred_at: string;
  resolved_at?: string;
  mttr_minutes?: number;
}

export interface SentryMetrics {
  releases: SentryRelease[];
  incidents: SentryIncident[];
  period: {
    start: string;
    end: string;
  };
}

// ============================================================================
// SENTRY ADAPTER
// ============================================================================

export class SentryAdapter {
  private config: SentryConfig;

  constructor(config: SentryConfig) {
    this.config = config;
  }

  /**
   * Coleta métricas de releases e erros do Sentry
   */
  async collectMetrics(period: { start: string; end: string }): Promise<SentryMetrics> {
    console.log('  📊 [Sentry] Coletando métricas...');

    try {
      // TODO: Implementar chamadas reais à API do Sentry quando authToken estiver disponível
      if (!this.config.authToken) {
        console.log('  ⚠️  [Sentry] Auth token não fornecido, retornando dados mock');
        return this.getMockMetrics(period);
      }

      // Coleta real (requer API token)
      const releases = await this.fetchReleases(period);
      const incidents = await this.fetchIncidents(period);

      return {
        releases,
        incidents,
        period,
      };
    } catch (error) {
      console.warn('  ⚠️  [Sentry] Erro ao coletar métricas:', error);
      return this.getMockMetrics(period);
    }
  }

  /**
   * Busca releases do Sentry
   */
  private async fetchReleases(period: { start: string; end: string }): Promise<SentryRelease[]> {
    // TODO: Implementar chamada real
    // const response = await fetch(`https://sentry.io/api/0/organizations/${this.config.organization}/releases/`, {
    //   headers: { 'Authorization': `Bearer ${this.config.authToken}` }
    // });
    
    return [];
  }

  /**
   * Busca incidents (issues críticos) do Sentry
   */
  private async fetchIncidents(period: { start: string; end: string }): Promise<SentryIncident[]> {
    // TODO: Implementar chamada real
    // const response = await fetch(`https://sentry.io/api/0/projects/${this.config.organization}/${this.config.project}/issues/`, {
    //   headers: { 'Authorization': `Bearer ${this.config.authToken}` }
    // });
    
    return [];
  }

  /**
   * Retorna métricas mock para testes
   */
  private getMockMetrics(period: { start: string; end: string }): SentryMetrics {
    return {
      releases: [
        {
          id: 'v1.3.0',
          version: 'v1.3.0',
          deployed_at: new Date(period.start).toISOString(),
          errors_count: 12,
          users_affected: 45,
        },
        {
          id: 'v1.3.1',
          version: 'v1.3.1',
          deployed_at: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
          errors_count: 3,
          users_affected: 8,
        },
      ],
      incidents: [
        {
          id: 'inc-001',
          category: 'checkout',
          severity: 'high',
          occurred_at: new Date(period.start).toISOString(),
          resolved_at: new Date(Date.parse(period.start) + 45 * 60 * 1000).toISOString(),
          mttr_minutes: 45,
        },
      ],
      period,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default SentryAdapter;

