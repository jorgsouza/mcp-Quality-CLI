#!/usr/bin/env node

/**
 * 🎯 MCP Quality Server - Consolidado
 * 
 * Expõe 5 tools via Model Context Protocol (alinhado com CLI).
 * Tools carregados dinamicamente do manifesto.
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { MCP_TOOLS } from './mcp-tools.manifest.js';

// Imports dos tools (auto usados pelo CLI)
import { autoQualityRun } from './tools/auto.js';
import { runDiffCoverage } from './tools/run-diff-coverage.js';
import { buildReport } from './tools/report.js';
import { scaffoldPlaywright } from './tools/scaffold.js';
import { scaffoldUnitTests } from './tools/scaffold-unit.js';
import { scaffoldIntegrationTests } from './tools/scaffold-integration.js';
import selfCheck from './tools/self-check.js';

class QualityMCPServer {
  private server: Server;

  constructor() {
    this.server = new Server(
      {
        name: 'quality-mcp',
        version: '0.3.1',
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

  private setupHandlers(): void {
    // Lista de ferramentas (do manifesto)
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: MCP_TOOLS.map(tool => ({
        name: tool.name,
        description: tool.description,
        inputSchema: tool.inputSchema,
      })),
    }));

    // Handler de chamadas de ferramentas
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const toolName = request.params.name;
      const args: any = request.params.arguments || {};

      try {
        let result: any;

        switch (toolName) {
          case 'analyze': {
            // Mapeia para auto (orquestrador)
            result = await autoQualityRun({
              repo: args.repo as string,
              product: args.product as string,
              mode: args.mode || 'full',
              skipRun: args.skipRun || false,
              skipScaffold: args.skipScaffold || false,
            });
            break;
          }

          case 'validate': {
            // Mapeia para diff-coverage com gates
            result = await runDiffCoverage({
              repo: args.repo as string,
              product: args.product,
              target_min: args.minDiffCoverage || 60,
              base_branch: args.baseBranch || 'main',
              fail_on_low: args.failOnLow !== false,
            });
            
            // TODO: Adicionar validação de branch coverage e mutation
            // Quando cap.coverage e cap.mutation estiverem implementados
            if (result.ok && result.coverage_pct < (args.minDiffCoverage || 60)) {
              result.ok = false;
              result.message = `Diff coverage ${result.coverage_pct.toFixed(2)}% < ${args.minDiffCoverage || 60}%`;
            }
            break;
          }

          case 'report': {
            // Mapeia para buildReport
            result = await buildReport({
              in_dir: args.inDir as string,
              out_file: args.outFile || 'SUMMARY.md',
              thresholds: {
                diff_coverage_min: args.diffCoverageMin,
                flaky_pct_max: args.flakyPctMax,
              },
            });
            break;
          }

          case 'scaffold': {
            // Mapeia para scaffold-unit, scaffold-integration ou scaffold-playwright
            const type = args.type || 'unit';
            
            if (type === 'unit') {
              result = await scaffoldUnitTests({
                repo: args.repo as string,
                files: args.function ? [args.function as string] : undefined,
                framework: args.framework || 'vitest',
                auto_detect: args.autoDetect !== false,
              });
            } else if (type === 'integration') {
              result = await scaffoldIntegrationTests({
                repo: args.repo as string,
                product: args.product,
                base_url: args.baseUrl,
              });
            } else if (type === 'e2e') {
              // Precisa de plan_file - gerar primeiro ou usar existente
              result = {
                ok: false,
                message: 'E2E scaffold requer plan_file. Use: analyze mode=plan primeiro.',
              };
            }
            break;
          }

          case 'self-check': {
            // Mapeia para selfCheck
            result = await selfCheck({
              repo: args.repo || '.',
              fix: args.fix || false,
            });
            break;
          }

          default:
            throw new Error(`Tool desconhecido: ${toolName}`);
        }

        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify(result, null, 2),
            },
          ],
        };

      } catch (error: any) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                ok: false,
                error: error.message,
                stack: process.env.DEBUG ? error.stack : undefined,
              }, null, 2),
            },
          ],
          isError: true,
        };
      }
    });
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

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('🎯 MCP Quality Server v0.3.1 rodando (5 tools consolidados)');
  }
}

const server = new QualityMCPServer();
server.run().catch(console.error);
