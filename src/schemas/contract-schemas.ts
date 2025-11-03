/**
 * Schemas Zod para Contract Testing (CDC/Pact)
 * 
 * Baseado em:
 * - Pact specification (https://docs.pact.io/)
 * - Consumer-Driven Contract Testing patterns
 * - Multi-language support (Node.js, Python, Java)
 */

import { z } from 'zod';

/**
 * Service/Integration Detection
 * Identificação automática de serviços e integrações no código
 */
export const ServiceIntegrationSchema = z.object({
  name: z.string().describe('Nome do serviço (e.g., "payment-api", "inventory-service")'),
  type: z.enum(['http', 'grpc', 'message-queue', 'database']).describe('Tipo de integração'),
  role: z.enum(['consumer', 'provider', 'both']).describe('Papel no contrato'),
  endpoints: z.array(z.object({
    method: z.string(),
    path: z.string(),
    description: z.string().optional(),
  })).optional().describe('Endpoints expostos (se provider)'),
  dependencies: z.array(z.string()).describe('Serviços que consome (se consumer)'),
  detected_from: z.enum(['code', 'openapi', 'config', 'manual']).describe('Como foi detectado'),
  file_path: z.string().optional().describe('Arquivo onde foi detectado'),
});

/**
 * Pact Interaction (Consumer expectation)
 * Uma única interação entre consumer e provider
 */
export const PactInteractionSchema = z.object({
  description: z.string().describe('Descrição human-readable da interação'),
  providerState: z.string().optional().describe('Estado que o provider deve estar (e.g., "user exists")'),
  request: z.object({
    method: z.string().describe('GET, POST, PUT, DELETE, etc.'),
    path: z.string().describe('Path do endpoint (pode conter matchers)'),
    headers: z.record(z.union([z.string(), z.any()])).optional().describe('Headers esperados'),
    query: z.record(z.union([z.string(), z.any()])).optional().describe('Query parameters'),
    body: z.any().optional().describe('Body da requisição (pode conter matchers)'),
  }).describe('Requisição esperada do consumer'),
  response: z.object({
    status: z.number().describe('HTTP status esperado'),
    headers: z.record(z.union([z.string(), z.any()])).optional().describe('Headers esperados'),
    body: z.any().optional().describe('Body esperado (pode conter matchers)'),
  }).describe('Resposta esperada do provider'),
});

/**
 * Pact Contract (Complete contract between consumer and provider)
 */
export const PactContractSchema = z.object({
  consumer: z.object({
    name: z.string(),
  }).describe('Consumer service'),
  provider: z.object({
    name: z.string(),
  }).describe('Provider service'),
  interactions: z.array(PactInteractionSchema).min(1).describe('Lista de interações'),
  metadata: z.object({
    pactSpecification: z.object({
      version: z.string().default('2.0.0'),
    }).optional(),
    'pact-ts': z.object({
      version: z.string().optional(),
    }).optional(),
  }).optional().describe('Metadata do Pact'),
});

/**
 * Pact Configuration (pact.config.ts)
 */
export const PactConfigSchema = z.object({
  language: z.enum(['typescript', 'javascript', 'python', 'java', 'go']).describe('Linguagem do projeto'),
  framework: z.string().describe('Framework (express, fastapi, spring-boot, etc.)'),
  consumer: z.object({
    name: z.string(),
    version: z.string().optional(),
  }).describe('Configuração do consumer'),
  providers: z.array(z.object({
    name: z.string(),
    baseUrl: z.string().describe('URL base do provider (para verificação)'),
    stateHandlers: z.record(z.string()).optional().describe('Handlers para provider states'),
  })).describe('Providers que este consumer usa'),
  pactBrokerUrl: z.string().url().optional().describe('URL do Pact Broker (opcional)'),
  pactBrokerToken: z.string().optional().describe('Token de autenticação do broker'),
  publishVerificationResult: z.boolean().default(false).describe('Se deve publicar resultados no broker'),
  logLevel: z.enum(['trace', 'debug', 'info', 'warn', 'error']).default('info'),
  outputDir: z.string().default('./qa/{{product}}/tests/contracts/pacts').describe('Diretório de saída dos pacts'),
});

/**
 * Verification Result (resultado de run_contracts_verify)
 */
export const VerificationResultSchema = z.object({
  consumer: z.string(),
  provider: z.string(),
  interaction: z.string().describe('Descrição da interação'),
  status: z.enum(['passed', 'failed', 'pending']),
  error: z.string().optional().describe('Mensagem de erro se falhou'),
  details: z.object({
    expected: z.any().optional(),
    actual: z.any().optional(),
    diff: z.string().optional(),
  }).optional(),
  duration_ms: z.number().optional(),
});

export const ContractVerificationReportSchema = z.object({
  timestamp: z.string().datetime(),
  repo: z.string(),
  product: z.string(),
  language: z.string(),
  framework: z.string(),
  total_contracts: z.number().describe('Total de contratos verificados'),
  total_interactions: z.number().describe('Total de interações testadas'),
  verified: z.number().describe('Interações verificadas com sucesso'),
  failed: z.number().describe('Interações que falharam'),
  pending: z.number().describe('Interações pendentes'),
  verification_rate: z.number().min(0).max(1).describe('Taxa de verificação (verified/total)'),
  results: z.array(VerificationResultSchema).describe('Resultados detalhados'),
  failures: z.array(VerificationResultSchema).describe('Apenas as falhas'),
  broker_published: z.boolean().default(false).describe('Se foi publicado no broker'),
  broker_url: z.string().url().optional().describe('URL do Pact Broker usado'),
  duration_total_ms: z.number().describe('Tempo total de verificação'),
  recommendations: z.array(z.string()).describe('Recomendações baseadas nos resultados'),
});

/**
 * Contract Catalog (lista de todos os contratos detectados)
 */
export const ContractCatalogSchema = z.object({
  timestamp: z.string().datetime(),
  repo: z.string(),
  product: z.string(),
  services: z.array(ServiceIntegrationSchema).describe('Serviços detectados'),
  potential_contracts: z.array(z.object({
    consumer: z.string(),
    provider: z.string(),
    estimated_interactions: z.number().describe('Número estimado de interações'),
    detected_endpoints: z.array(z.string()),
    priority: z.enum(['critical', 'high', 'medium', 'low']).describe('Prioridade baseada em criticidade'),
  })).describe('Contratos potenciais identificados'),
  existing_contracts: z.array(z.string()).describe('Contratos já implementados'),
  coverage: z.object({
    total_integrations: z.number(),
    with_contracts: z.number(),
    without_contracts: z.number(),
    coverage_rate: z.number().min(0).max(1),
  }).describe('Coverage de contratos'),
  recommendations: z.array(z.string()),
});

/**
 * Types derivados dos schemas
 */
export type ServiceIntegration = z.infer<typeof ServiceIntegrationSchema>;
export type PactInteraction = z.infer<typeof PactInteractionSchema>;
export type PactContract = z.infer<typeof PactContractSchema>;
export type PactConfig = z.infer<typeof PactConfigSchema>;
export type VerificationResult = z.infer<typeof VerificationResultSchema>;
export type ContractVerificationReport = z.infer<typeof ContractVerificationReportSchema>;
export type ContractCatalog = z.infer<typeof ContractCatalogSchema>;

/**
 * Default Pact matchers (para usar em templates)
 */
export const PACT_MATCHERS = {
  string: { 'pact:matcher:type': 'type' },
  number: { 'pact:matcher:type': 'integer' },
  boolean: { 'pact:matcher:type': 'boolean' },
  iso8601DateTime: { 'pact:matcher:type': 'timestamp', format: 'yyyy-MM-dd\'T\'HH:mm:ss' },
  uuid: { 'pact:matcher:type': 'regex', regex: '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' },
  email: { 'pact:matcher:type': 'regex', regex: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$' },
} as const;

/**
 * Priority calculation para contratos
 * Baseado em: criticidade do CUJ + número de integrações + volume de tráfego
 */
export function calculateContractPriority(params: {
  cujCriticality?: 'critical' | 'high' | 'medium' | 'low';
  integrationCount: number;
  hasExistingContract: boolean;
}): 'critical' | 'high' | 'medium' | 'low' {
  const { cujCriticality, integrationCount, hasExistingContract } = params;
  
  // Se já tem contrato, prioridade baixa (manutenção)
  if (hasExistingContract) return 'low';
  
  // Se é CUJ crítico, sempre alta prioridade
  if (cujCriticality === 'critical') return 'critical';
  if (cujCriticality === 'high') return 'high';
  
  // Se tem muitas integrações, aumenta prioridade
  if (integrationCount >= 5) return 'high';
  if (integrationCount >= 3) return 'medium';
  
  return 'low';
}
