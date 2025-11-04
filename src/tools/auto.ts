/**
 * auto.ts - Orchestrador "One-Shot" COMPLETO para análise de qualidade
 * 
 * FLUXO CONSOLIDADO (9 FASES):
 * 1. [FASE 1] CUJ/SLO/Risk Discovery: Cataloga journeys críticos
 * 2. [FASE 2] Portfolio Planning: Redesenha pirâmide de testes
 * 3. [FASE 3] Contract Testing: Gera e verifica contratos Pact (CDC)
 * 4. Analyze: Analisa código e detecta funções/endpoints/eventos
 * 5. Coverage Analysis: Analisa cobertura e qualidade dos testes
 * 6. Test Strategy & Planning: Recomenda estratégia e gera plano
 * 7. 📊 RELATÓRIOS CONSOLIDADOS (2 PRINCIPAIS):
 *    - CODE-ANALYSIS.md: Análise completa do código
 *    - TEST-PLAN.md: Planejamento estratégico de testes
 * 8. Scaffold (opcional): Gera estrutura de testes faltantes
 * 9. Run & Validate: Executa testes + valida gates + dashboard
 * 
 * Modos disponíveis:
 * - full: Análise completa (TODAS as etapas) ← RECOMENDADO
 * - analyze: Apenas análise do código (etapas 1-7)
 * - plan: Análise + geração de plano (etapas 1-7)
 * - scaffold: Análise + plano + scaffold de testes (etapas 1-8)
 * - run: Executa testes existentes + coverage (etapas 9)
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { selfCheck } from './self-check.js';
import { analyze } from './analyze.js';
import { generatePlan } from './plan.js';
import { recommendTestStrategy } from './recommend-strategy.js';
import { generatePyramidReport } from './pyramid-report.js';
import { scaffoldPlaywright } from './scaffold.js';
import { scaffoldUnitTests } from './scaffold-unit.js';
import { runCoverageAnalysis } from './run-coverage.js';
import { generateDashboard } from './dashboard.js';
import { analyzeTestCoverage } from './coverage.js';
import { validate } from './validate.js';
import { analyzeTestLogic } from './analyze-test-logic.js';
import { initProduct } from './init-product.js';
import { loadMCPSettings, inferProductFromPackageJson } from '../utils/config.js';
import { fileExists } from '../utils/fs.js';
import { detectLanguage } from '../detectors/language.js';
import { getPaths, type QAPaths } from '../utils/paths.js';

// 🆕 [PASSO 2] Engine Unificado Multi-Linguagem
import { runPipeline } from '../engine/index.js';

// [QUALITY GATES] FASE 1: CUJ/SLO/Risk Discovery
import { catalogCUJs } from './catalog-cujs.js';
import { defineSLOs } from './define-slos.js';
import { riskRegister } from './risk-register.js';

// [QUALITY GATES] FASE 2: Portfolio Planning
import { portfolioPlan } from './portfolio-plan.js';

// [QUALITY GATES] FASE 3: CDC/Pact Contract Testing
import { scaffoldContractsPact } from './scaffold-contracts-pact.js';
import { runContractsVerify } from './run-contracts-verify.js';

// [QUALITY GATES] FASE 4: Property-Based Tests
import { scaffoldPropertyTests } from './scaffold-property-tests.js';

// [QUALITY GATES] FASE 5: Approval Tests
import { scaffoldApprovalTests } from './scaffold-approval-tests.js';

// [QUALITY GATES] FASE 7: Suite Health
import { suiteHealth } from './suite-health.js';

// [QUALITY GATES] FASE 6: Mutation Testing
import { runMutationTests } from './run-mutation-tests.js';

// [QUALITY GATES] FASE 8: Prod Metrics
import { prodMetricsIngest } from './prod-metrics-ingest.js';

// [QUALITY GATES] FASE 9: SLO Canary
import { sloCanaryCheck } from './slo-canary-check.js';

// [QUALITY GATES] FASE 10: Quality Gates
import { releaseQualityGate } from './release-quality-gate.js';

// [DIFF COVERAGE] Diff Coverage for PRs  
import { runDiffCoverage } from './run-diff-coverage.js';

// [CONSOLIDATION] Consolidated Reports
import { consolidateCodeAnalysisReport, consolidateTestPlanReport } from './consolidate-reports.js';

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
 * [FASE 6] Resultado estruturado do Auto
 * Retorna paths organizados por categoria
 */
export interface AutoResult {
  ok: boolean;
  outputs: {
    root: string;
    reports: string[];
    analyses: string[];
    dashboard?: string;
    tests?: {
      unit?: string;
      integration?: string;
      e2e?: string;
    };
    /** 🆕 Mutation testing score */
    mutation?: {
      overall_score: number;
      critical_score: number;
      passed: boolean;
    };
    /** 🆕 Prod metrics & DORA */
    prod_metrics?: {
      deployment_frequency: number;
      mttr_minutes: number;
      change_failure_rate: number;
      dora_tier: string;
    };
    /** 🆕 SLO Canary status */
    slo_canary?: {
      cujs_met: number;
      cujs_violated: number;
      critical_violations: number;
    };
    /** 🆕 Quality Gates result */
    quality_gate?: {
      passed: boolean;
      exit_code: number;
      total_violations: number;
      blocking_violations: number;
    };
  };
  steps: string[];
  duration: number;
  context: RepoContext;
}

/**
 * Contexto interno do pipeline (usado entre funções)
 */
interface PipelineContext {
  repoPath: string;
  product: string;
  mode: AutoMode;
  context: RepoContext;
  paths: QAPaths;
  steps: string[];
  outputs: Record<string, string>;
  settings: any;
  language?: string; // 🆕 Linguagem detectada pelo engine
  metrics?: Record<string, any>; // 🆕 Métricas adicionais (contracts, DORA, quality gates, etc)
}

// ============================================================================
// DETECTION HELPERS
// ============================================================================

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

// ============================================================================
// PIPELINE PHASES
// ============================================================================

/**
 * Phase 0: Inicialização (self-check + estrutura qa/)
 */
async function runInitPhase(ctx: PipelineContext): Promise<void> {
  // Auto-inicializar estrutura qa/<product> se não existir
  const mcpSettingsPath = join(ctx.paths.root, 'mcp-settings.json');
  const hasStructure = await fileExists(mcpSettingsPath);
  
  if (!hasStructure) {
    const repoExists = await fileExists(ctx.repoPath);
    if (!repoExists) {
      throw new Error(`Repository path does not exist: ${ctx.repoPath}`);
    }
    
    console.log(`🏗️  [0/11] Inicializando estrutura qa/${ctx.product}...`);
    await initProduct({ 
      repo: ctx.repoPath, 
      product: ctx.product,
      base_url: 'http://localhost:3000',
      domains: [],
      critical_flows: []
    });
    console.log(`✅ Estrutura inicializada!\n`);
    ctx.steps.push('init-product');
  }
  
  // Self-check (sempre executa)
  console.log('🔍 [0/11] Self-Check: Validando ambiente...');
  const selfCheckResult = await selfCheck({
    repo: ctx.repoPath,
    product: ctx.product,
    fix: false
  });
  ctx.steps.push('self-check');
  
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
}

/**
 * Phase 1: CUJ/SLO/Risk Discovery
 */
async function runDiscoveryPhase(ctx: PipelineContext): Promise<void> {
  if (!['full', 'analyze', 'plan', 'scaffold'].includes(ctx.mode)) {
    return;
  }
  
  console.log('🎯 [PHASE 1] CUJ/SLO/Risk Discovery...');
  
  try {
    // 1.1. Catalog CUJs
    console.log('  📋 [1.1] Catalogando Critical User Journeys...');
    const cujResult = await catalogCUJs({
      repo: ctx.repoPath,
      product: ctx.product,
      sources: ['routes', 'readme'],
    });
    ctx.steps.push('catalog-cujs');
    ctx.outputs.cujCatalog = cujResult.output;
    console.log(`  ✅ ${cujResult.cujs_count} CUJs catalogados\n`);
    
    // 1.2. Define SLOs
    console.log('  🎯 [1.2] Definindo SLOs para CUJs...');
    const slosResult = await defineSLOs({
      repo: ctx.repoPath,
      product: ctx.product,
      cuj_file: cujResult.output,
    });
    ctx.steps.push('define-slos');
    ctx.outputs.slos = slosResult.output;
    console.log(`  ✅ ${slosResult.slos_count} SLOs definidos (${slosResult.custom_slos_count} customizados)\n`);
    
    // 1.3. Risk Register
    console.log('  ⚠️  [1.3] Gerando Risk Register...');
    const riskResult = await riskRegister({
      repo: ctx.repoPath,
      product: ctx.product,
      cuj_file: cujResult.output,
      slos_file: slosResult.output,
    });
    ctx.steps.push('risk-register');
    ctx.outputs.riskRegister = riskResult.output;
    console.log(`  ✅ ${riskResult.total_risks} riscos identificados (${riskResult.critical_risks} críticos)\n`);
    
    if (riskResult.top_5_risk_ids.length > 0) {
      console.log(`  📊 Top 5 Riscos Críticos:`);
      console.log(`     ${riskResult.top_5_risk_ids.join(', ')}\n`);
    }
  } catch (error) {
    console.log(`⚠️  Erro na Phase 1 (CUJ/SLO/Risk): ${error instanceof Error ? error.message : error}\n`);
  }
}

/**
 * Phase 1.5: Portfolio Planning 🆕
 * Redesenha a pirâmide de testes baseado em riscos
 * TODO: Implementar quando portfolio-plan.ts estiver pronto
 */
async function runPortfolioPlanningPhase(ctx: PipelineContext): Promise<void> {
  if (!['full', 'analyze', 'plan', 'scaffold'].includes(ctx.mode)) {
    return;
  }
  
  console.log('📊 [PHASE 1.5] Portfolio Planning...');
  try {
    const portfolioResult = await portfolioPlan({
      repo: ctx.repoPath,
      product: ctx.product,
      risk_file: ctx.outputs.riskRegister,
      coverage_file: ctx.outputs.coverageAnalysis,
    });
    ctx.steps.push('portfolio-plan');
    ctx.outputs.portfolioPlan = portfolioResult.output;
    console.log(`  ✅ Portfolio plan gerado: ${portfolioResult.recommendations_count} recomendações\n`);
  } catch (error) {
    console.log(`  ⚠️  Erro ao gerar portfolio plan: ${error instanceof Error ? error.message : error}\n`);
  }
}

/**
 * Phase 1.6: Contract Testing (CDC/Pact) 🆕
 * Gera e verifica contratos entre serviços
 */
async function runContractTestingPhase(ctx: PipelineContext): Promise<void> {
  if (!['full', 'analyze', 'plan', 'scaffold'].includes(ctx.mode)) {
    return;
  }
  
  console.log('🤝 [PHASE 1.6] Contract Testing (CDC/Pact)...');
  
  try {
    const analysisPath = ctx.outputs.analyze;
    if (!analysisPath) {
      console.log('  ⏭️  Pulando: análise de código não disponível\n');
      return;
    }
    
    // Read analysis to check endpoint count
    const analysisContent = await fs.readFile(analysisPath, 'utf-8');
    const analysis = JSON.parse(analysisContent);
    const endpointCount = analysis.endpoints?.length || 0;
    
    // Only run CDC if >= 3 endpoints (intelligent threshold)
    if (endpointCount < 3) {
      console.log(`  ⏭️  Pulando: apenas ${endpointCount} endpoints (mínimo: 3)\n`);
      return;
    }
    
    console.log(`  📡 Detectados ${endpointCount} endpoints - iniciando CDC...`);
    
    // Step 1: Scaffold contracts
    const scaffoldResult = await scaffoldContractsPact({
      repo: ctx.repoPath,
      product: ctx.product,
      analyze_file: analysisPath,
      auto_detect: true,
    });
    
    if (scaffoldResult.ok) {
      ctx.steps.push('contract-scaffold');
      if (scaffoldResult.catalog_path) {
        ctx.outputs.contractCatalog = scaffoldResult.catalog_path;
      }
      if (scaffoldResult.config_path) {
        ctx.outputs.contractConfig = scaffoldResult.config_path;
      }
      console.log(`  ✅ Contratos gerados: ${scaffoldResult.total_contracts} contratos, ${scaffoldResult.total_interactions} interações`);
      
      // Initialize metrics if needed
      if (!ctx.metrics) {
        ctx.metrics = {};
      }
      ctx.metrics.contracts_total = scaffoldResult.total_contracts;
      ctx.metrics.interactions_total = scaffoldResult.total_interactions;
    } else {
      console.log(`  ⚠️  ${scaffoldResult.message}\n`);
      return;
    }
    
    // Step 2: Verify contracts (if pacts exist)
    const pactsDir = join(ctx.paths.contracts, 'pacts');
    const pactsExist = await fileExists(pactsDir);
    
    if (pactsExist) {
      console.log('  🔍 Verificando contratos...');
      const verifyResult = await runContractsVerify({
        repo: ctx.repoPath,
        product: ctx.product,
        provider_base_url: 'http://localhost:3000', // Default
      });
      
      if (verifyResult.ok) {
        ctx.steps.push('contract-verify');
        if (verifyResult.report_path) {
          ctx.outputs.contractVerify = verifyResult.report_path;
        }
        console.log(`  ✅ Verificação: ${Math.round(verifyResult.verification_rate * 100)}% (${verifyResult.verified}/${verifyResult.total_interactions})`);
        
        if (ctx.metrics) {
          ctx.metrics.verification_rate = verifyResult.verification_rate;
          ctx.metrics.verified = verifyResult.verified;
          ctx.metrics.failed = verifyResult.failed;
        }
      } else {
        console.log(`  ⚠️  Verificação falhou: ${verifyResult.message}`);
      }
    } else {
      console.log('  ℹ️  Pact files não encontrados (execute consumer tests primeiro)');
    }
    
    console.log('');
  } catch (error) {
    console.log(`  ⚠️  Erro no Contract Testing: ${error instanceof Error ? error.message : String(error)}\n`);
  }
}

/**
 * Phase 2: Code Analysis (🆕 Unificado com Engine Multi-Linguagem)
 */
async function runAnalysisPhase(ctx: PipelineContext): Promise<void> {
  if (!['full', 'analyze', 'plan', 'scaffold'].includes(ctx.mode)) {
    return;
  }
  
  // 🆕 1. Usa runPipeline do engine para detecção automática de linguagem
  console.log('🔍 [1/11] Analisando repositório com Engine Unificado...');
  try {
    const engineResult = await runPipeline({
      repo: ctx.repoPath,
      product: ctx.product,
    });
    
    // Armazena resultado do engine
    ctx.language = engineResult.report.language;
    console.log(`📝 Linguagem detectada: ${ctx.language}`);
    
    // Armazena funções/testes descobertos
    if (engineResult.report.functions) {
      console.log(`📦 ${engineResult.report.functions.length} funções descobertas`);
    }
    if (engineResult.report.tests) {
      console.log(`🧪 ${engineResult.report.tests.length} testes descobertos`);
    }
    
  } catch (error) {
    console.warn('⚠️  Engine falhou, usando fallback:', error);
  }
  
  // 2. Analyze tradicional (complementar)
  const analyzeResult = await analyze({
    repo: ctx.repoPath,
    product: ctx.product
  });
  ctx.steps.push('analyze');
  ctx.outputs.analyze = analyzeResult.plan_path;
  console.log(`✅ Análise completa: ${analyzeResult.plan_path}\n`);
}

/**
 * Phase 3: Coverage & Test Quality Analysis
 */
async function runCoverageAnalysisPhase(ctx: PipelineContext): Promise<void> {
  if (!['full', 'plan', 'scaffold', 'run'].includes(ctx.mode)) {
    return;
  }
  
  // 2. Coverage Analysis
  console.log('📊 [2/11] Analisando cobertura de testes...');
  try {
    const coverageResult = await analyzeTestCoverage({
      repo: ctx.repoPath,
      product: ctx.product
    });
    ctx.steps.push('coverage-analysis');
    ctx.outputs.coverageAnalysis = 'tests/analyses/coverage-analysis.json';
    console.log(`✅ Cobertura analisada: ${coverageResult.health}\n`);
    console.log(coverageResult.summary);
  } catch (error) {
    console.log(`⚠️  Erro na análise de cobertura: ${error instanceof Error ? error.message : error}\n`);
  }
  
  // 2.5. Test Logic Analysis
  console.log('🔬 [2.5/11] Analisando qualidade lógica dos testes...');
  try {
    const logicResult = await analyzeTestLogic({
      repo: ctx.repoPath,
      product: ctx.product,
      runMutation: false,
      generatePatches: true
    });
    ctx.steps.push('test-logic-analysis');
    ctx.outputs.testLogicAnalysis = logicResult.reportPath;
    console.log(`✅ Análise de qualidade concluída!`);
    console.log(`   📊 Quality Score: ${logicResult.metrics.qualityScore}/100 (${logicResult.metrics.grade})`);
    console.log(`   🎯 Happy Path: ${logicResult.metrics.scenarioCoverage.happy.toFixed(1)}%`);
    console.log(`   🔀 Edge Cases: ${logicResult.metrics.scenarioCoverage.edge.toFixed(1)}%`);
    console.log(`   ⚠️  Error Handling: ${logicResult.metrics.scenarioCoverage.error.toFixed(1)}%`);
    console.log(`   📄 Relatório: ${logicResult.reportPath}\n`);
  } catch (error) {
    console.log(`⚠️  Erro na análise de lógica: ${error instanceof Error ? error.message : error}\n`);
  }

  // 2.6. Diff Coverage (PR-aware)
  console.log('🔀 [2.6/11] Analisando cobertura do diff (PR-aware)...');
  try {
    const diffResult = await runDiffCoverage({
      repo: ctx.repoPath,
      product: ctx.product,
      baseBranch: 'main',
      minCoverage: 80
    });
    ctx.steps.push('diff-coverage');
    ctx.outputs.diffCoverage = join('tests/analyses/diff-coverage.json');
    
    if (!ctx.metrics) {
      ctx.metrics = {};
    }
    ctx.metrics.diff_coverage_percent = diffResult.diffCoverage;
    ctx.metrics.diff_lines_added = diffResult.linesAdded;
    ctx.metrics.diff_lines_covered = diffResult.linesCovered;
    
    console.log(`✅ Diff Coverage: ${diffResult.diffCoverage.toFixed(1)}%`);
    console.log(`   📝 Linhas Adicionadas: ${diffResult.linesAdded}`);
    console.log(`   ✅ Linhas Cobertas: ${diffResult.linesCovered}`);
    console.log(`   📄 Relatório: ${diffResult.reportPath}\n`);
  } catch (error) {
    console.log(`⚠️  Erro no diff coverage (talvez não há diff): ${error instanceof Error ? error.message : error}\n`);
  }
}

/**
 * Phase 4: Test Strategy & Planning (dados intermediários para consolidação)
 * 
 * Gera relatórios intermediários que serão consolidados depois.
 * Os arquivos .md individuais serão deletados após consolidação.
 */
async function runPlanningPhase(ctx: PipelineContext): Promise<void> {
  if (!['full', 'plan', 'scaffold'].includes(ctx.mode)) {
    return;
  }
  
  // 3. Recommend Strategy (dados intermediários)
  console.log('🎯 [3/11] Gerando dados de estratégia...');
  try {
    const recommendResult = await recommendTestStrategy({
      repo: ctx.repoPath,
      product: ctx.product
    });
    ctx.steps.push('recommend-strategy');
    ctx.outputs.recommendStrategy = 'tests/analyses/TEST-STRATEGY-RECOMMENDATION.md';
    console.log(`✅ Dados de estratégia gerados (será consolidado)\n`);
  } catch (error) {
    console.log(`⚠️  Erro na estratégia: ${error instanceof Error ? error.message : error}\n`);
  }
  
  // 4. Generate Plan (dados intermediários)
  console.log('📋 [4/11] Gerando dados de plano...');
  try {
    const planResult = await generatePlan({
      repo: ctx.repoPath,
      product: ctx.product
    });
    ctx.steps.push('plan');
    ctx.outputs.plan = planResult.plan;
    console.log(`✅ Dados de plano gerados (será consolidado)\n`);
  } catch (error) {
    console.log(`⚠️  Erro no plano: ${error instanceof Error ? error.message : error}\n`);
  }
}

/**
 * Phase 4.5: Suite Health Measurement 🆕
 * Mede saúde da suíte: flakiness, runtime, parallelism
 */
async function runSuiteHealthPhase(ctx: PipelineContext): Promise<void> {
  if (!['full', 'run'].includes(ctx.mode)) {
    return;
  }
  
  console.log('🏥 [PHASE 4.5] Suite Health Measurement...');
  try {
    const healthResult = await suiteHealth({
      repo: ctx.repoPath,
      product: ctx.product,
      history_days: 30,
    });
    ctx.steps.push('suite-health');
    ctx.outputs.suiteHealth = healthResult.output;
    
    if (healthResult.instability_index > 0.03) {
      console.log(`  ⚠️  Instability Index: ${(healthResult.instability_index * 100).toFixed(2)}% (acima de 3%)`);
      console.log(`  🔴 ${healthResult.flaky_tests_count} testes flaky detectados`);
    } else {
      console.log(`  ✅ Suite saudável (instability: ${(healthResult.instability_index * 100).toFixed(2)}%)`);
    }
    
    console.log(`  ⏱️  Runtime: ${healthResult.total_runtime_sec.toFixed(1)}s`);
    console.log(`  💡 ${healthResult.recommendations.length} recomendação(ões)\n`);
  } catch (error) {
    console.log(`  ⚠️  Erro ao medir suite health: ${error instanceof Error ? error.message : error}\n`);
  }
}

/**
 * Phase 4.6: Mutation Testing 🆕
 * Executa mutation testing em módulos críticos (do risk-register)
 */
async function runMutationTestingPhase(ctx: PipelineContext): Promise<void> {
  if (!['full', 'run'].includes(ctx.mode)) {
    return;
  }
  
  console.log('🧬 [PHASE 4.6] Mutation Testing...');
  try {
    const mutationResult = await runMutationTests({
      repo: ctx.repoPath,
      product: ctx.product,
      minScore: 0.5, // 50% mínimo
    });
    ctx.steps.push('mutation-tests');
    ctx.outputs.mutationScore = mutationResult.outputPath;
    
    // Armazenar metrics para Quality Gates
    if (!ctx.metrics) ctx.metrics = {};
    ctx.metrics.mutation_overall = mutationResult.overallScore;
    ctx.metrics.mutation_critical = mutationResult.criticalScore;
    ctx.metrics.mutation_passed = mutationResult.passed ? 1 : 0;
    
    if (mutationResult.passed) {
      console.log(`  ✅ Mutation score: ${mutationResult.overallScore.toFixed(1)}% (threshold: ${mutationResult.threshold.toFixed(0)}%)`);
      console.log(`  🔥 Critical modules score: ${mutationResult.criticalScore.toFixed(1)}%`);
    } else {
      console.log(`  ⚠️  Mutation score abaixo do threshold: ${mutationResult.overallScore.toFixed(1)}% < ${mutationResult.threshold.toFixed(0)}%`);
      console.log(`  🔴 Adicione mais testes para matar os mutantes sobreviventes!`);
    }
    
    console.log(`  📊 Módulos testados: ${mutationResult.modules.length}`);
    console.log(`  💾 Relatório: MUTATION-SCORE.md\n`);
  } catch (error) {
    console.log(`  ⚠️  Erro ao executar mutation tests: ${error instanceof Error ? error.message : error}`);
    console.log(`  💡 Certifique-se de ter Stryker (TS), mutmut (Py), go-mutesting (Go) ou PIT (Java) instalados\n`);
  }
}

/**
 * Phase 4.7: Production Metrics Ingest (DORA) 🆕
 */
async function runProdMetricsPhase(ctx: PipelineContext): Promise<void> {
  if (!['full', 'run'].includes(ctx.mode)) {
    return;
  }
  
  console.log('📊 [PHASE 4.7] Production Metrics (DORA)...');
  try {
    const prodMetricsResult = await prodMetricsIngest({
      repo: ctx.repoPath,
      product: ctx.product,
      sources: {
        // TODO: Ler de config ou env vars
        // sentry: { dsn: process.env.SENTRY_DSN, ... },
        // datadog: { apiKey: process.env.DD_API_KEY, ... },
      }
    });
    
    ctx.steps.push('prod-metrics');
    ctx.outputs.prodMetrics = prodMetricsResult.output;
    
    // Armazenar metrics para Quality Gates
    if (!ctx.metrics) ctx.metrics = {};
    ctx.metrics.deployment_frequency = prodMetricsResult.dora_metrics.deployment_frequency;
    ctx.metrics.change_failure_rate = prodMetricsResult.dora_metrics.change_failure_rate;
    ctx.metrics.mttr_minutes = prodMetricsResult.dora_metrics.mttr_minutes;
    ctx.metrics.dora_tier = prodMetricsResult.dora_metrics.dora_tier;
    
    console.log(`  ✅ DORA Metrics: ${prodMetricsResult.dora_metrics.dora_tier}`);
    console.log(`  📊 Deploy Freq: ${prodMetricsResult.dora_metrics.deployment_frequency.toFixed(0)}/mês | CFR: ${(prodMetricsResult.dora_metrics.change_failure_rate * 100).toFixed(1)}% | MTTR: ${prodMetricsResult.dora_metrics.mttr_minutes.toFixed(0)}min\n`);
  } catch (error) {
    console.log(`  ⚠️  Erro ao coletar prod metrics: ${error instanceof Error ? error.message : error}\n`);
  }
}

/**
 * Phase 4.8: SLO Canary Check 🆕
 */
async function runSLOCanaryPhase(ctx: PipelineContext): Promise<void> {
  if (!['full', 'run'].includes(ctx.mode)) {
    return;
  }
  
  console.log('🕯️  [PHASE 4.8] SLO Canary Check...');
  try {
    const sloCanaryResult = await sloCanaryCheck({
      repo: ctx.repoPath,
      product: ctx.product,
    });
    
    ctx.steps.push('slo-canary');
    ctx.outputs.sloCanary = sloCanaryResult.output_path;
    
    // Armazenar metrics para Quality Gates
    if (!ctx.metrics) ctx.metrics = {};
    ctx.metrics.slo_cujs_met = sloCanaryResult.summary.cujs_met;
    ctx.metrics.slo_cujs_violated = sloCanaryResult.summary.cujs_violated;
    ctx.metrics.slo_critical_violations = sloCanaryResult.summary.critical_violations;
    
    console.log(`  ${sloCanaryResult.ok ? '✅' : '⚠️'} SLOs: ${sloCanaryResult.summary.cujs_met}/${sloCanaryResult.summary.total_cujs} CUJs atendendo`);
    if (!sloCanaryResult.ok) {
      console.log(`  🔴 ${sloCanaryResult.summary.critical_violations} violações críticas\n`);
    } else {
      console.log();
    }
  } catch (error) {
    console.log(`  ⚠️  Erro ao verificar SLOs: ${error instanceof Error ? error.message : error}\n`);
  }
}

/**
 * Phase 4.9: Quality Gates (Final Validation) 🆕
 */
async function runQualityGatesPhase(ctx: PipelineContext): Promise<void> {
  if (!['full', 'run'].includes(ctx.mode)) {
    return;
  }
  
  console.log('🚦 [PHASE 4.9] Quality Gates...');
  try {
    const qualityGateResult = await releaseQualityGate({
      repo: ctx.repoPath,
      product: ctx.product,
    });
    
    ctx.steps.push('quality-gates');
    ctx.outputs.qualityGate = qualityGateResult.output_path;
    
    // Armazenar resultdo para AutoResult
    if (!ctx.metrics) ctx.metrics = {};
    ctx.metrics.quality_gate_passed = qualityGateResult.exit_code === 0 ? 1 : 0;
    ctx.metrics.quality_gate_exit_code = qualityGateResult.exit_code;
    ctx.metrics.quality_gate_total_violations = qualityGateResult.summary.failed_gates;
    ctx.metrics.quality_gate_blocking_violations = qualityGateResult.summary.blocking_violations;
    
    const passed = qualityGateResult.exit_code === 0;
    const totalViolations = qualityGateResult.summary.failed_gates;
    console.log(`  ${passed ? '✅' : '🚫'} Quality Gates: ${passed ? 'PASSED' : 'FAILED'}`);
    console.log(`  📊 ${qualityGateResult.summary.total_gates} gates | ${totalViolations} violations\n`);
  } catch (error) {
    console.log(`  ⚠️  Erro ao aplicar quality gates: ${error instanceof Error ? error.message : error}\n`);
  }
}

/**
 * Phase 5: Consolidated Reporting (2 relatórios principais)
 */
async function runConsolidatedReporting(ctx: PipelineContext): Promise<void> {
  if (!['full', 'analyze', 'plan', 'scaffold', 'run'].includes(ctx.mode)) {
    return;
  }
  
  console.log('\n' + '='.repeat(60));
  console.log('📊 [5/11] Gerando relatórios consolidados...');
  console.log('='.repeat(60) + '\n');
  
  // Relatório 1: CODE-ANALYSIS.md
  console.log('📋 [5.1] Consolidando análise de código...');
  try {
    const codeAnalysisResult = await consolidateCodeAnalysisReport(
      ctx.repoPath,
      ctx.product
    );
    ctx.steps.push('code-analysis-report');
    ctx.outputs.codeAnalysisReport = codeAnalysisResult.path;
    console.log(`✅ CODE-ANALYSIS.md gerado: ${codeAnalysisResult.path}\n`);
  } catch (error) {
    console.log(`⚠️  Erro ao gerar análise de código: ${error instanceof Error ? error.message : error}\n`);
  }
  
  // Relatório 2: TEST-PLAN.md
  console.log('📋 [5.2] Consolidando plano de testes...');
  try {
    const testPlanResult = await consolidateTestPlanReport(
      ctx.repoPath,
      ctx.product
    );
    ctx.steps.push('test-plan-report');
    ctx.outputs.testPlanReport = testPlanResult.path;
    console.log(`✅ TEST-PLAN.md gerado: ${testPlanResult.path}\n`);
  } catch (error) {
    console.log(`⚠️  Erro ao gerar plano de testes: ${error instanceof Error ? error.message : error}\n`);
  }
  
  // Limpar relatórios redundantes
  console.log('🧹 [5.3] Limpando relatórios redundantes...');
  await cleanupRedundantReports(ctx);
  
  console.log('✅ Relatórios consolidados gerados com sucesso!\n');
}

/**
 * Remove relatórios individuais redundantes após consolidação
 * 
 * Mantém apenas:
 * - CODE-ANALYSIS.md (consolidado) ⭐
 * - TEST-PLAN.md (consolidado) ⭐
 * - SELF-CHECK.md (diagnóstico do ambiente)
 * - GETTING_STARTED.md (guia inicial)
 * - README.md (documentação)
 * - dashboard.html (visualização interativa)
 * - arquivos JSON em analyses/ (dados brutos para referência)
 */
async function cleanupRedundantReports(ctx: PipelineContext): Promise<void> {
  const redundantFiles = [
    // === RELATÓRIOS CONSOLIDADOS EM CODE-ANALYSIS.md ===
    join(ctx.paths.reports, 'COVERAGE-ANALYSIS.md'),
    join(ctx.paths.reports, 'COVERAGE-REPORT.md'),
    join(ctx.paths.reports, 'TEST-LOGIC-ANALYSIS.md'),
    join(ctx.paths.analyses, 'TEST-QUALITY-REPORT.md'),
    join(ctx.paths.reports, 'TEST-QUALITY-LOGICAL-REPORT.md'),
    join(ctx.paths.reports, 'QUALITY-ANALYSIS-REPORT.md'),
    join(ctx.paths.reports, 'QUALITY-REPORT.md'), // ← Gerado pela tool report do MCP
    
    // === RELATÓRIOS CONSOLIDADOS EM TEST-PLAN.md ===
    join(ctx.paths.analyses, 'TEST-STRATEGY-RECOMMENDATION.md'),
    join(ctx.paths.reports, 'PLAN.md'),
    join(ctx.paths.reports, 'PYRAMID-REPORT.md'),
    join(ctx.paths.reports, 'PYRAMID-REPORT.html'),
    join(ctx.paths.reports, 'PYRAMID-REPORT.json'),
    join(ctx.paths.reports, 'PORTFOLIO-PLAN.md'),
    
    // === RELATÓRIOS DE SCAFFOLDING (gerados apenas se scaffold) ===
    join(ctx.paths.reports, 'INTEGRATION-TESTING-GUIDE.md'),
    join(ctx.paths.reports, 'UNIT-TESTING-GUIDE.md'),
    
    // === RELATÓRIOS DE EXECUÇÃO (mantidos) ===
    // DIFF-COVERAGE-REPORT.md e CONTRACTS-VERIFY.md são mantidos (não excluídos)
    
    // === RELATÓRIOS DE CATALOGAÇÃO ===
    join(ctx.paths.reports, 'SCENARIO-CATALOG.md'),
    join(ctx.paths.reports, 'RESPONSIBILITY-MATRIX.md'),
  ];
  
  let deleted = 0;
  for (const file of redundantFiles) {
    try {
      if (await fileExists(file)) {
        await fs.unlink(file);
        deleted++;
      }
    } catch (error) {
      // Ignora erros de deleção
    }
  }
  
  if (deleted > 0) {
    console.log(`   🗑️  ${deleted} relatório(s) redundante(s) removido(s)\n`);
  } else {
    console.log(`   ✓ Nenhum arquivo redundante encontrado\n`);
  }
}

/**
 * Phase 6: Scaffold (opcional)
 */
async function runScaffoldPhase(ctx: PipelineContext, skipScaffold: boolean): Promise<void> {
  if (!['full', 'scaffold'].includes(ctx.mode) || skipScaffold) {
    return;
  }
  
  console.log('🏗️  [6/11] Gerando scaffold de testes...');
  
  // Decidir tipo de scaffold baseado no contexto
  if (!ctx.context.hasTests) {
    // Se não tem testes, gera unit tests
    const scaffoldResult = await scaffoldUnitTests({
      repo: ctx.repoPath,
      product: ctx.product,
      files: [] // Auto-detecta arquivos
    });
    ctx.steps.push('scaffold-unit');
    ctx.outputs.scaffold = scaffoldResult.generated.join(', ');
    console.log(`✅ Testes unitários gerados: ${scaffoldResult.generated.length} arquivos\n`);
  } else {
    console.log(`ℹ️  Testes já existem, pulando scaffold\n`);
  }
}

/**
 * Phase 7-9: Test Execution & Validation
 */
async function runTestingPhase(ctx: PipelineContext, skipRun: boolean): Promise<void> {
  if (!['full', 'run'].includes(ctx.mode) || skipRun) {
    return;
  }
  
  if (!ctx.context.hasTests && !ctx.steps.includes('scaffold-unit')) {
    console.log(`⚠️  Nenhum teste encontrado, pulando execução\n`);
    return;
  }
  
  // 7. Run Tests with Coverage
  console.log('🧪 [7/9] Executando testes com cobertura...');
  try {
    const coverageResult = await runCoverageAnalysis({
      repo: ctx.repoPath,
      product: ctx.product
    });
    ctx.steps.push('coverage');
    ctx.outputs.coverage = coverageResult.reportPath;
    console.log(`✅ Testes executados com sucesso!\n`);
  } catch (error) {
    console.log(`⚠️  Erro ao executar testes: ${error instanceof Error ? error.message : error}\n`);
  }
  
  // 8. Validate Gates
  console.log('✅ [8/9] Validando gates de qualidade...');
  try {
    const validateResult = await validate({
      repo: ctx.repoPath,
      product: ctx.product,
      minBranch: 80,
      minMutation: 70
    });
    ctx.steps.push('validate');
    ctx.outputs.validate = validateResult.passed ? 'PASSED' : 'FAILED';
    console.log(`${validateResult.passed ? '✅' : '⚠️'} Gates de qualidade: ${validateResult.passed ? 'APROVADOS' : 'REPROVADOS'}\n`);
  } catch (error) {
    console.log(`⚠️  Erro ao validar gates: ${error instanceof Error ? error.message : error}\n`);
  }
  
  // 9. Dashboard HTML (mantido para visualização interativa)
  console.log('📊 [9/9] Gerando dashboard interativo...');
  try {
    const dashboardResult = await generateDashboard({
      repo: ctx.repoPath,
      product: ctx.product
    });
    ctx.steps.push('dashboard');
    ctx.outputs.dashboard = dashboardResult.dashboard_path;
    console.log(`✅ Dashboard gerado: ${dashboardResult.dashboard_path}\n`);
  } catch (error) {
    console.log(`⚠️  Erro ao gerar dashboard: ${error instanceof Error ? error.message : error}\n`);
  }
}

/**
 * Constrói resultado estruturado final com os 2 relatórios consolidados
 */
function buildFinalResult(ctx: PipelineContext, duration: number): AutoResult {
  const reports: string[] = [];
  const analyses: string[] = [];
  let dashboard: string | undefined;
  
  // 🆕 RELATÓRIOS CONSOLIDADOS (2 principais)
  if (ctx.outputs.codeAnalysisReport) reports.push(ctx.outputs.codeAnalysisReport);
  if (ctx.outputs.testPlanReport) reports.push(ctx.outputs.testPlanReport);
  
  // Coletar analyses intermediárias (JSON) para referência
  if (ctx.outputs.analyze) analyses.push(ctx.outputs.analyze);
  if (ctx.outputs.coverageAnalysis) analyses.push(ctx.outputs.coverageAnalysis);
  if (ctx.outputs.testLogicAnalysis) analyses.push(ctx.outputs.testLogicAnalysis);
  
  // Dashboard HTML (para visualização interativa)
  if (ctx.outputs.dashboard) dashboard = ctx.outputs.dashboard;
  
  // 🆕 Métricas de Quality Gates
  const mutation = ctx.metrics?.mutation_overall !== undefined ? {
    overall_score: ctx.metrics.mutation_overall,
    critical_score: ctx.metrics.mutation_critical || 0,
    passed: !!ctx.metrics.mutation_passed,
  } : undefined;
  
  const prod_metrics = ctx.metrics?.dora_tier ? {
    deployment_frequency: ctx.metrics.deployment_frequency || 0,
    mttr_minutes: ctx.metrics.mttr_minutes || 0,
    change_failure_rate: ctx.metrics.change_failure_rate || 0,
    dora_tier: String(ctx.metrics.dora_tier),
  } : undefined;
  
  const slo_canary = ctx.metrics?.slo_cujs_met !== undefined ? {
    cujs_met: ctx.metrics.slo_cujs_met,
    cujs_violated: ctx.metrics.slo_cujs_violated || 0,
    critical_violations: ctx.metrics.slo_critical_violations || 0,
  } : undefined;
  
  const quality_gate = ctx.metrics?.quality_gate_exit_code !== undefined ? {
    passed: !!ctx.metrics.quality_gate_passed,
    exit_code: ctx.metrics.quality_gate_exit_code,
    total_violations: ctx.metrics.quality_gate_total_violations || 0,
    blocking_violations: ctx.metrics.quality_gate_blocking_violations || 0,
  } : undefined;
  
  return {
    ok: true,
    outputs: {
      root: ctx.paths.root,
      reports,
      analyses,
      dashboard,
      tests: {
        unit: ctx.paths.unit,
        integration: ctx.paths.integration,
        e2e: ctx.paths.e2e
      },
      mutation,
      prod_metrics,
      slo_canary,
      quality_gate,
    },
    steps: ctx.steps,
    duration,
    context: ctx.context
  };
}

// ============================================================================
// MAIN ORCHESTRATOR
// ============================================================================

/**
 * [FASE 6] Orquestrador principal com retorno estruturado (REFATORADO)
 */
export async function autoQualityRun(options: AutoOptions = {}): Promise<AutoResult> {
  const startTime = Date.now();
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
  
  // Determinar produto final
  const product = options.product || context.product;
  
  // Carregar configurações
  const settings = await loadMCPSettings(repoPath, product);
  const paths = getPaths(repoPath, product, settings || undefined);
  
  // Criar contexto do pipeline
  const ctx: PipelineContext = {
    repoPath,
    product,
    mode,
    context,
    paths,
    steps: [],
    outputs: {},
    settings
  };
  
  try {
    // Executar fases do pipeline
    await runInitPhase(ctx);
    await runDiscoveryPhase(ctx);
    await runPortfolioPlanningPhase(ctx); // 🆕 FASE 2
    await runContractTestingPhase(ctx); // 🆕 FASE 3
    await runAnalysisPhase(ctx);
    await runCoverageAnalysisPhase(ctx);
    await runPlanningPhase(ctx);
    await runSuiteHealthPhase(ctx); // 🆕 FASE 7: Suite Health
    await runMutationTestingPhase(ctx); // 🆕 FASE 6: Mutation Testing
    await runProdMetricsPhase(ctx); // 🆕 FASE 8: Prod Metrics (DORA)
    await runSLOCanaryPhase(ctx); // 🆕 FASE 9: SLO Canary
    await runQualityGatesPhase(ctx); // 🆕 FASE 10: Quality Gates
    await runConsolidatedReporting(ctx); // 🆕 CONSOLIDATED REPORTS (2 arquivos principais)
    await runScaffoldPhase(ctx, options.skipScaffold || false);
    await runTestingPhase(ctx, options.skipRun || false);
    
    // Resumo final
    console.log('\n' + '='.repeat(60));
    console.log('✅ AUTO COMPLETO!');
    console.log('='.repeat(60));
    console.log(`\n📊 Passos executados: ${ctx.steps.join(' → ')}`);
    console.log(`\n📁 Arquivos gerados:`);
    Object.entries(ctx.outputs).forEach(([step, output]) => {
      console.log(`   ${step}: ${output}`);
    });
    console.log('\n' + '='.repeat(60) + '\n');
    
    // Construir resultado estruturado
    const duration = Date.now() - startTime;
    return buildFinalResult(ctx, duration);
    
  } catch (error) {
    console.error('\n❌ Erro durante execução AUTO:', error instanceof Error ? error.message : error);
    const duration = Date.now() - startTime;
    
    return {
      ok: false,
      outputs: {
        root: paths.root,
        reports: [],
        analyses: []
      },
      steps: ctx.steps,
      duration,
      context
    };
  }
}

/**
 * Executa modo específico com validações
 */
export async function runAutoMode(mode: AutoMode, options: Omit<AutoOptions, 'mode'> = {}): Promise<boolean> {
  const result = await autoQualityRun({ ...options, mode });
  return result.ok;
}
