# Quality MCP 🎯

**Quality CLI** é um servidor MCP (Model Context Protocol) que automatiza a análise de repositórios e a geração de testes E2E com Playwright. Ele funciona como um **assistente inteligente de qualidade** que analisa seu código, detecta padrões, gera planos de teste e cria estruturas completas de automação.

## 🎬 Como Funciona na Prática

Imagine que você tem um projeto e quer implementar testes automatizados. Tradicionalmente você precisaria:

1. ⏰ **Manualmente** analisar todas as rotas e endpoints
2. ⏰ **Manualmente** planejar quais testes criar  
3. ⏰ **Manualmente** estruturar os arquivos de teste
4. ⏰ **Manualmente** configurar Playwright, Jest, etc.
5. ⏰ **Manualmente** escrever cada teste do zero

### ✨ Com o Quality MCP:

```bash
# Um único comando faz TUDO automaticamente:
quality auto --repo . --product "MyApp"
```

**O que acontece em segundos:**

```
🔍 Detectando linguagem... ✅ TypeScript + Next.js
📦 Analisando código... ✅ 23 rotas, 15 endpoints, 8 eventos
🎯 Recomendando estratégia... ✅ 70% unit, 20% integration, 10% E2E  
📋 Gerando plano... ✅ 45 cenários organizados por domínio
🏗️ Criando estrutura... ✅ Templates + configs + fixtures
🧪 Executando testes... ✅ 12 testes passando, 85% cobertura
📊 Gerando relatórios... ✅ Dashboard HTML + resumo executivo
```

### 📁 **Resultado:** Estrutura completa e organizada

```
qa/MyApp/                      # 🎯 TUDO em um único diretório!
├── mcp-settings.json          # ⚙️  Configurações do projeto
├── tests/
│   ├── analyses/              # 📊 Dados brutos (JSON)
│   │   ├── analyze.json       # Mapeamento de código
│   │   ├── coverage-analysis.json
│   │   ├── risk-map.json
│   │   └── TEST-QUALITY-LOGICAL.json
│   ├── reports/               # � Relatórios legíveis
│   │   ├── QUALITY-REPORT.md  # Resumo executivo
│   │   ├── PLAN.md            # Plano de testes
│   │   ├── PYRAMID.md         # Análise de pirâmide
│   │   ├── PYRAMID.html       # Dashboard pirâmide
│   │   ├── COVERAGE-REPORT.md
│   │   ├── DIFF-COVERAGE.md
│   │   └── SELF-CHECK.md      # Validação de ambiente
│   ├── unit/                  # 🔬 Testes unitários
│   ├── integration/           # 🔗 Testes de integração  
│   └── e2e/                   # 🎭 Testes E2E Playwright
├── dashboards/
│   └── dashboard.html         # 📈 Dashboard interativo
└── fixtures/
    └── auth/
        └── storageState.json  # Sessões autenticadas
```

---

## 🚦 Quality Gates & DORA Metrics (NEW v0.4.0!)

O MCP Quality CLI agora inclui **Quality Gates completos** para garantir que seu código atenda aos padrões de qualidade antes de ir para produção!

### 🎯 O que são Quality Gates?

São **portas de qualidade** que validam métricas críticas e **bloqueiam deploys arriscados** automaticamente:

```bash
# Executar pipeline completo + Quality Gates
npx quality-cli analyze --mode full

# Aplicar quality gates (exit code 0/1/2)
npx quality-cli release-quality-gate
```

### 📊 Métricas Monitoradas

| Categoria | Métricas | Threshold | Bloqueante? |
|-----------|----------|-----------|-------------|
| **Coverage** | Lines, Branches, Functions | ≥80%, ≥75%, ≥80% | ⚠️ Warning |
| **Mutation** | Overall, Critical Modules | ≥50%, ≥60% | ❌ Yes (critical) |
| **Contracts** | CDC Verification, Breaking Changes | ≥95%, 0 | ❌ Yes (breaking) |
| **Suite Health** | Flakiness, Runtime, Parallelism | ≤3%, ≤12min, ≥4 | ⚠️ Warning |
| **Portfolio** | E2E%, Unit% | ≤15%, ≥60% | ⚠️ Warning |
| **Production** | CFR, MTTR, Deploy Freq | ≤15%, ≤60min, ≥1/month | ❌ Yes (CFR) |

### 🚨 Exit Codes para CI/CD

```bash
0 → ✅ All gates passed (deploy allowed)
1 → ❌ BLOCKED (blocking violations - stop deploy!)
2 → ⚠️ WARNINGS (non-blocking - allow with caution)
```

### 📈 DORA Metrics (Production)

Colete métricas DORA automaticamente de Sentry, Datadog, Grafana, Jira:

```bash
# Configurar credenciais
export SENTRY_DSN="..."
export DD_API_KEY="..."

# Coletar metrics
npx quality-cli prod-metrics-ingest --repo . --product MyApp

# Comparar vs SLOs
npx quality-cli slo-canary-check --repo . --product MyApp
```

**Métricas DORA calculadas:**
- 🚀 **Deployment Frequency**: Quantos deploys/mês
- ⏱️ **Lead Time for Changes**: Tempo médio de commit→deploy
- 🔥 **Change Failure Rate**: % de deploys que falharam
- 🛠️ **MTTR**: Tempo médio para resolver incidents

**Classificação DORA Tier:**
- 🏆 **Elite**: Deploy on-demand, LT < 1h, CFR < 5%, MTTR < 1h
- 🥇 **High**: Deploy 1x/dia-1x/semana, LT < 1 dia, CFR 5-15%, MTTR < 1 dia
- 🥈 **Medium**: Deploy 1x/semana-1x/mês, LT < 1 semana, CFR 16-30%, MTTR < 1 semana
- 🥉 **Low**: Deploy < 1x/mês, LT > 1 semana, CFR > 30%, MTTR > 1 semana

### 🔗 Integração CI/CD

**GitHub Actions:**
```yaml
- name: Apply Quality Gates
  run: npx quality-cli release-quality-gate
  
- name: Fail if blocked
  if: failure()
  run: exit 1
```

**GitLab CI:**
```yaml
quality_gates:
  script:
    - npx quality-cli release-quality-gate
  allow_failure:
    exit_codes: 2  # Warnings OK
```

**Jenkins:**
```groovy
def exitCode = sh(script: 'npx quality-cli release-quality-gate', returnStatus: true)
if (exitCode == 1) { error('BLOCKED') }
```

📚 **[Guia Completo de Quality Gates](docs/QUALITY-GATES-GUIDE.md)** | **[Exemplos CI/CD](docs/ci-cd/)**

---

**✨ Novidade v0.3.1:** Retorno estruturado!

O comando `auto` agora retorna um objeto organizado com todos os paths gerados:

```json
{
  "ok": true,
  "outputs": {
    "root": "qa/MyApp",
    "reports": [
      "tests/reports/QUALITY-REPORT.md",
      "tests/reports/PLAN.md",
      "tests/reports/PYRAMID.html"
    ],
    "analyses": [
      "tests/analyses/analyze.json",
      "tests/analyses/coverage-analysis.json"
    ],
    "dashboard": "dashboards/dashboard.html",
    "tests": {
      "unit": "tests/unit",
      "integration": "tests/integration",
      "e2e": "tests/e2e"
    }
  },
  "duration": 45230
}
```

## ⚡ Quickstart (v0.3.0 - One-Shot com Linguagem Natural)

### 🧠 Comandos em Linguagem Natural

A forma **mais fácil** de usar é através de **comandos em português ou inglês**. O Quality MCP entende o que você quer fazer:

```json
// No seu cliente MCP (Claude, Cline, etc):
{
  "tool": "nl_command", 
  "params": {
    "query": "analise meu repositório e crie tudo automaticamente"
  }
}
```

**Exemplos de comandos que funcionam:**

```javascript
// 🚀 Análise completa (recomendado para começar)
"analise meu repositório"
"auditar o projeto completo"  
"create full quality analysis"
"run everything automatically"

// 🔍 Apenas análise do código
"só analisar o código"
"mapear endpoints e rotas"
"scan the codebase only"

// 📋 Criar plano de testes
"criar plano de testes detalhado"
"gerar estratégia de qualidade"
"create comprehensive test plan"

// 🏗️ Gerar estrutura de testes  
"gerar templates de testes"
"scaffold test structures"
"create unit test boilerplate"

// 🧪 Executar testes + cobertura
"rodar todos os testes"
"executar testes com cobertura"
"run tests and generate coverage report"
```

### 🎯 **Exemplo Real:** Análise de um projeto Next.js

**Input:**
```bash
quality auto --repo . --product "E-commerce"
```

**Output esperado:**
```
🚀 Iniciando análise mágica de qualidade...

🔍 Detectando linguagem e framework...
✅ Detectado: TypeScript + Next.js + Prisma

📊 Analisando código...
✅ 34 rotas API detectadas (/api/products, /api/users, etc.)
✅ 12 páginas Next.js encontradas  
✅ 8 eventos de analytics identificados
✅ 3 domínios mapeados: auth, products, checkout

🎯 Recomendando estratégia...
✅ Tipo detectado: E-commerce Platform
📝 RECOMENDAÇÃO:
   Unit:        70% (50-80 testes) 🔴 ALTA prioridade
   Integration: 20% (15-25 testes) 🟡 MÉDIA prioridade  
   E2E:         10% (8-12 testes) 🟢 BAIXA prioridade

📋 Gerando plano de testes...
✅ 52 cenários organizados por domínio:
   - Auth: login, registro, recuperação (8 cenários)
   - Products: busca, filtros, detalhes (18 cenários)  
   - Checkout: carrinho, pagamento, confirmação (12 cenários)
   - Admin: gestão produtos, pedidos (14 cenários)

🏗️ Criando estrutura de testes...
✅ 45 arquivos de teste gerados
✅ Playwright configurado (3 browsers)
✅ Jest configurado para unit tests
✅ Fixtures e mocks criados

🧪 Executando testes...
✅ Unit: 23/23 passing (100%)
✅ Integration: 8/8 passing (100%)  
✅ E2E: 6/6 passing (100%)
📊 Cobertura: 78% (target: 70% ✅)

📊 Gerando relatórios...
✅ Dashboard: qa/E-commerce/tests/analyses/dashboard.html
✅ Resumo: qa/E-commerce/tests/analyses/SUMMARY.md

============================================================
✅ ANÁLISE COMPLETA FINALIZADA! 
============================================================
🎉 Seu projeto agora tem 37 testes automatizados e 78% de cobertura!
```

### 🚀 Orquestrador Auto - Modos Detalhados

Para controle mais fino, use a tool `auto` diretamente:

```json
{
  "tool": "auto",
  "params": {
    "mode": "full"  // ou: analyze, plan, scaffold, run
  }
}
```

**Modos disponíveis e o que cada um faz:**

#### 🔍 **Mode: `analyze`** 
*Tempo: ~30 segundos*
```bash
quality auto --mode analyze
```
**O que faz:**
- Escaneia todo o código fonte
- Detecta rotas, endpoints, eventos  
- Mapeia arquitetura e dependências
- Identifica domínios de negócio
- **Gera:** `analyze.json` com mapeamento completo

**Ideal para:** Entender a arquitetura antes de planejar testes

#### 📋 **Mode: `plan`** 
*Tempo: ~1 minuto* 
```bash
quality auto --mode plan
```
**O que faz:**
- Tudo do `analyze` +
- Recomenda estratégia de testes (% unit/integration/e2e)
- Gera plano detalhado com cenários
- Organiza por domínios e prioridades
- **Gera:** `TEST-PLAN.md` com 30-50 cenários

**Ideal para:** Revisar estratégia antes de criar testes

#### 🏗️ **Mode: `scaffold`** 
*Tempo: ~2 minutos*
```bash
quality auto --mode scaffold  
```
**O que faz:**
- Tudo do `plan` +
- Cria estrutura completa de arquivos
- Gera templates de unit/integration/e2e
- Configura Playwright, Jest, fixtures
- **Gera:** 20-50 arquivos de teste prontos

**Ideal para:** Ter base sólida para desenvolver testes

#### 🧪 **Mode: `run`** 
*Tempo: ~3-5 minutos*
```bash
quality auto --mode run
```
**O que faz:**
- Executa todos os testes existentes
- Calcula cobertura total e diff
- Gera relatórios HTML/JSON
- Cria dashboard interativo
- **Gera:** Relatórios de execução e cobertura

**Ideal para:** Validar qualidade atual do projeto

#### 🎯 **Mode: `full` (RECOMENDADO)** 
*Tempo: ~5-8 minutos*
```bash
quality auto --mode full  # ou só: quality auto
```
**O que faz:**
- **TUDO:** analyze → plan → scaffold → run
- Processo completo do zero ao dashboard
- **Gera:** Estrutura completa + relatórios + métricas

**Ideal para:** Setup completo de qualidade em projeto novo/existente

### 🎛️ **Exemplos de Uso por Cenário**

#### 🆕 **Projeto Novo (nunca teve testes)**
```bash
# 1. Análise completa automática
quality auto --repo . --product "MinhaApp"

# Resultado: 0 → 30+ testes em 5 minutos
```

#### 🔄 **Projeto Existente (já tem alguns testes)**  
```bash
# 1. Só analisar gaps atuais
quality auto --mode analyze

# 2. Revisar plano gerado
# 3. Decidir se quer scaffold ou só rodar existentes
quality auto --mode run  # só executar atuais
```

#### 🚀 **CI/CD Pipeline**
```bash
# Gate de qualidade rápido
quality auto --mode run --skip-scaffold

# Análise de PR  
quality diff-coverage --repo . --target-min 80
```

#### 👥 **Review de Arquitetura** 
```bash
# Gerar documentação da arquitetura atual
quality auto --mode plan --include-examples

# Compartilhar: qa/produto/tests/analyses/TEST-PLAN.md
```

### 🎯 O que o One-Shot faz automaticamente:

1. **Detecta** o repositório (busca por `.git` ou `package.json`)
2. **Infere** o produto do `package.json` (ou usa nome da pasta)
3. **Cria** `qa/<product>/mcp-settings.json` (se não existir)
4. **Analisa** código (endpoints, eventos, testes existentes)
5. **Recomenda** estratégia (% unit/integration/e2e ideal)
6. **Gera** plano de testes estruturado
7. **Cria** scaffolds (unit, integration, e2e)
8. **Executa** testes com cobertura
9. **Calcula** cobertura total + diff vs branch base
10. **Gera** relatório executivo em `SUMMARY.md`

### 📄 Artifacts Gerados - Estrutura Detalhada

Depois de executar `quality auto`, você terá uma estrutura completa em `qa/<produto>/`:

```
qa/
└── MinhaApp/                          # 📁 Pasta do produto
    ├── mcp-settings.json              # ⚙️  Configurações (auto-geradas)
    │   ├── product: "MinhaApp"        
    │   ├── domains: ["auth", "user"]  # 🎯 Detectados automaticamente
    │   └── targets: coverage, flaky % # 📊 Métricas de qualidade
    │
    └── tests/                         # 📁 Pasta de testes
        ├── unit/                      # 🔬 Testes unitários
        │   ├── auth.test.ts          # ✅ Login, logout, validações
        │   ├── user.test.ts          # ✅ CRUD usuários 
        │   └── utils.test.ts         # ✅ Funções auxiliares
        │
        ├── integration/               # 🔗 Testes de integração
        │   ├── api/                  
        │   │   ├── auth.test.ts      # ✅ API auth + DB
        │   │   └── users.test.ts     # ✅ API users + DB
        │   └── components/           
        │       └── forms.test.ts     # ✅ Componentes + props
        │
        ├── e2e/                      # 🎭 Testes End-to-End
        │   ├── playwright.config.ts  # ⚙️  Config Playwright
        │   ├── fixtures/             
        │   │   ├── auth.ts           # 🔑 Login automatizado
        │   │   └── data.ts           # 📝 Dados de teste
        │   ├── pages/                # 📄 Page Object Models
        │   │   ├── login.page.ts     
        │   │   └── dashboard.page.ts 
        │   └── specs/                # 🧪 Cenários de teste
        │       ├── auth/
        │       │   ├── login.spec.ts       # ✅ Login válido/inválido
        │       │   └── recovery.spec.ts    # ✅ Recuperação senha
        │       └── user/
        │           ├── profile.spec.ts     # ✅ Edição perfil
        │           └── settings.spec.ts    # ✅ Configurações
        │
        └── analyses/                  # 📊 Relatórios e análises  
            ├── analyze.json           # 🔍 Mapeamento código fonte
            │   ├── routes: [...]      # 🛣️  34 rotas detectadas
            │   ├── endpoints: [...]   # 🔌 23 endpoints API
            │   └── events: [...]      # 📡 12 eventos analytics
            │
            ├── TEST-PLAN.md           # 📋 Plano detalhado de testes
            │   ├── 📊 Estratégia (70% unit, 20% integ, 10% e2e)
            │   ├── 🎯 52 cenários por domínio  
            │   ├── 🔄 Fluxos críticos prioritários
            │   └── 📝 Exemplos de implementação
            │
            ├── coverage-analysis.json # 📈 Análise de cobertura
            │   ├── total: 78%         # 📊 Cobertura geral
            │   ├── by_file: {...}     # 📄 Por arquivo
            │   └── gaps: [...]        # ⚠️  Arquivos sem cobertura
            │
            ├── COVERAGE-REPORT.md     # 📋 Relatório cobertura
            │   ├── 🎯 Status vs targets (78% vs 70% ✅)
            │   ├── 📉 Gaps críticos identificados
            │   └── 💡 Recomendações específicas
            │
            ├── PYRAMID-REPORT.md      # 🔺 Pirâmide de testes
            │   ├── Unit:    42 testes (70%) ✅
            │   ├── Integration: 12 testes (20%) ✅  
            │   ├── E2E:     6 testes (10%) ✅
            │   └── Status: 🟢 SAUDÁVEL
            │
            ├── dashboard.html         # 📊 Dashboard interativo
            │   ├── 📈 Gráficos de cobertura
            │   ├── 🔺 Visualização da pirâmide
            │   ├── 📉 Trends históricos
            │   └── 🎯 Métricas de qualidade
            │
            └── SUMMARY.md             # 📝 Resumo executivo
                ├── ✅ 60 testes criados (42+12+6)
                ├── 📊 78% cobertura (target: 70%)
                ├── 🎯 Status: APROVADO para release
                └── 🔄 Próximos passos recomendados
```

### 📊 **Exemplo de Relatórios Gerados**

#### 📋 `TEST-PLAN.md` - Preview
```markdown
# Plano de Testes - MinhaApp

## 📊 Estratégia Recomendada
- **Unit Tests:** 70% (42 testes) - Lógica de negócio
- **Integration:** 20% (12 testes) - APIs + Database  
- **E2E Tests:** 10% (6 testes) - Fluxos críticos

## 🎯 Cenários por Domínio

### 🔑 Autenticação (8 cenários)
1. ✅ Login com credenciais válidas
2. ❌ Login com credenciais inválidas  
3. 🔄 Recuperação de senha
4. 🚪 Logout e limpeza de sessão
[...]

### 👤 Usuários (12 cenários)  
1. ✅ Cadastro novo usuário
2. 📝 Edição de perfil
3. 🗑️ Exclusão de conta
[...]
```

#### 📊 `SUMMARY.md` - Preview  
```markdown
# Resumo Executivo - MinhaApp

## 🎯 Status Geral: ✅ APROVADO

### 📈 Métricas de Qualidade
- **Cobertura Total:** 78% (target: 70% ✅)
- **Testes Criados:** 60 (42 unit + 12 integration + 6 e2e)
- **Flaky Rate:** 0% (target: <5% ✅)
- **Tempo CI:** 4.2min (target: <10min ✅)

### 🚀 Pronto para Release
✅ Todos os targets atingidos
✅ Fluxos críticos cobertos  
✅ Zero testes flakey
✅ CI/CD configurado
```

---

## � Antes vs Depois - Transformação do Projeto

### ❌ **ANTES** - Projeto sem testes
```
meu-projeto/
├── src/
│   ├── pages/           # 15 páginas Next.js
│   ├── api/             # 23 endpoints API
│   ├── components/      # 45 componentes
│   └── utils/           # 12 funções utilitárias
├── package.json         # Dependências básicas
└── README.md

❌ 0 testes
❌ 0% cobertura  
❌ Sem validação de qualidade
❌ Deploy manual arriscado
❌ Bugs em produção
```

### ✅ **DEPOIS** - Projeto com Quality MCP
```
meu-projeto/
├── src/                 # ✅ Código original intocado
│   ├── pages/           
│   ├── api/             
│   ├── components/      
│   └── utils/           
├── qa/MeuProjeto/       # 🆕 Estrutura de qualidade completa
│   ├── mcp-settings.json
│   └── tests/
│       ├── unit/        # 🔬 35 testes unitários
│       ├── integration/ # 🔗 15 testes integração  
│       ├── e2e/         # 🎭 8 testes E2E
│       └── analyses/    # 📊 Relatórios detalhados
├── package.json         # ✅ Scripts de teste adicionados
├── playwright.config.ts # ✅ Config E2E
├── jest.config.js       # ✅ Config unit tests
└── README.md            # ✅ Documentação atualizada

✅ 58 testes automatizados
✅ 82% cobertura (target: 70%)
✅ CI/CD com gates de qualidade  
✅ Deploy seguro com validação
✅ Bugs detectados antes da produção
```

### 📊 **Impacto em Números**

| Métrica | Antes | Depois | Melhoria |
|---------|-------|---------|----------|
| **Testes** | 0 | 58 | +∞ |
| **Cobertura** | 0% | 82% | +82% |
| **Bugs em Prod** | ~15/mês | ~2/mês | -87% |
| **Tempo Deploy** | 45min | 12min | -73% |
| **Confiança Deploy** | 20% | 95% | +375% |
| **Setup Time** | ~40h | ~8min | -99.7% |

## �🚀 Funcionalidades

- **🧠 Linguagem Natural**: Comandos em PT/EN ("analise meu repositório")
- **🚀 Orquestrador One-Shot**: Zero-setup, detecta tudo automaticamente
- **Análise Automática**: Detecta rotas, endpoints, eventos e riscos no seu código
- **Geração de Plano**: Cria plano de testes estruturado por domínio/produto
- **Scaffold Inteligente**: Gera estrutura completa de testes Playwright
- **Execução com Cobertura**: Roda testes com relatórios HTML, JUnit, JSON
- **Relatório Executivo**: Consolida resultados para aprovação de QA/Release

## 🏃‍♂️ Como Começar - Passo a Passo

### 🎯 **Setup Rápido (5 minutos)**

#### 1️⃣ **Clone e Configure o MCP**
```bash
# Clone o repositório
git clone https://github.com/jorgsouza/mcp-Quality-CLI
cd mcp-Quality-CLI

# Instale e compile
npm install && npm run build

# Teste se funcionou
node dist/cli.js --help
```

#### 2️⃣ **Configure no seu Cliente MCP** 
Para **Claude Desktop**, edite `~/Library/Application Support/Claude/claude_desktop_config.json`:

```json
{
  "mcpServers": {
    "quality": {
      "command": "node",
      "args": ["/caminho/completo/para/mcp-Quality-CLI/dist/server.js"],
      "env": {
        "E2E_BASE_URL": "http://localhost:3000"
      }
    }
  }
}
```

Para **Cline (VS Code)**, edite `.vscode/settings.json`:
```json
{
  "cline.mcpServerConfig": {
    "quality": {
      "command": "node", 
      "args": ["/caminho/completo/para/mcp-Quality-CLI/dist/server.js"]
    }
  }
}
```

#### 3️⃣ **Execute a Mágica** ✨
```bash
# No terminal do seu projeto:
cd /caminho/do/seu/projeto

# Execute a análise completa
node /caminho/para/mcp-Quality-CLI/dist/cli.js auto --repo . --product "MeuApp"
```

**Ou via Cliente MCP:**
```json
{
  "tool": "auto",
  "params": {
    "repo": ".",
    "product": "MeuApp",
    "mode": "full"
  }
}
```

### 🎬 **Exemplo Prático: Projeto Next.js**

```bash
# Vamos dizer que você tem um e-commerce Next.js
cd meu-ecommerce-nextjs

# Execute o comando mágico
quality auto --repo . --product "E-commerce"

# ⏱️ Aguarde 3-5 minutos...
# ✅ Pronto! Seu projeto agora tem:
#    - 45 testes unitários
#    - 18 testes de integração  
#    - 12 testes E2E
#    - 84% de cobertura
#    - Dashboard interativo
#    - Relatório executivo
```

### 🔧 **Customização (Opcional)**

Depois da primeira execução, você pode ajustar as configurações:

```bash
# Edite o arquivo gerado
vim qa/E-commerce/mcp-settings.json

# Ajuste domínios, fluxos críticos, targets, etc.
{
  "domains": ["auth", "catalog", "cart", "checkout"],
  "critical_flows": ["login", "add_to_cart", "purchase"],
  "targets": {
    "diff_coverage_min": 85,  // Mais rigoroso
    "flaky_pct_max": 2        // Menos tolerância
  }
}

# Execute novamente para aplicar mudanças
quality auto --repo . --product "E-commerce"
```

## 📋 Pré-requisitos

- **Node.js 20+** (recomendado: 20.11.0 ou superior)
- **npm** ou **yarn** 
- **Git** (para análise de diff coverage)

### ✅ **Verificar Pré-requisitos**
```bash
node --version   # Deve ser v20.x.x+
npm --version    # Qualquer versão recente
git --version    # Qualquer versão recente
```

## 🔧 Instalação Detalhada

### **Método 1: Desenvolvimento (Recomendado)**
```bash
# 1. Clone o repositório
git clone https://github.com/jorgsouza/mcp-Quality-CLI.git
cd mcp-Quality-CLI

# 2. Instale dependências
npm install

# 3. Compile TypeScript
npm run build

# 4. Teste a instalação
node dist/cli.js --version
node dist/cli.js --help

# 5. Configure no seu cliente MCP (ver seção "Como Começar")
```

### **Método 2: Global (Para uso direto no terminal)**
```bash
# 1. Clone e instale globalmente
git clone https://github.com/jorgsouza/mcp-Quality-CLI.git
cd mcp-Quality-CLI
npm install && npm run build
npm link

# 2. Agora você pode usar em qualquer lugar
cd /caminho/do/seu/projeto
quality auto --repo . --product "MeuApp"
```

### **Método 3: Via NPM (Futuro)**
```bash
# Em breve estará disponível:
npm install -g quality-mcp  # 🚧 Em desenvolvimento
```

## 🎮 Uso

### Como MCP Server

Configure no seu `mcp-settings.json` (Claude Desktop, Cline, etc):

```json
{
  "mcpServers": {
    "quality": {
      "command": "node",
      "args": ["/path/to/mcp-Quality-CLI/dist/server.js"],
      "env": {
        "E2E_BASE_URL": "https://staging.example.com",
        "E2E_USER": "test@example.com",
        "E2E_PASS": "your-password"
      }
    }
  }
}
```

### Como CLI

#### 1. Análise do Repositório

```bash
quality analyze \
  --repo . \
  --product "MyApp" \
  --domains "auth,user,search" \
  --critical-flows "login,registration,search" \
  --targets '{"ci_p95_min":15,"flaky_pct_max":3,"diff_coverage_min":60}' \
  --base-url "https://staging.example.com"
```

**Saída**: `plan/analyze.json` com rotas, endpoints, eventos e mapa de riscos.

#### 2. Geração do Plano de Testes

```bash
quality plan \
  --repo . \
  --product "MyApp" \
  --base-url "https://staging.example.com" \
  --include-examples
```

**Saída**: `plan/TEST-PLAN.md` com plano estruturado e exemplos.

#### 3. Scaffold dos Testes Playwright

```bash
quality scaffold \
  --repo . \
  --plan plan/TEST-PLAN.md \
  --out packages/product-e2e
```

**Saída**: Estrutura completa em `packages/product-e2e/` com:

- `playwright.config.ts`
- Testes organizados por domínio
- Fixtures e utilitários
- README com instruções

#### 4. Execução dos Testes

```bash
# Configure variáveis de ambiente
export E2E_BASE_URL="https://staging.example.com"
export E2E_USER="test@example.com"
export E2E_PASS="secure-password"

# Execute
quality run \
  --repo . \
  --e2e packages/product-e2e \
  --report reports
```

**Saída**: Relatórios em `reports/` (HTML, JUnit, JSON).

#### 5. Relatório Consolidado

```bash
quality report \
  --in reports \
  --out SUMMARY.md \
  --thresholds '{"flaky_pct_max":3,"diff_coverage_min":60}' \
  --ci
```

**Saída**: `SUMMARY.md` pronto para PR/Release.

### Pipeline Completo

Execute todas as etapas de uma vez:

```bash
quality full \
  --repo . \
  --product "MyApp" \
  --base-url "https://staging.example.com" \
  --domains "auth,user,search" \
  --critical-flows "login,registration,search" \
  --targets '{"ci_p95_min":15,"flaky_pct_max":3,"diff_coverage_min":60}'
```

## 🛠️ Tools MCP Disponíveis

### 1. `analyze_codebase`

Analisa o repositório para detectar rotas, endpoints, eventos e riscos.

**Parâmetros**:

```typescript
{
  repo: string;              // Caminho do repositório
  product: string;           // Nome do produto
  domains?: string[];        // ex: ["auth","user"]
  critical_flows?: string[]; // ex: ["login","registration"]
  targets?: {
    ci_p95_min?: number;
    flaky_pct_max?: number;
    diff_coverage_min?: number;
  };
  base_url?: string;
}
```

### 2. `generate_test_plan`

Gera plano de testes Playwright em Markdown.

**Parâmetros**:

```typescript
{
  repo: string;
  product: string;
  base_url: string;
  include_examples?: boolean;
  out_dir?: string; // default: "plan"
}
```

### 3. `scaffold_playwright`

Cria estrutura de testes Playwright com specs e configurações.

**Parâmetros**:

```typescript
{
  repo: string;
  plan_file: string;
  out_dir?: string; // default: "packages/product-e2e"
}
```

### 4. `run_playwright`

Executa testes Playwright com cobertura e relatórios.

**Parâmetros**:

```typescript
{
  repo: string;
  e2e_dir: string;
  report_dir?: string; // default: "reports"
  headless?: boolean;  // default: true
}
```

### 5. `build_report`

Consolida relatórios em Markdown para aprovação de QA.

**Parâmetros**:

```typescript
{
  in_dir: string;
  out_file?: string; // default: "SUMMARY.md"
  thresholds?: {
    flaky_pct_max?: number;
    diff_coverage_min?: number;
  };
}
```

## 📊 Métricas e Gates

### Targets Recomendados

- **CI p95**: ≤ 15 minutos (percentil 95 do tempo de CI)
- **Flaky Rate**: ≤ 3% (testes instáveis)
- **Diff Coverage**: ≥ 60% (cobertura nas mudanças)

### Política de Flaky Tests

1. Quarentena automática (skip temporário)
2. Criar issue para investigação
3. SLA de 7 dias para correção
4. Se não corrigido em 14 dias, remover o teste

## 🔄 CI/CD

### GitHub Actions

Dois workflows prontos:

#### 1. CI para Pull Requests (`.github/workflows/ci.yml`)

Executa:

- Análise do código
- Geração de plano
- Scaffold dos testes
- Execução da suite smoke
- Comentário no PR com resultados

#### 2. Nightly Full Suite (`.github/workflows/nightly.yml`)

Executa:

- Suite completa em 3 browsers (Chromium, Firefox, WebKit)
- Agregação de resultados
- Notificação no Slack em caso de falha
- Criação automática de issues

### Variáveis de Ambiente Necessárias

Configure no GitHub Secrets:

```bash
E2E_BASE_URL          # URL do ambiente de testes
E2E_BASE_URL_STAGING  # URL do staging (nightly)
E2E_USER              # Usuário de teste
E2E_PASS              # Senha de teste
SLACK_WEBHOOK_URL     # Webhook do Slack (opcional)
```

## 📁 Estrutura do Projeto

```
mcp-Quality-CLI/
├── src/
│   ├── server.ts           # MCP server principal
│   ├── cli.ts              # CLI wrapper
│   ├── tools/
│   │   ├── analyze.ts      # Análise de código
│   │   ├── plan.ts         # Geração de plano
│   │   ├── scaffold.ts     # Scaffold de testes
│   │   ├── run.ts          # Executor de testes
│   │   └── report.ts       # Gerador de relatórios
│   ├── detectors/
│   │   ├── next.ts         # Detector de rotas Next.js
│   │   ├── express.ts      # Detector de rotas Express/Fastify
│   │   └── events.ts       # Detector de eventos
│   └── utils/
│       └── fs.ts           # Utilitários de filesystem
├── .github/
│   └── workflows/
│       ├── ci.yml          # Workflow de CI
│       └── nightly.yml     # Workflow nightly
├── package.json
├── tsconfig.json
└── README.md
```

## 🎯 Casos de Uso

### 1. Novo Projeto

```bash
# 1. Instale globalmente
npm install -g quality-mcp

# 2. Execute o pipeline completo
quality full --repo . --product "MyApp" --base-url "http://localhost:3000"

# 3. Revise os arquivos gerados
# 4. Ajuste os testes conforme necessário
# 5. Execute novamente
quality run --repo . --e2e packages/product-e2e
```

### 2. Projeto Existente

```bash
# 1. Analise o código existente
quality analyze --repo . --product "MyApp"

# 2. Gere o plano
quality plan --repo . --product "MyApp" --base-url "http://localhost:3000"

# 3. Revise o plano (plan/TEST-PLAN.md)
# 4. Ajuste conforme necessário
# 5. Crie os testes
quality scaffold --repo . --plan plan/TEST-PLAN.md
```

### 3. CI/CD

```yaml
# Adicione ao seu workflow
- name: Run E2E Quality Check
  run: |
    npm install -g quality-mcp
    quality full \
      --repo . \
      --product "${{ github.repository }}" \
      --base-url "${{ secrets.E2E_BASE_URL }}"
```

## 🤝 Contribuindo

Contribuições são bem-vindas! Por favor:

1. Fork o projeto
2. Crie uma branch para sua feature (`git checkout -b feature/AmazingFeature`)
3. Commit suas mudanças (`git commit -m 'Add some AmazingFeature'`)
4. Push para a branch (`git push origin feature/AmazingFeature`)
5. Abra um Pull Request

## ❓ FAQ - Perguntas Frequentes

### **Q: O comando falha com "command not found"**
**A:** Verifique se compilou corretamente:
```bash
cd mcp-Quality-CLI
npm run build
node dist/cli.js --help  # Deve mostrar ajuda
```

### **Q: Não detectou minha linguagem/framework**
**A:** Atualmente suportamos:
- ✅ **JavaScript/TypeScript** (Node.js, Next.js, React)
- ✅ **Go** (gin, echo, gorilla/mux)
- ✅ **Python** (FastAPI, Django, Flask)
- ✅ **Java** (Spring Boot, Maven, Gradle)
- ✅ **C#** (.NET Core, ASP.NET)
- ✅ **PHP** (Laravel, Symfony)
- ✅ **Ruby** (Rails, Sinatra)

### **Q: Posso usar em projetos privados/comerciais?**
**A:** Sim! Licença MIT permite uso comercial. Todos os dados ficam locais.

### **Q: Como personalizar os templates gerados?**
**A:** Edite os arquivos em `src/tools/templates/` e recompile:
```bash
# Personalize templates
vim src/tools/templates/playwright.config.template.ts
npm run build
```

### **Q: Dá para integrar com meu CI/CD?** 
**A:** Sim! Exemplos:

**GitHub Actions:**
```yaml
- name: Quality Gate
  run: |
    npx quality-mcp auto --mode run
    npx quality-mcp diff-coverage --target-min 80
```

**GitLab CI:**
```yaml
quality_check:
  script:
    - npm install -g quality-mcp
    - quality auto --mode run --repo .
```

### **Q: Onde ficam salvos os dados?**
**A:** Tudo fica local no seu projeto em `qa/<produto>/`. Nada é enviado para servidores externos.

### **Q: Como desinstalar?**
**A:** 
```bash
# Se instalou globalmente
npm unlink quality-mcp

# Remover pasta
rm -rf /caminho/para/mcp-Quality-CLI

# Remover do config MCP
# Edite seu claude_desktop_config.json ou settings.json
```

## 🚨 Troubleshooting

### **❌ Erro: "Cannot find module"**
```bash
# Solução: Reinstale dependências
rm -rf node_modules package-lock.json
npm install
npm run build
```

### **❌ Erro: "Permission denied"**
```bash
# Solução: Ajuste permissões
chmod +x dist/cli.js
# Ou use: node dist/cli.js em vez de ./dist/cli.js
```

### **❌ Erro: "Git not found"**
```bash
# Solução: Instale git ou pule diff coverage
quality auto --skip-run  # Pula execução que precisa de git
```

### **❌ Testes E2E falhando**
```bash
# Solução: Verifique variáveis de ambiente
export E2E_BASE_URL="http://localhost:3000"
export E2E_USER="test@example.com" 
export E2E_PASS="password123"

# Ou rode sem E2E
quality auto --mode scaffold  # Só cria estrutura
```

### **🔍 Debug Mode**
```bash
# Para mais logs detalhados
DEBUG=quality:* quality auto --repo .
```

## 🌐 Suporte Multi-Linguagem

O Quality MCP oferece suporte **END-TO-END** para múltiplas linguagens com adapters nativos!

| Linguagem | Analyze | Coverage | Mutation | Scaffold | Status |
|-----------|---------|----------|----------|----------|--------|
| **TypeScript** | ✅ | ✅ | ✅ | ✅ | 🟢 **Completo** |
| **JavaScript** | ✅ | ✅ | ✅ | ✅ | 🟢 **Completo** |
| **Python** | ✅ | ✅ | ✅ | ✅ | 🟢 **Completo** |
| **Go** | ✅ | ✅ | ✅ | ✅ | 🟢 **Completo** |
| **Java** | ✅ | ✅ | ✅ | ✅ | 🟢 **Completo** |
| **Ruby** | ⚪ | ⚪ | ⚪ | ⚪ | ⚪ **Planejado Q2 2026** |

### Legenda
- ✅ **Suportado** - Funcional e testado
- 🟡 **Parcial** - Funcional mas não testado extensivamente
- ⚪ **Planejado** - Em desenvolvimento

### Detalhes por Linguagem

#### TypeScript/JavaScript
- **Frameworks**: Vitest, Jest, Mocha
- **Coverage**: Coverage-v8, istanbul/nyc
- **Mutation**: Stryker
- **Formats**: LCOV, JSON (Istanbul)
- **Status**: ✅ Produção

#### Python
- **Frameworks**: pytest, unittest
- **Coverage**: coverage.py, pytest-cov
- **Mutation**: mutmut
- **Formats**: Cobertura XML
- **Status**: ✅ Produção

#### Go
- **Frameworks**: go test
- **Coverage**: go test -cover
- **Mutation**: go-mutesting
- **Formats**: coverage.out
- **Status**: ✅ Produção

#### Java
- **Frameworks**: JUnit 5, JUnit 4, TestNG
- **Build Tools**: Maven, Gradle
- **Coverage**: JaCoCo
- **Mutation**: PIT (PITest)
- **Formats**: JaCoCo XML/CSV/HTML
- **Status**: ✅ Produção

### Setup Rápido por Linguagem

Para instruções detalhadas de setup, veja: [SETUP-BY-LANGUAGE.md](docs/SETUP-BY-LANGUAGE.md)

**TypeScript/JavaScript:**
```bash
npm install -D vitest @vitest/coverage-v8 @stryker-mutator/core
```

**Python:**
```bash
pip install pytest pytest-cov mutmut hypothesis
```

**Go:**
```bash
go install gotest.tools/gotestsum@latest
go install github.com/zimmski/go-mutesting/cmd/go-mutesting@latest
```

---

## 📝 Licença

MIT License - veja o arquivo [LICENSE](LICENSE) para detalhes.

## 🔗 Links Úteis

- [Playwright Documentation](https://playwright.dev)
- [Model Context Protocol](https://modelcontextprotocol.io)
- [GitHub Actions](https://docs.github.com/en/actions)

## 💡 Roadmap

- [ ] Suporte a testes de API (REST/GraphQL)
- [ ] Integração com Cypress
- [ ] Suporte a testes de mutação
- [ ] Dashboard web para visualização de métricas
- [ ] Integração com Jira/Linear para tracking de flaky tests
- [ ] Suporte a múltiplos ambientes (dev, staging, prod)
- [ ] Geração de mocks automáticos

## 📞 Suporte

Para dúvidas ou problemas:

1. Abra uma [issue](https://github.com/seu-usuario/mcp-Quality-CLI/issues)
2. Entre em contato via [email](mailto:seu-email@example.com)

---

**Desenvolvido com ❤️ para melhorar a qualidade do seu software**
