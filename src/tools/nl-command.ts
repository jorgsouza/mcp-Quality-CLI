/**
 * Natural Language Command Interface
 * 
 * Permite comandos em linguagem natural (PT/EN) para acionar ferramentas MCP.
 * Exemplos:
 * - "analise meu repositório"
 * - "create test plan"
 * - "gerar testes para billing"
 * - "run tests and calculate coverage"
 */

import { autoQualityRun, type AutoMode, type AutoOptions } from './auto.js';

/**
 * Parâmetros de entrada do comando NL
 */
export interface NLCommandParams {
  /** Query em linguagem natural (PT ou EN) */
  query: string;
  /** Defaults globais opcionais */
  defaults?: Partial<AutoOptions>;
}

/**
 * Resultado da execução do comando NL
 */
export interface NLCommandResult {
  /** Se o comando foi executado com sucesso */
  success: boolean;
  /** Modo detectado do query */
  detected_mode: AutoMode;
  /** Parâmetros extraídos do query */
  extracted_params: AutoOptions;
  /** Parâmetros finais usados (extracted + defaults) */
  final_params: AutoOptions;
  /** Resultado da execução do auto */
  result?: Awaited<ReturnType<typeof autoQualityRun>>;
  /** Mensagem de erro, se houver */
  error?: string;
}

/**
 * Padrões de reconhecimento para cada modo
 */
const MODE_PATTERNS: Record<AutoMode, RegExp[]> = {
  // ANALYZE - mais específico primeiro
  analyze: [
    // PT
    /\b(apenas|somente|s[oó])\s+(analis[ae]|mapea[r]?|scan)/i,
    /\banalis[ae]\s+(o\s+)?(c[oó]digo|reposit[oó]rio|projeto)/i,
    /\bmapea[r]?\s+(endpoints?|eventos?)/i,
    // EN
    /\b(only|just)\s+(analyze|scan|map)/i,
    /\banalyze\s+(the\s+)?(code|repo|repository|project)/i,
    /\bmap\s+(endpoints?|events?)/i,
  ],
  
  // PLAN
  plan: [
    // PT
    /\b(cria[r]?|gera[r]?)\s+(plano|estrat[eé]gia)/i,
    /\bplano\s+de\s+testes/i,
    /\bestrat[eé]gia\s+de\s+(testes|qualidade)/i,
    // EN
    /\b(create|generate|make)\s+(plan|strategy)/i,
    /\btest\s+plan/i,
    /\b(test|quality)\s+strategy/i,
  ],
  
  // SCAFFOLD
  scaffold: [
    // PT
    /\bscaffold/i,
    /\b(gera[r]?|cria[r]?)\s+(templates?|estruturas?)\s+(de\s+)?testes?/i,
    /\btemplates?\s+de\s+testes?/i,
    /\b(unit|integration|e2e)\s+(tests?\s+)?(templates?|scaffold)/i,
    // EN
    /\bscaffold/i,
    /\b(generate|create)\s+test\s+(templates?|structures?)/i,
    /\btest\s+templates?/i,
    /\b(unit|integration|e2e)\s+(test\s+)?(templates?|scaffold)/i,
  ],
  
  // RUN
  run: [
    // PT
    /\b(roda[r]?|executa[r]?)\s+testes?/i,
    /\bcalcula[r]?\s+(cobertura|coverage)/i,
    /\b(validar?|verifica[r]?)\s+cobertura/i,
    // EN
    /\b(run|execute)\s+tests?/i,
    /\bcalculate\s+(coverage|cov)/i,
    /\b(validate|verify|check)\s+coverage/i,
  ],
  
  // FULL - menos específico, por último
  full: [
    // PT
    /\b(analis[ae]|audita[r]?|completo|tudo|end[- ]?to[- ]?end)\b/i,
    /\brodar?\s+tudo/i,
    /\bexecut(ar|a)?\s+(completo|tudo)/i,
    // EN
    /\b(analyze|audit|full|everything|complete|end[- ]?to[- ]?end)\b/i,
    /\brun\s+(all|everything|complete)/i,
  ],
};

/**
 * Padrões para extração de overrides do texto
 */
const OVERRIDE_PATTERNS = {
  repo: /\brepo:([^\s]+)/i,
  product: /\bproduct:([^\s]+)/i,
  mode: /\bmode:(full|analyze|plan|scaffold|run)/i,
};

/**
 * Detecta o modo de execução baseado no query
 */
export function detectMode(query: string): AutoMode {
  // Verifica cada modo em ordem de especificidade (mais específico primeiro)
  const modes: AutoMode[] = ['analyze', 'plan', 'scaffold', 'run', 'full'];
  
  for (const mode of modes) {
    const patterns = MODE_PATTERNS[mode];
    for (const pattern of patterns) {
      if (pattern.test(query)) {
        return mode;
      }
    }
  }
  
  // Default: full
  return 'full';
}

/**
 * Extrai overrides explícitos do query
 * Exemplo: "analise repo:/path/to/repo product:MyApp"
 */
export function extractOverrides(query: string): Partial<AutoOptions> {
  const overrides: Partial<AutoOptions> = {};
  
  // Extrai repo
  const repoMatch = query.match(OVERRIDE_PATTERNS.repo);
  if (repoMatch) {
    overrides.repo = repoMatch[1];
  }
  
  // Extrai product
  const productMatch = query.match(OVERRIDE_PATTERNS.product);
  if (productMatch) {
    overrides.product = productMatch[1];
  }
  
  // Extrai mode (override explícito tem precedência)
  const modeMatch = query.match(OVERRIDE_PATTERNS.mode);
  if (modeMatch) {
    overrides.mode = modeMatch[1] as AutoMode;
  }
  
  return overrides;
}

/**
 * Executa comando em linguagem natural
 * 
 * @param params - Parâmetros do comando NL
 * @returns Resultado da execução
 */
export async function nlCommand(params: NLCommandParams): Promise<NLCommandResult> {
  const { query, defaults = {} } = params;
  
  try {
    console.log('\n🧠 Natural Language Command Interface');
    console.log(`📝 Query: "${query}"`);
    
    // 1. Detecta modo do query
    const detectedMode = detectMode(query);
    console.log(`🎯 Modo detectado: ${detectedMode}`);
    
    // 2. Extrai overrides explícitos
    const extracted = extractOverrides(query);
    console.log(`🔍 Parâmetros extraídos:`, extracted);
    
    // 3. Mescla: extracted > defaults > detectedMode
    const finalParams: AutoOptions = {
      ...defaults,
      ...extracted,
      mode: extracted.mode || defaults.mode || detectedMode,
    };
    console.log(`⚙️  Parâmetros finais:`, finalParams);
    
    // 4. Executa auto com os parâmetros finais
    console.log('\n🚀 Executando...\n');
    const result = await autoQualityRun(finalParams);
    
    return {
      success: result.ok,  // [FASE 6] Usar result.ok
      detected_mode: detectedMode,
      extracted_params: extracted,
      final_params: finalParams,
      result,
    };
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('❌ Erro ao executar comando NL:', errorMessage);
    
    return {
      success: false,
      detected_mode: 'full',
      extracted_params: {},
      final_params: {},
      error: errorMessage,
    };
  }
}

/**
 * Helper para executar comando NL e retornar apenas sucesso
 */
export async function runNLCommand(query: string, defaults?: Partial<AutoOptions>): Promise<boolean> {
  const result = await nlCommand({ query, defaults });
  return result.success;
}
