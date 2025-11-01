# Plano de Testes Atualizado - MCP Quality CLI

**Data:** 01/11/2025  
**Versão:** 0.2.0  
**Análise:** Executada via próprio Quality MCP

---

## 📊 Status Atual da Cobertura

### Pirâmide de Testes Atual

```
         E2E (0%)          ← CRÍTICO: Nenhum teste E2E
       ──────────
      /          \
     /   INT (6%) \        ← Aceitável mas pode melhorar
    /──────────────\
   /                \
  /   UNIT (94%)     \     ← Excelente cobertura
 /────────────────────\
```

**Distribuição:**
- ✅ **Unit:** 166 testes (94.3%) - 19 arquivos
- ⚠️ **Integration:** 10 testes (5.7%) - 3 arquivos
- ❌ **E2E:** 0 testes (0.0%) - 0 arquivos
- **Total:** 176 test cases em 22 arquivos

**Status Geral:** ✅ SAUDÁVEL (pirâmide correta com boa base)

**Cobertura de Código:** 74.13% (unit tests)

---

## 🎯 Arquivos Sem Testes (Prioridade Alta)

### 1. `src/server.ts` ⚠️ CRÍTICO
**Motivo:** É o ponto de entrada do MCP Server
**Risco:** Alto - qualquer bug afeta todas as tools
**Ação:** Criar testes de integração simulando chamadas MCP

**Testes Recomendados:**
```typescript
// src/server/__tests__/server.integration.test.ts
- Deve registrar todas as tools corretamente
- Deve validar schemas Zod para cada tool
- Deve retornar erro para tool desconhecida
- Deve lidar com argumentos inválidos
- Deve processar request completo de analyze
- Deve processar request completo de diff_coverage
```

### 2. `src/cli.ts` ⚠️ ALTO
**Motivo:** CLI é interface principal para usuários
**Risco:** Médio-Alto - bugs afetam UX
**Ação:** Testes E2E do CLI completo

**Testes Recomendados:**
```typescript
// src/cli/__tests__/cli.e2e.test.ts
- Deve executar `analyze` com argumentos corretos
- Deve executar `coverage` e gerar relatórios
- Deve executar `plan` e criar arquivo
- Deve falhar graciosamente com argumentos inválidos
- Deve mostrar mensagens de erro amigáveis
- Deve executar pipeline completo via `full`
```

### 3. `src/utils/config.ts` ⚠️ MÉDIO
**Motivo:** Sistema de configuração centralizada (Fase 3)
**Risco:** Médio - usado por todas as tools
**Ação:** Testes unitários completos

**Testes Recomendados:**
```typescript
// src/utils/__tests__/config.test.ts
- Deve carregar mcp-settings.json do produto
- Deve fazer fallback para mcp-settings.json raiz
- Deve mesclar settings com precedência correta
- Deve validar schema com Zod
- Deve lidar com arquivo inexistente
- Deve criar template de settings
```

### 4. `src/tools/pyramid-report.ts` ⚠️ BAIXO
**Motivo:** Funcionalidade secundária
**Risco:** Baixo - não crítica
**Ação:** Testes unitários básicos

**Testes Recomendados:**
```typescript
// src/tools/__tests__/pyramid-report.test.ts
- Deve gerar relatório em markdown
- Deve gerar relatório em HTML
- Deve gerar relatório em JSON
- Deve calcular proporções corretamente
```

### 5. `src/tools/plan.ts` ⚠️ MÉDIO
**Motivo:** Geração de planos de teste
**Risco:** Médio - usado frequentemente
**Ação:** Testes unitários e integração

**Testes Recomendados:**
```typescript
// src/tools/__tests__/plan.test.ts
- Deve gerar plano com configuração do mcp-settings.json
- Deve incluir rotas críticas detectadas
- Deve gerar exemplos quando solicitado
- Deve ordenar cenários por prioridade
- Deve incluir mapa de riscos da análise
```

---

## 🔗 Melhorias na Camada de Integração

### Cenários Faltando (Prioridade Alta)

1. **Testes de Pipeline Completo**
```typescript
// tests/integration/full-pipeline.test.ts
describe('Pipeline Completo', () => {
  it('deve executar analyze → plan → scaffold → run → report', async () => {
    // Simular execução completa do quality CLI
  });
  
  it('deve falhar early se analyze detectar problemas', async () => {
    // Validar comportamento de falha
  });
});
```

2. **Testes de Configuração Centralizada**
```typescript
// tests/integration/config-integration.test.ts
describe('Configuração Centralizada', () => {
  it('deve usar mcp-settings.json em todas as tools', async () => {
    // Validar que analyze, coverage, plan, etc usam config
  });
  
  it('deve permitir override via parâmetros', async () => {
    // Validar precedência de parâmetros
  });
});
```

3. **Testes de Diff-Coverage**
```typescript
// tests/integration/diff-coverage-flow.test.ts
describe('Diff Coverage Flow', () => {
  it('deve detectar mudanças via git diff', async () => {
    // Criar commit fake e validar detecção
  });
  
  it('deve calcular cobertura apenas do diff', async () => {
    // Validar cálculo correto
  });
  
  it('deve falhar em CI quando < target', async () => {
    // Validar comportamento de gate
  });
});
```

---

## 🎭 Testes E2E Faltando (CRÍTICO)

### Por que E2E é crítico para MCP Quality CLI?

O MCP Quality CLI é uma **ferramenta de linha de comando** que orquestra múltiplas tools. E2E tests validam:
- ✅ Integração completa entre tools
- ✅ CLI funciona de ponta a ponta
- ✅ Arquivos são gerados corretamente
- ✅ Relatórios têm formato esperado
- ✅ Gates de qualidade funcionam

### Cenários E2E Prioritários

#### 1. Fluxo de Inicialização de Produto
```typescript
// tests/e2e/init-product-flow.spec.ts
test('deve inicializar produto completo', async () => {
  // 1. Executar init-product
  await exec('quality init-product --repo=/tmp/test --product=TestApp --base-url=https://test.com');
  
  // 2. Validar estrutura criada
  expect(fs.existsSync('/tmp/test/qa/TestApp')).toBe(true);
  expect(fs.existsSync('/tmp/test/qa/TestApp/mcp-settings.json')).toBe(true);
  expect(fs.existsSync('/tmp/test/qa/TestApp/GETTING_STARTED.md')).toBe(true);
  
  // 3. Validar conteúdo do mcp-settings.json
  const config = JSON.parse(fs.readFileSync('/tmp/test/qa/TestApp/mcp-settings.json'));
  expect(config.product).toBe('TestApp');
  expect(config.base_url).toBe('https://test.com');
});
```

#### 2. Fluxo de Análise e Cobertura
```typescript
// tests/e2e/analyze-coverage-flow.spec.ts
test('deve analisar e gerar relatório de cobertura', async () => {
  // 1. Executar analyze
  await exec('quality analyze --repo=. --product=QualityMCP');
  
  // 2. Validar arquivo gerado
  expect(fs.existsSync('tests/analyses/analyze.json')).toBe(true);
  
  // 3. Executar coverage
  await exec('quality coverage --repo=. --product=QualityMCP');
  
  // 4. Validar relatórios
  expect(fs.existsSync('tests/analyses/coverage-analysis.json')).toBe(true);
  expect(fs.existsSync('tests/analyses/COVERAGE-REPORT.md')).toBe(true);
  
  // 5. Validar conteúdo
  const coverage = JSON.parse(fs.readFileSync('tests/analyses/coverage-analysis.json'));
  expect(coverage.pyramid.unit.test_cases).toBeGreaterThan(0);
});
```

#### 3. Fluxo de Diff-Coverage (Gate de CI)
```typescript
// tests/e2e/diff-coverage-gate.spec.ts
test('deve bloquear PR com diff coverage baixa', async () => {
  // 1. Criar mudanças sem testes
  fs.writeFileSync('/tmp/test/src/new-file.ts', 'export function add(a, b) { return a + b; }');
  
  // 2. Commit
  await exec('git add . && git commit -m "feat: add new file"');
  
  // 3. Executar diff-coverage
  const result = await exec('quality diff-coverage --repo=/tmp/test --target-min=80');
  
  // 4. Deve falhar
  expect(result.exitCode).toBe(1);
  expect(result.stdout).toContain('Diff Coverage');
  expect(result.stdout).toContain('REPROVADO');
});
```

#### 4. Fluxo de Scaffold Completo
```typescript
// tests/e2e/scaffold-complete-flow.spec.ts
test('deve gerar estrutura completa de testes', async () => {
  // 1. Scaffold unit
  await exec('quality scaffold-unit --repo=/tmp/test --files=src/utils.ts');
  expect(fs.existsSync('/tmp/test/src/__tests__/utils.test.ts')).toBe(true);
  
  // 2. Scaffold integration
  await exec('quality scaffold-integration --repo=/tmp/test --product=TestApp');
  expect(fs.existsSync('/tmp/test/tests/integration')).toBe(true);
  
  // 3. Validar conteúdo gerado
  const testContent = fs.readFileSync('/tmp/test/src/__tests__/utils.test.ts', 'utf-8');
  expect(testContent).toContain('describe');
  expect(testContent).toContain('it(');
});
```

---

## 📈 Plano de Ação Priorizado

### 🚨 Prioridade 1 - Semana 1

1. **Criar testes para `src/utils/config.ts`**
   - [ ] 8-10 testes unitários cobrindo todos os cenários
   - [ ] Foco em loadMCPSettings, mergeSettings, validação
   - **Meta:** 100% de cobertura

2. **Criar testes E2E básicos**
   - [ ] init-product flow (1 teste)
   - [ ] analyze → coverage flow (1 teste)
   - [ ] diff-coverage gate (1 teste)
   - **Meta:** 3 testes E2E funcionais

3. **Criar testes de integração para `src/server.ts`**
   - [ ] 6-8 testes simulando chamadas MCP
   - [ ] Validar schemas Zod
   - [ ] Testar handlers de todas as tools
   - **Meta:** 80% de cobertura do server

### ⚠️ Prioridade 2 - Semana 2

4. **Criar testes E2E do CLI (`src/cli.ts`)**
   - [ ] Testar cada comando principal
   - [ ] Validar mensagens de erro
   - [ ] Testar pipeline completo
   - **Meta:** 10 testes E2E cobrindo todos os comandos

5. **Melhorar testes de integração**
   - [ ] Pipeline completo (analyze → plan → scaffold → run → report)
   - [ ] Config centralizada em todas as tools
   - [ ] Diff-coverage flow completo
   - **Meta:** +5 testes de integração

6. **Criar testes para `src/tools/plan.ts`**
   - [ ] Testes unitários de geração de plano
   - [ ] Validar uso de config
   - [ ] Validar ordenação por risco
   - **Meta:** 6-8 testes unitários

### 📝 Prioridade 3 - Semana 3-4

7. **Criar testes para `src/tools/pyramid-report.ts`**
   - [ ] Gerar relatórios em todos os formatos
   - [ ] Validar cálculos
   - **Meta:** 4-6 testes unitários

8. **Aumentar cobertura de integração**
   - [ ] Adicionar testes de contrato entre tools
   - [ ] Validar comportamento de erro
   - [ ] Testar edge cases
   - **Meta:** Atingir 15-20 testes de integração

9. **Configurar CI para executar E2E**
   - [ ] Criar workflow GitHub Actions
   - [ ] Executar E2E em PRs
   - [ ] Bloquear merge se E2E falhar
   - **Meta:** CI configurado e funcional

---

## 🎯 Metas de Cobertura

### Curto Prazo (1 mês)

| Camada | Atual | Meta | Ações |
|--------|-------|------|-------|
| **Unit** | 94.3% | 95%+ | +10 testes (config, plan, pyramid) |
| **Integration** | 5.7% | 10% | +10 testes (server, pipeline, config) |
| **E2E** | 0% | 5% | +10 testes (CLI, flows completos) |
| **Total** | 176 | 206 | +30 testes |

### Médio Prazo (3 meses)

| Camada | Meta |
|--------|------|
| **Unit** | 95%+ |
| **Integration** | 15% |
| **E2E** | 10% |
| **Total** | 230+ testes |

**Proporção Ideal Final:** 70% Unit : 20% Integration : 10% E2E

---

## 🛠️ Comandos para Executar

### Gerar testes para arquivos sem cobertura
```bash
# Config
npm run test:create -- src/utils/config.ts

# Plan
npm run test:create -- src/tools/plan.ts

# Pyramid Report
npm run test:create -- src/tools/pyramid-report.ts
```

### Executar análise de cobertura
```bash
# Análise completa
npm run test:coverage

# Ver relatório HTML
open coverage/index.html

# Diff coverage (apenas mudanças)
node dist/cli.js diff-coverage --repo=. --product=QualityMCP
```

### Validar qualidade
```bash
# Executar todos os testes
npm test

# Executar apenas E2E (quando criados)
npm run test:e2e

# Executar apenas Integration
npm run test:integration
```

---

## 📚 Recursos e Templates

### Template de Teste Unitário
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { functionName } from '../file.js';

describe('functionName', () => {
  beforeEach(() => {
    // Setup
  });

  it('deve fazer X quando Y', () => {
    const result = functionName(input);
    expect(result).toBe(expected);
  });

  it('deve lançar erro quando input inválido', () => {
    expect(() => functionName(null)).toThrow();
  });
});
```

### Template de Teste de Integração
```typescript
import { describe, it, expect } from 'vitest';
import { tool1 } from '../tools/tool1.js';
import { tool2 } from '../tools/tool2.js';

describe('Integration: Tool1 → Tool2', () => {
  it('deve passar dados corretamente entre tools', async () => {
    const result1 = await tool1({ repo: '/tmp' });
    const result2 = await tool2({ input: result1.output });
    
    expect(result2.ok).toBe(true);
  });
});
```

### Template de Teste E2E
```typescript
import { test, expect } from '@playwright/test';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

test('deve executar comando CLI completo', async () => {
  const { stdout, stderr } = await execAsync('quality analyze --repo=/tmp/test --product=Test');
  
  expect(stdout).toContain('Análise completa');
  expect(stderr).toBe('');
});
```

---

## ✅ Checklist de Qualidade

### Antes de Criar PR
- [ ] Todos os testes passando (npm test)
- [ ] Cobertura mantida ou aumentada (npm run test:coverage)
- [ ] Diff coverage ≥ 60% (npm run diff-coverage)
- [ ] Nenhum teste flaky detectado
- [ ] Documentação atualizada (README, CHANGELOG)

### Antes de Release
- [ ] Todos os testes E2E passando
- [ ] Cobertura total ≥ 75%
- [ ] Pipeline CI verde
- [ ] CHANGELOG atualizado
- [ ] Versão atualizada (package.json)

---

**Gerado por:** Quality MCP v0.2.0 (auto-análise)  
**Timestamp:** ${new Date().toISOString()}  
**Próxima revisão:** Após completar Prioridade 1
