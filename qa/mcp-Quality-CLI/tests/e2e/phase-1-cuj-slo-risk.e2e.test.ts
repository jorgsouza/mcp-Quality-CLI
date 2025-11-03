/**
 * phase-1-cuj-slo-risk.e2e.test.ts
 * Teste E2E do fluxo completo FASE 1: CUJ → SLO → Risk
 * 
 * Dogfooding: Testa as 3 tools em sequência com dados reais do mcp-Quality-CLI
 */

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { rm, mkdir, cp } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { catalogCUJs } from '../../../../src/tools/catalog-cujs.js';
import { defineSLOs } from '../../../../src/tools/define-slos.js';
import { riskRegister } from '../../../../src/tools/risk-register.js';

describe('FASE 1 E2E: CUJ → SLO → Risk Pipeline', () => {
  // Usar diretório .tmp dentro de qa/mcp-Quality-CLI/tests/e2e/
  const testDir = resolve(dirname(new URL(import.meta.url).pathname), '.tmp');
  const realRepo = resolve(process.cwd()); // Repositório real
  const testRepo = testDir; // As tools criarão qa/{product} dentro deste diretório
  const testProduct = 'test-phase1-e2e';
  const qaRoot = resolve(testRepo, `qa/${testProduct}`);

  beforeAll(async () => {
    // Limpar .tmp antes de começar
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
    // Criar diretório .tmp
    await mkdir(testDir, { recursive: true });
    
    // Copiar src/ do repositório real para .tmp (tools precisam do código)
    await cp(resolve(realRepo, 'src'), resolve(testDir, 'src'), { recursive: true });
    await cp(resolve(realRepo, 'package.json'), resolve(testDir, 'package.json'));
  });

  afterAll(async () => {
    // SEMPRE limpar .tmp após testes
    if (existsSync(testDir)) {
      await rm(testDir, { recursive: true, force: true });
    }
  });

  it('[1/3] catalog_cujs deve gerar cuj-catalog.json', async () => {
    const result = await catalogCUJs({
      repo: testRepo,
      product: testProduct,
      sources: ['routes', 'readme'],
    });

    expect(result.ok).toBe(true);
    expect(result.cujs_count).toBeGreaterThan(0);
    expect(result.output).toContain('cuj-catalog.json');
    expect(existsSync(result.output)).toBe(true);

    // Validar estrutura do JSON
    const catalogRaw = await readFile(result.output, 'utf-8');
    const catalog = JSON.parse(catalogRaw);

    expect(catalog).toHaveProperty('timestamp');
    expect(catalog).toHaveProperty('repo');
    expect(catalog).toHaveProperty('product');
    expect(catalog).toHaveProperty('cujs');
    expect(Array.isArray(catalog.cujs)).toBe(true);
    expect(catalog.cujs.length).toBeGreaterThan(0);

    // Validar primeiro CUJ
    const firstCUJ = catalog.cujs[0];
    expect(firstCUJ).toHaveProperty('id');
    expect(firstCUJ).toHaveProperty('name');
    expect(firstCUJ).toHaveProperty('criticality');
    expect(['critical', 'high', 'medium', 'low']).toContain(firstCUJ.criticality);
  }, 10000); // 10s timeout

  it('[2/3] define_slos deve gerar slos.json baseado em CUJs', async () => {
    const result = await defineSLOs({
      repo: testRepo,
      product: testProduct,
      // cuj_file será buscado automaticamente
    });

    expect(result.ok).toBe(true);
    expect(result.slos_count).toBeGreaterThan(0);
    expect(result.output).toContain('slos.json');
    expect(existsSync(result.output)).toBe(true);

    // Validar estrutura do JSON
    const slosRaw = await readFile(result.output, 'utf-8');
    const slos = JSON.parse(slosRaw);

    expect(slos).toHaveProperty('timestamp');
    expect(slos).toHaveProperty('repo');
    expect(slos).toHaveProperty('product');
    expect(slos).toHaveProperty('slos');
    expect(slos).toHaveProperty('defaults_applied');
    expect(typeof slos.defaults_applied).toBe('boolean');

    // Validar primeiro SLO
    const firstSLO = slos.slos[0];
    expect(firstSLO).toHaveProperty('cuj_id');
    expect(firstSLO).toHaveProperty('error_rate_max');
    expect(firstSLO).toHaveProperty('availability_min');

    // SLO deve estar entre 0 e 1
    expect(firstSLO.error_rate_max).toBeGreaterThanOrEqual(0);
    expect(firstSLO.error_rate_max).toBeLessThanOrEqual(1);
    expect(firstSLO.availability_min).toBeGreaterThanOrEqual(0);
    expect(firstSLO.availability_min).toBeLessThanOrEqual(1);
  }, 10000);

  it('[3/3] risk_register deve gerar risk-register.json cruzando CUJs + SLOs', async () => {
    const result = await riskRegister({
      repo: testRepo,
      product: testProduct,
      // cuj_file e slos_file serão buscados automaticamente
    });

    expect(result.ok).toBe(true);
    expect(result.total_risks).toBeGreaterThan(0);
    expect(result.output).toContain('risk-register.json');
    expect(existsSync(result.output)).toBe(true);

    // Validar estrutura do JSON
    const riskRaw = await readFile(result.output, 'utf-8');
    const riskReg = JSON.parse(riskRaw);

    expect(riskReg).toHaveProperty('timestamp');
    expect(riskReg).toHaveProperty('repo');
    expect(riskReg).toHaveProperty('product');
    expect(riskReg).toHaveProperty('risks');
    expect(riskReg).toHaveProperty('top_5_critical');
    expect(riskReg).toHaveProperty('total_risk_score');
    expect(riskReg).toHaveProperty('coverage_gaps');

    // top_5_critical deve ser array de strings (IDs)
    expect(Array.isArray(riskReg.top_5_critical)).toBe(true);
    expect(riskReg.top_5_critical.length).toBeLessThanOrEqual(5);
    if (riskReg.top_5_critical.length > 0) {
      expect(typeof riskReg.top_5_critical[0]).toBe('string');
    }

    // Validar primeiro risco
    if (riskReg.risks.length > 0) {
      const firstRisk = riskReg.risks[0];
      expect(firstRisk).toHaveProperty('id');
      expect(firstRisk).toHaveProperty('cuj_id');
      expect(firstRisk).toHaveProperty('title');
      expect(firstRisk).toHaveProperty('description');
      expect(firstRisk).toHaveProperty('impact');
      expect(firstRisk).toHaveProperty('probability');
      expect(firstRisk).toHaveProperty('risk_score');
      expect(firstRisk).toHaveProperty('affected_modules');
      expect(firstRisk).toHaveProperty('mitigation_strategies');
      expect(firstRisk).toHaveProperty('recommended_tests');

      // Risk score deve estar entre 0 e 100
      expect(firstRisk.risk_score).toBeGreaterThanOrEqual(0);
      expect(firstRisk.risk_score).toBeLessThanOrEqual(100);

      // Criticidades válidas
      expect(['critical', 'high', 'medium', 'low']).toContain(firstRisk.impact);
      expect(['very-high', 'high', 'medium', 'low', 'very-low']).toContain(firstRisk.probability);

      // Recomendações devem ser válidas
      const validTests = ['unit', 'integration', 'e2e', 'cdc', 'property', 'chaos'];
      firstRisk.recommended_tests.forEach((test: string) => {
        expect(validTests).toContain(test);
      });
    }
  }, 10000);

  it('[FULL] Pipeline completo deve criar 3 arquivos consistentes', async () => {
    const analyses = resolve(qaRoot, 'tests/analyses');
    const cujFile = resolve(analyses, 'cuj-catalog.json');
    const slosFile = resolve(analyses, 'slos.json');
    const riskFile = resolve(analyses, 'risk-register.json');

    // Todos os arquivos devem existir
    expect(existsSync(cujFile)).toBe(true);
    expect(existsSync(slosFile)).toBe(true);
    expect(existsSync(riskFile)).toBe(true);

    // Carregar todos
    const catalog = JSON.parse(await readFile(cujFile, 'utf-8'));
    const slos = JSON.parse(await readFile(slosFile, 'utf-8'));
    const risks = JSON.parse(await readFile(riskFile, 'utf-8'));

    // Número de CUJs == número de SLOs == número de Risks
    expect(catalog.cujs.length).toBe(slos.slos.length);
    expect(catalog.cujs.length).toBe(risks.risks.length);

    // Todos os CUJ IDs devem estar nos SLOs
    const cujIds = new Set(catalog.cujs.map((c: any) => c.id));
    const sloIds = new Set(slos.slos.map((s: any) => s.cuj_id));
    cujIds.forEach(id => {
      expect(sloIds.has(id)).toBe(true);
    });

    // Todos os Risk IDs devem ser risk-{cuj_id}
    risks.risks.forEach((r: any) => {
      expect(r.id).toBe(`risk-${r.cuj_id}`);
      expect(cujIds.has(r.cuj_id)).toBe(true);
    });

    // Top 5 riscos devem existir nos risks
    const riskIds = new Set(risks.risks.map((r: any) => r.id));
    risks.top_5_critical.forEach((id: string) => {
      expect(riskIds.has(id)).toBe(true);
    });
  }, 15000);
});
