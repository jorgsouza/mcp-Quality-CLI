# 📋 Plano-Mestre: MCP Quality CLI - Roadmap de Melhorias

**Data de Início:** 2025-11-02  
**Objetivo:** Tornar o MCP mais robusto, inteligente e focado em "testar o que importa"

---

## 🎯 Objetivos Gerais

- [ ] Simplificar a CLI (menos comandos, mais inteligência)
- [ ] Engine modular de "capabilities"
- [ ] Matriz de Cenários por Função (Happy, Error, Edge, Side-effects)
- [ ] Gates de Qualidade no CI
- [ ] Scaffolder que gera testes fortes
- [ ] Self-check de ambiente
- [ ] Manifesto + auto-registro de comandos
- [ ] Poliglota incremental (JS/TS agora; Python/Go/Java depois)

---

## 📦 Tarefa 1: Consolidar CLI (manifesto + auto-registro)

**Status:** ✅ Concluída  
**Prioridade:** 🔴 ALTA  
**Estimativa:** 4-6h
**Tempo Real:** 2h

### Subtarefas

- [x] 1.1 Criar `src/commands.manifest.ts`
  - [x] Exportar array `readonly COMMANDS`
  - [x] Campos: `name`, `module`, `description`, `required` (flags)
  - [x] Incluir comandos: `analyze`, `validate`, `report`, `scaffold`, `self-check`
  - [x] Marcar aliases: "analyze --full"

- [x] 1.2 Refatorar `src/cli.ts`
  - [x] Ler `COMMANDS` e registrar programaticamente
  - [x] Validar flags obrigatórias em `preAction`
  - [x] Carregar módulos dinamicamente `import(c.module)`
  - [x] Invocar `default` ou `c.name`

- [x] 1.3 Criar testes
  - [x] `src/__tests__/cli-manifest.test.ts`
  - [x] Paridade manifesto ↔ `--help` ↔ `package.json` scripts
  - [x] Todo comando tem `description` e valida flags `required`
  - [x] 23 testes passando (100%)

- [x] 1.4 Criar módulo self-check
  - [x] Implementado `src/tools/self-check.ts`
  - [x] Verifica Node, permissões, vitest, stryker, git
  - [x] Mensagens prescritivas com soluções
  - [x] Flag --fix para correções automáticas

### DoD (Definition of Done)

- [x] `node dist/cli.js --help` lista somente os 5 comandos consolidados
- [x] Testes de paridade passando (23/23)
- [x] Comandos antigos removidos (cli.old.ts deletado)
- [x] Build limpo sem warnings
- [x] self-check funcional e testado

---

## 🔧 Tarefa 2: Engine Modular (capabilities)

**Status:** ⏳ Pendente  
**Prioridade:** 🔴 ALTA  
**Estimativa:** 6-8h

### Subtarefas

- [ ] 2.1 Criar `src/engine/capabilities.ts`
  - [ ] Interface `LanguageAdapter`
    - [ ] `discoverFunctions()`
    - [ ] `findTestsAndAsserts()`
    - [ ] `discoverCoverage()`
    - [ ] `discoverMutation()`
  - [ ] Interface `Capabilities`
    - [ ] `cap.functions`
    - [ ] `cap.tests`
    - [ ] `cap.cases`
    - [ ] `cap.coverage`
    - [ ] `cap.mutation`
    - [ ] `cap.schemas`
    - [ ] `cap.report`
    - [ ] `cap.mocks`

- [ ] 2.2 Implementar `src/engine/index.ts`
  - [ ] Função `runPipeline({repo, product, language, profile, flags})`
  - [ ] Resolver adapter via `detectLanguage(repo)`
  - [ ] Executar capabilities na ordem correta
  - [ ] Retornar `AggregatedResult`

- [ ] 2.3 Criar adapter TypeScript/JavaScript (MVP)
  - [ ] `src/engine/adapters/typescript.ts`
  - [ ] Implementar todas as capabilities para TS/JS
  - [ ] Integrar com Vitest/Jest

### DoD

- [ ] `quality analyze --repo ... --product ...` executa pipeline básico
- [ ] Resultado agregado gerado (mesmo sem mutação)
- [ ] Testes unitários das capabilities
- [ ] Documentação da engine

---

## 📊 Tarefa 3: Matriz de Cenários por Função

**Status:** ⏳ Pendente  
**Prioridade:** 🔴 ALTA  
**Estimativa:** 8-10h

### Subtarefas

- [ ] 3.1 Implementar `cap.cases`
  - [ ] Para cada função CRITICAL/HIGH identificar via AST:
    - [ ] Caso "happy" (retorno/efeito correto)
    - [ ] Caso "error" (throw/reject com tipo e mensagem)
    - [ ] Caso "edge" (vazio, limites, null/undefined/0/"")
    - [ ] Caso "sideEffects" com spies (quantidade, ordem, calledWith)
  - [ ] Produzir JSON `scenarioMatrix` por função
  - [ ] Formato: `{happy, error, edge, sideEffects, gaps[]}`

- [ ] 3.2 Integrar em `analyze`
  - [ ] Gerar `tests/analyses/TEST-QUALITY-LOGICAL.json`
  - [ ] Campo `scenarioMatrixCritical`
  - [ ] Lista de lacunas (`gaps`)

- [ ] 3.3 Criar testes
  - [ ] Fixture: função CRITICAL com testes insuficientes → espera gaps
  - [ ] Fixture: função completa → todos ✅
  - [ ] Validar matriz para múltiplas funções

### DoD

- [ ] Relatório JSON/MD mostra "Cenários por Função"
- [ ] Gaps listados com ✅/❌ por categoria
- [ ] Testes de integração validam matriz correta

---

## 🌿 Tarefa 4: Cobertura de Branch/Exceções

**Status:** ⏳ Pendente  
**Prioridade:** 🟡 MÉDIA  
**Estimativa:** 4-6h

### Subtarefas

- [ ] 4.1 Implementar `cap.coverage`
  - [ ] Rodar `vitest/jest --coverage`
  - [ ] Coletar branch coverage (por arquivo/função)
  - [ ] Calcular `branchCoverageCritical` (média, min, por função)

- [ ] 4.2 Criar comando `validate`
  - [ ] Gate `--min-branch <n>` (ex.: 80)
  - [ ] Falhar se `branchCoverageCritical < n`
  - [ ] Indicar funções/arquivos que puxam para baixo

- [ ] 4.3 Testes de integração
  - [ ] Projeto dummy com branches não cobertas
  - [ ] Validate falha com mensagem prescritiva

### DoD

- [ ] `quality validate --min-branch 80` funciona
- [ ] Reprova projetos com branches críticas não exercitadas
- [ ] Mensagem clara apontando funções problemáticas

---

## 🧬 Tarefa 5: Mutation Testing

**Status:** ⏳ Pendente  
**Prioridade:** 🟡 MÉDIA  
**Estimativa:** 6-8h

### Subtarefas

- [ ] 5.1 Implementar `cap.mutation` para JS/TS
  - [ ] Usar Stryker
  - [ ] Detectar `stryker.conf.*`
  - [ ] Criar config padrão se não existir
  - [ ] Rodar `npx stryker run` ou API
  - [ ] Consolidar `mutationScoreCritical`

- [ ] 5.2 Integrar em `validate`
  - [ ] Gate `--min-mutation <n>` (ex.: 70)
  - [ ] Relatório de mutantes sobreviventes
  - [ ] Dicas de asserts que matariam cada mutante

- [ ] 5.3 Testes
  - [ ] Fixture com assertions fracas
  - [ ] Mutantes sobrevivem → validate reprova

### DoD

- [ ] `quality validate --min-mutation 70` funciona
- [ ] Falha com relatório de sobreviventes
- [ ] Instruções de correção por mutante

---

## 🏗️ Tarefa 6: Scaffolder de Testes Fortes

**Status:** ⏳ Pendente  
**Prioridade:** 🟢 BAIXA  
**Estimativa:** 4-6h

### Subtarefas

- [ ] 6.1 Criar comando `quality scaffold`
  - [ ] Flags:
    - [ ] `--function <name>`
    - [ ] `--scenario <happy|error|edge|side>`
    - [ ] `--lang ts`
  - [ ] Gerar teste em `tests/<function>.<scenario>.test.ts`

- [ ] 6.2 Templates de testes
  - [ ] Happy: asserts de shape/valores relevantes
  - [ ] Error: assert de tipo + mensagem
  - [ ] Edge: dados limite (vazio, nulos, tamanhos)
  - [ ] Side-effects: spies com calledWith/ordem/quantidade

- [ ] 6.3 Validações
  - [ ] Não sobrescrever existentes
  - [ ] Idempotente (cria variação indexada se existe)

### DoD

- [ ] Scaffold gera testes úteis
- [ ] Sem `toBeDefined()` nos testes gerados
- [ ] Testes validam que arquivos são criados corretamente

---

## 🔍 Tarefa 7: Self-check (ambiente)

**Status:** ⏳ Pendente  
**Prioridade:** 🟢 BAIXA  
**Estimativa:** 2-3h

### Subtarefas

- [ ] 7.1 Criar comando `quality self-check`
  - [ ] Verificar Node version
  - [ ] Permissão de escrita em `tests/analyses`
  - [ ] Presença de vitest/jest
  - [ ] Presença de stryker
  - [ ] Outros pré-requisitos

- [ ] 7.2 Mensagens prescritivas
  - [ ] Para cada falta: "Problema → Como resolver"
  - [ ] Incluir comando de instalação
  - [ ] Exit code != 0 se houver falhas

- [ ] 7.3 Testes
  - [ ] Simular ausência de stryker
  - [ ] Verificar mensagem prescritiva

### DoD

- [ ] `quality self-check` lista checklist verde/vermelha
- [ ] Mostra como corrigir cada problema
- [ ] Testes validam detecção de problemas

---

## 🚫 Tarefa 8: Lints Anti-Assert Fraco

**Status:** ⏳ Pendente  
**Prioridade:** 🟡 MÉDIA  
**Estimativa:** 3-4h

### Subtarefas

- [ ] 8.1 Criar/ajustar regras ESLint
  - [ ] Proibir em arquivos críticos:
    - [ ] `toBeDefined()`
    - [ ] `toBeTruthy()` / `toBeFalsy()`
    - [ ] Snapshots "cegos"
  - [ ] Permitir apenas com asserts semânticos

- [ ] 8.2 Pre-commit hook
  - [ ] Configurar lint-staged
  - [ ] CI step "lint"

### DoD

- [ ] Lint falha com `toBeDefined()` em função crítica
- [ ] Permite quando acompanhado de asserts semânticos
- [ ] Pre-commit configurado

---

## 📜 Tarefa 9: Schemas (contratos) + Golden Tests

**Status:** ⏳ Pendente  
**Prioridade:** 🟡 MÉDIA  
**Estimativa:** 3-4h

### Subtarefas

- [ ] 9.1 Criar schemas JSON
  - [ ] `/schemas/v1/TEST-QUALITY-LOGICAL.schema.json`
  - [ ] Validar com ajv ou Zod

- [ ] 9.2 Implementar `cap.schemas`
  - [ ] Validação em validate gates
  - [ ] Falhar se inválido

- [ ] 9.3 Golden tests
  - [ ] Fixar snapshot do relatório MD
  - [ ] Seções obrigatórias, títulos, tabelas
  - [ ] Teste reprova se remover seção crítica

### DoD

- [ ] Quebra de formato detectada imediatamente
- [ ] Relatórios mantêm seções obrigatórias
- [ ] Schema versionado em `/schemas/v1`

---

## 🎭 Tarefa 10: Detector de Over/Under-Mocking

**Status:** ⏳ Pendente  
**Prioridade:** 🟢 BAIXA  
**Estimativa:** 4-5h

### Subtarefas

- [ ] 10.1 Implementar `cap.mocks`
  - [ ] Heurística over-mocking:
    - [ ] Todos os deps mockados + função não varia → alerta
  - [ ] Heurística under-mocking:
    - [ ] Toca rede/FS real sem necessidade → alerta
  - [ ] Incluir no relatório MD/JSON

### DoD

- [ ] Relatório lista avisos de mocking incoerente
- [ ] Por função, com sugestão de correção

---

## 🌐 Tarefa 11: Poliglota (incremental)

**Status:** ⏳ Pendente  
**Prioridade:** 🟢 BAIXA (Backlog)  
**Estimativa:** 8-12h por linguagem

### Subtarefas

- [ ] 11.1 Adapter TypeScript/JavaScript (MVP)
  - [x] Vitest/Jest/StrykerJS completo ✅

- [ ] 11.2 Adapter Python (stub)
  - [ ] pytest + pytest-cov + mutmut
  - [ ] Fallback textual
  - [ ] Instruções de habilitação

- [ ] 11.3 Adapter Go (stub)
  - [ ] go test + coverprofile
  - [ ] go-mutesting
  - [ ] Fallback textual

- [ ] 11.4 Adapter Java (stub)
  - [ ] JUnit + JaCoCo + PIT
  - [ ] Fallback textual

- [ ] 11.5 Engine degradação graciosa
  - [ ] Avisar o que não rodou
  - [ ] Como habilitar cada linguagem

### DoD

- [ ] TS/JS funcional completo
- [ ] Outros idiomas reportam fallback
- [ ] Instruções claras de habilitação

---

## 📄 Tarefa 12: Relatório Unificado (MD/JSON/HTML)

**Status:** ⏳ Pendente  
**Prioridade:** 🟡 MÉDIA  
**Estimativa:** 4-6h

### Subtarefas

- [ ] 12.1 Atualizar `cap.report`
  - [ ] MD: seções claras
    - [ ] Métricas
    - [ ] Validação Lógica por função
    - [ ] Branch coverage
    - [ ] Mutação
    - [ ] Mocks
    - [ ] Recomendações
    - [ ] Próximos passos
  - [ ] JSON: incluir `metrics`
    - [ ] `qualityScore`
    - [ ] `grade`
    - [ ] `branchCoverageCritical`
    - [ ] `mutationScore`
    - [ ] `scenarioMatrixCritical`
  - [ ] HTML (opcional): sumário + âncoras + filtros

- [ ] 12.2 Golden test para MD
  - [ ] Validar estrutura
  - [ ] Seções obrigatórias

### DoD

- [ ] Relatório aponta lacunas específicas
- [ ] Ações claras (patch recomendado por lacuna)
- [ ] Golden test valida estrutura MD

---

## ⚙️ Tarefa 13: Profiles (DX/CI)

**Status:** ⏳ Pendente  
**Prioridade:** 🟡 MÉDIA  
**Estimativa:** 2-3h

### Subtarefas

- [ ] 13.1 Adicionar perfis
  - [ ] `--profile ci-fast`
    - [ ] Sem mutação
    - [ ] Branch só em críticos
    - [ ] Rápido
  - [ ] `--profile ci-strict`
    - [ ] Mutação + schemas + gates
  - [ ] `--profile local-dev`
    - [ ] Análise lógica + scaffold hints
    - [ ] Sem gates

- [ ] 13.2 Scripts npm
  - [ ] `npm run quality:fast`
  - [ ] `npm run quality:strict`
  - [ ] `npm run quality:dev`

- [ ] 13.3 Documentar tempos
  - [ ] Benchmark de cada perfil
  - [ ] README com comparação

### DoD

- [ ] Scripts funcionam corretamente
- [ ] Tempos documentados
- [ ] README atualizado

---

## 🚦 Tarefa 14: Gates de PR (CI)

**Status:** ⏳ Pendente  
**Prioridade:** 🔴 ALTA  
**Estimativa:** 3-4h

### Subtarefas

- [ ] 14.1 GitHub Actions - Job Fast
  - [ ] `analyze --profile ci-fast`
  - [ ] `validate --min-branch 80 --require-scenarios critical`

- [ ] 14.2 GitHub Actions - Job Strict
  - [ ] Trigger: release/main
  - [ ] `analyze --profile ci-strict`
  - [ ] `validate --min-branch 85 --min-mutation 70`
  - [ ] `report --format md`

- [ ] 14.3 Mensagens prescritivas
  - [ ] Falha com link para seção do relatório
  - [ ] Instruções claras de correção

### DoD

- [ ] PR falha quando o que importa não está coberto
- [ ] Mensagens prescritivas funcionando
- [ ] Links para relatórios

---

## 📚 Apêndices

### Apêndice A: Templates de Teste Forte

```typescript
// Erro (tipo + mensagem)
await expect(fn(badInput)).rejects.toThrowErrorMatchingInlineSnapshot(
  `"Formato inválido: cobertura sem 'totals'"`
);

// Side-effects (spies + ordem + payload)
const write = vi.spyOn(fs.promises, 'writeFile').mockResolvedValueOnce();
const log = vi.spyOn(console, 'log').mockImplementation(() => {});
await generateQualityReport(...);
expect(write).toHaveBeenNthCalledWith(1, expect.stringMatching(/REPORT\.md$/), expect.any(String), 'utf8');
expect(log).toHaveBeenCalledWith(expect.stringMatching(/Quality Score:/));

// Edge case (vazio/limites)
const out = await parseCoverageReport('');
expect(out).toMatchObject({ files: [], totals: { lines: 0, branches: 0 } });
```

### Apêndice B: Esquema JSON (Resumo)

```json
{
  "ok": true,
  "language": "ts",
  "framework": "vitest",
  "product": "quality-cli",
  "metrics": {
    "qualityScore": 0,
    "grade": "B",
    "branchCoverageCritical": 82.3,
    "mutationScore": 73.5,
    "scenarioMatrixCritical": 91.0
  },
  "functions": [
    {
      "name": "parseCoverageReport",
      "filePath": "src/...",
      "criticality": "CRITICAL",
      "scenarios": { "happy": true, "error": true, "edge": false, "sideEffects": true },
      "tests": [...],
      "gaps": ["edge: arquivo vazio não testado"]
    }
  ],
  "warnings": { "mocks": ["over-mocking em generateReport"] },
  "reportPath": "tests/analyses/TEST-QUALITY-LOGICAL-REPORT.md",
  "patches": ["tests/analyses/patches/add-edge-parseCoverage.patch"]
}
```

---

## 📊 Progresso Geral

| Tarefa | Status | Prioridade | Estimativa | Progresso |
|--------|--------|------------|------------|-----------|
| 1. Consolidar CLI | ✅ Concluída | 🔴 ALTA | 4-6h (2h real) | 100% |
| 2. Engine Modular | ⏳ Pendente | 🔴 ALTA | 6-8h | 0% |
| 3. Matriz de Cenários | ⏳ Pendente | 🔴 ALTA | 8-10h | 0% |
| 4. Branch Coverage | ⏳ Pendente | 🟡 MÉDIA | 4-6h | 0% |
| 5. Mutation Testing | ⏳ Pendente | 🟡 MÉDIA | 6-8h | 0% |
| 6. Scaffolder | ⏳ Pendente | 🟢 BAIXA | 4-6h | 0% |
| 7. Self-check | ✅ Concluída | 🟢 BAIXA | 2-3h (1h real) | 100% |
| 8. Lints Anti-Assert | ⏳ Pendente | 🟡 MÉDIA | 3-4h | 0% |
| 9. Schemas + Golden | ⏳ Pendente | 🟡 MÉDIA | 3-4h | 0% |
| 10. Mock Detector | ⏳ Pendente | 🟢 BAIXA | 4-5h | 0% |
| 11. Poliglota | ⏳ Pendente | 🟢 BAIXA | 8-12h/lang | 0% |
| 12. Relatório Unificado | ⏳ Pendente | 🟡 MÉDIA | 4-6h | 0% |
| 13. Profiles | ⏳ Pendente | 🟡 MÉDIA | 2-3h | 0% |
| 14. Gates de PR | ⏳ Pendente | 🔴 ALTA | 3-4h | 0% |

**Total Estimado:** 61-83 horas  
**Total Realizado:** 3 horas  
**Progresso Geral:** 14% (2/14 tarefas)

---

## 🎯 Próximos Passos Imediatos

1. ✅ **DONE** - Criar este arquivo de plano
2. **TODO** - Iniciar Tarefa 1: Consolidar CLI
3. **TODO** - Criar branch `feat/consolidate-cli`
4. **TODO** - Implementar manifesto de comandos
5. **TODO** - Refatorar CLI com auto-registro

---

## 📝 Notas e Decisões

- **Data:** 2025-11-02
- **Decisão:** Começar pela consolidação da CLI (Tarefa 1) por ser base para todas as outras
- **Breaking Changes:** Comandos antigos serão removidos/redirecionados - documentar migração

---

## 🔗 Referências

- [PLANO-MCP-ONE-SHOT.md](./docs/development/PLANO-MCP-ONE-SHOT.md)
- [ARCHITECTURE.md](./docs/architecture/ARCHITECTURE.md)
- [Stryker Documentation](https://stryker-mutator.io/)
- [Vitest Coverage](https://vitest.dev/guide/coverage.html)

---

**Última Atualização:** 2025-11-02  
**Por:** GitHub Copilot Assistant
