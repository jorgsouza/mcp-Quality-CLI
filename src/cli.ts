#!/usr/bin/env node

import { Command } from 'commander';
import { analyze } from './tools/analyze.js';
import { generatePlan } from './tools/plan.js';
import { scaffoldPlaywright } from './tools/scaffold.js';
import { runPlaywright } from './tools/run.js';
import { buildReport } from './tools/report.js';

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

program.parse();

