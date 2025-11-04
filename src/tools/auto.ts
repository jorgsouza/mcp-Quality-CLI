/**
 * auto.ts - Orchestrador "One-Shot" COMPLETO para análise de qualidade
 * 
 * FLUXO MÁGICO:
 * 1. Self-check: Valida ambiente (Node, vitest, git, permissões)
 * 2. [FASE 1] CUJ/SLO/Risk Discovery: Cataloga journeys críticos
 * 3. [FASE 2] Portfolio Planning: Redesenha pirâmide de testes
 * 4. [FASE 3] Contract Testing: Gera e verifica contratos Pact (CDC)
 * 5. Analyze: Analisa código e detecta funções/endpoints/eventos
 * 6. Coverage Analysis: Roda testes e analisa cobertura
 * 7. Test Strategy: Recomenda estratégia (pirâmide de testes)
 * 8. Plan: Gera plano de testes baseado em riscos
 * 9. Scaffold (opcional): Gera estrutura de testes faltantes
 * 10. Run Tests: Executa testes com coverage completo
 * 11. Pyramid Report: Gera relatório da pirâmide de testes
 * 12. Dashboard: Gera dashboard.html visual interativo
 * 13. Validate: Valida gates de qualidade (coverage, mutation, scenarios)
 * 14. Final Report: Consolida TUDO em um relatório executivo
 * 
 * Modos disponíveis:
 * - full: Análise completa (TODAS as etapas) ← RECOMENDADO
 * - analyze: Apenas análise do código (etapas 1-7)
 * - plan: Análise + geração de plano (etapas 1-8)
 * - scaffold: Análise + plano + scaffold de testes (etapas 1-9)
 * - run: Executa testes existentes + coverage (etapas 1-2, 10-14)
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
import { getPaths, type QAPaths } from '../utils/paths.js';

// [QUALITY GATES] FASE 1: CUJ/SLO/Risk Discovery
import { catalogCUJs } from './catalog-cujs.js';
import { defineSLOs } from './define-slos.js';
import { riskRegister } from './risk-register.js';

// [QUALITY GATES] FASE 2: Portfolio Planning
// TODO: Implementar portfolio-plan.ts
// import { portfolioPlan } from './portfolio-plan.js';

// [QUALITY GATES] FASE 3: CDC/Pact Contract Testing
import { scaffoldContractsPact } from './scaffold-contracts-pact.js';
import { runContractsVerify } from './run-contracts-verify.js';

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
  metrics?: Record<string, number>; // 🆕 Métricas adicionais (contracts, etc)
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
  console.log('  ⏭️  Pulando: feature em desenvolvimento (portfolio-plan.ts)\n');
  
  // TODO: Descomentar quando implementado
  // try {
  //   const portfolioResult = await portfolioPlan({
  //     repo: ctx.repoPath,
  //     product: ctx.product,
  //   });
  //   ctx.steps.push('portfolio-plan');
  //   ctx.outputs.portfolioPlan = portfolioResult.output;
  //   console.log(`  ✅ Portfolio plan gerado\n`);
  // } catch (error) {
  //   console.log(`⚠️  Erro: ${error instanceof Error ? error.message : error}\n`);
  // }
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
 * Phase 2: Code Analysis
 */
async function runAnalysisPhase(ctx: PipelineContext): Promise<void> {
  if (!['full', 'analyze', 'plan', 'scaffold'].includes(ctx.mode)) {
    return;
  }
  
  // 1. Analyze (código)
  console.log('🔍 [1/11] Analisando repositório...');
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
}

/**
 * Phase 4: Test Strategy & Planning
 */
async function runPlanningPhase(ctx: PipelineContext): Promise<void> {
  if (!['full', 'plan', 'scaffold'].includes(ctx.mode)) {
    return;
  }
  
  // 3. Recommend Strategy
  console.log('🎯 [3/11] Gerando recomendação de estratégia...');
  try {
    const recommendResult = await recommendTestStrategy({
      repo: ctx.repoPath,
      product: ctx.product
    });
    ctx.steps.push('recommend-strategy');
    ctx.outputs.recommendStrategy = 'tests/analyses/TEST-STRATEGY-RECOMMENDATION.md';
    console.log(`✅ Recomendação gerada!\n`);
    console.log(recommendResult.summary);
  } catch (error) {
    console.log(`⚠️  Erro na recomendação: ${error instanceof Error ? error.message : error}\n`);
  }
  
  // 4. Generate Plan
  console.log('📋 [4/11] Gerando plano de testes...');
  const planResult = await generatePlan({
    repo: ctx.repoPath,
    product: ctx.product
  });
  ctx.steps.push('plan');
  ctx.outputs.plan = planResult.plan;
  console.log(`✅ Plano gerado: ${planResult.plan}\n`);
}

/**
 * Phase 5: Scaffold (opcional)
 */
async function runScaffoldPhase(ctx: PipelineContext, skipScaffold: boolean): Promise<void> {
  if (!['full', 'scaffold'].includes(ctx.mode) || skipScaffold) {
    return;
  }
  
  console.log('🏗️  [5/11] Gerando scaffold de testes...');
  
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
 * Phase 6-11: Test Execution & Reporting
 */
async function runTestingPhase(ctx: PipelineContext, skipRun: boolean): Promise<void> {
  if (!['full', 'run'].includes(ctx.mode) || skipRun) {
    return;
  }
  
  if (!ctx.context.hasTests && !ctx.steps.includes('scaffold-unit')) {
    console.log(`⚠️  Nenhum teste encontrado, pulando execução\n`);
    return;
  }
  
  // 6. Run Tests with Coverage
  console.log('🧪 [6/11] Executando testes com cobertura...');
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
  
  // 7. Pyramid Report
  console.log('📊 [7/11] Gerando relatório da pirâmide de testes...');
  try {
    const pyramidResult = await generatePyramidReport({
      repo: ctx.repoPath,
      product: ctx.product
    });
    ctx.steps.push('pyramid-report');
    ctx.outputs.pyramidReport = pyramidResult.report_path;
    console.log(`✅ Relatório da pirâmide gerado: ${pyramidResult.report_path}\n`);
  } catch (error) {
    console.log(`⚠️  Erro ao gerar pirâmide: ${error instanceof Error ? error.message : error}\n`);
  }
  
  // 8. Dashboard HTML
  console.log('📊 [8/11] Gerando dashboard da pirâmide de testes...');
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
  
  // 9. Validate Gates
  console.log('✅ [9/11] Validando gates de qualidade...');
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
  
  // 10. Final Consolidated Report
  console.log('📄 [10/11] Gerando relatório consolidado final...');
  try {
    const reportResult = await buildReport({
      in_dir: ctx.paths.analyses,
      out_file: 'QUALITY-ANALYSIS-REPORT.md'
    });
    ctx.steps.push('final-report');
    ctx.outputs.finalReport = reportResult.out;
    console.log(`✅ Relatório consolidado gerado: ${reportResult.out}\n`);
  } catch (error) {
    console.log(`⚠️  Erro ao gerar relatório consolidado: ${error instanceof Error ? error.message : error}\n`);
  }

  // 11. Export to tests/qa
  console.log('📦 [11/11] Exportando relatórios para tests/qa...');
  try {
    const copied = await exportReportsToQA(ctx.repoPath);
    ctx.steps.push('export-qa');
    ctx.outputs.qa = `tests/qa (${copied.length} arquivos)`;
    console.log(`✅ Relatórios copiados para tests/qa: ${copied.length} arquivo(s)\n`);
  } catch (error) {
    console.log(`⚠️  Erro ao exportar relatórios para tests/qa: ${error instanceof Error ? error.message : error}\n`);
  }
}

/**
 * Copia os principais artefatos gerados em tests/analyses para tests/qa
 */
async function exportReportsToQA(repoPath: string): Promise<string[]> {
  const qaDir = join(repoPath, 'tests', 'qa');
  await fs.mkdir(qaDir, { recursive: true });

  const sources = [
    ['tests/analyses/TEST-PLAN.md', 'TEST-PLAN.md'],
    ['tests/analyses/TEST-STRATEGY-RECOMMENDATION.md', 'TEST-STRATEGY-RECOMMENDATION.md'],
    ['tests/analyses/COVERAGE-ANALYSIS.md', 'COVERAGE-ANALYSIS.md'],
    ['tests/analyses/PYRAMID-REPORT.md', 'PYRAMID-REPORT.md'],
    ['tests/analyses/dashboard.html', 'dashboard.html'],
    ['tests/analyses/coverage-analysis.json', 'coverage-analysis.json'],
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

/**
 * Constrói resultado estruturado final
 */
function buildFinalResult(ctx: PipelineContext, duration: number): AutoResult {
  const reports: string[] = [];
  const analyses: string[] = [];
  let dashboard: string | undefined;
  
  // Coletar reports gerados
  if (ctx.outputs.plan) reports.push(ctx.outputs.plan);
  if (ctx.outputs.pyramidReport) reports.push(ctx.outputs.pyramidReport);
  if (ctx.outputs.diffCoverage) reports.push(ctx.outputs.diffCoverage);
  if (ctx.outputs.finalReport) reports.push(ctx.outputs.finalReport);
  if (ctx.outputs.testQuality) reports.push(ctx.outputs.testQuality);
  
  // Coletar analyses geradas
  if (ctx.outputs.analyze) analyses.push(ctx.outputs.analyze);
  if (ctx.outputs.coverageAnalysis) analyses.push(ctx.outputs.coverageAnalysis);
  if (ctx.outputs.testLogicAnalysis) analyses.push(ctx.outputs.testLogicAnalysis);
  if (ctx.outputs.recommendStrategy) analyses.push(ctx.outputs.recommendStrategy);
  
  // Dashboard
  if (ctx.outputs.dashboard) dashboard = ctx.outputs.dashboard;
  
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
      }
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
