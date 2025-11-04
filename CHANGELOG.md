# Changelog

Todas as mudanças notáveis neste projeto serão documentadas neste arquivo.

O formato é baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.0.0/),
e este projeto adere ao [Versionamento Semântico](https://semver.org/lang/pt-BR/).

---

## [1.0.0] - 2024-11-04 - V1.0 ULTIMATE 🎉

### ✨ Adicionado

#### Quality Gates (Opcional - User-Activated)
- **Mutation Testing**: Tool completo com suporte para Stryker, mutmut, go-mutesting e PIT
- **Production Metrics (DORA)**: Coleta de métricas de Sentry, Datadog, Grafana e Jira
  - Deployment Frequency
  - Lead Time for Changes
  - Change Failure Rate (CFR)
  - Mean Time To Recovery (MTTR)
  - Classificação DORA Tier (Elite/High/Medium/Low)
- **SLO Canary Check**: Comparação de prod metrics vs SLOs definidos
- **Release Quality Gates**: Validação final com exit codes 0/1/2 para CI/CD
  - Exit 0: ✅ All gates passed
  - Exit 1: ❌ Blocking violations
  - Exit 2: ⚠️ Non-blocking warnings
- **Suite Health**: Análise de flakiness, runtime e parallelism

#### Multi-Language Support Completo
- **Java**: Suporte completo com JUnit/TestNG + Maven/Gradle + JaCoCo + PIT
- **Python**: pytest/unittest + coverage.py + mutmut
- **Go**: go test + gocov + go-mutesting
- **TypeScript/JavaScript**: Vitest/Jest/Mocha + Stryker

#### Documentation
- **QUALITY-GATES-GUIDE.md**: Guia completo de 731 linhas sobre Quality Gates
- **CI/CD Examples**: 4 pipelines prontos (GitHub Actions, GitLab CI, Jenkins, Azure Pipelines)
- **SETUP-BY-LANGUAGE.md**: Guias de setup por linguagem
- **USAGE-BY-STACK.md**: Guias de uso por stack tecnológico

#### MCP Tools
- `run_mutation_tests`: Executa mutation testing em módulos críticos
- `release_quality_gate`: Aplica quality gates e retorna exit code
- `prod_metrics_ingest`: Coleta métricas DORA de fontes externas
- `slo_canary_check`: Compara prod metrics vs SLOs

#### Adapters
- `sentry-adapter.ts`: Coleta erros e releases do Sentry
- `datadog-adapter.ts`: Coleta métricas APM do Datadog
- `grafana-adapter.ts`: Coleta métricas de dashboards do Grafana
- `jira-adapter.ts`: Coleta incidents do Jira

### 🔧 Modificado
- Pipeline `auto.ts` expandido para 13 phases (era 9)
- Interface `AutoResult` agora inclui métricas de mutation, prod_metrics, slo_canary e quality_gate
- README.md completamente atualizado com seção de Quality Gates
- MCP Server atualizado para v0.4.0 com 9 tools (5 originais + 4 Quality Gates)

### 🗑️ Removido
- Workflow automático `.github/workflows/quality-gates.yml` (Quality Gates agora é opcional)
- Múltiplos arquivos .md fragmentados (consolidados no README e guias principais)
- Documentação desatualizada em `docs/architecture`, `docs/features`, `docs/guides`

### 🐛 Corrigido
- Type errors no pipeline de mutation testing
- Exit codes do quality gate agora seguem convenção (0/1/2)
- Mocks dos adapters externos para funcionar sem credenciais

---

## [0.4.0] - 2024-11-04 - Quality Gates Beta

### Adicionado
- Mutation Testing básico
- DORA Metrics (protótipo)
- SLO Canary (protótipo)

---

## [0.3.1] - 2024-11-03 - Retorno Estruturado

### Adicionado
- Retorno estruturado do comando `auto` com paths organizados
- Interface `AutoResult` com outputs categorizados

### Modificado
- README atualizado com exemplo de retorno estruturado

---

## [0.3.0] - 2024-11-02 - Linguagem Natural

### Adicionado
- Suporte a comandos em linguagem natural (português e inglês)
- Detecção inteligente de modo (full/analyze/plan/scaffold/run)
- Extração de parâmetros de texto livre

---

## [0.2.0] - 2024-11-01 - Multi-Language

### Adicionado
- Suporte inicial para Python (pytest)
- Suporte inicial para Go (go test)
- Language adapters architecture

---

## [0.1.0] - 2024-10-30 - Initial Release

### Adicionado
- Análise automática de código TypeScript/JavaScript
- Geração de planos de teste
- Scaffold de testes E2E com Playwright
- Coverage analysis
- Dashboard HTML interativo
- MCP Server com 5 tools básicos

---

## Tipos de Mudanças

- **Adicionado**: para novas funcionalidades
- **Modificado**: para mudanças em funcionalidades existentes
- **Depreciado**: para funcionalidades que serão removidas
- **Removido**: para funcionalidades removidas
- **Corrigido**: para correções de bugs
- **Segurança**: para vulnerabilidades

---

**Versão Atual**: 1.0.0 ULTIMATE ✨  
**Status**: Stable  
**Data**: 2024-11-04
