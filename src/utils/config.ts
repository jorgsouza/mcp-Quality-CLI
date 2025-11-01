import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { z } from 'zod';
import { fileExists, readFile } from './fs.js';

// Schema para mcp-settings.json centralizado
export const MCPSettingsSchema = z.object({
  product: z.string().min(1, 'Product name is required'),
  base_url: z.string().url('Base URL must be valid'),
  domains: z.array(z.string()).optional().default([]),
  critical_flows: z.array(z.string()).optional().default([]),
  targets: z.object({
    diff_coverage_min: z.number().min(0).max(100).optional().default(80),
    flaky_pct_max: z.number().min(0).max(100).optional().default(5),
    ci_p95_min: z.number().min(0).optional().default(8)
  }).optional().default({}),
  environments: z.record(z.object({
    url: z.string().url()
  })).optional().default({}),
  auth: z.object({
    strategy: z.enum(['storageState', 'credentials', 'token']).optional(),
    storageStatePath: z.string().optional(),
    credentialsPath: z.string().optional()
  }).optional().default({})
});

export type MCPSettings = z.infer<typeof MCPSettingsSchema>;

/**
 * Procura por mcp-settings.json no repositório
 * Ordem de busca:
 * 1. /qa/<product>/mcp-settings.json
 * 2. /mcp-settings.json (raiz)
 * 3. Fallback para valores padrão
 */
export async function loadMCPSettings(
  repoPath: string,
  product?: string
): Promise<MCPSettings | null> {
  const searchPaths: string[] = [];

  // Prioridade 1: /qa/<product>/mcp-settings.json
  if (product) {
    searchPaths.push(join(repoPath, 'qa', product, 'mcp-settings.json'));
  }

  // Prioridade 2: /mcp-settings.json
  searchPaths.push(join(repoPath, 'mcp-settings.json'));

  for (const settingsPath of searchPaths) {
    if (await fileExists(settingsPath)) {
      try {
        const content = await readFile(settingsPath);
        const parsed = JSON.parse(content);
        const validated = MCPSettingsSchema.parse(parsed);
        
        console.log(`✅ Loaded MCP settings from: ${settingsPath}`);
        return validated;
      } catch (error) {
        console.warn(`⚠️ Failed to parse ${settingsPath}:`, error instanceof Error ? error.message : error);
      }
    }
  }

  return null;
}

/**
 * Mescla configurações do arquivo com parâmetros explícitos
 * Parâmetros explícitos têm precedência sobre o arquivo
 */
export function mergeSettings<T extends Record<string, any>>(
  fileSettings: MCPSettings | null,
  params: T
): T & Partial<MCPSettings> {
  if (!fileSettings) {
    return params;
  }

  // Parâmetros explícitos sempre sobrescrevem
  return {
    ...fileSettings,
    ...params,
    // Merge targets se ambos existirem
    targets: {
      ...fileSettings.targets,
      ...(params.targets || {})
    }
  } as T & Partial<MCPSettings>;
}

/**
 * Cria template de mcp-settings.json para um produto
 */
export async function createMCPSettingsTemplate(
  repoPath: string,
  product: string,
  baseUrl: string
): Promise<string> {
  const qaDir = join(repoPath, 'qa', product);
  const settingsPath = join(qaDir, 'mcp-settings.json');

  // Cria diretório se não existir
  await fs.mkdir(qaDir, { recursive: true });

  // Cria estrutura de diretórios
  await fs.mkdir(join(qaDir, 'tests', 'unit'), { recursive: true });
  await fs.mkdir(join(qaDir, 'tests', 'integration'), { recursive: true });
  await fs.mkdir(join(qaDir, 'tests', 'e2e'), { recursive: true });
  await fs.mkdir(join(qaDir, 'tests', 'analyses'), { recursive: true });
  await fs.mkdir(join(qaDir, 'tests', 'reports'), { recursive: true });
  await fs.mkdir(join(qaDir, 'fixtures', 'auth'), { recursive: true });

  // Template de configuração
  const template: MCPSettings = {
    product,
    base_url: baseUrl,
    domains: [],
    critical_flows: [],
    targets: {
      diff_coverage_min: 80,
      flaky_pct_max: 5,
      ci_p95_min: 8
    },
    environments: {
      dev: { url: baseUrl.replace('www', 'dev') },
      stg: { url: baseUrl.replace('www', 'stg') },
      prod: { url: baseUrl }
    },
    auth: {
      strategy: 'storageState',
      storageStatePath: 'fixtures/auth/storageState.json'
    }
  };

  // Salva arquivo se não existir
  if (!(await fileExists(settingsPath))) {
    await fs.writeFile(settingsPath, JSON.stringify(template, null, 2), 'utf-8');
    console.log(`✅ Created MCP settings template: ${settingsPath}`);
  }

  return settingsPath;
}
