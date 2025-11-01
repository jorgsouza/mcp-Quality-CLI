# 📊 Exemplos de Análises - Quality MCP

Esta pasta contém **exemplos de outputs** gerados pelas ferramentas do Quality MCP.

> ⚠️ **ATENÇÃO:** Estes são arquivos de **exemplo/demonstração**. Quando você executar o Quality MCP no seu projeto, novos arquivos serão gerados aqui e sobrescreverão estes exemplos.

## 📁 Arquivos de Exemplo

### analyze.json
**Análise completa do código-fonte**

Contém a detecção automática de:
- 🔍 Endpoints e rotas (Express, Next.js, NestJS)
- 📡 Event handlers e listeners
- 🎯 Fluxos críticos identificados
- 🏗️ Estrutura de arquivos
- ⚠️ Risk scores calculados

**Gerado por:** `quality analyze` ou `quality auto --mode analyze`

---

### coverage-analysis.json
**Análise de cobertura de testes**

Contém a análise da pirâmide de testes:
- 📊 Distribuição Unit/Integration/E2E
- ✅ Status de saúde (healthy, inverted, needs_attention)
- 📈 Métricas de cobertura
- 🎯 Recomendações de melhoria

**Gerado por:** `quality coverage` ou `quality auto --mode full`

---

### scenario-catalog.json
**Catálogo de cenários de teste**

Lista completa de cenários identificados:
- ✅ Cenários por domínio (auth, dashboard, etc)
- 🔢 Priorização (alta, média, baixa)
- 📝 Descrição de cada cenário
- 🎯 Status de cobertura

**Gerado por:** `quality catalog` ou `quality auto --mode full`

---

### TEST-PLAN.md
**Plano de testes em Markdown**

Documento completo do plano de testes incluindo:
- 📋 Objetivos e escopo
- 🎯 Cenários priorizados
- ✨ **Risk Score Analysis** (v0.3.0+)
- 🚦 **Quality Gates** (v0.3.0+)
- ✅ **TODOs Automáticos** (v0.3.0+)
- 📝 Exemplos de código

**Gerado por:** `quality plan` ou `quality auto --mode plan`

---

### COVERAGE-REPORT.md
**Relatório de cobertura**

Relatório detalhado da pirâmide de testes:
- 📊 Gráfico visual da pirâmide
- 📈 Percentuais por tipo de teste
- ✅ Status de saúde
- 🎯 Recomendações específicas

**Gerado por:** `quality coverage` ou `quality auto --mode full`

---

### PYRAMID-REPORT.html
**Relatório visual HTML**

Relatório interativo com:
- 📊 Gráficos visuais da pirâmide
- 🎨 Código colorido
- 📈 Métricas detalhadas
- 🖱️ Navegação interativa

**Gerado por:** `quality pyramid-report` ou `quality auto --mode full`

**Visualizar:** `open PYRAMID-REPORT.html`

---

## 🔄 Regenerando os Exemplos

Para regenerar todos os exemplos com seus dados reais:

```bash
# Navegar até seu projeto
cd /path/to/seu/projeto

# Executar pipeline completo
quality auto --mode full --repo .

# Os arquivos serão criados em tests/analyses/
ls -la tests/analyses/
```

## 🚫 O que NÃO commitar

Adicione ao seu `.gitignore`:

```gitignore
# Outputs gerados automaticamente (manter apenas exemplos)
tests/analyses/*.json
tests/analyses/*.md
tests/analyses/*.html

# Manter exemplos (opcional)
!tests/analyses/*.example.json
!tests/analyses/*.example.md
```

## 📚 Referências

Para entender como estes arquivos são gerados:

- 📖 [AUTO-GUIDE.md](../docs/guides/AUTO-GUIDE.md) - Pipeline completo
- 🔍 [ARCHITECTURE.md](../docs/architecture/ARCHITECTURE.md) - Estrutura de dados
- ✨ [RISK-SCORE-SYSTEM.md](../docs/features/RISK-SCORE-SYSTEM.md) - Como são calculados os risk scores

---

**Dica:** Use estes exemplos como referência para entender o formato dos outputs antes de executar no seu projeto real.
