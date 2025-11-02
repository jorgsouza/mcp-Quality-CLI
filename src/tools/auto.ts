/**
 * auto.ts - Orchestrador "One-Shot" COMPLETO para análise de qualidade
 * 
 * FLUXO MÁGICO:
 * 1. Self-check: Valida ambiente (Node, vitest, git, permissões)
 * 2. Analyze: Analisa código e detecta funções/endpoints/eventos
 * 3. Coverage Analysis: Roda testes e analisa cobertura
 * 4. Test Strategy: Recomenda estratégia (pirâmide de testes)
 * 5. Plan: Gera plano de testes baseado em riscos
 * 6. Scaffold (opcional): Gera estrutura de testes faltantes
 * 7. Run Tests: Executa testes com coverage completo
 * 8. Pyramid Report: Gera relatório da pirâmide de testes
 * 9. Dashboard: Gera dashboard.html visual interativo
 * 10. Validate: Valida gates de qualidade (coverage, mutation, scenarios)
 * 11. Final Report: Consolida TUDO em um relatório executivo
 * 
 * Modos disponíveis:
 * - full: Análise completa (TODAS as 11 etapas) ← RECOMENDADO
 * - analyze: Apenas análise do código (etapas 1-5)
 * - plan: Análise + geração de plano (etapas 1-5)
 * - scaffold: Análise + plano + scaffold de testes (etapas 1-6)
 * - run: Executa testes existentes + coverage (etapas 1-2, 7-11)
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { selfCheck } from './self-check.js';
import { analyze } from './analyze.js';
import { generatePlan } from './plan.js';
import { scaffoldPlaywright } from './scaffold.js';
import { scaffoldUnitTests } from './scaffold-unit.js';
import { runCoverageAnalysis } from './run-coverage.js';
import { generatePyramidReport } from './pyramid-report.js';
import { generateDashboard } from './dashboard.js';
import { analyzeTestCoverage } from './coverage.js';
import { recommendTestStrategy } from './recommend-strategy.js';
import { validate } from './validate.js';
import { buildReport } from './report.js';
import { analyzeTestLogic } from './analyze-test-logic.js';
import { initProduct } from './init-product.js';
import { loadMCPSettings, inferProductFromPackageJson } from '../utils/config.js';
import { fileExists } from '../utils/fs.js';
import { detectLanguage } from '../detectors/language.js';
import { getPaths } from '../utils/paths.js';

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

  // [FASE 2] Calcular paths uma vez para uso em todo o pipeline
  const paths = getPaths(repoPath, product, settings || undefined);
  
  try {
    // [FASE 3] Auto-inicializar estrutura qa/<product> se não existir
    const mcpSettingsPath = join(paths.root, 'mcp-settings.json');
    const hasStructure = await fileExists(mcpSettingsPath);
    
    if (!hasStructure) {
      // Verificar se o diretório do repositório existe antes de tentar criar estrutura
      const repoExists = await fileExists(repoPath);
      if (!repoExists) {
        throw new Error(`Repository path does not exist: ${repoPath}`);
      }
      
      console.log(`🏗️  [0/11] Inicializando estrutura qa/${product}...`);
      await initProduct({ 
        repo: repoPath, 
        product,
        base_url: 'http://localhost:3000', // Default - usuário pode customizar depois
        domains: [],
        critical_flows: []
      });
      console.log(`✅ Estrutura inicializada!\n`);
      steps.push('init-product');
    }
    
    // 0. SELF-CHECK (SEMPRE executa - valida ambiente)
    console.log('🔍 [0/11] Self-Check: Validando ambiente...');
    const selfCheckResult = await selfCheck({
      repo: repoPath,
      fix: false
    });
    steps.push('self-check');
    
    if (!selfCheckResult.ok) {
      console.log(`\n⚠️  AVISOS no ambiente:`);
      selfCheckResult.results.forEach(r => {
        if (r.status === 'warning' || r.status === 'error') {
          console.log(`   ${r.status === 'error' ? '❌' : '⚠️'} ${r.name}: ${r.message}`);
        }
      });
      console.log(``);
    } else {
      console.log(`✅ Ambiente validado com sucesso!\n`);
    }
    
    // 1. ANALYZE (todos os modos começam com análise)
    if (['full', 'analyze', 'plan', 'scaffold'].includes(mode)) {
      console.log('🔍 [1/11] Analisando repositório...');
      const analyzeResult = await analyze({
        repo: repoPath,
        product
      });
      steps.push('analyze');
      outputs.analyze = analyzeResult.plan_path;
      console.log(`✅ Análise completa: ${analyzeResult.plan_path}\n`);
    }
    
    // 2. COVERAGE ANALYSIS (análise de cobertura e pirâmide de testes)
    if (['full', 'plan', 'scaffold', 'run'].includes(mode)) {
      console.log('📊 [2/11] Analisando cobertura de testes...');
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
      
      // 2.5. TEST LOGIC ANALYSIS (análise profunda de qualidade dos testes)
      console.log('🔬 [2.5/11] Analisando qualidade lógica dos testes...');
      try {
        const logicResult = await analyzeTestLogic({
          repo: repoPath,
          product,
          runMutation: false, // Mutation opcional (lento)
          generatePatches: true
        });
        steps.push('test-logic-analysis');
        outputs.testLogicAnalysis = logicResult.reportPath;
        console.log(`✅ Análise de qualidade concluída!`);
        console.log(`   📊 Quality Score: ${logicResult.metrics.qualityScore}/100 (${logicResult.metrics.grade})`);
        console.log(`   🎯 Happy Path: ${logicResult.metrics.scenarioCoverage.happy.toFixed(1)}%`);
        console.log(`   🔀 Edge Cases: ${logicResult.metrics.scenarioCoverage.edge.toFixed(1)}%`);
        console.log(`   ⚠️  Error Handling: ${logicResult.metrics.scenarioCoverage.error.toFixed(1)}%`);
        console.log(`   📄 Relatório: ${logicResult.reportPath}\n`);
      } catch (error) {
        console.log(`⚠️  Erro na análise de lógica: ${error instanceof Error ? error.message : error}\n`);
      }
    }
    
    // 3. RECOMMEND STRATEGY (recomendação de estratégia de testes)
    if (['full', 'plan', 'scaffold'].includes(mode)) {
      console.log('🎯 [3/11] Gerando recomendação de estratégia...');
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
    
    // 4. PLAN (se mode >= plan)
    if (['full', 'plan', 'scaffold'].includes(mode)) {
      console.log('📋 [4/11] Gerando plano de testes...');
      const planResult = await generatePlan({
        repo: repoPath,
        product
      });
      steps.push('plan');
      outputs.plan = planResult.plan;
      console.log(`✅ Plano gerado: ${planResult.plan}\n`);
    }
    
    // 5. SCAFFOLD (se mode >= scaffold e não skipScaffold)
    if (['full', 'scaffold'].includes(mode) && !options.skipScaffold) {
      console.log('🏗️  [5/11] Gerando scaffold de testes...');
      
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
    
    // 6. RUN TESTS WITH COVERAGE (se mode == full ou run, e não skipRun)
    if (['full', 'run'].includes(mode) && !options.skipRun) {
      if (context.hasTests || steps.includes('scaffold-unit')) {
        console.log('🧪 [6/11] Executando testes com cobertura...');
        
        try {
          // Run coverage analysis
          const coverageResult = await runCoverageAnalysis({
            repo: repoPath,
            product // [FASE 2] Adicionar product para getPaths()
          });
          steps.push('coverage');
          outputs.coverage = coverageResult.reportPath;
          console.log(`✅ Testes executados com sucesso!\n`);
        } catch (error) {
          console.log(`⚠️  Erro ao executar testes: ${error instanceof Error ? error.message : error}\n`);
        }
        
        // 7. PYRAMID REPORT
        console.log('📊 [7/11] Gerando relatório da pirâmide de testes...');
        try {
          const pyramidResult = await generatePyramidReport({
            repo: repoPath,
            product
          });
          steps.push('pyramid-report');
          outputs.pyramidReport = pyramidResult.report_path;
          console.log(`✅ Relatório da pirâmide gerado: ${pyramidResult.report_path}\n`);
        } catch (error) {
          console.log(`⚠️  Erro ao gerar pirâmide: ${error instanceof Error ? error.message : error}\n`);
        }
        
        // 8. DASHBOARD HTML
        console.log('📊 [8/11] Gerando dashboard da pirâmide de testes...');
        try {
          const dashboardResult = await generateDashboard({
            repo: repoPath,
            product
          });
          steps.push('dashboard');
          outputs.dashboard = dashboardResult.dashboard_path;
          console.log(`✅ Dashboard gerado: ${dashboardResult.dashboard_path}\n`);
        } catch (error) {
          console.log(`⚠️  Erro ao gerar dashboard: ${error instanceof Error ? error.message : error}\n`);
        }
        
        // 9. VALIDATE GATES
        console.log('✅ [9/11] Validando gates de qualidade...');
        try {
          const validateResult = await validate({
            repo: repoPath,
            product,
            minBranch: 80,
            minMutation: 70
          });
          steps.push('validate');
          outputs.validate = validateResult.passed ? 'PASSED' : 'FAILED';
          console.log(`${validateResult.passed ? '✅' : '⚠️'} Gates de qualidade: ${validateResult.passed ? 'APROVADOS' : 'REPROVADOS'}\n`);
        } catch (error) {
          console.log(`⚠️  Erro ao validar gates: ${error instanceof Error ? error.message : error}\n`);
        }
        
        // 10. FINAL CONSOLIDATED REPORT
        console.log('📄 [10/11] Gerando relatório consolidado final...');
        try {
          const reportResult = await buildReport({
            in_dir: paths.analyses, // [FASE 2] Usar paths.analyses
            out_file: 'QUALITY-ANALYSIS-REPORT.md'
          });
          steps.push('final-report');
          outputs.finalReport = reportResult.out;
          console.log(`✅ Relatório consolidado gerado: ${reportResult.out}\n`);
        } catch (error) {
          console.log(`⚠️  Erro ao gerar relatório consolidado: ${error instanceof Error ? error.message : error}\n`);
        }

        // 11. EXPORT TO tests/qa (cópia dos principais artefatos)
        console.log('📦 [11/11] Exportando relatórios para tests/qa...');
        try {
          const copied = await exportReportsToQA(repoPath);
          steps.push('export-qa');
          outputs.qa = `tests/qa (${copied.length} arquivos)`;
          console.log(`✅ Relatórios copiados para tests/qa: ${copied.length} arquivo(s)\n`);
        } catch (error) {
          console.log(`⚠️  Erro ao exportar relatórios para tests/qa: ${error instanceof Error ? error.message : error}\n`);
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

/**
 * Copia os principais artefatos gerados em tests/analyses para tests/qa
 */
async function exportReportsToQA(repoPath: string): Promise<string[]> {
  const qaDir = join(repoPath, 'tests', 'qa');
  await fs.mkdir(qaDir, { recursive: true });

  const sources = [
    // Relatórios em tests/analyses
    ['tests/analyses/TEST-PLAN.md', 'TEST-PLAN.md'],
    ['tests/analyses/TEST-STRATEGY-RECOMMENDATION.md', 'TEST-STRATEGY-RECOMMENDATION.md'],
    ['tests/analyses/COVERAGE-ANALYSIS.md', 'COVERAGE-ANALYSIS.md'],
    ['tests/analyses/PYRAMID-REPORT.md', 'PYRAMID-REPORT.md'],
    ['tests/analyses/dashboard.html', 'dashboard.html'],
    ['tests/analyses/coverage-analysis.json', 'coverage-analysis.json'],
    // Relatório consolidado gerado na raiz
    ['QUALITY-ANALYSIS-REPORT.md', 'QUALITY-ANALYSIS-REPORT.md']
  ];

  const copied: string[] = [];
  for (const [relSrc, destName] of sources) {
    const src = join(repoPath, relSrc);
    const dest = join(qaDir, destName);
    try {
      if (await fileExists(src)) {
        await fs.copyFile(src, dest);
        copied.push(dest);
      }
    } catch {
      // continua tentando os próximos
    }
  }
  return copied;
}
