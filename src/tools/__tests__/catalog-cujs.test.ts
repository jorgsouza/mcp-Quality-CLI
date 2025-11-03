/**
 * catalog-cujs.test.ts
 * Testes unitários para catalog_cujs tool
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { catalogCUJs } from '../catalog-cujs.js';
import * as fs from 'node:fs/promises';
import * as langDetector from '../../detectors/language.js';
import * as expressDetector from '../../detectors/express.js';
import * as nextDetector from '../../detectors/next.js';
import * as paths from '../../utils/paths.js';

vi.mock('node:fs/promises');
vi.mock('../../detectors/language.js');
vi.mock('../../detectors/express.js');
vi.mock('../../detectors/next.js');
vi.mock('../../utils/paths.js');

describe('catalogCUJs', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Mock getPaths para retornar paths de teste
    vi.mocked(paths.getPaths).mockReturnValue({
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
    });
    
    // Mock ensurePaths para não criar diretórios de verdade
    vi.mocked(paths.ensurePaths).mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('Express routes discovery', () => {
    it('deve catalogar rotas Express básicas', async () => {
      vi.mocked(langDetector.detectLanguage).mockResolvedValue({
        primary: 'javascript',
        framework: 'Express',
        testCommand: 'npm test',
        coverageCommand: 'npm run coverage',
        coverageFile: 'coverage/lcov.info',
        testPatterns: ['**/*.test.js'],
        sourcePatterns: ['src/**/*.js'],
      });

      vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
        { method: 'POST', path: '/api/auth/login', file: 'routes/auth.ts' },
        { method: 'GET', path: '/api/users/:id', file: 'routes/users.ts' },
      ]);

      vi.mocked(nextDetector.findNextRoutes).mockResolvedValue([]);

      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('README não existe'));

      const result = await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['routes'],
      });

      expect(result.ok).toBe(true);
      // Apenas 1 CUJ (auth) porque /api/users/:id não atinge threshold de > 2 endpoints
      expect(result.cujs_count).toBe(1);
      expect(result.output).toContain('cuj-catalog.json');
    });

    it('deve classificar /api/auth como critical', async () => {
      vi.mocked(langDetector.detectLanguage).mockResolvedValue({
        primary: 'javascript',
        framework: 'Express',
        testCommand: 'npm test',
        coverageCommand: 'npm run coverage',
        coverageFile: 'coverage/lcov.info',
        testPatterns: ['**/*.test.js'],
        sourcePatterns: ['src/**/*.js'],
      });

      vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
        { method: 'POST', path: '/api/auth/login', file: 'routes/auth.ts' },
      ]);

      vi.mocked(nextDetector.findNextRoutes).mockResolvedValue([]);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('README não existe'));

      let catalogData: any;
      vi.mocked(fs.writeFile).mockImplementation(async (path, data) => {
        if (typeof path === 'string' && path.includes('cuj-catalog.json')) {
          catalogData = JSON.parse(data as string);
        }
      });

      await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['routes'],
      });

      expect(catalogData.cujs).toHaveLength(1);
      expect(catalogData.cujs[0].criticality).toBe('critical');
    });

    it('deve classificar /api/checkout como critical', async () => {
      vi.mocked(langDetector.detectLanguage).mockResolvedValue({
        primary: 'javascript',
        framework: 'Express',
        testCommand: 'npm test',
        coverageCommand: 'npm run coverage',
        coverageFile: 'coverage/lcov.info',
        testPatterns: ['**/*.test.js'],
        sourcePatterns: ['src/**/*.js'],
      });

      vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
        { method: 'POST', path: '/api/checkout/payment', file: 'routes/checkout.ts' },
      ]);

      vi.mocked(nextDetector.findNextRoutes).mockResolvedValue([]);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('README não existe'));

      let catalogData: any;
      vi.mocked(fs.writeFile).mockImplementation(async (path, data) => {
        if (typeof path === 'string' && path.includes('cuj-catalog.json')) {
          catalogData = JSON.parse(data as string);
        }
      });

      await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['routes'],
      });

      expect(catalogData.cujs[0].criticality).toBe('critical');
    });

    it('deve classificar /api/search como high', async () => {
      vi.mocked(langDetector.detectLanguage).mockResolvedValue({
        primary: 'javascript',
        framework: 'Express',
        testCommand: 'npm test',
        coverageCommand: 'npm run coverage',
        coverageFile: 'coverage/lcov.info',
        testPatterns: ['**/*.test.js'],
        sourcePatterns: ['src/**/*.js'],
      });

      vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
        { method: 'GET', path: '/api/search/products', file: 'routes/search.ts' },
      ]);

      vi.mocked(nextDetector.findNextRoutes).mockResolvedValue([]);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('README não existe'));

      let catalogData: any;
      vi.mocked(fs.writeFile).mockImplementation(async (path, data) => {
        if (typeof path === 'string' && path.includes('cuj-catalog.json')) {
          catalogData = JSON.parse(data as string);
        }
      });

      await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['routes'],
      });

      expect(catalogData.cujs[0].criticality).toBe('high');
    });

    it('deve degradar /api/admin de critical para high', async () => {
      vi.mocked(langDetector.detectLanguage).mockResolvedValue({
        primary: 'javascript',
        framework: 'Express',
        testCommand: 'npm test',
        coverageCommand: 'npm run coverage',
        coverageFile: 'coverage/lcov.info',
        testPatterns: ['**/*.test.js'],
        sourcePatterns: ['src/**/*.js'],
      });

      vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
        { method: 'GET', path: '/api/admin/dashboard', file: 'routes/admin.ts' },
        { method: 'GET', path: '/api/admin/users', file: 'routes/admin.ts' },
        { method: 'POST', path: '/api/admin/settings', file: 'routes/admin.ts' },
      ]);

      vi.mocked(nextDetector.findNextRoutes).mockResolvedValue([]);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('README não existe'));

      let catalogData: any;
      vi.mocked(fs.writeFile).mockImplementation(async (path, data) => {
        if (typeof path === 'string' && path.includes('cuj-catalog.json')) {
          catalogData = JSON.parse(data as string);
        }
      });

      await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['routes'],
      });

      // admin não deve ser critical (degradado)
      expect(catalogData.cujs[0].criticality).not.toBe('critical');
    });
  });

  describe('Next.js routes discovery', () => {
    it('deve catalogar rotas Next.js', async () => {
      vi.mocked(langDetector.detectLanguage).mockResolvedValue({
        primary: 'typescript',
        framework: 'Next.js',
        testCommand: 'npm test',
        coverageCommand: 'npm run coverage',
        coverageFile: 'coverage/lcov.info',
        testPatterns: ['**/*.test.ts'],
        sourcePatterns: ['src/**/*.ts'],
      });

      vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([]);
      vi.mocked(nextDetector.findNextRoutes).mockResolvedValue([
        '/api/auth/login',
        '/api/users/[id]',
      ]);

      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('README não existe'));

      const result = await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['routes'],
      });

      expect(result.ok).toBe(true);
      // Apenas 1 CUJ (auth) porque /api/users/[id] não atinge threshold de > 2 endpoints
      expect(result.cujs_count).toBe(1);
    });
  });

  describe('README discovery', () => {
    it('deve extrair features do README', async () => {
      vi.mocked(langDetector.detectLanguage).mockResolvedValue({
        primary: 'javascript',
        framework: 'Express',
        testCommand: 'npm test',
        coverageCommand: 'npm run coverage',
        coverageFile: 'coverage/lcov.info',
        testPatterns: ['**/*.test.js'],
        sourcePatterns: ['src/**/*.js'],
      });

      vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([]);
      vi.mocked(nextDetector.findNextRoutes).mockResolvedValue([]);

      const mockReadme = `
# Test Project

## Features
- User authentication
- Payment processing
- Product search
`;

      vi.mocked(fs.readFile).mockResolvedValue(mockReadme);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['readme'],
      });

      expect(result.ok).toBe(true);
      expect(result.cujs_count).toBe(3);
    });
  });

  describe('Deduplication', () => {
    it('deve mesclar endpoints duplicados no mesmo CUJ', async () => {
      vi.mocked(langDetector.detectLanguage).mockResolvedValue({
        primary: 'javascript',
        framework: 'Express',
        testCommand: 'npm test',
        coverageCommand: 'npm run coverage',
        coverageFile: 'coverage/lcov.info',
        testPatterns: ['**/*.test.js'],
        sourcePatterns: ['src/**/*.js'],
      });

      vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
        { method: 'POST', path: '/api/auth/login', file: 'routes/auth.ts' },
        { method: 'POST', path: '/api/auth/logout', file: 'routes/auth.ts' },
        { method: 'GET', path: '/api/auth/verify', file: 'routes/auth-v2.ts' },
      ]);

      vi.mocked(nextDetector.findNextRoutes).mockResolvedValue([]);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('README não existe'));

      let catalogData: any;
      vi.mocked(fs.writeFile).mockImplementation(async (path, data) => {
        if (typeof path === 'string' && path.includes('cuj-catalog.json')) {
          catalogData = JSON.parse(data as string);
        }
      });

      await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['routes'],
      });

      // Deve ter apenas 1 CUJ (auth) com 3 endpoints agrupados
      expect(catalogData.cujs).toHaveLength(1);
      expect(catalogData.cujs[0].id).toBe('auth-api');
      expect(catalogData.cujs[0].endpoints).toHaveLength(3);
    });
  });

  describe('Multi-language support', () => {
    it('deve detectar projeto TypeScript', async () => {
      vi.mocked(langDetector.detectLanguage).mockResolvedValue({
        primary: 'typescript',
        framework: 'Express',
        testCommand: 'npm test',
        coverageCommand: 'npm run coverage',
        coverageFile: 'coverage/lcov.info',
        testPatterns: ['**/*.test.ts'],
        sourcePatterns: ['src/**/*.ts'],
      });

      vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
        { method: 'POST', path: '/api/auth/login', file: 'src/routes/auth.ts' },
      ]);

      vi.mocked(nextDetector.findNextRoutes).mockResolvedValue([]);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('README não existe'));

      let catalogData: any;
      vi.mocked(fs.writeFile).mockImplementation(async (path, data) => {
        if (typeof path === 'string' && path.includes('cuj-catalog.json')) {
          catalogData = JSON.parse(data as string);
        }
      });

      const result = await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['routes'],
      });

      expect(result.ok).toBe(true);
      expect(catalogData.cujs).toHaveLength(1);
    });

    it('deve detectar projeto Python', async () => {
      vi.mocked(langDetector.detectLanguage).mockResolvedValue({
        primary: 'python',
        framework: 'FastAPI',
        testCommand: 'pytest',
        coverageCommand: 'pytest --cov',
        coverageFile: 'coverage.xml',
        testPatterns: ['**/test_*.py', '**/*_test.py'],
        sourcePatterns: ['src/**/*.py', 'app/**/*.py'],
      });

      // Para Python, não tem detector de rotas ainda, então vai retornar vazio
      vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([]);
      vi.mocked(nextDetector.findNextRoutes).mockResolvedValue([]);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('README não existe'));

      const result = await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['routes'],
      });

      expect(result.ok).toBe(true);
      // Sem detector de rotas Python, retorna 0 CUJs (por enquanto)
      expect(result.cujs_count).toBe(0);
    });

    it('deve detectar projeto Java', async () => {
      vi.mocked(langDetector.detectLanguage).mockResolvedValue({
        primary: 'java',
        framework: 'Spring Boot',
        testCommand: 'mvn test',
        coverageCommand: 'mvn jacoco:report',
        coverageFile: 'target/site/jacoco/jacoco.xml',
        testPatterns: ['**/src/test/**/*Test.java'],
        sourcePatterns: ['**/src/main/**/*.java'],
      });

      vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([]);
      vi.mocked(nextDetector.findNextRoutes).mockResolvedValue([]);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('README não existe'));

      const result = await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['routes'],
      });

      expect(result.ok).toBe(true);
      // Sem detector de rotas Java, retorna 0 CUJs (por enquanto)
      expect(result.cujs_count).toBe(0);
    });
  });

  describe('Error handling', () => {
    it('deve retornar ok=false se language detection falhar', async () => {
      vi.mocked(langDetector.detectLanguage).mockRejectedValue(new Error('Language detection failed'));

      const result = await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['routes'],
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Language detection failed');
    });

    it('deve retornar ok=false se writeFile falhar', async () => {
      vi.mocked(langDetector.detectLanguage).mockResolvedValue({
        primary: 'javascript',
        framework: 'Express',
        testCommand: 'npm test',
        coverageCommand: 'npm run coverage',
        coverageFile: 'coverage/lcov.info',
        testPatterns: ['**/*.test.js'],
        sourcePatterns: ['src/**/*.js'],
      });

      vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
        { method: 'GET', path: '/api/test', file: 'routes/test.ts' },
      ]);

      vi.mocked(nextDetector.findNextRoutes).mockResolvedValue([]);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.readFile).mockRejectedValue(new Error('README não existe'));
      vi.mocked(fs.writeFile).mockRejectedValue(new Error('Disk full'));

      const result = await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['routes'],
      });

      expect(result.ok).toBe(false);
      expect(result.error).toContain('Disk full');
    });
  });

  describe('Multi-source integration', () => {
    it('deve combinar rotas + README', async () => {
      vi.mocked(langDetector.detectLanguage).mockResolvedValue({
        primary: 'javascript',
        framework: 'Express',
        testCommand: 'npm test',
        coverageCommand: 'npm run coverage',
        coverageFile: 'coverage/lcov.info',
        testPatterns: ['**/*.test.js'],
        sourcePatterns: ['src/**/*.js'],
      });

      vi.mocked(expressDetector.findExpressRoutes).mockResolvedValue([
        { method: 'POST', path: '/api/auth/login', file: 'routes/auth.ts' },
      ]);

      vi.mocked(nextDetector.findNextRoutes).mockResolvedValue([]);

      const mockReadme = `
## Features
- Analytics dashboard
`;

      vi.mocked(fs.readFile).mockResolvedValue(mockReadme);
      vi.mocked(fs.mkdir).mockResolvedValue(undefined as any);
      vi.mocked(fs.writeFile).mockResolvedValue(undefined);

      const result = await catalogCUJs({
        repo: '/test/repo',
        product: 'test-product',
        sources: ['routes', 'readme'],
      });

      expect(result.ok).toBe(true);
      expect(result.cujs_count).toBe(2); // 1 from routes + 1 from README
    });
  });
});
