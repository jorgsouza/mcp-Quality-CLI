/**
 * define-slos.ts
 * Define SLOs (Service Level Objectives) para cada CUJ
 * 
 * FASE 1 - MVP: Aplica defaults baseados em criticidade + permite customização
 */

import { writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { getPaths, ensurePaths } from '../utils/paths.js';
import { 
  SLOsSchema, 
  CUJCatalogSchema,
  DEFAULT_SLOS,
  type SLO, 
  type SLOs, 
  type CUJCatalog 
} from '../schemas/cuj-schemas.js';

export interface DefineSLOsParams {
  repo: string;
  product: string;
  cuj_file?: string; // Path para cuj-catalog.json (opcional, busca automático)
  defaults?: {
    latency_p99_ms?: number;
    error_rate_max?: number;
    availability_min?: number;
  };
  custom_slos?: Array<{
    cuj_id: string;
    slo: Partial<SLO>;
  }>;
}

export interface DefineSLOsResult {
  ok: boolean;
  output: string;
  slos_count: number;
  custom_slos_count: number;
  error?: string;
}

/**
 * Define SLOs para os CUJs catalogados
 */
export async function defineSLOs(params: DefineSLOsParams): Promise<DefineSLOsResult> {
  const { repo, product, defaults, custom_slos = [] } = params;

  try {
    const paths = getPaths(repo, product);
    await ensurePaths(paths);

    console.log('📂 [1/3] Carregando catálogo de CUJs...');
    const cujFilePath = params.cuj_file || join(paths.analyses, 'cuj-catalog.json');
    const cujCatalog = await loadCUJCatalog(cujFilePath);
    console.log(`   ${cujCatalog.cujs.length} CUJs carregados`);

    console.log('🎯 [2/3] Definindo SLOs...');
    const slos = generateSLOs(cujCatalog, defaults, custom_slos);
    console.log(`   ${slos.length} SLOs gerados`);

    console.log('💾 [3/3] Salvando SLOs...');
    const customSLOsCount = custom_slos.length;
    const slosData: SLOs = {
      timestamp: new Date().toISOString(),
      repo,
      product,
      slos,
      defaults_applied: customSLOsCount === 0, // true se nenhum SLO foi customizado
    };

    // Validar com schema
    const validated = SLOsSchema.parse(slosData);

    const outputPath = join(paths.analyses, 'slos.json');
    await writeFile(outputPath, JSON.stringify(validated, null, 2));

    console.log(`✅ ${slos.length} SLOs salvos: ${outputPath}`);

    return {
      ok: true,
      output: outputPath,
      slos_count: slos.length,
      custom_slos_count: customSLOsCount,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro ao definir SLOs:', message);
    return {
      ok: false,
      output: '',
      slos_count: 0,
      custom_slos_count: 0,
      error: message,
    };
  }
}

/**
 * Carrega catálogo de CUJs
 */
async function loadCUJCatalog(filePath: string): Promise<CUJCatalog> {
  const content = await readFile(filePath, 'utf-8');
  const data = JSON.parse(content);
  return CUJCatalogSchema.parse(data);
}

/**
 * Gera SLOs baseados em CUJs
 */
function generateSLOs(
  catalog: CUJCatalog,
  userDefaults?: DefineSLOsParams['defaults'],
  customSLOs: Array<{ cuj_id: string; slo: Partial<SLO> }> = []
): SLO[] {
  const slos: SLO[] = [];

  for (const cuj of catalog.cujs) {
    // Verificar se há SLO customizado
    const custom = customSLOs.find(c => c.cuj_id === cuj.id);
    
    if (custom) {
      // Usar SLO customizado
      slos.push({
        cuj_id: cuj.id,
        error_rate_max: 0.01, // Defaults mínimos
        availability_min: 0.99,
        ...custom.slo,
      });
    } else {
      // Aplicar defaults baseados em criticidade
      const defaultSLO = getSLOByCriticality(cuj.criticality);
      
      // Sobrescrever com defaults do usuário, se fornecidos
      slos.push({
        cuj_id: cuj.id,
        ...defaultSLO,
        ...(userDefaults?.latency_p99_ms && { latency_p99_ms: userDefaults.latency_p99_ms }),
        ...(userDefaults?.error_rate_max && { error_rate_max: userDefaults.error_rate_max }),
        ...(userDefaults?.availability_min && { availability_min: userDefaults.availability_min }),
      });
    }
  }

  return slos;
}

/**
 * Retorna SLO default baseado em criticidade do CUJ
 */
function getSLOByCriticality(criticality: 'critical' | 'high' | 'medium' | 'low'): Omit<SLO, 'cuj_id'> {
  switch (criticality) {
    case 'critical':
      // Auth, checkout, payment: SLOs mais rigorosos
      return {
        latency_p50_ms: DEFAULT_SLOS.critical.latency_p50_ms,
        latency_p95_ms: DEFAULT_SLOS.critical.latency_p95_ms,
        latency_p99_ms: DEFAULT_SLOS.critical.latency_p99_ms,
        error_rate_max: DEFAULT_SLOS.critical.error_rate_max,
        availability_min: DEFAULT_SLOS.critical.availability_min,
      };
    
    case 'high':
      // Search, discovery: SLOs relaxados mas ainda importantes
      return {
        latency_p50_ms: DEFAULT_SLOS.web_api.latency_p50_ms,
        latency_p95_ms: DEFAULT_SLOS.web_api.latency_p95_ms,
        latency_p99_ms: DEFAULT_SLOS.web_api.latency_p99_ms,
        error_rate_max: DEFAULT_SLOS.web_api.error_rate_max,
        availability_min: DEFAULT_SLOS.web_api.availability_min,
      };
    
    case 'medium':
    case 'low':
      // APIs genéricas, admin: SLOs mais permissivos
      return {
        latency_p99_ms: DEFAULT_SLOS.batch.latency_p99_ms,
        error_rate_max: DEFAULT_SLOS.batch.error_rate_max,
        availability_min: DEFAULT_SLOS.batch.availability_min,
      };
  }
}
