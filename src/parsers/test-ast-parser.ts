/**
 * test-ast-parser.ts - Parser AST para Extrair Given/When/Then de Testes
 * 
 * Analisa arquivos de teste TypeScript/JavaScript usando AST para extrair:
 * - Given: Fixtures, arranjos, mocks/spies
 * - When: Função/rota/evento chamado
 * - Then: Asserts (matcher, alvo, esperado)
 * - Mocks e spies
 * - Força das asserções
 */

import { parse } from '@typescript-eslint/typescript-estree';
import { promises as fs } from 'node:fs';
import type { AssertInfo } from '../tools/explain-tests.js';

export interface TestCase {
  name: string;
  line: number;
  given: string[];
  when: string;
  then: AssertInfo[];
  mocks: string[];
  spies: string[];
  hasErrorHandling: boolean;
  lineCount: number;
}

export interface TestFileAnalysis {
  file: string;
  testCases: TestCase[];
  imports: string[];
  framework: 'vitest' | 'jest' | 'mocha' | 'unknown';
}

/**
 * Analisa arquivo de teste e extrai informações via AST
 */
export async function parseTestFile(filePath: string): Promise<TestFileAnalysis> {
  const content = await fs.readFile(filePath, 'utf-8');
  
  try {
    const ast = parse(content, {
      loc: true,
      range: true,
      comment: true,
      tokens: true,
      ecmaVersion: 2022,
      sourceType: 'module',
    });

    const framework = detectFramework(content);
    const imports = extractImports(ast);
    const testCases = extractTestCases(ast, content);

    return {
      file: filePath,
      testCases,
      imports,
      framework,
    };
  } catch (error) {
    console.warn(`⚠️  Erro ao parsear ${filePath}: ${error instanceof Error ? error.message : error}`);
    return {
      file: filePath,
      testCases: [],
      imports: [],
      framework: 'unknown',
    };
  }
}

/**
 * Detecta framework de teste baseado em imports e globals
 */
function detectFramework(content: string): 'vitest' | 'jest' | 'mocha' | 'unknown' {
  if (content.includes('from \'vitest\'') || content.includes('from "vitest"')) {
    return 'vitest';
  }
  if (content.includes('@jest') || content.includes('from \'@jest')) {
    return 'jest';
  }
  if (content.includes('from \'mocha\'') || content.includes('describe(')) {
    return 'mocha';
  }
  return 'unknown';
}

/**
 * Extrai imports do arquivo
 */
function extractImports(ast: any): string[] {
  const imports: string[] = [];
  
  function visit(node: any) {
    if (node.type === 'ImportDeclaration') {
      imports.push(node.source.value);
    }
    
    // Recursão
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach((child: any) => visit(child));
        } else {
          visit(node[key]);
        }
      }
    }
  }
  
  visit(ast);
  return imports;
}

/**
 * Extrai casos de teste (describe/it/test)
 */
function extractTestCases(ast: any, content: string): TestCase[] {
  const testCases: TestCase[] = [];
  
  function visit(node: any, parentDescribe?: string) {
    // Detectar describe/it/test
    if (node.type === 'CallExpression' && node.callee) {
      const calleeName = getCalleeName(node.callee);
      
      if (calleeName === 'describe' || calleeName === 'context') {
        const testName = getFirstStringArgument(node);
        // Recursão nos filhos do describe
        if (node.arguments && node.arguments[1]) {
          visit(node.arguments[1], testName);
        }
      } else if (calleeName === 'it' || calleeName === 'test' || calleeName === 'specify') {
        const testName = getFirstStringArgument(node);
        const fullName = parentDescribe ? `${parentDescribe} > ${testName}` : testName;
        
        // Analisar corpo do teste
        if (node.arguments && node.arguments[1]) {
          const testBody = node.arguments[1];
          const testCase = analyzeTestBody(testBody, fullName, node.loc?.start.line || 0, content);
          testCases.push(testCase);
        }
      }
    }
    
    // Recursão
    for (const key in node) {
      if (node[key] && typeof node[key] === 'object') {
        if (Array.isArray(node[key])) {
          node[key].forEach((child: any) => visit(child, parentDescribe));
        } else {
          visit(node[key], parentDescribe);
        }
      }
    }
  }
  
  visit(ast);
  return testCases;
}

/**
 * Analisa corpo do teste para extrair Given/When/Then
 */
function analyzeTestBody(node: any, name: string, line: number, content: string): TestCase {
  const given: string[] = [];
  const when: string[] = [];
  const then: AssertInfo[] = [];
  const mocks: string[] = [];
  const spies: string[] = [];
  let hasErrorHandling = false;
  
  function visitBody(bodyNode: any) {
    if (!bodyNode) return;
    
    // Variável declaration (Given)
    if (bodyNode.type === 'VariableDeclaration') {
      bodyNode.declarations.forEach((decl: any) => {
        if (decl.id && decl.id.name) {
          given.push(`${decl.id.name} = ...`);
        }
      });
    }
    
    // Mock/Spy detection
    if (bodyNode.type === 'CallExpression' && bodyNode.callee) {
      const calleeName = getCalleeName(bodyNode.callee);
      
      if (calleeName.includes('mock') || calleeName.includes('Mock')) {
        const mockTarget = extractMockTarget(bodyNode);
        if (mockTarget) mocks.push(mockTarget);
      }
      
      if (calleeName.includes('spy') || calleeName.includes('Spy')) {
        const spyTarget = extractSpyTarget(bodyNode);
        if (spyTarget) spies.push(spyTarget);
      }
      
      // Expect/Assert (Then)
      // Detectar expect(...).toBe(...), expect(...).toEqual(...), etc
      if (calleeName === 'expect' || calleeName === 'assert') {
        const assertInfo = extractAssertInfo(bodyNode);
        if (assertInfo) then.push(assertInfo);
      }
      
      // 🆕 Detectar também quando expect está no object (ex: expect().toBe())
      if (bodyNode.callee.type === 'MemberExpression' && 
          bodyNode.callee.object &&
          bodyNode.callee.object.type === 'CallExpression') {
        const objectCalleeName = getCalleeName(bodyNode.callee.object.callee);
        if (objectCalleeName === 'expect' || objectCalleeName === 'assert') {
          const assertInfo = extractAssertInfo(bodyNode);
          if (assertInfo) then.push(assertInfo);
        }
      }
      
      // When: função sendo testada (heurística: await/call principal)
      if (bodyNode.callee.type === 'MemberExpression' || 
          bodyNode.callee.type === 'Identifier') {
        const funcName = getCalleeName(bodyNode.callee);
        if (!funcName.includes('expect') && !funcName.includes('mock') && !funcName.includes('spy')) {
          when.push(funcName);
        }
      }
    }
    
    // Try-catch (error handling)
    if (bodyNode.type === 'TryStatement' || bodyNode.type === 'CatchClause') {
      hasErrorHandling = true;
    }
    
    // Recursão em todas as estruturas possíveis
    if (bodyNode.body) {
      if (Array.isArray(bodyNode.body)) {
        bodyNode.body.forEach((child: any) => visitBody(child));
      } else {
        visitBody(bodyNode.body);
      }
    }
    
    if (bodyNode.expression) {
      visitBody(bodyNode.expression);
    }
    
    if (bodyNode.consequent) {
      visitBody(bodyNode.consequent);
    }
    
    if (bodyNode.alternate) {
      visitBody(bodyNode.alternate);
    }
    
    // 🆕 Visitar argumentos e declarações
    if (bodyNode.arguments && Array.isArray(bodyNode.arguments)) {
      bodyNode.arguments.forEach((arg: any) => visitBody(arg));
    }
    
    if (bodyNode.declarations && Array.isArray(bodyNode.declarations)) {
      bodyNode.declarations.forEach((decl: any) => {
        if (decl.init) {
          visitBody(decl.init);
        }
      });
    }
    
    // 🆕 Visitar await expressions
    if (bodyNode.type === 'AwaitExpression' && bodyNode.argument) {
      visitBody(bodyNode.argument);
    }
    
    // 🆕 Visitar ExpressionStatement (onde expect() normalmente está)
    if (bodyNode.type === 'ExpressionStatement' && bodyNode.expression) {
      visitBody(bodyNode.expression);
    }
  }
  
  visitBody(node);
  
  // Calcular line count
  const startLine = node.loc?.start.line || 0;
  const endLine = node.loc?.end.line || 0;
  const lineCount = endLine - startLine;
  
  return {
    name,
    line,
    given,
    when: when.length > 0 ? when[0] : 'NÃO DETERMINADO',
    then,
    mocks,
    spies,
    hasErrorHandling,
    lineCount,
  };
}

/**
 * Extrai informações de asserção (matcher, valor esperado, etc)
 */
function extractAssertInfo(node: any): AssertInfo | null {
  try {
    // expect(response.status).toBe(200)
    // expect(response.body).toHaveProperty('id')
    // expect(mockFn).toHaveBeenCalledWith(...)
    
    const matcher = extractMatcher(node);
    if (!matcher) return null;
    
    // Tentar extrair o que está sendo testado
    const target = extractExpectTarget(node);
    const expectedValue = extractExpectedValue(node);
    
    return {
      type: categorizeAssertType(target, matcher),
      matcher,
      value: expectedValue,
      path: target,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Extrai matcher (toBe, toEqual, toHaveBeenCalled, etc)
 */
function extractMatcher(node: any): string | undefined {
  if (node.type === 'CallExpression' && node.callee) {
    if (node.callee.type === 'MemberExpression') {
      // expect(...).toBe(...)
      if (node.callee.property && node.callee.property.name) {
        return node.callee.property.name;
      }
      
      // expect(...).not.toBe(...)
      if (node.callee.object && node.callee.object.property) {
        return `not.${node.callee.property.name}`;
      }
    }
  }
  return undefined;
}

/**
 * Extrai target do expect (ex: response.status)
 */
function extractExpectTarget(node: any): string {
  if (node.type === 'CallExpression' && node.callee) {
    if (node.callee.type === 'MemberExpression' && node.callee.object) {
      // expect(...) → extrair argumento
      if (node.callee.object.type === 'CallExpression' && 
          node.callee.object.arguments &&
          node.callee.object.arguments[0]) {
        return extractPropertyPath(node.callee.object.arguments[0]);
      }
    }
  }
  return 'unknown';
}

/**
 * Extrai valor esperado (ex: 200 em toBe(200))
 */
function extractExpectedValue(node: any): any {
  if (node.arguments && node.arguments[0]) {
    const arg = node.arguments[0];
    
    if (arg.type === 'Literal') {
      return arg.value;
    }
    
    if (arg.type === 'Identifier') {
      return arg.name;
    }
    
    if (arg.type === 'ObjectExpression') {
      return '{...}';
    }
    
    if (arg.type === 'ArrayExpression') {
      return '[...]';
    }
  }
  return undefined;
}

/**
 * Extrai path de propriedade (ex: response.body.id → "response.body.id")
 */
function extractPropertyPath(node: any): string {
  if (!node) return 'unknown';
  
  if (node.type === 'MemberExpression') {
    const object = extractPropertyPath(node.object);
    const property = node.property?.name || '?';
    return `${object}.${property}`;
  }
  
  if (node.type === 'Identifier') {
    return node.name;
  }
  
  if (node.type === 'CallExpression') {
    const callee = getCalleeName(node.callee);
    return `${callee}()`;
  }
  
  return 'unknown';
}

/**
 * Categoriza tipo de assert
 */
function categorizeAssertType(target: string, matcher: string): string {
  if (matcher.includes('toHaveBeenCalled') || matcher.includes('toBeCalled')) {
    return 'called';
  }
  
  if (target.includes('.status')) {
    return 'status';
  }
  
  if (target.includes('.headers') || target.includes('.header')) {
    return 'header';
  }
  
  if (target.includes('.body') || target.includes('.data')) {
    return 'body.prop';
  }
  
  if (matcher === 'toBeTruthy' || matcher === 'toBeFalsy' || matcher === 'toBeDefined') {
    return 'generic';
  }
  
  return 'value';
}

/**
 * Extrai target de mock (ex: vi.mock('emailService'))
 */
function extractMockTarget(node: any): string | null {
  if (node.arguments && node.arguments[0]) {
    if (node.arguments[0].type === 'Literal') {
      return node.arguments[0].value;
    }
    if (node.arguments[0].type === 'Identifier') {
      return node.arguments[0].name;
    }
  }
  return null;
}

/**
 * Extrai target de spy
 */
function extractSpyTarget(node: any): string | null {
  return extractMockTarget(node); // Mesma lógica
}

/**
 * Extrai nome do callee (função sendo chamada)
 */
function getCalleeName(callee: any): string {
  if (!callee) return '';
  
  if (callee.type === 'Identifier') {
    return callee.name;
  }
  
  if (callee.type === 'MemberExpression') {
    const object = getCalleeName(callee.object);
    const property = callee.property?.name || '?';
    return `${object}.${property}`;
  }
  
  return '';
}

/**
 * Extrai primeiro argumento string de um call
 */
function getFirstStringArgument(node: any): string {
  if (node.arguments && node.arguments[0]) {
    if (node.arguments[0].type === 'Literal' && typeof node.arguments[0].value === 'string') {
      return node.arguments[0].value;
    }
    if (node.arguments[0].type === 'TemplateLiteral') {
      // Template literal básico
      return node.arguments[0].quasis.map((q: any) => q.value.raw).join('${...}');
    }
  }
  return 'unnamed';
}

/**
 * Calcula força da asserção baseado em heurísticas
 */
export function calculateAssertStrength(testCase: TestCase): 'forte' | 'médio' | 'fraco' {
  const { then, mocks, spies, hasErrorHandling, when } = testCase;
  
  // Sem asserts = fraco
  if (then.length === 0) {
    return 'fraco';
  }
  
  // Só asserts genéricos = fraco
  const genericAsserts = then.filter(a => 
    a.type === 'generic' || 
    a.matcher === 'toBeTruthy' || 
    a.matcher === 'toBeFalsy' ||
    a.matcher === 'toBeDefined'
  );
  
  if (genericAsserts.length === then.length) {
    return 'fraco';
  }
  
  // Só mock calls = fraco
  const onlyCallAsserts = then.every(a => a.type === 'called');
  if (onlyCallAsserts) {
    return 'fraco';
  }
  
  // Excesso de mocks (>3) = penalização
  const excessiveMocks = (mocks.length + spies.length) > 3;
  
  // Forte: status + body/headers + error handling
  const hasStatusAssert = then.some(a => a.type === 'status');
  const hasBodyAssert = then.some(a => a.type === 'body.prop');
  const hasHeaderAssert = then.some(a => a.type === 'header');
  const hasValueAssert = then.some(a => a.type === 'value' && a.matcher !== 'toBeTruthy');
  
  const strongIndicators = [
    hasStatusAssert,
    hasBodyAssert || hasHeaderAssert,
    hasValueAssert,
    hasErrorHandling
  ].filter(Boolean).length;
  
  if (strongIndicators >= 3 && !excessiveMocks) {
    return 'forte';
  }
  
  if (strongIndicators >= 2 || (hasValueAssert && !excessiveMocks)) {
    return 'médio';
  }
  
  return 'fraco';
}

