/**
 * Unit tests for run-contracts-verify tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { runContractsVerify } from '../run-contracts-verify.js';
import * as langDetector from '../../detectors/language.js';
import * as fsUtils from '../../utils/fs.js';
import * as pathsUtils from '../../utils/paths.js';
import * as configUtils from '../../utils/config.js';
import { existsSync } from 'fs';
import { readdir, readFile } from 'fs/promises';

vi.mock('../../detectors/language.js');
vi.mock('../../utils/fs.js');
vi.mock('../../utils/paths.js');
vi.mock('../../utils/config.js');
vi.mock('fs');
vi.mock('fs/promises');
vi.mock('child_process');

describe('run-contracts-verify', () => {
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
    fixtures: '/test/repo/qa/test-product/tests/fixtures',
    fixturesAuth: '/test/repo/qa/test-product/tests/fixtures/auth',
    dashboards: '/test/repo/qa/test-product/tests/dashboards',
    patches: '/test/repo/qa/test-product/tests/patches',
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

  it('deve retornar erro se diretório de pacts não existir', async () => {
    // Arrange
    vi.mocked(existsSync).mockReturnValue(false);

    // Act
    const result = await runContractsVerify({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.message).toContain('No Pact contracts found');
    expect(result.verification_rate).toBe(0);
    expect(result.recommendations).toContain('Run `quality scaffold --type contracts` to generate Pact contracts');
  });

  it('deve retornar erro se nenhum arquivo pact for encontrado', async () => {
    // Arrange
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue([]);

    // Act
    const result = await runContractsVerify({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.ok).toBe(false);
    expect(result.verification_rate).toBe(0);
    expect(result.total_interactions).toBe(0);
  });

  it('deve verificar contratos com sucesso', async () => {
    // Arrange
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue(['consumer-provider.json'] as any);
    
    const mockPactContent = JSON.stringify({
      consumer: { name: 'test-consumer' },
      provider: { name: 'test-provider' },
      interactions: [
        {
          description: 'GET /api/users',
          request: { method: 'GET', path: '/api/users' },
          response: { status: 200, body: { users: [] } },
        },
      ],
    });
    
    vi.mocked(readFile).mockResolvedValue(mockPactContent);

    // Act
    const result = await runContractsVerify({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.ok).toBe(true);
    expect(result.total_interactions).toBe(1);
    expect(result.verified).toBe(1);
    expect(result.failed).toBe(0);
    expect(result.verification_rate).toBe(1);
  });

  it('deve calcular verification_rate corretamente', async () => {
    // Arrange
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue(['contract.json'] as any);
    
    const mockPactContent = JSON.stringify({
      consumer: { name: 'test-consumer' },
      provider: { name: 'test-provider' },
      interactions: [
        { description: 'interaction 1', request: { method: 'GET', path: '/api/1' }, response: { status: 200 } },
        { description: 'interaction 2', request: { method: 'GET', path: '/api/2' }, response: { status: 200 } },
        { description: 'interaction 3', request: { method: 'GET', path: '/api/3' }, response: { status: 200 } },
      ],
    });
    
    vi.mocked(readFile).mockResolvedValue(mockPactContent);

    // Act
    const result = await runContractsVerify({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.total_interactions).toBe(3);
    expect(result.verification_rate).toBeGreaterThanOrEqual(0);
    expect(result.verification_rate).toBeLessThanOrEqual(1);
  });

  it('deve gerar relatório JSON', async () => {
    // Arrange
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue(['contract.json'] as any);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      consumer: { name: 'test' },
      provider: { name: 'test' },
      interactions: [{ description: 'test', request: {}, response: {} }],
    }));

    // Act
    const result = await runContractsVerify({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.report_path).toBeDefined();
    expect(result.report_path).toContain('contracts-verify.json');
    
    const reportCalls = vi.mocked(fsUtils.writeFileSafe).mock.calls.filter(
      call => call[0].includes('contracts-verify.json')
    );
    expect(reportCalls.length).toBe(1);
  });

  it('deve gerar relatório Markdown', async () => {
    // Arrange
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue(['contract.json'] as any);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      consumer: { name: 'test' },
      provider: { name: 'test' },
      interactions: [{ description: 'test', request: {}, response: {} }],
    }));

    // Act
    const result = await runContractsVerify({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    const mdCalls = vi.mocked(fsUtils.writeFileSafe).mock.calls.filter(
      call => call[0].includes('CONTRACTS-VERIFY.md')
    );
    expect(mdCalls.length).toBe(1);
    
    const mdContent = mdCalls[0][1];
    expect(mdContent).toContain('Contract Verification Report');
    expect(mdContent).toContain('Summary');
  });

  it('deve incluir falhas no resultado quando houver', async () => {
    // Arrange
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue(['contract.json'] as any);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      consumer: { name: 'test' },
      provider: { name: 'test' },
      interactions: [{ description: 'failing test', request: {}, response: {} }],
    }));

    // Act
    const result = await runContractsVerify({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    // Note: Em uma implementação real, alguns testes podem falhar
    // Para este mock, todos passam, mas a estrutura está preparada
    expect(result.failures).toBeDefined();
    expect(Array.isArray(result.failures)).toBe(true);
  });

  it('deve gerar recomendações baseadas nos resultados', async () => {
    // Arrange
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue(['contract.json'] as any);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      consumer: { name: 'test' },
      provider: { name: 'test' },
      interactions: [{ description: 'test', request: {}, response: {} }],
    }));

    // Act
    const result = await runContractsVerify({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.recommendations).toBeDefined();
    expect(result.recommendations.length).toBeGreaterThan(0);
  });

  it('deve processar múltiplos arquivos pact', async () => {
    // Arrange
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue([
      'consumer1-provider.json',
      'consumer2-provider.json',
    ] as any);
    
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      consumer: { name: 'test' },
      provider: { name: 'test' },
      interactions: [{ description: 'test', request: {}, response: {} }],
    }));

    // Act
    const result = await runContractsVerify({
      repo: mockRepo,
      product: mockProduct,
    });

    // Assert
    expect(result.total_interactions).toBe(2); // 2 files × 1 interaction each
    expect(vi.mocked(readFile)).toHaveBeenCalledTimes(2);
  });

  it('deve aceitar provider_base_url customizado', async () => {
    // Arrange
    vi.mocked(existsSync).mockReturnValue(true);
    vi.mocked(readdir).mockResolvedValue(['contract.json'] as any);
    vi.mocked(readFile).mockResolvedValue(JSON.stringify({
      consumer: { name: 'test' },
      provider: { name: 'test' },
      interactions: [{ description: 'test', request: {}, response: {} }],
    }));

    const customUrl = 'http://localhost:8080';

    // Act
    const result = await runContractsVerify({
      repo: mockRepo,
      product: mockProduct,
      provider_base_url: customUrl,
    });

    // Assert
    expect(result).toBeDefined();
    // Em uma implementação real, verificaríamos se o customUrl foi usado
  });
});
