/**
 * 🚀 Engine Pipeline - Orquestrador de Qualidade
 * 
 * Executa pipeline de análise de qualidade de forma modular e extensível.
 * Suporta múltiplas linguagens via adapters.
 * 
 * 🆕 Agora usa os adapters modernos de src/adapters/ via wrapper
 */

import type {
  LanguageAdapter,
  PipelineOptions,
  AggregatedResult,
  QualityReport,
  FunctionInfo,
  TestInfo,
  ScenarioMatrix,
  CoverageMetrics,
  MutationResult,
  MockInfo
} from './capabilities.js';
import { getAllEngineAdapters } from './adapter-to-engine.js';

/**
 * 🔍 Detecta linguagem do repositório
 */
export async function detectLanguage(repo: string, adapters: LanguageAdapter[]): Promise<LanguageAdapter | null> {
  for (const adapter of adapters) {
    const detected = await adapter.detect(repo);
    if (detected) {
      return adapter;
    }
  }
  return null;
}

/**
 * 🚀 Executa pipeline completo de análise
 * 
 * 🆕 Se adapters não for fornecido, usa adapters modernos automaticamente
 */
export async function runPipeline(
  options: PipelineOptions,
  adapters?: LanguageAdapter[]
): Promise<AggregatedResult> {
  // 🆕 Usa adapters modernos como padrão
  const adaptersList = adapters || getAllEngineAdapters();
  const startTime = Date.now();
  const started = new Date().toISOString();
  const stepsExecuted: string[] = [];
  const stepsSkipped: string[] = [];
  const errors: string[] = [];

  try {
    // 1. Detectar linguagem e adapter
    console.log('🔍 Detectando linguagem...');
    const adapter = options.language
      ? adaptersList.find(a => a.language === options.language)
      : await detectLanguage(options.repo, adaptersList);

    if (!adapter) {
      throw new Error(
        `Linguagem não detectada ou não suportada. Suportadas: ${adaptersList.map(a => a.language).join(', ')}`
      );
    }

    console.log(`✅ Linguagem detectada: ${adapter.language}`);

    // 2. Detectar framework de teste
    console.log('🔍 Detectando framework de teste...');
    const framework = await adapter.detectFramework(options.repo);
    if (!framework) {
      throw new Error(`Framework de teste não detectado para ${adapter.language}`);
    }
    console.log(`✅ Framework: ${framework}`);

    // 3. Inicializar relatório
    const report: QualityReport = {
      product: options.product,
      language: adapter.language,
      framework,
      timestamp: started,
      metrics: {
        qualityScore: 0,
        grade: 'F',
        coverage: { lines: 0, branches: 0, functions: 0, statements: 0, uncoveredLines: [] },
        branchCoverageCritical: 0,
        mutationScore: 0,
        scenarioMatrixCritical: 0,
      },
      functions: [],
      tests: [],
      gaps: [],
      warnings: {
        weakAssertions: [],
        mocks: [],
        uncoveredBranches: [],
      },
      recommendations: [],
      reportPath: '',
    };

    // 4. Executar capabilities na ordem
    const caps = adapter.capabilities;
    const profile = options.profile || 'local-dev';

    // 4.1 Descobrir funções
    if (caps.functions) {
      console.log('\n📦 Descobrindo funções...');
      const functions = await caps.functions(options.repo);
      report.functions = functions.map(f => ({ ...f, scenarios: {
        functionName: f.name,
        happy: false,
        error: false,
        edge: false,
        sideEffects: false,
        gaps: [],
      }}));
      console.log(`✅ ${functions.length} funções encontradas`);
      stepsExecuted.push('functions');
    } else {
      console.warn('⚠️  Capability "functions" não disponível');
      stepsSkipped.push('functions');
    }

    // 4.2 Descobrir testes
    if (caps.tests) {
      console.log('\n🧪 Descobrindo testes...');
      const functions = report.functions.map(f => ({
        name: f.name,
        filePath: f.filePath,
        startLine: f.startLine,
        endLine: f.endLine,
        params: f.params,
        isExported: f.isExported,
        isAsync: f.isAsync,
        complexity: f.complexity,
        criticality: f.criticality,
      }));
      const tests = await caps.tests(options.repo, functions);
      report.tests = tests;
      
      // Detectar assertions fracas
      for (const test of tests) {
        for (const assertion of test.assertions) {
          if (assertion.isWeak) {
            report.warnings.weakAssertions.push(
              `${test.filePath}: ${test.name} usa ${assertion.type} (linha ${assertion.line})`
            );
          }
        }
      }
      
      console.log(`✅ ${tests.length} testes encontrados`);
      console.log(`⚠️  ${report.warnings.weakAssertions.length} assertions fracas detectadas`);
      stepsExecuted.push('tests');
    } else {
      console.warn('⚠️  Capability "tests" não disponível');
      stepsSkipped.push('tests');
    }

    // 4.3 Validar cenários
    if (caps.cases) {
      console.log('\n🎯 Validando cenários de teste...');
      const functions = report.functions.map(f => ({
        name: f.name,
        filePath: f.filePath,
        startLine: f.startLine,
        endLine: f.endLine,
        params: f.params,
        isExported: f.isExported,
        isAsync: f.isAsync,
        complexity: f.complexity,
        criticality: f.criticality,
      }));
      const scenarios = await caps.cases(functions, report.tests);
      
      // Atualizar cenários nas funções
      for (const scenario of scenarios) {
        const fn = report.functions.find(f => f.name === scenario.functionName);
        if (fn) {
          fn.scenarios = scenario;
          report.gaps.push(...scenario.gaps);
        }
      }
      
      // Calcular score de cenários críticos
      const criticalFunctions = report.functions.filter(f => 
        f.criticality === 'CRITICAL' || f.criticality === 'HIGH'
      );
      
      if (criticalFunctions.length > 0) {
        const totalScenarios = criticalFunctions.length * 4; // happy, error, edge, side
        const coveredScenarios = criticalFunctions.reduce((sum, f) => {
          return sum + 
            (f.scenarios.happy ? 1 : 0) +
            (f.scenarios.error ? 1 : 0) +
            (f.scenarios.edge ? 1 : 0) +
            (f.scenarios.sideEffects ? 1 : 0);
        }, 0);
        
        report.metrics.scenarioMatrixCritical = (coveredScenarios / totalScenarios) * 100;
      }
      
      console.log(`✅ Cenários validados`);
      console.log(`📊 Cobertura de cenários críticos: ${report.metrics.scenarioMatrixCritical.toFixed(2)}%`);
      console.log(`⚠️  ${report.gaps.length} gaps encontrados`);
      stepsExecuted.push('cases');
    } else {
      console.warn('⚠️  Capability "cases" não disponível');
      stepsSkipped.push('cases');
    }

    // 4.4 Cobertura
    if (caps.coverage && profile !== 'ci-fast') {
      console.log('\n📈 Analisando cobertura...');
      const coverage = await caps.coverage(options.repo);
      report.metrics.coverage = coverage;
      report.metrics.branchCoverageCritical = coverage.branches;
      report.warnings.uncoveredBranches = coverage.uncoveredLines;
      console.log(`✅ Cobertura: ${coverage.lines.toFixed(2)}% linhas, ${coverage.branches.toFixed(2)}% branches`);
      stepsExecuted.push('coverage');
    } else {
      console.warn('⚠️  Capability "coverage" não disponível ou pulada (ci-fast)');
      stepsSkipped.push('coverage');
    }

    // 4.5 Mutation testing
    if (caps.mutation && !options.flags?.skipMutation && profile === 'ci-strict') {
      console.log('\n🧬 Executando mutation testing...');
      const mutation = await caps.mutation(options.repo);
      report.metrics.mutationScore = mutation.score;
      
      for (const survivor of mutation.survivors) {
        if (survivor.killingSuggestion) {
          report.recommendations.push(
            `Mutante sobrevivente em ${survivor.file}:${survivor.line} - ${survivor.killingSuggestion}`
          );
        }
      }
      
      console.log(`✅ Mutation Score: ${mutation.score.toFixed(2)}%`);
      console.log(`   Killed: ${mutation.killed}, Survived: ${mutation.survived}`);
      stepsExecuted.push('mutation');
    } else {
      console.warn('⚠️  Mutation testing pulado (apenas ci-strict)');
      stepsSkipped.push('mutation');
    }

    // 4.6 Análise de mocks
    if (caps.mocks && !options.flags?.skipMocks) {
      console.log('\n🎭 Analisando uso de mocks...');
      const mocks = await caps.mocks(report.tests);
      
      // Heurística: over-mocking
      // Teste mocka todos os deps mas função não varia comportamento
      const overMocked = mocks.filter(m => !m.hasAssertions);
      for (const mock of overMocked) {
        report.warnings.mocks.push(
          `Possível over-mocking: ${mock.filePath}:${mock.line} mocka ${mock.target} sem assertions específicas`
        );
      }
      
      console.log(`✅ ${mocks.length} mocks analisados`);
      console.log(`⚠️  ${overMocked.length} possíveis over-mocking`);
      stepsExecuted.push('mocks');
    } else {
      console.warn('⚠️  Análise de mocks pulada');
      stepsSkipped.push('mocks');
    }

    // 5. Calcular Quality Score
    const scoreComponents = [
      report.metrics.scenarioMatrixCritical * 0.4, // 40% peso
      report.metrics.branchCoverageCritical * 0.3,  // 30% peso
      report.metrics.mutationScore * 0.2,           // 20% peso
      (100 - (report.warnings.weakAssertions.length * 2)) * 0.1, // 10% peso (penaliza weak asserts)
    ];
    
    report.metrics.qualityScore = scoreComponents.reduce((sum, val) => sum + val, 0);
    
    // Determinar grade
    if (report.metrics.qualityScore >= 90) report.metrics.grade = 'A';
    else if (report.metrics.qualityScore >= 80) report.metrics.grade = 'B';
    else if (report.metrics.qualityScore >= 70) report.metrics.grade = 'C';
    else if (report.metrics.qualityScore >= 60) report.metrics.grade = 'D';
    else report.metrics.grade = 'F';

    // 6. Gerar relatório
    if (caps.report) {
      console.log('\n📄 Gerando relatório...');
      const reportPath = await caps.report(report);
      report.reportPath = reportPath;
      console.log(`✅ Relatório gerado: ${reportPath}`);
      stepsExecuted.push('report');
    }

    // 7. Validar schemas
    if (caps.schemas && !options.flags?.skipSchemas) {
      console.log('\n📜 Validando schemas...');
      const validation = await caps.schemas(report);
      if (!validation.valid) {
        errors.push(...validation.errors);
        console.error(`❌ Schema inválido: ${validation.errors.length} erros`);
      } else {
        console.log('✅ Schema válido');
      }
      stepsExecuted.push('schemas');
    }

    // 8. Resultado final
    const endTime = Date.now();
    const finished = new Date().toISOString();

    return {
      ok: errors.length === 0,
      language: adapter.language,
      framework,
      report,
      execution: {
        started,
        finished,
        duration: endTime - startTime,
        profile,
        stepsExecuted,
        stepsSkipped,
      },
      errors,
    };

  } catch (error: any) {
    const endTime = Date.now();
    const finished = new Date().toISOString();
    
    return {
      ok: false,
      language: options.language || 'unknown',
      framework: 'unknown',
      report: {} as QualityReport,
      execution: {
        started,
        finished,
        duration: endTime - startTime,
        profile: options.profile || 'local-dev',
        stepsExecuted,
        stepsSkipped,
      },
      errors: [error.message],
    };
  }
}

export default runPipeline;
