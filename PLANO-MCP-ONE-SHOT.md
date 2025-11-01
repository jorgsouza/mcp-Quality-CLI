# 🧠⚡️ Plano de Implementação: MCP "One-Shot" com Linguagem Natural

**Data:** 2025-11-01  
**Versão:** 0.3.0  
**Status:** 📋 PLANEJAMENTO

---

## 🎯 Objetivos

### Objetivo Principal
Criar um MCP inteligente que entende comandos em **linguagem natural (PT/EN)** e executa todo o ciclo de qualidade automaticamente:
- **Input:** "analise meu repositório" (ou variações)
- **Output:** Análise completa + Estratégia + Plano + Scaffolds + Testes + Cobertura + Relatório

### Características-Chave
1. ✅ **Zero-setup:** Detecta repo e produto automaticamente
2. ✅ **Agnóstico:** Funciona para qualquer time/produto (não específico do ReclameAQUI)
3. ✅ **Inteligente:** Entende linguagem natural em PT/EN
4. ✅ **Completo:** Orquestra todas as ferramentas existentes
5. ✅ **Flexível:** Suporta modos parciais (analyze/plan/scaffold/run)

---

## 📦 Estrutura da Implementação

### Fase 1: Configuração Agnóstica (2-3 horas)
**Objetivo:** Tornar o sistema genérico e reutilizável

#### 1.1. Atualizar `src/utils/config.ts`
**Status:** 🔨 A FAZER

**Mudanças:**
```typescript
// ANTES (específico):
domains: ['auth', 'search', 'claim', 'profile']
critical_flows: ['login', 'buscar_empresa', 'abrir_reclamacao']
base_url: 'https://www.reclameaqui.com.br'

// DEPOIS (genérico):
domains: []                    // vazio → analyze sugere depois
critical_flows: []             // vazio → analyze sugere depois
base_url: 'http://localhost:3000'  // padrão universal
```

**Tarefas:**
- [x] Criar interface `MCPSettings` genérica
- [ ] Atualizar `loadMCPSettings()` para fallbacks seguros
- [ ] Atualizar `createMCPSettingsTemplate()` com defaults neutros
- [ ] Gerar `mcp-settings.example.json` automaticamente
- [ ] Adicionar função `inferProductFromPackageJson()`
- [ ] Adicionar validação de esquema JSON

**Arquivo:** `src/utils/config.ts`

**Testes a criar:**
- [ ] `config.test.ts` → validar defaults genéricos
- [ ] `config.test.ts` → validar inferência de produto
- [ ] `config.test.ts` → validar geração de exemplo

---

### Fase 2: Orquestrador Auto (3-4 horas)
**Objetivo:** Criar o cérebro que coordena todo o fluxo

#### 2.1. Criar `src/tools/auto.ts`
**Status:** 🔨 A FAZER

**Funções principais:**

##### `detectRepo(explicit?: string): Promise<string>`
- Detecta repositório automaticamente:
  1. Parâmetro explícito (`explicit`)
  2. `process.cwd()`
  3. Busca ascendente por `.git` ou `package.json`
- Retorna path do repo ou CWD como fallback

##### `autoQualityRun(input: AutoParams): Promise<AutoResult>`
- Orquestra todo o fluxo baseado no `mode`:
  - **`full`**: Tudo (init → analyze → plan → scaffold → run → coverage → diff → report)
  - **`analyze`**: Apenas análise + estratégia + pyramid
  - **`plan`**: Análise + plano
  - **`scaffold`**: Análise + plano + scaffolds (unit/integration/e2e)
  - **`run`**: Análise + scaffolds + execução + cobertura

**Fluxo de execução:**
```typescript
1. detectRepo() → encontra repo
2. loadMCPSettings() → carrega ou cria config
3. inferProductFromPackageJson() → descobre produto
4. ensureDir(qa/<product>/tests/analyses) → cria estrutura

MODO FULL:
5. analyze() → detecta endpoints/eventos/testes
6. recommendTestStrategy() → sugere estratégia (unit/int/e2e %)
7. generatePyramidReport() → visualiza pirâmide atual
8. generatePlan() → cria TEST-PLAN.md
9. scaffoldUnitTests() → gera templates de unit
10. scaffoldIntegrationTests() → gera templates de integration
11. scaffoldPlaywright() → gera templates de e2e
12. runPlaywright() → executa e2e
13. analyzeTestCoverage() → calcula pirâmide
14. runDiffCoverage() → calcula diff com base_branch
15. buildReport() → gera SUMMARY.md executivo
```

**Tarefas:**
- [ ] Implementar `detectRepo()` com busca ascendente
- [ ] Implementar `autoQualityRun()` com orquestração
- [ ] Criar lógica de `mode` (full/analyze/plan/scaffold/run)
- [ ] Adicionar error handling robusto
- [ ] Adicionar logging detalhado de cada etapa
- [ ] Criar progress tracking (1/15, 2/15, etc.)

**Arquivo:** `src/tools/auto.ts`

**Testes a criar:**
- [ ] `auto.test.ts` → detectRepo em diferentes cenários
- [ ] `auto.test.ts` → modo `full` completo
- [ ] `auto.test.ts` → modo `analyze` parcial
- [ ] `auto.test.ts` → modo `plan` parcial
- [ ] `auto.test.ts` → modo `scaffold` parcial
- [ ] `auto.test.ts` → modo `run` parcial
- [ ] `auto.test.ts` → tratamento de erros
- [ ] `auto.test.ts` → artifacts gerados corretamente

---

### Fase 3: Atalho de Linguagem Natural (2-3 horas)
**Objetivo:** Permitir comandos em PT/EN sem JSON

#### 3.1. Criar `src/tools/nl-command.ts`
**Status:** 🔨 A FAZER

**Funções principais:**

##### `decideMode(query: string): AutoParams['mode']`
- Analisa texto e decide o modo:
  - **FULL:** "analise", "auditar", "rodar tudo", "run all", "end to end"
  - **ANALYZE:** "only analyze", "apenas analisar", "scan", "mapear"
  - **PLAN:** "criar plano", "gerar plano", "plan", "strategy"
  - **SCAFFOLD:** "scaffold", "gerar templates", "unit", "integration"
  - **RUN:** "executar", "rodar testes", "run tests", "coverage"

##### `extractOverrides(query: string): Partial<AutoParams>`
- Extrai parâmetros do texto:
  - `repo:/path/to/repo` → `{ repo: '/path/to/repo' }`
  - `product:MyProduct` → `{ product: 'MyProduct' }`
  - `base_url:http://localhost:3000` → `{ base_url: '...' }`
  - `base_branch:develop` → `{ base_branch: 'develop' }`

##### `nlCommand(params: NLParams): Promise<NLResult>`
- Orquestra: detecta intenção + extrai overrides + chama `autoQualityRun()`

**Exemplos de uso:**

```typescript
// Exemplo 1: Comando simples
nlCommand({ query: "analise meu repositório" })
→ { mode: 'full', repo: auto-detectado, product: auto-detectado }

// Exemplo 2: Com overrides
nlCommand({ 
  query: "criar plano de testes repo:/home/user/app product:Portal" 
})
→ { mode: 'plan', repo: '/home/user/app', product: 'Portal' }

// Exemplo 3: Apenas cobertura
nlCommand({ query: "rodar testes e calcular cobertura" })
→ { mode: 'run', ... }

// Exemplo 4: Com defaults globais
nlCommand({ 
  query: "analise meu repositório",
  defaults: { base_branch: "main" }
})
→ { mode: 'full', base_branch: 'main', ... }
```

**Tarefas:**
- [ ] Implementar `decideMode()` com regex PT/EN
- [ ] Implementar `extractOverrides()` para repo/product/base_url/base_branch
- [ ] Implementar `nlCommand()` orquestrando tudo
- [ ] Adicionar suporte a sinônimos comuns
- [ ] Adicionar logging de intenção detectada
- [ ] Criar mensagem de ajuda para comandos não reconhecidos

**Arquivo:** `src/tools/nl-command.ts`

**Testes a criar:**
- [ ] `nl-command.test.ts` → detectar FULL em PT
- [ ] `nl-command.test.ts` → detectar FULL em EN
- [ ] `nl-command.test.ts` → detectar ANALYZE
- [ ] `nl-command.test.ts` → detectar PLAN
- [ ] `nl-command.test.ts` → detectar SCAFFOLD
- [ ] `nl-command.test.ts` → detectar RUN
- [ ] `nl-command.test.ts` → extrair overrides de repo
- [ ] `nl-command.test.ts` → extrair overrides de product
- [ ] `nl-command.test.ts` → extrair overrides múltiplos
- [ ] `nl-command.test.ts` → merge com defaults

---

### Fase 4: Integração com Servidor MCP (1-2 horas)
**Objetivo:** Registrar as novas tools no protocolo MCP

#### 4.1. Atualizar `src/server.ts`
**Status:** 🔨 A FAZER

**Mudanças:**

##### Adicionar imports
```typescript
import { autoQualityRun, type AutoParams } from './tools/auto.js';
import { nlCommand, type NLParams } from './tools/nl-command.js';
```

##### Registrar tool `nl_command` (prioridade 1)
```typescript
{
  name: 'nl_command',
  description: 'Atalho semântico em linguagem natural (PT/EN). Entende frases como "analise meu repositório" e aciona o fluxo auto.',
  inputSchema: {
    type: 'object',
    properties: {
      query: { 
        type: 'string', 
        description: 'Texto livre. Ex: "analise meu repositório", "criar plano", "rodar testes"' 
      },
      defaults: {
        type: 'object',
        properties: {
          repo: { type: 'string' },
          product: { type: 'string' },
          base_url: { type: 'string' },
          mode: { type: 'string', enum: ['full','analyze','plan','scaffold','run'] },
          base_branch: { type: 'string' }
        }
      }
    },
    required: ['query']
  }
}
```

##### Registrar tool `auto` (prioridade 2)
```typescript
{
  name: 'auto',
  description: 'Executa o fluxo completo automaticamente: init → analyze → strategy → plan → scaffold → run → coverage → diff → report.',
  inputSchema: {
    type: 'object',
    properties: {
      repo: { type: 'string', description: 'Caminho do repositório (auto-detecta se omitido)' },
      product: { type: 'string', description: 'Nome do produto (infere de package.json se omitido)' },
      base_url: { type: 'string', description: 'Base URL para E2E (default: http://localhost:3000)' },
      mode: { 
        type: 'string', 
        enum: ['full','analyze','plan','scaffold','run'], 
        description: 'Subconjunto de etapas a executar (default: full)' 
      },
      base_branch: { type: 'string', description: 'Branch base para diff-coverage (default: main)' }
    }
  }
}
```

##### Adicionar handlers
```typescript
case 'nl_command': {
  const args = (request.params.arguments as NLParams);
  const out = await nlCommand(args);
  return {
    content: [{ type: 'text', text: JSON.stringify(out, null, 2) }]
  };
}

case 'auto': {
  const params = (request.params.arguments as AutoParams) ?? {};
  const result = await autoQualityRun(params);
  return {
    content: [{ type: 'text', text: JSON.stringify(result, null, 2) }]
  };
}
```

**Tarefas:**
- [ ] Adicionar imports de `auto` e `nl-command`
- [ ] Registrar tool `nl_command` no ListToolsRequestSchema
- [ ] Registrar tool `auto` no ListToolsRequestSchema
- [ ] Adicionar handler para `nl_command`
- [ ] Adicionar handler para `auto`
- [ ] Atualizar tipos TypeScript
- [ ] Validar schemas Zod

**Arquivo:** `src/server.ts`

**Testes a criar:**
- [ ] `server.integration.test.ts` → tool `nl_command` disponível
- [ ] `server.integration.test.ts` → tool `auto` disponível
- [ ] `server.integration.test.ts` → nl_command executa FULL
- [ ] `server.integration.test.ts` → auto executa com mode=analyze
- [ ] `server.integration.test.ts` → validação de schemas

---

### Fase 5: Testes E2E Completos (3-4 horas)
**Objetivo:** Garantir que o fluxo completo funciona end-to-end

#### 5.1. Criar `tests/e2e/nl-command-flow.spec.ts`
**Status:** 🔨 A FAZER

**Cenários de teste:**

1. **NL Command: Texto simples em PT**
   ```typescript
   nlCommand({ query: "analise meu repositório" })
   → verifica mode='full'
   → verifica artifacts gerados
   ```

2. **NL Command: Texto com overrides**
   ```typescript
   nlCommand({ 
     query: "criar plano repo:/tmp/test product:TestApp" 
   })
   → verifica mode='plan'
   → verifica repo extraído
   → verifica product extraído
   ```

3. **NL Command: Apenas cobertura**
   ```typescript
   nlCommand({ query: "rodar testes e calcular cobertura" })
   → verifica mode='run'
   → verifica coverage-analysis.json
   → verifica diff-coverage.json
   ```

4. **NL Command: Com defaults**
   ```typescript
   nlCommand({ 
     query: "analise meu repositório",
     defaults: { base_branch: "develop" }
   })
   → verifica base_branch usado
   ```

**Arquivo:** `tests/e2e/nl-command-flow.spec.ts`

**Testes a criar:**
- [ ] Comando PT simples → FULL
- [ ] Comando EN simples → FULL
- [ ] Comando com repo override
- [ ] Comando com product override
- [ ] Comando com base_url override
- [ ] Comando com base_branch override
- [ ] Comando com múltiplos overrides
- [ ] Comando ANALYZE only
- [ ] Comando PLAN only
- [ ] Comando SCAFFOLD only
- [ ] Comando RUN only
- [ ] Defaults globais aplicados
- [ ] Erro em comando não reconhecido

---

#### 5.2. Criar `tests/e2e/auto-full-cycle.spec.ts`
**Status:** 🔨 A FAZER

**Cenários de teste:**

1. **Auto FULL: Zero-setup em repo novo**
   ```typescript
   autoQualityRun({ mode: 'full' })
   → detecta repo
   → cria mcp-settings.json
   → gera todos os artifacts
   ```

2. **Auto FULL: Com mcp-settings.json existente**
   ```typescript
   autoQualityRun({ mode: 'full', repo: '/path', product: 'Existing' })
   → usa config existente
   → atualiza artifacts
   ```

3. **Auto ANALYZE: Modo parcial**
   ```typescript
   autoQualityRun({ mode: 'analyze' })
   → gera analyze.json
   → gera pyramid-report
   → NÃO gera scaffolds
   ```

4. **Auto RUN: Com diff-coverage**
   ```typescript
   autoQualityRun({ mode: 'run', base_branch: 'main' })
   → executa testes
   → calcula coverage
   → calcula diff vs main
   → gera SUMMARY.md
   ```

**Arquivo:** `tests/e2e/auto-full-cycle.spec.ts`

**Testes a criar:**
- [ ] FULL em repo vazio
- [ ] FULL em repo com package.json
- [ ] FULL em repo com mcp-settings existente
- [ ] ANALYZE mode
- [ ] PLAN mode
- [ ] SCAFFOLD mode
- [ ] RUN mode
- [ ] Detecção automática de repo
- [ ] Inferência de produto do package.json
- [ ] Criação de estrutura qa/<product>/
- [ ] Geração de todos os artifacts
- [ ] Diff-coverage com base_branch
- [ ] Error handling em repo inválido

---

### Fase 6: Documentação (2-3 horas)
**Objetivo:** Documentar para qualquer time/produto usar

#### 6.1. Atualizar `README.md`
**Status:** 🔨 A FAZER

**Seções a adicionar:**

##### Quickstart
```markdown
# Quickstart (Zero-Setup)

1. No diretório do seu projeto, execute:
   ```bash
   # Via MCP tool
   nl_command { "query": "analise meu repositório" }
   ```

2. O MCP automaticamente:
   - Detecta o repositório (busca por .git ou package.json)
   - Infere o produto do package.json (ou usa nome da pasta)
   - Cria `qa/<product>/mcp-settings.json` (se não existir)
   - Executa o fluxo FULL:
     - Analisa código (endpoints, eventos, testes existentes)
     - Recomenda estratégia (% unit/integration/e2e)
     - Gera plano de testes
     - Cria scaffolds (unit, integration, e2e)
     - Executa testes
     - Calcula cobertura (total + diff)
     - Gera relatório executivo

3. Artifacts gerados em `qa/<product>/tests/analyses/`:
   - `analyze.json` - Mapeamento do código
   - `pyramid-report.json` - Visualização da pirâmide
   - `TEST-PLAN.md` - Plano de testes
   - `coverage-analysis.json` - Cobertura atual
   - `diff-coverage.json` - Cobertura do diff
   - `SUMMARY.md` - Resumo executivo
```

##### Comandos em Linguagem Natural
```markdown
## Comandos Naturais (PT/EN)

### Análise Completa
```
"analise meu repositório"
"auditar o projeto"
"run all"
"end to end"
```

### Apenas Análise
```
"apenas analisar o código"
"scan do repositório"
"mapear endpoints"
```

### Criar Plano
```
"criar plano de testes"
"gerar estratégia de testes"
```

### Gerar Templates
```
"scaffold de testes"
"gerar templates de unit tests"
```

### Executar e Cobrir
```
"rodar testes e calcular cobertura"
"executar testes"
"validar cobertura"
```

### Com Overrides
```
"analise o projeto repo:/home/user/app product:Portal base_url:http://localhost:3000"
```
```

##### Modos de Operação
```markdown
## Modos de Operação

### `full` (padrão)
Executa tudo: init → analyze → strategy → plan → scaffold → run → coverage → diff → report

### `analyze`
Apenas: analyze → strategy → pyramid report

### `plan`
Até: analyze → strategy → plan

### `scaffold`
Até: analyze → strategy → plan → scaffolds (unit/integration/e2e)

### `run`
Completo mas focado em execução: scaffolds → run → coverage → diff → report
```

**Tarefas:**
- [ ] Adicionar seção Quickstart
- [ ] Adicionar seção Comandos Naturais
- [ ] Adicionar seção Modos de Operação
- [ ] Adicionar exemplos de uso
- [ ] Adicionar troubleshooting
- [ ] Adicionar FAQ

---

#### 6.2. Criar `docs/NL-COMMAND-GUIDE.md`
**Status:** 🔨 A FAZER

**Conteúdo:**
- Guia completo de comandos em linguagem natural
- Padrões reconhecidos (PT/EN)
- Extração de overrides
- Exemplos avançados
- Casos de uso por persona (DEV/QA/LEAD)

**Tarefas:**
- [ ] Documentar padrões PT
- [ ] Documentar padrões EN
- [ ] Listar todos os overrides suportados
- [ ] Criar exemplos por persona
- [ ] Adicionar troubleshooting de NLP

---

#### 6.3. Criar `docs/AUTO-MODE-GUIDE.md`
**Status:** 🔨 A FAZER

**Conteúdo:**
- Detalhamento de cada modo (full/analyze/plan/scaffold/run)
- Fluxo de decisão
- Quando usar cada modo
- Artifacts gerados por modo
- Performance e otimizações

**Tarefas:**
- [ ] Documentar modo FULL
- [ ] Documentar modo ANALYZE
- [ ] Documentar modo PLAN
- [ ] Documentar modo SCAFFOLD
- [ ] Documentar modo RUN
- [ ] Criar diagrama de fluxo
- [ ] Adicionar tabela de artifacts por modo

---

#### 6.4. Atualizar `CHANGELOG.md`
**Status:** 🔨 A FAZER

**Seção v0.3.0:**
```markdown
## [0.3.0] - 2025-11-XX

### 🎉 Major Features

#### MCP "One-Shot" com Linguagem Natural
- **Tool `nl_command`**: Comandos em PT/EN (ex: "analise meu repositório")
- **Tool `auto`**: Orquestrador completo com 5 modos (full/analyze/plan/scaffold/run)
- **Zero-setup**: Detecta repo e produto automaticamente
- **Agnóstico**: Funciona para qualquer time/produto

### ✨ New Features
- Auto-detecção de repositório (busca ascendente por .git/package.json)
- Inferência de produto do package.json
- Configuração genérica (localhost, listas vazias, defaults universais)
- Extração de overrides do texto (repo:, product:, base_url:, base_branch:)
- Modos parciais (analyze/plan/scaffold/run)
- Progress tracking em tempo real
- SUMMARY.md executivo automático

### 🔧 Improvements
- Config agnóstica (não mais específica do RA)
- Geração automática de mcp-settings.example.json
- Fallbacks inteligentes para todos os parâmetros
- Error handling robusto em cada etapa
- Logging detalhado de intenções e overrides

### 📚 Documentation
- Quickstart zero-setup
- Guia de comandos naturais (NL-COMMAND-GUIDE.md)
- Guia de modos auto (AUTO-MODE-GUIDE.md)
- Exemplos por persona (DEV/QA/LEAD)

### 🧪 Tests
- 13 novos testes E2E (nl-command-flow + auto-full-cycle)
- 10 novos testes unitários (auto.test.ts)
- 10 novos testes unitários (nl-command.test.ts)
- 3 novos testes de integração (server + nl_command + auto)

### 📊 Metrics
- Total de testes: 268 (de 232)
- Cobertura de código: Mantida em 100%
- Novas tools MCP: 2 (nl_command, auto)
```

**Tarefas:**
- [ ] Criar seção v0.3.0
- [ ] Documentar breaking changes (se houver)
- [ ] Listar todas as features
- [ ] Adicionar exemplos de migração

---

## 📊 Resumo de Entregáveis

### Código Novo
- [ ] `src/tools/auto.ts` (300-400 linhas)
- [ ] `src/tools/nl-command.ts` (150-200 linhas)
- [ ] `src/utils/config.ts` (atualização: +100 linhas)
- [ ] `src/server.ts` (atualização: +50 linhas)

### Testes Novos
- [ ] `src/tools/__tests__/auto.test.ts` (10 testes)
- [ ] `src/tools/__tests__/nl-command.test.ts` (10 testes)
- [ ] `src/utils/__tests__/config.test.ts` (atualização: +3 testes)
- [ ] `src/__tests__/server.integration.test.ts` (atualização: +3 testes)
- [ ] `tests/e2e/nl-command-flow.spec.ts` (13 testes)
- [ ] `tests/e2e/auto-full-cycle.spec.ts` (13 testes)

### Documentação Nova
- [ ] `README.md` (atualização: +200 linhas)
- [ ] `docs/NL-COMMAND-GUIDE.md` (novo: ~150 linhas)
- [ ] `docs/AUTO-MODE-GUIDE.md` (novo: ~200 linhas)
- [ ] `CHANGELOG.md` (atualização: v0.3.0)

---

## 🎯 Critérios de Sucesso

### Funcional
- [x] ✅ Usuário digita "analise meu repositório" → MCP executa tudo
- [ ] ✅ Detecção automática funciona em 100% dos casos testados
- [ ] ✅ Inferência de produto do package.json funciona
- [ ] ✅ Config genérica funciona para qualquer projeto
- [ ] ✅ Todos os 5 modos funcionam corretamente
- [ ] ✅ Extração de overrides funciona em PT/EN

### Qualidade
- [ ] ✅ 100% dos testes passando (268/268)
- [ ] ✅ Cobertura de código mantida em 100%
- [ ] ✅ Zero bugs conhecidos
- [ ] ✅ Error handling robusto
- [ ] ✅ Logging completo e útil

### Usabilidade
- [ ] ✅ Zero-setup real (funciona sem configuração)
- [ ] ✅ Comandos naturais intuitivos
- [ ] ✅ Documentação clara e completa
- [ ] ✅ Mensagens de erro úteis
- [ ] ✅ Progress tracking visível

---

## 📅 Cronograma Estimado

### Sprint 1 (Semana 1)
**Dias 1-2:** Fase 1 - Configuração Agnóstica
- Atualizar `config.ts`
- Criar testes de config
- Validar defaults genéricos

**Dias 3-4:** Fase 2 - Orquestrador Auto
- Implementar `auto.ts`
- Criar `detectRepo()`
- Criar `autoQualityRun()`
- Criar testes de auto

**Dia 5:** Fase 3 - NL Command (parte 1)
- Implementar `nl-command.ts`
- Criar `decideMode()`

### Sprint 2 (Semana 2)
**Dias 1-2:** Fase 3 - NL Command (parte 2)
- Implementar `extractOverrides()`
- Implementar `nlCommand()`
- Criar testes de nl-command

**Dia 3:** Fase 4 - Integração MCP
- Atualizar `server.ts`
- Registrar tools
- Criar handlers
- Testes de integração

**Dias 4-5:** Fase 5 - Testes E2E
- Criar `nl-command-flow.spec.ts`
- Criar `auto-full-cycle.spec.ts`
- Validar todos os cenários

### Sprint 3 (Semana 3)
**Dias 1-3:** Fase 6 - Documentação
- Atualizar README
- Criar NL-COMMAND-GUIDE
- Criar AUTO-MODE-GUIDE
- Atualizar CHANGELOG

**Dias 4-5:** Refinamento e QA
- Bug fixes
- Ajustes de UX
- Validação final
- Release v0.3.0

---

## 🚀 Exemplos de Uso Real

### Exemplo 1: DEV - Setup Inicial
```bash
# Dev clona repo novo
git clone https://github.com/company/new-project
cd new-project

# Pede ao MCP
nl_command { "query": "analise meu repositório e configure tudo" }

# MCP faz:
1. Detecta repo: /home/dev/new-project
2. Infere produto: new-project (do package.json)
3. Cria qa/new-project/mcp-settings.json
4. Analisa código
5. Recomenda 70% unit, 20% integration, 10% e2e
6. Gera plano de testes
7. Cria scaffolds em tests/unit, tests/integration, tests/e2e
8. Executa testes scaffolds
9. Calcula cobertura: 0% → precisa implementar
10. Gera SUMMARY.md com próximos passos
```

### Exemplo 2: QA - Validação de PR
```bash
# QA está revisando PR #123
git checkout feature/new-feature

# Pede ao MCP
nl_command { 
  "query": "rodar testes e calcular diff coverage base_branch:main" 
}

# MCP faz:
1. Detecta repo atual
2. Executa testes (unit + integration + e2e)
3. Calcula cobertura total
4. Calcula diff-coverage vs main
5. Gera relatório:
   - Coverage total: 75%
   - Coverage do diff: 85% ✅ (>80%)
   - Novos arquivos sem testes: 2 ⚠️
   - Sugestões de testes faltantes
```

### Exemplo 3: LEAD - Análise de Produto
```bash
# Lead quer visão geral do produto
nl_command { 
  "query": "gerar relatório completo do produto repo:/workspace/reclameaqui product:ReclameAQUI" 
}

# MCP faz:
1. Usa repo e produto especificados
2. Analisa toda a base de código
3. Gera pyramid report visual
4. Calcula health da pirâmide: INVERTIDA ❌
   - Unit: 30% (deveria ser 70%)
   - Integration: 10% (deveria ser 20%)
   - E2E: 60% (deveria ser 10%)
5. Recomenda ações:
   - Criar 150 testes unitários
   - Criar 30 testes de integração
   - Reduzir 100 testes E2E
6. Gera SUMMARY.md executivo para apresentar
```

### Exemplo 4: CI/CD Pipeline
```yaml
# .github/workflows/quality-gate.yml
name: Quality Gate

on: [pull_request]

jobs:
  quality:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      
      - name: Run MCP Quality Check
        run: |
          npx quality-mcp nl_command '{
            "query": "rodar testes e validar diff coverage base_branch:main",
            "defaults": { "base_branch": "${{ github.base_ref }}" }
          }'
      
      - name: Check Quality Gate
        run: |
          DIFF_COVERAGE=$(jq '.result.artifacts.diff_coverage' qa/*/tests/analyses/diff-coverage.json)
          if [ "$DIFF_COVERAGE" -lt "80" ]; then
            echo "❌ Diff coverage below 80%"
            exit 1
          fi
```

---

## 💡 Decisões de Design

### 1. Por que Linguagem Natural?
- **Problema:** JSON verboso e intimidador para não-devs
- **Solução:** Comandos naturais em PT/EN
- **Benefício:** QA e PMs podem usar sem saber JSON

### 2. Por que Detecção Automática?
- **Problema:** Usuários não sabem qual repo/produto passar
- **Solução:** Detecta automaticamente do CWD/package.json
- **Benefício:** Zero-setup real, funciona em 95% dos casos

### 3. Por que 5 Modos?
- **Problema:** "Full" é pesado, nem sempre é necessário
- **Solução:** Modos parciais (analyze/plan/scaffold/run)
- **Benefício:** Performance e flexibilidade

### 4. Por que Config Agnóstica?
- **Problema:** Config específica do RA não serve outros times
- **Solução:** Defaults genéricos, listas vazias, localhost
- **Benefício:** Qualquer time/produto pode usar

### 5. Por que Overrides no Texto?
- **Problema:** Às vezes precisa override rápido
- **Solução:** `repo:/path product:Name` no próprio texto
- **Benefício:** Conveniência sem mudar interface

---

## 🎓 Convenções para Times

### DEV
- **Responsabilidade:** `tests/unit` e `tests/integration` do seu domínio
- **Workflow:**
  1. Cria feature
  2. Pede: "scaffold unit tests para meu módulo"
  3. Implementa testes
  4. Pede: "rodar testes e coverage"
  5. Valida 70%+ antes de PR

### QA
- **Responsabilidade:** `tests/e2e` (fluxos core) e apoio na base
- **Workflow:**
  1. Analisa requisito
  2. Pede: "criar plano de testes para login"
  3. Implementa E2E
  4. Pede: "rodar e2e e validar fluxos críticos"
  5. Valida no diff-coverage

### LEAD
- **Responsabilidade:** Estratégia, qualidade, gates
- **Workflow:**
  1. Sprint planning
  2. Pede: "analise o produto e recomende estratégia"
  3. Revisa pyramid report
  4. Define metas no `mcp-settings.json`
  5. Monitora health ao longo do sprint

---

## 📌 Próximos Passos

1. ✅ **Revisar este plano** com o time
2. ⏳ **Aprovar o escopo** da v0.3.0
3. ⏳ **Iniciar Fase 1** (Config Agnóstica)
4. ⏳ **Executar Sprint 1** conforme cronograma
5. ⏳ **Review semanal** de progresso
6. ⏳ **Release v0.3.0** em 3 semanas

---

**Criado em:** 2025-11-01  
**Autor:** GitHub Copilot + Jorge Souza  
**Status:** 📋 AGUARDANDO APROVAÇÃO  
**Próxima Revisão:** 2025-11-04
