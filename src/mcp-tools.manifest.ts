/**
 * 🔧 MCP Server Tools Manifest
 * 
 * Define os tools expostos via Model Context Protocol.
 * Alinhado com commands.manifest.ts da CLI (5 comandos consolidados).
 */

export interface MCPToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, any>;
    required?: string[];
  };
}

/**
 * 🎯 Tools Consolidados do MCP Server
 * 
 * Anteriormente: 18 tools fragmentados
 * Agora: 5 tools inteligentes (alinhados com CLI)
 */
export const MCP_TOOLS: readonly MCPToolDefinition[] = [
  {
    name: 'analyze',
    description: '🔍 Analisa qualidade de testes (orquestrador inteligente). Auto-detecta contexto e executa análise completa: funções, testes, cenários, coverage, mutation, mocks.',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { 
          type: 'string', 
          description: 'Caminho do repositório' 
        },
        product: { 
          type: 'string', 
          description: 'Nome do produto' 
        },
        mode: { 
          type: 'string', 
          enum: ['full', 'analyze', 'plan', 'scaffold', 'run'],
          description: 'Modo: full (tudo), analyze (só análise), plan (análise+plano), scaffold (até templates), run (testes+coverage)',
          default: 'full'
        },
        skipRun: { 
          type: 'boolean', 
          description: 'Pular execução de testes (útil para análise rápida)',
          default: false
        },
        skipScaffold: { 
          type: 'boolean', 
          description: 'Pular geração de scaffolds (útil se já existem testes)',
          default: false
        },
      },
      required: ['repo', 'product'],
    },
  },
  
  {
    name: 'validate',
    description: '✅ Valida gates de qualidade (coverage, mutation, scenarios). Usado em CI/CD para bloquear PRs que não atendem critérios mínimos.',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { 
          type: 'string', 
          description: 'Caminho do repositório' 
        },
        product: { 
          type: 'string', 
          description: 'Nome do produto (opcional)',
        },
        minBranch: { 
          type: 'number', 
          description: 'Cobertura mínima de branches (%)',
          default: 80,
          minimum: 0,
          maximum: 100
        },
        minMutation: { 
          type: 'number', 
          description: 'Mutation score mínimo (%)',
          default: 70,
          minimum: 0,
          maximum: 100
        },
        minDiffCoverage: { 
          type: 'number', 
          description: 'Cobertura mínima do diff (%)',
          default: 60,
          minimum: 0,
          maximum: 100
        },
        baseBranch: { 
          type: 'string', 
          description: 'Branch base para diff',
          default: 'main'
        },
        failOnLow: { 
          type: 'boolean', 
          description: 'Falhar se abaixo do mínimo',
          default: true
        },
      },
      required: ['repo'],
    },
  },
  
  {
    name: 'report',
    description: '📊 Gera relatórios consolidados (MD/JSON/HTML). Unifica resultados de análise, coverage, mutation em formato legível para aprovação de QA. [FASE 3] Relatórios sempre salvos em qa/<product>/tests/reports/',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { 
          type: 'string', 
          description: 'Caminho do repositório (OBRIGATÓRIO para determinar qa/<product>/)'
        },
        product: { 
          type: 'string', 
          description: 'Nome do produto (OBRIGATÓRIO para determinar qa/<product>/)'
        },
        format: { 
          type: 'string', 
          enum: ['markdown', 'json', 'html'],
          description: 'Formato: markdown|json|html',
          default: 'markdown'
        },
        diffCoverageMin: { 
          type: 'number', 
          description: 'Threshold de diff coverage',
        },
        flakyPctMax: { 
          type: 'number', 
          description: 'Percentual máximo de testes flaky',
        },
      },
      required: ['repo', 'product'],
    },
  },
  
  {
    name: 'scaffold',
    description: '🏗️ Gera estrutura de testes (unit/integration/e2e). Templates inteligentes com happy path, error handling, edge cases e side effects. Detecta funções críticas automaticamente.',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { 
          type: 'string', 
          description: 'Caminho do repositório' 
        },
        product: { 
          type: 'string', 
          description: 'Nome do produto' 
        },
        type: { 
          type: 'string', 
          enum: ['unit', 'integration', 'e2e'],
          description: 'Tipo: unit|integration|e2e',
          default: 'unit'
        },
        function: { 
          type: 'string', 
          description: 'Nome da função específica (opcional)',
        },
        scenario: { 
          type: 'string', 
          enum: ['happy', 'error', 'edge', 'side'],
          description: 'Cenário: happy|error|edge|side (opcional)',
        },
        autoDetect: { 
          type: 'boolean', 
          description: 'Auto-detectar arquivos',
          default: true
        },
        framework: { 
          type: 'string', 
          enum: ['jest', 'vitest', 'mocha'],
          description: 'Framework: jest|vitest|mocha',
          default: 'vitest'
        },
      },
      required: ['repo', 'product'],
    },
  },
  
  {
    name: 'self-check',
    description: '🔍 Verifica ambiente e dependências (Node, vitest, stryker). Valida pré-requisitos antes de executar análises. Flag --fix para correções automáticas.',
    inputSchema: {
      type: 'object',
      properties: {
        repo: { 
          type: 'string', 
          description: 'Caminho do repositório',
          default: '.'
        },
        fix: { 
          type: 'boolean', 
          description: 'Tentar corrigir problemas automaticamente',
          default: false
        },
      },
      required: [],
    },
  },

  // 🆕 Quality Gates Tools
  {
    name: 'run_mutation_tests',
    description: '🧬 Executa mutation testing em módulos críticos. Mede a qualidade dos testes através de mutação de código.',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Caminho do repositório'
        },
        product: {
          type: 'string',
          description: 'Nome do produto'
        },
        targets: {
          type: 'array',
          items: { type: 'string' },
          description: 'Lista de módulos/arquivos para testar (opcional, usa risk-register se vazio)'
        },
        minScore: {
          type: 'number',
          description: 'Score mínimo de mutação (%)',
          default: 50,
          minimum: 0,
          maximum: 100
        },
      },
      required: ['repo', 'product'],
    },
  },

  {
    name: 'release_quality_gate',
    description: '🚦 Aplica quality gates e retorna exit code para CI. Valida coverage, mutation, contracts, suite health, production metrics.',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Caminho do repositório'
        },
        product: {
          type: 'string',
          description: 'Nome do produto'
        },
      },
      required: ['repo', 'product'],
    },
  },

  {
    name: 'prod_metrics_ingest',
    description: '📊 Coleta métricas de produção (Sentry, Datadog, Grafana, Jira) e calcula DORA metrics (CFR, MTTR, Deploy Freq, Lead Time).',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Caminho do repositório'
        },
        product: {
          type: 'string',
          description: 'Nome do produto'
        },
        sources: {
          type: 'object',
          description: 'Configuração de fontes externas (Sentry, Datadog, Grafana, Jira)',
          properties: {
            sentry: { type: 'object' },
            datadog: { type: 'object' },
            grafana: { type: 'object' },
            jira: { type: 'object' },
          }
        },
        period: {
          type: 'object',
          description: 'Período de coleta (start/end em ISO date)',
          properties: {
            start: { type: 'string' },
            end: { type: 'string' },
          }
        },
      },
      required: ['repo', 'product'],
    },
  },

  {
    name: 'slo_canary_check',
    description: '🕯️ Compara métricas de produção vs SLOs definidos. Detecta violações de SLOs por CUJ e gera recomendações.',
    inputSchema: {
      type: 'object',
      properties: {
        repo: {
          type: 'string',
          description: 'Caminho do repositório'
        },
        product: {
          type: 'string',
          description: 'Nome do produto'
        },
        slosFile: {
          type: 'string',
          description: 'Caminho para slos.json (opcional, usa qa/<product>/tests/analyses/slos.json)'
        },
        prodMetricsFile: {
          type: 'string',
          description: 'Caminho para prod-metrics.json (opcional, usa qa/<product>/tests/analyses/prod-metrics.json)'
        },
      },
      required: ['repo', 'product'],
    },
  },
] as const;

/**
 * 🔍 Busca tool por nome
 */
export function findTool(name: string): MCPToolDefinition | undefined {
  return MCP_TOOLS.find(tool => tool.name === name);
}
