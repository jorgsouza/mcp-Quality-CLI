# 📊 Relatório de Cobertura de Código

**Data:** 31/10/2025  
**Status:** ⚠️ **NEEDS_IMPROVEMENT**  
**Atende Thresholds:** ❌ NÃO

---

## 📈 Cobertura Geral

| Métrica | Cobertura | Coberto | Total | Threshold | Status |
|---------|-----------|---------|-------|-----------|--------|
| **Lines** | 46.42% | 1057 | 2277 | 70% | ❌ |
| **Functions** | 64.40% | 38 | 59 | 70% | ❌ |
| **Branches** | 74.81% | 297 | 397 | 70% | ✅ |
| **Statements** | 46.42% | 1057 | 2277 | 70% | ❌ |

**Média Geral:** 58.01%

---

## ⚠️ Gaps Detectados

- ❌ Cobertura de linhas (46.4%) abaixo do threshold (70%)
- ❌ Cobertura de funções (64.4%) abaixo do threshold (70%)
- ❌ Cobertura de statements (46.4%) abaixo do threshold (70%)

---

## 💡 Recomendações

1. Adicionar testes para cobrir mais 537 linhas
2. Testar mais 4 funções
3. Priorize adicionar testes para arquivos críticos (detectores, tools)
4. Foque em testar happy path + edge cases + error handling

---

## 🎯 Arquivos Prioritários (Menor Cobertura)


| # | Arquivo | Cobertura | Prioridade | Razão |
|---|---------|-----------|------------|-------|
| 1 | `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/catalog.ts` | 0.0% | 🔴 HIGH | Cobertura crítica (<50%) |
| 2 | `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/dashboard.ts` | 0.0% | 🔴 HIGH | Cobertura crítica (<50%) |
| 3 | `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/report.ts` | 0.0% | 🔴 HIGH | Cobertura crítica (<50%) |
| 4 | `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/run-coverage.ts` | 0.0% | 🔴 HIGH | Cobertura crítica (<50%) |
| 5 | `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/run.ts` | 0.0% | 🔴 HIGH | Cobertura crítica (<50%) |
| 6 | `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/scaffold-integration.ts` | 0.0% | 🔴 HIGH | Cobertura crítica (<50%) |
| 7 | `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/scaffold.ts` | 0.0% | 🔴 HIGH | Cobertura crítica (<50%) |
| 8 | `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/scaffold-unit.ts` | 24.4% | 🔴 HIGH | Cobertura crítica (<50%) |
| 9 | `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/utils/fs.ts` | 74.1% | 🟢 LOW | Cobertura boa, pode melhorar |
| 10 | `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/detectors/tests.ts` | 74.1% | 🟢 LOW | Cobertura boa, pode melhorar |


---

## 📊 Cobertura por Arquivo (Todos)

<details>
<summary>Ver todos os arquivos (18)</summary>

| Arquivo | Lines | Functions | Branches | Statements |
|---------|-------|-----------|----------|------------|
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/catalog.ts` | 0.0% | 0.0% | 0.0% | 0.0% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/dashboard.ts` | 0.0% | 0.0% | 0.0% | 0.0% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/report.ts` | 0.0% | 0.0% | 0.0% | 0.0% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/run-coverage.ts` | 0.0% | 0.0% | 0.0% | 0.0% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/run.ts` | 0.0% | 0.0% | 0.0% | 0.0% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/scaffold-integration.ts` | 0.0% | 0.0% | 0.0% | 0.0% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/scaffold.ts` | 0.0% | 0.0% | 0.0% | 0.0% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/scaffold-unit.ts` | 24.4% | 25.0% | 36.4% | 24.4% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/utils/fs.ts` | 74.1% | 80.0% | 100.0% | 74.1% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/detectors/tests.ts` | 74.1% | 85.7% | 84.7% | 74.1% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/recommend-strategy.ts` | 89.6% | 100.0% | 80.0% | 89.6% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/detectors/express.ts` | 90.7% | 100.0% | 66.7% | 90.7% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/detectors/events.ts` | 93.8% | 100.0% | 77.8% | 93.8% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/detectors/next.ts` | 94.3% | 100.0% | 83.3% | 94.3% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/pyramid-report.ts` | 95.3% | 100.0% | 20.0% | 95.3% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/coverage.ts` | 96.6% | 100.0% | 87.7% | 96.6% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/analyze.ts` | 100.0% | 100.0% | 87.0% | 100.0% |
| `/home/jorgesouza/Documents/dev/mcp-Quality-CLI/src/tools/plan.ts` | 100.0% | 100.0% | 81.8% | 100.0% |

</details>

---

## 🎯 Próximos Passos


### ⚠️ Ação Necessária

Sua cobertura está abaixo dos thresholds. Priorize:

1. 🔴 **ALTA:** Adicionar testes para arquivos com <50% de cobertura
2. 🟡 **MÉDIA:** Melhorar cobertura de arquivos entre 50-70%
3. 🟢 **BAIXA:** Otimizar arquivos entre 70-80%

### Comandos Úteis

```bash
# Ver relatório HTML detalhado
npm run test:coverage
open coverage/index.html

# Executar testes específicos
npm test -- src/path/to/file.test.ts

# Executar testes em watch mode
npm test -- --watch
```


---

## 📚 Referências

- **Threshold Ideal:** 70-80% (mínimo aceitável)
- **Threshold Excelente:** 80-90%+
- **Pirâmide de Testes:** 70% unit, 20% integration, 10% E2E

---

**Gerado por:** Quality MCP v0.2.0  
**Data:** 31/10/2025  
**Status:** ⚠️ **NEEDS_IMPROVEMENT**
