import { promises as fs } from 'node:fs';
import { join, basename } from 'node:path';
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
    ci_p95_min: z.number().min(0).optional().default(10)  // Atualizado de 8 para 10
  }).optional().default({}),
  environments: z.record(z.object({
    url: z.string().url()
  })).optional().default({}),
  auth: z.object({
    strategy: z.enum(['storageState', 'credentials', 'token']).optional(),
    storageStatePath: z.string().optional(),
    credentialsPath: z.string().optional()
  }).optional().default({}),
  paths: z.object({
    output_root: z.string().optional().describe('Diretório raiz customizado para saídas (padrão: qa/<product>)')
  }).optional().default({})
});

export type MCPSettings = z.infer<typeof MCPSettingsSchema>;

/**
 * Infere o nome do produto do package.json se disponível
 */
export async function inferProductFromPackageJson(repoPath: string): Promise<string | null> {
  const pkgPath = join(repoPath, 'package.json');
  
  // Primeiro verifica se existe
  if (!(await fileExists(pkgPath))) {
    // Fallback: usa o nome do diretório
    const dirName = basename(repoPath);
    return dirName && dirName.trim() ? dirName : null;
  }
  
  try {
    const content = await readFile(pkgPath);
    const pkg = JSON.parse(content);
    if (pkg?.name) {
      // Sanitiza o nome: remove @ e /, mas mantém letras, números, hífen e underscore
      let sanitized = String(pkg.name);
      sanitized = sanitized.replace('@', '');  // Remove @
      sanitized = sanitized.replace(/\//g, '-'); // Substitui / por -
      return sanitized;
    }
  } catch (error) {
    // Se falhar (JSON inválido), continua para fallback
  }
  
  // Fallback: usa o nome do diretório
  const dirName = basename(repoPath);
  return dirName && dirName.trim() ? dirName : null;
}

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
 * Versão agnóstica: defaults genéricos que funcionam para qualquer time/produto
 */
export async function createMCPSettingsTemplate(
  repoPath: string,
  product?: string,
  baseUrl?: string
): Promise<string> {
  // Inferir produto se não fornecido
  const inferredProduct = product && product.trim() 
    ? product 
    : await inferProductFromPackageJson(repoPath);
  
  const productName = inferredProduct || 'Product';
  
  // Default genérico para base_url
  const url = baseUrl && baseUrl.trim() ? baseUrl : 'http://localhost:3000';
  
  const qaDir = join(repoPath, 'qa', productName);
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

  // Template genérico e agnóstico
  const template: MCPSettings = {
    product: productName,
    base_url: url,
    domains: [],                    // Vazio - o analyze pode sugerir depois
    critical_flows: [],             // Vazio - o analyze pode sugerir depois
    targets: {
      diff_coverage_min: 80,        // Meta razoável universal
      flaky_pct_max: 5,             // Meta razoável universal
      ci_p95_min: 10                // 10 minutos (mais conservador)
    },
    environments: {
      dev: { url: 'http://localhost:3000' },
      stg: { url: 'http://localhost:3001' },
      prod: { url: 'http://localhost:3002' }
    },
    auth: {
      strategy: 'storageState',
      storageStatePath: 'fixtures/auth/storageState.json'
    },
    paths: {
      // Usa padrão qa/<product>, mas pode ser customizado
    }
  };

  // Salva arquivo se não existir
  if (!(await fileExists(settingsPath))) {
    await fs.writeFile(settingsPath, JSON.stringify(template, null, 2), 'utf-8');
    console.log(`✅ Created MCP settings template: ${settingsPath}`);
  }

  // Também criar um exemplo comentado para referência
  const examplePath = join(qaDir, 'mcp-settings.example.json');
  if (!(await fileExists(examplePath))) {
    const example = {
      product: "MyProduct",
      base_url: "http://localhost:3000",
      domains: ["billing", "users", "catalog"],
      critical_flows: ["login", "checkout", "reset_password"],
      targets: {
        diff_coverage_min: 80,
        flaky_pct_max: 5,
        ci_p95_min: 10
      },
      environments: {
        dev: { url: "http://localhost:3000" },
        stg: { url: "http://localhost:3001" },
        prod: { url: "https://myproduct.example.com" }
      },
      auth: {
        strategy: "storageState",
        storageStatePath: "fixtures/auth/storageState.json"
      }
    };
    
    await fs.writeFile(examplePath, JSON.stringify(example, null, 2), 'utf-8');
    console.log(`✅ Created example settings: ${examplePath}`);
  }

  return settingsPath;
}
