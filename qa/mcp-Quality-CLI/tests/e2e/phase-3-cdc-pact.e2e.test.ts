/**
 * E2E Tests for FASE 3: CDC/Pact Contract Testing
 * 
 * Testa o fluxo completo:
 * 1. Detectar serviços e endpoints
 * 2. Gerar contratos Pact
 * 3. Gerar consumer e provider tests
 * 4. Executar verificação de contratos
 * 5. Gerar relatórios
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { mkdir, rm, writeFile, readFile, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { scaffoldContractsPact } from '../../../../src/tools/scaffold-contracts-pact.js';
import { runContractsVerify } from '../../../../src/tools/run-contracts-verify.js';

const __dirname = dirname(new URL(import.meta.url).pathname);
const testDir = resolve(__dirname, '.tmp-phase3');
const realRepo = resolve(process.cwd());

describe('FASE 3: CDC/Pact E2E Tests', () => {
  const testProduct = 'test-cdc-app';
  const qaRoot = resolve(testDir, `qa/${testProduct}`);
  beforeAll(async () => {
    // Setup: Create temporary test directory
    await rm(testDir, { recursive: true, force: true });
    await mkdir(testDir, { recursive: true });
    
    // Create mock Express routes for testing
    const mockExpressApp = `
import express from 'express';

const app = express();

// Users API
app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.post('/api/users', (req, res) => {
  res.status(201).json({ id: 1, name: 'Test User' });
});

app.get('/api/users/:id', (req, res) => {
  res.json({ id: req.params.id, name: 'Test User' });
});

// Products API
app.get('/api/products', (req, res) => {
  res.json({ products: [] });
});

app.post('/api/products', (req, res) => {
  res.status(201).json({ id: 1, name: 'Test Product', price: 99.99 });
});

// Orders API
app.get('/api/orders', (req, res) => {
  res.json({ orders: [] });
});

app.post('/api/orders', (req, res) => {
  res.status(201).json({ id: 1, userId: 1, total: 99.99 });
});

export default app;
`;
    
    await mkdir(resolve(testDir, 'src/api'), { recursive: true });
    await writeFile(resolve(testDir, 'src/api/app.ts'), mockExpressApp);
    
    // Create minimal package.json
    const packageJson = {
      name: testProduct,
      version: '1.0.0',
      type: 'module',
      dependencies: { express: '^4.18.0' },
    };
    await writeFile(resolve(testDir, 'package.json'), JSON.stringify(packageJson, null, 2));
  });

  afterAll(async () => {
    // Cleanup: Remove temporary test directory
    await rm(testDir, { recursive: true, force: true });
  });

  it('[1/4] scaffold_contracts_pact - deve detectar serviços e gerar contratos', async () => {
    // Act
    const result = await scaffoldContractsPact({
      repo: testDir,
      product: 'test-cdc-app',
    });

    // Assert: Resultado básico
    expect(result.ok).toBe(true);
    expect(result.message).toContain('Generated');
    expect(result.total_contracts).toBeGreaterThan(0);
    expect(result.total_interactions).toBeGreaterThan(0);

    // Assert: Arquivos gerados
    expect(result.catalog_path).toBeDefined();
    expect(result.config_path).toBeDefined();
    expect(result.consumer_tests).toBeDefined();
    expect(result.provider_tests).toBeDefined();

    // Assert: Catalog existe e tem estrutura correta
    expect(existsSync(result.catalog_path!)).toBe(true);
    const catalog = JSON.parse(await readFile(result.catalog_path!, 'utf-8'));
    expect(catalog.timestamp).toBeDefined();
    expect(catalog.product).toBe('test-cdc-app');
    expect(catalog.services).toBeDefined();
    expect(Array.isArray(catalog.services)).toBe(true);
    expect(catalog.services.length).toBeGreaterThan(0);
    expect(catalog.potential_contracts).toBeDefined();
    expect(Array.isArray(catalog.potential_contracts)).toBe(true);
    expect(catalog.coverage).toBeDefined();
    expect(catalog.coverage.total_integrations).toBeGreaterThan(0);

    // Assert: Config existe
    expect(existsSync(result.config_path!)).toBe(true);
    const configContent = await readFile(result.config_path!, 'utf-8');
    expect(configContent).toContain('pactConfig');
    expect(configContent).toContain('test-cdc-app');
    expect(configContent).toContain('consumer');
    expect(configContent).toContain('provider');

    // Assert: Consumer tests gerados
    expect(result.consumer_tests!.length).toBeGreaterThan(0);
    for (const testPath of result.consumer_tests!) {
      expect(existsSync(testPath)).toBe(true);
      const testContent = await readFile(testPath, 'utf-8');
      expect(testContent).toContain('consumer');
      expect(testContent).toContain('provider');
      expect(testContent).toContain('interaction');
    }

    // Assert: Provider tests gerados
    expect(result.provider_tests!.length).toBeGreaterThan(0);
    for (const testPath of result.provider_tests!) {
      expect(existsSync(testPath)).toBe(true);
      const testContent = await readFile(testPath, 'utf-8');
      expect(testContent).toContain('provider');
      expect(testContent).toContain('verify');
    }

    // Assert: Recommendations
    expect(result.recommendations).toBeDefined();
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.some((r: string) => r.includes('Pact'))).toBe(true);
  }, 15000);

  it('[2/4] scaffold_contracts_pact - deve detectar múltiplas APIs corretamente', async () => {
    // Act
    const result = await scaffoldContractsPact({
      repo: testDir,
      product: 'test-cdc-app',
    });

    // Assert: Catalog de contratos
    const catalog = JSON.parse(await readFile(result.catalog_path!, 'utf-8'));
    
    // Deve detectar pelo menos 3 grupos de endpoints (users, products, orders)
    const serviceNames = catalog.services.map((s: any) => s.name);
    expect(serviceNames.some((name: string) => name.includes('users'))).toBe(true);
    expect(serviceNames.some((name: string) => name.includes('products'))).toBe(true);
    expect(serviceNames.some((name: string) => name.includes('orders'))).toBe(true);

    // Cada serviço deve ter endpoints
    for (const service of catalog.services) {
      if (service.role === 'provider') {
        expect(service.endpoints).toBeDefined();
        expect(Array.isArray(service.endpoints)).toBe(true);
        if (service.endpoints && service.endpoints.length > 0) {
          expect(service.endpoints[0]).toHaveProperty('method');
          expect(service.endpoints[0]).toHaveProperty('path');
        }
      }
    }

    // Contratos potenciais devem ter prioridade
    for (const contract of catalog.potential_contracts) {
      expect(contract).toHaveProperty('consumer');
      expect(contract).toHaveProperty('provider');
      expect(contract).toHaveProperty('priority');
      expect(['critical', 'high', 'medium', 'low']).toContain(contract.priority);
      expect(contract.estimated_interactions).toBeGreaterThanOrEqual(0);
    }
  }, 15000);

  it('[3/4] run_contracts_verify - deve verificar contratos gerados', async () => {
    // Arrange: Garantir que contratos foram gerados
    await scaffoldContractsPact({
      repo: testDir,
      product: testProduct,
    });

    // Criar mock pact files no diretório esperado
    const pactsDir = resolve(qaRoot, 'tests/contracts/pacts');
    await mkdir(pactsDir, { recursive: true });
    
    const mockPactContent = {
      consumer: { name: `${testProduct}-client` },
      provider: { name: `${testProduct}-users-api` },
      interactions: [
        {
          description: 'GET /api/users',
          providerState: 'users exist',
          request: {
            method: 'GET',
            path: '/api/users',
            headers: { 'Content-Type': 'application/json' },
          },
          response: {
            status: 200,
            headers: { 'Content-Type': 'application/json' },
            body: { users: [] },
          },
        },
      ],
      metadata: {
        pactSpecification: { version: '2.0.0' },
      },
    };
    
    await writeFile(
      resolve(pactsDir, `${testProduct}-client-${testProduct}-users-api.json`),
      JSON.stringify(mockPactContent, null, 2)
    );

    // Act
    const result = await runContractsVerify({
      repo: testDir,
      product: testProduct,
      provider_base_url: 'http://localhost:3000',
    });

    // Assert: Resultado básico
    expect(result.ok).toBe(true);
    expect(result.verification_rate).toBeGreaterThanOrEqual(0);
    expect(result.verification_rate).toBeLessThanOrEqual(1);
    expect(result.total_interactions).toBeGreaterThan(0);
    expect(result.verified).toBeGreaterThanOrEqual(0);
    expect(result.failed).toBeGreaterThanOrEqual(0);

    // Assert: Report JSON existe
    expect(result.report_path).toBeDefined();
    expect(existsSync(result.report_path!)).toBe(true);
    
    const report = JSON.parse(await readFile(result.report_path!, 'utf-8'));
    expect(report.timestamp).toBeDefined();
    expect(report.product).toBe(testProduct);
    expect(report.language).toBe('typescript');
    expect(report.total_contracts).toBeGreaterThan(0);
    expect(report.total_interactions).toBeGreaterThan(0);
    expect(report.verification_rate).toBeGreaterThanOrEqual(0);
    expect(report.results).toBeDefined();
    expect(Array.isArray(report.results)).toBe(true);
    expect(report.duration_total_ms).toBeGreaterThan(0);

    // Assert: Recommendations
    expect(result.recommendations).toBeDefined();
    expect(result.recommendations.length).toBeGreaterThan(0);

    // Assert: Relatório Markdown existe
    const mdPath = resolve(qaRoot, 'tests/reports/CONTRACTS-VERIFY.md');
    expect(existsSync(mdPath)).toBe(true);
    
    const mdContent = await readFile(mdPath, 'utf-8');
    expect(mdContent).toContain('Contract Verification Report');
    expect(mdContent).toContain('Summary');
    expect(mdContent).toContain('Verification Rate');
    expect(mdContent).toContain(result.total_interactions.toString());
  }, 15000);

  it('[4/4] FULL PIPELINE - scaffold + verify funcionam em sequência', async () => {
    // Act: Step 1 - Scaffold
    const scaffoldResult = await scaffoldContractsPact({
      repo: testDir,
      product: testProduct,
      broker_url: 'https://pact-broker.example.com',
      broker_token: 'test-token',
    });

    expect(scaffoldResult.ok).toBe(true);
    expect(scaffoldResult.total_contracts).toBeGreaterThan(0);

    // Assert: Broker URL incluído no config
    const configContent = await readFile(scaffoldResult.config_path!, 'utf-8');
    expect(configContent).toContain('pact-broker.example.com');

    // Criar mock pact files para verificação
    const pactsDir = resolve(qaRoot, 'tests/contracts/pacts');
    await mkdir(pactsDir, { recursive: true });
    
    // Gerar múltiplos pact files para testar pipeline completo
    const services = ['users', 'products', 'orders'];
    for (const service of services) {
      const pactContent = {
        consumer: { name: `${testProduct}-client` },
        provider: { name: `${testProduct}-${service}-api` },
        interactions: [
          {
            description: `GET /api/${service}`,
            request: { method: 'GET', path: `/api/${service}` },
            response: { status: 200, body: { [service]: [] } },
          },
          {
            description: `POST /api/${service}`,
            request: { method: 'POST', path: `/api/${service}` },
            response: { status: 201, body: { id: 1 } },
          },
        ],
      };
      
      await writeFile(
        resolve(pactsDir, `${testProduct}-client-${testProduct}-${service}-api.json`),
        JSON.stringify(pactContent, null, 2)
      );
    }

    // Act: Step 2 - Verify
    const verifyResult = await runContractsVerify({
      repo: testDir,
      product: testProduct,
      provider_base_url: 'http://localhost:3000',
      publish: false, // Don't actually publish in tests
    });

    // Assert: Verification completa
    expect(verifyResult.ok).toBe(true);
    expect(verifyResult.total_interactions).toBe(6); // 3 services × 2 interactions each
    expect(verifyResult.verification_rate).toBeGreaterThan(0);

    // Assert: Todas as métricas estão presentes
    const report = JSON.parse(await readFile(verifyResult.report_path!, 'utf-8'));
    expect(report.total_contracts).toBe(3);
    expect(report.total_interactions).toBe(6);
    expect(report.verified).toBeGreaterThanOrEqual(0);
    expect(report.failed).toBeGreaterThanOrEqual(0);
    expect(report.verified + report.failed).toBe(6);

    // Assert: Estrutura de diretórios completa
    expect(existsSync(resolve(qaRoot, 'tests/contracts'))).toBe(true);
    expect(existsSync(resolve(qaRoot, 'tests/contracts/pacts'))).toBe(true);
    expect(existsSync(resolve(qaRoot, 'tests/analyses/contract-catalog.json'))).toBe(true);
    expect(existsSync(resolve(qaRoot, 'tests/reports/contracts-verify.json'))).toBe(true);
    expect(existsSync(resolve(qaRoot, 'tests/reports/CONTRACTS-VERIFY.md'))).toBe(true);
  }, 20000);
});
