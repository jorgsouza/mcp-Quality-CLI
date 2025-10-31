# 📋 Plano Completo para Atingir 70% de Cobertura

**Data:** 2025-10-31  
**Aplicação:** Quality MCP  
**Cobertura Atual:** 39.17% (lines)  
**Meta:** 70% (lines, functions, statements)  
**Gap:** 832 linhas + 4 funções

---

## 📊 Situação Atual

### Cobertura Global

| Métrica        | Atual              | Meta | Gap                  | Status |
| -------------- | ------------------ | ---- | -------------------- | ------ |
| **Lines**      | 39.17% (1057/2698) | 70%  | -30.83% (832 linhas) | ❌     |
| **Functions**  | 63.33% (38/60)     | 70%  | -6.67% (4 funções)   | ❌     |
| **Branches**   | 74.62% (297/398)   | 70%  | +4.62%               | ✅     |
| **Statements** | 39.17% (1057/2698) | 70%  | -30.83%              | ❌     |

### Arquivos por Status

| Status                  | Quantidade | Arquivos                                                                                               |
| ----------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| 🔴 **Crítico (0-50%)**  | 9          | language, catalog, dashboard, report, run-coverage, run, scaffold-integration, scaffold, scaffold-unit |
| 🟡 **Médio (50-70%)**   | 0          | -                                                                                                      |
| 🟢 **Bom (70-90%)**     | 2          | fs, tests                                                                                              |
| 🎉 **Excelente (90%+)** | 8          | recommend-strategy, express, events, next, pyramid-report, coverage, analyze, plan                     |

---

## 🎯 Estratégia de Execução

### Fase 1: Cobertura Crítica (0% → 50%)

**Objetivo:** Cobrir o básico dos 8 arquivos com 0%  
**Tempo Estimado:** 4-6 horas  
**Prioridade:** 🔴 ALTA

#### Arquivos a Testar

1. **`src/detectors/language.ts`** (0% → 50%)

   - **Testes Necessários:** 8-10 testes
   - **Foco:** detectLanguage(), getTestFileExtension(), getTestTemplate()
   - **Cenários:**
     - ✅ Detectar TypeScript/JavaScript (package.json + vitest)
     - ✅ Detectar Java (pom.xml, build.gradle)
     - ✅ Detectar Go (go.mod)
     - ✅ Detectar Ruby (Gemfile + rspec)
     - ✅ Detectar Python (requirements.txt + pytest)
     - ✅ Detectar C# (\*.csproj)
     - ✅ Detectar PHP (composer.json)
     - ✅ Detectar Rust (Cargo.toml)
     - ✅ Fallback para TypeScript quando não detectado
     - ✅ Templates de teste por linguagem

2. **`src/tools/run-coverage.ts`** (0% → 50%)

   - **Testes Necessários:** 10-12 testes
   - **Foco:** runCoverageAnalysis(), parseCoverageFile(), parsers específicos
   - **Cenários:**
     - ✅ Executar cobertura TypeScript/Vitest
     - ✅ Parsear JSON (Istanbul)
     - ✅ Parsear JaCoCo XML (Java)
     - ✅ Parsear Go coverage.out
     - ✅ Parsear SimpleCov JSON (Ruby)
     - ✅ Parsear coverage.py JSON (Python)
     - ✅ Parsear Cobertura XML (.NET)
     - ✅ Parsear Clover XML (PHP)
     - ✅ Analisar cobertura e identificar gaps
     - ✅ Gerar prioridades de arquivos
     - ✅ Gerar relatório detalhado
     - ❌ Erro quando arquivo de cobertura não existe

3. **`src/tools/report.ts`** (0% → 50%)

   - **Testes Necessários:** 6-8 testes
   - **Foco:** buildReport(), consolidação de relatórios
   - **Cenários:**
     - ✅ Ler JSON do Playwright
     - ✅ Extrair estatísticas (passed, failed, flaky)
     - ✅ Gerar Markdown consolidado
     - ✅ Incluir artefatos (HTML, JUnit, JSON)
     - ✅ Adicionar recomendações
     - ✅ Verificar thresholds
     - ❌ Erro quando arquivo não existe

4. **`src/tools/run.ts`** (0% → 50%)

   - **Testes Necessários:** 6-8 testes
   - **Foco:** runPlaywright(), execução de testes
   - **Cenários:**
     - ✅ Instalar Playwright
     - ✅ Executar testes
     - ✅ Configurar ambiente (BASE_URL, USER, PASS)
     - ✅ Modo headless/headed
     - ✅ Gerar relatórios (HTML, JUnit, JSON)
     - ❌ Erro quando Playwright não instalado
     - ❌ Erro quando testes falham

5. **`src/tools/scaffold.ts`** (0% → 50%)

   - **Testes Necessários:** 8-10 testes
   - **Foco:** scaffoldPlaywright(), criação de estrutura
   - **Cenários:**
     - ✅ Criar diretórios (tests/auth, tests/claim, tests/search)
     - ✅ Gerar playwright.config.ts
     - ✅ Criar fixtures (auth.ts)
     - ✅ Gerar specs básicos (login, claim, search)
     - ✅ Verificar estrutura criada
     - ❌ Erro quando diretório já existe

6. **`src/tools/scaffold-integration.ts`** (0% → 50%)

   - **Testes Necessários:** 6-8 testes
   - **Foco:** scaffoldIntegrationTests(), testes de API
   - **Cenários:**
     - ✅ Detectar endpoints da API
     - ✅ Gerar testes de integração
     - ✅ Criar API client
     - ✅ Adicionar contract testing
     - ✅ Atualizar package.json
     - ❌ Erro quando base_url inválida

7. **`src/tools/catalog.ts`** (0% → 50%)

   - **Testes Necessários:** 6-8 testes
   - **Foco:** catalogScenarios(), governança multi-squad
   - **Cenários:**
     - ✅ Listar cenários de teste
     - ✅ Atribuir squads
     - ✅ Detectar duplicatas
     - ✅ Gerar matriz de responsabilidades
     - ✅ Salvar catálogo em Markdown
     - ❌ Erro quando sem testes

8. **`src/tools/dashboard.ts`** (0% → 50%)
   - **Testes Necessários:** 4-6 testes
   - **Foco:** generateDashboard(), métricas visuais
   - **Cenários:**
     - ✅ Coletar métricas de testes
     - ✅ Gerar dashboard HTML
     - ✅ Incluir gráficos de cobertura
     - ✅ Histórico de execuções

### Fase 2: Melhorar Cobertura Existente (50% → 70%)

**Objetivo:** Melhorar arquivo que já tem 24%  
**Tempo Estimado:** 2-3 horas  
**Prioridade:** 🟡 MÉDIA

9. **`src/tools/scaffold-unit.ts`** (24.4% → 70%)
   - **Testes Necessários:** 8-10 testes adicionais
   - **Foco:** Cobrir branches e edge cases não testados
   - **Cenários:**
     - ✅ Detectar framework (Jest, Mocha além de Vitest)
     - ✅ Gerar testes para múltiplos arquivos
     - ✅ Limitar a 20 arquivos por vez
     - ✅ Atualizar package.json corretamente
     - ✅ Gerar guia de testes unitários
     - ❌ Erro quando arquivo fonte não existe
     - ❌ Erro quando não consegue escrever teste

### Fase 3: Refinar Arquivos Bons (70% → 80%+)

**Objetivo:** Melhorar arquivos que já têm 70%+  
**Tempo Estimado:** 1-2 horas  
**Prioridade:** 🟢 BAIXA

10. **`src/utils/fs.ts`** (74.1% → 85%)

    - **Testes Adicionais:** 2-3 testes
    - **Foco:** Branches não cobertas
    - **Cenários:**
      - ✅ fileExists() com arquivo que não existe
      - ✅ readFile() com encoding diferente
      - ✅ Erro de permissão

11. **`src/detectors/tests.ts`** (74.1% → 85%)
    - **Testes Adicionais:** 3-4 testes
    - **Foco:** Edge cases e branches
    - **Cenários:**
      - ✅ findCoverageReports() com diferentes formatos
      - ✅ isPyramidHealthy() com diferentes cenários
      - ✅ Detectar frameworks menos comuns

---

## 📝 Plano de Testes Detalhado

### 🔴 PRIORIDADE ALTA (Fase 1)

#### 1. `src/detectors/__tests__/language.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import {
  detectLanguage,
  getTestFileExtension,
  getTestTemplate,
} from "../language";

describe("detectLanguage", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `/tmp/language-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("deve detectar TypeScript com Vitest", async () => {
    await fs.writeFile(
      join(testDir, "package.json"),
      JSON.stringify({
        devDependencies: { vitest: "^2.0.0" },
      })
    );

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe("typescript");
    expect(lang.framework).toBe("vitest");
    expect(lang.testCommand).toBe("npm test");
    expect(lang.coverageCommand).toBe("npm run test:coverage");
  });

  it("deve detectar Java com Maven", async () => {
    await fs.writeFile(join(testDir, "pom.xml"), "<project></project>");

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe("java");
    expect(lang.framework).toBe("junit");
    expect(lang.coverageCommand).toContain("jacoco");
  });

  it("deve detectar Go", async () => {
    await fs.writeFile(join(testDir, "go.mod"), "module test");

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe("golang");
    expect(lang.framework).toBe("go-test");
  });

  it("deve detectar Ruby com RSpec", async () => {
    await fs.writeFile(join(testDir, "Gemfile"), "gem 'rspec'");

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe("ruby");
    expect(lang.framework).toBe("rspec");
  });

  it("deve detectar Python", async () => {
    await fs.writeFile(join(testDir, "requirements.txt"), "pytest");

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe("python");
    expect(lang.framework).toBe("pytest");
  });

  it("deve usar fallback para TypeScript", async () => {
    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe("typescript");
    expect(lang.framework).toBe("vitest");
  });
});

describe("getTestFileExtension", () => {
  it("deve retornar extensão correta por linguagem", () => {
    expect(getTestFileExtension("typescript")).toBe(".test.ts");
    expect(getTestFileExtension("java")).toBe("Test.java");
    expect(getTestFileExtension("golang")).toBe("_test.go");
    expect(getTestFileExtension("ruby")).toBe("_spec.rb");
    expect(getTestFileExtension("python")).toBe("_test.py");
  });
});

describe("getTestTemplate", () => {
  it("deve gerar template TypeScript", () => {
    const template = getTestTemplate("typescript", "myFunction", "./myFile");

    expect(template).toContain("import { describe, it, expect }");
    expect(template).toContain("myFunction");
    expect(template).toContain("should work correctly");
  });

  it("deve gerar template Java", () => {
    const template = getTestTemplate("java", "MyFunction", "");

    expect(template).toContain("@Test");
    expect(template).toContain("MyFunctionTest");
    expect(template).toContain("assertTrue");
  });

  it("deve gerar template Go", () => {
    const template = getTestTemplate("golang", "MyFunction", "");

    expect(template).toContain("func TestMyFunction");
    expect(template).toContain("t.Error");
  });
});
```

**Testes:** 10  
**Cobertura Esperada:** 60-70%

---

#### 2. `src/tools/__tests__/run-coverage.test.ts`

```typescript
import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { promises as fs } from "node:fs";
import { join } from "node:path";
import { runCoverageAnalysis } from "../run-coverage";

describe("runCoverageAnalysis", () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `/tmp/coverage-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it("deve executar cobertura e analisar resultados", async () => {
    // Setup: criar package.json e coverage
    await fs.writeFile(
      join(testDir, "package.json"),
      JSON.stringify({
        scripts: { "test:coverage": "echo ok" },
        devDependencies: { vitest: "^2.0.0" },
      })
    );

    await fs.mkdir(join(testDir, "coverage"), { recursive: true });
    await fs.writeFile(
      join(testDir, "coverage/coverage-summary.json"),
      JSON.stringify({
        total: {
          lines: { total: 100, covered: 80, pct: 80 },
          functions: { total: 20, covered: 16, pct: 80 },
          branches: { total: 40, covered: 32, pct: 80 },
          statements: { total: 100, covered: 80, pct: 80 },
        },
      })
    );

    const result = await runCoverageAnalysis({ repo: testDir });

    expect(result.ok).toBe(true);
    expect(result.summary.lines.pct).toBe(80);
    expect(result.analysis.status).toBe("excellent");
    expect(result.analysis.meetsThresholds).toBe(true);
  });

  it("deve identificar gaps quando cobertura baixa", async () => {
    // Setup com cobertura baixa
    await fs.writeFile(
      join(testDir, "package.json"),
      JSON.stringify({
        scripts: { "test:coverage": "echo ok" },
        devDependencies: { vitest: "^2.0.0" },
      })
    );

    await fs.mkdir(join(testDir, "coverage"), { recursive: true });
    await fs.writeFile(
      join(testDir, "coverage/coverage-summary.json"),
      JSON.stringify({
        total: {
          lines: { total: 100, covered: 40, pct: 40 },
          functions: { total: 20, covered: 8, pct: 40 },
          branches: { total: 40, covered: 16, pct: 40 },
          statements: { total: 100, covered: 40, pct: 40 },
        },
      })
    );

    const result = await runCoverageAnalysis({ repo: testDir });

    expect(result.ok).toBe(true);
    expect(result.analysis.status).toBe("critical");
    expect(result.analysis.meetsThresholds).toBe(false);
    expect(result.analysis.gaps.length).toBeGreaterThan(0);
    expect(result.analysis.recommendations.length).toBeGreaterThan(0);
  });

  it("deve priorizar arquivos com menor cobertura", async () => {
    // Setup com múltiplos arquivos
    await fs.writeFile(
      join(testDir, "package.json"),
      JSON.stringify({
        scripts: { "test:coverage": "echo ok" },
        devDependencies: { vitest: "^2.0.0" },
      })
    );

    await fs.mkdir(join(testDir, "coverage"), { recursive: true });
    await fs.writeFile(
      join(testDir, "coverage/coverage-summary.json"),
      JSON.stringify({
        total: {
          lines: { total: 200, covered: 100, pct: 50 },
          functions: { total: 40, covered: 20, pct: 50 },
          branches: { total: 80, covered: 40, pct: 50 },
          statements: { total: 200, covered: 100, pct: 50 },
        },
        "src/file1.ts": {
          lines: { total: 100, covered: 10, pct: 10 },
          functions: { total: 20, covered: 2, pct: 10 },
          branches: { total: 40, covered: 4, pct: 10 },
          statements: { total: 100, covered: 10, pct: 10 },
        },
        "src/file2.ts": {
          lines: { total: 100, covered: 90, pct: 90 },
          functions: { total: 20, covered: 18, pct: 90 },
          branches: { total: 40, covered: 36, pct: 90 },
          statements: { total: 100, covered: 90, pct: 90 },
        },
      })
    );

    const result = await runCoverageAnalysis({ repo: testDir });

    expect(result.files.length).toBe(2);
    expect(result.files[0].path).toContain("file1");
    expect(result.files[0].lines).toBe(10);
    expect(result.analysis.priorities[0].priority).toBe("high");
  });

  it("deve gerar relatório detalhado", async () => {
    // Setup básico
    await fs.writeFile(
      join(testDir, "package.json"),
      JSON.stringify({
        scripts: { "test:coverage": "echo ok" },
        devDependencies: { vitest: "^2.0.0" },
      })
    );

    await fs.mkdir(join(testDir, "coverage"), { recursive: true });
    await fs.writeFile(
      join(testDir, "coverage/coverage-summary.json"),
      JSON.stringify({
        total: {
          lines: { total: 100, covered: 70, pct: 70 },
          functions: { total: 20, covered: 14, pct: 70 },
          branches: { total: 40, covered: 28, pct: 70 },
          statements: { total: 100, covered: 70, pct: 70 },
        },
      })
    );

    const result = await runCoverageAnalysis({ repo: testDir });

    expect(result.reportPath).toBeDefined();

    const reportExists = await fs
      .access(result.reportPath)
      .then(() => true)
      .catch(() => false);
    expect(reportExists).toBe(true);

    const reportContent = await fs.readFile(result.reportPath, "utf-8");
    expect(reportContent).toContain("Relatório de Cobertura");
    expect(reportContent).toContain("70%");
  });
});
```

**Testes:** 4 (expandir para 10-12)  
**Cobertura Esperada:** 50-60%

---

## ⏱️ Cronograma de Execução

### Semana 1: Fase 1 - Arquivos Críticos

| Dia | Arquivo                               | Testes | Tempo | Status |
| --- | ------------------------------------- | ------ | ----- | ------ |
| 1   | language.ts                           | 10     | 3h    | ⬜     |
| 2   | run-coverage.ts                       | 12     | 3h    | ⬜     |
| 3   | report.ts + run.ts                    | 14     | 4h    | ⬜     |
| 4   | scaffold.ts + scaffold-integration.ts | 16     | 4h    | ⬜     |
| 5   | catalog.ts + dashboard.ts             | 10     | 3h    | ⬜     |

**Total Fase 1:** 62 testes, 17 horas

### Semana 2: Fase 2 e 3 - Refinamento

| Dia | Arquivo                      | Testes | Tempo | Status |
| --- | ---------------------------- | ------ | ----- | ------ |
| 1   | scaffold-unit.ts (melhorar)  | 10     | 3h    | ⬜     |
| 2   | fs.ts + tests.ts (refinar)   | 6      | 2h    | ⬜     |
| 3   | Executar cobertura e ajustar | -      | 2h    | ⬜     |
| 4   | Revisão e correções          | -      | 2h    | ⬜     |
| 5   | Documentação final           | -      | 1h    | ⬜     |

**Total Fase 2+3:** 16 testes, 10 horas

---

## 📊 Projeção de Cobertura

### Após Fase 1 (Arquivos Críticos)

| Métrica    | Antes  | Depois | Ganho   |
| ---------- | ------ | ------ | ------- |
| Lines      | 39.17% | ~58%   | +18.83% |
| Functions  | 63.33% | ~72%   | +8.67%  |
| Statements | 39.17% | ~58%   | +18.83% |

### Após Fase 2 (Refinamento)

| Métrica    | Antes | Depois | Ganho |
| ---------- | ----- | ------ | ----- |
| Lines      | ~58%  | ~70%   | +12%  |
| Functions  | ~72%  | ~78%   | +6%   |
| Statements | ~58%  | ~70%   | +12%  |

### Meta Final

| Métrica    | Meta | Projetado | Status |
| ---------- | ---- | --------- | ------ |
| Lines      | 70%  | 70-72%    | ✅     |
| Functions  | 70%  | 78-80%    | ✅     |
| Branches   | 70%  | 75%+      | ✅     |
| Statements | 70%  | 70-72%    | ✅     |

---

## 🎯 Resumo Executivo

### Testes a Criar

- **Fase 1:** 62 testes (arquivos críticos)
- **Fase 2:** 16 testes (refinamento)
- **Total:** 78 testes novos

### Tempo Estimado

- **Fase 1:** 17 horas
- **Fase 2:** 10 horas
- **Total:** 27 horas (~3.5 dias úteis)

### Resultado Esperado

- ✅ Cobertura de 70%+ em todas as métricas
- ✅ 0 arquivos com cobertura crítica (<50%)
- ✅ Todos os thresholds atingidos
- ✅ Suite de testes robusta e confiável

---

## 🚀 Próximas Ações

1. **Imediato:** Começar Fase 1 - criar testes para `language.ts`
2. **Dia 2:** Continuar com `run-coverage.ts`
3. **Dia 3:** Avançar para `report.ts` e `run.ts`
4. **Dia 4:** Completar `scaffold.ts` e `scaffold-integration.ts`
5. **Dia 5:** Finalizar `catalog.ts` e `dashboard.ts`
6. **Semana 2:** Refinamento e ajustes finais

---

**Gerado por:** Quality MCP v0.4.0  
**Data:** 2025-10-31  
**Status:** 📋 **PLANO PRONTO PARA EXECUÇÃO**
