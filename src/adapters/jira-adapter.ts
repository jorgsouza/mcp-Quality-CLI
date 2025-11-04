/**
 * JIRA ADAPTER
 * 
 * Coleta incidents e bugs do Jira.
 * 
 * Métricas coletadas:
 * - Incidents por severidade
 * - MTTR (Mean Time To Recovery)
 * - Bug resolution time
 * 
 * @see https://developer.atlassian.com/cloud/jira/platform/rest/v3/
 * @see src/tools/prod-metrics-ingest.ts
 */

// ============================================================================
// INTERFACES
// ============================================================================

export interface JiraConfig {
  url: string;
  email: string;
  token: string;
  projectKey?: string;
}

export interface JiraIncident {
  id: string;
  key: string;
  summary: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  created_at: string;
  resolved_at?: string;
  mttr_minutes?: number;
}

export interface JiraMetrics {
  incidents: JiraIncident[];
  incidents_by_severity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  avg_mttr_minutes: number;
  unresolved_count: number;
  period: {
    start: string;
    end: string;
  };
}

// ============================================================================
// JIRA ADAPTER
// ============================================================================

export class JiraAdapter {
  private config: JiraConfig;

  constructor(config: JiraConfig) {
    this.config = config;
  }

  /**
   * Coleta incidents do Jira
   */
  async collectMetrics(period: { start: string; end: string }): Promise<JiraMetrics> {
    console.log('  📊 [Jira] Coletando incidents...');

    try {
      if (!this.config.token) {
        console.log('  ⚠️  [Jira] Token não fornecido, retornando dados mock');
        return this.getMockMetrics(period);
      }

      // Coleta real (requer token)
      const incidents = await this.fetchIncidents(period);
      const incidents_by_severity = this.groupBySeverity(incidents);
      const avg_mttr_minutes = this.calculateAvgMTTR(incidents);
      const unresolved_count = incidents.filter(i => !i.resolved_at).length;

      return {
        incidents,
        incidents_by_severity,
        avg_mttr_minutes,
        unresolved_count,
        period,
      };
    } catch (error) {
      console.warn('  ⚠️  [Jira] Erro ao coletar incidents:', error);
      return this.getMockMetrics(period);
    }
  }

  /**
   * Busca incidents do Jira
   */
  private async fetchIncidents(period: { start: string; end: string }): Promise<JiraIncident[]> {
    // TODO: Implementar chamada real
    // const auth = Buffer.from(`${this.config.email}:${this.config.token}`).toString('base64');
    // const jql = `project=${this.config.projectKey} AND type=Incident AND created>="${period.start}"`;
    // const response = await fetch(`${this.config.url}/rest/api/3/search?jql=${encodeURIComponent(jql)}`, {
    //   headers: { 'Authorization': `Basic ${auth}` }
    // });
    
    return [];
  }

  /**
   * Agrupa incidents por severidade
   */
  private groupBySeverity(incidents: JiraIncident[]): JiraMetrics['incidents_by_severity'] {
    return incidents.reduce(
      (acc, incident) => {
        acc[incident.severity]++;
        return acc;
      },
      { critical: 0, high: 0, medium: 0, low: 0 }
    );
  }

  /**
   * Calcula MTTR médio
   */
  private calculateAvgMTTR(incidents: JiraIncident[]): number {
    const resolvedIncidents = incidents.filter(i => i.mttr_minutes !== undefined);
    if (resolvedIncidents.length === 0) return 0;

    const sum = resolvedIncidents.reduce((acc, i) => acc + (i.mttr_minutes || 0), 0);
    return sum / resolvedIncidents.length;
  }

  /**
   * Retorna métricas mock para testes
   */
  private getMockMetrics(period: { start: string; end: string }): JiraMetrics {
    return {
      incidents: [
        {
          id: '10001',
          key: 'PROJ-123',
          summary: 'Payment gateway timeout',
          severity: 'high',
          created_at: new Date(period.start).toISOString(),
          resolved_at: new Date(Date.parse(period.start) + 38 * 60 * 1000).toISOString(),
          mttr_minutes: 38,
        },
        {
          id: '10002',
          key: 'PROJ-124',
          summary: 'Database connection pool exhausted',
          severity: 'critical',
          created_at: new Date(period.start).toISOString(),
          resolved_at: new Date(Date.parse(period.start) + 15 * 60 * 1000).toISOString(),
          mttr_minutes: 15,
        },
      ],
      incidents_by_severity: {
        critical: 1,
        high: 1,
        medium: 0,
        low: 0,
      },
      avg_mttr_minutes: 26.5,
      unresolved_count: 0,
      period,
    };
  }
}

// ============================================================================
// EXPORTS
// ============================================================================

export default JiraAdapter;

