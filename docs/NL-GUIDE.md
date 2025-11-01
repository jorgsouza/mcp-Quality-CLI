# 🧠 Guia de Comandos em Linguagem Natural

Este guia explica como usar a tool `nl_command` do Quality MCP para executar análises de qualidade usando **linguagem natural** em Português ou Inglês.

---

## 📖 Índice

- [Visão Geral](#visão-geral)
- [Sintaxe Básica](#sintaxe-básica)
- [Modos de Execução](#modos-de-execução)
- [Overrides no Texto](#overrides-no-texto)
- [Defaults Globais](#defaults-globais)
- [Exemplos por Persona](#exemplos-por-persona)
- [Troubleshooting](#troubleshooting)

---

## Visão Geral

A tool `nl_command` permite que você execute análises de qualidade usando frases naturais como:

```
"analise meu repositório"
"criar plano de testes"
"rodar testes e calcular cobertura"
```

### Como Funciona

1. **Você escreve** uma frase em PT ou EN
2. **O parser detecta** a intenção (modo: full/analyze/plan/scaffold/run)
3. **Extrai overrides** se houver (repo:/path, product:Name)
4. **Mescla com defaults** globais (se fornecidos)
5. **Executa** a tool `auto` com os parâmetros finais

---

## Sintaxe Básica

### Estrutura do Comando

```json
{
  "tool": "nl_command",
  "params": {
    "query": "<sua frase aqui>",
    "defaults": {  // opcional
      "repo": "/path/default",
      "product": "DefaultProduct",
      "mode": "full"
    }
  }
}
```

### Query (Obrigatório)

- **Tipo**: String
- **Idiomas**: PT ou EN
- **Exemplos**:
  - `"analise meu repositório"`
  - `"create test plan"`
  - `"rodar testes product:MyApp"`

### Defaults (Opcional)

- **Tipo**: Object
- **Propriedades**:
  - `repo`: Caminho padrão do repositório
  - `product`: Nome padrão do produto
  - `mode`: Modo padrão (full/analyze/plan/scaffold/run)
  - `skipScaffold`: Pular scaffold por padrão
  - `skipRun`: Pular execução por padrão

---

## Modos de Execução

### 1. FULL (Completo)

**Intenção**: Análise completa do zero ao fim.

**Padrões que detectam FULL (PT)**:
- `analise`, `analisar`, `auditar`, `completo`, `tudo`
- `rodar tudo`
- `executar completo`
- `end to end`

**Padrões que detectam FULL (EN)**:
- `analyze`, `audit`, `full`, `everything`, `complete`
- `run all`
- `end-to-end`

**O que faz**:
1. Analisa código (endpoints, eventos, testes)
2. Recomenda estratégia de testes
3. Gera plano de testes
4. Cria scaffolds (unit, integration, e2e)
5. Executa testes
6. Calcula cobertura total + diff
7. Gera relatório executivo

**Exemplos**:
```javascript
// PT
"analise meu repositório"
"auditar o projeto completo"
"rodar tudo end to end"

// EN
"analyze my repository"
"audit the complete project"
"run everything"
```

---

### 2. ANALYZE (Apenas Análise)

**Intenção**: Mapear código sem gerar testes.

**Padrões que detectam ANALYZE (PT)**:
- `apenas analisar`, `somente scan`, `só mapear`
- `analisar o código`
- `mapear endpoints`

**Padrões que detectam ANALYZE (EN)**:
- `only analyze`, `just scan`
- `analyze the code`
- `map endpoints`

**O que faz**:
1. Analisa código (rotas, endpoints, eventos)
2. Detecta testes existentes
3. Gera `analyze.json` e `pyramid-report.json`

**Exemplos**:
```javascript
// PT
"apenas analisar o código"
"só mapear os endpoints"
"somente scan do repositório"

// EN
"only analyze the code"
"just map the endpoints"
"scan the repository only"
```

---

### 3. PLAN (Análise + Plano)

**Intenção**: Criar estratégia de testes.

**Padrões que detectam PLAN (PT)**:
- `criar plano`, `gerar estratégia`
- `plano de testes`
- `estratégia de qualidade`

**Padrões que detectam PLAN (EN)**:
- `create plan`, `generate strategy`
- `test plan`
- `quality strategy`

**O que faz**:
1. Analisa código
2. Recomenda estratégia (% unit/int/e2e)
3. Gera `TEST-PLAN.md` estruturado

**Exemplos**:
```javascript
// PT
"criar plano de testes"
"gerar estratégia de qualidade"

// EN
"create test plan"
"generate quality strategy"
```

---

### 4. SCAFFOLD (Análise + Plano + Templates)

**Intenção**: Gerar estrutura de testes.

**Padrões que detectam SCAFFOLD (PT)**:
- `scaffold`
- `gerar templates de testes`
- `criar estruturas`

**Padrões que detectam SCAFFOLD (EN)**:
- `scaffold`
- `generate test templates`
- `create test structures`

**O que faz**:
1. Analisa código
2. Gera plano
3. Cria scaffolds (unit, integration, e2e)

**Exemplos**:
```javascript
// PT
"scaffold de testes"
"gerar templates de unit tests"

// EN
"scaffold tests"
"generate test templates"
```

---

### 5. RUN (Executar Testes)

**Intenção**: Rodar testes e calcular cobertura.

**Padrões que detectam RUN (PT)**:
- `rodar testes`, `executar testes`
- `calcular cobertura`
- `validar cobertura`

**Padrões que detectam RUN (EN)**:
- `run tests`, `execute tests`
- `calculate coverage`
- `validate coverage`

**O que faz**:
1. Executa testes existentes
2. Calcula cobertura total
3. Calcula diff-coverage
4. Gera relatórios

**Exemplos**:
```javascript
// PT
"rodar testes e calcular cobertura"
"executar testes"

// EN
"run tests and calculate coverage"
"execute tests"
```

---

## Overrides no Texto

Você pode sobrescrever valores diretamente na query usando a sintaxe `chave:valor`.

### Sintaxe

```
<comando> repo:<path> product:<name> mode:<mode>
```

### Overrides Suportados

| Override | Sintaxe | Exemplo |
|----------|---------|---------|
| **repo** | `repo:/path/to/repo` | `"analise repo:/home/user/app"` |
| **product** | `product:Name` | `"criar plano product:Portal"` |
| **mode** | `mode:analyze` | `"executar mode:analyze"` |

### Exemplos

```javascript
// Override de repo
"analise repo:/tmp/my-project"

// Override de product
"criar plano product:BillingService"

// Override de mode (força modo específico)
"rodar tudo mode:analyze"  // "tudo" sugere full, mas mode: força analyze

// Múltiplos overrides
"scaffold repo:/workspace/app product:MyApp mode:scaffold"
```

### Precedência

**Override > Defaults > Modo Detectado**

```javascript
{
  "query": "rodar testes product:MyApp",  // mode detectado: run
  "defaults": {
    "mode": "full",        // default
    "product": "Default"   // default
  }
}

// Resultado final:
// mode: run (detectado)
// product: MyApp (override vence default)
```

---

## Defaults Globais

Use `defaults` para configurar valores que se aplicam a múltiplos comandos.

### Exemplo: Configuração de Projeto

```json
{
  "query": "analise meu repositório",
  "defaults": {
    "repo": "/workspace/my-project",
    "product": "MyProduct"
  }
}
```

### Exemplo: Skip Flags

```json
{
  "query": "rodar análise completa",
  "defaults": {
    "skipScaffold": true,  // Não gerar templates (já existem)
    "skipRun": false       // Executar testes
  }
}
```

---

## Exemplos por Persona

### 👨‍💻 DEV - Setup Inicial

**Cenário**: Dev clona repo novo e quer setup completo.

```json
{
  "query": "analise meu repositório e configure tudo"
}
```

**O que acontece**:
1. Detecta repo: `process.cwd()`
2. Infere produto do `package.json`
3. Cria `qa/<produto>/mcp-settings.json`
4. Analisa código
5. Recomenda 70% unit, 20% int, 10% e2e
6. Gera plano
7. Cria scaffolds
8. Executa testes scaffolds (vazios)
9. Gera relatório com próximos passos

---

### 🧪 QA - Validação de PR

**Cenário**: QA revisa PR e quer validar cobertura do diff.

```json
{
  "query": "rodar testes e calcular cobertura"
}
```

**O que acontece**:
1. Detecta repo atual
2. Executa testes (unit + int + e2e)
3. Calcula cobertura total
4. Calcula diff vs `main`
5. Gera relatório:
   - Coverage total: X%
   - Coverage do diff: Y%
   - Novos arquivos sem testes
   - Sugestões

---

### 👔 LEAD - Análise de Produto

**Cenário**: Lead quer visão geral sem executar testes.

```json
{
  "query": "apenas analisar o código e gerar plano"
}
```

**O que acontece**:
1. Analisa toda a base
2. Detecta testes existentes
3. Gera pyramid report visual
4. Calcula health da pirâmide
5. Recomenda ações (criar X unit, Y int, reduzir Z e2e)
6. Gera `TEST-PLAN.md` com estratégia

---

### 🤖 CI/CD Pipeline

**Cenário**: Pipeline valida cobertura do PR.

```json
{
  "query": "rodar testes product:MyApp",
  "defaults": {
    "skipScaffold": true  // Não criar templates no CI
  }
}
```

**GitHub Actions Example**:
```yaml
- name: Run Quality Check
  run: |
    npx quality-mcp nl_command '{
      "query": "rodar testes e validar cobertura",
      "defaults": { "skipScaffold": true }
    }'
```

---

## Troubleshooting

### Comando não reconhecido

**Sintoma**: Mode detectado é sempre `full`.

**Causa**: Query não tem palavras-chave reconhecidas.

**Solução**: Use palavras-chave específicas:
```javascript
// ❌ Vago
"fazer análise"

// ✅ Específico
"apenas analisar o código"
"criar plano de testes"
```

---

### Override não funciona

**Sintoma**: Override é ignorado.

**Causa**: Sintaxe incorreta.

**Solução**: Use formato `chave:valor` sem espaços:
```javascript
// ❌ Errado
"analise repo: /path"      // espaço após :
"analise repo = /path"     // = ao invés de :

// ✅ Correto
"analise repo:/path"
```

---

### Defaults não aplicados

**Sintoma**: Valores default não são usados.

**Causa**: Override no query tem precedência.

**Solução**: Entenda a precedência:
```javascript
// Query override vence default
{
  "query": "analise product:MyApp",
  "defaults": { "product": "Default" }
}
// Resultado: product = MyApp (override)

// Default é usado se não houver override
{
  "query": "analise meu repositório",
  "defaults": { "product": "Default" }
}
// Resultado: product = Default
```

---

## Dicas e Best Practices

### 1. **Use português ou inglês consistentemente**

```javascript
// ✅ Bom
"analise meu repositório"
"analyze my repository"

// ⚠️ Evite misturar
"analyze meu repositório"
```

### 2. **Seja específico para modos parciais**

```javascript
// ✅ Específico
"apenas analisar o código"     // → mode: analyze
"só criar plano"               // → mode: plan

// ❌ Vago
"fazer algo"                   // → mode: full (default)
```

### 3. **Use overrides para projetos específicos**

```javascript
// ✅ Explícito
"analise repo:/workspace/billing product:BillingService"

// ⚠️ Depende de auto-detecção
"analise meu repositório"  // Pode não achar o produto correto
```

### 4. **Configure defaults uma vez**

```javascript
// ✅ Reuso
const defaults = {
  repo: "/workspace/my-app",
  product: "MyApp"
};

nlCommand({ query: "analise", defaults });
nlCommand({ query: "criar plano", defaults });
nlCommand({ query: "rodar testes", defaults });
```

---

## Referência Rápida

### Comandos Comuns

| Intenção | PT | EN |
|----------|----|----|
| **Análise completa** | `analise meu repositório` | `analyze my repository` |
| **Só análise** | `apenas analisar o código` | `only analyze the code` |
| **Criar plano** | `criar plano de testes` | `create test plan` |
| **Gerar templates** | `scaffold de testes` | `scaffold tests` |
| **Rodar testes** | `rodar testes` | `run tests` |
| **Cobertura** | `calcular cobertura` | `calculate coverage` |

### Overrides

| Override | Exemplo |
|----------|---------|
| **Repo** | `repo:/path/to/repo` |
| **Product** | `product:MyApp` |
| **Mode** | `mode:analyze` |

---

**Versão**: 0.3.0  
**Última atualização**: 2025-11-01
