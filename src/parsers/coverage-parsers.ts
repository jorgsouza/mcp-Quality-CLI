/**
 * Coverage Parsers
 * 
 * Parsers unificados para diferentes formatos de cobertura:
 * - Cobertura XML (Python/Java)
 * - JaCoCo XML (Java)
 * - LCOV (JavaScript/TypeScript)
 * - Go coverage.out
 * - Clover XML (PHP)
 * - SimpleCov JSON (Ruby)
 * 
 * FASE C.3 - Coverage Parsers
 * 
 * @see ROADMAP-V1-COMPLETO.md (Fase C.3)
 */

import { promises as fs } from 'node:fs';
import type { Coverage, CoverageMetric, FileCoverage } from '../adapters/base/LanguageAdapter.js';

/**
 * Parseia arquivo Cobertura XML (Python/Java)
 * 
 * @param filePath - Caminho do arquivo coverage.xml
 * @returns Métricas de cobertura padronizadas
 * 
 * @example
 * ```typescript
 * const coverage = await parseCoberturaXml('coverage.xml');
 * console.log(`Cobertura de linhas: ${coverage.lines.pct}%`);
 * ```
 */
export async function parseCoberturaXml(filePath: string): Promise<Coverage> {
  const content = await fs.readFile(filePath, 'utf-8');

  // Parse simplificado (em produção, usar parser XML robusto como fast-xml-parser)
  // Formato: <coverage line-rate="0.85" branch-rate="0.78" lines-covered="850" lines-valid="1000" ...>

  const lineRateMatch = content.match(/line-rate="([\d.]+)"/);
  const branchRateMatch = content.match(/branch-rate="([\d.]+)"/);
  const linesValidMatch = content.match(/lines-valid="(\d+)"/);
  const linesCoveredMatch = content.match(/lines-covered="(\d+)"/);
  const branchesValidMatch = content.match(/branches-valid="(\d+)"/);
  const branchesCoveredMatch = content.match(/branches-covered="(\d+)"/);

  const lineRate = lineRateMatch ? parseFloat(lineRateMatch[1]) : 0;
  const branchRate = branchRateMatch ? parseFloat(branchRateMatch[1]) : 0;
  const linesValid = linesValidMatch ? parseInt(linesValidMatch[1]) : 0;
  const linesCovered = linesCoveredMatch ? parseInt(linesCoveredMatch[1]) : 0;
  const branchesValid = branchesValidMatch ? parseInt(branchesValidMatch[1]) : 0;
  const branchesCovered = branchesCoveredMatch ? parseInt(branchesCoveredMatch[1]) : 0;

  return {
    lines: {
      total: linesValid,
      covered: linesCovered,
      skipped: 0,
      pct: lineRate * 100,
    },
    functions: {
      total: 0,
      covered: 0,
      skipped: 0,
      pct: 0,
    },
    branches: {
      total: branchesValid,
      covered: branchesCovered,
      skipped: 0,
      pct: branchRate * 100,
    },
    statements: {
      total: linesValid,
      covered: linesCovered,
      skipped: 0,
      pct: lineRate * 100,
    },
  };
}

/**
 * Parseia arquivo JaCoCo XML (Java)
 * 
 * @param filePath - Caminho do arquivo jacoco.xml
 * @returns Métricas de cobertura padronizadas
 * 
 * @example
 * ```typescript
 * const coverage = await parseJaCoCoXml('target/site/jacoco/jacoco.xml');
 * console.log(`Cobertura de branches: ${coverage.branches.pct}%`);
 * ```
 */
export async function parseJaCoCoXml(filePath: string): Promise<Coverage> {
  const content = await fs.readFile(filePath, 'utf-8');

  // Formato JaCoCo: <counter type="LINE" missed="150" covered="850"/>
  const lines = content.match(/<counter type="LINE" missed="(\d+)" covered="(\d+)"\/>/);
  const branches = content.match(/<counter type="BRANCH" missed="(\d+)" covered="(\d+)"\/>/);
  const methods = content.match(/<counter type="METHOD" missed="(\d+)" covered="(\d+)"\/>/);
  const instructions = content.match(/<counter type="INSTRUCTION" missed="(\d+)" covered="(\d+)"\/>/);

  const linesMissed = lines ? parseInt(lines[1]) : 0;
  const linesCovered = lines ? parseInt(lines[2]) : 0;
  const linesTotal = linesMissed + linesCovered;

  const branchesMissed = branches ? parseInt(branches[1]) : 0;
  const branchesCovered = branches ? parseInt(branches[2]) : 0;
  const branchesTotal = branchesMissed + branchesCovered;

  const methodsMissed = methods ? parseInt(methods[1]) : 0;
  const methodsCovered = methods ? parseInt(methods[2]) : 0;
  const methodsTotal = methodsMissed + methodsCovered;

  const instructionsMissed = instructions ? parseInt(instructions[1]) : 0;
  const instructionsCovered = instructions ? parseInt(instructions[2]) : 0;
  const instructionsTotal = instructionsMissed + instructionsCovered;

  return {
    lines: {
      total: linesTotal,
      covered: linesCovered,
      skipped: 0,
      pct: linesTotal > 0 ? (linesCovered / linesTotal) * 100 : 0,
    },
    functions: {
      total: methodsTotal,
      covered: methodsCovered,
      skipped: 0,
      pct: methodsTotal > 0 ? (methodsCovered / methodsTotal) * 100 : 0,
    },
    branches: {
      total: branchesTotal,
      covered: branchesCovered,
      skipped: 0,
      pct: branchesTotal > 0 ? (branchesCovered / branchesTotal) * 100 : 0,
    },
    statements: {
      total: instructionsTotal,
      covered: instructionsCovered,
      skipped: 0,
      pct: instructionsTotal > 0 ? (instructionsCovered / instructionsTotal) * 100 : 0,
    },
  };
}

/**
 * Parseia arquivo LCOV (JavaScript/TypeScript)
 * 
 * @param filePath - Caminho do arquivo lcov.info
 * @returns Métricas de cobertura padronizadas
 * 
 * @example
 * ```typescript
 * const coverage = await parseLcov('coverage/lcov.info');
 * console.log(`Cobertura de funções: ${coverage.functions.pct}%`);
 * ```
 */
export async function parseLcov(filePath: string): Promise<Coverage> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n');

  let totalLines = 0;
  let coveredLines = 0;
  let totalFunctions = 0;
  let coveredFunctions = 0;
  let totalBranches = 0;
  let coveredBranches = 0;

  for (const line of lines) {
    // Lines
    if (line.startsWith('LF:')) {
      totalLines += parseInt(line.substring(3));
    } else if (line.startsWith('LH:')) {
      coveredLines += parseInt(line.substring(3));
    }
    // Functions
    else if (line.startsWith('FNF:')) {
      totalFunctions += parseInt(line.substring(4));
    } else if (line.startsWith('FNH:')) {
      coveredFunctions += parseInt(line.substring(4));
    }
    // Branches
    else if (line.startsWith('BRF:')) {
      totalBranches += parseInt(line.substring(4));
    } else if (line.startsWith('BRH:')) {
      coveredBranches += parseInt(line.substring(4));
    }
  }

  return {
    lines: {
      total: totalLines,
      covered: coveredLines,
      skipped: 0,
      pct: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
    },
    functions: {
      total: totalFunctions,
      covered: coveredFunctions,
      skipped: 0,
      pct: totalFunctions > 0 ? (coveredFunctions / totalFunctions) * 100 : 0,
    },
    branches: {
      total: totalBranches,
      covered: coveredBranches,
      skipped: 0,
      pct: totalBranches > 0 ? (coveredBranches / totalBranches) * 100 : 0,
    },
    statements: {
      total: totalLines,
      covered: coveredLines,
      skipped: 0,
      pct: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
    },
  };
}

/**
 * Parseia arquivo Go coverage.out
 * 
 * @param filePath - Caminho do arquivo coverage.out
 * @returns Métricas de cobertura padronizadas
 * 
 * @example
 * ```typescript
 * const coverage = await parseGoCoverageOut('coverage.out');
 * console.log(`Cobertura de statements: ${coverage.statements.pct}%`);
 * ```
 */
export async function parseGoCoverageOut(filePath: string): Promise<Coverage> {
  const content = await fs.readFile(filePath, 'utf-8');
  const lines = content.split('\n').filter((line) => line && !line.startsWith('mode:'));

  let totalStatements = 0;
  let coveredStatements = 0;

  // Formato: package/file.go:10.5,12.2 1 1
  // [file]:[startLine].[startCol],[endLine].[endCol] [numStmt] [count]
  for (const line of lines) {
    const parts = line.split(' ');
    if (parts.length >= 3) {
      const statements = parseInt(parts[1]);
      const count = parseInt(parts[2]);

      totalStatements += statements;
      if (count > 0) {
        coveredStatements += statements;
      }
    }
  }

  const pct = totalStatements > 0 ? (coveredStatements / totalStatements) * 100 : 0;

  return {
    lines: {
      total: totalStatements,
      covered: coveredStatements,
      skipped: 0,
      pct,
    },
    functions: {
      total: 0,
      covered: 0,
      skipped: 0,
      pct: 0,
    },
    branches: {
      total: 0,
      covered: 0,
      skipped: 0,
      pct: 0,
    },
    statements: {
      total: totalStatements,
      covered: coveredStatements,
      skipped: 0,
      pct,
    },
  };
}

/**
 * Parseia arquivo Clover XML (PHP)
 * 
 * @param filePath - Caminho do arquivo clover.xml
 * @returns Métricas de cobertura padronizadas
 */
export async function parseCloverXml(filePath: string): Promise<Coverage> {
  const content = await fs.readFile(filePath, 'utf-8');

  // Formato: <metrics statements="1000" coveredstatements="850" ...>
  const statements = content.match(/statements="(\d+)"/);
  const coveredStatements = content.match(/coveredstatements="(\d+)"/);
  const methods = content.match(/methods="(\d+)"/);
  const coveredMethods = content.match(/coveredmethods="(\d+)"/);
  const elements = content.match(/elements="(\d+)"/);
  const coveredElements = content.match(/coveredelements="(\d+)"/);

  const statementsTotal = statements ? parseInt(statements[1]) : 0;
  const statementsCovered = coveredStatements ? parseInt(coveredStatements[1]) : 0;
  const methodsTotal = methods ? parseInt(methods[1]) : 0;
  const methodsCovered = coveredMethods ? parseInt(coveredMethods[1]) : 0;
  const elementsTotal = elements ? parseInt(elements[1]) : 0;
  const elementsCovered = coveredElements ? parseInt(coveredElements[1]) : 0;

  return {
    lines: {
      total: elementsTotal,
      covered: elementsCovered,
      skipped: 0,
      pct: elementsTotal > 0 ? (elementsCovered / elementsTotal) * 100 : 0,
    },
    functions: {
      total: methodsTotal,
      covered: methodsCovered,
      skipped: 0,
      pct: methodsTotal > 0 ? (methodsCovered / methodsTotal) * 100 : 0,
    },
    branches: {
      total: 0,
      covered: 0,
      skipped: 0,
      pct: 0,
    },
    statements: {
      total: statementsTotal,
      covered: statementsCovered,
      skipped: 0,
      pct: statementsTotal > 0 ? (statementsCovered / statementsTotal) * 100 : 0,
    },
  };
}

/**
 * Parseia arquivo SimpleCov JSON (Ruby)
 * 
 * @param filePath - Caminho do arquivo .resultset.json
 * @returns Métricas de cobertura padronizadas
 */
export async function parseSimpleCovJson(filePath: string): Promise<Coverage> {
  const content = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(content);

  // SimpleCov format é complexo, fazer parse básico
  // { "RSpec": { "coverage": { "file.rb": [1, 0, 1, null, ...] } } }
  
  let totalLines = 0;
  let coveredLines = 0;

  // Iterar sobre resultsets
  for (const resultSet of Object.values(data)) {
    const coverage = (resultSet as any).coverage || {};

    for (const file of Object.values(coverage)) {
      const lines = file as (number | null)[];

      for (const count of lines) {
        if (count !== null) {
          totalLines++;
          if (count > 0) {
            coveredLines++;
          }
        }
      }
    }
  }

  const pct = totalLines > 0 ? (coveredLines / totalLines) * 100 : 0;

  return {
    lines: {
      total: totalLines,
      covered: coveredLines,
      skipped: 0,
      pct,
    },
    functions: {
      total: 0,
      covered: 0,
      skipped: 0,
      pct: 0,
    },
    branches: {
      total: 0,
      covered: 0,
      skipped: 0,
      pct: 0,
    },
    statements: {
      total: totalLines,
      covered: coveredLines,
      skipped: 0,
      pct,
    },
  };
}

/**
 * Parseia arquivo Istanbul JSON (JavaScript/TypeScript alternativo)
 * 
 * @param filePath - Caminho do arquivo coverage-summary.json
 * @returns Métricas de cobertura padronizadas
 */
export async function parseIstanbulJson(filePath: string): Promise<Coverage> {
  const content = await fs.readFile(filePath, 'utf-8');
  const data = JSON.parse(content);

  // Istanbul format: { "total": { "lines": {...}, "functions": {...} } }
  const total = data.total || data;

  return {
    lines: parseCoverageMetricFromIstanbul(total.lines),
    functions: parseCoverageMetricFromIstanbul(total.functions),
    branches: parseCoverageMetricFromIstanbul(total.branches),
    statements: parseCoverageMetricFromIstanbul(total.statements),
  };
}

/**
 * Helper: Parseia métrica de cobertura do formato Istanbul
 */
function parseCoverageMetricFromIstanbul(metric: any): CoverageMetric {
  if (!metric) {
    return { total: 0, covered: 0, skipped: 0, pct: 0 };
  }

  return {
    total: metric.total || 0,
    covered: metric.covered || 0,
    skipped: metric.skipped || 0,
    pct: metric.pct || 0,
  };
}

/**
 * Detecta formato de cobertura automaticamente e parseia
 * 
 * @param filePath - Caminho do arquivo de cobertura
 * @returns Métricas de cobertura padronizadas
 * 
 * @example
 * ```typescript
 * const coverage = await parseCoverageAuto('coverage.xml');
 * // Detecta automaticamente: Cobertura XML, JaCoCo, etc
 * ```
 */
export async function parseCoverageAuto(filePath: string): Promise<Coverage> {
  const content = await fs.readFile(filePath, 'utf-8');

  // Detectar formato baseado em conteúdo
  if (filePath.endsWith('.xml')) {
    // XML - determinar se é Cobertura, JaCoCo ou Clover
    if (content.includes('<!DOCTYPE coverage SYSTEM')) {
      return parseCoberturaXml(filePath);
    } else if (content.includes('<report name="JaCoCo')) {
      return parseJaCoCoXml(filePath);
    } else if (content.includes('<coverage generated=')) {
      return parseCloverXml(filePath);
    }
    // Default: tentar Cobertura
    return parseCoberturaXml(filePath);
  } else if (filePath.endsWith('.info') || filePath.includes('lcov')) {
    return parseLcov(filePath);
  } else if (filePath.endsWith('.out')) {
    return parseGoCoverageOut(filePath);
  } else if (filePath.endsWith('.json')) {
    // Tentar determinar se é Istanbul ou SimpleCov
    const data = JSON.parse(content);
    if (data.total || data.lines) {
      return parseIstanbulJson(filePath);
    } else if (data.RSpec || data.Minitest) {
      return parseSimpleCovJson(filePath);
    }
    // Default: Istanbul
    return parseIstanbulJson(filePath);
  }

  throw new Error(`Formato de cobertura não suportado: ${filePath}`);
}

/**
 * Detecta tipo de arquivo de cobertura
 * 
 * @param filePath - Caminho do arquivo
 * @returns Tipo detectado
 */
export function detectCoverageFormat(filePath: string): string {
  if (filePath.includes('cobertura') || filePath.includes('coverage.xml')) {
    return 'cobertura';
  } else if (filePath.includes('jacoco')) {
    return 'jacoco';
  } else if (filePath.includes('lcov') || filePath.endsWith('.info')) {
    return 'lcov';
  } else if (filePath.endsWith('.out')) {
    return 'go-coverage';
  } else if (filePath.includes('clover')) {
    return 'clover';
  } else if (filePath.includes('simplecov') || filePath.includes('.resultset.json')) {
    return 'simplecov';
  } else if (filePath.includes('coverage-summary.json')) {
    return 'istanbul';
  }

  return 'unknown';
}

