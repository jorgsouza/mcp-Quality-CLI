# 🔍 Status da Implementação: explain-tests

## ✅ O que foi implementado (MVP v1.0)

### 1️⃣ Comando CLI & MCP
- ✅ `commands.manifest.ts`: Comando `explain-tests` registrado
- ✅ `mcp-tools.manifest.ts`: Tool `explain_tests` registrado no MCP
- ✅ Flags completas:
  - `--repo`, `--product` (obrigatórios)
  - `--format` (md|json, default: md)
  - `--base-branch` (default: main)
  - `--min-diff-coverage` (default: 80%)
  - `--min-asserts` (default: 1)
  - `--fail-on` (weak|none, default: none)

### 2️⃣ Core Engine (`src/tools/explain-tests.ts`)
- ✅ Interface `ExplainTestsOptions`
- ✅ Interface `TestExplanation` (schema completo por teste)
- ✅ Interface `TestQualityMetrics` (métricas KR3a/DORA)
- ✅ Interface `AssertInfo` (detalhes de asserções)
- ✅ Função principal `explainTests()`
- ✅ Pipeline completo (6 fases):
  1. Descobrir arquivos de teste
  2. Analisar AST e asserts
  3. Associar coverage e diff
  4. Associar contracts CDC/Pact
  5. Associar riscos e CUJs
  6. Calcular métricas e gerar relatórios

### 3️⃣ Parser AST (`src/parsers/test-ast-parser.ts`)
- ✅ `parseTestFile()`: Parse completo via `@typescript-eslint/typescript-estree`
- ✅ Detecção de framework (Vitest/Jest/Mocha)
- ✅ Extração de imports
- ✅ Extração de test cases (describe/it/test)
- ✅ Análise de corpo do teste:
  - Given: Variáveis, fixtures, arranjos
  - When: Função principal sendo testada
  - Then: Asserts (matcher, target, expected value)
  - Mocks e Spies
  - Error handling (try-catch)
- ✅ `calculateAssertStrength()`: Forte/Médio/Fraco baseado em heurísticas

### 4️⃣ Outputs Gerados
- ✅ `test-explanations.json`: Detalhado por teste (JSON)
- ✅ `TEST-EXPLANATIONS.md`: Humano-legível (Markdown)
- ✅ `TEST-QUALITY-SUMMARY.md`: Sumário KR3a/DORA (Markdown)
- ✅ `test-quality-metrics.json`: Métricas para dashboard (JSON)

### 5️⃣ Métricas KR3a & DORA
- ✅ `assertStrongPct`: % testes fortes
- ✅ `assertMediumPct`: % testes médios
- ✅ `assertWeakPct`: % testes fracos
- ✅ `diffCoveredPct`: % arquivos do diff com cobertura
- ✅ `contractsProtectedPct`: % endpoints críticos cobertos por contrato
- ✅ `weakTestsInDiffPct`: Leading indicator para CFR
- ✅ `diagnosticAssertsPct`: Leading indicator para MTTR
- ✅ KR3a Status: OK / ATENÇÃO / ALERTA

### 6️⃣ Regras Anti-Alucinação
- ✅ Evidências obrigatórias para todas as afirmações
- ✅ "NÃO DETERMINADO (sem evidência)" quando falta dados
- ✅ Referências a nós AST, linhas cobertas, arquivos, coveredInDiff%, contratos

---

## 🚧 O que será implementado nas próximas iterações

### Fase 2: Integração Completa
- [ ] `discoverTestFiles()`: Glob real para encontrar arquivos `*.spec.ts`, `*.test.ts`
- [ ] `enrichWithCoverage()`: Integrar com LCOV/JaCoCo/diff-coverage.json
- [ ] `enrichWithContracts()`: Integrar com contracts-verify.json
- [ ] `enrichWithRisks()`: Integrar com risk-register.json e cujs-catalog.json

### Fase 3: LLM-Powered Explanations 🤖
- [ ] **Integração com LLM da IDE** (Cursor/VS Code)
- [ ] Gerar explicações contextualizadas para cada teste:
  - **Para quê?**: Propósito do teste, CUJ protegido, cenário coberto
  - **Por quê?**: Justificativa técnica, risco mitigado, impacto no negócio
  - **O que poderia melhorar?**: Sugestões específicas baseadas em patterns
- [ ] Análise de qualidade dos asserts:
  - Identificar asserts fracos e sugerir versões mais fortes
  - Detectar missing edge cases
  - Recomendar testes adicionais
- [ ] Geração de "Test Story":
  - Narrativa clara Given/When/Then
  - Explicação do fluxo de dados
  - Contexto de negócio

### Fase 4: Análise Avançada
- [ ] Detecção de flaky tests (padrões conhecidos)
- [ ] Análise de performance dos testes (tempo de execução)
- [ ] Detecção de testes duplicados
- [ ] Análise de cobertura por CUJ/risco

### Fase 5: Dashboard Integration
- [ ] Card "Test Quality" no dashboard
- [ ] Visualização de KR3a guardrails
- [ ] Gráficos de distribuição (forte/médio/fraco)
- [ ] Alertas visuais para testes fracos no diff

---

## 📊 Exemplo de Output Esperado

### test-explanations.json
```json
{
  "file": "src/__tests__/user/create.spec.ts",
  "name": "deve criar usuário válido",
  "functionUnderTest": "createUser",
  "given": ["repo em memória", "payload válido"],
  "when": "POST /users",
  "then": [
    {"type":"status","value":201,"matcher":"toBe"},
    {"type":"body.prop","path":"id","matcher":"toBeDefined"}
  ],
  "mocks": ["EmailService.send"],
  "coverage": {
    "files":["src/user/service.ts"],
    "linesCovered":34,
    "linesTotal":42,
    "coveredInDiffPct":92.1
  },
  "contracts": {"pact": true, "failed": 0, "interactions": 3},
  "risk": {"cuj":"Cadastro de Usuário","level":"alto"},
  "assertStrength": "forte",
  "smells": [],
  "suggestions": []
}
```

### TEST-QUALITY-SUMMARY.md
```markdown
# 📊 Sumário de Qualidade dos Testes

**Status KR3a**: ✅ OK

## 📈 Métricas de Força dos Testes

| Força | % | Contagem |
|-------|---|----------|
| Forte | 64.2% | 89 |
| Médio | 28.1% | 39 |
| Fraco | 7.7% | 11 |

## 🎯 Leading Indicators DORA

| Indicador | Valor | Meta | Status |
|-----------|-------|------|--------|
| Testes Fracos no Diff | 3.2% | ≤ 5% | ✅ |
| Diff Coverage | 85.3% | ≥ 80% | ✅ |
| Contracts Protected | 92.0% | ≥ 90% | ✅ |
| Diagnostic Asserts | 94.5% | ≥ 90% | ✅ |

**Impacto esperado**:
- **CFR**: REDUZIRÁ ↓
- **MTTR**: REDUZIRÁ ↓
- **DF**: MANTÉM ✅
- **LTC**: MANTÉM ✅
```

---

## 🎯 Roadmap de Integração com LLM

### Arquitetura Proposta

```typescript
// src/ai/test-explainer.ts

interface LLMExplanation {
  purpose: string;          // Para quê este teste existe?
  why: string;              // Por quê é importante?
  coverage: string;         // O que ele cobre?
  improvements: string[];   // Como melhorar?
  story: string;            // Narrativa Given/When/Then
}

async function explainTestWithLLM(
  testCase: TestCase,
  codeContext: string,
  riskContext?: RiskInfo,
  cujContext?: CUJInfo
): Promise<LLMExplanation> {
  const prompt = buildPrompt(testCase, codeContext, riskContext, cujContext);
  const response = await callLLM(prompt);
  return parseResponse(response);
}

function buildPrompt(
  testCase: TestCase,
  codeContext: string,
  riskContext?: RiskInfo,
  cujContext?: CUJInfo
): string {
  return `
Você é um engenheiro de qualidade expert. Analise este teste:

**Teste**: ${testCase.name}
**Código**:
${codeContext}

**Contexto de Risco**: ${riskContext?.cuj || 'N/A'} (nível: ${riskContext?.level || 'N/A'})

Explique:
1. **Para quê** este teste existe? Qual propósito de negócio?
2. **Por quê** ele é importante? Que risco mitiga?
3. **O que** exatamente ele valida?
4. **Como** poderia ser melhorado?

Seja específico, técnico e objetivo. Use evidências do código.
`;
}
```

### Benefícios da Integração LLM
1. **Explicações Contextualizadas**: Entende o propósito real do teste
2. **Sugestões Inteligentes**: Baseadas em patterns e best practices
3. **Narrativas Claras**: Transforma código em histórias compreensíveis
4. **Diagnóstico Profundo**: Identifica problemas sutis que heurísticas não pegam

---

## 🚀 Como Usar (MVP atual)

```bash
# Análise básica
quality explain-tests --repo . --product my-app

# Com quality gate (falha se testes fracos no diff)
quality explain-tests --repo . --product my-app --fail-on weak

# Custom thresholds
quality explain-tests --repo . --product my-app \
  --min-diff-coverage 90 \
  --min-asserts 2 \
  --base-branch develop

# Output JSON
quality explain-tests --repo . --product my-app --format json
```

---

## 📝 Próximos Passos

1. **Compilar e testar MVP** ✅
2. **Implementar descoberta real de arquivos de teste**
3. **Integrar com diff-coverage.json**
4. **Integrar com contracts-verify.json**
5. **Integrar LLM para explicações ricas** 🤖
6. **Adicionar card no dashboard**
7. **Documentar em QUALITY-GATES-GUIDE.md**

---

**Status**: 🟡 MVP Funcional (v1.0) - Pronto para testes iniciais
**Próxima Milestone**: Integração LLM (v1.1)

