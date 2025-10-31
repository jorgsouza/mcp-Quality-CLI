# 🎯 Como Usar a Funcionalidade `recommend_test_strategy`

## 🚀 Guia Rápido de Uso

Você tem **3 formas** de usar a nova funcionalidade que analisa e recomenda estratégia de testes:

---

## 1️⃣ Via CLI (Terminal)

### Uso Básico

```bash
# Navegar até o projeto
cd /caminho/do/seu/projeto

# Analisar e gerar recomendação automaticamente
quality recommend --repo . --product "Nome do Produto" --auto
```

### Opções

```bash
# Perguntar antes de gerar (se já existir o documento)
quality recommend --repo . --product "Meu App"

# Analisar outro projeto
quality recommend --repo /home/user/outro-projeto --product "Outro App" --auto
```

### Exemplo Real

```bash
cd /home/jorgesouza/Documents/dev/mcp-Quality-CLI
quality recommend --repo . --product "Quality-MCP" --auto
```

**Saída:**
```
🔍 Analisando Quality-MCP...

📊 Tipo detectado: CLI Tool + MCP Server
📊 Complexidade: LOW

✅ Recomendação estratégica gerada!
📄 tests/analyses/TEST-STRATEGY-RECOMMENDATION.md

📝 RECOMENDAÇÃO:
   Unit:        90% (40-60 testes) 🔴 ALTA
   Integration: 10% (5-10 testes) 🟢 BAIXA
   E2E:         0% (0-2 testes) ⬜ PULE
```

---

## 2️⃣ Via MCP em Assistentes AI (Claude, Cursor, etc.)

### Configuração (já está pronta!)

Seu `~/.cursor/mcp.json` já tem:

```json
{
  "mcpServers": {
    "quality": {
      "command": "node",
      "args": ["/home/jorgesouza/Documents/dev/mcp-Quality-CLI/dist/server.js"]
    }
  }
}
```

### Como Pedir no Chat

#### **Forma Natural** (recomendado)

Simplesmente peça em linguagem natural:

```
Analise meu projeto e me diga qual estratégia de testes eu deveria seguir
```

```
Use o Quality MCP para recomendar qual proporção de unit/integration/E2E 
tests eu preciso para o projeto em /home/jorgesouza/meu-app
```

```
Tenho uma API REST com Express e Prisma. Preciso saber se devo fazer 
testes E2E ou apenas unit tests
```

#### **Forma Técnica** (específica)

Se quiser ser mais direto com a tool:

```
Use a tool recommend_test_strategy do MCP Quality com:
- repo: /home/jorgesouza/meu-projeto
- product: "Meu App"
- auto_generate: true
```

---

## 3️⃣ Via Chat AQUI no Cursor

### Exemplos Práticos

**Exemplo 1: Analisar o Quality MCP**
```
Analise o Quality MCP e me diga qual estratégia de testes 
eu deveria seguir (se preciso de E2E, integration, etc.)
```

**Exemplo 2: Analisar Outro Projeto**
```
Tenho um projeto React em /home/jorgesouza/meu-frontend.
Use o Quality MCP para me dizer se preciso de testes E2E.
```

**Exemplo 3: Comparar com Situação Atual**
```
Use o Quality MCP para ver minha cobertura atual e recomendar 
se estou no caminho certo ou preciso mudar a estratégia.
```

---

## 📊 O Que Você Vai Receber

### Console (saída imediata)

```
🔍 Analisando [Seu Produto]...
📊 Tipo detectado: [CLI Tool / Web App / API / etc.]
📊 Complexidade: [LOW / MEDIUM / HIGH]

✅ Recomendação estratégica gerada!
📄 tests/analyses/TEST-STRATEGY-RECOMMENDATION.md

📝 RECOMENDAÇÃO:
   Unit:        XX% (N-M testes) 🔴/🟡/🟢
   Integration: YY% (N-M testes) 🔴/🟡/🟢
   E2E:         ZZ% (N-M testes) 🔴/🟡/⬜
```

### Documento Completo

Arquivo `tests/analyses/TEST-STRATEGY-RECOMMENDATION.md` com:

- ✅ **Características da Aplicação**
  - Tipo detectado (CLI, Web App, API, Library, etc.)
  - Complexidade (LOW, MEDIUM, HIGH)
  - Checklist de features (✅ tem DB, ❌ não tem Auth, etc.)

- ✅ **Estratégia Recomendada**
  - Pirâmide visual (ASCII art)
  - Proporção unit/integration/E2E
  - Quantidade de testes sugerida

- ✅ **Justificativa Técnica**
  - Por quê essa proporção?
  - Quais os riscos de não seguir?

- ✅ **ROI (Return on Investment)**
  - Tempo para criar cada tipo
  - Custo de manutenção
  - Cobertura de bugs esperada

- ✅ **Situação Atual vs Recomendada**
  - Se já tiver cobertura, mostra comparação

- ✅ **Top 10 Arquivos Prioritários**
  - Quais arquivos testar primeiro
  - Classificação HIGH/MEDIUM/LOW

- ✅ **Plano de Ação**
  - Fase 1: Unit tests (quantos dias)
  - Fase 2: Integration tests (quantos dias)
  - Fase 3: E2E tests (ou pular)
  - Comandos prontos para executar

- ✅ **Resumo Executivo (TL;DR)**
  - Resposta direta em 3 linhas

---

## 🎯 Casos de Uso

### 1. **Início de Projeto**

```bash
# Antes de escrever qualquer teste
cd /home/jorgesouza/novo-projeto
quality recommend --repo . --product "Novo App" --auto

# Seguir o plano gerado
quality scaffold-unit --repo . --framework vitest
```

### 2. **Projeto Existente**

```bash
# Verificar se estou no caminho certo
cd /home/jorgesouza/projeto-existente
quality coverage --repo . --product "App Existente"
quality recommend --repo . --product "App Existente" --auto

# Comparar "atual" vs "recomendado" no documento
```

### 3. **Dúvida sobre E2E**

Via chat:
```
Meu projeto é uma CLI tool. Use o Quality MCP para me dizer 
se eu realmente preciso de testes E2E ou se unit tests são suficientes.
```

### 4. **Review de Código**

```bash
# Gerar documento para discussão no PR
quality recommend --repo . --product "Feature X" --auto

# Anexar ao PR: tests/analyses/TEST-STRATEGY-RECOMMENDATION.md
```

---

## 🔍 Como Funciona a Detecção

O Quality MCP analisa seu `package.json` e detecta:

| Detecta | Se encontrar | Impacto na Recomendação |
|---------|--------------|-------------------------|
| **CLI Tool** | `commander`, `yargs`, `bin` | ↑ Unit 90%, ↓ E2E 0% |
| **MCP Server** | `@modelcontextprotocol/sdk` | ↑ Unit 90%, ↓ E2E 0% |
| **Web Frontend** | `react`, `next`, `vue`, `angular` | ↑ E2E 10-15% |
| **Backend API** | `express`, `fastify`, `nestjs`, `koa` | ↑ Integration 20-25% |
| **Database** | `prisma`, `typeorm`, `mongoose`, `sequelize` | ↑ Integration 20-25% |
| **Auth** | `passport`, `jsonwebtoken`, `auth0` | ↑ Integration 20-25% |
| **Integrações** | `axios`, `kafkajs`, `@aws-sdk`, `redis` | ↑ Integration 20-25% |
| **Library** | `main` sem `bin`, sem UI | ↑ Unit 85-90% |

**Cálculo de Complexidade:**

```
Score = (tem Web UI?) + (tem API?) + (tem DB?) + (tem Auth?) + (tem Integrações?)

Se Score >= 4: HIGH complexidade
Se Score >= 2: MEDIUM complexidade  
Se Score < 2: LOW complexidade
```

---

## 🎯 Estratégias por Tipo

### CLI Tool / Library / MCP Server

```
Unit:        90% (40-60 testes)
Integration: 10% (5-10 testes)
E2E:         0%  (pule completamente)

Por quê?
- Lógica determinística
- Fácil testar manualmente
- Unit tests cobrem 90%+ bugs
```

### Full-Stack Web App Complexo

```
Unit:        60% (100-200 testes)
Integration: 25% (30-50 testes)
E2E:         15% (15-30 testes)

Por quê?
- UI crítica para negócio
- Múltiplas camadas
- E2E necessário para fluxos principais
```

### Backend API

```
Unit:        70% (60-120 testes)
Integration: 25% (20-40 testes)
E2E:         5%  (3-8 testes)

Por quê?
- Foco em contratos
- Integration para endpoints
- Contract testing (CDC) recomendado
```

### Frontend Simples

```
Unit:        75% (40-80 testes)
Integration: 15% (10-20 testes)
E2E:         10% (5-10 testes)

Por quê?
- Componentes isolados
- Smoke tests suficientes
- E2E apenas fluxos críticos
```

---

## 💡 Dicas

### ✅ Faça

- Execute no **início do projeto** (antes de escrever testes)
- Re-execute quando **arquitetura mudar** significativamente
- Use o documento para **justificar decisões** em reviews
- Combine com outras tools: `coverage` → `recommend` → `pyramid`

### ❌ Evite

- Ignorar a recomendação sem justificativa técnica
- Aplicar estratégia genérica (70/20/10) para todos os tipos
- Escrever E2E para CLI/Library (desperdício)
- Esquecer de atualizar após mudanças grandes

---

## 🆘 Troubleshooting

### Erro: "command not found: quality"

```bash
# Compilar o projeto
cd /home/jorgesouza/Documents/dev/mcp-Quality-CLI
npm run build

# Criar alias (adicionar no ~/.bashrc)
alias quality='node /home/jorgesouza/Documents/dev/mcp-Quality-CLI/dist/cli.js'
source ~/.bashrc
```

### Erro: "Cannot find module"

```bash
# Reinstalar dependências
cd /home/jorgesouza/Documents/dev/mcp-Quality-CLI
npm install
npm run build
```

### MCP não encontra a tool

```bash
# Verificar se está no mcp.json
cat ~/.cursor/mcp.json | grep quality

# Recompilar
cd /home/jorgesouza/Documents/dev/mcp-Quality-CLI
npm run build

# Reiniciar o Cursor
```

### Documento não é gerado

```bash
# Verificar permissões
ls -la tests/analyses/

# Criar pasta manualmente
mkdir -p tests/analyses

# Tentar novamente com --auto
quality recommend --repo . --product "Test" --auto
```

---

## 📚 Documentação Completa

- **Funcionalidade:** [docs/RECOMMENDATION-FEATURE.md](docs/RECOMMENDATION-FEATURE.md)
- **Arquitetura:** [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
- **Exemplos:** [docs/EXAMPLES.md](docs/EXAMPLES.md)
- **README:** [README.md](README.md)

---

## 🎊 Teste Agora!

### Via CLI

```bash
cd /home/jorgesouza/Documents/dev/mcp-Quality-CLI
quality recommend --repo . --product "Quality-MCP" --auto
cat tests/analyses/TEST-STRATEGY-RECOMMENDATION.md
```

### Via Chat (aqui mesmo)

```
Use o Quality MCP para analisar o projeto Quality-MCP 
e me dizer se a estratégia de testes está correta
```

---

**Última atualização:** 2025-10-31  
**Versão Quality MCP:** v0.2.0  
**Funcionalidade:** `recommend_test_strategy`

