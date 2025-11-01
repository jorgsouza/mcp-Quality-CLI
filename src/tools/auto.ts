/**
 * auto.ts - Orchestrador "One-Shot" para execução automatizada completa
 * 
 * Detecta automaticamente o contexto do repositório e executa a melhor sequência
 * de comandos para análise de qualidade de testes.
 * 
 * Modos disponíveis:
 * - full: Análise completa (analyze → plan → scaffold → run → report)
 * - analyze: Apenas análise do código
 * - plan: Análise + geração de plano
 * - scaffold: Análise + plano + scaffold de testes
 * - run: Executa testes existentes + coverage
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { analyze } from './analyze.js';
import { generatePlan } from './plan.js';
import { scaffoldPlaywright } from './scaffold.js';
import { scaffoldUnitTests } from './scaffold-unit.js';
import { runCoverageAnalysis } from './run-coverage.js';
import { generatePyramidReport } from './pyramid-report.js';
import { generateDashboard } from './dashboard.js';
import { analyzeTestCoverage } from './coverage.js';
import { recommendTestStrategy } from './recommend-strategy.js';
import { loadMCPSettings, inferProductFromPackageJson } from '../utils/config.js';
import { fileExists } from '../utils/fs.js';
import { detectLanguage } from '../detectors/language.js';

export type AutoMode = 'full' | 'analyze' | 'plan' | 'scaffold' | 'run';

export interface AutoOptions {
  mode?: AutoMode;
  repo?: string;
  product?: string;
  skipScaffold?: boolean;
  skipRun?: boolean;
}

export interface RepoContext {
  repoPath: string;
  product: string;
  hasTests: boolean;
  hasPackageJson: boolean;
  testFramework?: string;
  language?: string;
}

/**
 * Detecta contexto do repositório automaticamente
 */
export async function detectRepoContext(repoPath: string): Promise<RepoContext> {
  const absolutePath = repoPath.startsWith('/') ? repoPath : join(process.cwd(), repoPath);
  
  // Detectar linguagem usando o detector multi-linguagem
  const languageDetection = await detectLanguage(absolutePath);
  const language = languageDetection.primary;
  
  // Tentar inferir produto do package.json ou go.mod
  let product = await inferProductFromPackageJson(absolutePath);
  if (!product) {
    // Tentar inferir de go.mod
    const goModPath = join(absolutePath, 'go.mod');
    if (await fileExists(goModPath)) {
      const content = await fs.readFile(goModPath, 'utf-8');
      const match = content.match(/module\s+([^\s]+)/);
      if (match) {
        product = match[1].split('/').pop() || 'GoProject';
      }
    }
  }
  if (!product) {
    product = 'AutoDetected';
  }
  
  // Detectar se já tem testes
  const hasTests = await detectExistingTests(absolutePath, language);
  
  // Detectar package.json
  const hasPackageJson = await fileExists(join(absolutePath, 'package.json'));
  
  // Detectar framework/linguagem
  let testFramework: string | undefined;
  
  if (language === 'go') {
    testFramework = 'go-test';
  } else if (language === 'java' || language === 'kotlin') {
    testFramework = 'junit';
  } else if (language === 'python') {
    testFramework = 'pytest';
  } else if (language === 'ruby') {
    testFramework = 'rspec';
  } else if (language === 'csharp') {
    testFramework = 'nunit';
  } else if (language === 'php') {
    testFramework = 'phpunit';
  } else if (language === 'rust') {
    testFramework = 'rust-test';
  } else if (hasPackageJson) {
    try {
      const pkgContent = await fs.readFile(join(absolutePath, 'package.json'), 'utf-8');
      const pkg = JSON.parse(pkgContent);
      
      // Detectar framework de teste
      const deps = { ...pkg.dependencies, ...pkg.devDependencies };
      if (deps.vitest) testFramework = 'vitest';
      else if (deps.jest) testFramework = 'jest';
      else if (deps.mocha) testFramework = 'mocha';
    } catch (error) {
      // Ignora erros de parsing
    }
  }
  
  return {
    repoPath: absolutePath,
    product,
    hasTests,
    hasPackageJson,
    testFramework,
    language
  };
}

/**
 * Detecta se o repositório já tem testes
 */
async function detectExistingTests(repoPath: string, language?: string): Promise<boolean> {
  // Padrões de diretórios de teste por linguagem
  const testDirs: Record<string, string[]> = {
    'go': [''], // Go coloca testes ao lado dos arquivos
    'java': ['src/test', 'test'],
    'kotlin': ['src/test', 'test'],
    'python': ['tests', 'test'],
    'ruby': ['spec', 'test'],
    'csharp': ['Tests', 'test'],
    'php': ['tests', 'test'],
    'rust': ['tests'],
    'javascript': ['tests', 'test', '__tests__', 'spec'],
    'typescript': ['tests', 'test', '__tests__', 'spec']
  };
  
  const dirs = language ? (testDirs[language] || testDirs['javascript']) : ['tests', 'test', '__tests__', 'spec'];
  
  // Para Go, procurar arquivos *_test.go em qualquer lugar
  if (language === 'go') {
    return await checkForGoTestFiles(repoPath);
  }
  
  for (const dir of dirs) {
    if (!dir) continue; // Skip empty strings
    const testPath = join(repoPath, dir);
    if (await fileExists(testPath)) {
      try {
        const stat = await fs.stat(testPath);
        if (stat.isDirectory()) {
          // Verificar arquivos de teste recursivamente
          const hasTests = await checkForTestFiles(testPath, language);
          if (hasTests) {
            return true;
          }
        }
      } catch {
        // Ignora erros
      }
    }
  }
  
  return false;
}

/**
 * Verifica se há arquivos de teste Go
 */
async function checkForGoTestFiles(dir: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    for (const entry of entries) {
      if (entry.isFile() && entry.name.endsWith('_test.go')) {
        return true;
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'vendor') {
        const hasTests = await checkForGoTestFiles(join(dir, entry.name));
        if (hasTests) return true;
      }
    }
  } catch {
    // Ignora erros
  }
  
  return false;
}

/**
 * Verifica recursivamente se há arquivos de teste em um diretório
 */
async function checkForTestFiles(dir: string, language?: string): Promise<boolean> {
  try {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    
    // Padrões de arquivos de teste por linguagem
    const testPatterns: Record<string, RegExp[]> = {
      'go': [/_test\.go$/],
      'java': [/Test\.java$/, /Tests\.java$/],
      'kotlin': [/Test\.kt$/, /Tests\.kt$/],
      'python': [/^test_.*\.py$/, /_test\.py$/],
      'ruby': [/_spec\.rb$/],
      'csharp': [/Test\.cs$/, /Tests\.cs$/],
      'php': [/Test\.php$/],
      'rust': [/_test\.rs$/, /tests\/.*\.rs$/],
      'javascript': [/\.(test|spec)\.(js|jsx|ts|tsx)$/],
      'typescript': [/\.(test|spec)\.(js|jsx|ts|tsx)$/]
    };
    
    const patterns = language ? (testPatterns[language] || testPatterns['javascript']) : [/\.(test|spec)\./];
    
    for (const entry of entries) {
      if (entry.isFile()) {
        // Verifica se é arquivo de teste
        const isTestFile = patterns.some(pattern => pattern.test(entry.name));
        if (isTestFile) {
          return true;
        }
      } else if (entry.isDirectory() && !entry.name.startsWith('.') && entry.name !== 'node_modules' && entry.name !== 'vendor') {
        // Recursão em subdiretórios
        const hasTests = await checkForTestFiles(join(dir, entry.name), language);
        if (hasTests) {
          return true;
        }
      }
    }
  } catch {
    // Ignora erros
  }
  
  return false;
}

/**
 * Executa análise de qualidade automatizada
 */
export async function autoQualityRun(options: AutoOptions = {}): Promise<{
  success: boolean;
  context: RepoContext;
  steps: string[];
  outputs: Record<string, string>;
}> {
  const mode = options.mode || 'full';
  const repoPath = options.repo || process.cwd();
  
  console.log(`\n🚀 Iniciando modo AUTO: ${mode}`);
  console.log(`📁 Repositório: ${repoPath}\n`);
  
  // 1. Detectar contexto
  const context = await detectRepoContext(repoPath);
  console.log(`📦 Produto detectado: ${context.product}`);
  console.log(`🧪 Framework: ${context.testFramework || 'não detectado'}`);
  console.log(`💻 Linguagem: ${context.language || 'não detectada'}`);
  console.log(`✅ Testes existentes: ${context.hasTests ? 'Sim' : 'Não'}\n`);
  
  const steps: string[] = [];
  const outputs: Record<string, string> = {};
  
  // Determinar produto final
  const product = options.product || context.product;
  
  // Tentar carregar configurações existentes
  const settings = await loadMCPSettings(repoPath, product);
  const config = {
    repo: repoPath,
    product,
    ...settings
  };
  
  try {
    // 2. ANALYZE (todos os modos começam com análise)
    if (['full', 'analyze', 'plan', 'scaffold'].includes(mode)) {
      console.log('🔍 [1/6] Analisando repositório...');
      const analyzeResult = await analyze({
        repo: repoPath,
        product
      });
      steps.push('analyze');
      outputs.analyze = analyzeResult.plan_path;
      console.log(`✅ Análise completa: ${analyzeResult.plan_path}\n`);
    }
    
    // 2.5. COVERAGE ANALYSIS (análise de cobertura e pirâmide de testes)
    if (['full', 'plan', 'scaffold', 'run'].includes(mode)) {
      console.log('📊 [2/6] Analisando cobertura de testes...');
      try {
        const coverageResult = await analyzeTestCoverage({
          repo: repoPath,
          product
        });
        steps.push('coverage-analysis');
        outputs.coverageAnalysis = 'tests/analyses/coverage-analysis.json';
        console.log(`✅ Cobertura analisada: ${coverageResult.health}\n`);
        console.log(coverageResult.summary);
      } catch (error) {
        console.log(`⚠️  Erro na análise de cobertura: ${error instanceof Error ? error.message : error}\n`);
      }
    }
    
    // 2.6. RECOMMEND STRATEGY (recomendação de estratégia de testes)
    if (['full', 'plan', 'scaffold'].includes(mode)) {
      console.log('🎯 [3/6] Gerando recomendação de estratégia...');
      try {
        const recommendResult = await recommendTestStrategy({
          repo: repoPath,
          product
        });
        steps.push('recommend-strategy');
        outputs.recommendStrategy = 'tests/analyses/TEST-STRATEGY-RECOMMENDATION.md';
        console.log(`✅ Recomendação gerada!\n`);
        console.log(recommendResult.summary);
      } catch (error) {
        console.log(`⚠️  Erro na recomendação: ${error instanceof Error ? error.message : error}\n`);
      }
    }
    
    // 3. PLAN (se mode >= plan)
    if (['full', 'plan', 'scaffold'].includes(mode)) {
      console.log('📋 [4/6] Gerando plano de testes...');
      const planResult = await generatePlan({
        repo: repoPath,
        product
      });
      steps.push('plan');
      outputs.plan = planResult.plan;
      console.log(`✅ Plano gerado: ${planResult.plan}\n`);
    }
    
    // 4. SCAFFOLD (se mode >= scaffold e não skipScaffold)
    if (['full', 'scaffold'].includes(mode) && !options.skipScaffold) {
      console.log('🏗️  [5/6] Gerando scaffold de testes...');
      
      // Decidir tipo de scaffold baseado no contexto
      if (!context.hasTests) {
        // Se não tem testes, gera unit tests
        const scaffoldResult = await scaffoldUnitTests({
          repo: repoPath,
          product,
          files: [] // Auto-detecta arquivos
        });
        steps.push('scaffold-unit');
        outputs.scaffold = scaffoldResult.generated.join(', ');
        console.log(`✅ Testes unitários gerados: ${scaffoldResult.generated.length} arquivos\n`);
      } else {
        console.log(`ℹ️  Testes já existem, pulando scaffold\n`);
      }
    }
    
    // 5. RUN (se mode == full ou run, e não skipRun)
    if (['full', 'run'].includes(mode) && !options.skipRun) {
      if (context.hasTests || steps.includes('scaffold-unit')) {
        console.log('🧪 [6/6] Executando testes e gerando relatórios...');
        
        try {
          // Run coverage analysis
          const coverageResult = await runCoverageAnalysis({
            repo: repoPath
          });
          steps.push('coverage');
          outputs.coverage = coverageResult.reportPath;
          console.log(`✅ Cobertura analisada: ${coverageResult.analysis.status}\n`);
        } catch (error) {
          console.log(`⚠️  Erro ao executar testes: ${error instanceof Error ? error.message : error}\n`);
        }
        
        try {
          // Generate pyramid report
          const pyramidResult = await generatePyramidReport({
            repo: repoPath,
            product
          });
          steps.push('pyramid-report');
          outputs.pyramidReport = pyramidResult.report_path;
          console.log(`✅ Pirâmide de testes gerada!\n`);
        } catch (error) {
          console.log(`⚠️  Erro ao gerar pirâmide: ${error instanceof Error ? error.message : error}\n`);
        }
        
        try {
          // Generate dashboard
          const dashboardResult = await generateDashboard({
            repo: repoPath,
            product
          });
          steps.push('dashboard');
          outputs.dashboard = dashboardResult.dashboard_path;
          console.log(`✅ Dashboard gerado!\n`);
        } catch (error) {
          console.log(`⚠️  Erro ao gerar dashboard: ${error instanceof Error ? error.message : error}\n`);
        }
      } else {
        console.log(`⚠️  Nenhum teste encontrado, pulando execução\n`);
      }
    }
    
    // Resumo final
    console.log('\n' + '='.repeat(60));
    console.log('✅ AUTO COMPLETO!');
    console.log('='.repeat(60));
    console.log(`\n📊 Passos executados: ${steps.join(' → ')}`);
    console.log(`\n📁 Arquivos gerados:`);
    Object.entries(outputs).forEach(([step, output]) => {
      console.log(`   ${step}: ${output}`);
    });
    console.log('\n' + '='.repeat(60) + '\n');
    
    return {
      success: true,
      context,
      steps,
      outputs
    };
    
  } catch (error) {
    console.error('\n❌ Erro durante execução AUTO:', error instanceof Error ? error.message : error);
    return {
      success: false,
      context,
      steps,
      outputs
    };
  }
}

/**
 * Executa modo específico com validações
 */
export async function runAutoMode(mode: AutoMode, options: Omit<AutoOptions, 'mode'> = {}): Promise<boolean> {
  const result = await autoQualityRun({ ...options, mode });
  return result.success;
}
