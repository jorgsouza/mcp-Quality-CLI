# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.3.0] - 2025-11-01

### 🎉 Major Features

#### MCP "One-Shot" com Linguagem Natural

- **Tool `nl_command`**: Comandos em linguagem natural (PT/EN)
  - Exemplos: "analise meu repositório", "criar plano", "rodar testes"
  - Parser inteligente detecta intenção automaticamente
  - Suporta overrides no texto: `repo:/path product:Name mode:analyze`
  - Merge com defaults globais

- **Tool `auto`**: Orquestrador completo com zero-setup
  - 5 modos: `full`, `analyze`, `plan`, `scaffold`, `run`
  - Auto-detecção de repositório (busca por `.git` ou `package.json`)
  - Inferência de produto do `package.json` ou nome da pasta
  - Detecção recursiva de testes existentes
  - Identificação de framework (vitest/jest/mocha) e linguagem (TS/JS)

#### Supertest & Testcontainers Templates 🚀 NEW

- **Templates Avançados para `scaffold-integration`**:
  - `helpers/supertest-client.ts`: Cliente HTTP para testar Express sem servidor
  - `helpers/testcontainers.ts`: Manager de containers (PostgreSQL, Redis, MongoDB)
  - `examples/supertest.example.test.ts`: 6 exemplos práticos de Supertest
  - `examples/testcontainers.example.test.ts`: 7 exemplos com PostgreSQL real

- **Auto-instalação de Dependências**:
  - Adiciona `supertest`, `testcontainers`, `pg` ao `package.json` automaticamente
  - Instruções de instalação no console
  - Guia completo em `docs/SUPERTEST-TESTCONTAINERS.md`

#### Risk Score System & Enhanced Test Plans 📊 NEW

- **Sistema de Cálculo de Risco Probabilístico**:
  - Formula: `Risk Score = Probability × Impact` (0-100)
  - **Probability** = changeFrequency(40%) + recentBugs(35%) + complexity(25%)
  - **Impact** = testCoverage(40%) + isCriticalFlow(35%) + isUserFacing(25%)
  - Níveis: CRITICAL (80+), HIGH (60-79), MEDIUM (40-59), LOW (<40)
  - Funções: `calculateRiskScore()`, `groupByRiskLevel()`, `estimateComplexity()`

- **Enhanced Test Plans com Risk Scores**:
  - Seção **Risk Score Analysis** automática nos planos
  - Endpoints ordenados por criticidade (🔴 CRITICAL → 🟠 HIGH → 🟡 MEDIUM → 🟢 LOW)
  - Mostra probability, impact e score detalhado para cada endpoint
  - Recomendação: priorizar endpoints CRITICAL/HIGH primeiro

- **TODOs Automáticos Inteligentes**:
  - Seção **Ações Recomendadas** gerada automaticamente
  - Sugere OpenAPI spec para contract testing
  - Sugere auth fixtures para E2E
  - Sugere Testcontainers para integração
  - Sugere configuração de CI/CD

- **Quality Gates Explícitos**:
  - Thresholds configuráveis (coverage, flaky rate, build time)
  - Critérios de bloqueio bem definidos
  - Integração com settings via `targets.diff_coverage_min`, `flaky_pct_max`, `ci_p95_min`

### ✨ New Features

- **Configuração Agnóstica**: Config genérica funciona para qualquer time/produto
  - Defaults: `localhost:3000`, listas vazias, nomes genéricos
  - Função `inferProductFromPackageJson()` para auto-detecção
  - Geração automática de `mcp-settings.example.json`

- **Orquestração Inteligente**: Fluxos automatizados completos
  - Modo `full`: analyze → plan → scaffold → run → coverage → reports
  - Modo `analyze`: apenas análise do código
  - Modo `plan`: análise + plano de testes
  - Modo `scaffold`: análise + plano + templates
  - Modo `run`: executa testes + cobertura

- **Extração de Overrides**: Parse de parâmetros do texto
  - `repo:/path/to/repo` → override de repositório
  - `product:MyApp` → override de produto
  - `mode:analyze` → override de modo
  - Precedência: override > defaults > detectado

- **Progress Tracking**: Logging detalhado com emojis coloridos
  - 🧠 Natural Language Command Interface
  - 🚀 Executando modo AUTO
  - 📁 Repositório detectado
  - 🧪 Framework identificado
  - ✅ Análise completa

### 🔧 Improvements

- **Config Utils**: Funções utilitárias aprimoradas
  - `loadMCPSettings()` com fallbacks inteligentes
  - `createMCPSettingsTemplate()` com defaults universais
  - Validação de esquema JSON

- **Error Handling**: Tratamento robusto de erros
  - Validação Zod para schemas MCP
  - Mensagens de erro úteis e claras
  - Logging de intenções e overrides

- **Test Detection**: Busca recursiva de testes
  - Suporta: `tests/`, `test/`, `__tests__/`, `spec/`, `qa/`
  - Padrões: `*.test.*`, `*.spec.*`
  - Traversa toda a árvore de diretórios

### 📚 Documentation

- **Quickstart Zero-Setup**: Novo README com início rápido
  - Comandos em linguagem natural
  - Exemplos PT/EN
  - O que o One-Shot faz automaticamente
  - Artifacts gerados

- **NL-GUIDE.md**: Guia completo de comandos naturais
  - Sintaxe básica e overrides
  - Padrões reconhecidos (PT/EN)
  - Exemplos por persona (DEV/QA/LEAD)
  - Troubleshooting

- **AUTO-GUIDE.md**: Guia do orquestrador
  - Detalhamento de cada modo
  - Auto-detecção explicada
  - Fluxos de execução (diagramas)
  - Artifacts por modo (tabela)
  - Performance e otimizações
  - Integração CI/CD

- **SUPERTEST-TESTCONTAINERS.md**: Guia de templates avançados 🚀 NEW
  - Quando usar Supertest vs Testcontainers
  - Instalação e setup
  - Exemplos práticos (15+ code snippets)
  - Boas práticas e troubleshooting
  - Performance tips

### 🧪 Tests

- **Unit Tests**: 275 testes unitários
  - `auto.test.ts`: 14 testes (detectRepoContext, modos, skip flags)
  - `nl-command.test.ts`: 23 testes (detectMode, extractOverrides, nlCommand)
  - `config.test.ts`: 23 testes (inferência, defaults, validações)

- **Integration Tests**: 23 testes de integração
  - `mcp-server.test.ts`: Validação de tools, schemas, fluxos
  - ListTools: prioridade nl_command e auto
  - Schema validation: estrutura e tipos
  - Integration flow: nl_command → auto

- **E2E Tests**: 32 testes end-to-end
  - `nl-command-flow.spec.ts`: 16 testes (comandos PT/EN, overrides, defaults, error handling)
  - `auto-full-cycle.spec.ts`: 16 testes (modos, auto-detecção, frameworks, error handling)

### 📊 Metrics

- **Total de testes**: 330 (de 238 em v0.2.0)
  - +37 testes unitários
  - +23 testes de integração
  - +32 testes E2E
- **Test Files**: 34 (de 30)
- **Cobertura**: Mantida em ~100% das funções críticas
- **Novas tools MCP**: 2 (`nl_command`, `auto`)
- **Novas funções exportadas**: 8
- **Linhas de código**: +1,800 linhas (~25% de crescimento)

### 🎯 Breaking Changes

- Nenhum! v0.3.0 é totalmente compatível com v0.2.0
- Todas as tools antigas continuam funcionando
- `nl_command` e `auto` são adições, não substituições

### 🔄 Migration Guide

Não há migração necessária. Para aproveitar as novas funcionalidades:

**Antes (v0.2.0)**:
```json
{
  "tool": "analyze_codebase",
  "params": {
    "repo": "/path",
    "product": "MyApp",
    "domains": ["auth", "billing"],
    "base_url": "http://localhost:3000"
  }
}
```

**Depois (v0.3.0)** - Opção 1 (Natural Language):
```json
{
  "tool": "nl_command",
  "params": {
    "query": "analise meu repositório"
  }
}
```

**Depois (v0.3.0)** - Opção 2 (Auto):
```json
{
  "tool": "auto",
  "params": {
    "mode": "full"
  }
}
```

### 📝 Notes

- Todos os commits seguem Conventional Commits
- Fase 1: Config Agnóstica (fa46d3a) - 6 testes
- Fase 2: Orquestrador auto.ts (b544fe1) - 14 testes
- Fase 3: Linguagem Natural (538eb34) - 23 testes
- Fase 4: Integração MCP Server (63c276e) - schemas + handlers
- Fase 4: Testes de Integração (bd830ff) - 23 testes

---

## [0.1.0] - 2025-10-31

### Added

- Initial release of Quality MCP
- MCP server with 5 core tools:
  - `analyze_codebase`: Detect routes, endpoints, events, and risks
  - `generate_test_plan`: Generate Playwright test plans
  - `scaffold_playwright`: Create Playwright test structure
  - `run_playwright`: Execute tests with coverage
  - `build_report`: Generate QA summary reports
- CLI wrapper with commands: analyze, plan, scaffold, run, report, full
- Detectors for:
  - Next.js routes (app and pages directory)
  - Express/Fastify routes
  - OpenAPI specifications
  - Event emitters (Kafka, SQS, generic events)
- GitHub Actions workflows:
  - CI for pull requests
  - Nightly full test suite
- Comprehensive documentation
- Examples and templates
- Automatic test scaffolding with:
  - Auth tests
  - Form validation tests
  - Search tests
  - Fixtures and utilities

### Features

- Automatic risk assessment based on code analysis
- Flaky test detection and reporting
- Quality gates (CI p95, flaky rate, diff coverage)
- Multi-browser support (Chromium, Firefox, WebKit)
- HTML, JUnit, and JSON reporting
- Slack notifications for CI failures
- PR comments with test results

## [Unreleased]

### Planned

- Support for API testing (REST/GraphQL)
- Cypress integration
- Mutation testing support
- Web dashboard for metrics visualization
- Jira/Linear integration for flaky test tracking
- Multi-environment support (dev, staging, prod)
- Automatic mock generation
- Performance testing integration
- Visual regression testing
- A11y testing integration

