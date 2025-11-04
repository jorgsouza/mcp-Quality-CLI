/**
 * 📊 JaCoCo Detailed Parser
 * 
 * Parser JaCoCo XML com informações detalhadas por arquivo e linha.
 * Necessário para Diff Coverage preciso em projetos Java.
 * 
 * Formato JaCoCo XML:
 * ```xml
 * <report>
 *   <package name="com/example">
 *     <sourcefile name="UserService.java">
 *       <line nr="10" mi="0" ci="5" mb="0" cb="2"/>
 *       <line nr="11" mi="2" ci="0" mb="0" cb="0"/>
 *     </sourcefile>
 *   </package>
 * </report>
 * ```
 * 
 * mi = missed instructions, ci = covered instructions
 * mb = missed branches, cb = covered branches
 */

import { promises as fs } from 'node:fs';
import { parseStringPromise } from 'xml2js';

export interface JaCoCoLineCoverage {
  lineNumber: number;
  missedInstructions: number;
  coveredInstructions: number;
  missedBranches: number;
  coveredBranches: number;
  covered: boolean;
}

export interface JaCoCoFileCoverage {
  file: string; // com/example/UserService.java
  packageName: string; // com.example
  fileName: string; // UserService.java
  lines: JaCoCoLineCoverage[];
  summary: {
    totalLines: number;
    coveredLines: number;
    missedLines: number;
    coverage: number;
  };
}

export interface JaCoCoDetailedReport {
  files: Map<string, JaCoCoFileCoverage>;
  summary: {
    totalLines: number;
    coveredLines: number;
    missedLines: number;
    coverage: number;
  };
}

/**
 * Parseia JaCoCo XML com informações detalhadas por arquivo e linha
 */
export async function parseJaCoCoDetailedXml(filePath: string): Promise<JaCoCoDetailedReport> {
  const content = await fs.readFile(filePath, 'utf-8');
  const parsed = await parseStringPromise(content);

  const files = new Map<string, JaCoCoFileCoverage>();
  let totalLines = 0;
  let coveredLines = 0;

  // Iterar por packages
  const packages = parsed.report?.package || [];

  for (const pkg of packages) {
    const packageName = pkg.$.name.replace(/\//g, '.'); // com/example -> com.example

    // Iterar por sourcefiles
    const sourcefiles = pkg.sourcefile || [];

    for (const sourcefile of sourcefiles) {
      const fileName = sourcefile.$.name;
      const filePath = `${pkg.$.name}/${fileName}`; // com/example/UserService.java

      const lines: JaCoCoLineCoverage[] = [];
      let fileCoveredLines = 0;
      let fileMissedLines = 0;

      // Iterar por linhas
      const lineNodes = sourcefile.line || [];

      for (const lineNode of lineNodes) {
        const lineNumber = parseInt(lineNode.$.nr);
        const missedInstructions = parseInt(lineNode.$.mi);
        const coveredInstructions = parseInt(lineNode.$.ci);
        const missedBranches = parseInt(lineNode.$.mb || '0');
        const coveredBranches = parseInt(lineNode.$.cb || '0');

        // Linha é considerada coberta se tem instruções cobertas
        const covered = coveredInstructions > 0;

        lines.push({
          lineNumber,
          missedInstructions,
          coveredInstructions,
          missedBranches,
          coveredBranches,
          covered,
        });

        if (covered) {
          fileCoveredLines++;
        } else if (missedInstructions > 0) {
          fileMissedLines++;
        }
      }

      const fileTotalLines = lines.length;
      totalLines += fileTotalLines;
      coveredLines += fileCoveredLines;

      files.set(filePath, {
        file: filePath,
        packageName,
        fileName,
        lines,
        summary: {
          totalLines: fileTotalLines,
          coveredLines: fileCoveredLines,
          missedLines: fileMissedLines,
          coverage: fileTotalLines > 0 ? (fileCoveredLines / fileTotalLines) * 100 : 0,
        },
      });
    }
  }

  const missedLines = totalLines - coveredLines;

  return {
    files,
    summary: {
      totalLines,
      coveredLines,
      missedLines,
      coverage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
    },
  };
}

/**
 * Verifica se uma linha específica está coberta
 */
export function isJaCoCoLineCovered(
  report: JaCoCoDetailedReport,
  file: string,
  lineNumber: number
): boolean {
  const fileCoverage = report.files.get(file);
  if (!fileCoverage) return false;

  const line = fileCoverage.lines.find(l => l.lineNumber === lineNumber);
  return line?.covered ?? false;
}

/**
 * Calcula coverage para um conjunto de linhas de um arquivo
 */
export function calculateJaCoCoLineCoverage(
  report: JaCoCoDetailedReport,
  file: string,
  lineNumbers: number[]
): { total: number; covered: number; percentage: number } {
  const fileCoverage = report.files.get(file);

  if (!fileCoverage || lineNumbers.length === 0) {
    return { total: 0, covered: 0, percentage: 0 };
  }

  let covered = 0;

  for (const lineNum of lineNumbers) {
    const line = fileCoverage.lines.find(l => l.lineNumber === lineNum);
    if (line?.covered) {
      covered++;
    }
  }

  return {
    total: lineNumbers.length,
    covered,
    percentage: (covered / lineNumbers.length) * 100,
  };
}

/**
 * Encontra arquivo JaCoCo no report (fuzzy matching)
 * 
 * JaCoCo usa formato: com/example/UserService.java
 * Git diff usa: src/main/java/com/example/UserService.java
 * 
 * Precisa mapear corretamente
 */
export function findJaCoCoFile(
  report: JaCoCoDetailedReport,
  targetFile: string
): string | null {
  // Normalizar path (remover src/main/java/, src/test/java/, etc)
  const normalized = targetFile
    .replace(/^src\/main\/java\//, '')
    .replace(/^src\/test\/java\//, '')
    .replace(/^src\/it\/java\//, '')
    .replace(/\\/g, '/');

  // Match exato
  if (report.files.has(normalized)) {
    return normalized;
  }

  // Match por basename (UserService.java)
  const basename = normalized.split('/').pop();
  if (basename) {
    for (const file of report.files.keys()) {
      if (file.endsWith(basename)) {
        return file;
      }
    }
  }

  // Match por sufixo (exemplo/UserService.java)
  const parts = normalized.split('/');
  if (parts.length >= 2) {
    const suffix = parts.slice(-2).join('/');
    for (const file of report.files.keys()) {
      if (file.endsWith(suffix)) {
        return file;
      }
    }
  }

  return null;
}

export default parseJaCoCoDetailedXml;

