import { findNextRoutes } from '../detectors/next.js';
import { findExpressRoutes, findOpenAPI } from '../detectors/express.js';
import { findEvents } from '../detectors/events.js';
import { writeFileSafe, join } from '../utils/fs.js';

export interface AnalyzeParams {
  repo: string;
  product: string;
  domains?: string[];
  critical_flows?: string[];
  targets?: {
    ci_p95_min?: number;
    flaky_pct_max?: number;
    diff_coverage_min?: number;
  };
  base_url?: string;
}

export interface AnalyzeResult {
  summary: string;
  findings: {
    routes: string[];
    endpoints: string[];
    events: string[];
    risk_map: Array<{
      area: string;
      risk: 'low' | 'med' | 'high';
      rationale: string;
    }>;
  };
  recommendations: string[];
  plan_path: string;
}

export async function analyze(input: AnalyzeParams): Promise<AnalyzeResult> {
  console.log(`🔍 Analisando repositório: ${input.repo}`);
  
  const routes = await findNextRoutes(input.repo);
  const endpoints = await findExpressRoutes(input.repo);
  const openapi = await findOpenAPI(input.repo);
  const events = await findEvents(input.repo);

  // Heurística de risco
  const risk_map: Array<{area: string; risk: 'low' | 'med' | 'high'; rationale: string}> = [];

  // Endpoints sem contrato OpenAPI são risco médio
  for (const ep of endpoints) {
    const hasContract = openapi.length > 0;
    risk_map.push({
      area: `endpoint:${ep.method} ${ep.path}`,
      risk: hasContract ? 'low' : 'med',
      rationale: hasContract 
        ? 'endpoint com contrato OpenAPI detectado' 
        : 'sem verificação de contrato detectada'
    });
  }

  // Rotas web devem estar no catálogo E2E
  for (const route of routes) {
    const isCritical = input.critical_flows?.some(flow => 
      route.toLowerCase().includes(flow.toLowerCase())
    );
    risk_map.push({
      area: `route:${route}`,
      risk: isCritical ? 'high' : 'low',
      rationale: isCritical 
        ? 'fluxo crítico - deve ter cobertura E2E prioritária'
        : 'rota web detectada; incluir no catálogo E2E se core'
    });
  }

  // Eventos assíncronos são risco médio por natureza
  for (const event of events) {
    risk_map.push({
      area: `event:${event}`,
      risk: 'med',
      rationale: 'evento assíncrono - considerar testes de integração/contrato'
    });
  }

  const summary = `Encontradas ${routes.length} rotas web, ${endpoints.length} endpoints e ${events.length} eventos.`;
  
  const findings = {
    routes,
    endpoints: endpoints.map(e => `${e.method} ${e.path}`),
    events,
    risk_map
  };

  const recommendations = [
    'Priorizar E2E para fluxos críticos (login, abrir_reclamacao, busca_empresa).',
    'Adicionar CDC (Contract-Driven Development) para endpoints de alto acoplamento inter-squad.',
    `Cobertura por diff-coverage ≥ ${input.targets?.diff_coverage_min || 60}%; CI p95 ≤ ${input.targets?.ci_p95_min || 15}min; flaky ≤ ${input.targets?.flaky_pct_max || 3}%.`,
    openapi.length === 0 ? 'Considerar adicionar especificação OpenAPI para documentação de contratos.' : 'Especificação OpenAPI encontrada - manter atualizada.',
    `Foco nos domínios: ${input.domains?.join(', ') || 'todos'}`,
    `Produto: ${input.product} - Base URL: ${input.base_url || 'não especificada'}`
  ];

  // Salva snapshot em JSON
  await writeFileSafe(
    join(input.repo, 'tests', 'analyses', 'analyze.json'),
    JSON.stringify({ summary, findings, recommendations }, null, 2)
  );

  console.log(`✅ Análise completa. ${routes.length} rotas, ${endpoints.length} endpoints, ${events.length} eventos.`);

  return {
    summary,
    findings,
    recommendations,
    plan_path: 'tests/analyses/TEST-PLAN.md'
  };
}

