# 📋 Plano Detalhado de Testes - Quality MCP

**Gerado por:** Quality MCP (recommend_test_strategy)  
**Data:** 2025-10-31  
**Baseado em:** Análise inteligente do tipo de aplicação

---

## 🎯 Meta de Cobertura

**Situação Atual:**
- ✅ 5 testes unitários (100%)
- ❌ 0 testes de integração (0%)
- ⬜ 0 testes E2E (pular)

**Meta Recomendada:**
- 🎯 **50 testes unitários** (90%)
- 🎯 **6 testes de integração** (10%)
- ⬜ **0 testes E2E** (pular - não traz valor para CLI)

**Gap:** Precisa criar **45 unit tests** + **6 integration tests** = **51 novos testes**

---

## 📊 Distribuição por Arquivo

### 🔴 PRIORIDADE ALTA (criar primeiro)

#### 1. `src/detectors/next.ts` - **8 testes unit**

**Por quê:** Lógica complexa de parsing, múltiplos edge cases

**Casos de teste:**

```typescript
describe('findNextRoutes', () => {
  // 1. Detectar rotas app/ directory (Next.js 13+)
  it('deve detectar rotas no formato app/page.tsx')
  
  // 2. Detectar rotas pages/ directory (Next.js 12-)
  it('deve detectar rotas no formato pages/index.tsx')
  
  // 3. Dynamic routes
  it('deve detectar rotas dinâmicas [id]/page.tsx')
  
  // 4. Catch-all routes
  it('deve detectar rotas catch-all [...slug]/page.tsx')
  
  // 5. Route groups
  it('deve ignorar route groups (app)/page.tsx')
  
  // 6. API routes
  it('deve detectar API routes em app/api/route.ts')
  
  // 7. Erro: diretório não existe
  it('deve retornar array vazio se diretório não existir')
  
  // 8. Múltiplas rotas
  it('deve retornar todas as rotas encontradas')
});
```

**Comando para criar:**
```bash
Crie testes unitários para src/detectors/next.ts com 8 casos de teste 
cobrindo rotas app/, pages/, dinâmicas, catch-all, route groups, API routes,
erro de diretório e múltiplas rotas.
```

---

#### 2. `src/detectors/express.ts` - **10 testes unit**

**Por quê:** Parsing de rotas + OpenAPI, muitos formatos

**Casos de teste:**

```typescript
describe('findExpressRoutes', () => {
  // Express routes
  // 1. GET routes
  it('deve detectar app.get("/path", handler)')
  
  // 2. POST routes
  it('deve detectar app.post("/path", handler)')
  
  // 3. Múltiplos verbos
  it('deve detectar router.put, router.delete, router.patch')
  
  // 4. Routers separados
  it('deve detectar Router() com routes')
  
  // 5. Middleware chains
  it('deve detectar routes com middlewares')
});

describe('findOpenAPI', () => {
  // OpenAPI specs
  // 6. YAML files
  it('deve parsear openapi.yml')
  
  // 7. JSON files
  it('deve parsear openapi.json')
  
  // 8. Múltiplos paths
  it('deve extrair todos os endpoints de paths')
  
  // 9. Arquivo não existe
  it('deve retornar array vazio se spec não existir')
  
  // 10. Spec inválido
  it('deve lidar com spec malformado')
});
```

**Comando para criar:**
```bash
Crie testes unitários para src/detectors/express.ts com 10 casos de teste
cobrindo Express routes (GET, POST, PUT, DELETE, PATCH), Routers, middlewares,
OpenAPI YAML/JSON, múltiplos paths, e erros de parsing.
```

---

#### 3. `src/detectors/events.ts` - **6 testes unit**

**Por quê:** Detecta eventos assíncronos, regex patterns

**Casos de teste:**

```typescript
describe('findEvents', () => {
  // 1. Kafka producers
  it('deve detectar producer.send() com tópicos Kafka')
  
  // 2. Kafka consumers
  it('deve detectar consumer.subscribe() e consumer.run()')
  
  // 3. SQS queues
  it('deve detectar sqs.sendMessage() com queue URL')
  
  // 4. EventEmitter
  it('deve detectar emit() com event names')
  
  // 5. Diretório vazio
  it('deve retornar array vazio se não houver eventos')
  
  // 6. Múltiplos eventos
  it('deve consolidar todos os eventos encontrados')
});
```

**Comando para criar:**
```bash
Crie testes unitários para src/detectors/events.ts com 6 casos de teste
cobrindo Kafka (producer/consumer), SQS, EventEmitter, diretório vazio,
e múltiplos eventos.
```

---

#### 4. `src/detectors/tests.ts` - **7 testes unit**

**Por quê:** Detecta diferentes frameworks de teste

**Casos de teste:**

```typescript
describe('findTestFiles', () => {
  // 1. Vitest files
  it('deve detectar arquivos *.test.ts com vitest')
  
  // 2. Jest files
  it('deve detectar arquivos *.spec.ts com jest')
  
  // 3. Mocha files
  it('deve detectar arquivos *Test.ts com mocha')
  
  // 4. Playwright E2E
  it('deve detectar testes Playwright em tests/')
  
  // 5. Filtrar por layer (unit/integration/e2e)
  it('deve separar testes por camada corretamente')
  
  // 6. Contar describe/it blocks
  it('deve contar número de test cases por arquivo')
  
  // 7. Repositório sem testes
  it('deve retornar estrutura vazia se não houver testes')
});
```

**Comando para criar:**
```bash
Crie testes unitários para src/detectors/tests.ts com 7 casos de teste
cobrindo detecção de Vitest, Jest, Mocha, Playwright, filtragem por layer,
contagem de test cases, e repositório sem testes.
```

---

### 🟡 PRIORIDADE MÉDIA (criar depois)

#### 5. `src/utils/fs.ts` - **5 testes unit**

**Por quê:** Operações críticas de I/O, casos de erro

**Casos de teste:**

```typescript
describe('ensureDir', () => {
  // 1. Criar diretório novo
  it('deve criar diretório recursivamente')
  
  // 2. Diretório já existe
  it('não deve falhar se diretório já existir')
});

describe('writeFileSafe', () => {
  // 3. Escrever arquivo novo
  it('deve criar diretório pai e escrever arquivo')
  
  // 4. Sobrescrever arquivo
  it('deve sobrescrever arquivo existente')
});

describe('readFile', () => {
  // 5. Arquivo não existe
  it('deve lançar erro se arquivo não existir')
});
```

**Comando para criar:**
```bash
Crie testes unitários para src/utils/fs.ts com 5 casos de teste
cobrindo ensureDir (criar novo/já existe), writeFileSafe (novo/sobrescrever),
e readFile (arquivo não existe).
```

---

#### 6. `src/tools/analyze.ts` - **6 testes unit**

**Por quê:** Orquestra detectores, classifica riscos

**Casos de teste:**

```typescript
describe('analyze', () => {
  // 1. Repositório com rotas Next
  it('deve encontrar rotas Next.js e classificar como medium risk')
  
  // 2. Repositório com API Express
  it('deve encontrar endpoints Express e sugerir CDC')
  
  // 3. Repositório com eventos
  it('deve encontrar eventos e mapear riscos')
  
  // 4. Gerar recomendações
  it('deve gerar recomendações baseadas nos findings')
  
  // 5. Escrever analyze.json
  it('deve salvar resultado em tests/analyses/analyze.json')
  
  // 6. Repositório vazio
  it('deve lidar com repositório sem código')
});
```

**Comando para criar:**
```bash
Crie testes unitários para src/tools/analyze.ts com 6 casos de teste
cobrindo detecção de Next/Express/eventos, classificação de risco,
geração de recomendações, escrita de JSON, e repositório vazio.
```

---

#### 7. `src/tools/coverage.ts` - **5 testes unit**

**Por quê:** Cálculos matemáticos, detecção de pirâmide invertida

**Casos de teste:**

```typescript
describe('analyzeTestCoverage', () => {
  // 1. Calcular proporções corretamente
  it('deve calcular % de unit/integration/E2E corretamente')
  
  // 2. Detectar pirâmide saudável
  it('deve marcar como saudável se unit >= 70%')
  
  // 3. Detectar pirâmide invertida
  it('deve alertar se E2E > unit')
  
  // 4. Gerar recomendações
  it('deve sugerir mais unit tests se < 70%')
  
  // 5. Escrever relatório
  it('deve salvar COVERAGE-REPORT.md e coverage-analysis.json')
});
```

**Comando para criar:**
```bash
Crie testes unitários para src/tools/coverage.ts com 5 casos de teste
cobrindo cálculo de proporções, detecção de pirâmide saudável/invertida,
geração de recomendações, e escrita de relatórios.
```

---

#### 8. `src/tools/recommend-strategy.ts` - **6 testes unit**

**Por quê:** Lógica de detecção e recomendação adaptativa

**Casos de teste:**

```typescript
describe('detectAppCharacteristics', () => {
  // 1. Detectar CLI tool
  it('deve detectar isCLI=true se tem commander')
  
  // 2. Detectar MCP Server
  it('deve detectar isMCPServer=true se tem @modelcontextprotocol/sdk')
  
  // 3. Detectar Web UI
  it('deve detectar hasWebUI=true se tem react/next')
  
  // 4. Calcular complexidade
  it('deve calcular complexity baseado em features')
});

describe('recommendStrategy', () => {
  // 5. CLI Tool → 90/10/0
  it('deve recomendar 90% unit para CLI tools')
  
  // 6. Web App → 60/25/15
  it('deve recomendar 60/25/15 para web apps complexos')
});
```

**Comando para criar:**
```bash
Crie testes unitários para src/tools/recommend-strategy.ts com 6 casos de teste
cobrindo detecção de CLI/MCP/WebUI, cálculo de complexidade, e recomendações
adaptativas (90/10/0 para CLI, 60/25/15 para web apps).
```

---

### 🟢 PRIORIDADE BAIXA (se sobrar tempo)

#### 9. `src/tools/scaffold.ts` - **3 testes unit**

**Por quê:** Geração de código, mais fácil testar manualmente

```typescript
describe('scaffoldPlaywright', () => {
  // 1. Criar estrutura de pastas
  it('deve criar tests/auth, tests/claim, etc.')
  
  // 2. Gerar playwright.config.ts
  it('deve gerar config com reporters corretos')
  
  // 3. Gerar specs canônicos
  it('deve criar specs para login, claim, search')
});
```

---

## 🔗 Testes de Integração (6 testes)

### Por quê integration tests?

Apenas para **fluxos multi-tool** que dependem de múltiplos módulos trabalhando juntos.

---

### 1. `tests/integration/analyze-to-plan.test.ts` - **2 testes**

**Fluxo:** analyze → generatePlan

```typescript
describe('Fluxo: Análise → Plano', () => {
  // 1. Análise alimenta plano
  it('deve gerar plano baseado nos findings da análise', async () => {
    const analysis = await analyze({ repo: './fixtures/sample' });
    const plan = await generatePlan({ 
      repo: './fixtures/sample',
      product: 'Test',
      base_url: 'http://test.com'
    });
    
    // Verifica que rotas da análise estão no plano
    expect(plan.plan).toContain(analysis.findings.routes[0]);
  });
  
  // 2. Plano inclui recomendações
  it('deve incluir recomendações da análise no plano')
});
```

**Comando para criar:**
```bash
Crie teste de integração tests/integration/analyze-to-plan.test.ts
com 2 casos testando o fluxo de analyze() alimentando generatePlan()
e verificando que rotas/recomendações aparecem no plano gerado.
```

---

### 2. `tests/integration/coverage-to-recommendations.test.ts` - **2 testes**

**Fluxo:** analyzeTestCoverage → generatePyramidReport

```typescript
describe('Fluxo: Coverage → Recommendations', () => {
  // 1. Coverage gera recomendações
  it('deve gerar recomendações baseadas na cobertura atual', async () => {
    const coverage = await analyzeTestCoverage({ 
      repo: './fixtures/sample',
      product: 'Test'
    });
    
    expect(coverage.summary).toContain('Status:');
    expect(coverage.pyramid.unit.files_found).toBeGreaterThanOrEqual(0);
  });
  
  // 2. Pyramid report usa dados de coverage
  it('deve usar coverage analysis para gerar relatório visual')
});
```

**Comando para criar:**
```bash
Crie teste de integração tests/integration/coverage-to-recommendations.test.ts
com 2 casos testando o fluxo de analyzeTestCoverage() gerando dados que
alimentam generatePyramidReport() com recomendações visuais.
```

---

### 3. `tests/integration/recommend-to-scaffold.test.ts` - **2 testes**

**Fluxo:** recommendTestStrategy → scaffoldUnitTests

```typescript
describe('Fluxo: Recommend → Scaffold', () => {
  // 1. Recomendação sugere arquivos prioritários
  it('deve recomendar quais arquivos testar primeiro', async () => {
    const recommendation = await recommendTestStrategy({
      repo: './fixtures/sample',
      product: 'Test',
      auto_generate: true
    });
    
    expect(recommendation.recommendation.priorities).toBeDefined();
    expect(recommendation.recommendation.priorities.length).toBeGreaterThan(0);
  });
  
  // 2. Scaffold usa prioridades
  it('deve criar testes para arquivos de alta prioridade')
});
```

**Comando para criar:**
```bash
Crie teste de integração tests/integration/recommend-to-scaffold.test.ts
com 2 casos testando o fluxo de recommendTestStrategy() identificando
arquivos prioritários que alimentam scaffoldUnitTests().
```

---

## ⬜ Testes E2E (PULE!)

### Por quê NÃO fazer E2E?

❌ Quality MCP é uma **CLI tool + MCP server**  
❌ Não tem UI complexa que justifique E2E  
❌ Fácil de testar manualmente em 30 segundos  
❌ E2E seria **overkill** e caro de manter  

### Alternativa: Teste Manual Rápido

```bash
# "E2E" manual (30 segundos)
quality recommend --repo . --product "Test"
quality coverage --repo . --product "Test"
quality pyramid --repo . --product "Test"

# Se funcionou, está bom! ✅
```

---

## 📋 Resumo do Plano

### Total de Testes a Criar

| Prioridade | Arquivos | Unit Tests | Integration Tests | Total |
|------------|----------|------------|-------------------|-------|
| 🔴 ALTA    | 4 arquivos | 31 testes | - | 31 testes |
| 🟡 MÉDIA   | 4 arquivos | 22 testes | 6 testes | 28 testes |
| 🟢 BAIXA   | 1 arquivo  | 3 testes  | - | 3 testes |
| **TOTAL**  | **9 arquivos** | **56 testes** | **6 testes** | **62 testes** |

### Gap Atual

- ✅ Temos: 5 unit tests
- 🎯 Meta: 56 unit tests + 6 integration tests
- 📊 **Falta criar: 57 novos testes**

---

## 🚀 Plano de Execução (Ordem Recomendada)

### **Fase 1: Detectores (CRÍTICO)** - 2 dias

**Dia 1 - Manhã:**
```bash
# 1. next.ts (8 testes)
Crie testes unitários para src/detectors/next.ts...

# 2. express.ts (10 testes)
Crie testes unitários para src/detectors/express.ts...
```

**Dia 1 - Tarde:**
```bash
# 3. events.ts (6 testes)
Crie testes unitários para src/detectors/events.ts...

# 4. tests.ts (7 testes)
Crie testes unitários para src/detectors/tests.ts...
```

**Resultado Dia 1:** ✅ 31 testes (prioridade ALTA completa)

---

### **Fase 2: Utils e Tools (IMPORTANTE)** - 1,5 dias

**Dia 2 - Manhã:**
```bash
# 5. fs.ts (5 testes)
Crie testes unitários para src/utils/fs.ts...

# 6. analyze.ts (6 testes)
Crie testes unitários para src/tools/analyze.ts...
```

**Dia 2 - Tarde:**
```bash
# 7. coverage.ts (5 testes)
Crie testes unitários para src/tools/coverage.ts...

# 8. recommend-strategy.ts (6 testes)
Crie testes unitários para src/tools/recommend-strategy.ts...
```

**Resultado Dia 2:** ✅ +22 testes (prioridade MÉDIA completa)

---

### **Fase 3: Integration (SE TIVER TEMPO)** - meio dia

**Dia 3 - Manhã:**
```bash
# Integration tests (6 testes)
Crie teste de integração tests/integration/analyze-to-plan.test.ts...
Crie teste de integração tests/integration/coverage-to-recommendations.test.ts...
Crie teste de integração tests/integration/recommend-to-scaffold.test.ts...
```

**Resultado Dia 3:** ✅ +6 testes integration

---

### **Fase 4: Scaffold (OPCIONAL)** - 1 hora

```bash
# 9. scaffold.ts (3 testes) - apenas se sobrar tempo
Crie testes unitários para src/tools/scaffold.ts...
```

---

## ✅ Critérios de Aceitação

Após completar o plano, você deve ter:

- ✅ **56 testes unitários** (meta: 50-60)
- ✅ **6 testes de integração** (meta: 5-10)
- ✅ **70%+ de cobertura** de código
- ✅ **Detectores 100% testados** (crítico)
- ✅ **Pirâmide saudável** (90% unit, 10% integration, 0% E2E)

**Verificar:**
```bash
npm test
npm run test:coverage

# Cobertura esperada:
# - src/detectors/*.ts: 90%+
# - src/utils/fs.ts: 80%+
# - src/tools/*.ts: 60%+
# - Overall: 70%+
```

---

## 💡 Comandos Prontos para o Cursor

### Copie e cole esses comandos EXATAMENTE como estão:

#### **🔴 Prioridade ALTA (faça AGORA)**

```
Crie testes unitários para src/detectors/next.ts com 8 casos de teste cobrindo rotas app/, pages/, dinâmicas, catch-all, route groups, API routes, erro de diretório e múltiplas rotas.
```

```
Crie testes unitários para src/detectors/express.ts com 10 casos de teste cobrindo Express routes (GET, POST, PUT, DELETE, PATCH), Routers, middlewares, OpenAPI YAML/JSON, múltiplos paths, e erros de parsing.
```

```
Crie testes unitários para src/detectors/events.ts com 6 casos de teste cobrindo Kafka (producer/consumer), SQS, EventEmitter, diretório vazio, e múltiplos eventos.
```

```
Crie testes unitários para src/detectors/tests.ts com 7 casos de teste cobrindo detecção de Vitest, Jest, Mocha, Playwright, filtragem por layer, contagem de test cases, e repositório sem testes.
```

#### **🟡 Prioridade MÉDIA (faça depois)**

```
Crie testes unitários para src/utils/fs.ts com 5 casos de teste cobrindo ensureDir (criar novo/já existe), writeFileSafe (novo/sobrescrever), e readFile (arquivo não existe).
```

```
Crie testes unitários para src/tools/analyze.ts com 6 casos de teste cobrindo detecção de Next/Express/eventos, classificação de risco, geração de recomendações, escrita de JSON, e repositório vazio.
```

```
Crie testes unitários para src/tools/coverage.ts com 5 casos de teste cobrindo cálculo de proporções, detecção de pirâmide saudável/invertida, geração de recomendações, e escrita de relatórios.
```

```
Crie testes unitários para src/tools/recommend-strategy.ts com 6 casos de teste cobrindo detecção de CLI/MCP/WebUI, cálculo de complexidade, e recomendações adaptativas (90/10/0 para CLI, 60/25/15 para web apps).
```

#### **🔗 Testes de Integração**

```
Crie teste de integração tests/integration/analyze-to-plan.test.ts com 2 casos testando o fluxo de analyze() alimentando generatePlan() e verificando que rotas/recomendações aparecem no plano gerado.
```

```
Crie teste de integração tests/integration/coverage-to-recommendations.test.ts com 2 casos testando o fluxo de analyzeTestCoverage() gerando dados que alimentam generatePyramidReport() com recomendações visuais.
```

```
Crie teste de integração tests/integration/recommend-to-scaffold.test.ts com 2 casos testando o fluxo de recommendTestStrategy() identificando arquivos prioritários que alimentam scaffoldUnitTests().
```

---

## 🎯 Checklist de Progresso

Use para acompanhar o progresso:

### Unit Tests (56 testes)

- [ ] src/detectors/next.ts (8 testes) 🔴
- [ ] src/detectors/express.ts (10 testes) 🔴
- [ ] src/detectors/events.ts (6 testes) 🔴
- [ ] src/detectors/tests.ts (7 testes) 🔴
- [ ] src/utils/fs.ts (5 testes) 🟡
- [ ] src/tools/analyze.ts (6 testes) 🟡
- [ ] src/tools/coverage.ts (5 testes) 🟡
- [ ] src/tools/recommend-strategy.ts (6 testes) 🟡
- [ ] src/tools/scaffold.ts (3 testes) 🟢

### Integration Tests (6 testes)

- [ ] tests/integration/analyze-to-plan.test.ts (2 testes)
- [ ] tests/integration/coverage-to-recommendations.test.ts (2 testes)
- [ ] tests/integration/recommend-to-scaffold.test.ts (2 testes)

### Verificação Final

- [ ] `npm test` passa com sucesso
- [ ] `npm run test:coverage` mostra 70%+
- [ ] Detectores têm 90%+ cobertura
- [ ] Pirâmide está saudável (90/10/0)

---

**Gerado por:** Quality MCP v0.2.0  
**Baseado em:** recommend_test_strategy + análise de arquivos  
**Tempo estimado:** 2,5 dias (com foco)  
**Próximo passo:** Começar pelos comandos de prioridade ALTA! 🚀

