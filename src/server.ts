#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { z } from 'zod';

import { analyze, type AnalyzeParams } from './tools/analyze.js';
import { generatePlan, type PlanParams } from './tools/plan.js';
import { scaffoldPlaywright, type ScaffoldParams } from './tools/scaffold.js';
import { runPlaywright, type RunParams } from './tools/run.js';
import { buildReport, type BuildReportParams } from './tools/report.js';
import { analyzeTestCoverage, type CoverageParams } from './tools/coverage.js';
import { scaffoldUnitTests, type ScaffoldUnitParams } from './tools/scaffold-unit.js';
import { scaffoldIntegrationTests, type ScaffoldIntegrationParams } from './tools/scaffold-integration.js';
import { generatePyramidReport, type PyramidReportParams } from './tools/pyramid-report.js';
import { catalogScenarios, type CatalogParams } from './tools/catalog.js';
import { recommendTestStrategy } from './tools/recommend-strategy.js';
import { runCoverageAnalysis, type RunCoverageParams } from './tools/run-coverage.js';
import { initProduct, type InitProductParams } from './tools/init-product.js';
import { runDiffCoverage, type DiffCoverageParams } from './tools/run-diff-coverage.js';
import { autoQualityRun, type AutoOptions } from './tools/auto.js';
import { nlCommand, type NLCommandParams } from './tools/nl-command.js';
import { evaluateTestQuality, type TestQualityParams } from './tools/evaluate-test-quality.js';
import { fileExists } from './utils/fs.js';

// Schemas Zod para validação
const AnalyzeSchema = z.object({
  repo: z.string()
    .min(1, 'Repository path is required')
    .describe('Caminho do repositório'),
  product: z.string()
    .min(1, 'Product name is required')
    .max(50, 'Product name too long')
    .describe('Nome do produto'),
  domains: z.array(z.string()).optional().describe('Domínios do produto'),
  critical_flows: z.array(z.string()).optional().describe('Fluxos críticos'),
  targets: z.object({
    ci_p95_min: z.number().min(0).optional().describe('CI p95 máximo em minutos'),
    flaky_pct_max: z.number().min(0).max(100).optional().describe('Percentual máximo de flaky'),
    diff_coverage_min: z.number().min(0).max(100).optional().describe('Cobertura mínima de diff')
  }).optional(),
  base_url: z.string().url().optional().describe('URL base do ambiente')
});

const PlanSchema = z.object({
  repo: z.string()
    .min(1, 'Repository path is required')
    .describe('Caminho do repositório'),
  product: z.string()
    .min(1, 'Product name is required')
    .describe('Nome do produto'),
  base_url: z.string().url('Base URL must be valid').describe('URL base do ambiente'),
  include_examples: z.boolean().optional().describe('Incluir exemplos no plano'),
  out_dir: z.string().default('plan').describe('Diretório de saída')
});

const ScaffoldSchema = z.object({
  repo: z.string().describe('Caminho do repositório'),
  plan_file: z.string().describe('Caminho do arquivo de plano'),
  out_dir: z.string().default('packages/product-e2e').describe('Diretório de saída')
});

const RunSchema = z.object({
  repo: z.string().describe('Caminho do repositório'),
  e2e_dir: z.string().describe('Diretório dos testes E2E'),
  report_dir: z.string().default('reports').describe('Diretório de relatórios'),
  headless: z.boolean().default(true).describe('Executar em modo headless')
});

const ReportSchema = z.object({
  in_dir: z.string().describe('Diretório de entrada com resultados'),
  out_file: z.string().default('SUMMARY.md').describe('Arquivo de saída'),
  thresholds: z.object({
    flaky_pct_max: z.number().optional(),
    diff_coverage_min: z.number().optional()
  }).optional()
});

const CoverageSchema = z.object({
  repo: z.string().describe('Caminho do repositório'),
  product: z.string().describe('Nome do produto'),
  target_coverage: z.object({
    unit: z.number().optional(),
    integration: z.number().optional(),
    e2e: z.number().optional()
  }).optional()
});

const ScaffoldUnitSchema = z.object({
  repo: z.string().describe('Caminho do repositório'),
  files: z.array(z.string()).optional().describe('Arquivos específicos para gerar testes'),
  framework: z.enum(['jest', 'vitest', 'mocha']).optional(),
  auto_detect: z.boolean().optional()
});

const ScaffoldIntegrationSchema = z.object({
  repo: z.string().describe('Caminho do repositório'),
  product: z.string().describe('Nome do produto'),
  base_url: z.string().optional(),
  endpoints: z.array(z.string()).optional()
});

const PyramidReportSchema = z.object({
  repo: z.string().describe('Caminho do repositório'),
  product: z.string().describe('Nome do produto'),
  output_format: z.enum(['markdown', 'html', 'json']).optional()
});

const CatalogSchema = z.object({
  repo: z.string().describe('Caminho do repositório'),
  product: z.string().describe('Nome do produto'),
  squads: z.array(z.string()).optional().describe('Lista de squads do produto')
});

const RecommendStrategySchema = z.object({
  repo: z.string().describe('Caminho do repositório'),
  product: z.string().describe('Nome do produto'),
  auto_generate: z.boolean().optional().describe('Gerar automaticamente sem confirmar')
});

const RunCoverageSchema = z.object({
  repo: z.string().describe('Caminho do repositório'),
  thresholds: z.object({
    lines: z.number().optional().describe('Threshold mínimo de linhas (padrão: 70)'),
    functions: z.number().optional().describe('Threshold mínimo de funções (padrão: 70)'),
    branches: z.number().optional().describe('Threshold mínimo de branches (padrão: 70)'),
    statements: z.number().optional().describe('Threshold mínimo de statements (padrão: 70)')
  }).optional()
});

const InitProductSchema = z.object({
  repo: z.string()
    .min(1, 'Repository path is required')
    .describe('Caminho do repositório'),
  product: z.string()
    .min(1, 'Product name is required')
    .max(50, 'Product name too long')
    .regex(/^[a-zA-Z0-9-_]+$/, 'Product name must contain only alphanumeric characters, hyphens and underscores')
    .describe('Nome do produto'),
  base_url: z.string()
    .url('Base URL must be valid')
    .describe('URL base do ambiente'),
  domains: z.array(z.string()).optional().describe('Domínios do produto'),
  critical_flows: z.array(z.string()).optional().describe('Fluxos críticos do produto')
});

const DiffCoverageSchema = z.object({
  repo: z.string()
    .min(1, 'Repository path is required')
    .describe('Caminho do repositório'),
  product: z.string().optional().describe('Nome do produto'),
  base_branch: z.string().optional().default('main').describe('Branch base para comparação'),
  target_min: z.number().min(0).max(100).optional().describe('Cobertura mínima exigida (%)'),
  fail_on_low: z.boolean().optional().default(true).describe('Falhar se cobertura < target')
});

const AutoSchema = z.object({
  mode: z.enum(['full', 'analyze', 'plan', 'scaffold', 'run']).optional().describe('Modo de execução'),
  repo: z.string().optional().describe('Caminho do repositório (auto-detecta se omitido)'),
  product: z.string().optional().describe('Nome do produto (infere do package.json se omitido)'),
  skipScaffold: z.boolean().optional().describe('Pular geração de scaffolds'),
  skipRun: z.boolean().optional().describe('Pular execução de testes')
});

const NLCommandSchema = z.object({
  query: z.string()
    .min(1, 'Query cannot be empty')
    .describe('Comando em linguagem natural (PT/EN)'),
  defaults: z.object({
    mode: z.enum(['full', 'analyze', 'plan', 'scaffold', 'run']).optional(),
    repo: z.string().optional(),
    product: z.string().optional(),
    skipScaffold: z.boolean().optional(),
    skipRun: z.boolean().optional()
  }).optional().describe('Defaults globais opcionais')
});

const TestQualitySchema = z.object({
  repo: z.string()
    .min(1, 'Repository path is required')
    .describe('Caminho do repositório'),
  product: z.string()
    .min(1, 'Product name is required')
    .describe('Nome do produto'),
  includeDetails: z.boolean().optional().describe('Incluir detalhes de todas as funções')
});

class QualityMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'quality-mcp',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.setupHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    process.on('SIGINT', async () => {
      await this.server.close();
      process.exit(0);
    });
  }

  private setupHandlers(): void {
    // Lista de ferramentas disponíveis
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'nl_command',
          description: '🧠 Atalho semântico em linguagem natural (PT/EN). Entende comandos como "analise meu repositório", "criar plano de testes", "rodar testes" e executa o fluxo apropriado automaticamente.',
          inputSchema: {
            type: 'object',
            properties: {
              query: { 
                type: 'string', 
                description: 'Comando em linguagem natural. Exemplos: "analise meu repositório", "criar plano", "rodar testes", "scaffold templates", "mapear endpoints"' 
              },
              defaults: {
                type: 'object',
                properties: {
                  mode: { type: 'string', enum: ['full', 'analyze', 'plan', 'scaffold', 'run'], description: 'Modo padrão' },
                  repo: { type: 'string', description: 'Repo padrão' },
                  product: { type: 'string', description: 'Produto padrão' },
                  skipScaffold: { type: 'boolean', description: 'Pular scaffold por padrão' },
                  skipRun: { type: 'boolean', description: 'Pular run por padrão' }
                },
                description: 'Defaults globais opcionais para sobrescrever valores detectados'
              }
            },
            required: ['query']
          }
        },
        {
          name: 'auto',
          description: '🚀 Orquestrador completo: auto-detecta contexto e executa fluxo de qualidade. Modos: full (tudo), analyze (só análise), plan (análise+plano), scaffold (até templates), run (testes+coverage).',
          inputSchema: {
            type: 'object',
            properties: {
              mode: { 
                type: 'string', 
                enum: ['full', 'analyze', 'plan', 'scaffold', 'run'], 
                description: 'Modo de execução (default: full)' 
              },
              repo: { type: 'string', description: 'Caminho do repositório (auto-detecta se omitido)' },
              product: { type: 'string', description: 'Nome do produto (infere de package.json se omitido)' },
              skipScaffold: { type: 'boolean', description: 'Pular geração de scaffolds (útil se já existem testes)' },
              skipRun: { type: 'boolean', description: 'Pular execução de testes (útil para análise rápida)' }
            }
          }
        },
        {
          name: 'evaluate_test_quality',
          description: '🎯 Avalia a qualidade dos testes: analisa funções exportadas, detecta código crítico sem testes, calcula quality score (0-100), identifica gaps de coverage e gera recomendações específicas por função.',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              product: { type: 'string', description: 'Nome do produto' },
              includeDetails: { type: 'boolean', description: 'Incluir detalhes de todas as funções (default: true)', default: true }
            },
            required: ['repo', 'product']
          }
        },
        {
          name: 'analyze_codebase',
          description: 'Analisa o repositório para detectar rotas, endpoints, eventos e riscos',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              product: { type: 'string', description: 'Nome do produto' },
              domains: { type: 'array', items: { type: 'string' }, description: 'Domínios do produto' },
              critical_flows: { type: 'array', items: { type: 'string' }, description: 'Fluxos críticos' },
              targets: {
                type: 'object',
                properties: {
                  ci_p95_min: { type: 'number' },
                  flaky_pct_max: { type: 'number' },
                  diff_coverage_min: { type: 'number' }
                }
              },
              base_url: { type: 'string', description: 'URL base do ambiente' }
            },
            required: ['repo', 'product']
          }
        },
        {
          name: 'generate_test_plan',
          description: 'Gera plano de testes Playwright em Markdown',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              product: { type: 'string', description: 'Nome do produto' },
              base_url: { type: 'string', description: 'URL base do ambiente' },
              include_examples: { type: 'boolean', description: 'Incluir exemplos' },
              out_dir: { type: 'string', default: 'plan' }
            },
            required: ['repo', 'product', 'base_url']
          }
        },
        {
          name: 'scaffold_playwright',
          description: 'Cria estrutura de testes Playwright com specs e configurações',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              plan_file: { type: 'string', description: 'Caminho do plano' },
              out_dir: { type: 'string', default: 'packages/product-e2e' }
            },
            required: ['repo', 'plan_file']
          }
        },
        {
          name: 'run_playwright',
          description: 'Executa testes Playwright com cobertura e relatórios',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              e2e_dir: { type: 'string', description: 'Diretório dos testes' },
              report_dir: { type: 'string', default: 'reports' },
              headless: { type: 'boolean', default: true }
            },
            required: ['repo', 'e2e_dir']
          }
        },
        {
          name: 'build_report',
          description: 'Consolida relatórios em Markdown para aprovação de QA',
          inputSchema: {
            type: 'object',
            properties: {
              in_dir: { type: 'string', description: 'Diretório de entrada' },
              out_file: { type: 'string', default: 'SUMMARY.md' },
              thresholds: {
                type: 'object',
                properties: {
                  flaky_pct_max: { type: 'number' },
                  diff_coverage_min: { type: 'number' }
                }
              }
            },
            required: ['in_dir']
          }
        },
        {
          name: 'analyze_test_coverage',
          description: 'Analisa cobertura completa da pirâmide de testes (unit, integration, e2e)',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              product: { type: 'string', description: 'Nome do produto' },
              target_coverage: {
                type: 'object',
                properties: {
                  unit: { type: 'number' },
                  integration: { type: 'number' },
                  e2e: { type: 'number' }
                }
              }
            },
            required: ['repo', 'product']
          }
        },
        {
          name: 'scaffold_unit_tests',
          description: 'Gera testes unitários automaticamente para arquivos fonte',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              files: { type: 'array', items: { type: 'string' }, description: 'Arquivos específicos' },
              framework: { type: 'string', enum: ['jest', 'vitest', 'mocha'] },
              auto_detect: { type: 'boolean' }
            },
            required: ['repo']
          }
        },
        {
          name: 'scaffold_integration_tests',
          description: 'Gera testes de integração/API automaticamente',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              product: { type: 'string', description: 'Nome do produto' },
              base_url: { type: 'string', description: 'URL base da API' },
              endpoints: { type: 'array', items: { type: 'string' } }
            },
            required: ['repo', 'product']
          }
        },
        {
          name: 'generate_pyramid_report',
          description: 'Gera visualização da pirâmide de testes (Markdown ou HTML)',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              product: { type: 'string', description: 'Nome do produto' },
              output_format: { type: 'string', enum: ['markdown', 'html', 'json'] }
            },
            required: ['repo', 'product']
          }
        },
        {
          name: 'catalog_scenarios',
          description: 'Cataloga cenários de teste para governança multi-squad',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              product: { type: 'string', description: 'Nome do produto' },
              squads: { type: 'array', items: { type: 'string' }, description: 'Lista de squads' }
            },
            required: ['repo', 'product']
          }
        },
        {
          name: 'recommend_test_strategy',
          description: 'Analisa o tipo de aplicação e recomenda estratégia de testes ideal (unit/integration/E2E)',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              product: { type: 'string', description: 'Nome do produto' },
              auto_generate: { type: 'boolean', description: 'Gerar automaticamente sem perguntar', default: false }
            },
            required: ['repo', 'product']
          }
        },
        {
          name: 'run_coverage_analysis',
          description: 'Executa npm run test:coverage e analisa automaticamente os resultados, identificando gaps e recomendando melhorias',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              thresholds: {
                type: 'object',
                properties: {
                  lines: { type: 'number', description: 'Threshold mínimo de linhas (padrão: 70)' },
                  functions: { type: 'number', description: 'Threshold mínimo de funções (padrão: 70)' },
                  branches: { type: 'number', description: 'Threshold mínimo de branches (padrão: 70)' },
                  statements: { type: 'number', description: 'Threshold mínimo de statements (padrão: 70)' }
                }
              }
            },
            required: ['repo']
          }
        },
        {
          name: 'init_product',
          description: 'Inicializa estrutura QA completa para um produto em /qa/<PRODUTO>/ com mcp-settings.json, diretórios de testes, GETTING_STARTED.md',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              product: { type: 'string', description: 'Nome do produto (alphanumeric, hyphens, underscores)' },
              base_url: { type: 'string', description: 'URL base do ambiente (ex: https://www.exemplo.com.br)' },
              domains: { type: 'array', items: { type: 'string' }, description: 'Domínios do produto (ex: auth, search, claim)' },
              critical_flows: { type: 'array', items: { type: 'string' }, description: 'Fluxos críticos (ex: login, checkout)' }
            },
            required: ['repo', 'product', 'base_url']
          }
        },
        {
          name: 'diff_coverage',
          description: 'Calcula cobertura de testes apenas das linhas modificadas (git diff). Valida contra target mínimo e falha se não atingir. Ideal para gates de PR/CI.',
          inputSchema: {
            type: 'object',
            properties: {
              repo: { type: 'string', description: 'Caminho do repositório' },
              product: { type: 'string', description: 'Nome do produto (opcional, carrega do mcp-settings.json)' },
              base_branch: { type: 'string', description: 'Branch base para comparação (padrão: main)', default: 'main' },
              target_min: { type: 'number', description: 'Cobertura mínima exigida em % (padrão: 60)', minimum: 0, maximum: 100 },
              fail_on_low: { type: 'boolean', description: 'Falhar se cobertura < target (padrão: true)', default: true }
            },
            required: ['repo']
          }
        }
      ]
    }));

    // Handler para chamadas de ferramentas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'nl_command': {
            const params = NLCommandSchema.parse(request.params.arguments);
            const result = await nlCommand(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'auto': {
            const params = AutoSchema.parse(request.params.arguments);
            const result = await autoQualityRun(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'evaluate_test_quality': {
            const params = TestQualitySchema.parse(request.params.arguments);
            const result = await evaluateTestQuality(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'analyze_codebase': {
            const params = AnalyzeSchema.parse(request.params.arguments);
            const result = await analyze(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'generate_test_plan': {
            const params = PlanSchema.parse(request.params.arguments);
            const result = await generatePlan(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'scaffold_playwright': {
            const params = ScaffoldSchema.parse(request.params.arguments);
            const result = await scaffoldPlaywright(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'run_playwright': {
            const params = RunSchema.parse(request.params.arguments);
            const result = await runPlaywright(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'build_report': {
            const params = ReportSchema.parse(request.params.arguments);
            const result = await buildReport(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'analyze_test_coverage': {
            const params = CoverageSchema.parse(request.params.arguments);
            const result = await analyzeTestCoverage(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'scaffold_unit_tests': {
            const params = ScaffoldUnitSchema.parse(request.params.arguments);
            const result = await scaffoldUnitTests(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'scaffold_integration_tests': {
            const params = ScaffoldIntegrationSchema.parse(request.params.arguments);
            const result = await scaffoldIntegrationTests(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'generate_pyramid_report': {
            const params = PyramidReportSchema.parse(request.params.arguments);
            const result = await generatePyramidReport(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'catalog_scenarios': {
            const params = CatalogSchema.parse(request.params.arguments);
            const result = await catalogScenarios(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'recommend_test_strategy': {
            const params = RecommendStrategySchema.parse(request.params.arguments);
            const result = await recommendTestStrategy(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'run_coverage_analysis': {
            const params = RunCoverageSchema.parse(request.params.arguments);
            const result = await runCoverageAnalysis(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'init_product': {
            const params = InitProductSchema.parse(request.params.arguments);
            
            // Validar que o repositório existe
            if (!(await fileExists(params.repo))) {
              throw new Error(`Repository path does not exist: ${params.repo}`);
            }
            
            const result = await initProduct(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          case 'diff_coverage': {
            const params = DiffCoverageSchema.parse(request.params.arguments);
            
            // Validar que o repositório existe
            if (!(await fileExists(params.repo))) {
              throw new Error(`Repository path does not exist: ${params.repo}`);
            }
            
            const result = await runDiffCoverage(params);
            
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2)
                }
              ]
            };
          }

          default:
            throw new Error(`Unknown tool: ${request.params.name}`);
        }
      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                error: error.message,
                stack: error.stack
              }, null, 2)
            }
          ],
          isError: true
        };
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Quality MCP Server running on stdio');
  }
}

// Inicia o servidor
const server = new QualityMCPServer();
server.run().catch(console.error);

