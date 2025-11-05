# 🔍 Explain Tests - Guia Completo

## 📋 Visão Geral

O comando `explain-tests` analisa os testes do projeto usando **AST**, **coverage** e **contracts** para gerar explicações detalhadas sobre:

- 🎯 **O que** cada teste está testando
- ❓ **Por que** está testando aquele item  
- 🎯 **Para que** está testando (propósito de negócio/DORA)
- 💪 **Força dos asserts** (forte/médio/fraco)
- ⚠️ **Code smells** detectados com exemplos de correção
- 📊 **Métricas KR3a** e DORA

---

## 🚀 Como Usar

### CLI

```bash
# Análise básica
quality explain-tests --repo . --product my-app

# Com validação rigorosa
quality explain-tests \
  --repo . \
  --product my-app \
  --fail-on weak \
  --min-diff-coverage 90

# Output customizado
quality explain-tests \
  --repo . \
  --product my-app \
  --format json \
  --out-dir ./custom
```

### MCP

```json
{
  "tool": "explain_tests",
  "arguments": {
    "repo": "/path/to/repo",
    "product": "my-app",
    "format": "md",
    "minDiffCoverage": 80,
    "failOn": "weak"
  }
}
```

---

## 📊 Outputs Gerados

### 1. test-explanations.json

**Localização**: `qa/<product>/tests/analyses/test-explanations.json`

```json
[
  {
    "file": "src/__tests__/auth/validate-user.spec.ts",
    "name": "deve validar usuário com sucesso",
    "testType": "unit",
    "whatItTests": "Testa se validateUser retorna true quando usuário possui credenciais válidas",
    "whyItTests": "Garante comportamento isolado da unidade de código; Previne regressões no comportamento esperado; Validações específicas aumentam confiabilidade",
    "purposeForWhat": "Reduzir CFR (Change Failure Rate) identificando bugs antes do deploy; Reduzir MTTR (Mean Time to Recovery) com diagnóstico rápido; Manter confiabilidade e velocidade de entrega (KR3a)",
    "functionUnderTest": "validateUser",
    "given": [
      "Mock do repositório de usuários retornando usuário válido",
      "Token JWT válido gerado"
    ],
    "when": "validateUser(userId, token)",
    "then": [
      { "type": "status", "value": 200 },
      { "type": "body.isValid", "value": true },
      { "type": "body.user.id", "value": "userId" }
    ],
    "mocks": ["userRepository.findById", "jwtService.verify"],
    "coverage": {
      "files": ["src/auth/validate-user.ts"],
      "linesCovered": 12,
      "linesTotal": 15,
      "coveredInDiffPct": 80.0
    },
    "contracts": {
      "pact": false,
      "failed": 0,
      "interactions": 0
    },
    "risk": {
      "cuj": "Autenticação de Usuário",
      "level": "médio",
      "slo": "99.9% uptime, <200ms latency"
    },
    "assertStrength": "forte",
    "smells": [],
    "suggestions": []
  }
]
```

### 2. TEST-EXPLANATIONS.md

**Localização**: `qa/<product>/tests/reports/TEST-EXPLANATIONS.md`

Markdown detalhado com seções:
- 🔬/🔗/🎭 Emoji por tipo (unit/integration/e2e)
- 🎯 O que testa?
- ❓ Por que testa isso?
- 🎯 Para que testa?
- 📋 Estrutura Given-When-Then
- 💪 Força dos asserts
- 📊 Cobertura (PR-aware)
- 🎭 Mocks/Spies
- 🤝 Contratos CDC/Pact
- ⚠️ Code smells com exemplos de correção
- 💡 Sugestões de melhoria

### 3. TEST-QUALITY-SUMMARY.md

**Localização**: `qa/<product>/tests/reports/TEST-QUALITY-SUMMARY.md`

Sumário executivo com:
- 🎯 Status KR3a (OK/ATENÇÃO/ALERTA)
- 📈 Distribuição de força dos testes
- 🎯 Leading Indicators DORA
- 📊 Impacto esperado em CFR/MTTR/DF/LTC

### 4. test-quality-metrics.json

**Localização**: `qa/<product>/tests/analyses/test-quality-metrics.json`

```json
{
  "assertStrongPct": 64.2,
  "assertMediumPct": 28.5,
  "assertWeakPct": 7.3,
  "diffCoveredPct": 83.5,
  "contractsProtectedPct": 78.0,
  "weakTestsInDiffPct": 6.7,
  "criticalEndpointsWithoutContract": 2,
  "suspectedFlakyPct": 1.3,
  "diagnosticAssertsPct": 92.7,
  "totalTests": 147,
  "testsWithAsserts": 145,
  "testsWithoutAsserts": 2
}
```

---

## 🎯 Code Smells Detectados

O `explain-tests` identifica 4 tipos de code smells e fornece **exemplos práticos** de correção:

### 1. 🚨 Teste sem Asserts (CRITICAL)

**Descrição**: Teste não valida nenhum comportamento  
**Impacto**: Teste sempre passa (falso positivo). Bugs não são detectados. Coverage inflado artificialmente.

**❌ Antes (Problema):**

```typescript
it('deve processar dados', () => {
  const result = processData(input);
  // Não valida nada! 🚨
});
```

**✅ Depois (Corrigido):**

```typescript
it('deve processar dados', () => {
  const result = processData(input);
  
  // Validar retorno
  expect(result).toBeDefined();
  expect(result.status).toBe('success');
  
  // Validar dados processados
  expect(result.data).toHaveLength(3);
  expect(result.data[0]).toHaveProperty('id');
  
  // Validar efeitos colaterais
  expect(result.timestamp).toBeGreaterThan(0);
});
```

### 2. ⚠️ Excesso de Mocks (HIGH)

**Descrição**: Teste muito acoplado à implementação  
**Impacto**: Teste frágil que quebra com mudanças internas. Dificulta refatoração.

**❌ Antes (Problema):**

```typescript
it('should send email', () => {
  const mockDb = vi.fn();
  const mockLogger = vi.fn();
  const mockEmailService = vi.fn();
  const mockQueue = vi.fn();
  const mockCache = vi.fn(); // 5º mock! 🚨
  const mockMetrics = vi.fn();
  
  sendEmailWithLogging(data, mockDb, mockLogger, ...);
  
  expect(mockDb).toHaveBeenCalled();
  expect(mockLogger).toHaveBeenCalled();
  // Testando demais a implementação!
});
```

**✅ Depois (Corrigido):**

```typescript
it('should send email', async () => {
  // Mock apenas APIs externas (não controláveis)
  const mockEmailProvider = vi.fn().mockResolvedValue({ sent: true });
  
  // Use implementações reais para o resto
  const result = await emailService.send({
    to: 'test@example.com',
    subject: 'Test',
    provider: mockEmailProvider
  });
  
  // Valide o COMPORTAMENTO, não a implementação
  expect(result.sent).toBe(true);
  expect(mockEmailProvider).toHaveBeenCalledWith(
    expect.objectContaining({ to: 'test@example.com' })
  );
});
```

### 3. 🟡 Teste de Erro sem try-catch (MEDIUM)

**Descrição**: Validação genérica de exceções  
**Impacto**: Não valida tipo, mensagem ou causa do erro. Error handling superficial.

**❌ Antes (Problema):**

```typescript
it('should throw error on invalid input', () => {
  expect(() => validateInput(invalidData)).toThrow();
  // Não valida QUAL erro! 🚨
});
```

**✅ Depois (Corrigido):**

```typescript
it('should throw ValidationError with specific message', async () => {
  try {
    await validateInput(invalidData);
    fail('Deveria ter lançado ValidationError');
  } catch (error) {
    // Validar tipo do erro
    expect(error).toBeInstanceOf(ValidationError);
    
    // Validar mensagem específica
    expect(error.message).toBe('Email is required');
    
    // Validar código de erro
    expect(error.code).toBe('VALIDATION_ERROR');
    
    // Validar campos inválidos
    expect(error.fields).toContain('email');
  }
});
```

### 4. ℹ️ Teste Muito Longo (LOW)

**Descrição**: Teste viola Single Responsibility Principle  
**Impacto**: Difícil de entender e debugar. Provavelmente testa múltiplas coisas.

**✅ Como corrigir**: Quebrar em múltiplos testes menores (10-30 linhas cada), usar `beforeEach` para setup compartilhado, agrupar com `describe()`.

---

## 🎯 Métricas KR3a & DORA

### KR3a Guardrails

| Guardrail | Meta | Impacto |
|-----------|------|---------|
| Testes Fracos no Diff | ≤ 5% | Reduz CFR |
| Diff Coverage | ≥ 80% | Mantém DF/LTC |
| Contracts Protected | ≥ 90% | Reduz falhas de integração |
| Diagnostic Asserts | ≥ 90% | Reduz MTTR |

### Status KR3a

- **OK** ✅: Todos os guardrails atendidos
- **ATENÇÃO** ⚠️: 1 guardrail violado ou weakTests ≤ 10%
- **ALERTA** 🚨: 2+ guardrails violados

### DORA Leading Indicators

- **CFR (Change Failure Rate)**: Testes fortes + contracts previnem bugs em produção
- **MTTR (Mean Time to Recovery)**: Asserts diagnósticos aceleram debug
- **DF (Deploy Frequency)**: Coverage adequado mantém velocidade
- **LTC (Lead Time for Changes)**: Confiança para deploy rápido

---

## 📋 Flags Disponíveis

| Flag | Descrição | Padrão |
|------|-----------|--------|
| `--repo` | Caminho do repositório | `.` |
| `--product` | Nome do produto | Obrigatório |
| `--format` | Formato de saída (`md` ou `json`) | `md` |
| `--out-dir` | Diretório de saída customizado | `qa/<product>/tests/` |
| `--base-branch` | Branch base para diff coverage | `main` |
| `--min-diff-coverage` | Coverage mínimo no diff (%) | `80` |
| `--min-asserts` | Asserts mínimos por teste | `1` |
| `--fail-on` | Falhar quando (`weak` ou `none`) | `none` |

---

## 💡 Casos de Uso

### 1. Análise Rápida (Dev Local)

```bash
# Ver qualidade dos testes atuais
quality explain-tests --repo . --product my-app
cat qa/my-app/tests/reports/TEST-QUALITY-SUMMARY.md
```

### 2. Gate de Pull Request

```bash
# Bloquear PR com testes fracos
quality explain-tests \
  --repo . \
  --product my-app \
  --fail-on weak \
  --min-diff-coverage 80

# Exit code: 0 = pass, 1 = fail
```

### 3. Onboarding de Desenvolvedores

```bash
# Gerar documentação completa dos testes
quality explain-tests --repo . --product my-app

# Novo dev lê:
# - qa/my-app/tests/reports/TEST-EXPLANATIONS.md
#   → Entende O QUE cada teste faz
#   → Entende POR QUE existe
#   → Entende PARA QUE serve (negócio)
```

### 4. Refatoração Guiada

```bash
# Identificar testes problemáticos
quality explain-tests --repo . --product my-app

# Priorizar correções por:
# 1. Smells CRITICAL (teste sem asserts)
# 2. Smells HIGH (excesso de mocks)
# 3. Testes no diff com assertStrength fraco
```

---

## 🔗 Integração com Outras Features

### Com `quality analyze`

```bash
# 1. Gerar coverage + contracts primeiro
quality analyze --repo . --product my-app --mode full

# 2. Explicar testes (usa coverage/contracts)
quality explain-tests --repo . --product my-app

# Resultado: testes enriquecidos com:
# - coveredInDiffPct (do diff-coverage.json)
# - contracts.pact/failed (do contracts-verify.json)
# - risk.cuj/level (do risk-register.json)
```

### Com Dashboard

```bash
# Gerar + visualizar
quality explain-tests --repo . --product my-app
xdg-open qa/my-app/tests/analyses/dashboard.html

# Dashboard exibe:
# - Card "Test Quality (KR3a)"
# - Métricas de força dos testes
# - Indicadores DORA
```

---

## ✅ Checklist de Qualidade

Use este checklist após cada análise:

- [ ] `assertStrongPct` ≥ 70%?
- [ ] `assertWeakPct` ≤ 10%?
- [ ] `diffCoveredPct` ≥ 80%?
- [ ] `weakTestsInDiffPct` ≤ 5%?
- [ ] `contractsProtectedPct` ≥ 90% (se aplicável)?
- [ ] `testsWithoutAsserts` = 0?
- [ ] Todos os smells CRITICAL corrigidos?
- [ ] CUJs críticos têm testes fortes?

**Se algum item falhou**: Consulte `TEST-EXPLANATIONS.md` para ver os testes problemáticos e seus exemplos de correção.

---

## 🚀 Próximas Features (Futuro)

- [ ] Suporte a Python/Go/Java AST parsing
- [ ] Detecção de flaky tests
- [ ] Recomendação automática de testes faltantes
- [ ] Integração com AI para gerar correções
- [ ] Property-based test detection
- [ ] Performance test analysis

---

**Versão**: v2.0  
**Última Atualização**: 2025-11-04  
**Status**: ✅ Production Ready

