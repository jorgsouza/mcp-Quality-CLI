/**
 * scaffold-approval-tests.ts
 * Gera Approval/Golden Master tests para código legado complexo
 * 
 * FASE 5 - Approval Testing: Captura saída atual como "golden master" e detecta mudanças
 * Ideal para: legacy code, relatórios complexos, PDFs, HTML, XML
 */

import { writeFile, mkdir, readdir } from 'node:fs/promises';
import { join } from 'node:path';
import { getPaths, ensurePaths } from '../utils/paths.js';
import { detectLanguage } from '../detectors/language.js';
import { existsSync } from 'node:fs';

export interface ApprovalTestTarget {
  module: string; // e.g., "reports/invoice-generator"
  output_format: 'json' | 'html' | 'pdf' | 'xml' | 'text';
  sample_inputs?: any[]; // Optional: sample data for golden masters
  description?: string;
}

export interface ScaffoldApprovalTestsParams {
  repo: string;
  product: string;
  targets: ApprovalTestTarget[];
  auto_detect?: boolean; // Auto-detect legacy modules
}

export interface ScaffoldApprovalTestsResult {
  ok: boolean;
  files_created: string[];
  targets_count: number;
  fixtures_created: number;
  error?: string;
}

/**
 * Gera approval/golden master tests
 */
export async function scaffoldApprovalTests(
  params: ScaffoldApprovalTestsParams
): Promise<ScaffoldApprovalTestsResult> {
  const { repo, product, targets, auto_detect = false } = params;

  try {
    const paths = getPaths(repo, product);
    await ensurePaths(paths);

    console.log('📸 [1/5] Detectando linguagem...');
    const langDetection = await detectLanguage(repo);
    const language = langDetection.primary;
    console.log(`   Linguagem: ${language}`);

    console.log('🔍 [2/5] Preparando targets...');
    let finalTargets = targets;
    
    if (auto_detect && targets.length === 0) {
      console.log('   Auto-detectando módulos legados...');
      finalTargets = await autoDetectApprovalTestTargets(repo, language);
      console.log(`   ${finalTargets.length} módulos detectados`);
    }

    console.log('🏗️  [3/5] Criando estrutura de aprovação...');
    const testsDir = join(paths.root, 'tests');
    const approvalDir = join(testsDir, 'approval');
    await mkdir(approvalDir, { recursive: true });

    console.log('📝 [4/5] Gerando approval tests...');
    const filesCreated: string[] = [];
    let fixturesCreated = 0;

    for (const target of finalTargets) {
      const result = await generateApprovalTestsForTarget(
        repo,
        paths,
        language,
        target
      );
      filesCreated.push(...result.files);
      fixturesCreated += result.fixtures;
    }

    console.log('✅ [5/5] Approval tests gerados!');
    console.log(`   ${filesCreated.length} arquivo(s) criado(s)`);
    console.log(`   ${fixturesCreated} fixture(s) criado(s)`);

    return {
      ok: true,
      files_created: filesCreated,
      targets_count: finalTargets.length,
      fixtures_created: fixturesCreated,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro ao gerar approval tests:', message);
    return {
      ok: false,
      files_created: [],
      targets_count: 0,
      fixtures_created: 0,
      error: message,
    };
  }
}

/**
 * Gera approval tests para um target específico
 */
async function generateApprovalTestsForTarget(
  repo: string,
  paths: ReturnType<typeof getPaths>,
  language: string,
  target: ApprovalTestTarget
): Promise<{ files: string[]; fixtures: number }> {
  const files: string[] = [];
  let fixtures = 0;

  switch (language) {
    case 'typescript':
    case 'javascript': {
      const result = await generateTypeScriptApprovalTests(paths, target);
      files.push(...result.files);
      fixtures = result.fixtures;
      break;
    }
    case 'python': {
      const result = await generatePythonApprovalTests(paths, target);
      files.push(...result.files);
      fixtures = result.fixtures;
      break;
    }
    default:
      console.warn(`   ⚠️  Linguagem ${language} não suportada para approval tests`);
  }

  return { files, fixtures };
}

/**
 * Gera approval tests TypeScript (Jest snapshots)
 */
async function generateTypeScriptApprovalTests(
  paths: ReturnType<typeof getPaths>,
  target: ApprovalTestTarget
): Promise<{ files: string[]; fixtures: number }> {
  const testsDir = join(paths.root, 'tests');
  const approvalDir = join(testsDir, 'approval');
  const moduleName = target.module.replace(/\//g, '-');
  const testFile = join(approvalDir, `${moduleName}.approval.spec.ts`);
  const fixturesDir = join(approvalDir, '__fixtures__', moduleName);

  await mkdir(fixturesDir, { recursive: true });

  // Gerar arquivo de teste
  const content = generateJestSnapshotTemplate(target);
  await writeFile(testFile, content);

  // Gerar fixtures de exemplo
  const fixtures = await generateSampleFixtures(fixturesDir, target);

  return {
    files: [testFile, ...fixtures],
    fixtures: fixtures.length,
  };
}

/**
 * Template Jest Snapshots (TypeScript)
 */
function generateJestSnapshotTemplate(target: ApprovalTestTarget): string {
  const modulePath = target.module;
  const moduleName = modulePath.split('/').pop() || 'module';
  const functionName = `generate${moduleName.charAt(0).toUpperCase() + moduleName.slice(1)}`;

  return `/**
 * Approval Tests para ${modulePath}
 * Gerado automaticamente pelo MCP Quality CLI
 * 
 * Framework: Jest Snapshots / toMatchSnapshot
 * Output Format: ${target.output_format}
 * 
 * IMPORTANTE: 
 * - Primeira execução captura o "golden master"
 * - Execuções seguintes comparam com o snapshot
 * - Se a mudança é intencional: npm test -- -u (update snapshots)
 */

import { describe, it, expect } from 'vitest';
import { ${functionName} } from '../../src/${modulePath}';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('${moduleName} - Approval Tests', () => {
  const fixturesDir = join(__dirname, '__fixtures__', '${moduleName.replace(/\//g, '-')}');

  /**
   * Teste básico: Captura snapshot do output
   */
  it('should match snapshot for default input', () => {
    const input = {
      id: '12345',
      date: '2025-11-04',
      items: [
        { name: 'Item 1', price: 100, quantity: 2 },
        { name: 'Item 2', price: 50, quantity: 1 },
      ],
    };

    const output = ${functionName}(input);
    expect(output).toMatchSnapshot();
  });

  /**
   * Teste com fixture: Compara output com arquivo golden master
   */
  it('should match golden master for sample-1', () => {
    const inputPath = join(fixturesDir, 'sample-1-input.json');
    const expectedPath = join(fixturesDir, 'sample-1-expected.${target.output_format}');

    // Carregar input
    const input = JSON.parse(readFileSync(inputPath, 'utf-8'));

    // Gerar output
    const output = ${functionName}(input);

    // Comparar com golden master
    if (existsSync(expectedPath)) {
      const expected = readFileSync(expectedPath, 'utf-8');
      expect(output${target.output_format === 'json' ? '' : '.toString()'}).toBe(expected);
    } else {
      // Primeira execução: salvar como golden master
      console.log('📸 Salvando golden master:', expectedPath);
      // expect(output).toMatchSnapshot(); // Uncomment to save
    }
  });

  /**
   * Teste de regressão: Múltiplos casos
   */
  describe('regression tests', () => {
    const testCases = [
      { id: 'empty-cart', items: [] },
      { id: 'single-item', items: [{ name: 'Test', price: 100, quantity: 1 }] },
      { id: 'many-items', items: Array(10).fill({ name: 'Item', price: 10, quantity: 1 }) },
      { id: 'high-values', items: [{ name: 'Expensive', price: 999999, quantity: 100 }] },
    ];

    testCases.forEach(testCase => {
      it(\`should match snapshot for \${testCase.id}\`, () => {
        const output = ${functionName}({ id: testCase.id, items: testCase.items });
        expect(output).toMatchSnapshot();
      });
    });
  });

  /**
   * Teste de formato: Validar estrutura do output
   */
  it('should maintain output format structure', () => {
    const output = ${functionName}({ id: 'test', items: [] });
    
    ${getFormatValidation(target.output_format)}
  });
});

/**
 * Helper: Verifica se arquivo existe
 */
function existsSync(path: string): boolean {
  try {
    readFileSync(path);
    return true;
  } catch {
    return false;
  }
}
`;
}

/**
 * Gera validação específica por formato
 */
function getFormatValidation(format: string): string {
  switch (format) {
    case 'json':
      return `    expect(() => JSON.parse(output)).not.toThrow();
    const parsed = JSON.parse(output);
    expect(parsed).toHaveProperty('id');
    expect(parsed).toHaveProperty('total');`;
    
    case 'html':
      return `    expect(output).toContain('<!DOCTYPE html>');
    expect(output).toContain('<html');
    expect(output).toContain('</html>');`;
    
    case 'xml':
      return `    expect(output).toContain('<?xml version');
    expect(output).toContain('<root');
    expect(output).toContain('</root>');`;
    
    case 'pdf':
      return `    expect(output).toBeInstanceOf(Buffer);
    expect(output.toString('utf-8', 0, 4)).toBe('%PDF');`;
    
    default:
      return `    expect(typeof output).toBe('string');
    expect(output.length).toBeGreaterThan(0);`;
  }
}

/**
 * Gera fixtures de exemplo
 */
async function generateSampleFixtures(
  fixturesDir: string,
  target: ApprovalTestTarget
): Promise<string[]> {
  const fixtures: string[] = [];

  // Sample 1: Input básico
  const sample1Input = {
    id: 'sample-1',
    date: '2025-11-04',
    items: [
      { name: 'Product A', price: 100, quantity: 2 },
      { name: 'Product B', price: 50, quantity: 1 },
    ],
  };

  const inputPath = join(fixturesDir, 'sample-1-input.json');
  await writeFile(inputPath, JSON.stringify(sample1Input, null, 2));
  fixtures.push(inputPath);

  // Sample 1: Expected output (placeholder)
  const expectedPath = join(fixturesDir, `sample-1-expected.${target.output_format}`);
  const expectedContent = generateExpectedOutput(target.output_format, sample1Input);
  await writeFile(expectedPath, expectedContent);
  fixtures.push(expectedPath);

  return fixtures;
}

/**
 * Gera conteúdo esperado baseado no formato
 */
function generateExpectedOutput(format: string, input: any): string {
  switch (format) {
    case 'json':
      return JSON.stringify({
        id: input.id,
        total: 250,
        items: input.items,
        generated_at: '2025-11-04T00:00:00Z',
      }, null, 2);
    
    case 'html':
      return `<!DOCTYPE html>
<html>
<head><title>Report ${input.id}</title></head>
<body>
  <h1>Report ${input.id}</h1>
  <p>Total: $250</p>
</body>
</html>`;
    
    case 'xml':
      return `<?xml version="1.0" encoding="UTF-8"?>
<report id="${input.id}">
  <total>250</total>
  <items count="${input.items.length}" />
</report>`;
    
    default:
      return `Report ${input.id}\nTotal: $250\nItems: ${input.items.length}`;
  }
}

/**
 * Gera approval tests Python (pytest-regtest)
 */
async function generatePythonApprovalTests(
  paths: ReturnType<typeof getPaths>,
  target: ApprovalTestTarget
): Promise<{ files: string[]; fixtures: number }> {
  const testsDir = join(paths.root, 'tests');
  const approvalDir = join(testsDir, 'approval');
  const moduleName = target.module.replace(/\//g, '_');
  const testFile = join(approvalDir, `test_${moduleName}_approval.py`);

  const content = generatePytestRegtestTemplate(target);
  await writeFile(testFile, content);

  return { files: [testFile], fixtures: 0 };
}

/**
 * Template pytest-regtest (Python)
 */
function generatePytestRegtestTemplate(target: ApprovalTestTarget): string {
  return `"""
Approval Tests para ${target.module}
Gerado automaticamente pelo MCP Quality CLI

Framework: pytest-regtest (ou approvaltests)
Output Format: ${target.output_format}

IMPORTANTE:
- Primeira execução captura o output atual
- Execuções seguintes comparam com o arquivo .out
- Para aprovar mudanças: pytest --regtest-reset
"""

import pytest
from src.${target.module.replace(/\//g, '.')} import generate_report

class TestApproval:
    """Approval tests para detectar mudanças não intencionais"""
    
    def test_default_output(self, regtest):
        """Captura snapshot do output padrão"""
        input_data = {
            "id": "12345",
            "items": [
                {"name": "Item 1", "price": 100, "quantity": 2},
                {"name": "Item 2", "price": 50, "quantity": 1}
            ]
        }
        
        output = generate_report(input_data)
        print(output, file=regtest)
    
    def test_empty_input(self, regtest):
        """Testa comportamento com input vazio"""
        output = generate_report({"id": "empty", "items": []})
        print(output, file=regtest)
    
    def test_large_dataset(self, regtest):
        """Testa com dataset grande"""
        items = [{"name": f"Item {i}", "price": 10, "quantity": 1} for i in range(100)]
        output = generate_report({"id": "large", "items": items})
        print(output, file=regtest)
`;
}

/**
 * Auto-detecta módulos candidatos para approval tests
 */
async function autoDetectApprovalTestTargets(
  repo: string,
  language: string
): Promise<ApprovalTestTarget[]> {
  const candidates: ApprovalTestTarget[] = [
    {
      module: 'reports/invoice-generator',
      output_format: 'pdf',
      description: 'Invoice PDF generation',
    },
    {
      module: 'reports/summary-generator',
      output_format: 'html',
      description: 'HTML summary reports',
    },
    {
      module: 'exports/data-exporter',
      output_format: 'xml',
      description: 'XML data export',
    },
    {
      module: 'api/response-formatter',
      output_format: 'json',
      description: 'API response formatting',
    },
  ];

  // Filtrar apenas os que existem
  const existingTargets: ApprovalTestTarget[] = [];
  
  for (const candidate of candidates) {
    const possiblePaths = [
      join(repo, 'src', candidate.module + '.ts'),
      join(repo, 'src', candidate.module + '.js'),
      join(repo, 'src', candidate.module, 'index.ts'),
      join(repo, candidate.module + '.py'),
    ];

    if (possiblePaths.some(p => existsSync(p))) {
      existingTargets.push(candidate);
    }
  }

  // Fallback genérico
  if (existingTargets.length === 0) {
    return [{
      module: 'utils/formatter',
      output_format: 'json',
      description: 'Generic output formatter',
    }];
  }

  return existingTargets;
}

