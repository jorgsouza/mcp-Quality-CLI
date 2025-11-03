/**
 * catalog-cujs.ts
 * Mapeia Critical User Journeys (CUJs) a partir de rotas, OpenAPI e README
 * 
 * FASE 1 - Implementação MVP: Rotas Express/Next.js + README
 */

import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPaths, ensurePaths } from '../utils/paths.js';
import { detectLanguage } from '../detectors/language.js';
import { findExpressRoutes, findOpenAPI, type Endpoint } from '../detectors/express.js';
import { findNextRoutes } from '../detectors/next.js';
import { CUJCatalogSchema, type CUJ, type CUJCatalog } from '../schemas/cuj-schemas.js';

export interface CatalogCUJsParams {
  repo: string;
  product: string;
  sources?: ('routes' | 'openapi' | 'readme')[];
}

export interface CatalogCUJsResult {
  ok: boolean;
  output: string;
  cujs_count: number;
  auto_detected: number;
  error?: string;
}

/**
 * Cataloga CUJs (Critical User Journeys) do repositório
 */
export async function catalogCUJs(params: CatalogCUJsParams): Promise<CatalogCUJsResult> {
  const { repo, product, sources = ['routes', 'readme'] } = params;

  try {
    const paths = getPaths(repo, product);
    await ensurePaths(paths);

    console.log('🔍 [1/3] Detectando linguagem...');
    const langDetection = await detectLanguage(repo);
    console.log(`   Detectado: ${langDetection.primary}`);

    console.log('📋 [2/3] Escaneando rotas e endpoints...');
    const cujs = await discoverCUJs(repo, sources);
    console.log(`   Encontrados: ${cujs.length} CUJs`);

    console.log('💾 [3/3] Salvando catálogo...');
    const catalog: CUJCatalog = {
      timestamp: new Date().toISOString(),
      repo,
      product,
      sources,
      cujs,
      auto_detected: cujs.length,
      manual_review_needed: cujs.some(c => c.criticality === 'medium' || c.criticality === 'low'),
    };

    // Validar com schema Zod
    const validated = CUJCatalogSchema.parse(catalog);

    const outputPath = join(paths.analyses, 'cuj-catalog.json');
    await writeFile(outputPath, JSON.stringify(validated, null, 2));

    console.log(`✅ ${cujs.length} CUJs catalogados: ${outputPath}`);

    return {
      ok: true,
      output: outputPath,
      cujs_count: cujs.length,
      auto_detected: cujs.length,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro ao catalogar CUJs:', message);
    return {
      ok: false,
      output: '',
      cujs_count: 0,
      auto_detected: 0,
      error: message,
    };
  }
}

/**
 * Descobre CUJs a partir de diferentes fontes
 */
async function discoverCUJs(repo: string, sources: string[]): Promise<CUJ[]> {
  const allCUJs: CUJ[] = [];

  // 1. Rotas (Express/Next.js)
  if (sources.includes('routes')) {
    try {
      const expressRoutes = await findExpressRoutes(repo);
      if (expressRoutes.length > 0) {
        console.log(`   → ${expressRoutes.length} rotas Express`);
        allCUJs.push(...routesToCUJs(expressRoutes));
      }
    } catch {}

    try {
      const nextRoutes = await findNextRoutes(repo);
      if (nextRoutes.length > 0) {
        console.log(`   → ${nextRoutes.length} rotas Next.js`);
        // Converter strings em Endpoints
        const nextEndpoints: Endpoint[] = nextRoutes.map(path => ({
          method: 'GET',
          path,
          file: '',
        }));
        allCUJs.push(...routesToCUJs(nextEndpoints));
      }
    } catch {}
  }

  // 2. README
  if (sources.includes('readme')) {
    try {
      const readmeCUJs = await discoverFromReadme(repo);
      if (readmeCUJs.length > 0) {
        console.log(`   → ${readmeCUJs.length} features do README`);
        allCUJs.push(...readmeCUJs);
      }
    } catch {}
  }

  // Deduplicate
  return deduplicateCUJs(allCUJs);
}

/**
 * Converte rotas em CUJs agrupados por domínio
 */
function routesToCUJs(routes: Endpoint[]): CUJ[] {
  const cujs: CUJ[] = [];
  const byDomain = groupByDomain(routes);

  for (const [domain, endpoints] of Object.entries(byDomain)) {
    // Auth
    const auth = endpoints.filter(e => /\/(auth|login|register|signup)/i.test(e.path));
    if (auth.length > 0) {
      cujs.push({
        id: `auth-${domain}`,
        name: `Authentication (${domain})`,
        description: 'User authentication flow',
        criticality: 'critical',
        endpoints: auth.map(e => `${e.method} ${e.path}`),
        dependencies: ['auth-service', 'database'],
        user_flow: ['login', 'validate', 'create-session'],
        traffic_volume: 'high',
        revenue_impact: 'critical',
      });
    }

    // Checkout
    const checkout = endpoints.filter(e => /\/(checkout|cart|payment|order)/i.test(e.path));
    if (checkout.length > 0) {
      cujs.push({
        id: `checkout-${domain}`,
        name: `Checkout (${domain})`,
        description: 'Purchase flow',
        criticality: 'critical',
        endpoints: checkout.map(e => `${e.method} ${e.path}`),
        dependencies: ['payment-gateway', 'inventory', 'orders'],
        user_flow: ['cart', 'shipping', 'payment', 'confirm'],
        traffic_volume: 'medium',
        revenue_impact: 'critical',
      });
    }

    // Search
    const search = endpoints.filter(e => /\/(search|query|find)/i.test(e.path));
    if (search.length > 0) {
      cujs.push({
        id: `search-${domain}`,
        name: `Search (${domain})`,
        description: 'Search and discovery',
        criticality: 'high',
        endpoints: search.map(e => `${e.method} ${e.path}`),
        dependencies: ['search-service', 'cache'],
        user_flow: ['query', 'results', 'filter'],
        traffic_volume: 'very-high',
        revenue_impact: 'high',
      });
    }

    // API genérica (se não se encaixa em nenhum acima)
    if (!auth.length && !checkout.length && !search.length && endpoints.length > 2) {
      cujs.push({
        id: `api-${domain}`,
        name: `API (${domain})`,
        description: `General API for ${domain}`,
        criticality: 'medium',
        endpoints: endpoints.slice(0, 5).map(e => `${e.method} ${e.path}`),
        dependencies: ['database'],
      });
    }
  }

  return cujs;
}

/**
 * Agrupa rotas por domínio (primeiro segmento)
 */
function groupByDomain(routes: Endpoint[]): Record<string, Endpoint[]> {
  const grouped: Record<string, Endpoint[]> = {};
  
  for (const route of routes) {
    const domain = route.path.split('/').filter(Boolean)[0] || 'root';
    if (!grouped[domain]) grouped[domain] = [];
    grouped[domain].push(route);
  }

  return grouped;
}

/**
 * Extrai CUJs do README
 */
async function discoverFromReadme(repo: string): Promise<CUJ[]> {
  const cujs: CUJ[] = [];

  try {
    const content = await readFile(join(repo, 'README.md'), 'utf-8');
    
    // Procura seção "Features" ou similar
    const lines = content.split('\n');
    let inFeatures = false;
    
    for (const line of lines) {
      if (/^#{1,3}\s+(features|functionality|capabilities|use cases)/i.test(line)) {
        inFeatures = true;
        continue;
      }
      
      if (inFeatures && /^#{1,3}\s+/.test(line)) {
        break; // Nova seção, sair
      }
      
      if (inFeatures && /^[\s]*[-*\d]+\.?\s+/.test(line)) {
        const text = line.replace(/^[\s]*[-*\d]+\.?\s+/, '').trim();
        if (text.length > 10) {
          cujs.push({
            id: `feature-${cujs.length + 1}`,
            name: text.substring(0, 50),
            description: text,
            criticality: 'medium',
            endpoints: [],
            dependencies: [],
          });
        }
      }
    }
  } catch {}

  return cujs;
}

/**
 * Remove duplicados por ID
 */
function deduplicateCUJs(cujs: CUJ[]): CUJ[] {
  const seen = new Set<string>();
  return cujs.filter(c => {
    if (seen.has(c.id)) return false;
    seen.add(c.id);
    return true;
  });
}
