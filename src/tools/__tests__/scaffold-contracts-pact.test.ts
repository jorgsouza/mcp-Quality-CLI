/**
 * Unit tests for scaffold-contracts-pact tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { scaffoldContractsPact } from '../scaffold-contracts-pact.js';
import * as langDetector from '../../detectors/language.js';
import * as expressDetector from '../../detectors/express.js';
import * as fsUtils from '../../utils/fs.js';
import * as pathsUtils from '../../utils/paths.js';
import * as configUtils from '../../utils/config.js';
import { existsSync } from 'fs';
import { readFile } from 'fs/promises';

vi.mock('../../detectors/language.js');
vi.mock('../../detectors/express.js');
vi.mock('../../utils/fs.js');
vi.mock('../../utils/paths.js');
vi.mock('../../utils/config.js');
vi.mock('fs');
vi.mock('fs/promises');

describe('scaffold-contracts-pact', () => {
  const mockRepo = '/test/repo';
  const mockProduct = 'test-product';
  
  const mockPaths = {
    root: '/test/repo/qa/test-product',
    analyses: '/test/repo/qa/test-product/tests/analyses',
    reports: '/test/repo/qa/test-product/tests/reports',
    playwrightReports: '/test/repo/qa/test-product/tests/reports/playwright',
    unit: '/test/repo/qa/test-product/tests/unit',
    integration: '/test/repo/qa/test-product/tests/integration',
    e2e: '/test/repo/qa/test-product/tests/e2e',
    contracts: '/test/repo/qa/test-product/tests/contracts',
    fixtures: '/test/repo/qa/test-product/fixtures',
    fixturesAuth: '/test/repo/qa/test-product/fixtures/auth',
    dashboards: '/test/repo/qa/test-product/dashboards',
    patches: '/test/repo/qa/test-product/patches',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock getPaths to return mock structure
    vi.mocked(pathsUtils.getPaths).mockReturnValue(mockPaths as any);
    
    // Mock ensurePaths to do nothing
    vi.mocked(pathsUtils.ensurePaths).mockResolvedValue(undefined);
    
    // Mock loadMCPSettings to return null (no config file)
    vi.mocked(configUtils.loadMCPSettings).mockResolvedValue(null);
    
    // Mock mergeSettings to return params as-is
    vi.mocked(configUtils.mergeSettings).mockImplementation((fileSettings, params) => ({
      repo: params.repo,
      product: params.product,
      ...params,
    }) as any);
    
    // Mock language detection
    vi.mocked(langDetector.detectLanguage).mockResolvedValue({
      primary: 'typescript',
      framework: 'Express',
      testCommand: 'npm test',
      coverageCommand: 'npm run coverage',
      coverageFile: 'coverage/lcov.info',
      testPatterns: ['**/*.test.ts'],
      sourcePatterns: ['src/**/*.ts'],
    });
    
    // Mock file system
    vi.mocked(fsUtils.writeFileSafe).mockResolvedValue(undefined);
    vi.mocked(fsUtils.join).mockImplementation((...paths) => paths.join('/'));
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  it('deve retornar erro se nenhum serviço for detectado', async () => {
    // Arrange
    vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([]);
    vi.mocked(expressDetector.findOpenAPI).mockResolvedValue([]);

    // Act
    const result = await scaffoldContractsPact({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.message).toContain('No services or integrations detected');
    expect(result.total_contracts).toBe(0);
  });

  it('deve gerar contratos quando endpoints são detectados', async () => {
    // Arrange
    vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
      { method: 'GET', path: '/api/users', file: 'users.ts' },
      { method: 'POST', path: '/api/users', file: 'users.ts' },
      { method: 'GET', path: '/api/products', file: 'products.ts' },
    ]);
    vi.mocked(expressDetector.findOpenAPI).mockResolvedValue([]);

    // Act
    const result = await scaffoldContractsPact({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.ok).toBe(true);
    expect(result.total_contracts).toBeGreaterThan(0);
    expect(result.consumer_tests).toBeDefined();
    expect(result.provider_tests).toBeDefined();
    expect(result.catalog_path).toBeDefined();
    expect(result.config_path).toBeDefined();
  });

  it('deve gerar config TypeScript para projeto TypeScript', async () => {
    // Arrange
    vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
      { method: 'GET', path: '/api/test', file: 'test.ts' },
    ]);
    vi.mocked(expressDetector.findOpenAPI).mockResolvedValue([]);

    // Act
    const result = await scaffoldContractsPact({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.config_path).toContain('pact.config.ts');
    const configCalls = vi.mocked(fsUtils.writeFileSafe).mock.calls.filter(
      call => call[0].includes('pact.config')
    );
    expect(configCalls.length).toBeGreaterThan(0);
  });

  it('deve gerar consumer tests para cada contrato', async () => {
    // Arrange
    vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
      { method: 'GET', path: '/api/users', file: 'users.ts' },
      { method: 'POST', path: '/api/orders', file: 'orders.ts' },
    ]);
    vi.mocked(expressDetector.findOpenAPI).mockResolvedValue([]);

    // Act
    const result = await scaffoldContractsPact({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.consumer_tests).toBeDefined();
    expect(result.consumer_tests!.length).toBeGreaterThan(0);
    expect(result.consumer_tests!.some(t => t.includes('consumer.pact'))).toBe(true);
  });

  it('deve gerar provider tests', async () => {
    // Arrange
    vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
      { method: 'GET', path: '/api/users', file: 'users.ts' },
    ]);
    vi.mocked(expressDetector.findOpenAPI).mockResolvedValue([]);

    // Act
    const result = await scaffoldContractsPact({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.provider_tests).toBeDefined();
    expect(result.provider_tests!.length).toBeGreaterThan(0);
    expect(result.provider_tests!.some(t => t.includes('provider.pact'))).toBe(true);
  });

  it('deve incluir broker_url no config se fornecido', async () => {
    // Arrange
    vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
      { method: 'GET', path: '/api/test', file: 'test.ts' },
    ]);
    vi.mocked(expressDetector.findOpenAPI).mockResolvedValue([]);

    const brokerUrl = 'https://pact-broker.example.com';

    // Act
    const result = await scaffoldContractsPact({
      repo: mockRepo,
      product: mockProduct,
      broker_url: brokerUrl,
    });

    // Assert
    const configContent = vi.mocked(fsUtils.writeFileSafe).mock.calls.find(
      call => call[0].includes('pact.config')
    )?.[1];
    
    expect(configContent).toContain(brokerUrl);
  });

  it('deve gerar recomendações apropriadas', async () => {
    // Arrange
    vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
      { method: 'GET', path: '/api/users', file: 'users.ts' },
    ]);
    vi.mocked(expressDetector.findOpenAPI).mockResolvedValue([]);

    // Act
    const result = await scaffoldContractsPact({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.recommendations).toBeDefined();
    expect(result.recommendations.length).toBeGreaterThan(0);
    expect(result.recommendations.some(r => r.includes('Pact'))).toBe(true);
  });

  it('deve detectar Python e gerar config Python', async () => {
    // Arrange
    vi.mocked(langDetector.detectLanguage).mockResolvedValue({
      primary: 'python',
      framework: 'FastAPI',
      testCommand: 'pytest',
      coverageCommand: 'pytest --cov',
      coverageFile: 'coverage.xml',
      testPatterns: ['**/test_*.py'],
      sourcePatterns: ['src/**/*.py'],
    });
    vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
      { method: 'GET', path: '/api/test', file: 'test.py' },
    ]);
    vi.mocked(expressDetector.findOpenAPI).mockResolvedValue([]);

    // Act
    const result = await scaffoldContractsPact({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.config_path).toContain('pact_config.py');
  });

  it('deve salvar catalog de contratos', async () => {
    // Arrange
    vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
      { method: 'GET', path: '/api/test', file: 'test.ts' },
    ]);
    vi.mocked(expressDetector.findOpenAPI).mockResolvedValue([]);

    // Act
    const result = await scaffoldContractsPact({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.catalog_path).toBeDefined();
    expect(result.catalog_path).toContain('contract-catalog.json');
    
    const catalogCalls = vi.mocked(fsUtils.writeFileSafe).mock.calls.filter(
      call => call[0].includes('contract-catalog.json')
    );
    expect(catalogCalls.length).toBe(1);
  });
});
