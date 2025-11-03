import { join } from 'node:path';
import { promises as fs } from 'node:fs';
import type { MCPSettings } from './config.js';

/**
 * Interface que define todos os paths padronizados do MCP Quality CLI.
 * Garante que todas as saídas sejam organizadas em qa/<product>/.
 */
export interface QAPaths {
  /** Raiz: qa/<product> */
  root: string;
  
  /** Análises brutas (JSON): qa/<product>/tests/analyses */
  analyses: string;
  
  /** Relatórios legíveis (MD/HTML): qa/<product>/tests/reports */
  reports: string;
  
  /** Relatórios específicos do Playwright: qa/<product>/tests/reports/playwright */
  playwrightReports: string;
  
  /** Tests unitários: qa/<product>/tests/unit */
  unit: string;
  
  /** Tests de integração: qa/<product>/tests/integration */
  integration: string;
  
  /** Tests E2E: qa/<product>/tests/e2e */
  e2e: string;
  
  /** Contract tests (Pact): qa/<product>/tests/contracts */
  contracts: string;
  
  /** Fixtures (mocks, auth, data): qa/<product>/fixtures */
  fixtures: string;
  
  /** Auth fixtures: qa/<product>/fixtures/auth */
  fixturesAuth: string;
  
  /** Dashboards interativos: qa/<product>/dashboards */
  dashboards: string;
  
  /** Patches sugeridos: qa/<product>/patches */
  patches: string;
}

/**
 * Calcula paths padronizados para qa/<product>.
 * 
 * Esta função é o ponto central de referência para TODOS os caminhos do sistema.
 * Garante consistência e elimina hardcoded paths espalhados pelo código.
 * 
 * @param repo - Caminho absoluto do repositório
 * @param product - Nome do produto (ex: "mcp-Quality-CLI")
 * @param settings - Configurações MCP opcionais (permite override via settings.paths.output_root)
 * @returns Objeto com todos os paths necessários
 * 
 * @example
 * ```typescript
 * const paths = getPaths('/Users/dev/my-repo', 'my-app');
 * console.log(paths.analyses); // /Users/dev/my-repo/qa/my-app/tests/analyses
 * console.log(paths.reports);  // /Users/dev/my-repo/qa/my-app/tests/reports
 * ```
 * 
 * @example Com override via settings
 * ```typescript
 * const settings = { paths: { output_root: 'custom/output' } };
 * const paths = getPaths('/repo', 'my-app', settings);
 * console.log(paths.root); // /repo/custom/output
 * ```
 */
export function getPaths(
  repo: string,
  product: string,
  settings?: MCPSettings
): QAPaths {
  // Permite override via settings, fallback para qa/<product>
  // O override é útil para casos especiais (CI/CD com paths customizados)
  const root = settings?.paths?.output_root 
    ? join(repo, settings.paths.output_root)
    : join(repo, 'qa', product);

  // Estrutura completa de diretórios
  const testsDir = join(root, 'tests');
  const fixturesDir = join(root, 'fixtures');
  
  return {
    root,
    
    // Tests directories
    analyses: join(testsDir, 'analyses'),
    reports: join(testsDir, 'reports'),
    playwrightReports: join(testsDir, 'reports', 'playwright'),
    unit: join(testsDir, 'unit'),
    integration: join(testsDir, 'integration'),
    e2e: join(testsDir, 'e2e'),
    contracts: join(testsDir, 'contracts'),
    
    // Fixtures
    fixtures: fixturesDir,
    fixturesAuth: join(fixturesDir, 'auth'),
    
    // Outputs
    dashboards: join(root, 'dashboards'),
    patches: join(root, 'patches')
  };
}

/**
 * Garante que todos os diretórios da estrutura QA existam.
 * Cria recursivamente todos os paths necessários.
 * 
 * Esta função deve ser chamada no início do pipeline (auto.ts)
 * para garantir que a estrutura está pronta antes de qualquer tool escrever.
 * 
 * @param paths - Objeto QAPaths retornado por getPaths()
 * 
 * @example
 * ```typescript
 * const paths = getPaths('/repo', 'my-app');
 * await ensurePaths(paths);
 * // Agora todas as pastas existem e podem receber arquivos
 * ```
 */
export async function ensurePaths(paths: QAPaths): Promise<void> {
  // Cria todos os diretórios de forma idempotente (mkdir -p)
  const dirsToCreate = [
    paths.root,
    paths.analyses,
    paths.reports,
    paths.playwrightReports,
    paths.unit,
    paths.integration,
    paths.e2e,
    paths.fixtures,
    paths.fixturesAuth,
    paths.dashboards,
    paths.patches
  ];

  // Criar todos em paralelo para performance
  await Promise.all(
    dirsToCreate.map(dir => 
      fs.mkdir(dir, { recursive: true })
    )
  );
}

/**
 * Valida se um path está dentro da estrutura qa/<product>.
 * Útil para security checks e validação de inputs.
 * 
 * @param targetPath - Path a ser validado
 * @param paths - Objeto QAPaths de referência
 * @returns true se o path está dentro de qa/<product>
 * 
 * @example
 * ```typescript
 * const paths = getPaths('/repo', 'my-app');
 * isWithinQARoot('/repo/qa/my-app/tests/unit/foo.test.ts', paths); // true
 * isWithinQARoot('/repo/src/index.ts', paths); // false
 * ```
 */
export function isWithinQARoot(targetPath: string, paths: QAPaths): boolean {
  // Normaliza paths para comparação (resolve relativos, symlinks)
  const normalizedTarget = targetPath.replace(/\\/g, '/');
  const normalizedRoot = paths.root.replace(/\\/g, '/');
  
  return normalizedTarget.startsWith(normalizedRoot);
}

/**
 * Mapeia nome de arquivo para o diretório correto baseado em convenções.
 * 
 * Convenções:
 * - *.json (exceto package.json) → analyses/
 * - *.md, *.html → reports/
 * - dashboard.html → dashboards/
 * - *.patch → patches/
 * 
 * @param filename - Nome do arquivo (ex: "analyze.json")
 * @param paths - Objeto QAPaths
 * @returns Path completo onde o arquivo deve ser salvo
 * 
 * @example
 * ```typescript
 * const paths = getPaths('/repo', 'my-app');
 * getOutputPath('analyze.json', paths); 
 * // → /repo/qa/my-app/tests/analyses/analyze.json
 * 
 * getOutputPath('QUALITY-REPORT.md', paths);
 * // → /repo/qa/my-app/tests/reports/QUALITY-REPORT.md
 * ```
 */
export function getOutputPath(filename: string, paths: QAPaths): string {
  const lower = filename.toLowerCase();
  
  // Dashboard vai para pasta específica
  if (lower.includes('dashboard.html')) {
    return join(paths.dashboards, filename);
  }
  
  // Patches vão para pasta específica
  if (lower.endsWith('.patch')) {
    return join(paths.patches, filename);
  }
  
  // JSON vai para analyses (dados brutos)
  if (lower.endsWith('.json') && !lower.includes('package.json')) {
    return join(paths.analyses, filename);
  }
  
  // MD e HTML vão para reports (relatórios legíveis)
  if (lower.endsWith('.md') || lower.endsWith('.html')) {
    return join(paths.reports, filename);
  }
  
  // Fallback: root da estrutura QA
  return join(paths.root, filename);
}

/**
 * Helper para obter paths relativos (útil para logs e retornos de API).
 * 
 * @param absolutePath - Path absoluto
 * @param paths - Objeto QAPaths
 * @returns Path relativo ao root do QA
 * 
 * @example
 * ```typescript
 * const paths = getPaths('/repo', 'my-app');
 * getRelativePath('/repo/qa/my-app/tests/reports/PLAN.md', paths);
 * // → "tests/reports/PLAN.md"
 * ```
 */
export function getRelativePath(absolutePath: string, paths: QAPaths): string {
  const normalized = absolutePath.replace(/\\/g, '/');
  const normalizedRoot = paths.root.replace(/\\/g, '/');
  
  if (normalized.startsWith(normalizedRoot)) {
    return normalized.substring(normalizedRoot.length + 1); // +1 para remover /
  }
  
  return absolutePath; // Retorna original se não estiver dentro do root
}
