# 🧬 Mutation Testing Guide

## 📋 O que é Mutation Testing?

Mutation testing valida se seus **testes realmente testam algo**. Ele modifica ("muta") seu código propositalmente e verifica se os testes detectam essas mudanças.

Se um teste continua passando mesmo com código modificado, significa que o teste é **fraco** e não valida comportamento crítico.

---

## 🎯 Por que usar?

### ❌ Problema: Testes que passam mas não validam nada

```typescript
// ❌ Teste fraco - toBeDefined() sempre passa
test('deve retornar resultado', () => {
  const result = calculateTotal([1, 2, 3]);
  expect(result).toBeDefined(); // Mutante sobrevive!
});
```

### ✅ Solução: Assertions específicas

```typescript
// ✅ Teste forte - valida valor exato
test('deve retornar soma correta', () => {
  const result = calculateTotal([1, 2, 3]);
  expect(result).toBe(6); // Mutante é morto!
});
```

---

## 🚀 Quickstart

### 1. Instalar Stryker

```bash
npm install --save-dev @stryker-mutator/core @stryker-mutator/vitest-runner
```

### 2. Configurar Stryker

```bash
npx stryker init
```

Ou criar `stryker.conf.json` manualmente:

```json
{
  "$schema": "./node_modules/@stryker-mutator/core/schema/stryker-schema.json",
  "packageManager": "npm",
  "testRunner": "vitest",
  "coverageAnalysis": "perTest",
  "mutate": [
    "src/**/*.ts",
    "!src/**/*.test.ts",
    "!src/**/__tests__/**"
  ],
  "reporters": ["html", "clear-text", "progress", "json"],
  "htmlReporter": {
    "fileName": "reports/mutation/index.html"
  },
  "jsonReporter": {
    "fileName": "reports/mutation/mutation.json"
  },
  "thresholds": {
    "high": 80,
    "low": 60,
    "break": 50
  }
}
```

### 3. Executar Mutation Testing

```bash
npx stryker run
```

### 4. Validar com Quality Gates

```bash
# Falha se mutation score < 70%
quality validate --repo . --min-mutation 70

# Gate rigoroso (80%)
quality validate --repo . --min-mutation 80

# Combinar com outros gates
quality validate --repo . --min-mutation 75 --min-branch 85
```

---

## 📊 Interpretando Resultados

### Status dos Mutantes

| Status | Significado | Impacto |
|--------|-------------|---------|
| **Killed** 🟢 | Teste detectou a mutação | ✅ Teste FORTE |
| **Survived** 🔴 | Teste passou mesmo com mutação | ❌ Teste FRACO |
| **Timeout** 🟡 | Teste demorou muito | ⚠️ Verificar performance |
| **NoCoverage** ⚪ | Código sem testes | ❌ Gap de cobertura |

### Mutation Score

```
Score = (Killed / Total) * 100

Exemplo:
- 8 mutantes killed
- 2 mutantes survived
- Total: 10
- Score: 80%
```

### Thresholds Recomendados

| Projeto | Mutation Score | Justificativa |
|---------|----------------|---------------|
| **Startup / MVP** | 50-60% | Validar funções críticas |
| **Produção** | 70-80% | Qualidade profissional |
| **Financeiro / Saúde** | 85-95% | Alta criticidade |

---

## 🔧 Tipos de Mutantes

### 1. ConditionalExpression
```typescript
// Original
if (x > 0) { ... }

// Mutado
if (false) { ... }
```

**Como matar:**
```typescript
expect(result).toBe(expectedValue); // Valida que condição funciona
```

### 2. ArithmeticOperator
```typescript
// Original
return a + b;

// Mutado
return a - b;
```

**Como matar:**
```typescript
expect(sum(2, 3)).toBe(5); // Não toBeDefined()!
```

### 3. BlockStatement
```typescript
// Original
function save() { writeFile(...); }

// Mutado
function save() { /* vazio */ }
```

**Como matar:**
```typescript
const spy = vi.spyOn(fs, 'writeFile');
await save();
expect(spy).toHaveBeenCalledWith('file.txt', 'content');
```

### 4. EqualityOperator
```typescript
// Original
if (status === 'active') { ... }

// Mutado
if (status !== 'active') { ... }
```

**Como matar:**
```typescript
expect(isActive({ status: 'active' })).toBe(true);
expect(isActive({ status: 'inactive' })).toBe(false);
```

---

## 💡 Checklist: Como Escrever Testes Fortes

### ❌ Evite Assertions Fracas

```typescript
// ❌ FRACO
expect(result).toBeDefined();
expect(result).toBeTruthy();
expect(result).toHaveLength(1);
expect(error).toBeDefined();
```

### ✅ Use Assertions Específicas

```typescript
// ✅ FORTE
expect(result).toBe(42);
expect(result).toEqual({ id: 1, name: 'Test' });
expect(array).toHaveLength(3);
expect(error.message).toBe('Invalid input');
```

### ✅ Teste Valores Exatos

```typescript
// ❌ FRACO
expect(price).toBeGreaterThan(0);

// ✅ FORTE
expect(price).toBe(29.99);
```

### ✅ Teste Side Effects

```typescript
// ❌ FRACO
await saveUser(user);
// Nenhuma validação!

// ✅ FORTE
const saveSpy = vi.spyOn(db, 'save');
await saveUser(user);
expect(saveSpy).toHaveBeenCalledWith(user);
expect(saveSpy).toHaveBeenCalledTimes(1);
```

### ✅ Teste Erros com Mensagens

```typescript
// ❌ FRACO
await expect(fn()).rejects.toThrow();

// ✅ FORTE
await expect(fn()).rejects.toThrow('Email is required');
await expect(fn()).rejects.toThrow(ValidationError);
```

---

## 🚦 Integração com CI/CD

### GitHub Actions

```yaml
name: Quality Gates

on: [pull_request]

jobs:
  mutation-testing:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Install dependencies
        run: npm install
      
      - name: Run mutation testing
        run: npx stryker run
      
      - name: Validate mutation score
        run: npm run quality:validate -- --min-mutation 70
      
      - name: Upload mutation report
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: mutation-report
          path: reports/mutation/
```

### GitLab CI

```yaml
quality:mutation:
  stage: test
  script:
    - npm install
    - npx stryker run
    - npm run quality:validate -- --min-mutation 70
  artifacts:
    paths:
      - reports/mutation/
    when: always
```

---

## 📝 Exemplos Práticos

### Exemplo 1: Função de Parser

```typescript
// src/parser.ts
export function parseJSON(input: string): any {
  if (!input) throw new Error('Empty input');
  if (input.length > 1000) throw new Error('Input too large');
  return JSON.parse(input);
}
```

**❌ Teste Fraco:**
```typescript
test('deve fazer parse de JSON', () => {
  const result = parseJSON('{"name":"test"}');
  expect(result).toBeDefined(); // Mutantes sobrevivem!
});
```

**✅ Teste Forte:**
```typescript
describe('parseJSON', () => {
  it('deve fazer parse correto de JSON válido', () => {
    const result = parseJSON('{"name":"test","age":25}');
    expect(result).toEqual({ name: 'test', age: 25 }); // Valor exato
  });

  it('deve lançar erro quando input vazio', () => {
    expect(() => parseJSON('')).toThrow('Empty input'); // Mensagem exata
  });

  it('deve lançar erro quando input muito grande', () => {
    const largeInput = 'x'.repeat(1001);
    expect(() => parseJSON(largeInput)).toThrow('Input too large');
  });

  it('deve lançar erro quando JSON inválido', () => {
    expect(() => parseJSON('{invalid')).toThrow(SyntaxError);
  });
});
```

**Resultado:**
- Teste fraco: **40% mutation score** (6 mutantes survived)
- Teste forte: **95% mutation score** (apenas 1 mutante survived)

---

## 🐛 Troubleshooting

### Problema: "Nenhum relatório de mutação encontrado"

**Causa:** Stryker não foi executado.

**Solução:**
```bash
npx stryker run
```

### Problema: Mutation testing muito lento

**Causa:** Muitos mutantes sendo testados.

**Solução:** Focar em arquivos críticos

```json
{
  "mutate": [
    "src/critical/**/*.ts",
    "src/parsers/**/*.ts",
    "!src/**/*.test.ts"
  ]
}
```

### Problema: Mutation score = 0%

**Causa:** Testes usando assertions fracas.

**Solução:** Substituir por assertions específicas (ver checklist acima).

---

## 📚 Referências

- [Stryker Mutator Docs](https://stryker-mutator.io/docs/)
- [Mutation Testing Guide](https://stryker-mutator.io/docs/mutation-testing-elements/what-is-mutation-testing/)
- [Vitest + Stryker](https://stryker-mutator.io/docs/stryker-js/vitest-runner/)

---

## 🎯 Próximos Passos

1. ✅ Configure Stryker no seu projeto
2. ✅ Execute `npx stryker run` uma vez
3. ✅ Valide com `quality validate --min-mutation 70`
4. ✅ Adicione gate no CI/CD
5. ✅ Revise mutantes sobreviventes e melhore testes
6. ✅ Incremente threshold gradualmente (70% → 75% → 80%)

---

**💡 Dica:** Comece com threshold baixo (50-60%) e aumente gradualmente conforme melhora os testes.
