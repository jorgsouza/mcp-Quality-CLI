/**
 * scaffold-property-tests.ts
 * Gera property-based tests usando fast-check, hypothesis, QuickCheck
 * 
 * FASE 4 - Property-Based Testing: Testa invariantes ao invés de casos específicos
 * Exemplo: "price >= 0" é testado com 1000 valores aleatórios
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { getPaths, ensurePaths } from '../utils/paths.js';
import { detectLanguage } from '../detectors/language.js';
import { existsSync } from 'node:fs';

export interface PropertyTestTarget {
  module: string; // e.g., "billing/pricing"
  invariants: string[]; // e.g., ["price >= 0", "total = sum(items)"]
  functions?: string[]; // Optional: specific functions to test
}

export interface ScaffoldPropertyTestsParams {
  repo: string;
  product: string;
  targets: PropertyTestTarget[];
  auto_detect?: boolean; // Auto-detect modules with math/business logic
}

export interface ScaffoldPropertyTestsResult {
  ok: boolean;
  files_created: string[];
  targets_count: number;
  invariants_count: number;
  error?: string;
}

/**
 * Gera property-based tests
 */
export async function scaffoldPropertyTests(
  params: ScaffoldPropertyTestsParams
): Promise<ScaffoldPropertyTestsResult> {
  const { repo, product, targets, auto_detect = false } = params;

  try {
    const paths = getPaths(repo, product);
    await ensurePaths(paths);

    console.log('🔮 [1/4] Detectando linguagem...');
    const langDetection = await detectLanguage(repo);
    const language = langDetection.primary;
    console.log(`   Linguagem: ${language}`);

    console.log('🎯 [2/4] Preparando targets...');
    let finalTargets = targets;
    
    if (auto_detect && targets.length === 0) {
      console.log('   Auto-detectando módulos candidatos...');
      finalTargets = await autoDetectPropertyTestTargets(repo, language);
      console.log(`   ${finalTargets.length} módulos detectados`);
    }

    console.log('📝 [3/4] Gerando property tests...');
    const filesCreated: string[] = [];
    let totalInvariants = 0;

    for (const target of finalTargets) {
      const files = await generatePropertyTestsForTarget(
        repo,
        paths,
        language,
        target
      );
      filesCreated.push(...files);
      totalInvariants += target.invariants.length;
    }

    console.log('✅ [4/4] Property tests gerados!');
    console.log(`   ${filesCreated.length} arquivo(s) criado(s)`);
    console.log(`   ${totalInvariants} invariante(s) testado(s)`);

    return {
      ok: true,
      files_created: filesCreated,
      targets_count: finalTargets.length,
      invariants_count: totalInvariants,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro ao gerar property tests:', message);
    return {
      ok: false,
      files_created: [],
      targets_count: 0,
      invariants_count: 0,
      error: message,
    };
  }
}

/**
 * Gera property tests para um target específico
 */
async function generatePropertyTestsForTarget(
  repo: string,
  paths: ReturnType<typeof getPaths>,
  language: string,
  target: PropertyTestTarget
): Promise<string[]> {
  const files: string[] = [];

  switch (language) {
    case 'typescript':
    case 'javascript':
      files.push(...await generateTypeScriptPropertyTests(paths, target));
      break;
    case 'python':
      files.push(...await generatePythonPropertyTests(paths, target));
      break;
    case 'go':
      files.push(...await generateGoPropertyTests(paths, target));
      break;
    default:
      console.warn(`   ⚠️  Linguagem ${language} não suportada para property tests`);
  }

  return files;
}

/**
 * Gera property tests TypeScript (fast-check)
 */
async function generateTypeScriptPropertyTests(
  paths: ReturnType<typeof getPaths>,
  target: PropertyTestTarget
): Promise<string[]> {
  const propertyDir = join(paths.unit, 'property');
  await mkdir(propertyDir, { recursive: true });

  const moduleName = target.module.replace(/\//g, '-');
  const filePath = join(propertyDir, `${moduleName}.property.spec.ts`);

  const content = generateFastCheckTemplate(target);
  await writeFile(filePath, content);

  return [filePath];
}

/**
 * Template fast-check (TypeScript)
 */
function generateFastCheckTemplate(target: PropertyTestTarget): string {
  const modulePath = target.module;
  const moduleName = modulePath.split('/').pop() || 'module';
  
  // Gerar imports de funções se especificadas
  const functionImports = target.functions && target.functions.length > 0
    ? target.functions.join(', ')
    : 'calculateTotal, validatePrice, processOrder';

  // Gerar testes para cada invariante
  const propertyTests = target.invariants.map((invariant, idx) => {
    return generatePropertyTestCase(invariant, idx);
  }).join('\n\n');

  return `/**
 * Property-Based Tests para ${modulePath}
 * Gerado automaticamente pelo MCP Quality CLI
 * 
 * Framework: fast-check
 * Invariantes testados: ${target.invariants.length}
 */

import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { ${functionImports} } from '../../src/${modulePath}';

describe('${moduleName} - Property-Based Tests', () => {
  ${propertyTests}

  // Exemplo adicional: Idempotência
  it('property: calling function twice with same input produces same output', () => {
    fc.assert(
      fc.property(
        fc.record({
          price: fc.nat({ max: 100000 }),
          quantity: fc.nat({ max: 1000 })
        }),
        (input) => {
          const result1 = calculateTotal([input]);
          const result2 = calculateTotal([input]);
          return result1 === result2;
        }
      ),
      { numRuns: 1000 } // Testa com 1000 casos aleatórios
    );
  });

  // Exemplo: Comutatividade
  it('property: order of items should not affect total', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          price: fc.nat({ max: 10000 }),
          quantity: fc.nat({ max: 100 })
        })),
        (items) => {
          const total1 = calculateTotal(items);
          const reversed = [...items].reverse();
          const total2 = calculateTotal(reversed);
          return total1 === total2;
        }
      )
    );
  });
});
`;
}

/**
 * Gera um caso de teste para um invariante
 */
function generatePropertyTestCase(invariant: string, index: number): string {
  // Parse invariant para entender tipo de teste
  const testName = `property: ${invariant}`;
  
  // Templates baseados em padrões comuns
  if (invariant.includes('>=') || invariant.includes('<=')) {
    // Invariantes de limites (bounds)
    const [expr, limit] = invariant.split(/[<>=]+/).map(s => s.trim());
    const operator = invariant.includes('>=') ? '>=' : '<=';
    
    return `  it('${testName}', () => {
    fc.assert(
      fc.property(
        fc.record({
          price: fc.nat({ max: 100000 }),
          quantity: fc.nat({ max: 1000 })
        }),
        (item) => {
          const result = calculateTotal([item]);
          return result ${operator} ${limit};
        }
      ),
      { numRuns: 1000 }
    );
  });`;
  }
  
  if (invariant.includes('=') && invariant.includes('sum')) {
    // Invariantes de soma
    return `  it('${testName}', () => {
    fc.assert(
      fc.property(
        fc.array(fc.record({
          price: fc.nat({ max: 10000 }),
          quantity: fc.nat({ max: 100 })
        })),
        (items) => {
          const total = calculateTotal(items);
          const expected = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
          return Math.abs(total - expected) < 0.01; // Float precision
        }
      )
    );
  });`;
  }
  
  // Fallback genérico
  return `  it('${testName}', () => {
    fc.assert(
      fc.property(
        fc.anything(),
        (input) => {
          // TODO: Implementar validação para: ${invariant}
          return true;
        }
      )
    );
  });`;
}

/**
 * Gera property tests Python (hypothesis)
 */
async function generatePythonPropertyTests(
  paths: ReturnType<typeof getPaths>,
  target: PropertyTestTarget
): Promise<string[]> {
  const propertyDir = join(paths.unit, 'property');
  await mkdir(propertyDir, { recursive: true });

  const moduleName = target.module.replace(/\//g, '_');
  const filePath = join(propertyDir, `test_${moduleName}_property.py`);

  const content = generateHypothesisTemplate(target);
  await writeFile(filePath, content);

  return [filePath];
}

/**
 * Template hypothesis (Python)
 */
function generateHypothesisTemplate(target: PropertyTestTarget): string {
  const modulePath = target.module;
  
  return `"""
Property-Based Tests para ${modulePath}
Gerado automaticamente pelo MCP Quality CLI

Framework: hypothesis
Invariantes testados: ${target.invariants.length}
"""

import pytest
from hypothesis import given, strategies as st
from src.${modulePath.replace(/\//g, '.')} import calculate_total, validate_price

class TestPropertyBased:
    """Property-based tests usando Hypothesis"""
    
    ${target.invariants.map((inv, idx) => `
    @given(st.integers(min_value=0, max_value=1000000))
    def test_invariant_${idx + 1}(self, value):
        """${inv}"""
        result = calculate_total([{"price": value, "quantity": 1}])
        assert result >= 0, "${inv}"
    `).join('\n')}
    
    @given(st.lists(st.integers(min_value=0, max_value=10000)))
    def test_sum_equals_total(self, prices):
        """Total deve ser igual à soma dos itens"""
        items = [{"price": p, "quantity": 1} for p in prices]
        total = calculate_total(items)
        expected = sum(prices)
        assert total == expected
    
    @given(st.lists(st.integers(min_value=0, max_value=10000)))
    def test_idempotence(self, prices):
        """Chamar função duas vezes deve dar mesmo resultado"""
        items = [{"price": p, "quantity": 1} for p in prices]
        result1 = calculate_total(items)
        result2 = calculate_total(items)
        assert result1 == result2
`;
}

/**
 * Gera property tests Go (QuickCheck)
 */
async function generateGoPropertyTests(
  paths: ReturnType<typeof getPaths>,
  target: PropertyTestTarget
): Promise<string[]> {
  const propertyDir = join(paths.unit, 'property');
  await mkdir(propertyDir, { recursive: true });

  const moduleName = target.module.replace(/\//g, '_');
  const filePath = join(propertyDir, `${moduleName}_property_test.go`);

  const content = generateQuickCheckTemplate(target);
  await writeFile(filePath, content);

  return [filePath];
}

/**
 * Template QuickCheck (Go)
 */
function generateQuickCheckTemplate(target: PropertyTestTarget): string {
  return `package ${target.module.split('/').pop()}

import (
    "testing"
    "testing/quick"
)

// Property-Based Tests gerados automaticamente
// Framework: testing/quick (built-in Go)
// Invariantes: ${target.invariants.length}

${target.invariants.map((inv, idx) => `
func TestProperty_Invariant${idx + 1}(t *testing.T) {
    // ${inv}
    f := func(price, quantity uint) bool {
        total := CalculateTotal([]Item{{Price: int(price), Quantity: int(quantity)}})
        return total >= 0 // Invariant: result must be non-negative
    }
    
    if err := quick.Check(f, nil); err != nil {
        t.Error(err)
    }
}
`).join('\n')}

func TestProperty_Commutativity(t *testing.T) {
    f := func(items []Item) bool {
        total1 := CalculateTotal(items)
        reversed := reverse(items)
        total2 := CalculateTotal(reversed)
        return total1 == total2
    }
    
    if err := quick.Check(f, nil); err != nil {
        t.Error(err)
    }
}

func reverse(items []Item) []Item {
    result := make([]Item, len(items))
    for i, item := range items {
        result[len(items)-1-i] = item
    }
    return result
}
`;
}

/**
 * Auto-detecta módulos candidatos para property tests
 */
async function autoDetectPropertyTestTargets(
  repo: string,
  language: string
): Promise<PropertyTestTarget[]> {
  // Candidatos comuns baseados em nomes de módulos
  const commonCandidates: PropertyTestTarget[] = [
    {
      module: 'billing/pricing',
      invariants: [
        'price >= 0',
        'total = sum(items)',
        'discount <= original_price',
      ],
    },
    {
      module: 'cart/calculator',
      invariants: [
        'total >= 0',
        'total = sum(item.price * item.quantity)',
        'empty cart has total = 0',
      ],
    },
    {
      module: 'inventory/stock',
      invariants: [
        'stock >= 0',
        'stock_after_sale = stock_before - quantity',
        'cannot sell more than available',
      ],
    },
    {
      module: 'utils/math',
      invariants: [
        'result is finite',
        'division by zero returns error',
        'negative inputs handled correctly',
      ],
    },
  ];

  // Filtrar apenas os que existem no projeto
  const existingTargets: PropertyTestTarget[] = [];
  
  for (const candidate of commonCandidates) {
    const possiblePaths = [
      join(repo, 'src', candidate.module + '.ts'),
      join(repo, 'src', candidate.module + '.js'),
      join(repo, 'src', candidate.module, 'index.ts'),
      join(repo, candidate.module + '.py'),
      join(repo, candidate.module + '.go'),
    ];

    if (possiblePaths.some(p => existsSync(p))) {
      existingTargets.push(candidate);
    }
  }

  // Se não encontrou nenhum, retornar template genérico
  if (existingTargets.length === 0) {
    return [{
      module: 'utils/calculator',
      invariants: [
        'result >= 0',
        'result is finite',
        'idempotent operation',
      ],
      functions: ['calculate', 'process', 'validate'],
    }];
  }

  return existingTargets;
}

