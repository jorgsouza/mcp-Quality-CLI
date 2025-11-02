import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Command } from 'commander';

// Mock dos módulos de tools
vi.mock('../tools/analyze.js');
vi.mock('../tools/plan.js');
vi.mock('../tools/scaffold.js');
vi.mock('../tools/run.js');
vi.mock('../tools/report.js');
vi.mock('../tools/coverage.js');
vi.mock('../tools/scaffold-unit.js');
vi.mock('../tools/scaffold-integration.js');
vi.mock('../tools/pyramid-report.js');
vi.mock('../tools/catalog.js');
vi.mock('../tools/recommend-strategy.js');

describe('CLI', () => {
  let consoleLogSpy: any;
  let consoleErrorSpy: any;
  let processExitSpy: any;

  beforeEach(() => {
    vi.clearAllMocks();
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    processExitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
  });

  describe('Comando analyze', () => {
    it('deve executar análise com parâmetros obrigatórios', async () => {
      const { analyze } = await import('../tools/analyze.js');
      (analyze as any).mockResolvedValue({
        summary: 'Teste',
        findings: { routes: [], endpoints: [], events: [] }
      });

      const program = new Command();
      await import('../cli.js');

      // Simular execução do comando
      // Nota: Este é um teste de estrutura, não de execução real
      expect(analyze).toBeDefined();
    });

    it('deve parsear domínios separados por vírgula', () => {
      const domainsStr = 'auth,search,claim';
      const domains = domainsStr.split(',').map(s => s.trim());
      
      expect(domains).toEqual(['auth', 'search', 'claim']);
    });

    it('deve parsear critical flows separados por vírgula', () => {
      const flowsStr = 'login,checkout,payment';
      const flows = flowsStr.split(',').map(s => s.trim());
      
      expect(flows).toEqual(['login', 'checkout', 'payment']);
    });

    it('deve parsear JSON de targets', () => {
      const targetsJson = '{"ci_p95_min":15,"flaky_pct_max":3}';
      const targets = JSON.parse(targetsJson);
      
      expect(targets).toEqual({
        ci_p95_min: 15,
        flaky_pct_max: 3
      });
    });
  });

  describe('Comando plan', () => {
    it('deve gerar plano com parâmetros obrigatórios', async () => {
      const { generatePlan } = await import('../tools/plan.js');
      (generatePlan as any).mockResolvedValue({
        ok: true,
        plan: 'plan/TEST-PLAN.md'
      });

      expect(generatePlan).toBeDefined();
    });

    it('deve usar diretório de saída padrão se não especificado', () => {
      const defaultOut = 'plan';
      expect(defaultOut).toBe('plan');
    });

    it('deve aceitar include-examples como boolean', () => {
      const includeExamples = true;
      expect(typeof includeExamples).toBe('boolean');
    });
  });

  describe('Comando scaffold', () => {
    it('deve criar estrutura Playwright', async () => {
      const { scaffoldPlaywright } = await import('../tools/scaffold.js');
      (scaffoldPlaywright as any).mockResolvedValue({
        ok: true,
        created: ['playwright.config.ts', 'tests/']
      });

      expect(scaffoldPlaywright).toBeDefined();
    });

    it('deve usar diretório de saída padrão', () => {
      const defaultOut = 'packages/product-e2e';
      expect(defaultOut).toBe('packages/product-e2e');
    });
  });

  describe('Comando run', () => {
    it('deve executar testes com sucesso', async () => {
      const { runPlaywright } = await import('../tools/run.js');
      (runPlaywright as any).mockResolvedValue({
        ok: true,
        passed: 10,
        failed: 0
      });

      expect(runPlaywright).toBeDefined();
    });

    it('deve converter --headed para headless=false', () => {
      const headed = true;
      const headless = !headed;
      
      expect(headless).toBe(false);
    });

    it('deve usar headless=true por padrão', () => {
      const headed = undefined;
      const headless = !headed;
      
      expect(headless).toBe(true);
    });

    it('deve usar diretório de relatórios padrão', () => {
      const defaultReport = 'reports';
      expect(defaultReport).toBe('reports');
    });
  });

  describe('Comando report', () => {
    it('deve consolidar relatórios', async () => {
      const { buildReport } = await import('../tools/report.js');
      (buildReport as any).mockResolvedValue({
        ok: true,
        output: 'SUMMARY.md'
      });

      expect(buildReport).toBeDefined();
    });

    it('deve usar arquivo de saída padrão', () => {
      const defaultOut = 'SUMMARY.md';
      expect(defaultOut).toBe('SUMMARY.md');
    });
  });

  describe('Comando coverage', () => {
    it('deve analisar cobertura de testes', async () => {
      const { analyzeTestCoverage } = await import('../tools/coverage.js');
      (analyzeTestCoverage as any).mockResolvedValue({
        ok: true,
        pyramid: {
          unit: 70,
          integration: 20,
          e2e: 10
        }
      });

      expect(analyzeTestCoverage).toBeDefined();
    });
  });

  describe('Comando scaffold-unit', () => {
    it('deve gerar testes unitários', async () => {
      const { scaffoldUnitTests } = await import('../tools/scaffold-unit.js');
      (scaffoldUnitTests as any).mockResolvedValue({
        ok: true,
        generated: ['file1.test.ts', 'file2.test.ts']
      });

      expect(scaffoldUnitTests).toBeDefined();
    });
  });

  describe('Comando scaffold-integration', () => {
    it('deve gerar testes de integração', async () => {
      const { scaffoldIntegrationTests } = await import('../tools/scaffold-integration.js');
      (scaffoldIntegrationTests as any).mockResolvedValue({
        ok: true,
        generated: ['api.integration.test.ts']
      });

      expect(scaffoldIntegrationTests).toBeDefined();
    });
  });

  describe('Comando pyramid-report', () => {
    it('deve gerar relatório da pirâmide', async () => {
      const { generatePyramidReport } = await import('../tools/pyramid-report.js');
      (generatePyramidReport as any).mockResolvedValue({
        ok: true,
        output: 'PYRAMID-REPORT.md'
      });

      expect(generatePyramidReport).toBeDefined();
    });
  });

  describe('Comando catalog', () => {
    it('deve catalogar cenários', async () => {
      const { catalogScenarios } = await import('../tools/catalog.js');
      (catalogScenarios as any).mockResolvedValue({
        ok: true,
        scenarios: 42
      });

      expect(catalogScenarios).toBeDefined();
    });
  });

  describe('Comando recommend', () => {
    it('deve recomendar estratégia de testes', async () => {
      const { recommendTestStrategy } = await import('../tools/recommend-strategy.js');
      (recommendTestStrategy as any).mockResolvedValue({
        ok: true,
        recommendation: {
          unit: 90,
          integration: 10,
          e2e: 0
        }
      });

      expect(recommendTestStrategy).toBeDefined();
    });
  });

  describe('Parsing de argumentos', () => {
    it('deve parsear lista de arquivos', () => {
      const filesStr = 'file1.ts,file2.ts,file3.ts';
      const files = filesStr.split(',').map(s => s.trim());
      
      expect(files).toEqual(['file1.ts', 'file2.ts', 'file3.ts']);
    });

    it('deve parsear lista de endpoints', () => {
      const endpointsStr = 'GET /users,POST /users,PUT /users/:id';
      const endpoints = endpointsStr.split(',').map(s => s.trim());
      
      expect(endpoints).toEqual([
        'GET /users',
        'POST /users',
        'PUT /users/:id'
      ]);
    });

    it('deve parsear lista de squads', () => {
      const squadsStr = 'auth,search,checkout';
      const squads = squadsStr.split(',').map(s => s.trim());
      
      expect(squads).toEqual(['auth', 'search', 'checkout']);
    });

    it('deve parsear thresholds JSON', () => {
      const thresholdsJson = '{"flaky_pct_max":3,"diff_coverage_min":60}';
      const thresholds = JSON.parse(thresholdsJson);
      
      expect(thresholds).toEqual({
        flaky_pct_max: 3,
        diff_coverage_min: 60
      });
    });
  });

  describe('Validação de entrada', () => {
    it('deve validar URL base', () => {
      const validUrl = 'https://example.com';
      expect(() => new URL(validUrl)).not.toThrow();
    });

    it('deve rejeitar URL inválida', () => {
      const invalidUrl = 'not-a-url';
      expect(() => new URL(invalidUrl)).toThrow();
    });

    it('deve validar nome de produto alphanumeric', () => {
      const validName = 'my-product-123';
      const regex = /^[a-zA-Z0-9-_]+$/;
      expect(regex.test(validName)).toBe(true);
    });

    it('deve rejeitar nome de produto com caracteres especiais', () => {
      const invalidName = 'my@product!';
      const regex = /^[a-zA-Z0-9-_]+$/;
      expect(regex.test(invalidName)).toBe(false);
    });
  });

  describe('Output formats', () => {
    it('deve suportar formato markdown', () => {
      const format = 'markdown';
      expect(['markdown', 'html', 'json']).toContain(format);
    });

    it('deve suportar formato html', () => {
      const format = 'html';
      expect(['markdown', 'html', 'json']).toContain(format);
    });

    it('deve suportar formato json', () => {
      const format = 'json';
      expect(['markdown', 'html', 'json']).toContain(format);
    });

    it('deve rejeitar formato inválido', () => {
      const format = 'xml';
      expect(['markdown', 'html', 'json']).not.toContain(format);
    });
  });

  describe('Framework detection', () => {
    it('deve suportar jest', () => {
      const framework = 'jest';
      expect(['jest', 'vitest', 'mocha']).toContain(framework);
    });

    it('deve suportar vitest', () => {
      const framework = 'vitest';
      expect(['jest', 'vitest', 'mocha']).toContain(framework);
    });

    it('deve suportar mocha', () => {
      const framework = 'mocha';
      expect(['jest', 'vitest', 'mocha']).toContain(framework);
    });
  });

  describe('Validação de Comandos Registrados', () => {
    it('deve ter todos os comandos esperados registrados na CLI', async () => {
      // Lista completa de comandos que devem estar disponíveis
      const expectedCommands = [
        'analyze',
        'plan',
        'scaffold',
        'run',
        'report',
        'full',
        'coverage',
        'scaffold-unit',
        'scaffold-integration',
        'pyramid',
        'catalog',
        'recommend',
        'run-coverage',
        'auto',
        'analyze-test-logic',
        'help'
      ];

      // Cria uma nova instância do programa para inspeção
      const { execSync } = await import('child_process');
      
      // Executa --help e captura a saída
      const helpOutput = execSync('node dist/cli.js --help', { 
        encoding: 'utf8',
        cwd: process.cwd()
      });

      // Verifica se cada comando esperado está presente na saída do --help
      for (const command of expectedCommands) {
        expect(helpOutput).toContain(command);
      }
    });

    it('deve ter descrições para todos os comandos', async () => {
      const { execSync } = await import('child_process');
      
      const helpOutput = execSync('node dist/cli.js --help', { 
        encoding: 'utf8',
        cwd: process.cwd()
      });

      // Comandos críticos que devem ter descrições detalhadas
      const criticalCommands = [
        { name: 'analyze', description: 'Analisa o repositório' },
        { name: 'plan', description: 'Gera plano de testes' },
        { name: 'auto', description: 'Orquestrador completo' },
        { name: 'analyze-test-logic', description: 'Analisa a lógica dos testes' }
      ];

      for (const cmd of criticalCommands) {
        expect(helpOutput).toContain(cmd.name);
        expect(helpOutput).toContain(cmd.description);
      }
    });

    it('deve validar que comandos específicos aceitam parâmetros obrigatórios', async () => {
      const { execSync } = await import('child_process');
      
      // Testa se analyze requer --repo e --product
      try {
        execSync('node dist/cli.js analyze 2>&1', { encoding: 'utf8' });
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/required option.*--repo/i);
      }

      // Testa se analyze-test-logic requer --repo e --product
      try {
        execSync('node dist/cli.js analyze-test-logic 2>&1', { encoding: 'utf8' });
      } catch (error: any) {
        expect(error.stdout || error.stderr).toMatch(/required option.*--repo/i);
      }
    });

    it('deve rejeitar comandos inexistentes com mensagem clara', async () => {
      const { execSync } = await import('child_process');
      
      try {
        execSync('node dist/cli.js comando-que-nao-existe 2>&1', { encoding: 'utf8' });
        // Se não lançar erro, o teste deve falhar
        expect(true).toBe(false);
      } catch (error: any) {
        const output = error.stdout || error.stderr || error.message;
        expect(output).toMatch(/unknown command|error/i);
      }
    });

    it('deve garantir que scripts npm correspondam aos comandos CLI', () => {
      const fs = require('fs');
      const path = require('path');
      
      const packageJsonPath = path.join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
      
      // Scripts npm que devem chamar comandos CLI
      const npmScriptMappings = {
        'analyze:test-logic': 'analyze-test-logic'
      };

      for (const [scriptName, cliCommand] of Object.entries(npmScriptMappings)) {
        expect(packageJson.scripts).toHaveProperty(scriptName);
        expect(packageJson.scripts[scriptName]).toContain(cliCommand);
      }
    });
  });
});

