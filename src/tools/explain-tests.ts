/**
 * explain-tests.ts - Análise AST de Testes para KR3a e DORA
 * 
 * Objetivo de negócio:
 * - KR3a: Manter confiabilidade das entregas (máximo 10% falhas, nunca >15%)
 * - DORA: Reduzir CFR e MTTR, sem prejudicar DF e LTC
 * 
 * Como ajuda:
 * - Reforça assertividade e contratos nos arquivos do diff por PR
 * - Eleva diff coverage
 * - Documenta propósito do teste
 * - Reduz probabilidade de rollback/incidentes (CFR↓)
 * - Melhora diagnóstico (MTTR↓)
 * 
 * Pipeline:
 * 1. Descoberta & AST (TS/JS): Mapear casos (describe/it/test), extrair Given/When/Then
 * 2. Cobertura & Diff (PR-aware): Associar teste a arquivos/linhas, calcular coveredInDiff%
 * 3. Contratos (Pact): Relacionar interação e status
 * 4. Força da Asserção (assertStrength): Forte/Média/Fraca
 * 5. Propósito ("para quê?"): Ligar a risco/CUJ/SLO
 * 6. Smells & Sugestões: Marcar problemas, sugerir melhorias
 * 
 * Saídas:
 * - test-explanations.json (detalhado por teste)
 * - TEST-EXPLANATIONS.md (humano)
 * - TEST-QUALITY-SUMMARY.md (KR/DORA)
 * - test-quality-metrics.json (dashboard)
 */

import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { getPaths } from '../utils/paths.js';
import { fileExists, writeFileSafe } from '../utils/fs.js';

// ============================================================================
// INTERFACES
// ============================================================================

export interface ExplainTestsOptions {
  repo: string;
  product: string;
  format?: 'md' | 'json';
  outDir?: string;
  baseBranch?: string;
  minDiffCoverage?: number;
  minAsserts?: number;
  failOn?: 'weak' | 'none';
}

export interface CodeSmell {
  type: 'no-asserts' | 'excessive-mocks' | 'missing-error-handling' | 'too-long';
  description: string;
  severity: 'critical' | 'high' | 'medium' | 'low';
  impact: string;
  howToFix: {
    before: string;
    after: string;
    explanation: string;
  };
}

export interface TestExplanation {
  file: string;
  name: string;
  testType: 'unit' | 'integration' | 'e2e' | 'unknown'; // 🆕 Tipo do teste
  functionUnderTest?: string;
  whatItTests: string; // 🆕 O que está testando (mais descritivo)
  whyItTests: string; // 🆕 Por que está testando (justificativa técnica)
  purposeForWhat: string; // 🆕 Para que está testando (objetivo de negócio)
  given: string[];
  when: string;
  then: AssertInfo[];
  mocks: string[];
  coverage: {
    files: string[];
    linesCovered: number;
    linesTotal: number;
    coveredInDiffPct: number;
  };
  contracts: {
    pact: boolean;
    failed: number;
    interactions: number;
  };
  risk?: {
    cuj?: string;
    level?: 'baixo' | 'médio' | 'alto';
    slo?: string;
  };
  assertStrength: 'forte' | 'médio' | 'fraco';
  smells: CodeSmell[]; // 🆕 Agora com exemplos de correção!
  suggestions: string[];
}

export interface AssertInfo {
  type: string; // 'status' | 'body.prop' | 'header' | 'called' | 'generic'
  value?: any;
  path?: string;
  matcher?: string;
}

export interface TestQualityMetrics {
  assertStrongPct: number;
  assertMediumPct: number;
  assertWeakPct: number;
  diffCoveredPct: number;
  contractsProtectedPct: number;
  weakTestsInDiffPct: number;
  criticalEndpointsWithoutContract: number;
  suspectedFlakyPct: number;
  diagnosticAssertsPct: number;
  totalTests: number;
  testsWithAsserts: number;
  testsWithoutAsserts: number;
}

export interface ExplainTestsResult {
  ok: boolean;
  explanations: TestExplanation[];
  metrics: TestQualityMetrics;
  kr3aStatus: 'OK' | 'ATENÇÃO' | 'ALERTA';
  outputPaths: {
    explanationsJson: string;
    explanationsMd: string;
    qualitySummaryMd: string;
    metricsJson: string;
  };
  message?: string;
}

// ============================================================================
// MAIN ENTRY POINT
// ============================================================================

export async function explainTests(options: ExplainTestsOptions): Promise<ExplainTestsResult> {
  const {
    repo,
    product,
    format = 'md',
    baseBranch = 'main',
    minDiffCoverage = 80,
    minAsserts = 1,
    failOn = 'none',
  } = options;

  console.log('🔍 Explicando testes via AST + Coverage + Contracts...\n');
  console.log(`📁 Repo: ${repo}`);
  console.log(`📦 Product: ${product}`);
  console.log(`🌿 Base Branch: ${baseBranch}`);
  console.log(`📊 Min Diff Coverage: ${minDiffCoverage}%`);
  console.log(`🎯 Fail On: ${failOn}\n`);

  const paths = getPaths(repo, product);

  try {
    // 1. Descobrir arquivos de teste
    console.log('📂 [1/6] Descobrindo arquivos de teste...');
    const testFiles = await discoverTestFiles(repo);
    console.log(`✅ ${testFiles.length} arquivos de teste encontrados\n`);

    // 2. Analisar cada teste (AST + assertStrength)
    console.log('🔬 [2/6] Analisando AST e asserts...');
    const explanations: TestExplanation[] = [];
    for (const testFile of testFiles) {
      const fileExplanations = await analyzeTestFile(testFile, repo);
      explanations.push(...fileExplanations);
    }
    console.log(`✅ ${explanations.length} testes analisados\n`);

    // 3. Associar coverage + diff
    console.log('📊 [3/6] Associando coverage e diff...');
    await enrichWithCoverage(explanations, repo, product, baseBranch);
    console.log(`✅ Coverage associado\n`);

    // 4. Associar contracts (Pact)
    console.log('🤝 [4/6] Associando contratos CDC/Pact...');
    await enrichWithContracts(explanations, paths);
    console.log(`✅ Contracts associados\n`);

    // 5. Associar riscos/CUJs
    console.log('🎯 [5/6] Associando riscos e CUJs...');
    await enrichWithRisks(explanations, paths);
    console.log(`✅ Riscos associados\n`);

    // 6. Calcular métricas e gerar outputs
    console.log('📈 [6/6] Calculando métricas e gerando relatórios...');
    const metrics = calculateMetrics(explanations);
    const kr3aStatus = assessKR3AStatus(metrics, minDiffCoverage);
    
    const outputPaths = await generateOutputs(
      explanations,
      metrics,
      kr3aStatus,
      paths,
      format
    );
    console.log(`✅ Relatórios gerados\n`);

    // 7. Verificar gates
    const weakTestsInDiff = explanations.filter(
      e => e.assertStrength === 'fraco' && e.coverage.coveredInDiffPct > 0
    );

    let shouldFail = false;
    let failureReason = '';

    if (failOn === 'weak' && weakTestsInDiff.length > 0) {
      shouldFail = true;
      failureReason = `${weakTestsInDiff.length} testes fracos no diff`;
    }

    if (metrics.diffCoveredPct < minDiffCoverage) {
      shouldFail = true;
      failureReason = `Diff coverage ${metrics.diffCoveredPct.toFixed(1)}% < ${minDiffCoverage}%`;
    }

    console.log(`\n📊 Métricas Finais:`);
    console.log(`   Testes Fortes: ${metrics.assertStrongPct.toFixed(1)}%`);
    console.log(`   Testes Médios: ${metrics.assertMediumPct.toFixed(1)}%`);
    console.log(`   Testes Fracos: ${metrics.assertWeakPct.toFixed(1)}%`);
    console.log(`   Diff Coverage: ${metrics.diffCoveredPct.toFixed(1)}%`);
    console.log(`   Contracts Protected: ${metrics.contractsProtectedPct.toFixed(1)}%`);
    console.log(`   KR3a Status: ${kr3aStatus}\n`);

    if (shouldFail) {
      console.log(`❌ FALHA: ${failureReason}\n`);
      return {
        ok: false,
        explanations,
        metrics,
        kr3aStatus,
        outputPaths,
        message: failureReason,
      };
    }

    console.log(`✅ Análise concluída com sucesso!\n`);
    console.log(`📄 Relatórios salvos em:`);
    console.log(`   ${outputPaths.explanationsJson}`);
    console.log(`   ${outputPaths.explanationsMd}`);
    console.log(`   ${outputPaths.qualitySummaryMd}`);
    console.log(`   ${outputPaths.metricsJson}\n`);

    return {
      ok: true,
      explanations,
      metrics,
      kr3aStatus,
      outputPaths,
    };
  } catch (error) {
    console.error(`❌ Erro ao explicar testes: ${error instanceof Error ? error.message : error}\n`);
    throw error;
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

async function discoverTestFiles(repo: string): Promise<string[]> {
  // Descoberta real via glob
  const { glob } = await import('glob');
  
  const patterns = [
    '**/*.spec.ts',
    '**/*.spec.js',
    '**/*.test.ts',
    '**/*.test.js',
    '**/__tests__/**/*.ts',
    '**/__tests__/**/*.js',
  ];
  
  const ignore = [
    '**/node_modules/**',
    '**/dist/**',
    '**/build/**',
    '**/.next/**',
    '**/coverage/**',
  ];
  
  const files: string[] = [];
  
  for (const pattern of patterns) {
    const matches = await glob(pattern, { 
      cwd: repo, 
      ignore,
      absolute: true,
    });
    files.push(...matches);
  }
  
  // Remover duplicatas
  return [...new Set(files)];
}

async function analyzeTestFile(
  testFile: string,
  repo: string
): Promise<TestExplanation[]> {
  // Parsing AST real
  const { parseTestFile, calculateAssertStrength } = await import('../parsers/test-ast-parser.js');
  
  try {
    const analysis = await parseTestFile(testFile);
    
    return analysis.testCases.map(testCase => {
      const assertStrength = calculateAssertStrength(testCase);
      
      // 🆕 Detectar tipo do teste baseado no caminho
      const testType = detectTestType(testFile);
      
      // 🆕 Gerar descrições contextuais
      const whatItTests = generateWhatItTests(testCase, testFile);
      const whyItTests = generateWhyItTests(testCase, testType, assertStrength);
      const purposeForWhat = generatePurposeForWhat(testCase, testType);
      
      // Detectar smells com exemplos de correção
      const smells: CodeSmell[] = [];
      if (testCase.then.length === 0) {
        smells.push(createNoAssertsSmell(testCase));
      }
      if (testCase.mocks.length > 3) {
        smells.push(createExcessiveMocksSmell(testCase.mocks.length));
      }
      if (!testCase.hasErrorHandling && testCase.when.toLowerCase().includes('error')) {
        smells.push(createMissingErrorHandlingSmell(testCase));
      }
      if (testCase.lineCount > 100) {
        smells.push(createTooLongSmell(testCase.lineCount));
      }
      
      // Gerar sugestões
      const suggestions: string[] = [];
      if (assertStrength === 'fraco') {
        suggestions.push('Trocar toBeTruthy/toBeFalsy por matchers específicos');
        suggestions.push('Validar status + corpo + headers em vez de só chamadas');
      }
      if (testCase.mocks.length > 3) {
        suggestions.push('Reduzir dependências mockadas, considerar testes de integração');
      }
      if (!testCase.hasErrorHandling) {
        suggestions.push('Adicionar cenário de erro (try-catch)');
      }
      
      return {
        file: testFile,
        name: testCase.name,
        testType,
        functionUnderTest: testCase.when !== 'NÃO DETERMINADO' ? testCase.when : undefined,
        whatItTests,
        whyItTests,
        purposeForWhat,
        given: testCase.given.length > 0 ? testCase.given : ['NÃO DETERMINADO (sem evidência)'],
        when: testCase.when,
        then: testCase.then,
        mocks: [...testCase.mocks, ...testCase.spies],
        coverage: {
          files: [],
          linesCovered: 0,
          linesTotal: 0,
          coveredInDiffPct: 0,
        },
        contracts: {
          pact: false,
          failed: 0,
          interactions: 0,
        },
        assertStrength,
        smells,
        suggestions,
      };
    });
  } catch (error) {
    console.warn(`⚠️  Erro ao analisar ${testFile}: ${error instanceof Error ? error.message : error}`);
    return [];
  }
}

// ============================================================================
// CODE SMELLS GENERATORS (com exemplos práticos de correção)
// ============================================================================

function createNoAssertsSmell(testCase: any): CodeSmell {
  const functionName = testCase.when !== 'NÃO DETERMINADO' ? testCase.when : 'processData';
  
  return {
    type: 'no-asserts',
    description: 'Teste sem assertions - não valida nenhum comportamento',
    severity: 'critical',
    impact: 'Teste sempre passa (falso positivo). Bugs não são detectados. Coverage inflado artificialmente.',
    howToFix: {
      before: `// ❌ MAU - Teste sem validação
it('${testCase.name.substring(0, 50)}...', () => {
  const result = ${functionName}(input);
  // Não valida nada! 🚨
});`,
      after: `// ✅ BOM - Teste com validações específicas
it('${testCase.name.substring(0, 50)}...', () => {
  const result = ${functionName}(input);
  
  // Validar retorno
  expect(result).toBeDefined();
  expect(result.status).toBe('success');
  
  // Validar dados processados
  expect(result.data).toHaveLength(3);
  expect(result.data[0]).toHaveProperty('id');
  
  // Validar efeitos colaterais
  expect(result.timestamp).toBeGreaterThan(0);
});`,
      explanation: 'Adicione asserts específicos que validam: (1) Valores de retorno, (2) Estrutura dos dados, (3) Estados esperados, (4) Efeitos colaterais. Use matchers específicos ao invés de genéricos.'
    }
  };
}

function createExcessiveMocksSmell(mockCount: number): CodeSmell {
  return {
    type: 'excessive-mocks',
    description: `Excesso de mocks (${mockCount} mocks) - teste muito acoplado à implementação`,
    severity: 'high',
    impact: 'Teste frágil que quebra com mudanças internas. Dificulta refatoração. Baixo acoplamento com código real.',
    howToFix: {
      before: `// ❌ MAU - Muitos mocks (${mockCount} mocks)
it('should send email', () => {
  const mockDb = vi.fn();
  const mockLogger = vi.fn();
  const mockEmailService = vi.fn();
  const mockQueue = vi.fn();
  const mockCache = vi.fn(); // ${mockCount}º mock! 🚨
  const mockMetrics = vi.fn();
  
  sendEmailWithLogging(data, mockDb, mockLogger, ...);
  
  expect(mockDb).toHaveBeenCalled();
  expect(mockLogger).toHaveBeenCalled();
  // Testando demais a implementação!
});`,
      after: `// ✅ BOM - Teste de integração com mocks essenciais
it('should send email', async () => {
  // Mock apenas APIs externas (não controláveis)
  const mockEmailProvider = vi.fn().mockResolvedValue({ sent: true });
  
  // Use implementações reais para o resto
  const result = await emailService.send({
    to: 'test@example.com',
    subject: 'Test',
    provider: mockEmailProvider
  });
  
  // Valide o COMPORTAMENTO, não a implementação
  expect(result.sent).toBe(true);
  expect(mockEmailProvider).toHaveBeenCalledWith(
    expect.objectContaining({ to: 'test@example.com' })
  );
});

// 💡 Alternativa: Teste de integração real
it('should send email (integration)', async () => {
  // Sem mocks - usa banco de teste real
  const result = await emailService.send({
    to: 'test@example.com',
    subject: 'Test'
  });
  
  expect(result.sent).toBe(true);
  
  // Verificar no banco de teste
  const sentEmails = await db.emails.findAll();
  expect(sentEmails).toHaveLength(1);
});`,
      explanation: `Reduza mocks para o mínimo necessário: (1) APIs externas não controláveis, (2) Recursos caros (rede, I/O). Para o resto, use implementações reais. Considere testes de integração ao invés de unit tests com muitos mocks.`
    }
  };
}

function createMissingErrorHandlingSmell(testCase: any): CodeSmell {
  const functionName = testCase.when !== 'NÃO DETERMINADO' ? testCase.when : 'validateInput';
  
  return {
    type: 'missing-error-handling',
    description: 'Teste de erro sem try-catch - validação genérica de exceções',
    severity: 'medium',
    impact: 'Não valida tipo, mensagem ou causa do erro. Error handling superficial. Bugs em error flow podem passar.',
    howToFix: {
      before: `// ❌ MAU - Validação genérica
it('should throw error on invalid input', () => {
  expect(() => ${functionName}(invalidData)).toThrow();
  // Não valida QUAL erro! 🚨
});`,
      after: `// ✅ BOM - Validação detalhada com try-catch
it('should throw ValidationError with specific message', async () => {
  try {
    await ${functionName}(invalidData);
    fail('Deveria ter lançado ValidationError'); // ✅ Fail explícito
  } catch (error) {
    // Validar tipo do erro
    expect(error).toBeInstanceOf(ValidationError);
    
    // Validar mensagem específica
    expect(error.message).toBe('Email is required');
    
    // Validar código de erro
    expect(error.code).toBe('VALIDATION_ERROR');
    
    // Validar campos inválidos
    expect(error.fields).toContain('email');
  }
});

// 💡 Alternativa: expect().rejects (async)
it('should reject with ValidationError', async () => {
  await expect(${functionName}(invalidData))
    .rejects
    .toThrow(ValidationError);
    
  await expect(${functionName}(invalidData))
    .rejects
    .toThrow('Email is required');
});`,
      explanation: 'Use try-catch para validar: (1) Tipo correto da exceção (instanceof), (2) Mensagem de erro específica, (3) Código/campos de erro, (4) Stack trace quando relevante. Para async, use expect().rejects.'
    }
  };
}

function createTooLongSmell(lineCount: number): CodeSmell {
  return {
    type: 'too-long',
    description: `Teste muito longo (${lineCount} linhas) - viola Single Responsibility Principle`,
    severity: 'low',
    impact: 'Difícil de entender e debugar. Provavelmente testa múltiplas coisas. Tempo de execução elevado.',
    howToFix: {
      before: `// ❌ MAU - Teste monolítico (${lineCount} linhas)
it('should process entire user flow', async () => {
  // Setup (30 linhas)
  const user = createUser({ name: 'Test', email: 'test@example.com' });
  const product = createProduct({ name: 'Product', price: 100 });
  // ... mais 25 linhas de setup
  
  // Ação 1: Criar carrinho (20 linhas)
  const cart = await createCart(user.id);
  await addToCart(cart.id, product.id);
  // ... mais 15 linhas
  
  // Validação 1 (10 linhas)
  expect(cart.items).toHaveLength(1);
  // ... mais 8 linhas
  
  // Ação 2: Checkout (20 linhas)
  // ... e assim por diante
  // Total: ${lineCount} linhas! 🚨
});`,
      after: `// ✅ BOM - Testes separados e focados

describe('User Cart Flow', () => {
  let user: User;
  let product: Product;
  
  beforeEach(async () => {
    // Setup compartilhado (DRY)
    user = await createUser({ name: 'Test', email: 'test@example.com' });
    product = await createProduct({ name: 'Product', price: 100 });
  });
  
  it('should create empty cart for new user', async () => {
    const cart = await createCart(user.id);
    
    expect(cart.userId).toBe(user.id);
    expect(cart.items).toHaveLength(0);
    expect(cart.total).toBe(0);
  }); // ✅ 8 linhas - foco único
  
  it('should add product to cart', async () => {
    const cart = await createCart(user.id);
    await addToCart(cart.id, product.id);
    
    expect(cart.items).toHaveLength(1);
    expect(cart.items[0].productId).toBe(product.id);
    expect(cart.total).toBe(product.price);
  }); // ✅ 10 linhas - foco único
  
  it('should calculate total with multiple items', async () => {
    const cart = await createCart(user.id);
    await addToCart(cart.id, product.id, { quantity: 2 });
    
    expect(cart.items[0].quantity).toBe(2);
    expect(cart.total).toBe(product.price * 2);
  }); // ✅ 8 linhas - foco único
  
  it('should complete checkout successfully', async () => {
    const cart = await createCartWithItems(user.id, [product]);
    const order = await checkout(cart.id, { paymentMethod: 'credit_card' });
    
    expect(order.status).toBe('completed');
    expect(order.total).toBe(cart.total);
    expect(order.userId).toBe(user.id);
  }); // ✅ 10 linhas - foco único
});`,
      explanation: `Quebre em múltiplos testes menores: (1) Um teste = uma responsabilidade, (2) Use beforeEach para setup compartilhado (DRY), (3) Agrupe testes relacionados com describe(), (4) Target: 10-30 linhas por teste. Cada teste deve testar UMA coisa específica.`
    }
  };
}

// 🆕 Detecta o tipo do teste baseado no caminho do arquivo
function detectTestType(filePath: string): 'unit' | 'integration' | 'e2e' | 'unknown' {
  const lowerPath = filePath.toLowerCase();
  
  if (lowerPath.includes('/e2e/') || lowerPath.includes('/end-to-end/') || lowerPath.includes('.e2e.')) {
    return 'e2e';
  }
  
  if (lowerPath.includes('/integration/') || lowerPath.includes('.integration.')) {
    return 'integration';
  }
  
  if (lowerPath.includes('/unit/') || lowerPath.includes('/__tests__/') || 
      lowerPath.includes('.spec.') || lowerPath.includes('.test.')) {
    return 'unit';
  }
  
  return 'unknown';
}

// 🆕 Gera descrição "O que está testando" - ESPECÍFICA por teste
function generateWhatItTests(testCase: any, filePath: string): string {
  const functionName = testCase.when !== 'NÃO DETERMINADO' ? testCase.when : 'função não identificada';
  const testNameLower = testCase.name.toLowerCase();
  
  // Analisar VALUES dos asserts para gerar descrição específica
  const assertDetails = testCase.then.map((t: any) => {
    if (t.path && t.value !== undefined) {
      return `\`${t.path}\` = \`${JSON.stringify(t.value)}\``;
    }
    return null;
  }).filter(Boolean);
  
  // Extrair contexto do nome do teste
  let context = '';
  if (testNameLower.includes('detect') && testNameLower.includes('mode')) {
    // Testes de detecção de modo
    const modeMatch = testCase.name.match(/(FULL|PLAN|ANALYZE|RUN|SCAFFOLD)\s+mode/i);
    const inputMatch = testCase.name.match(/from\s+["']([^"']+)["']/);
    if (modeMatch && inputMatch) {
      context = `detectar modo **${modeMatch[1]}** a partir da entrada "${inputMatch[1]}"`;
    }
  } else if (testNameLower.includes('execute') && testNameLower.includes('mode')) {
    // Testes de execução de modo
    const modeMatch = testCase.name.match(/(FULL|PLAN|ANALYZE|RUN)\s+mode/i);
    if (modeMatch) {
      context = `executar corretamente o modo **${modeMatch[1]}** (análise completa do sistema)`;
    }
  } else if (testNameLower.includes('should return') || testNameLower.includes('deve retornar')) {
    context = extractBehavior(testCase.name);
  } else {
    context = extractBehavior(testCase.name);
  }
  
  // Montar descrição final
  let description = `Valida que **\`${functionName}\`** consegue ${context}`;
  
  // Adicionar evidências específicas
  if (assertDetails.length > 0) {
    description += `. **Validações**: ${assertDetails.slice(0, 3).join(', ')}`;
    if (assertDetails.length > 3) {
      description += ` e mais ${assertDetails.length - 3}`;
    }
  } else {
    description += `. **${testCase.then.length} validações** usando: ${testCase.then.map((t: any) => t.matcher).filter(Boolean).join(', ')}`;
  }
  
  return description;
}

// 🆕 Gera justificativa "Por que está testando" - ESPECÍFICA por contexto
function generateWhyItTests(testCase: any, testType: string, assertStrength: string): string {
  const reasons: string[] = [];
  const testNameLower = testCase.name.toLowerCase();
  
  // 1. Razão técnica ESPECÍFICA baseada no que está sendo validado
  if (testNameLower.includes('detect') && testNameLower.includes('mode')) {
    // Testes de NLP/detecção de modo
    const modeMatch = testCase.name.match(/(FULL|PLAN|ANALYZE|RUN|SCAFFOLD)\s+mode/i);
    const mode = modeMatch ? modeMatch[1] : 'desconhecido';
    reasons.push(`Garante que o **NLP** (Natural Language Processing) mapeia corretamente comandos em português/inglês para o modo \`${mode}\``);
    
    // Analisar valores específicos sendo validados
    const modeValidations = testCase.then.filter((t: any) => 
      t.path && (t.path.includes('mode') || t.path.includes('detected'))
    );
    if (modeValidations.length > 0) {
      reasons.push(`Valida ${modeValidations.length} propriedades relacionadas ao modo: ${modeValidations.map((t: any) => `\`${t.path}\``).join(', ')}`);
    }
  } else if (testNameLower.includes('execute') && testNameLower.includes('mode')) {
    // Testes de execução de pipeline
    const modeMatch = testCase.name.match(/(FULL|PLAN|ANALYZE|RUN)\s+mode/i);
    const mode = modeMatch ? modeMatch[1] : 'desconhecido';
    reasons.push(`Valida que o pipeline **\`auto.ts\`** executa todas as fases do modo \`${mode}\` corretamente`);
    
    // Analisar propriedades validadas
    const contextProps = testCase.then.filter((t: any) => t.path && t.path.includes('context'));
    const outputProps = testCase.then.filter((t: any) => t.path && t.path.includes('output'));
    if (contextProps.length > 0) {
      reasons.push(`Confirma que o contexto de execução foi inicializado (\`${contextProps[0].path}\`)`);
    }
    if (outputProps.length > 0) {
      reasons.push(`Confirma que os outputs foram gerados (\`${outputProps[0].path}\`)`);
    }
  } else {
    // Fallback genérico para outros tipos
    if (testCase.then.length === 0) {
      reasons.push('⚠️ **Sem validações** - teste pode não detectar regressões');
    } else {
      const uniqueMatchers = [...new Set(testCase.then.map((t: any) => t.matcher).filter(Boolean))];
      reasons.push(`Valida ${testCase.then.length} aspecto(s) usando: ${uniqueMatchers.join(', ')}`);
    }
  }
  
  // 2. Cenário específico
  if (testNameLower.includes('error') || testNameLower.includes('fail') || testNameLower.includes('invalid')) {
    reasons.push('**Cenário de erro** - garante robustez em casos de falha');
  } else if (testNameLower.includes('edge') || testNameLower.includes('boundary')) {
    reasons.push('**Edge case** - protege contra inputs extremos/inesperados');
  } else if (testNameLower.includes('detect') || testNameLower.includes('parse')) {
    reasons.push('**Cenário de parsing** - valida interpretação correta de entrada');
  }
  
  return reasons.join('. ');
}

// 🆕 Gera propósito "Para que está testando" - ESPECÍFICO por contexto
function generatePurposeForWhat(testCase: any, testType: string): string {
  const purposes: string[] = [];
  const testNameLower = testCase.name.toLowerCase();
  
  // Propósito ESPECÍFICO baseado no tipo de teste
  if (testNameLower.includes('detect') && testNameLower.includes('mode')) {
    // Testes de NLP - propósito de UX/experiência
    purposes.push('🎯 **UX**: Permitir que usuários usem comandos naturais (português/inglês) ao invés de flags CLI complexas');
    purposes.push('📉 **CFR**: Reduzir erros de uso do CLI (comandos inválidos/confusos) → menos suporte');
    purposes.push('⚡ **Produtividade**: Usuários expressam intenção diretamente ("criar plano de testes") → onboarding mais rápido');
  } else if (testNameLower.includes('execute') && testNameLower.includes('mode')) {
    // Testes de pipeline - propósito de confiabilidade
    purposes.push('🔒 **Confiabilidade**: Garantir que o pipeline completo funciona ponta-a-ponta sem falhas silenciosas');
    purposes.push('📉 **CFR**: Prevenir deploys de versões com pipelines quebrados (todos os passos devem executar)');
    purposes.push('⏱️ **MTTR**: Se algo falhar em produção, testes E2E ajudam a reproduzir o problema rapidamente');
  } else {
    // Propósitos genéricos por tipo de teste
    if (testType === 'unit') {
      purposes.push('📉 **CFR**: Detectar bugs em segundos (feedback imediato durante desenvolvimento)');
      purposes.push('⚡ **Deploy Frequency**: Testes rápidos (~0.01s) permitem mais commits/dia sem medo');
    } else if (testType === 'integration') {
      purposes.push('📉 **CFR**: Prevenir breaking changes em APIs/contratos (compatibility checks)');
      purposes.push('⏱️ **MTTR**: Identificar exatamente qual serviço/módulo causou a falha');
    } else if (testType === 'e2e') {
      purposes.push('📉 **CFR**: Garantir que usuários finais não encontrem bugs (smoke tests críticos)');
      purposes.push('⏱️ **MTTR**: Reproduzir cenários reais de produção para diagnóstico');
    }
  }
  
  // Adicionar alerta se teste não tem valor
  if (testCase.then.length === 0) {
    purposes.push('⚠️ **ALERTA**: Teste sem asserts NÃO contribui para redução de CFR/MTTR (falso positivo)');
  } else if (testCase.then.length >= 3) {
    purposes.push(`✅ **Valor**: Múltiplos asserts (~${testCase.then.length}) aumentam diagnóstico (sabe EXATAMENTE o que falhou)`);
  }
  
  return purposes.join('\n- ');
}

// Helper: extrai comportamento do nome do teste
function extractBehavior(testName: string): string {
  const match = testName.match(/(?:should|deve)\s+(.+)/i);
  return match ? match[1] : testName;
}

// Helper: extrai condição do nome do teste
function extractCondition(testName: string): string {
  const match = testName.match(/(?:when|quando)\s+(.+)/i);
  return match ? match[1] : testName;
}

async function enrichWithCoverage(
  explanations: TestExplanation[],
  repo: string,
  product: string,
  baseBranch: string
): Promise<void> {
  // Integrar com diff-coverage.json e LCOV
  const paths = getPaths(repo, product);
  const diffCoverageFile = join(paths.analyses, 'diff-coverage.json');
  
  if (await fileExists(diffCoverageFile)) {
    try {
      const diffCoverageContent = await fs.readFile(diffCoverageFile, 'utf-8');
      const diffCoverage = JSON.parse(diffCoverageContent);
      
      // Mapear arquivos alterados no diff
      const diffFiles = new Set(diffCoverage.files?.map((f: any) => f.file) || []);
      
      for (const exp of explanations) {
        // Heurística: associar teste a arquivo sendo testado
        // Ex: src/__tests__/user/create.spec.ts → src/user/create.ts
        const possibleSourceFiles = inferSourceFiles(exp.file);
        
        // Verificar se algum arquivo fonte está no diff
        const filesInDiff = possibleSourceFiles.filter(f => diffFiles.has(f));
        
        if (filesInDiff.length > 0) {
          const diffFileData = diffCoverage.files.find((f: any) => f.file === filesInDiff[0]);
          if (diffFileData) {
            exp.coverage.files = [filesInDiff[0]];
            exp.coverage.linesCovered = diffFileData.covered || 0;
            exp.coverage.linesTotal = diffFileData.added || 0;
            exp.coverage.coveredInDiffPct = diffFileData.coverage || 0;
          }
        }
      }
      
      console.log(`✅ Diff coverage associado de ${diffCoverageFile}`);
    } catch (error) {
      console.warn(`⚠️  Erro ao ler diff-coverage.json: ${error instanceof Error ? error.message : error}`);
    }
  } else {
    console.warn(`⚠️  diff-coverage.json não encontrado em ${diffCoverageFile}`);
  }
}

function inferSourceFiles(testFile: string): string[] {
  // Heurística para mapear arquivo de teste → arquivo fonte
  // src/__tests__/user/create.spec.ts → [src/user/create.ts, src/user/create.js]
  // src/user/create.test.ts → [src/user/create.ts, src/user/create.js]
  
  const possibleFiles: string[] = [];
  
  let sourcePath = testFile
    .replace('/__tests__/', '/')
    .replace('.spec.ts', '.ts')
    .replace('.spec.js', '.js')
    .replace('.test.ts', '.ts')
    .replace('.test.js', '.js');
  
  possibleFiles.push(sourcePath);
  possibleFiles.push(sourcePath.replace('.ts', '.js'));
  possibleFiles.push(sourcePath.replace('.js', '.ts'));
  
  return possibleFiles;
}

async function enrichWithContracts(
  explanations: TestExplanation[],
  paths: ReturnType<typeof getPaths>
): Promise<void> {
  // Integrar com contracts-verify.json
  const contractsFile = join(paths.reports, 'contracts-verify.json');
  
  if (await fileExists(contractsFile)) {
    try {
      const contractsContent = await fs.readFile(contractsFile, 'utf-8');
      const contracts = JSON.parse(contractsContent);
      
      // Mapear contratos por consumer/provider
      const contractMap = new Map<string, any>();
      if (contracts.contracts && Array.isArray(contracts.contracts)) {
        for (const contract of contracts.contracts) {
          const key = `${contract.consumer}-${contract.provider}`;
          contractMap.set(key, contract);
        }
      }
      
      for (const exp of explanations) {
        // Heurística: se teste menciona 'pact' ou 'contract', associar
        const testNameLower = exp.name.toLowerCase();
        const fileLower = exp.file.toLowerCase();
        
        if (testNameLower.includes('pact') || 
            testNameLower.includes('contract') ||
            fileLower.includes('pact') ||
            fileLower.includes('contract')) {
          
          exp.contracts.pact = true;
          
          // Tentar encontrar contrato específico
          for (const [, contract] of contractMap) {
            if (contract.interactions && Array.isArray(contract.interactions)) {
              exp.contracts.interactions = contract.interactions.length;
              exp.contracts.failed = contract.interactions.filter((i: any) => !i.success).length;
            }
          }
        }
      }
      
      console.log(`✅ Contracts associados de ${contractsFile}`);
    } catch (error) {
      console.warn(`⚠️  Erro ao ler contracts-verify.json: ${error instanceof Error ? error.message : error}`);
    }
  } else {
    console.warn(`⚠️  contracts-verify.json não encontrado em ${contractsFile}`);
  }
}

async function enrichWithRisks(
  explanations: TestExplanation[],
  paths: ReturnType<typeof getPaths>
): Promise<void> {
  // Integrar com risk-register.json e cujs-catalog.json
  const riskRegisterFile = join(paths.analyses, 'risk-register.json');
  const cujsCatalogFile = join(paths.analyses, 'cujs-catalog.json');
  
  let riskMap = new Map<string, any>();
  let cujMap = new Map<string, any>();
  
  // Carregar risk register
  if (await fileExists(riskRegisterFile)) {
    try {
      const riskContent = await fs.readFile(riskRegisterFile, 'utf-8');
      const risks = JSON.parse(riskContent);
      
      if (risks.modules && Array.isArray(risks.modules)) {
        for (const module of risks.modules) {
          riskMap.set(module.name.toLowerCase(), module);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Erro ao ler risk-register.json: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  // Carregar CUJs catalog
  if (await fileExists(cujsCatalogFile)) {
    try {
      const cujContent = await fs.readFile(cujsCatalogFile, 'utf-8');
      const cujs = JSON.parse(cujContent);
      
      if (cujs.cujs && Array.isArray(cujs.cujs)) {
        for (const cuj of cujs.cujs) {
          const key = cuj.name.toLowerCase();
          cujMap.set(key, cuj);
        }
      }
    } catch (error) {
      console.warn(`⚠️  Erro ao ler cujs-catalog.json: ${error instanceof Error ? error.message : error}`);
    }
  }
  
  // Associar riscos/CUJs aos testes
  for (const exp of explanations) {
    const testNameLower = exp.name.toLowerCase();
    const fileLower = exp.file.toLowerCase();
    
    // Tentar mapear via nome do teste ou arquivo
    for (const [key, cuj] of cujMap) {
      if (testNameLower.includes(key) || fileLower.includes(key)) {
        exp.risk = {
          cuj: cuj.name,
          level: determineRiskLevel(cuj.priority || 'medium'),
          slo: cuj.slo || undefined,
        };
        
        // 🆕 Enriquecer propósito com CUJ específico
        exp.purposeForWhat = `Protege o CUJ crítico "${cuj.name}" (risco ${exp.risk.level})${cuj.slo ? ` com SLO de ${cuj.slo}` : ''}; ${exp.purposeForWhat}`;
        break;
      }
    }
    
    // Se não encontrou CUJ, tentar mapear via módulo de risco
    if (!exp.risk) {
      for (const [key, module] of riskMap) {
        if (fileLower.includes(key)) {
          exp.risk = {
            cuj: `Módulo: ${module.name}`,
            level: module.risk_level || 'médio',
          };
          
          // 🆕 Enriquecer propósito com módulo de risco
          exp.purposeForWhat = `Protege módulo de risco ${exp.risk.level} "${module.name}"; ${exp.purposeForWhat}`;
          break;
        }
      }
    }
  }
  
  console.log(`✅ Riscos/CUJs associados`);
}

function determineRiskLevel(priority: string): 'baixo' | 'médio' | 'alto' {
  const p = priority.toLowerCase();
  if (p.includes('high') || p.includes('critical') || p.includes('alto')) {
    return 'alto';
  }
  if (p.includes('low') || p.includes('baixo')) {
    return 'baixo';
  }
  return 'médio';
}

function calculateMetrics(explanations: TestExplanation[]): TestQualityMetrics {
  const total = explanations.length;
  if (total === 0) {
    return {
      assertStrongPct: 0,
      assertMediumPct: 0,
      assertWeakPct: 0,
      diffCoveredPct: 0,
      contractsProtectedPct: 0,
      weakTestsInDiffPct: 0,
      criticalEndpointsWithoutContract: 0,
      suspectedFlakyPct: 0,
      diagnosticAssertsPct: 0,
      totalTests: 0,
      testsWithAsserts: 0,
      testsWithoutAsserts: 0,
    };
  }

  const strong = explanations.filter(e => e.assertStrength === 'forte').length;
  const medium = explanations.filter(e => e.assertStrength === 'médio').length;
  const weak = explanations.filter(e => e.assertStrength === 'fraco').length;

  const withAsserts = explanations.filter(e => e.then.length > 0).length;
  const withoutAsserts = total - withAsserts;

  const testsInDiff = explanations.filter(e => e.coverage.coveredInDiffPct > 0);
  const weakInDiff = testsInDiff.filter(e => e.assertStrength === 'fraco').length;

  const testsWithContracts = explanations.filter(e => e.contracts.pact).length;

  return {
    assertStrongPct: (strong / total) * 100,
    assertMediumPct: (medium / total) * 100,
    assertWeakPct: (weak / total) * 100,
    diffCoveredPct: testsInDiff.length > 0
      ? testsInDiff.reduce((sum, t) => sum + t.coverage.coveredInDiffPct, 0) / testsInDiff.length
      : 0,
    contractsProtectedPct: (testsWithContracts / total) * 100,
    weakTestsInDiffPct: testsInDiff.length > 0 ? (weakInDiff / testsInDiff.length) * 100 : 0,
    criticalEndpointsWithoutContract: 0, // TODO: calcular baseado em risk-register
    suspectedFlakyPct: 0, // TODO: calcular baseado em suite-health
    diagnosticAssertsPct: (withAsserts / total) * 100,
    totalTests: total,
    testsWithAsserts: withAsserts,
    testsWithoutAsserts: withoutAsserts,
  };
}

function assessKR3AStatus(
  metrics: TestQualityMetrics,
  minDiffCoverage: number
): 'OK' | 'ATENÇÃO' | 'ALERTA' {
  // KR3a guardrails:
  // - weakTestsInDiffPct ≤ 5%
  // - diffCoveredPct ≥ 80%
  // - contractsProtectedPct ≥ 90%

  const violations: string[] = [];

  if (metrics.weakTestsInDiffPct > 5) {
    violations.push(`weakTestsInDiffPct: ${metrics.weakTestsInDiffPct.toFixed(1)}% > 5%`);
  }

  if (metrics.diffCoveredPct < minDiffCoverage) {
    violations.push(`diffCoveredPct: ${metrics.diffCoveredPct.toFixed(1)}% < ${minDiffCoverage}%`);
  }

  if (metrics.contractsProtectedPct < 90) {
    violations.push(`contractsProtectedPct: ${metrics.contractsProtectedPct.toFixed(1)}% < 90%`);
  }

  if (violations.length === 0) {
    return 'OK';
  } else if (violations.length === 1 || metrics.weakTestsInDiffPct <= 10) {
    return 'ATENÇÃO';
  } else {
    return 'ALERTA';
  }
}

async function generateOutputs(
  explanations: TestExplanation[],
  metrics: TestQualityMetrics,
  kr3aStatus: 'OK' | 'ATENÇÃO' | 'ALERTA',
  paths: ReturnType<typeof getPaths>,
  format: 'md' | 'json'
): Promise<{
  explanationsJson: string;
  explanationsMd: string;
  qualitySummaryMd: string;
  metricsJson: string;
}> {
  // 1. test-explanations.json
  const explanationsJsonPath = join(paths.analyses, 'test-explanations.json');
  await writeFileSafe(explanationsJsonPath, JSON.stringify(explanations, null, 2));

  // 2. TEST-EXPLANATIONS.md
  const explanationsMdPath = join(paths.reports, 'TEST-EXPLANATIONS.md');
  const explanationsMd = generateExplanationsMarkdown(explanations);
  await writeFileSafe(explanationsMdPath, explanationsMd);

  // 3. TEST-QUALITY-SUMMARY.md
  const qualitySummaryMdPath = join(paths.reports, 'TEST-QUALITY-SUMMARY.md');
  const qualitySummaryMd = generateQualitySummaryMarkdown(metrics, kr3aStatus);
  await writeFileSafe(qualitySummaryMdPath, qualitySummaryMd);

  // 4. test-quality-metrics.json
  const metricsJsonPath = join(paths.analyses, 'test-quality-metrics.json');
  await writeFileSafe(metricsJsonPath, JSON.stringify(metrics, null, 2));

  return {
    explanationsJson: explanationsJsonPath,
    explanationsMd: explanationsMdPath,
    qualitySummaryMd: qualitySummaryMdPath,
    metricsJson: metricsJsonPath,
  };
}

function generateExplanationsMarkdown(explanations: TestExplanation[]): string {
  let md = `# 🔍 Explicação Detalhada dos Testes\n\n`;
  md += `> Análise AST de cada teste com contexto, propósito e qualidade\n\n`;
  md += `**Total de Testes Analisados**: ${explanations.length}\n\n`;
  md += `---\n\n`;

  for (const exp of explanations) {
    // 🆕 Cabeçalho com nome e tipo
    const typeEmoji = exp.testType === 'unit' ? '🔬' : 
                     exp.testType === 'integration' ? '🔗' : 
                     exp.testType === 'e2e' ? '🎭' : '❓';
    const typeLabel = exp.testType === 'unit' ? 'Unit' : 
                     exp.testType === 'integration' ? 'Integration' : 
                     exp.testType === 'e2e' ? 'E2E' : 'Unknown';
    
    md += `## ${typeEmoji} ${exp.name}\n\n`;
    md += `**📁 Arquivo**: \`${exp.file}\`  \n`;
    md += `**🏷️ Tipo**: ${typeLabel}\n\n`;
    
    // 🆕 Seção "O que testa?" - destaque principal
    md += `### 🎯 O que testa?\n\n`;
    md += `${exp.whatItTests}\n\n`;
    
    if (exp.functionUnderTest) {
      md += `**Função alvo**: \`${exp.functionUnderTest}\`\n\n`;
    }

    // 🆕 Seção "Por que testa?" - justificativa técnica
    md += `### ❓ Por que testa isso?\n\n`;
    md += `${exp.whyItTests}\n\n`;

    // 🆕 Seção "Para que testa?" - propósito de negócio/DORA
    md += `### 🎯 Para que testa?\n\n`;
    md += `${exp.purposeForWhat}\n\n`;

    // Detalhes Given/When/Then
    md += `### 📋 Estrutura do Teste (Given-When-Then)\n\n`;
    md += `**Given** (pré-condições):\n`;
    if (exp.given.length > 0) {
      exp.given.forEach(g => md += `- ${g}\n`);
    } else {
      md += `- _(nenhuma pré-condição identificada)_\n`;
    }
    md += `\n**When** (ação testada):\n- \`${exp.when}\`\n\n`;
    md += `**Then** (validações):\n`;
    if (exp.then.length > 0) {
      exp.then.forEach(t => {
        // Formatar assert de forma legível
        if (t.matcher && t.path) {
          // expect(obj.prop).toBe(value)
          md += `- \`${t.path}\` → **${t.matcher}** → \`${t.value || 'esperado'}\`\n`;
        } else if (t.matcher) {
          // expect(result).toBe(value)
          md += `- **${t.matcher}**(\`${t.value || 'esperado'}\`)\n`;
        } else {
          // Outros tipos de assert
          md += `- **${t.type}**: ${t.path ? `\`${t.path}\`` : ''} ${t.value ? `→ \`${t.value}\`` : ''}\n`;
        }
      });
    } else {
      md += `- ⚠️ **Nenhum assert detectado!**\n`;
    }
    md += `\n`;

    // Força dos asserts
    const strengthEmoji = exp.assertStrength === 'forte' ? '🟢' : 
                         exp.assertStrength === 'médio' ? '🟡' : '🔴';
    md += `### 💪 Força dos Asserts: ${strengthEmoji} **${exp.assertStrength.toUpperCase()}**\n\n`;

    // Cobertura
    md += `### 📊 Cobertura\n\n`;
    if (exp.coverage.files.length > 0) {
      md += `- **Arquivos cobertos**: ${exp.coverage.files.join(', ')}\n`;
      md += `- **Linhas cobertas no diff**: ${exp.coverage.linesCovered}/${exp.coverage.linesTotal}\n`;
      md += `- **% no diff (PR-aware)**: ${exp.coverage.coveredInDiffPct.toFixed(1)}%\n\n`;
    } else {
      md += `*Nenhum arquivo de cobertura associado*\n\n`;
    }

    // Mocks
    if (exp.mocks.length > 0) {
      md += `### 🎭 Mocks/Spies\n\n`;
      exp.mocks.forEach(m => md += `- ${m}\n`);
      md += `\n`;
    }

    // Contratos
    if (exp.contracts.pact) {
      md += `### 🤝 Contratos (CDC/Pact)\n\n`;
      md += `- **Interações testadas**: ${exp.contracts.interactions}\n`;
      md += `- **Falhas**: ${exp.contracts.failed}\n\n`;
    }

    // Risco/CUJ
    if (exp.risk) {
      const riskLevel = exp.risk.level || 'médio';
      const riskEmoji = riskLevel === 'alto' ? '🔴' : 
                       riskLevel === 'médio' ? '🟡' : '🟢';
      md += `### ${riskEmoji} Risco/CUJ: **${riskLevel.toUpperCase()}**\n\n`;
      md += `- **CUJ**: ${exp.risk.cuj}\n`;
      if (exp.risk.slo) {
        md += `- **SLO**: ${exp.risk.slo}\n`;
      }
      md += `\n`;
    }

    // Problemas (com exemplos de correção)
    if (exp.smells.length > 0) {
      md += `### ⚠️ Problemas Detectados (Code Smells)\n\n`;
      
      for (const smell of exp.smells) {
        const severityEmoji = smell.severity === 'critical' ? '🚨' : 
                             smell.severity === 'high' ? '⚠️' : 
                             smell.severity === 'medium' ? '🟡' : 'ℹ️';
        
        md += `#### ${severityEmoji} ${smell.description}\n\n`;
        md += `**Severidade**: ${smell.severity.toUpperCase()}  \n`;
        md += `**Impacto**: ${smell.impact}\n\n`;
        
        md += `**❌ Antes (Problema):**\n\n`;
        md += `\`\`\`typescript\n${smell.howToFix.before}\n\`\`\`\n\n`;
        
        md += `**✅ Depois (Corrigido):**\n\n`;
        md += `\`\`\`typescript\n${smell.howToFix.after}\n\`\`\`\n\n`;
        
        md += `**💡 Como corrigir**: ${smell.howToFix.explanation}\n\n`;
        md += `---\n\n`;
      }
    }

    // Sugestões
    if (exp.suggestions.length > 0) {
      md += `### 💡 Sugestões de Melhoria\n\n`;
      exp.suggestions.forEach(s => md += `- ${s}\n`);
      md += `\n`;
    }

    md += `---\n\n`;
  }

  return md;
}

function generateQualitySummaryMarkdown(
  metrics: TestQualityMetrics,
  kr3aStatus: 'OK' | 'ATENÇÃO' | 'ALERTA'
): string {
  let md = `# 📊 Sumário de Qualidade dos Testes\n\n`;
  md += `**Data**: ${new Date().toLocaleDateString('pt-BR')}\n\n`;
  md += `---\n\n`;

  md += `## 🎯 KR3a: Confiabilidade em Produção\n\n`;
  md += `**Status**: ${kr3aStatus === 'OK' ? '✅' : kr3aStatus === 'ATENÇÃO' ? '⚠️' : '🚨'} ${kr3aStatus}\n\n`;
  md += `**Meta KR3a**: Máximo 10% das entregas com falhas (nunca >15%)\n\n`;

  md += `## 📈 Métricas de Força dos Testes\n\n`;
  md += `| Força | % | Contagem |\n`;
  md += `|-------|---|----------|\n`;
  md += `| Forte | ${metrics.assertStrongPct.toFixed(1)}% | ${Math.round(metrics.totalTests * metrics.assertStrongPct / 100)} |\n`;
  md += `| Médio | ${metrics.assertMediumPct.toFixed(1)}% | ${Math.round(metrics.totalTests * metrics.assertMediumPct / 100)} |\n`;
  md += `| Fraco | ${metrics.assertWeakPct.toFixed(1)}% | ${Math.round(metrics.totalTests * metrics.assertWeakPct / 100)} |\n\n`;

  md += `**Total de Testes**: ${metrics.totalTests}\n\n`;

  md += `## 🎯 Leading Indicators DORA\n\n`;
  md += `| Indicador | Valor | Meta | Status |\n`;
  md += `|-----------|-------|------|--------|\n`;
  md += `| Testes Fracos no Diff | ${metrics.weakTestsInDiffPct.toFixed(1)}% | ≤ 5% | ${metrics.weakTestsInDiffPct <= 5 ? '✅' : '❌'} |\n`;
  md += `| Diff Coverage | ${metrics.diffCoveredPct.toFixed(1)}% | ≥ 80% | ${metrics.diffCoveredPct >= 80 ? '✅' : '❌'} |\n`;
  md += `| Contracts Protected | ${metrics.contractsProtectedPct.toFixed(1)}% | ≥ 90% | ${metrics.contractsProtectedPct >= 90 ? '✅' : '❌'} |\n`;
  md += `| Diagnostic Asserts | ${metrics.diagnosticAssertsPct.toFixed(1)}% | ≥ 90% | ${metrics.diagnosticAssertsPct >= 90 ? '✅' : '❌'} |\n\n`;

  md += `**Impacto esperado**:\n`;
  md += `- **CFR (Change Failure Rate)**: ${metrics.weakTestsInDiffPct <= 5 && metrics.contractsProtectedPct >= 90 ? 'REDUZIRÁ ↓' : 'RISCO ELEVADO ⚠️'}\n`;
  md += `- **MTTR (Mean Time to Recovery)**: ${metrics.diagnosticAssertsPct >= 90 ? 'REDUZIRÁ ↓' : 'DIAGNÓSTICO LENTO ⚠️'}\n`;
  md += `- **DF (Deploy Frequency)**: ${metrics.diffCoveredPct >= 80 ? 'MANTÉM ✅' : 'RISCO ⚠️'}\n`;
  md += `- **LTC (Lead Time for Changes)**: ${metrics.diffCoveredPct >= 80 ? 'MANTÉM ✅' : 'RISCO ⚠️'}\n\n`;

  md += `## 📊 Detalhamento\n\n`;
  md += `- **Testes com Asserts**: ${metrics.testsWithAsserts}/${metrics.totalTests} (${(metrics.testsWithAsserts / metrics.totalTests * 100).toFixed(1)}%)\n`;
  md += `- **Testes sem Asserts**: ${metrics.testsWithoutAsserts}\n`;
  md += `- **Endpoints Críticos sem Contrato**: ${metrics.criticalEndpointsWithoutContract}\n`;
  md += `- **Suspeita de Flaky**: ${metrics.suspectedFlakyPct.toFixed(1)}%\n\n`;

  md += `---\n\n`;
  md += `**Gerado por**: MCP Quality CLI - explain-tests\n`;

  return md;
}

// ============================================================================
// CLI ENTRY POINT
// ============================================================================

export async function run(args: Record<string, any>): Promise<ExplainTestsResult> {
  const options: ExplainTestsOptions = {
    repo: args.repo || process.cwd(),
    product: args.product,
    format: args.format || 'md',
    outDir: args.outDir || args.out_dir,
    baseBranch: args.baseBranch || args.base_branch || 'main',
    minDiffCoverage: args.minDiffCoverage || args.min_diff_coverage || 80,
    minAsserts: args.minAsserts || args.min_asserts || 1,
    failOn: args.failOn || args.fail_on || 'none',
  };

  return explainTests(options);
}

