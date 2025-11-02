import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { glob } from 'glob';
import { detectLanguage } from '../detectors/language.js';
import { writeFileSafe } from '../utils/fs.js';

export interface TestQualityParams {
  repo: string;
  product: string;
  includeDetails?: boolean;
}

export interface FunctionAnalysis {
  name: string;
  filePath: string;
  exported: boolean;
  hasTests: boolean;
  testCount: number;
  coverage: number;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  category: 'parser' | 'validator' | 'util' | 'core' | 'other';
  recommendations: string[];
}

export interface TestQualityMetrics {
  // Cobertura de funções críticas
  criticalFunctionsCoverage: number;
  criticalFunctionsTotal: number;
  criticalFunctionsTested: number;
  
  // Análise de assertions
  avgAssertionsPerTest: number;
  testsWithoutAssertions: number;
  
  // Diversidade de testes
  hasUnitTests: boolean;
  hasIntegrationTests: boolean;
  hasE2ETests: boolean;
  hasEdgeCaseTests: boolean;
  hasErrorHandlingTests: boolean;
  
  // Qualidade estrutural
  testFileRatio: number; // source files / test files
  avgTestsPerSourceFile: number;
  
  // Padrões de código
  usesDescribeBlocks: boolean;
  usesBeforeAfterHooks: boolean;
  hasMocks: boolean;
  
  // Score geral
  qualityScore: number; // 0-100
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
}

export interface TestQualityResult {
  ok: boolean;
  product: string;
  metrics: TestQualityMetrics;
  functions: FunctionAnalysis[];
  untested: FunctionAnalysis[];
  critical: FunctionAnalysis[];
  recommendations: string[];
  reportPath: string;
}

/**
 * Avalia a qualidade dos testes de um repositório
 */
export async function evaluateTestQuality(params: TestQualityParams): Promise<TestQualityResult> {
  const { repo, product, includeDetails = true } = params;
  
  console.log(`\n🔍 Avaliando qualidade dos testes para ${product}...`);
  
  // Detectar linguagem
  const langDetection = await detectLanguage(repo);
  const language = langDetection.primary;
  console.log(`📦 Linguagem: ${language}`);
  console.log(`🧪 Framework: ${langDetection.framework}\n`);
  
  // Analisar funções no código fonte
  const functions = await analyzeFunctions(repo, language);
  console.log(`📊 Funções encontradas: ${functions.length}`);
  
  // Analisar testes
  const testAnalysis = await analyzeTests(repo, language);
  console.log(`✅ Arquivos de teste: ${testAnalysis.testFiles.length}`);
  
  // Cross-reference: quais funções têm testes?
  const functionsWithTests = await matchFunctionsWithTests(functions, testAnalysis);
  
  // Identificar funções não testadas
  const untested = functionsWithTests.filter(f => !f.hasTests);
  const critical = functionsWithTests.filter(f => 
    f.criticality === 'CRITICAL' || f.criticality === 'HIGH'
  );
  const criticalUntested = critical.filter(f => !f.hasTests);
  
  console.log(`❌ Funções sem testes: ${untested.length}`);
  console.log(`🔴 Funções críticas: ${critical.length}`);
  console.log(`⚠️  Funções críticas sem testes: ${criticalUntested.length}\n`);
  
  // Calcular métricas de qualidade
  const metrics = calculateQualityMetrics(functionsWithTests, testAnalysis);
  
  // Gerar recomendações
  const recommendations = generateRecommendations(metrics, functionsWithTests, testAnalysis);
  
  // Gerar relatório
  const reportPath = await generateQualityReport(
    repo,
    product,
    metrics,
    functionsWithTests,
    untested,
    critical,
    recommendations
  );
  
  console.log(`\n📊 Quality Score: ${metrics.qualityScore.toFixed(1)}/100 (${metrics.grade})`);
  console.log(`📄 Relatório: ${reportPath}\n`);
  
  return {
    ok: true,
    product,
    metrics,
    functions: includeDetails ? functionsWithTests : [],
    untested,
    critical,
    recommendations,
    reportPath
  };
}

/**
 * Analisa funções exportadas no código fonte
 */
async function analyzeFunctions(repo: string, language: string): Promise<FunctionAnalysis[]> {
  const functions: FunctionAnalysis[] = [];
  
  // Padrões de arquivo fonte por linguagem
  const sourcePatterns: Record<string, string> = {
    typescript: 'src/**/*.ts',
    javascript: 'src/**/*.js',
    python: '**/*.py',
    go: '**/*.go',
    java: 'src/**/*.java',
    ruby: 'lib/**/*.rb',
    csharp: '**/*.cs',
    php: 'src/**/*.php'
  };
  
  const pattern = sourcePatterns[language] || 'src/**/*.{ts,js}';
  const files = await glob(pattern, {
    cwd: repo,
    ignore: ['**/node_modules/**', '**/dist/**', '**/__tests__/**', '**/*.test.*', '**/*.spec.*']
  });
  
  for (const file of files) {
    const filePath = join(repo, file);
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Extrair funções exportadas
    const extractedFunctions = extractFunctions(content, language, file);
    functions.push(...extractedFunctions);
  }
  
  return functions;
}

/**
 * Extrai funções de um arquivo
 */
function extractFunctions(content: string, language: string, filePath: string): FunctionAnalysis[] {
  const functions: FunctionAnalysis[] = [];
  
  if (language === 'typescript' || language === 'javascript') {
    // Funções exportadas
    const exportRegex = /export\s+(async\s+)?function\s+(\w+)/g;
    let match;
    
    while ((match = exportRegex.exec(content)) !== null) {
      const functionName = match[2];
      const category = categorizeFunctionByName(functionName, content);
      const criticality = determineCriticality(functionName, category, content);
      
      functions.push({
        name: functionName,
        filePath,
        exported: true,
        hasTests: false,
        testCount: 0,
        coverage: 0,
        criticality,
        category,
        recommendations: []
      });
    }
    
    // Arrow functions exportadas
    const arrowRegex = /export\s+const\s+(\w+)\s*=\s*(async\s+)?\(/g;
    while ((match = arrowRegex.exec(content)) !== null) {
      const functionName = match[1];
      const category = categorizeFunctionByName(functionName, content);
      const criticality = determineCriticality(functionName, category, content);
      
      functions.push({
        name: functionName,
        filePath,
        exported: true,
        hasTests: false,
        testCount: 0,
        coverage: 0,
        criticality,
        category,
        recommendations: []
      });
    }
  }
  // TODO: Adicionar suporte para outras linguagens
  
  return functions;
}

/**
 * Categoriza função pelo nome e contexto
 */
function categorizeFunctionByName(name: string, content: string): FunctionAnalysis['category'] {
  const lowerName = name.toLowerCase();
  
  // Parsers
  if (lowerName.includes('parse') || lowerName.includes('decoder') || lowerName.includes('deserialize')) {
    return 'parser';
  }
  
  // Validators
  if (lowerName.includes('validate') || lowerName.includes('check') || lowerName.includes('verify') || lowerName.includes('assert')) {
    return 'validator';
  }
  
  // Core functions (analyze, generate, run, execute)
  if (lowerName.includes('analyze') || lowerName.includes('generate') || lowerName.includes('run') || 
      lowerName.includes('execute') || lowerName.includes('process')) {
    return 'core';
  }
  
  // Utils
  if (lowerName.includes('format') || lowerName.includes('convert') || lowerName.includes('map') ||
      lowerName.includes('filter') || lowerName.includes('transform')) {
    return 'util';
  }
  
  return 'other';
}

/**
 * Determina criticidade da função
 */
function determineCriticality(
  name: string, 
  category: FunctionAnalysis['category'],
  content: string
): FunctionAnalysis['criticality'] {
  // Parsers multi-linguagem são CRITICAL
  if (category === 'parser' && (
    name.includes('JaCoCo') || name.includes('Cobertura') || name.includes('Clover') ||
    name.includes('Go') || name.includes('SimpleCov') || name.includes('Pytest')
  )) {
    return 'CRITICAL';
  }
  
  // Funções core são HIGH
  if (category === 'core') {
    return 'HIGH';
  }
  
  // Validators são HIGH
  if (category === 'validator') {
    return 'HIGH';
  }
  
  // Parsers genéricos são MEDIUM
  if (category === 'parser') {
    return 'MEDIUM';
  }
  
  // Utils são LOW
  return 'LOW';
}

/**
 * Analisa arquivos de teste
 */
async function analyzeTests(repo: string, language: string) {
  const testPatterns: Record<string, string> = {
    typescript: '**/*.{test,spec}.ts',
    javascript: '**/*.{test,spec}.js',
    python: '**/test_*.py',
    go: '**/*_test.go',
    java: '**/src/test/**/*.java',
    ruby: '**/spec/**/*_spec.rb',
    csharp: '**/*.Tests.cs',
    php: '**/tests/**/*Test.php'
  };
  
  const pattern = testPatterns[language] || '**/*.{test,spec}.{ts,js}';
  const testFiles = await glob(pattern, {
    cwd: repo,
    ignore: ['**/node_modules/**', '**/dist/**']
  });
  
  let totalAssertions = 0;
  let totalTests = 0;
  let testsWithoutAssertions = 0;
  let hasDescribeBlocks = false;
  let hasBeforeAfter = false;
  let hasMocks = false;
  let hasEdgeCases = false;
  let hasErrorHandling = false;
  
  const functionTests = new Map<string, number>();
  
  for (const file of testFiles) {
    const filePath = join(repo, file);
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Contar testes
    const testMatches = content.match(/\b(it|test)\s*\(/g);
    const testCount = testMatches ? testMatches.length : 0;
    totalTests += testCount;
    
    // Contar assertions
    const assertMatches = content.match(/\b(expect|assert|should)\s*\(/g);
    const assertCount = assertMatches ? assertMatches.length : 0;
    totalAssertions += assertCount;
    
    if (testCount > 0 && assertCount === 0) {
      testsWithoutAssertions++;
    }
    
    // Padrões de qualidade
    if (content.includes('describe(')) hasDescribeBlocks = true;
    if (content.match(/\b(beforeEach|afterEach|beforeAll|afterAll)\s*\(/)) hasBeforeAfter = true;
    if (content.match(/\b(mock|spy|stub|vi\.mock|jest\.mock)\s*\(/)) hasMocks = true;
    if (content.match(/edge\s*case|boundary|empty|null|undefined|zero/i)) hasEdgeCases = true;
    if (content.match(/error|throw|reject|catch|fail/i)) hasErrorHandling = true;
    
    // Mapear testes por função
    const describeMatches = content.matchAll(/describe\s*\(\s*['"`](.+?)['"`]/g);
    for (const match of describeMatches) {
      const functionName = match[1];
      functionTests.set(functionName, (functionTests.get(functionName) || 0) + testCount);
    }
  }
  
  return {
    testFiles,
    totalTests,
    totalAssertions,
    testsWithoutAssertions,
    avgAssertionsPerTest: totalTests > 0 ? totalAssertions / totalTests : 0,
    hasDescribeBlocks,
    hasBeforeAfter,
    hasMocks,
    hasEdgeCases,
    hasErrorHandling,
    functionTests
  };
}

/**
 * Cruza funções com testes
 */
async function matchFunctionsWithTests(
  functions: FunctionAnalysis[],
  testAnalysis: Awaited<ReturnType<typeof analyzeTests>>
): Promise<FunctionAnalysis[]> {
  return functions.map(func => {
    const testCount = testAnalysis.functionTests.get(func.name) || 0;
    const hasTests = testCount > 0;
    
    // Gerar recomendações
    const recommendations: string[] = [];
    
    if (!hasTests) {
      if (func.criticality === 'CRITICAL') {
        recommendations.push(`🔴 URGENTE: Adicionar testes para ${func.name} (função CRÍTICA)`);
        recommendations.push(`   Testar: happy path, edge cases, error handling`);
      } else if (func.criticality === 'HIGH') {
        recommendations.push(`🟡 IMPORTANTE: Adicionar testes para ${func.name}`);
      } else {
        recommendations.push(`⚪ Considerar adicionar testes para ${func.name}`);
      }
    } else if (testCount < 3 && func.criticality === 'CRITICAL') {
      recommendations.push(`⚠️  ${func.name} tem apenas ${testCount} teste(s). Adicionar mais cenários.`);
    }
    
    return {
      ...func,
      hasTests,
      testCount,
      coverage: hasTests ? 100 : 0, // Simplificado, idealmente viria do coverage report
      recommendations
    };
  });
}

/**
 * Calcula métricas de qualidade
 */
function calculateQualityMetrics(
  functions: FunctionAnalysis[],
  testAnalysis: Awaited<ReturnType<typeof analyzeTests>>
): TestQualityMetrics {
  const criticalFunctions = functions.filter(f => f.criticality === 'CRITICAL' || f.criticality === 'HIGH');
  const criticalTested = criticalFunctions.filter(f => f.hasTests);
  
  const sourceFiles = new Set(functions.map(f => f.filePath)).size;
  const testFileRatio = sourceFiles > 0 ? testAnalysis.testFiles.length / sourceFiles : 0;
  const avgTestsPerSourceFile = sourceFiles > 0 ? testAnalysis.totalTests / sourceFiles : 0;
  
  // Calcular score (0-100)
  let score = 0;
  
  // 40 pontos: cobertura de funções críticas
  const criticalCoverage = criticalFunctions.length > 0 
    ? (criticalTested.length / criticalFunctions.length) * 100 
    : 100;
  score += (criticalCoverage / 100) * 40;
  
  // 20 pontos: diversidade de testes
  let diversity = 0;
  if (testAnalysis.hasEdgeCases) diversity += 5;
  if (testAnalysis.hasErrorHandling) diversity += 5;
  if (testAnalysis.hasMocks) diversity += 5;
  if (testAnalysis.avgAssertionsPerTest >= 2) diversity += 5;
  score += diversity;
  
  // 20 pontos: estrutura de testes
  let structure = 0;
  if (testAnalysis.hasDescribeBlocks) structure += 10;
  if (testAnalysis.hasBeforeAfter) structure += 5;
  if (testAnalysis.testsWithoutAssertions === 0) structure += 5;
  score += structure;
  
  // 20 pontos: ratio de testes
  if (testFileRatio >= 0.8) score += 20;
  else if (testFileRatio >= 0.5) score += 15;
  else if (testFileRatio >= 0.3) score += 10;
  else score += testFileRatio * 20;
  
  // Determinar grade
  let grade: TestQualityMetrics['grade'];
  if (score >= 90) grade = 'A';
  else if (score >= 80) grade = 'B';
  else if (score >= 70) grade = 'C';
  else if (score >= 60) grade = 'D';
  else grade = 'F';
  
  return {
    criticalFunctionsCoverage: criticalCoverage,
    criticalFunctionsTotal: criticalFunctions.length,
    criticalFunctionsTested: criticalTested.length,
    avgAssertionsPerTest: testAnalysis.avgAssertionsPerTest,
    testsWithoutAssertions: testAnalysis.testsWithoutAssertions,
    hasUnitTests: testAnalysis.testFiles.some(f => f.includes('unit') || f.includes('.test.')),
    hasIntegrationTests: testAnalysis.testFiles.some(f => f.includes('integration')),
    hasE2ETests: testAnalysis.testFiles.some(f => f.includes('e2e')),
    hasEdgeCaseTests: testAnalysis.hasEdgeCases,
    hasErrorHandlingTests: testAnalysis.hasErrorHandling,
    testFileRatio,
    avgTestsPerSourceFile,
    usesDescribeBlocks: testAnalysis.hasDescribeBlocks,
    usesBeforeAfterHooks: testAnalysis.hasBeforeAfter,
    hasMocks: testAnalysis.hasMocks,
    qualityScore: score,
    grade
  };
}

/**
 * Gera recomendações baseadas nas métricas
 */
function generateRecommendations(
  metrics: TestQualityMetrics,
  functions: FunctionAnalysis[],
  testAnalysis: Awaited<ReturnType<typeof analyzeTests>>
): string[] {
  const recommendations: string[] = [];
  
  // Funções críticas
  if (metrics.criticalFunctionsCoverage < 100) {
    const missing = metrics.criticalFunctionsTotal - metrics.criticalFunctionsTested;
    recommendations.push(
      `🔴 CRÍTICO: ${missing} função(ões) crítica(s) sem testes (${metrics.criticalFunctionsCoverage.toFixed(1)}% cobertura)`
    );
  }
  
  // Assertions
  if (metrics.avgAssertionsPerTest < 2) {
    recommendations.push(
      `⚠️  Testes com poucas assertions (média: ${metrics.avgAssertionsPerTest.toFixed(1)}). Recomendado: 2-5 por teste.`
    );
  }
  
  if (metrics.testsWithoutAssertions > 0) {
    recommendations.push(
      `❌ ${metrics.testsWithoutAssertions} teste(s) sem assertions. Adicionar expect() ou assert().`
    );
  }
  
  // Estrutura
  if (!metrics.usesDescribeBlocks) {
    recommendations.push(
      `📋 Usar describe() blocks para organizar testes por funcionalidade.`
    );
  }
  
  if (!metrics.hasEdgeCaseTests) {
    recommendations.push(
      `🔍 Adicionar testes de edge cases (null, undefined, empty, boundary values).`
    );
  }
  
  if (!metrics.hasErrorHandlingTests) {
    recommendations.push(
      `💥 Adicionar testes de error handling (try/catch, rejects, throws).`
    );
  }
  
  // Ratio
  if (metrics.testFileRatio < 0.5) {
    recommendations.push(
      `📁 Ratio de arquivos de teste baixo (${(metrics.testFileRatio * 100).toFixed(1)}%). Meta: 80%+`
    );
  }
  
  // Grade
  if (metrics.grade === 'F' || metrics.grade === 'D') {
    recommendations.push(
      `🆘 AÇÃO URGENTE: Quality Score muito baixo (${metrics.qualityScore.toFixed(1)}/100). Priorizar testes CRÍTICOS.`
    );
  }
  
  return recommendations;
}

/**
 * Gera relatório de qualidade
 */
async function generateQualityReport(
  repo: string,
  product: string,
  metrics: TestQualityMetrics,
  functions: FunctionAnalysis[],
  untested: FunctionAnalysis[],
  critical: FunctionAnalysis[],
  recommendations: string[]
): Promise<string> {
  const gradeEmoji: Record<string, string> = {
    A: '🏆',
    B: '✅',
    C: '⚠️',
    D: '❌',
    F: '🆘'
  };
  
  const report = `# 🎯 Relatório de Qualidade de Testes - ${product}

**Data:** ${new Date().toISOString().split('T')[0]}  
**Quality Score:** ${metrics.qualityScore.toFixed(1)}/100  
**Grade:** ${gradeEmoji[metrics.grade]} **${metrics.grade}**

---

## 📊 Métricas Gerais

### Cobertura de Funções Críticas
- **Total de funções críticas:** ${metrics.criticalFunctionsTotal}
- **Funções testadas:** ${metrics.criticalFunctionsTested} (${metrics.criticalFunctionsCoverage.toFixed(1)}%)
- **Funções sem testes:** ${metrics.criticalFunctionsTotal - metrics.criticalFunctionsTested}

### Qualidade das Assertions
- **Média de assertions por teste:** ${metrics.avgAssertionsPerTest.toFixed(2)}
- **Testes sem assertions:** ${metrics.testsWithoutAssertions}

### Diversidade de Testes
- ✅ Testes unitários: ${metrics.hasUnitTests ? 'Sim' : 'Não'}
- ✅ Testes de integração: ${metrics.hasIntegrationTests ? 'Sim' : 'Não'}
- ✅ Testes E2E: ${metrics.hasE2ETests ? 'Sim' : 'Não'}
- ✅ Edge cases: ${metrics.hasEdgeCaseTests ? 'Sim' : 'Não'}
- ✅ Error handling: ${metrics.hasErrorHandlingTests ? 'Sim' : 'Não'}

### Estrutura de Código
- **Ratio de arquivos de teste:** ${(metrics.testFileRatio * 100).toFixed(1)}%
- **Média de testes por arquivo:** ${metrics.avgTestsPerSourceFile.toFixed(1)}
- **Usa describe() blocks:** ${metrics.usesDescribeBlocks ? 'Sim' : 'Não'}
- **Usa hooks (beforeEach/afterEach):** ${metrics.usesBeforeAfterHooks ? 'Sim' : 'Não'}
- **Usa mocks/spies:** ${metrics.hasMocks ? 'Sim' : 'Não'}

---

## 🔴 Funções Críticas Sem Testes (${critical.filter(f => !f.hasTests).length})

${critical.filter(f => !f.hasTests).map(f => `
### \`${f.name}\`
- **Arquivo:** \`${f.filePath}\`
- **Categoria:** ${f.category}
- **Criticidade:** ${f.criticality}
- **Recomendações:**
${f.recommendations.map(r => `  - ${r}`).join('\n')}
`).join('\n') || '_Todas as funções críticas estão testadas! 🎉_'}

---

## ⚠️  Todas as Funções Sem Testes (${untested.length})

${untested.slice(0, 20).map(f => 
  `- \`${f.name}\` (${f.filePath}) - ${f.criticality}`
).join('\n')}

${untested.length > 20 ? `\n_... e mais ${untested.length - 20} funções_` : ''}

---

## 💡 Recomendações

${recommendations.map(r => `- ${r}`).join('\n')}

---

## 📈 Breakdown por Categoria

${['CRITICAL', 'HIGH', 'MEDIUM', 'LOW'].map(criticality => {
  const funcs = functions.filter(f => f.criticality === criticality);
  const tested = funcs.filter(f => f.hasTests).length;
  const pct = funcs.length > 0 ? (tested / funcs.length * 100).toFixed(1) : '0.0';
  
  return `### ${criticality}
- Total: ${funcs.length}
- Testadas: ${tested} (${pct}%)
- Sem testes: ${funcs.length - tested}`;
}).join('\n\n')}

---

## 🎯 Próximos Passos

1. **Priorizar funções CRITICAL sem testes**
2. **Adicionar edge cases e error handling**
3. **Aumentar assertions por teste (meta: 2-5)**
4. **Melhorar ratio de arquivos de teste (meta: 80%+)**
5. **Atingir Quality Score A (90+)**

---

**Gerado por:** Quality MCP v0.4.0  
**Ferramenta:** \`evaluate-test-quality\`
`;

  const reportPath = join(repo, 'tests/analyses/TEST-QUALITY-REPORT.md');
  await writeFileSafe(reportPath, report);
  
  return reportPath;
}
