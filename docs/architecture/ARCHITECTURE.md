# Arquitetura do Quality MCP

Este documento descreve a arquitetura técnica do Quality MCP.

## 🏗️ Visão Geral

O Quality MCP é composto por três camadas principais:

```
┌─────────────────────────────────────────┐
│         Interface Layer                 │
│  ┌──────────────┐   ┌──────────────┐   │
│  │  MCP Server  │   │  CLI Wrapper │   │
│  └──────────────┘   └──────────────┘   │
└─────────────────────────────────────────┘
                 │
┌─────────────────────────────────────────┐
│         Business Logic Layer            │
│  ┌──────────┐  ┌──────────┐           │
│  │  Tools   │  │Detectors │           │
│  └──────────┘  └──────────┘           │
└─────────────────────────────────────────┘
                 │
┌─────────────────────────────────────────┐
│         Infrastructure Layer            │
│  ┌──────────┐  ┌──────────┐           │
│  │   FS     │  │ External │           │
│  │  Utils   │  │   APIs   │           │
│  └──────────┘  └──────────┘           │
└─────────────────────────────────────────┘
```

## 📦 Componentes

### 1. Interface Layer

#### MCP Server (`src/server.ts`)

- **Responsabilidade**: Expor ferramentas via Model Context Protocol
- **Protocolo**: JSON-RPC over stdio
- **Ferramentas expostas**: 5 tools principais
- **Validação**: Zod schemas

```typescript
// Fluxo de uma chamada
1. Cliente MCP envia request JSON-RPC
2. Server valida com Zod
3. Delega para tool apropriada
4. Retorna resultado JSON
```

#### CLI Wrapper (`src/cli.ts`)

- **Responsabilidade**: Interface de linha de comando
- **Framework**: Commander.js
- **Comandos**: analyze, plan, scaffold, run, report, full
- **Saída**: JSON ou texto formatado

### 2. Business Logic Layer

#### Tools (`src/tools/`)

Implementam a lógica de negócio principal:

**analyze.ts**
```typescript
Input: Caminho do repo, produto, domínios, fluxos críticos
Output: Análise com rotas, endpoints, eventos, mapa de riscos
Lógica:
  1. Invoca detectores
  2. Classifica riscos
  3. Gera recomendações
  4. Salva analyze.json
```

**plan.ts**
```typescript
Input: Análise, produto, base URL
Output: Plano de testes em Markdown
Lógica:
  1. Template de plano
  2. Insere dados da análise
  3. Adiciona exemplos (opcional)
  4. Salva TEST-PLAN.md
```

**scaffold.ts**
```typescript
Input: Plano, diretório de saída
Output: Estrutura Playwright completa
Lógica:
  1. Cria estrutura de pastas
  2. Gera playwright.config.ts
  3. Cria specs por domínio
  4. Gera fixtures e utils
  5. Cria package.json local
```

**run.ts**
```typescript
Input: Diretório E2E, configurações
Output: Resultados da execução
Lógica:
  1. Instala browsers Playwright
  2. Executa npx playwright test
  3. Coleta relatórios
  4. Retorna status e caminhos
```

**report.ts**
```typescript
Input: Diretório de relatórios, thresholds
Output: SUMMARY.md consolidado
Lógica:
  1. Lê results.json do Playwright
  2. Extrai estatísticas
  3. Calcula métricas (flaky%, pass rate)
  4. Compara com thresholds
  5. Gera Markdown formatado
```

#### Detectors (`src/detectors/`)

Analisam código-fonte para extrair informações:

**next.ts**
```typescript
Detecta:
  - Rotas app directory (app/**/page.tsx)
  - Rotas pages directory (pages/**/*.tsx)
  - Dynamic routes ([param])

Retorna: Array de rotas (strings)
```

**express.ts**
```typescript
Detecta:
  - router.get/post/put/delete
  - app.METHOD()
  - OpenAPI specs (openapi.*.yml/json)

Retorna: Array de endpoints { method, path, file }
```

**events.ts**
```typescript
Detecta:
  - Kafka (producer.send, consumer.subscribe)
  - AWS SQS/SNS (sendMessage, subscribe)
  - Event emitters (.emit())

Retorna: Array de eventos (strings)
```

### 3. Infrastructure Layer

#### Utils (`src/utils/fs.ts`)

Utilitários de filesystem:

```typescript
- ensureDir(): Cria diretório recursivamente
- writeFileSafe(): Escreve arquivo com criação de dir
- readFile(): Lê arquivo
- fileExists(): Verifica existência
- readDir(): Lista conteúdo
```

#### External APIs

- **Playwright**: Execução de testes
- **Glob**: Busca de arquivos
- **Zod**: Validação de schemas

## 🔄 Fluxos de Dados

### Fluxo Completo (full command)

```
┌─────────┐
│  User   │
└────┬────┘
     │ quality full --repo . --product X
     ▼
┌─────────────┐
│  CLI Entry  │
└──────┬──────┘
       │
       ▼
┌──────────────┐      ┌──────────────┐
│   analyze    │─────▶│  Detectors   │
└──────┬───────┘      └──────────────┘
       │ analyze.json
       ▼
┌──────────────┐
│     plan     │
└──────┬───────┘
       │ TEST-PLAN.md
       ▼
┌──────────────┐
│   scaffold   │
└──────┬───────┘
       │ packages/product-e2e/
       ▼
┌──────────────┐      ┌──────────────┐
│     run      │─────▶│  Playwright  │
└──────┬───────┘      └──────────────┘
       │ reports/
       ▼
┌──────────────┐
│    report    │
└──────┬───────┘
       │ SUMMARY.md
       ▼
┌─────────┐
│  User   │
└─────────┘
```

### Fluxo MCP Server

```
┌────────────┐
│   Claude   │
│  (Client)  │
└─────┬──────┘
      │ JSON-RPC over stdio
      ▼
┌─────────────────┐
│   MCP Server    │
│  ┌───────────┐  │
│  │ Handler   │  │
│  │  Zod      │  │
│  │ Validate  │  │
│  └─────┬─────┘  │
└────────┼────────┘
         │
         ▼
┌─────────────────┐
│   Tool Logic    │
│  (analyze,      │
│   plan, etc)    │
└────────┬────────┘
         │
         ▼
┌─────────────────┐
│   File System   │
│   + External    │
└─────────────────┘
```

## 🧩 Extensibilidade

### Adicionar Novo Detector

```typescript
// 1. Criar src/detectors/vue.ts
export async function findVueRoutes(repo: string): Promise<string[]> {
  // Implementação
}

// 2. Integrar em src/tools/analyze.ts
import { findVueRoutes } from '../detectors/vue.js';

const vueRoutes = await findVueRoutes(input.repo);
```

### Adicionar Nova Tool

```typescript
// 1. Criar src/tools/contract.ts
export interface ContractParams { ... }
export async function generateContracts(params: ContractParams) {
  // Implementação
}

// 2. Adicionar schema em src/server.ts
const ContractSchema = z.object({ ... });

// 3. Registrar handler
server.setRequestHandler(...);

// 4. Adicionar comando CLI em src/cli.ts
program.command('contract')...
```

### Adicionar Novo Report Format

```typescript
// 1. Estender src/tools/report.ts
export async function buildHTMLReport(params: BuildReportParams) {
  // Gera HTML interativo
}

// 2. Adicionar opção no CLI
program.command('report')
  .option('--format <type>', 'Format: markdown|html|json')
```

## 🔐 Segurança

### Validação de Entrada

- Todos os inputs são validados com Zod
- Caminhos são resolvidos e verificados
- Comandos shell são parametrizados

### Credenciais

- Nunca hardcoded
- Sempre via variáveis de ambiente
- Não logadas em saída

### Filesystem

- Operações apenas em diretórios permitidos
- Verificação de existência antes de escrita
- Criação segura de diretórios

## 📊 Performance

### Otimizações

1. **Detecção Paralela**: Detectores rodam concorrentemente
2. **Glob Eficiente**: Usa ignore patterns
3. **Cache**: Resultados intermediários salvos
4. **Streaming**: Logs em tempo real

### Benchmarks

- Análise de repo médio: ~2-5s
- Scaffold completo: ~1s
- Execução de testes: variável (depende dos testes)
- Geração de relatório: ~500ms

## 🧪 Testes

### Estratégia de Testes

```
src/
├── tools/
│   ├── analyze.ts
│   └── analyze.test.ts    # Unit tests
├── detectors/
│   ├── next.ts
│   └── next.test.ts       # Unit tests
└── integration/
    └── full-flow.test.ts  # Integration tests
```

### Cobertura Alvo

- Unit tests: >80%
- Integration tests: Fluxos críticos
- E2E: Pipeline completo

## 📈 Métricas e Observabilidade

### Logs

```typescript
// Estrutura de log
console.log('🔍 Analisando...');  // Progress
console.log('✅ Concluído');      // Success
console.error('❌ Erro:', err);   // Error
```

### Métricas Coletadas

- Tempo de execução por tool
- Número de rotas/endpoints detectados
- Taxa de sucesso dos testes
- Flaky rate
- Coverage

## 🔮 Evolução Futura

### Próximas Versões

**v0.2.0**
- Support para mais frameworks (Vue, Svelte)
- API testing (REST/GraphQL)
- Dashboard web

**v0.3.0**
- Mutation testing
- Visual regression
- A11y testing

**v1.0.0**
- Plugin system
- Cloud integration
- Enterprise features

## 📚 Referências

- [Model Context Protocol](https://modelcontextprotocol.io)
- [Playwright](https://playwright.dev)
- [Zod](https://zod.dev)
- [Commander.js](https://github.com/tj/commander.js)

