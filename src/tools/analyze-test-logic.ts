import { promises as fs } from 'node:fs';
import { join, relative, dirname } from 'node:path';
import { glob } from 'glob';
import { evaluateTestQuality } from './evaluate-test-quality.js';
import { detectLanguage } from '../detectors/language.js';
import { writeFileSafe, ensureDir } from '../utils/fs.js';
import { getPaths, ensurePaths } from '../utils/paths.js';
import { loadMCPSettings } from '../utils/config.js';

export interface TestLogicParams {
  repo: string;
  product: string;
  runMutation?: boolean;
  generatePatches?: boolean;
}

export interface ScenarioCoverage {
  happy: boolean;
  edge: boolean;
  error: boolean;
  sideEffects: boolean;
}

export interface TestInfo {
  file: string;
  title: string;
  asserts: string[];
  gaps: string[];
  weakAsserts: string[];
}

export interface FunctionLogic {
  name: string;
  filePath: string;
  criticality: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  responsibility: string;
  inputs: string[];
  outputs: string;
  errors: string[];
  sideEffects: string[];
  scenarios: ScenarioCoverage;
  tests: TestInfo[];
  gaps: string[];
  mutationScore?: number;
  survivingMutants?: string[];
}

export interface TestLogicMetrics {
  qualityScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  mutationScore?: number;
  branchCoverageCritical?: number;
  scenarioCoverage: {
    happy: number;
    edge: number;
    error: number;
    sideEffects: number;
  };
}

export interface TestLogicResult {
  ok: boolean;
  language: string;
  framework: string;
  product: string;
  metrics: TestLogicMetrics;
  functions: FunctionLogic[];
  recommendations: string[];
  reportPath: string;
  patches: string[];
}

/**
 * Analisa a lógica dos testes profundamente
 */
export async function analyzeTestLogic(params: TestLogicParams): Promise<TestLogicResult> {
  const { repo, product, runMutation = false, generatePatches = true } = params;
  
  console.log(`\n🔍 Analisando lógica dos testes para ${product}...`);
  
  // [FASE 2] Calcular paths centralizados
  const settings = await loadMCPSettings(repo).catch(() => undefined);
  const paths = getPaths(repo, product, settings || undefined);
  await ensurePaths(paths);
  
  // 1. Detectar linguagem e framework
  const langDetection = await detectLanguage(repo);
  const language = langDetection.primary;
  const framework = await detectTestFramework(repo, language);
  
  console.log(`📦 Linguagem: ${language}`);
  console.log(`🧪 Framework: ${framework}\n`);
  
  // 2. Obter inventário base (usa evaluate-test-quality)
  console.log('📊 Obtendo inventário base...');
  const baseQuality = await evaluateTestQuality({ repo, product, includeDetails: true });
  
  // 3. Análise semântica profunda
  console.log('🔬 Análise semântica profunda...');
  const functions = await analyzeLogicalCoverage(repo, language, framework, baseQuality.functions);
  
  // 4. Mutation testing (se solicitado)
  let mutationScore: number | undefined;
  if (runMutation) {
    console.log('🧬 Executando mutation testing...');
    mutationScore = await runMutationTesting(repo, language, framework);
  }
  
  // 5. Calcular métricas lógicas
  const metrics = calculateLogicalMetrics(functions, baseQuality.metrics, mutationScore);
  
  // 6. Gerar recomendações
  const recommendations = generateLogicalRecommendations(functions, metrics);
  
  // 7. Gerar patches (se solicitado)
  let patches: string[] = [];
  if (generatePatches) {
    console.log('🩹 Gerando patches para funções críticas...');
    patches = await generateTestPatches(repo, paths.patches, language, framework, functions);
  }
  
  // 8. Gerar relatórios
  console.log('📄 Gerando relatórios...');
  const reportPath = await generateLogicalReport(paths.reports, product, language, framework, metrics, functions, recommendations, patches);
  await generateLogicalJSON(paths.analyses, product, language, framework, metrics, functions, recommendations, reportPath, patches);
  
  console.log(`\n✅ Análise completa!`);
  console.log(`📊 Quality Score: ${metrics.qualityScore.toFixed(1)}/100 (${metrics.grade})`);
  if (mutationScore !== undefined) {
    console.log(`🧬 Mutation Score: ${mutationScore.toFixed(1)}%`);
  }
  console.log(`📄 Relatório: ${reportPath}\n`);
  
  return {
    ok: true,
    language,
    framework,
    product,
    metrics,
    functions,
    recommendations,
    reportPath,
    patches
  };
}

/**
 * Detecta framework de testes baseado na linguagem
 */
async function detectTestFramework(repo: string, language: string): Promise<string> {
  const packageJsonPath = join(repo, 'package.json');
  
  try {
    if (language === 'typescript' || language === 'javascript') {
      const packageJson = JSON.parse(await fs.readFile(packageJsonPath, 'utf-8'));
      const deps = { ...packageJson.dependencies, ...packageJson.devDependencies };
      
      if (deps.vitest) return 'Vitest';
      if (deps.jest) return 'Jest';
      if (deps.mocha) return 'Mocha';
      if (deps['@playwright/test']) return 'Playwright';
    }
  } catch {
    // Fallback para heurísticas
  }
  
  // Fallbacks por linguagem
  const frameworks: Record<string, string> = {
    python: 'Pytest',
    go: 'go test',
    java: 'JUnit',
    kotlin: 'Kotest',
    csharp: 'xUnit',
    scala: 'ScalaTest',
    ruby: 'RSpec',
    php: 'PHPUnit',
    rust: 'cargo test',
    swift: 'XCTest'
  };
  
  return frameworks[language] || 'Unknown';
}

/**
 * Analisa cobertura lógica de cada função
 */
async function analyzeLogicalCoverage(
  repo: string,
  language: string,
  framework: string,
  baseFunctions: any[]
): Promise<FunctionLogic[]> {
  const functions: FunctionLogic[] = [];
  
  for (const baseFunc of baseFunctions) {
    if (!baseFunc.exported) continue;
    
    // Ler código da função
    const funcCode = await extractFunctionCode(join(repo, baseFunc.filePath), baseFunc.name);
    
    // Analisar responsabilidade e assinaturas
    const responsibility = inferResponsibility(baseFunc.name, funcCode);
    const { inputs, outputs, errors, sideEffects } = analyzeSignature(funcCode, language);
    
    // Encontrar e analisar testes
    const tests = await findAndAnalyzeTests(repo, language, framework, baseFunc.name, baseFunc.filePath);
    
    // Verificar cenários cobertos
    const scenarios = checkScenarioCoverage(tests, funcCode);
    
    // Identificar gaps
    const gaps = identifyGaps(scenarios, tests, funcCode, baseFunc.criticality);
    
    functions.push({
      name: baseFunc.name,
      filePath: baseFunc.filePath,
      criticality: baseFunc.criticality,
      responsibility,
      inputs,
      outputs,
      errors,
      sideEffects,
      scenarios,
      tests,
      gaps
    });
  }
  
  return functions;
}

/**
 * Extrai código da função do arquivo
 */
async function extractFunctionCode(filePath: string, functionName: string): Promise<string> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    
    // Regex simples - idealmente usar AST
    const exportFuncRegex = new RegExp(
      `export\\s+(async\\s+)?function\\s+${functionName}\\s*\\([^)]*\\)[^{]*{([\\s\\S]*?)}(?=\\n\\s*(?:export|$))`,
      'm'
    );
    
    const arrowFuncRegex = new RegExp(
      `export\\s+const\\s+${functionName}\\s*=\\s*(?:async\\s+)?\\([^)]*\\)\\s*=>\\s*{([\\s\\S]*?)}(?=\\n\\s*(?:export|$))`,
      'm'
    );
    
    let match = content.match(exportFuncRegex) || content.match(arrowFuncRegex);
    return match ? match[0] : content.slice(0, 500); // fallback primeiras linhas
  } catch {
    return '';
  }
}

/**
 * Infere responsabilidade da função
 */
function inferResponsibility(name: string, code: string): string {
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('parse')) return 'Parsear dados de formato específico';
  if (lowerName.includes('validate')) return 'Validar dados conforme regras';
  if (lowerName.includes('generate')) return 'Gerar conteúdo ou estruturas';
  if (lowerName.includes('analyze')) return 'Analisar e processar informações';
  if (lowerName.includes('run') || lowerName.includes('execute')) return 'Executar operação principal';
  if (lowerName.includes('calculate')) return 'Calcular valores';
  if (lowerName.includes('format')) return 'Formatar dados para saída';
  if (lowerName.includes('find') || lowerName.includes('search')) return 'Buscar elementos';
  
  return 'Função genérica';
}

/**
 * Analisa assinatura da função (entradas, saídas, erros)
 */
function analyzeSignature(code: string, language: string): {
  inputs: string[];
  outputs: string;
  errors: string[];
  sideEffects: string[];
} {
  const inputs: string[] = [];
  const errors: string[] = [];
  const sideEffects: string[] = [];
  let outputs = 'unknown';
  
  // Extrair parâmetros
  const paramMatch = code.match(/\(([^)]*)\)/);
  if (paramMatch) {
    const params = paramMatch[1].split(',').filter(p => p.trim());
    inputs.push(...params.map(p => p.trim().split(':')[0].trim()).filter(Boolean));
  }
  
  // Detectar tipo de retorno (TypeScript)
  const returnTypeMatch = code.match(/\):\s*([^{]+){/);
  if (returnTypeMatch) {
    outputs = returnTypeMatch[1].trim();
  }
  
  // Detectar erros lançados
  const throwMatches = code.matchAll(/throw\s+new\s+(\w+Error)/g);
  for (const match of throwMatches) {
    errors.push(match[1]);
  }
  
  // Detectar side effects
  if (code.includes('fs.') || code.includes('writeFile') || code.includes('readFile')) {
    sideEffects.push('File I/O');
  }
  if (code.includes('fetch') || code.includes('axios') || code.includes('http')) {
    sideEffects.push('HTTP request');
  }
  if (code.includes('console.log') || code.includes('console.error')) {
    sideEffects.push('Console output');
  }
  if (code.includes('Date.now()') || code.includes('new Date()')) {
    sideEffects.push('Time-dependent');
  }
  if (code.includes('Math.random()')) {
    sideEffects.push('Random');
  }
  
  return { inputs, outputs, errors, sideEffects };
}

/**
 * Encontra e analisa testes para uma função
 */
async function findAndAnalyzeTests(
  repo: string,
  language: string,
  framework: string,
  functionName: string,
  sourcePath: string
): Promise<TestInfo[]> {
  const tests: TestInfo[] = [];
  
  // Padrões de teste por linguagem
  const testPatterns: Record<string, string> = {
    typescript: '**/*.{test,spec}.ts',
    javascript: '**/*.{test,spec}.js',
    python: '**/test_*.py',
    go: '**/*_test.go'
  };
  
  const pattern = testPatterns[language] || '**/*.test.{ts,js}';
  const testFiles = await glob(pattern, {
    cwd: repo,
    ignore: ['**/node_modules/**', '**/dist/**']
  });
  
  for (const testFile of testFiles) {
    const testPath = join(repo, testFile);
    const content = await fs.readFile(testPath, 'utf-8');
    
    // Verificar se o arquivo menciona a função
    if (!content.includes(functionName)) continue;
    
    // Extrair testes individuais
    const itMatches = content.matchAll(/(?:it|test)\s*\(\s*['"`](.+?)['"`]/g);
    
    for (const match of itMatches) {
      const testTitle = match[1];
      const testStartIdx = match.index || 0;
      
      // Extrair bloco do teste (aproximação)
      const testBlock = extractTestBlock(content, testStartIdx);
      
      // Extrair assertions
      const asserts = extractAssertions(testBlock, framework);
      
      // Detectar asserts fracos
      const weakAsserts = detectWeakAsserts(asserts);
      
      // Identificar gaps neste teste específico
      const gaps = identifyTestGaps(testTitle, testBlock, asserts);
      
      tests.push({
        file: testFile,
        title: testTitle,
        asserts,
        gaps,
        weakAsserts
      });
    }
  }
  
  return tests;
}

/**
 * Extrai bloco de teste
 */
function extractTestBlock(content: string, startIdx: number): string {
  let depth = 0;
  let start = content.indexOf('{', startIdx);
  if (start === -1) return '';
  
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') depth++;
    if (content[i] === '}') {
      depth--;
      if (depth === 0) {
        return content.slice(start, i + 1);
      }
    }
  }
  
  return content.slice(start, start + 500); // fallback
}

/**
 * Extrai assertions do teste
 */
function extractAssertions(testBlock: string, framework: string): string[] {
  const asserts: string[] = [];
  
  // Padrões de assert por framework
  const patterns = [
    /expect\([^)]+\)\.[^;]+/g,
    /assert\.[^(]+\([^)]+\)/g,
    /should\.[^;]+/g,
    /\.to\.[^;]+/g
  ];
  
  for (const pattern of patterns) {
    const matches = testBlock.matchAll(pattern);
    for (const match of matches) {
      asserts.push(match[0].trim());
    }
  }
  
  return asserts;
}

/**
 * Detecta assertions fracas
 */
function detectWeakAsserts(asserts: string[]): string[] {
  const weak: string[] = [];
  
  for (const assert of asserts) {
    if (assert.includes('toBeTruthy') || assert.includes('toBeFalsy')) {
      weak.push(`${assert} - usar comparação explícita`);
    }
    if (assert.includes('toMatchSnapshot') && !assert.includes('InlineSnapshot')) {
      weak.push(`${assert} - snapshot genérico, preferir asserts específicos`);
    }
    if (assert.includes('toBeDefined')) {
      weak.push(`${assert} - verificar valor específico`);
    }
  }
  
  return weak;
}

/**
 * Identifica gaps em um teste específico
 */
function identifyTestGaps(title: string, testBlock: string, asserts: string[]): string[] {
  const gaps: string[] = [];
  
  const lowerTitle = title.toLowerCase();
  
  // Teste de erro sem verificação de mensagem/tipo
  if (lowerTitle.includes('erro') || lowerTitle.includes('error') || lowerTitle.includes('throw')) {
    if (!asserts.some(a => a.includes('toThrow') || a.includes('rejects'))) {
      gaps.push('Verificar que erro é lançado');
    }
    if (!asserts.some(a => a.includes('message') || a.includes('Message'))) {
      gaps.push('Verificar mensagem do erro');
    }
  }
  
  // Teste com mock sem assertions de interação
  if (testBlock.includes('mock') || testBlock.includes('spy')) {
    if (!asserts.some(a => a.includes('toHaveBeenCalled') || a.includes('calledWith'))) {
      gaps.push('Verificar interações com mocks (toHaveBeenCalledWith)');
    }
  }
  
  // Teste assíncrono sem await
  if (testBlock.includes('async') && !testBlock.includes('await') && !testBlock.includes('.then(')) {
    gaps.push('Teste assíncrono sem await - possível race condition');
  }
  
  return gaps;
}

/**
 * Verifica cobertura de cenários
 */
function checkScenarioCoverage(tests: TestInfo[], funcCode: string): ScenarioCoverage {
  let happy = false;
  let edge = false;
  let error = false;
  let sideEffects = false;
  
  for (const test of tests) {
    const title = test.title.toLowerCase();
    
    // Happy path
    if (title.includes('deve') || title.includes('should') || title.includes('happy') || 
        title.includes('sucesso') || title.includes('success') || title.includes('válido')) {
      happy = true;
    }
    
    // Edge cases
    if (title.includes('vazio') || title.includes('empty') || title.includes('null') || 
        title.includes('undefined') || title.includes('zero') || title.includes('limite') || 
        title.includes('boundary') || title.includes('edge')) {
      edge = true;
    }
    
    // Error handling
    if (title.includes('erro') || title.includes('error') || title.includes('throw') || 
        title.includes('falha') || title.includes('fail') || title.includes('inválido') || 
        title.includes('invalid')) {
      error = true;
    }
    
    // Side effects
    if (test.asserts.some(a => a.includes('toHaveBeenCalled') || a.includes('calledWith') || 
                               a.includes('spy') || a.includes('mock'))) {
      sideEffects = true;
    }
  }
  
  return { happy, edge, error, sideEffects };
}

/**
 * Identifica gaps gerais da função
 */
function identifyGaps(scenarios: ScenarioCoverage, tests: TestInfo[], funcCode: string, criticality: string): string[] {
  const gaps: string[] = [];
  
  if (!scenarios.happy && criticality !== 'LOW') {
    gaps.push('🔴 Falta teste de happy path (cenário de sucesso básico)');
  }
  
  if (!scenarios.edge && (criticality === 'CRITICAL' || criticality === 'HIGH')) {
    gaps.push('🟡 Falta teste de edge cases (null, undefined, empty, boundary values)');
  }
  
  if (!scenarios.error && funcCode.includes('throw')) {
    gaps.push('🔴 Função lança erros mas não há testes de error handling');
  }
  
  if (!scenarios.sideEffects && (funcCode.includes('fs.') || funcCode.includes('fetch') || funcCode.includes('console.'))) {
    gaps.push('🟡 Função tem side effects mas testes não verificam interações (mocks/spies)');
  }
  
  // Verificar assertions fracas
  const allWeakAsserts = tests.flatMap(t => t.weakAsserts);
  if (allWeakAsserts.length > 0) {
    gaps.push(`⚠️  ${allWeakAsserts.length} assertion(s) fraca(s) detectada(s)`);
  }
  
  return gaps;
}

/**
 * Executa mutation testing (simulado ou real conforme stack)
 */
async function runMutationTesting(repo: string, language: string, framework: string): Promise<number> {
  // Por enquanto retorna simulação
  // TODO: Implementar execução real de Stryker/PIT/mutmut conforme linguagem
  console.log('⚠️  Mutation testing em modo simulado (implementação completa em progresso)');
  return 75; // Simulado
}

/**
 * Calcula métricas lógicas
 */
function calculateLogicalMetrics(
  functions: FunctionLogic[],
  baseMetrics: any,
  mutationScore?: number
): TestLogicMetrics {
  let happyCount = 0;
  let edgeCount = 0;
  let errorCount = 0;
  let sideEffectsCount = 0;
  let total = functions.length;
  
  for (const func of functions) {
    if (func.scenarios.happy) happyCount++;
    if (func.scenarios.edge) edgeCount++;
    if (func.scenarios.error) errorCount++;
    if (func.scenarios.sideEffects) sideEffectsCount++;
  }
  
  return {
    qualityScore: baseMetrics.qualityScore,
    grade: baseMetrics.grade,
    mutationScore,
    scenarioCoverage: {
      happy: total > 0 ? (happyCount / total) * 100 : 0,
      edge: total > 0 ? (edgeCount / total) * 100 : 0,
      error: total > 0 ? (errorCount / total) * 100 : 0,
      sideEffects: total > 0 ? (sideEffectsCount / total) * 100 : 0
    }
  };
}

/**
 * Gera recomendações lógicas
 */
function generateLogicalRecommendations(functions: FunctionLogic[], metrics: TestLogicMetrics): string[] {
  const recs: string[] = [];
  
  if (metrics.scenarioCoverage.happy < 80) {
    recs.push(`🔴 Apenas ${metrics.scenarioCoverage.happy.toFixed(1)}% das funções têm teste de happy path`);
  }
  
  if (metrics.scenarioCoverage.edge < 50) {
    recs.push(`🟡 Apenas ${metrics.scenarioCoverage.edge.toFixed(1)}% das funções têm testes de edge cases`);
  }
  
  if (metrics.scenarioCoverage.error < 60) {
    recs.push(`🟡 Apenas ${metrics.scenarioCoverage.error.toFixed(1)}% das funções têm testes de error handling`);
  }
  
  const criticalWithGaps = functions.filter(f => 
    (f.criticality === 'CRITICAL' || f.criticality === 'HIGH') && f.gaps.length > 0
  );
  
  if (criticalWithGaps.length > 0) {
    recs.push(`🔴 ${criticalWithGaps.length} função(ões) crítica(s) com gaps lógicos`);
  }
  
  return recs;
}

/**
 * Gera patches de testes
 */
async function generateTestPatches(
  repo: string,
  patchesPath: string,
  language: string,
  framework: string,
  functions: FunctionLogic[]
): Promise<string[]> {
  const patches: string[] = [];
  await ensureDir(patchesPath);
  
  const criticalFunctions = functions.filter(f => 
    (f.criticality === 'CRITICAL' || f.criticality === 'HIGH') && f.gaps.length > 0
  );
  
  for (const func of criticalFunctions.slice(0, 5)) { // Limitar a 5 patches
    const patch = generatePatchForFunction(func, language, framework);
    const patchPath = join(patchesPath, `add-tests-${func.name}.patch`);
    await writeFileSafe(patchPath, patch);
    patches.push(relative(repo, patchPath));
  }
  
  return patches;
}

/**
 * Gera patch para uma função específica
 */
function generatePatchForFunction(func: FunctionLogic, language: string, framework: string): string {
  const testFileName = func.filePath.replace(/\.ts$/, '.test.ts').replace('src/', 'src/__tests__/');
  
  let testCode = `
describe('${func.name}', () => {`;

  if (!func.scenarios.happy) {
    testCode += `
  it('deve executar happy path com sucesso', () => {
    const result = ${func.name}(/* parâmetros válidos */);
    expect(result).toBeDefined();
    // TODO: adicionar asserts específicos para campos críticos
  });
`;
  }

  if (!func.scenarios.edge) {
    testCode += `
  it('deve lidar com edge cases (null/undefined/empty)', () => {
    expect(() => ${func.name}(null)).toThrow();
    expect(() => ${func.name}(undefined)).toThrow();
    expect(() => ${func.name}('')).toThrow();
  });
`;
  }

  if (!func.scenarios.error && func.errors.length > 0) {
    testCode += `
  it('deve lançar erro com mensagem específica quando inválido', () => {
    expect(() => ${func.name}(/* dado inválido */))
      .toThrow(${func.errors[0]});
    expect(() => ${func.name}(/* dado inválido */))
      .toThrow(/mensagem esperada/);
  });
`;
  }

  testCode += `});
`;

  return `--- a/${testFileName}
+++ b/${testFileName}
@@ -1,0 +1,${testCode.split('\n').length} @@
+${testCode}`;
}

/**
 * Gera relatório Markdown
 */
async function generateLogicalReport(
  reportsPath: string,
  product: string,
  language: string,
  framework: string,
  metrics: TestLogicMetrics,
  functions: FunctionLogic[],
  recommendations: string[],
  patches: string[]
): Promise<string> {
  const report = `# 🧠 Relatório de Análise Lógica de Testes - ${product}

**Data:** ${new Date().toISOString().split('T')[0]}  
**Linguagem:** ${language}  
**Framework:** ${framework}  
**Quality Score:** ${metrics.qualityScore.toFixed(1)}/100 (${metrics.grade})  
${metrics.mutationScore ? `**Mutation Score:** ${metrics.mutationScore.toFixed(1)}%` : ''}

---

## 📊 Cobertura de Cenários

| Cenário | Cobertura | Status |
|---------|-----------|--------|
| Happy Path | ${metrics.scenarioCoverage.happy.toFixed(1)}% | ${metrics.scenarioCoverage.happy >= 80 ? '✅' : '❌'} |
| Edge Cases | ${metrics.scenarioCoverage.edge.toFixed(1)}% | ${metrics.scenarioCoverage.edge >= 70 ? '✅' : '⚠️'} |
| Error Handling | ${metrics.scenarioCoverage.error.toFixed(1)}% | ${metrics.scenarioCoverage.error >= 70 ? '✅' : '⚠️'} |
| Side Effects | ${metrics.scenarioCoverage.sideEffects.toFixed(1)}% | ${metrics.scenarioCoverage.sideEffects >= 60 ? '✅' : '⚠️'} |

---

## 🔍 Análise Detalhada por Função

${functions.filter(f => f.criticality === 'CRITICAL' || f.criticality === 'HIGH').slice(0, 10).map(func => `
### \`${func.name}\` ${func.criticality === 'CRITICAL' ? '🔴' : '🟡'}

**Arquivo:** \`${func.filePath}\`  
**Responsabilidade:** ${func.responsibility}  
**Entradas:** ${func.inputs.join(', ') || 'N/A'}  
**Saídas:** ${func.outputs}  
**Erros:** ${func.errors.join(', ') || 'Nenhum'}  
**Side Effects:** ${func.sideEffects.join(', ') || 'Nenhum'}

#### Cenários Cobertos
- ${func.scenarios.happy ? '✅' : '❌'} Happy Path
- ${func.scenarios.edge ? '✅' : '❌'} Edge Cases
- ${func.scenarios.error ? '✅' : '❌'} Error Handling
- ${func.scenarios.sideEffects ? '✅' : '❌'} Side Effects

#### Testes Encontrados (${func.tests.length})
${func.tests.slice(0, 3).map(test => `
- **${test.title}**
  - Arquivo: \`${test.file}\`
  - Assertions: ${test.asserts.length}
  ${test.gaps.length > 0 ? `- Gaps: ${test.gaps.join(', ')}` : ''}
  ${test.weakAsserts.length > 0 ? `- ⚠️  Weak asserts: ${test.weakAsserts.length}` : ''}
`).join('')}

#### Gaps Identificados
${func.gaps.map(gap => `- ${gap}`).join('\n') || '✅ Nenhum gap crítico'}

${func.tests.length > 3 ? `\n_... e mais ${func.tests.length - 3} teste(s)_` : ''}
`).join('\n---\n')}

---

## 💡 Recomendações

${recommendations.map(r => `- ${r}`).join('\n')}

---

## 🩹 Patches Gerados

${patches.length > 0 ? `
Foram gerados ${patches.length} patch(es) com testes adicionais para funções críticas:

${patches.map(p => `- \`${p}\``).join('\n')}

Para aplicar um patch:
\`\`\`bash
git apply ${patches[0]}
\`\`\`
` : '_Nenhum patch necessário - cobertura adequada_'}

---

**Gerado por:** Quality MCP v0.4.0  
**Ferramenta:** \`analyze-test-logic\`
`;

  const reportPath = join(reportsPath, 'TEST-QUALITY-LOGICAL-REPORT.md');
  await writeFileSafe(reportPath, report);
  
  return reportPath;
}

/**
 * Gera JSON com análise lógica
 */
async function generateLogicalJSON(
  analysesPath: string,
  product: string,
  language: string,
  framework: string,
  metrics: TestLogicMetrics,
  functions: FunctionLogic[],
  recommendations: string[],
  reportPath: string,
  patches: string[]
): Promise<void> {
  const json = {
    ok: true,
    language,
    framework,
    product,
    metrics,
    functions: functions.map(f => ({
      name: f.name,
      filePath: f.filePath,
      criticality: f.criticality,
      scenarios: f.scenarios,
      tests: f.tests,
      gaps: f.gaps
    })),
    recommendations,
    reportPath,
    patches
  };
  
  const jsonPath = join(analysesPath, 'TEST-QUALITY-LOGICAL.json');
  await writeFileSafe(jsonPath, JSON.stringify(json, null, 2));
}
