# 📚 Índice de Documentação

## 🎯 Documentos Principais (Raiz)

| Documento | Descrição | Audiência |
|-----------|-----------|-----------|
| **[README.md](README.md)** | 📖 Documentação principal do projeto | Todos |
| **[ARCHITECTURE.md](ARCHITECTURE.md)** | 🏗️ Arquitetura técnica completa | Desenvolvedores |
| **[HISTORY.md](HISTORY.md)** | 📜 Histórico de desenvolvimento | Todos |
| **[CHANGELOG.md](CHANGELOG.md)** | 📝 Log de mudanças por versão | Todos |
| **[CONTRIBUTING.md](CONTRIBUTING.md)** | 🤝 Guia para contribuidores | Contribuidores |
| **[CONSOLIDATED-REPORTS.md](CONSOLIDATED-REPORTS.md)** | 📊 Explicação dos relatórios consolidados | Usuários |

---

## 📂 Documentos Organizados (docs/)

### Quality Gates & Setup

| Documento | Descrição |
|-----------|-----------|
| **[docs/QUALITY-GATES-GUIDE.md](docs/QUALITY-GATES-GUIDE.md)** | 🎯 Guia completo de Quality Gates |
| **[docs/SETUP-BY-LANGUAGE.md](docs/SETUP-BY-LANGUAGE.md)** | 🌐 Setup detalhado por linguagem |
| **[docs/USAGE-BY-STACK.md](docs/USAGE-BY-STACK.md)** | 💼 Guias de uso por stack |

### CI/CD Templates

| Documento | Descrição |
|-----------|-----------|
| **[docs/ci-cd/gitlab-ci.yml](docs/ci-cd/gitlab-ci.yml)** | GitLab CI exemplo |
| **[docs/ci-cd/Jenkinsfile](docs/ci-cd/Jenkinsfile)** | Jenkins pipeline exemplo |
| **[docs/ci-cd/azure-pipelines.yml](docs/ci-cd/azure-pipelines.yml)** | Azure Pipelines exemplo |

---

## 🔧 Documentos Gerados (qa/)

Estes são **gerados automaticamente** pelo CLI:

### Por Produto

```
qa/<product>/
├── GETTING_STARTED.md       # Quickstart do produto
├── README.md                 # Overview do produto
└── tests/reports/
    ├── CODE-ANALYSIS.md      # 📊 Análise de código consolidada
    ├── TEST-PLAN.md          # 📋 Plano de testes consolidado
    ├── SELF-CHECK.md         # ✅ Verificação de ambiente
    ├── dashboard.html        # 🎨 Dashboard interativo
    ├── diff-coverage.json    # 🔀 Diff coverage (PR-aware)
    ├── mutation-score.json   # 🧬 Mutation testing
    └── contracts-verify.json # 🤝 CDC/Pact verification
```

---

## 🗺️ Mapa de Navegação

### Estou começando 🚀
1. **[README.md](README.md)** - Instalação e quickstart
2. **[docs/SETUP-BY-LANGUAGE.md](docs/SETUP-BY-LANGUAGE.md)** - Setup da minha linguagem
3. **[docs/USAGE-BY-STACK.md](docs/USAGE-BY-STACK.md)** - Exemplos práticos

### Quero entender a arquitetura 🏗️
1. **[ARCHITECTURE.md](ARCHITECTURE.md)** - Arquitetura completa
2. **[HISTORY.md](HISTORY.md)** - Como chegamos aqui

### Quero contribuir 🤝
1. **[CONTRIBUTING.md](CONTRIBUTING.md)** - Guia de contribuição
2. **[ARCHITECTURE.md](ARCHITECTURE.md)** - Entender a arquitetura
3. **[CHANGELOG.md](CHANGELOG.md)** - Versões anteriores

### Preciso de Quality Gates 🎯
1. **[docs/QUALITY-GATES-GUIDE.md](docs/QUALITY-GATES-GUIDE.md)** - Guia completo
2. **[docs/ci-cd/](docs/ci-cd/)** - Templates CI/CD
3. **[CONSOLIDATED-REPORTS.md](CONSOLIDATED-REPORTS.md)** - Entender os relatórios

### Estou debugando 🐛
1. **qa/<product>/tests/reports/SELF-CHECK.md** - Verificar ambiente
2. **qa/<product>/tests/reports/CODE-ANALYSIS.md** - Ver análise
3. **qa/<product>/tests/reports/dashboard.html** - Métricas visuais

---

## 📊 Estrutura Visual

```
mcp-Quality-CLI/
│
├── 📖 README.md              ← START HERE
├── 🏗️ ARCHITECTURE.md
├── 📜 HISTORY.md
├── 📝 CHANGELOG.md
├── 🤝 CONTRIBUTING.md
├── 📊 CONSOLIDATED-REPORTS.md
├── 📚 DOCS-INDEX.md          ← VOCÊ ESTÁ AQUI
│
├── docs/
│   ├── 🎯 QUALITY-GATES-GUIDE.md
│   ├── 🌐 SETUP-BY-LANGUAGE.md
│   ├── 💼 USAGE-BY-STACK.md
│   └── ci-cd/
│       ├── gitlab-ci.yml
│       ├── Jenkinsfile
│       └── azure-pipelines.yml
│
├── qa/
│   ├── <product-1>/
│   │   ├── GETTING_STARTED.md
│   │   ├── README.md
│   │   └── tests/reports/
│   │       ├── CODE-ANALYSIS.md
│   │       ├── TEST-PLAN.md
│   │       ├── SELF-CHECK.md
│   │       ├── dashboard.html
│   │       └── ...
│   └── <product-2>/
│       └── ...
│
└── src/
    └── tools/templates/
        └── GETTING_STARTED.md  (template)
```

---

## ✨ Documentos Consolidados

### Antes (Redundante) ❌
- ~~COMPLETUDE-FINAL-V1.2.md~~
- ~~COMPLETUDE-MULTI-LINGUAGEM-v2.md~~
- ~~PLANO-MULTI-LINGUAGEM.md~~
- ~~CORRECAO-CIRURGICA-FINAL.md~~
- ~~VALIDACAO-FINAL-100.md~~
- ~~OTIMIZACOES-3-PASSOS.md~~
- ~~PENDENCIAS-RESOLVIDAS.md~~
- ~~docs/ADAPTER-ARCHITECTURE.md~~
- ~~docs/ENGINE-INTEGRATION.md~~
- ~~docs/STATUS-ARQUITETURA.md~~

### Agora (Consolidado) ✅
- **[HISTORY.md](HISTORY.md)** - Todo o histórico em 1 lugar
- **[ARCHITECTURE.md](ARCHITECTURE.md)** - Toda a arquitetura em 1 lugar

**Redução**: 10 documentos → 2 documentos consolidados 🎉

---

## 🔍 Busca Rápida

| Procurando por... | Veja |
|-------------------|------|
| Como instalar | [README.md](README.md) |
| Setup Java | [docs/SETUP-BY-LANGUAGE.md](docs/SETUP-BY-LANGUAGE.md#java) |
| Setup Python | [docs/SETUP-BY-LANGUAGE.md](docs/SETUP-BY-LANGUAGE.md#python) |
| Setup Go | [docs/SETUP-BY-LANGUAGE.md](docs/SETUP-BY-LANGUAGE.md#go) |
| Arquitetura de adapters | [ARCHITECTURE.md](ARCHITECTURE.md#sistema-de-adapters) |
| Quality Gates | [docs/QUALITY-GATES-GUIDE.md](docs/QUALITY-GATES-GUIDE.md) |
| CI/CD GitLab | [docs/ci-cd/gitlab-ci.yml](docs/ci-cd/gitlab-ci.yml) |
| Histórico v2.0 | [HISTORY.md](HISTORY.md#fase-3-multi-linguagem-v20---atual) |
| Como contribuir | [CONTRIBUTING.md](CONTRIBUTING.md) |
| Changelog v0.4 | [CHANGELOG.md](CHANGELOG.md) |

---

**Última atualização**: 2025-11-04
**Versão**: v2.0.0
**Total de documentos**: 6 principais + 3 docs/ + templates/gerados

