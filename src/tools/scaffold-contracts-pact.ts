/**
 * Scaffold Pact Contract Tests
 * 
 * Gera testes de contrato consumer/provider usando Pact Framework
 * 
 * **Fase 3 do Quality Gates Pipeline**
 * 
 * Baseado em:
 * - Consumer-Driven Contract Testing (Pact)
 * - Martin Fowler's Integration Contract Testing
 * - https://docs.pact.io/
 * 
 * @see https://martinfowler.com/articles/consumerDrivenContracts.html
 */

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import { detectLanguage } from '../detectors/language.js';
import { findExpressRoutes, findOpenAPI } from '../detectors/express.js';
import { getPaths, ensurePaths, getOutputPath } from '../utils/paths.js';
import { writeFileSafe, join } from '../utils/fs.js';
import { loadMCPSettings, mergeSettings } from '../utils/config.js';
import { getPactAdapter, extractServiceName, type PactAdapter } from '../adapters/pact-adapter.js';
import type { 
  ServiceIntegration, 
  PactInteraction, 
  ContractCatalog,
  PactConfig 
} from '../schemas/contract-schemas.js';
import { ContractCatalogSchema, calculateContractPriority } from '../schemas/contract-schemas.js';

export interface ScaffoldContractsPactParams {
  repo: string;
  product: string;
  cuj_file?: string; // qa/<product>/tests/analyses/cuj-catalog.json
  analyze_file?: string; // qa/<product>/tests/analyses/analyze.json
  broker_url?: string; // Pact Broker URL (opcional)
  broker_token?: string; // Pact Broker authentication token
  auto_detect?: boolean; // Auto-detect services (default: true)
}

export interface ScaffoldContractsPactResult {
  ok: boolean;
  message: string;
  catalog_path?: string; // contract-catalog.json
  config_path?: string; // pact.config.ts
  consumer_tests?: string[]; // consumer test files
  provider_tests?: string[]; // provider test files
  total_contracts: number;
  total_interactions: number;
  recommendations: string[];
}

/**
 * Scaffold Pact Contract Tests
 */
export async function scaffoldContractsPact(
  params: ScaffoldContractsPactParams
): Promise<ScaffoldContractsPactResult> {
  console.log('🔗 Scaffolding Pact Contract Tests...\n');
  
  const { repo, product, broker_url, broker_token, auto_detect = true } = params;
  
  // Load configuration
  const fileSettings = await loadMCPSettings(repo, product);
  const settings = mergeSettings(fileSettings, params);
  
  // Setup paths
  const paths = getPaths(repo, product, fileSettings || undefined);
  await ensurePaths(paths);
  
  // Detect language
  const langDetection = await detectLanguage(repo);
  console.log(`✅ Language detected: ${langDetection.primary} (${langDetection.framework})`);
  
  // Get Pact adapter for language
  const pactAdapter = getPactAdapter(langDetection.primary);
  
  // Step 1: Detect services and integrations
  console.log('\n📋 Step 1: Detecting services and integrations...');
  const catalog = await detectServicesAndIntegrations({
    repo,
    product,
    paths,
    cuj_file: params.cuj_file,
    analyze_file: params.analyze_file,
    auto_detect,
  });
  
  if (catalog.services.length === 0) {
    return {
      ok: false,
      message: 'No services or integrations detected. Run `analyze` first or ensure your code has HTTP endpoints/clients.',
      total_contracts: 0,
      total_interactions: 0,
      recommendations: [
        'Run `quality analyze` to detect services',
        'Ensure your code has HTTP endpoints (Express, FastAPI, Spring Boot)',
        'Ensure your code has HTTP clients (fetch, axios, requests, RestTemplate)',
      ],
    };
  }
  
  console.log(`✅ Detected ${catalog.services.length} services`);
  console.log(`✅ Identified ${catalog.potential_contracts.length} potential contracts`);
  
  // Save catalog
  const catalogPath = join(paths.analyses, 'contract-catalog.json');
  await writeFileSafe(catalogPath, JSON.stringify(catalog, null, 2));
  console.log(`✅ Saved contract catalog: ${catalogPath}`);
  
  // Step 2: Generate Pact configuration
  console.log('\n⚙️  Step 2: Generating Pact configuration...');
  const configPath = await generatePactConfig({
    paths,
    pactAdapter,
    language: langDetection.primary,
    framework: langDetection.framework || 'unknown',
    product,
    broker_url,
    broker_token,
  });
  
  // Step 3: Generate consumer tests
  console.log('\n📝 Step 3: Generating consumer tests...');
  const consumerTests = await generateConsumerTests({
    paths,
    pactAdapter,
    catalog,
    product,
  });
  
  // Step 4: Generate provider tests
  console.log('\n🔍 Step 4: Generating provider tests...');
  const providerTests = await generateProviderTests({
    paths,
    pactAdapter,
    catalog,
    product,
  });
  
  // Calculate totals
  const totalContracts = catalog.potential_contracts.length;
  const totalInteractions = catalog.potential_contracts.reduce(
    (sum, contract) => sum + contract.estimated_interactions,
    0
  );
  
  // Generate recommendations
  const recommendations = generateRecommendations(catalog, langDetection.primary);
  
  console.log('\n✅ Pact scaffolding complete!');
  console.log(`   Contracts: ${totalContracts}`);
  console.log(`   Interactions: ${totalInteractions}`);
  console.log(`   Consumer tests: ${consumerTests.length}`);
  console.log(`   Provider tests: ${providerTests.length}`);
  
  return {
    ok: true,
    message: `Generated ${totalContracts} Pact contracts with ${totalInteractions} interactions`,
    catalog_path: catalogPath,
    config_path: configPath,
    consumer_tests: consumerTests,
    provider_tests: providerTests,
    total_contracts: totalContracts,
    total_interactions: totalInteractions,
    recommendations,
  };
}

/**
 * Detect services and integrations from code
 */
async function detectServicesAndIntegrations(params: {
  repo: string;
  product: string;
  paths: ReturnType<typeof getPaths>;
  cuj_file?: string;
  analyze_file?: string;
  auto_detect: boolean;
}): Promise<ContractCatalog> {
  const { repo, product, paths, cuj_file, analyze_file, auto_detect } = params;
  
  const services: ServiceIntegration[] = [];
  const potentialContracts: ContractCatalog['potential_contracts'] = [];
  const existingContracts: string[] = [];
  
  // Load CUJ catalog if available (for criticality)
  let cujCriticality: Record<string, 'critical' | 'high' | 'medium' | 'low'> = {};
  if (cuj_file) {
    try {
      const cujData = JSON.parse(await readFile(cuj_file, 'utf-8'));
      cujCriticality = cujData.cujs?.reduce((acc: any, cuj: any) => {
        acc[cuj.id] = cuj.criticality;
        return acc;
      }, {});
    } catch (err) {
      console.warn(`⚠️  Could not load CUJ catalog from ${cuj_file}`);
    }
  }
  
  // Load analyze.json if available
  let analyzeData: any = null;
  if (analyze_file && existsSync(analyze_file)) {
    try {
      analyzeData = JSON.parse(await readFile(analyze_file, 'utf-8'));
    } catch (err) {
      console.warn(`⚠️  Could not load analyze data from ${analyze_file}`);
    }
  }
  
  // Detect provider endpoints (services we expose)
  if (auto_detect) {
    const endpoints = await findExpressRoutes(repo);
    const openapi = await findOpenAPI(repo);
    
    if (endpoints.length > 0) {
      // Group endpoints by service
      const serviceGroups: Record<string, typeof endpoints> = {};
      for (const endpoint of endpoints) {
        const serviceName = extractServiceName(endpoint.path);
        if (!serviceGroups[serviceName]) {
          serviceGroups[serviceName] = [];
        }
        serviceGroups[serviceName].push(endpoint);
      }
      
      // Create service for each group
      for (const [serviceName, serviceEndpoints] of Object.entries(serviceGroups)) {
        services.push({
          name: `${product}-${serviceName}-api`,
          type: 'http',
          role: 'provider',
          endpoints: serviceEndpoints.map(ep => ({
            method: ep.method,
            path: ep.path,
            description: `${ep.method} ${ep.path}`,
          })),
          dependencies: [],
          detected_from: openapi.length > 0 ? 'openapi' : 'code',
          file_path: serviceEndpoints[0]?.file || undefined,
        });
      }
    }
    
    // Detect consumer dependencies (services we call)
    // TODO: Scan código para fetch(), axios.get(), requests.get(), etc.
    // Por enquanto, usar analyze.json se disponível
    if (analyzeData?.findings?.endpoints) {
      const externalEndpoints = analyzeData.findings.endpoints.filter(
        (ep: string) => ep.includes('http')
      );
      
      if (externalEndpoints.length > 0) {
        services.push({
          name: `${product}-client`,
          type: 'http',
          role: 'consumer',
          dependencies: externalEndpoints,
          detected_from: 'code',
        });
      }
    }
  }
  
  // Generate potential contracts
  const providers = services.filter(s => s.role === 'provider' || s.role === 'both');
  const consumers = services.filter(s => s.role === 'consumer' || s.role === 'both');
  
  // Se temos providers mas nenhum consumer, criar um consumer genérico
  // (útil para testes e para começar com CDC)
  if (providers.length > 0 && consumers.length === 0) {
    services.push({
      name: `${product}-client`,
      type: 'http',
      role: 'consumer',
      dependencies: providers.map(p => p.name),
      detected_from: 'code',
    });
  }
  
  // Recalcular após adicionar consumer genérico
  const finalProviders = services.filter(s => s.role === 'provider' || s.role === 'both');
  const finalConsumers = services.filter(s => s.role === 'consumer' || s.role === 'both');
  
  // Consumer → Provider contracts
  for (const consumer of finalConsumers) {
    for (const provider of finalProviders) {
      // Check if consumer depends on provider
      const dependsOnProvider = consumer.dependencies?.some(dep =>
        dep.includes(provider.name) || provider.endpoints?.some(ep => dep.includes(ep.path))
      );
      
      if (dependsOnProvider || finalConsumers.length === 1) {
        const detectedEndpoints = provider.endpoints?.map(ep => `${ep.method} ${ep.path}`) || [];
        const priority = calculateContractPriority({
          cujCriticality: Object.values(cujCriticality)[0], // First CUJ criticality as heuristic
          integrationCount: detectedEndpoints.length,
          hasExistingContract: false, // TODO: Check if pact file exists
        });
        
        potentialContracts.push({
          consumer: consumer.name,
          provider: provider.name,
          estimated_interactions: detectedEndpoints.length,
          detected_endpoints: detectedEndpoints,
          priority,
        });
      }
    }
  }
  
  // Calculate coverage
  const coverage = {
    total_integrations: services.length,
    with_contracts: existingContracts.length,
    without_contracts: services.length - existingContracts.length,
    coverage_rate: services.length > 0 ? existingContracts.length / services.length : 0,
  };
  
  // Recommendations
  const recommendations: string[] = [];
  if (coverage.coverage_rate < 0.5) {
    recommendations.push(`Low contract coverage (${Math.round(coverage.coverage_rate * 100)}%). Prioritize critical integrations.`);
  }
  if (potentialContracts.some(c => c.priority === 'critical')) {
    recommendations.push('Found critical contracts. Implement CDC tests immediately.');
  }
  if (services.length === 1) {
    recommendations.push('Only one service detected. CDC is more valuable in microservices architectures.');
  }
  
  return {
    timestamp: new Date().toISOString(),
    repo,
    product,
    services,
    potential_contracts: potentialContracts,
    existing_contracts: existingContracts,
    coverage,
    recommendations,
  };
}

/**
 * Generate Pact configuration file
 */
async function generatePactConfig(params: {
  paths: ReturnType<typeof getPaths>;
  pactAdapter: PactAdapter;
  language: string;
  framework: string;
  product: string;
  broker_url?: string;
  broker_token?: string;
}): Promise<string> {
  const { paths, pactAdapter, language, framework, product, broker_url, broker_token } = params;
  
  const configContent = pactAdapter.generatePactConfig({
    language: language as any,
    framework,
    consumerName: `${product}-consumer`,
    providerName: `${product}-provider`,
    baseUrl: 'http://localhost:3000', // Default, can be overridden
    outputDir: './qa/' + product + '/tests/contracts/pacts',
    pactBrokerUrl: broker_url,
    pactBrokerToken: broker_token,
  });
  
  const ext = language === 'python' ? '.py' : language === 'java' ? '.java' : '.ts';
  const filename = language === 'python' ? 'pact_config' : 'pact.config';
  const configPath = join(paths.contracts, filename + ext);
  
  await writeFileSafe(configPath, configContent);
  console.log(`✅ Generated config: ${configPath}`);
  
  return configPath;
}

/**
 * Generate consumer tests
 */
async function generateConsumerTests(params: {
  paths: ReturnType<typeof getPaths>;
  pactAdapter: PactAdapter;
  catalog: ContractCatalog;
  product: string;
}): Promise<string[]> {
  const { paths, pactAdapter, catalog, product } = params;
  const consumerTests: string[] = [];
  
  for (const contract of catalog.potential_contracts) {
    // Generate interactions from detected endpoints
    const interactions: PactInteraction[] = contract.detected_endpoints.map((endpoint, idx) => {
      const [method, path] = endpoint.split(' ');
      
      return {
        description: `${method} ${path}`,
        providerState: 'default state',
        request: {
          method,
          path,
          headers: { 'Content-Type': 'application/json' },
        },
        response: {
          status: 200,
          headers: { 'Content-Type': 'application/json' },
          body: { status: 'success', data: {} },
        },
      };
    });
    
    if (interactions.length === 0) continue;
    
    const testContent = pactAdapter.generateConsumerTest({
      consumerName: contract.consumer,
      providerName: contract.provider,
      interactions,
      outputDir: './pacts',
    });
    
    const ext = pactAdapter.language === 'python' ? '_test.py' : pactAdapter.language === 'java' ? '.java' : '.spec.ts';
    const testPath = join(
      paths.contracts,
      `${contract.consumer}-consumer.pact${ext}`
    );
    
    await writeFileSafe(testPath, testContent);
    consumerTests.push(testPath);
    console.log(`✅ Generated consumer test: ${testPath}`);
  }
  
  return consumerTests;
}

/**
 * Generate provider tests
 */
async function generateProviderTests(params: {
  paths: ReturnType<typeof getPaths>;
  pactAdapter: PactAdapter;
  catalog: ContractCatalog;
  product: string;
}): Promise<string[]> {
  const { paths, pactAdapter, catalog, product } = params;
  const providerTests: string[] = [];
  
  // Group contracts by provider
  const providerGroups: Record<string, string[]> = {};
  for (const contract of catalog.potential_contracts) {
    if (!providerGroups[contract.provider]) {
      providerGroups[contract.provider] = [];
    }
    providerGroups[contract.provider].push(contract.consumer);
  }
  
  for (const [providerName, consumerNames] of Object.entries(providerGroups)) {
    const testContent = pactAdapter.generateProviderTest({
      providerName,
      consumerNames,
      baseUrl: 'http://localhost:3000', // Default
      pactDir: './pacts',
    });
    
    const ext = pactAdapter.language === 'python' ? '_test.py' : pactAdapter.language === 'java' ? '.java' : '.spec.ts';
    const testPath = join(
      paths.contracts,
      `${providerName}-provider.pact${ext}`
    );
    
    await writeFileSafe(testPath, testContent);
    providerTests.push(testPath);
    console.log(`✅ Generated provider test: ${testPath}`);
  }
  
  return providerTests;
}

/**
 * Generate recommendations based on catalog
 */
function generateRecommendations(catalog: ContractCatalog, language: string): string[] {
  const recommendations: string[] = [];
  
  // Dependencies
  const deps = language === 'python' 
    ? ['pact-python'] 
    : language === 'java'
    ? ['au.com.dius.pact.consumer:junit5', 'au.com.dius.pact.provider:junit5']
    : ['@pact-foundation/pact'];
  
  recommendations.push(`Install Pact dependencies: ${deps.join(', ')}`);
  
  // Broker
  if (!catalog.services.some(s => s.detected_from === 'openapi')) {
    recommendations.push('Consider setting up Pact Broker to share contracts between teams');
  }
  
  // Critical contracts
  const criticalContracts = catalog.potential_contracts.filter(c => c.priority === 'critical');
  if (criticalContracts.length > 0) {
    recommendations.push(`Prioritize ${criticalContracts.length} critical contract(s): ${criticalContracts.map(c => `${c.consumer}→${c.provider}`).join(', ')}`);
  }
  
  // Coverage
  if (catalog.coverage.coverage_rate < 0.5) {
    recommendations.push(`Improve contract coverage from ${Math.round(catalog.coverage.coverage_rate * 100)}% to at least 80%`);
  }
  
  return recommendations;
}
