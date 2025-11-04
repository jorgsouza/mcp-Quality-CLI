/**
 * 📐 LCOV Line-by-Line Parser
 * 
 * Parser preciso de relatórios LCOV para mapear exatamente quais linhas
 * estão cobertas, permitindo cálculo exato de diff coverage.
 */

export interface LineCoverage {
  line: number;
  hits: number;
  covered: boolean;
}

export interface FileCoverage {
  file: string;
  lines: LineCoverage[];
  totalLines: number;
  coveredLines: number;
  coverage: number;
}

export interface LCOVReport {
  files: Map<string, FileCoverage>;
  totalLines: number;
  coveredLines: number;
  coverage: number;
}

/**
 * Parseia um relatório LCOV completo
 */
export function parseLCOV(lcovContent: string): LCOVReport {
  const files = new Map<string, FileCoverage>();
  let currentFile: string | null = null;
  let currentLines: LineCoverage[] = [];
  
  const lines = lcovContent.split('\n');
  
  for (const line of lines) {
    const trimmed = line.trim();
    
    // SF: Source File
    if (trimmed.startsWith('SF:')) {
      if (currentFile && currentLines.length > 0) {
        // Salva arquivo anterior
        saveFile(files, currentFile, currentLines);
      }
      currentFile = trimmed.substring(3);
      currentLines = [];
    }
    
    // DA: Data (linha,hits)
    else if (trimmed.startsWith('DA:')) {
      const match = trimmed.match(/^DA:(\d+),(\d+)/);
      if (match) {
        const lineNum = parseInt(match[1]);
        const hits = parseInt(match[2]);
        currentLines.push({
          line: lineNum,
          hits,
          covered: hits > 0,
        });
      }
    }
    
    // end_of_record
    else if (trimmed === 'end_of_record') {
      if (currentFile && currentLines.length > 0) {
        saveFile(files, currentFile, currentLines);
      }
      currentFile = null;
      currentLines = [];
    }
  }
  
  // Salva último arquivo se necessário
  if (currentFile && currentLines.length > 0) {
    saveFile(files, currentFile, currentLines);
  }
  
  // Calcula totais
  let totalLines = 0;
  let coveredLines = 0;
  
  for (const fileCov of files.values()) {
    totalLines += fileCov.totalLines;
    coveredLines += fileCov.coveredLines;
  }
  
  return {
    files,
    totalLines,
    coveredLines,
    coverage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
  };
}

function saveFile(
  files: Map<string, FileCoverage>,
  filePath: string,
  lines: LineCoverage[]
): void {
  const totalLines = lines.length;
  const coveredLines = lines.filter(l => l.covered).length;
  
  files.set(filePath, {
    file: filePath,
    lines,
    totalLines,
    coveredLines,
    coverage: totalLines > 0 ? (coveredLines / totalLines) * 100 : 0,
  });
}

/**
 * Verifica se uma linha específica está coberta em um arquivo
 */
export function isLineCovered(
  lcovReport: LCOVReport,
  file: string,
  lineNumber: number
): boolean {
  const fileCov = lcovReport.files.get(file);
  if (!fileCov) return false;
  
  const lineCov = fileCov.lines.find(l => l.line === lineNumber);
  return lineCov?.covered ?? false;
}

/**
 * Calcula coverage exato para um conjunto de linhas de um arquivo
 */
export function calculateLineCoverage(
  lcovReport: LCOVReport,
  file: string,
  lineNumbers: number[]
): { total: number; covered: number; percentage: number } {
  const fileCov = lcovReport.files.get(file);
  
  if (!fileCov || lineNumbers.length === 0) {
    return { total: 0, covered: 0, percentage: 0 };
  }
  
  let covered = 0;
  
  for (const lineNum of lineNumbers) {
    const lineCov = fileCov.lines.find(l => l.line === lineNum);
    if (lineCov?.covered) {
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
 * Encontra arquivo LCOV mais recente em um diretório
 */
export async function findLCOVFile(searchDir: string): Promise<string | null> {
  const { existsSync, readdirSync, statSync } = await import('node:fs');
  const { join } = await import('node:path');
  
  if (!existsSync(searchDir)) return null;
  
  const candidates = [
    'lcov.info',
    'coverage/lcov.info',
    'coverage/lcov/lcov.info',
    '.coverage/lcov.info',
  ];
  
  // Tenta caminhos comuns
  for (const candidate of candidates) {
    const fullPath = join(searchDir, candidate);
    if (existsSync(fullPath)) {
      return fullPath;
    }
  }
  
  // Busca recursivamente em coverage/
  const coverageDir = join(searchDir, 'coverage');
  if (existsSync(coverageDir)) {
    try {
      const files = readdirSync(coverageDir, { recursive: true }) as string[];
      const lcovFiles = files.filter(f => 
        typeof f === 'string' && f.endsWith('lcov.info')
      );
      
      if (lcovFiles.length > 0) {
        // Retorna o mais recente
        const sorted = lcovFiles
          .map(f => join(coverageDir, f))
          .sort((a, b) => {
            const statA = statSync(a);
            const statB = statSync(b);
            return statB.mtimeMs - statA.mtimeMs;
          });
        
        return sorted[0];
      }
    } catch {
      // Ignora erros de leitura
    }
  }
  
  return null;
}

/**
 * Normaliza caminho de arquivo para matching
 * Remove prefixos comuns (src/, ./, etc)
 */
export function normalizeFilePath(path: string): string {
  let normalized = path.replace(/\\/g, '/'); // Windows -> Unix
  
  // Remove prefixos comuns
  const prefixes = ['src/', 'lib/', 'app/', './', '../'];
  for (const prefix of prefixes) {
    if (normalized.startsWith(prefix)) {
      normalized = normalized.substring(prefix.length);
    }
  }
  
  return normalized;
}

/**
 * Tenta encontrar arquivo no LCOV report usando matching fuzzy
 */
export function findFileInReport(
  lcovReport: LCOVReport,
  targetFile: string
): string | null {
  const normalized = normalizeFilePath(targetFile);
  
  // Match exato
  if (lcovReport.files.has(targetFile)) {
    return targetFile;
  }
  
  // Match normalizado
  for (const file of lcovReport.files.keys()) {
    if (normalizeFilePath(file) === normalized) {
      return file;
    }
  }
  
  // Match por sufixo (arquivo.ts)
  const basename = normalized.split('/').pop();
  if (basename) {
    for (const file of lcovReport.files.keys()) {
      if (file.endsWith(basename)) {
        return file;
      }
    }
  }
  
  return null;
}

export default parseLCOV;

