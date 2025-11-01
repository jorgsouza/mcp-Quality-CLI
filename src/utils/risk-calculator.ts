/**
 * Sistema de Cálculo de Risco Probabilístico
 * 
 * Calcula score de risco por arquivo/endpoint baseado em:
 * - Probability: change frequency, recent bugs, complexity
 * - Impact: test coverage, critical flows, user-facing
 * 
 * Formula: Risk Score = Probability × Impact (0-100)
 */

export interface RiskFactors {
  // Probability factors (0-100)
  changeFrequency: number;      // Commits nos últimos 30 dias
  recentBugs: number;            // Bugs reportados recentemente
  complexity: number;            // Complexidade ciclomática estimada
  
  // Impact factors (0-100)
  testCoverage: number;          // % de cobertura de testes
  isCriticalFlow: boolean;       // Está em critical_flows?
  isUserFacing: boolean;         // Interface visível ao usuário?
  
  // Metadata
  filePath: string;
  domain?: string;
}

export interface RiskScore {
  file: string;
  probability: number;  // 0-100
  impact: number;       // 0-100
  score: number;        // probability × impact / 100 (0-100)
  level: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  reasons: string[];
}

/**
 * Calcula score de risco para um arquivo/endpoint
 */
export function calculateRiskScore(factors: RiskFactors): RiskScore {
  // 1. Calcula Probability (média ponderada)
  const probability = calculateProbability(factors);
  
  // 2. Calcula Impact (média ponderada)
  const impact = calculateImpact(factors);
  
  // 3. Calcula Score final
  const score = (probability * impact) / 100;
  
  // 4. Determina nível de risco
  const level = getRiskLevel(score);
  
  // 5. Gera razões explicativas
  const reasons = generateReasons(factors, probability, impact, score);
  
  return {
    file: factors.filePath,
    probability: Math.round(probability),
    impact: Math.round(impact),
    score: Math.round(score),
    level,
    reasons
  };
}

/**
 * Calcula Probability (0-100)
 * 
 * Fatores:
 * - Change frequency: 40% (quanto mais muda, maior o risco)
 * - Recent bugs: 35% (bugs indicam fragilidade)
 * - Complexity: 25% (código complexo quebra mais)
 */
function calculateProbability(factors: RiskFactors): number {
  const weights = {
    changeFrequency: 0.40,
    recentBugs: 0.35,
    complexity: 0.25
  };
  
  return (
    factors.changeFrequency * weights.changeFrequency +
    factors.recentBugs * weights.recentBugs +
    factors.complexity * weights.complexity
  );
}

/**
 * Calcula Impact (0-100)
 * 
 * Fatores:
 * - Test coverage: 40% (sem testes = alto impacto)
 * - Critical flow: 35% (falha em fluxo crítico = catastrófico)
 * - User facing: 25% (usuário vê o erro = alto impacto)
 */
function calculateImpact(factors: RiskFactors): number {
  const weights = {
    testCoverage: 0.40,
    isCriticalFlow: 0.35,
    isUserFacing: 0.25
  };
  
  // Inverte coverage (0% = 100 impacto, 100% = 0 impacto)
  const coverageImpact = 100 - factors.testCoverage;
  
  const criticalFlowImpact = factors.isCriticalFlow ? 100 : 0;
  const userFacingImpact = factors.isUserFacing ? 100 : 0;
  
  return (
    coverageImpact * weights.testCoverage +
    criticalFlowImpact * weights.isCriticalFlow +
    userFacingImpact * weights.isUserFacing
  );
}

/**
 * Determina nível de risco baseado no score
 */
function getRiskLevel(score: number): 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' {
  if (score >= 80) return 'CRITICAL';
  if (score >= 60) return 'HIGH';
  if (score >= 40) return 'MEDIUM';
  return 'LOW';
}

/**
 * Gera razões explicativas do score
 */
function generateReasons(
  factors: RiskFactors,
  probability: number,
  impact: number,
  score: number
): string[] {
  const reasons: string[] = [];
  
  // Score geral
  reasons.push(`Risk Score: ${Math.round(score)}/100`);
  
  // Probability reasons
  if (factors.changeFrequency >= 70) {
    reasons.push(`⚠️ Alta frequência de mudanças (${factors.changeFrequency}%)`);
  }
  
  if (factors.recentBugs >= 50) {
    reasons.push(`🐛 Bugs recentes reportados (${factors.recentBugs}%)`);
  }
  
  if (factors.complexity >= 70) {
    reasons.push(`🔀 Alta complexidade ciclomática (${factors.complexity}%)`);
  }
  
  // Impact reasons
  if (factors.testCoverage < 50) {
    reasons.push(`❌ Baixa cobertura de testes (${factors.testCoverage}%)`);
  }
  
  if (factors.isCriticalFlow) {
    reasons.push(`🔴 Fluxo crítico de negócio`);
  }
  
  if (factors.isUserFacing) {
    reasons.push(`👤 Interface visível ao usuário`);
  }
  
  // Recomendações
  if (score >= 80) {
    reasons.push(`🚨 URGENTE: Priorizar testes imediatamente`);
  } else if (score >= 60) {
    reasons.push(`⚡ Alta prioridade para testes`);
  } else if (score >= 40) {
    reasons.push(`📋 Adicionar à próxima sprint`);
  } else {
    reasons.push(`✅ Prioridade baixa - manter monitoramento`);
  }
  
  return reasons;
}

/**
 * Estima change frequency baseado em git history
 * (Simplificado - em produção, use git log)
 */
export function estimateChangeFrequency(filePath: string): number {
  // TODO: Implementar com `git log --since="30 days ago" -- ${filePath}`
  // Por enquanto, retorna estimativa baseada em padrões de nome
  
  if (/auth|login|security|payment/.test(filePath)) {
    return 60; // Arquivos sensíveis mudam com frequência
  }
  
  if (/config|constant|util/.test(filePath)) {
    return 30; // Arquivos de suporte mudam menos
  }
  
  return 50; // Média
}

/**
 * Estima complexity baseado em heurísticas
 * (Simplificado - em produção, use ferramentas como complexity-report)
 */
export function estimateComplexity(filePath: string, fileContent?: string): number {
  // Heurísticas simples baseadas em padrões
  
  if (/parser|analyzer|detector|transformer/.test(filePath)) {
    return 80; // Parsing é complexo
  }
  
  if (/auth|security|crypto/.test(filePath)) {
    return 70; // Segurança é complexa
  }
  
  if (/api|router|controller/.test(filePath)) {
    return 60; // APIs têm lógica moderada
  }
  
  if (/model|entity|schema/.test(filePath)) {
    return 40; // Models são simples
  }
  
  if (/config|constant/.test(filePath)) {
    return 20; // Config é trivial
  }
  
  // Se tiver conteúdo, conta condicionais
  if (fileContent) {
    const conditionals = (fileContent.match(/if\s*\(|switch\s*\(|case\s+/g) || []).length;
    const loops = (fileContent.match(/for\s*\(|while\s*\(/g) || []).length;
    const functions = (fileContent.match(/function\s+\w+|=>\s*{|\w+\s*\(/g) || []).length;
    
    const complexityScore = Math.min(100, (conditionals * 5) + (loops * 3) + (functions * 2));
    return complexityScore;
  }
  
  return 50; // Média
}

/**
 * Estima recent bugs (simplificado)
 * (Em produção, integrar com issue tracker: JIRA, GitHub Issues, etc.)
 */
export function estimateRecentBugs(filePath: string): number {
  // TODO: Integrar com issue tracker
  // Por enquanto, assume 0 (sem dados)
  return 0;
}

/**
 * Detecta se é user-facing
 */
export function isUserFacing(filePath: string): boolean {
  return /component|view|page|ui|frontend|client/.test(filePath);
}

/**
 * Calcula risk scores para múltiplos arquivos e ordena
 */
export function calculateRiskScores(files: RiskFactors[]): RiskScore[] {
  const scores = files.map(calculateRiskScore);
  
  // Ordena por score (maior primeiro)
  return scores.sort((a, b) => b.score - a.score);
}

/**
 * Agrupa por nível de risco
 */
export function groupByRiskLevel(scores: RiskScore[]): Record<string, RiskScore[]> {
  return scores.reduce((acc, score) => {
    if (!acc[score.level]) {
      acc[score.level] = [];
    }
    acc[score.level].push(score);
    return acc;
  }, {} as Record<string, RiskScore[]>);
}
