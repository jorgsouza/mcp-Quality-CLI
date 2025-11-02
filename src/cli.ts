#!/usr/bin/env node

import { Command } from 'commander';
import { analyze } from './tools/analyze.js';
import { generatePlan } from './tools/plan.js';
import { scaffoldPlaywright } from './tools/scaffold.js';
import { runPlaywright } from './tools/run.js';
import { buildReport } from './tools/report.js';
import { analyzeTestCoverage } from './tools/coverage.js';
import { scaffoldUnitTests } from './tools/scaffold-unit.js';
import { scaffoldIntegrationTests } from './tools/scaffold-integration.js';
import { generatePyramidReport } from './tools/pyramid-report.js';
import { catalogScenarios } from './tools/catalog.js';
import { recommendTestStrategy } from './tools/recommend-strategy.js';
import { autoQualityRun } from './tools/auto.js';
import { analyzeTestLogic } from './tools/analyze-test-logic.js';

const program = new Command();

program
  .name('quality')
  .description('Quality CLI - Análise e geração automatizada de testes Playwright')
  .version('0.1.0');

// Comando: analyze
program
  .command('analyze')
  .description('Analisa o repositório para detectar rotas, endpoints, eventos e riscos')
  .requiredOption('--repo <path>', 'Caminho do repositório')
  .requiredOption('--product <name>', 'Nome do produto')
  .option('--domains <items>', 'Domínios separados por vírgula')
  .option('--critical-flows <items>', 'Fluxos críticos separados por vírgula')
  .option('--targets <json>', 'JSON com targets (ci_p95_min, flaky_pct_max, diff_coverage_min)')
  .option('--base-url <url>', 'URL base do ambiente')
  .action(async (options) => {
    try {
      const params = {
        repo: options.repo,
        product: options.product,
        domains: options.domains ? options.domains.split(',').map((s: string) => s.trim()) : undefined,
        critical_flows: options.criticalFlows ? options.criticalFlows.split(',').map((s: string) => s.trim()) : undefined,
        targets: options.targets ? JSON.parse(options.targets) : undefined,
        base_url: options.baseUrl
      };

      console.log('🔍 Analisando repositório...\n');
      const result = await analyze(params);
      
      console.log('\n📊 Resultados:');
      console.log(JSON.stringify(result, null, 2));
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

// Comando: plan
program
  .command('plan')
  .description('Gera plano de testes Playwright em Markdown')
  .requiredOption('--repo <path>', 'Caminho do repositório')
  .requiredOption('--product <name>', 'Nome do produto')
  .requiredOption('--base-url <url>', 'URL base do ambiente')
  .option('--include-examples', 'Incluir exemplos de código no plano')
  .option('--out <dir>', 'Diretório de saída', 'plan')
  .action(async (options) => {
    try {
      const params = {
        repo: options.repo,
        product: options.product,
        base_url: options.baseUrl,
        include_examples: options.includeExamples,
        out_dir: options.out
      };

      console.log('📋 Gerando plano de testes...\n');
      const result = await generatePlan(params);
      
      console.log('\n✅ Plano gerado com sucesso!');
      console.log(JSON.stringify(result, null, 2));
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

// Comando: scaffold
program
  .command('scaffold')
  .description('Cria estrutura de testes Playwright com specs e configurações')
  .requiredOption('--repo <path>', 'Caminho do repositório')
  .requiredOption('--plan <file>', 'Caminho do arquivo de plano')
  .option('--out <dir>', 'Diretório de saída', 'packages/product-e2e')
  .action(async (options) => {
    try {
      const params = {
        repo: options.repo,
        plan_file: options.plan,
        out_dir: options.out
      };

      console.log('🏗️  Criando estrutura Playwright...\n');
      const result = await scaffoldPlaywright(params);
      
      console.log('\n✅ Estrutura criada com sucesso!');
      console.log(JSON.stringify(result, null, 2));
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

// Comando: run
program
  .command('run')
  .description('Executa testes Playwright com cobertura e relatórios')
  .requiredOption('--repo <path>', 'Caminho do repositório')
  .requiredOption('--e2e <dir>', 'Diretório dos testes E2E')
  .option('--report <dir>', 'Diretório de relatórios', 'reports')
  .option('--headed', 'Executar em modo headed (com interface)')
  .action(async (options) => {
    try {
      const params = {
        repo: options.repo,
        e2e_dir: options.e2e,
        report_dir: options.report,
        headless: !options.headed
      };

      console.log('🧪 Executando testes Playwright...\n');
      const result = await runPlaywright(params);
      
      if (result.ok) {
        console.log('\n✅ Testes executados com sucesso!');
      } else {
        console.log('\n⚠️  Testes executados com erros');
      }
      console.log(JSON.stringify(result, null, 2));
      
      if (!result.ok) {
        process.exit(1);
      }
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

// Comando: report
program
  .command('report')
  .description('Consolida relatórios em Markdown para aprovação de QA')
  .requiredOption('--in <dir>', 'Diretório de entrada com resultados')
  .option('--out <file>', 'Arquivo de saída', 'SUMMARY.md')
  .option('--thresholds <json>', 'JSON com thresholds (flaky_pct_max, diff_coverage_min)')
  .option('--ci', 'Modo CI (saída otimizada)')
  .action(async (options) => {
    try {
      const params = {
        in_dir: options.in,
        out_file: options.out,
        thresholds: options.thresholds ? JSON.parse(options.thresholds) : undefined
      };

      console.log('📊 Gerando relatório consolidado...\n');
      const result = await buildReport(params);
      
      console.log('\n✅ Relatório gerado com sucesso!');
      console.log(JSON.stringify(result, null, 2));
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

// Comando: full (pipeline completo)
program
  .command('full')
  .description('Executa pipeline completo: analyze → plan → scaffold → run → report')
  .requiredOption('--repo <path>', 'Caminho do repositório')
  .requiredOption('--product <name>', 'Nome do produto')
  .requiredOption('--base-url <url>', 'URL base do ambiente')
  .option('--domains <items>', 'Domínios separados por vírgula')
  .option('--critical-flows <items>', 'Fluxos críticos separados por vírgula')
  .option('--targets <json>', 'JSON com targets')
  .option('--e2e-dir <dir>', 'Diretório dos testes E2E', 'packages/product-e2e')
  .option('--headed', 'Executar testes em modo headed')
  .action(async (options) => {
    try {
      console.log('🚀 Iniciando pipeline completo de qualidade...\n');

      // 1. Analyze
      console.log('=== ETAPA 1/5: Análise do Repositório ===\n');
      const analyzeParams = {
        repo: options.repo,
        product: options.product,
        domains: options.domains ? options.domains.split(',').map((s: string) => s.trim()) : undefined,
        critical_flows: options.criticalFlows ? options.criticalFlows.split(',').map((s: string) => s.trim()) : undefined,
        targets: options.targets ? JSON.parse(options.targets) : undefined,
        base_url: options.baseUrl
      };
      const analyzeResult = await analyze(analyzeParams);
      console.log('✅ Análise concluída\n');

      // 2. Plan
      console.log('=== ETAPA 2/5: Geração do Plano ===\n');
      const planParams = {
        repo: options.repo,
        product: options.product,
        base_url: options.baseUrl,
        include_examples: true,
        out_dir: 'plan'
      };
      const planResult = await generatePlan(planParams);
      console.log('✅ Plano gerado\n');

      // 3. Scaffold
      console.log('=== ETAPA 3/5: Scaffold dos Testes ===\n');
      const scaffoldParams = {
        repo: options.repo,
        plan_file: planResult.plan,
        out_dir: options.e2eDir
      };
      const scaffoldResult = await scaffoldPlaywright(scaffoldParams);
      console.log('✅ Estrutura criada\n');

      // 4. Run
      console.log('=== ETAPA 4/5: Execução dos Testes ===\n');
      const runParams = {
        repo: options.repo,
        e2e_dir: scaffoldResult.e2e_dir,
        report_dir: 'reports',
        headless: !options.headed
      };
      const runResult = await runPlaywright(runParams);
      console.log('✅ Testes executados\n');

      // 5. Report
      console.log('=== ETAPA 5/5: Geração do Relatório ===\n');
      const reportParams = {
        in_dir: 'reports',
        out_file: 'SUMMARY.md',
        thresholds: options.targets ? JSON.parse(options.targets) : undefined
      };
      const reportResult = await buildReport(reportParams);
      console.log('✅ Relatório gerado\n');

      console.log('🎉 Pipeline completo finalizado com sucesso!\n');
      console.log('📄 Arquivos gerados:');
      console.log(`   - Análise: plan/analyze.json`);
      console.log(`   - Plano: ${planResult.plan}`);
      console.log(`   - Testes: ${scaffoldResult.e2e_dir}`);
      console.log(`   - Relatórios: reports/`);
      console.log(`   - Summary: ${reportResult.out}`);

    } catch (error: any) {
      console.error('\n❌ Pipeline falhou:', error.message);
      process.exit(1);
    }
  });

// Comando: coverage
program
  .command('coverage')
  .description('Analisa cobertura completa da pirâmide de testes')
  .requiredOption('--repo <path>', 'Caminho do repositório')
  .requiredOption('--product <name>', 'Nome do produto')
  .option('--target-coverage <json>', 'JSON com alvos de cobertura por camada')
  .action(async (options) => {
    try {
      const params = {
        repo: options.repo,
        product: options.product,
        target_coverage: options.targetCoverage ? JSON.parse(options.targetCoverage) : undefined
      };

      console.log('📊 Analisando cobertura da pirâmide...\n');
      const result = await analyzeTestCoverage(params);
      
      console.log('\n✅ Análise completa!');
      console.log(result.summary);
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

// Comando: scaffold-unit
program
  .command('scaffold-unit')
  .description('Gera testes unitários automaticamente')
  .requiredOption('--repo <path>', 'Caminho do repositório')
  .option('--files <items>', 'Arquivos específicos separados por vírgula')
  .option('--framework <name>', 'Framework de teste (jest|vitest|mocha)')
  .action(async (options) => {
    try {
      const params = {
        repo: options.repo,
        files: options.files ? options.files.split(',').map((s: string) => s.trim()) : undefined,
        framework: options.framework as 'jest' | 'vitest' | 'mocha' | undefined
      };

      console.log('🧪 Gerando testes unitários...\n');
      const result = await scaffoldUnitTests(params);
      
      console.log(`\n✅ ${result.generated.length} testes gerados com ${result.framework}!`);
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

// Comando: scaffold-integration
program
  .command('scaffold-integration')
  .description('Gera testes de integração/API automaticamente')
  .requiredOption('--repo <path>', 'Caminho do repositório')
  .requiredOption('--product <name>', 'Nome do produto')
  .option('--base-url <url>', 'URL base da API')
  .action(async (options) => {
    try {
      const params = {
        repo: options.repo,
        product: options.product,
        base_url: options.baseUrl
      };

      console.log('🔗 Gerando testes de integração...\n');
      const result = await scaffoldIntegrationTests(params);
      
      console.log(`\n✅ ${result.generated.length} arquivos gerados!`);
      console.log(`   Diretório: ${result.test_dir}`);
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

// Comando: pyramid
program
  .command('pyramid')
  .description('Gera visualização da pirâmide de testes')
  .requiredOption('--repo <path>', 'Caminho do repositório')
  .requiredOption('--product <name>', 'Nome do produto')
  .option('--format <type>', 'Formato de saída (markdown|html|json)', 'markdown')
  .action(async (options) => {
    try {
      const params = {
        repo: options.repo,
        product: options.product,
        output_format: options.format as 'markdown' | 'html' | 'json'
      };

      console.log('📊 Gerando visualização da pirâmide...\n');
      const result = await generatePyramidReport(params);
      
      console.log(`\n✅ Relatório gerado: ${result.report_path}`);
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

// Comando: catalog
program
  .command('catalog')
  .description('Cataloga cenários de teste para governança multi-squad')
  .requiredOption('--repo <path>', 'Caminho do repositório')
  .requiredOption('--product <name>', 'Nome do produto')
  .option('--squads <items>', 'Squads separadas por vírgula')
  .action(async (options) => {
    try {
      const params = {
        repo: options.repo,
        product: options.product,
        squads: options.squads ? options.squads.split(',').map((s: string) => s.trim()) : undefined
      };

      console.log('📚 Catalogando cenários...\n');
      const result = await catalogScenarios(params);
      
      console.log(`\n✅ Catálogo gerado!`);
      console.log(`   Total de cenários: ${result.total_scenarios}`);
      console.log(`   Squads: ${Object.keys(result.by_squad).length}`);
      console.log(`   Cross-squad: ${result.cross_squad_scenarios.length}`);
      console.log(`   Duplicatas: ${result.duplicates.length}`);
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

// Comando: recommend
program
  .command('recommend')
  .description('🎯 Analisa o tipo de aplicação e recomenda estratégia de testes ideal')
  .requiredOption('--repo <path>', 'Caminho do repositório')
  .requiredOption('--product <name>', 'Nome do produto')
  .option('--auto', 'Gerar automaticamente sem perguntar')
  .action(async (options) => {
    try {
      const params = {
        repo: options.repo,
        product: options.product,
        auto_generate: options.auto ?? false
      };

      const result = await recommendTestStrategy(params);
      
      if (result.ok) {
        console.log(`\n✅ Análise completa!`);
        if (result.file) {
          console.log(`📄 Recomendação: ${result.file}`);
        }
        if (result.recommendation) {
          console.log(`\n📊 Tipo: ${result.recommendation.appType}`);
          console.log(`📊 Complexidade: ${result.recommendation.complexity.toUpperCase()}`);
          console.log(`\n🎯 Estratégia Recomendada:`);
          console.log(`   Unit:        ${result.recommendation.strategy.unit}`);
          console.log(`   Integration: ${result.recommendation.strategy.integration}`);
          console.log(`   E2E:         ${result.recommendation.strategy.e2e}`);
        }
        if (result.exists) {
          console.log(`\n${result.message}`);
        }
      } else {
        console.log(`\n⚠️  ${result.message}`);
      }
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

// Comando: run-coverage
program
  .command('run-coverage')
  .description('Executa npm run test:coverage e analisa automaticamente os resultados')
  .requiredOption('-r, --repo <path>', 'Caminho do repositório')
  .option('--lines <number>', 'Threshold mínimo de linhas (padrão: 70)', '70')
  .option('--functions <number>', 'Threshold mínimo de funções (padrão: 70)', '70')
  .option('--branches <number>', 'Threshold mínimo de branches (padrão: 70)', '70')
  .option('--statements <number>', 'Threshold mínimo de statements (padrão: 70)', '70')
  .action(async (options) => {
    try {
      const { runCoverageAnalysis } = await import('./tools/run-coverage.js');
      
      const params = {
        repo: options.repo,
        thresholds: {
          lines: parseInt(options.lines),
          functions: parseInt(options.functions),
          branches: parseInt(options.branches),
          statements: parseInt(options.statements)
        }
      };

      const result = await runCoverageAnalysis(params);
      
      if (result.ok) {
        console.log(`\n✅ Análise de cobertura completa!`);
        console.log(`📄 Relatório: ${result.reportPath}`);
        console.log(`\n📊 Status: ${result.analysis.status.toUpperCase()}`);
        console.log(`   Atende thresholds: ${result.analysis.meetsThresholds ? '✅' : '❌'}`);
        
        if (result.analysis.priorities.length > 0) {
          console.log(`\n🎯 Arquivos prioritários: ${result.analysis.priorities.length}`);
        }
      } else {
        console.log(`\n❌ Erro ao executar cobertura`);
      }
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

// Comando: auto
program
  .command('auto')
  .description('🚀 Orquestrador completo: auto-detecta contexto e executa fluxo de qualidade')
  .option('--repo <path>', 'Caminho do repositório (auto-detecta se omitido)')
  .option('--product <name>', 'Nome do produto (infere de package.json se omitido)')
  .option('--mode <mode>', 'Modo de execução (default: full)', 'full')
  .option('--skip-run', 'Pular execução de testes (útil para análise rápida)')
  .option('--skip-scaffold', 'Pular geração de scaffolds (útil se já existem testes)')
  .action(async (options) => {
    try {
      const params = {
        repo: options.repo,
        product: options.product,
        mode: options.mode,
        skipRun: options.skipRun,
        skipScaffold: options.skipScaffold
      };

      console.log('🚀 Iniciando análise mágica de qualidade...\n');
      const result = await autoQualityRun(params);
      
      console.log('\n✨ Análise completa finalizada!');
      console.log(JSON.stringify(result, null, 2));
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

// Comando: analyze-test-logic
program
  .command('analyze-test-logic')
  .description('🧠 Analisa a lógica dos testes: valida happy path, edge cases, error handling e side effects')
  .requiredOption('--repo <path>', 'Caminho do repositório')
  .requiredOption('--product <name>', 'Nome do produto')
  .option('--generate-patches', 'Gerar patches .patch com testes faltantes')
  .option('--run-mutation', 'Executar mutation testing (experimental)')
  .action(async (options) => {
    try {
      const params = {
        repo: options.repo,
        product: options.product,
        generatePatches: options.generatePatches ?? true,
        runMutation: options.runMutation ?? false
      };

      console.log('🧠 Analisando lógica dos testes...\n');
      const result = await analyzeTestLogic(params);
      
      console.log(`\n✅ Análise completa!`);
      console.log(`📄 Relatório: ${result.reportPath}`);
      console.log(`\n📊 Quality Score: ${result.metrics.qualityScore.toFixed(2)}/100 (${result.metrics.grade})`);
      console.log(`\n🎯 Cobertura de Cenários:`);
      console.log(`   Happy Path:     ${result.metrics.scenarioCoverage.happy.toFixed(2)}%`);
      console.log(`   Edge Cases:     ${result.metrics.scenarioCoverage.edge.toFixed(2)}%`);
      console.log(`   Error Handling: ${result.metrics.scenarioCoverage.error.toFixed(2)}%`);
      console.log(`   Side Effects:   ${result.metrics.scenarioCoverage.sideEffects.toFixed(2)}%`);
      
      console.log(`\n📝 Funções analisadas: ${result.functions.length}`);
      console.log(`� Recomendações: ${result.recommendations.length}`);
      
      if (result.patches.length > 0) {
        console.log(`\n📦 Patches gerados: ${result.patches.length}`);
      }
    } catch (error: any) {
      console.error('❌ Erro:', error.message);
      process.exit(1);
    }
  });

program.parse();

