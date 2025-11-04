import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { detectRepoContext, autoQualityRun, runAutoMode } from '../auto.js';

// Mock all the tools
vi.mock('../analyze.js');
vi.mock('../plan.js');
vi.mock('../scaffold-unit.js');
vi.mock('../run-coverage.js');
vi.mock('../run-diff-coverage.js'); // 🆕 Mock diff coverage
vi.mock('../dashboard.js');
vi.mock('../consolidate-reports.js');
vi.mock('../recommend-strategy.js');
vi.mock('../pyramid-report.js'); // 🆕
vi.mock('../scaffold.js'); // 🆕
vi.mock('../self-check.js'); // 🆕
vi.mock('../coverage.js'); // 🆕
vi.mock('../analyze-test-logic.js'); // 🆕
vi.mock('../validate.js'); // 🆕
vi.mock('../catalog-cujs.js'); // 🆕
vi.mock('../define-slos.js'); // 🆕
vi.mock('../risk-register.js'); // 🆕
vi.mock('../portfolio-plan.js'); // 🆕
vi.mock('../scaffold-contracts-pact.js'); // 🆕
vi.mock('../run-contracts-verify.js'); // 🆕
vi.mock('../scaffold-property-tests.js'); // 🆕
vi.mock('../scaffold-approval-tests.js'); // 🆕
vi.mock('../suite-health.js'); // 🆕
vi.mock('../run-mutation-tests.js'); // 🆕
vi.mock('../prod-metrics-ingest.js'); // 🆕
vi.mock('../slo-canary-check.js'); // 🆕
vi.mock('../release-quality-gate.js'); // 🆕

describe('auto.ts - detectRepoContext', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(process.cwd(), '.test-auto-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    
    // 🆕 Mock TODOS os tools para retornarem sucesso
    const { analyze } = await import('../analyze.js');
    const { selfCheck } = await import('../self-check.js');
    const { catalogCUJs } = await import('../catalog-cujs.js');
    const { defineSLOs } = await import('../define-slos.js');
    const { riskRegister } = await import('../risk-register.js');
    const { portfolioPlan } = await import('../portfolio-plan.js');
    
    vi.mocked(analyze).mockResolvedValue({ summary: 'OK', findings: { routes: [], endpoints: [], events: [], risk_map: [] }, recommendations: [], plan_path: '' } as any);
    vi.mocked(selfCheck).mockResolvedValue({ ok: true, checks: [], missing: [], commands: [] } as any);
    vi.mocked(catalogCUJs).mockResolvedValue({ ok: true } as any);
    vi.mocked(defineSLOs).mockResolvedValue({ ok: true } as any);
    vi.mocked(riskRegister).mockResolvedValue({ ok: true } as any);
    vi.mocked(portfolioPlan).mockResolvedValue({ ok: true } as any);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should detect product from package.json', async () => {
    await fs.writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'my-awesome-app', version: '1.0.0' }),
      'utf-8'
    );

    const context = await detectRepoContext(tempDir);

    expect(context.product).toBe('my-awesome-app');
    expect(context.hasPackageJson).toBe(true);
  });

  it('should detect existing tests', async () => {
    await fs.mkdir(join(tempDir, 'tests', 'unit'), { recursive: true });
    await fs.writeFile(join(tempDir, 'tests', 'unit', 'app.test.ts'), 'test content', 'utf-8');

    const context = await detectRepoContext(tempDir);

    expect(context.hasTests).toBe(true);
  });

  it('should detect test framework from package.json', async () => {
    await fs.writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-app',
        devDependencies: { vitest: '^2.0.0', typescript: '^5.0.0' }
      }),
      'utf-8'
    );

    const context = await detectRepoContext(tempDir);

    expect(context.testFramework).toBe('vitest');
    expect(context.language).toBe('typescript');
  });

  it('should fallback to directory name if no package.json', async () => {
    const context = await detectRepoContext(tempDir);

    // Should fallback to directory name
    expect(context.product).toContain('.test-auto-');
    expect(context.hasPackageJson).toBe(false);
    expect(context.hasTests).toBe(false);
  });

  it('should handle package.json without name', async () => {
    await fs.writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ version: '1.0.0' }),
      'utf-8'
    );

    const context = await detectRepoContext(tempDir);

    // Fallback to directory name
    expect(context.product).toContain('.test-auto-');
    expect(context.hasPackageJson).toBe(true);
  });
});

describe('auto.ts - autoQualityRun', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(process.cwd(), '.test-auto-run-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    
    // Create minimal package.json
    await fs.writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-project' }),
      'utf-8'
    );

    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should execute analyze mode successfully', async () => {
    const { analyze } = await import('../analyze.js');
    vi.mocked(analyze).mockResolvedValue({
      summary: 'Test analysis',
      findings: {
        routes: ['GET /api/users'],
        endpoints: [],
        events: [],
        risk_map: []
      },
      recommendations: [],
      plan_path: join(tempDir, 'tests', 'analyses', 'analyze.json')
    });

    const result = await autoQualityRun({
      mode: 'analyze',
      repo: tempDir,
      product: 'TestApp'
    });

    expect(result.ok).toBe(true);
    expect(result.steps).toContain('analyze');
    expect(result.steps).not.toContain('plan');
    expect(analyze).toHaveBeenCalledWith({
      repo: tempDir,
      product: 'TestApp'
    });
  });

  it('should execute plan mode (analyze + plan)', async () => {
    const { analyze } = await import('../analyze.js');
    const { generatePlan } = await import('../plan.js');

    vi.mocked(analyze).mockResolvedValue({
      summary: 'Test',
      findings: { routes: [], endpoints: [], events: [], risk_map: [] },
      recommendations: [],
      plan_path: join(tempDir, 'analyze.json')
    });

    vi.mocked(generatePlan).mockResolvedValue({
      ok: true,
      plan: join(tempDir, 'TEST-PLAN.md')
    });

    const result = await autoQualityRun({
      mode: 'plan',
      repo: tempDir
    });

    expect(result.ok).toBe(true);
    expect(result.steps).toContain('analyze');
    expect(result.steps).toContain('plan');
    expect(result.steps).not.toContain('scaffold-unit');
    expect(generatePlan).toHaveBeenCalled();
  });

  it('should execute scaffold mode (analyze + plan + scaffold)', async () => {
    const { analyze } = await import('../analyze.js');
    const { generatePlan } = await import('../plan.js');
    const { scaffoldUnitTests } = await import('../scaffold-unit.js');

    vi.mocked(analyze).mockResolvedValue({
      summary: 'Test',
      findings: { routes: [], endpoints: [], events: [], risk_map: [] },
      recommendations: [],
      plan_path: join(tempDir, 'analyze.json')
    });

    vi.mocked(generatePlan).mockResolvedValue({
      ok: true,
      plan: join(tempDir, 'TEST-PLAN.md')
    });

    vi.mocked(scaffoldUnitTests).mockResolvedValue({
      ok: true,
      generated: ['src/__tests__/app.test.ts'],
      framework: 'vitest'
    });

    const result = await autoQualityRun({
      mode: 'scaffold',
      repo: tempDir
    });

    expect(result.ok).toBe(true);
    expect(result.steps).toContain('analyze');
    expect(result.steps).toContain('plan');
    expect(result.steps).toContain('scaffold-unit');
    expect(scaffoldUnitTests).toHaveBeenCalled();
  });

  it('should skip scaffold if tests already exist', async () => {
    // Create existing tests
    await fs.mkdir(join(tempDir, 'tests'), { recursive: true });
    await fs.writeFile(join(tempDir, 'tests', 'app.test.ts'), 'existing test', 'utf-8');

    const { analyze } = await import('../analyze.js');
    const { generatePlan } = await import('../plan.js');
    const { scaffoldUnitTests } = await import('../scaffold-unit.js');

    vi.mocked(analyze).mockResolvedValue({
      summary: 'Test',
      findings: { routes: [], endpoints: [], events: [], risk_map: [] },
      recommendations: [],
      plan_path: join(tempDir, 'analyze.json')
    });

    vi.mocked(generatePlan).mockResolvedValue({
      ok: true,
      plan: join(tempDir, 'TEST-PLAN.md')
    });

    const result = await autoQualityRun({
      mode: 'scaffold',
      repo: tempDir
    });

    expect(result.ok).toBe(true);
    expect(result.steps).not.toContain('scaffold-unit');
    expect(scaffoldUnitTests).not.toHaveBeenCalled();
  });

  it('should execute full mode (all steps)', async () => {
    // Create tests so coverage can run
    await fs.mkdir(join(tempDir, 'tests'), { recursive: true });
    await fs.writeFile(join(tempDir, 'tests', 'app.test.ts'), 'test', 'utf-8');

    const { analyze } = await import('../analyze.js');
    const { generatePlan } = await import('../plan.js');
    const { recommendTestStrategy } = await import('../recommend-strategy.js');
    const { runCoverageAnalysis } = await import('../run-coverage.js');
    const { generateDashboard } = await import('../dashboard.js');
    const { consolidateCodeAnalysisReport, consolidateTestPlanReport } = await import('../consolidate-reports.js');

    vi.mocked(analyze).mockResolvedValue({
      summary: 'Test',
      findings: { routes: [], endpoints: [], events: [], risk_map: [] },
      recommendations: [],
      plan_path: join(tempDir, 'analyze.json')
    });

    vi.mocked(generatePlan).mockResolvedValue({
      ok: true,
      plan: join(tempDir, 'TEST-PLAN.md')
    });

    vi.mocked(recommendTestStrategy).mockResolvedValue({
      ok: true,
      summary: 'Test strategy',
      recommendations: []
    });

    vi.mocked(consolidateCodeAnalysisReport).mockResolvedValue({
      ok: true,
      path: join(tempDir, 'CODE-ANALYSIS.md')
    });

    vi.mocked(consolidateTestPlanReport).mockResolvedValue({
      ok: true,
      path: join(tempDir, 'TEST-PLAN.md')
    });

    vi.mocked(runCoverageAnalysis).mockResolvedValue({
      ok: true,
      summary: {
        lines: { total: 100, covered: 80, pct: 80 },
        functions: { total: 20, covered: 16, pct: 80 },
        branches: { total: 40, covered: 32, pct: 80 },
        statements: { total: 100, covered: 80, pct: 80 }
      },
      files: [],
      analysis: {
        status: 'good',
        meetsThresholds: true,
        gaps: [],
        recommendations: [],
        priorities: []
      },
      reportPath: join(tempDir, 'coverage-report.md')
    });

    vi.mocked(generateDashboard).mockResolvedValue({
      ok: true,
      dashboard_path: join(tempDir, 'dashboard.html')
    });

    const result = await autoQualityRun({
      mode: 'full',
      repo: tempDir
    });

    expect(result.ok).toBe(true);
    expect(result.steps).toContain('analyze');
    expect(result.steps).toContain('plan');
    expect(result.steps).toContain('code-analysis-report');
    expect(result.steps).toContain('test-plan-report');
    expect(result.steps).toContain('coverage');
    expect(result.steps).toContain('dashboard');
  });

  it('should skip run if skipRun is true', async () => {
    const { analyze } = await import('../analyze.js');
    const { runCoverageAnalysis } = await import('../run-coverage.js');

    vi.mocked(analyze).mockResolvedValue({
      summary: 'Test',
      findings: { routes: [], endpoints: [], events: [], risk_map: [] },
      recommendations: [],
      plan_path: join(tempDir, 'analyze.json')
    });

    const result = await autoQualityRun({
      mode: 'full',
      repo: tempDir,
      skipRun: true
    });

    expect(result.ok).toBe(true);
    expect(result.steps).not.toContain('coverage');
    expect(runCoverageAnalysis).not.toHaveBeenCalled();
  });

  it('should handle errors gracefully', async () => {
    const { analyze } = await import('../analyze.js');

    vi.mocked(analyze).mockRejectedValue(new Error('Analysis failed'));

    const result = await autoQualityRun({
      mode: 'analyze',
      repo: tempDir
    });

    expect(result.ok).toBe(false);
    // [FASE 1] Executa init-product + self-check + FASE 1 (CUJ/SLO/Risk) antes de analyze
    // [FASE 2] Portfolio Planning agora está ativo
    expect(result.steps).toEqual(['init-product', 'self-check', 'catalog-cujs', 'define-slos', 'risk-register', 'portfolio-plan']);
  });
});

describe('auto.ts - runAutoMode', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(process.cwd(), '.test-auto-mode-' + Date.now());
    await fs.mkdir(tempDir, { recursive: true });
    
    await fs.writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'test-app' }),
      'utf-8'
    );

    vi.clearAllMocks();
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {}
  });

  it('should return true on successful run', async () => {
    const { analyze } = await import('../analyze.js');

    vi.mocked(analyze).mockResolvedValue({
      summary: 'Test',
      findings: { routes: [], endpoints: [], events: [], risk_map: [] },
      recommendations: [],
      plan_path: join(tempDir, 'analyze.json')
    });

    const success = await runAutoMode('analyze', { repo: tempDir });

    expect(success).toBe(true);
  });

  it('should return false on failed run', async () => {
    const { analyze } = await import('../analyze.js');

    vi.mocked(analyze).mockRejectedValue(new Error('Failed'));

    const success = await runAutoMode('analyze', { repo: tempDir });

    expect(success).toBe(false);
  });
});
