# 🗺️ Roadmap V1 Completo - MCP Quality CLI

**Data**: 2025-11-04  
**Status**: 🚧 EM PROGRESSO (50% completo, arquitetura revisada)

---

## 📊 Progresso Atual

### ✅ Fases Implementadas (6/12 - 50%)

| Fase                      | Status  | Descrição                                | LOC  | Testes |
| ------------------------- | ------- | ---------------------------------------- | ---- | ------ |
| **1. CUJ/SLO/Risk**       | ✅ 100% | catalog-cujs, define-slos, risk-register | ~800 | 5      |
| **2. Portfolio Planning** | ✅ 100% | portfolio-plan integrado                 | ~500 | 0      |
| **3. CDC (Pact)**         | ⚠️ 80%  | scaffold + run (não integrado)           | ~600 | 2      |
| **4. Property Tests**     | ✅ 100% | scaffold-property-tests (TS/Py/Go)       | ~550 | 0      |
| **5. Approval Tests**     | ✅ 100% | scaffold-approval-tests (Jest/pytest)    | ~500 | 0      |
| **7. Suite Health**       | ✅ 100% | suite-health + flakiness detection       | ~430 | 4      |

**Total**: ~3,380 linhas de código | 11 testes unitários

---

## ⚠️ Lacunas Críticas Identificadas

### 🔴 Prioridade ALTA (Blockers)

#### 1. Engine Multi-Linguagem Incompleta

**Problema**: `quality analyze/auto` só funciona completamente para TS/JS.

**Situação Atual**:

- ✅ `src/adapters/` tem Python, Go, Java, Ruby (scaffolding apenas)
- ❌ `src/engine/adapters/` só tem TypeScript
- ❌ Engine não usa adapters de forma consistente

**Solução (FASE A - 5-7 dias)**:

```typescript
// Criar contrato unificado
interface LanguageAdapter {
  language: string;
  detectFramework(repo: string): Promise<Framework>;
  discoverTests(repo: string): Promise<TestFile[]>;
  runTests(repo: string, options: RunOptions): Promise<TestResult>;
  parseCoverage(coverageFile: string): Promise<Coverage>;
  runMutation(repo: string, targets: string[]): Promise<MutationResult>;
  scaffoldTest(target: TestTarget): Promise<string>;
}
```

**Tarefas**:

- [ ] A.1: Criar `src/adapters/base/LanguageAdapter.ts` (interface)
- [ ] A.2: Migrar adapter TS do engine para `src/adapters/typescript.ts`
- [ ] A.3: Implementar `PythonAdapter` completo (pytest + coverage.py + mutmut)
- [ ] A.4: Implementar `GoAdapter` completo (go test + gocov + go-mutesting)
- [ ] A.5: Refatorar engine para consumir adapters polimorficamente

---

#### 2. Coverage & Mutation Fora de TS/JS

**Problema**: Mutation score e coverage detalhada só funcionam para TS/JS.

**Situação Atual**:

- ✅ `run-coverage.ts` existe mas só executa para Vitest/Jest
- ❌ Não há runners para Python (pytest), Go (go test), Java (JUnit)
- ❌ Parsers de cobertura não cobrem Cobertura (Py), JaCoCo (Java), gocov (Go)

**Solução (FASE C - 4-5 dias)**:

**Runners**:

- [ ] C.1: `src/runners/python-runner.ts` → executa pytest + coverage.py
- [ ] C.2: `src/runners/go-runner.ts` → executa go test -cover
- [ ] C.3: `src/runners/java-runner.ts` → executa JUnit + JaCoCo

**Parsers**:

- [ ] C.4: `src/parsers/cobertura-parser.ts` (Python/Java XML)
- [ ] C.5: `src/parsers/jacoco-parser.ts` (Java XML)
- [ ] C.6: `src/parsers/gocov-parser.ts` (Go JSON)
- [ ] C.7: `src/parsers/lcov-parser.ts` (TS/JS - já existe parcial)

**Mutation**:

- [ ] C.8: Integrar mutmut (Python) em `run-mutation-tests.ts`
- [ ] C.9: Integrar go-mutesting (Go) em `run-mutation-tests.ts`
- [ ] C.10: Integrar PIT (Java) em `run-mutation-tests.ts`

---

#### 3. Dois Sistemas de Adapters

**Problema**: Duplicação de lógica, manutenção difícil.

**Situação Atual**:

- `src/engine/adapters/` → usado pelo engine (só TS)
- `src/adapters/` → usado por scaffolders (multi-lang)

**Solução (Parte da FASE A)**:

- [ ] A.6: Mover tudo para `src/adapters/` com contrato único
- [ ] A.7: Deletar `src/engine/adapters/`
- [ ] A.8: Engine importa de `src/adapters/`

---

### 🟡 Prioridade MÉDIA (Importante)

#### 4. CDC/Pact Não Integrado

**Problema**: Scaffolding existe mas não é executado no pipeline.

**Solução (FASE B - 2-3 dias)**:

- [x] `run-contracts-verify.ts` já existe
- [ ] B.1: Integrar no `auto.ts` (Phase 1.6)
- [ ] B.2: Parser de relatórios Pact (JSON/HTML)
- [ ] B.3: Consolidar CDC em `CODE-ANALYSIS.md`
- [ ] B.4: Gate: `contract_verification_rate >= 95%`

---

#### 5. Bootstrap de Dependências

**Problema**: Primeira execução falha se ferramentas não estão instaladas.

**Solução (FASE D - 2 dias)**:

- [ ] D.1: Expandir `self-check.ts` para detectar faltas
- [ ] D.2: Imprimir comandos exatos: `npm i -D vitest @vitest/coverage-v8`
- [ ] D.3: Modo `--bootstrap-deps` para instalação automática
- [ ] D.4: Criar `docs/SETUP-BY-LANGUAGE.md`:
  - TypeScript: vitest + coverage-v8 + stryker
  - Python: pytest + pytest-cov + mutmut
  - Go: go test + gotestsum + go-mutesting
  - Java: JUnit 5 + JaCoCo + PIT

---

#### 6. Diff Coverage

**Problema**: Schema prevê mas não implementado.

**Solução (FASE E - 3 dias)**:

- [ ] E.1: Criar `run-diff-coverage.ts`
- [ ] E.2: Integrar com `git diff main...HEAD`
- [ ] E.3: Parser: coverage filtrado por arquivos do diff
- [ ] E.4: Gate: `diff_coverage >= 60%` em `validate.ts`
- [ ] E.5: Gerar `DIFF-COVERAGE.md`

---

#### 7. Documentação e Testes

**Problema**: Suporte por linguagem não documentado.

**Solução (FASE G - 2-3 dias)**:

- [ ] G.1: Tabela "Linguagem × Suporte" no README.md
- [ ] G.2: Testes E2E por linguagem (TS, Python, Go)
- [ ] G.3: CI matrix com Python/Go/TS
- [ ] G.4: Guias de uso por stack

---

### 🟢 Prioridade BAIXA (Enhancement)

#### 8. Risco Dinâmico

**Problema**: Risco baseado em heurística estática.

**Solução (FASE F - 3-4 dias)**:

- [ ] F.1: Coletar git churn por arquivo
- [ ] F.2: Calcular complexidade ciclomática
- [ ] F.3: Integrar histórico de flakiness
- [ ] F.4: Score composto: `impact × probability × volatility`

---

## 📅 Cronograma Revisado (3-4 Semanas)

| Semana       | Fases      | Esforço | Prioridade | Objetivo                     |
| ------------ | ---------- | ------- | ---------- | ---------------------------- |
| **Semana 1** | A + C      | 9-12d   | 🔴 ALTA    | Suporte multi-linguagem real |
| **Semana 2** | B + D      | 4-5d    | 🟡 MÉDIA   | CDC + Bootstrap + Testes     |
| **Semana 3** | E + G      | 5-6d    | 🟡 MÉDIA   | Diff Coverage + Docs         |
| **Semana 4** | F + Buffer | 3-5d    | 🟢 BAIXA   | Risco dinâmico + ajustes     |

**Total Estimado**: 21-28 dias (3-4 semanas intensivas)

---

## 🎯 Critérios de Sucesso V1

### Must Have (Mínimo Viável)

- [x] 6/12 fases originais implementadas
- [ ] **Suporte real multi-linguagem**: TS + Python + Go
  - [ ] Analyze + Coverage + Mutation funcionando nas 3 linguagens
  - [ ] Testes E2E validando cada stack
- [ ] **CDC integrado ao pipeline**
  - [ ] Execução automática no `auto.ts`
  - [ ] Relatórios consolidados
- [ ] **Bootstrap de dependências**
  - [ ] Self-check detecta faltas
  - [ ] `--bootstrap-deps` instala automaticamente
- [ ] **700+ testes passando**
  - Atual: 666 testes
  - Meta: +34 novos (adapters, runners, parsers)

### Should Have (Desejável)

- [ ] Diff Coverage validado em PRs
- [ ] Documentação completa por linguagem
- [ ] CI matrix testando Python/Go/TS
- [ ] Mutation Testing funcionando (TS + Py + Go)

### Could Have (Futuro)

- [ ] Risco dinâmico (git churn + complexidade)
- [ ] Dashboard interativo
- [ ] Pact Broker integration
- [ ] Prod metrics (Sentry/Datadog)

---

## 📊 Métricas de Progresso

| Categoria                 | Atual   | Meta V1         | Progresso  |
| ------------------------- | ------- | --------------- | ---------- |
| **Fases Completas**       | 6/12    | 12/12 + 7 novas | 50% → 100% |
| **Linguagens Suportadas** | TS/JS   | TS + Py + Go    | 33% → 100% |
| **Coverage Multi-Lang**   | TS      | TS + Py + Go    | 33% → 100% |
| **Mutation Multi-Lang**   | 0%      | TS + Py + Go    | 0% → 100%  |
| **CDC Integrado**         | 50%     | 100%            | 50% → 100% |
| **Testes Unitários**      | 666     | 700+            | 95% → 100% |
| **Linhas de Código**      | ~15,800 | ~20,000         | 79% → 100% |

---

## 🚀 Próximas Ações Imediatas

### Esta Semana (Prioridade 1)

1. **FASE A.1-A.2**: Criar `LanguageAdapter` unificado e migrar adapter TS
2. **FASE A.3**: Implementar `PythonAdapter` completo
3. **FASE A.4**: Implementar `GoAdapter` completo
4. **FASE C.1-C.2**: Criar runners Python e Go

### Próxima Semana (Prioridade 2)

5. **FASE C.3-C.7**: Criar parsers de cobertura
6. **FASE B.1-B.4**: Integrar CDC ao pipeline
7. **FASE D.1-D.4**: Bootstrap de dependências

### Semana 3 (Prioridade 3)

8. **FASE E.1-E.5**: Diff Coverage completo
9. **FASE G.1-G.4**: Documentação e CI matrix

---

## 🎓 Lições Aprendidas

### O Que Funcionou Bem

1. ✅ **Iteração Incremental**: Implementar fase por fase (não tudo de uma vez)
2. ✅ **Testes Garantem Qualidade**: 666 testes evitaram regressões
3. ✅ **Documentação Ajuda Foco**: STATUS-QUALITY-GATES.md mantém progresso claro
4. ✅ **TODO List Organiza**: Tarefas específicas evitam perda de foco

### O Que Precisa Melhorar

1. ⚠️ **Arquitetura Multi-Linguagem**: Planejamento inicial foi otimista
2. ⚠️ **Testes por Linguagem**: Precisa validar Python/Go com projetos reais
3. ⚠️ **Integração CDC**: Implementação parcial não traz valor
4. ⚠️ **Documentação Técnica**: Falta guias de uso por stack

---

## 📚 Referências Técnicas

### Adapters por Linguagem

- **TypeScript**: Vitest + Coverage-v8 + Stryker
- **Python**: pytest + coverage.py + mutmut + hypothesis
- **Go**: go test + gotestsum + gocov + go-mutesting
- **Java**: JUnit 5 + JaCoCo + PIT + QuickTheories

### Parsers de Cobertura

- **Cobertura**: Python/Java (XML)
- **JaCoCo**: Java (XML/CSV)
- **LCOV**: TS/JS (info format)
- **Gocov**: Go (JSON)

### Mutation Testing

- **Stryker**: TS/JS (primeiro-classe)
- **mutmut**: Python (simples, eficaz)
- **go-mutesting**: Go (experimental)
- **PIT**: Java (maduro, completo)

---

## 💡 Observações Finais

Este roadmap reflete uma **auditoria técnica completa** do código e identifica **7 lacunas críticas** que bloqueiam a visão de "plataforma de qualidade multi-linguagem".

**Foco principal**: Tornar o MCP Quality CLI **verdadeiramente poliglota**, não apenas com scaffolding, mas com **análise, cobertura e mutation end-to-end** para TS, Python e Go.

**Meta realista**: Completar Fases A e C (suporte multi-linguagem) nas próximas **2 semanas**, tornando o produto realmente utilizável além do ecossistema TS/JS.

---

**Última Atualização**: 2025-11-04 12:05 BRT  
**Próxima Revisão**: 2025-11-11 (após Semana 1)  
**Owner**: Quality Team  
**Status**: 🚧 IN PROGRESS
