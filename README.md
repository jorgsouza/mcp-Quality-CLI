# Quality MCP 🎯

**Quality CLI** é um servidor MCP (Model Context Protocol) que automatiza a análise de repositórios e a geração de testes E2E com Playwright.

## ⚡ Quickstart (v0.3.0 - One-Shot com Linguagem Natural)

### 🧠 Comandos em Linguagem Natural

A forma mais fácil de usar o Quality MCP é através de **comandos em linguagem natural** (PT ou EN):

```json
// No seu cliente MCP (Claude, Cline, etc):
{
  "tool": "nl_command",
  "params": {
    "query": "analise meu repositório"
  }
}
```

**Exemplos de comandos:**

```javascript
// Análise completa (auto-detecta tudo)
"analise meu repositório"
"auditar o projeto"
"run everything"

// Apenas análise do código
"apenas analisar o código"
"só mapear endpoints"
"only scan the repo"

// Criar plano de testes
"criar plano de testes"
"gerar estratégia de qualidade"
"create test plan"

// Gerar templates
"scaffold de testes"
"gerar templates de unit tests"
"create test structures"

// Executar testes + cobertura
"rodar testes e calcular cobertura"
"executar testes"
"run tests and validate coverage"
```

### 🚀 Orquestrador Auto

Para controle mais fino, use a tool `auto` diretamente:

```json
{
  "tool": "auto",
  "params": {
    "mode": "full"  // ou: analyze, plan, scaffold, run
  }
}
```

**Modos disponíveis:**

- **`full`** (padrão): Análise completa → Plano → Scaffold → Testes → Cobertura → Relatórios
- **`analyze`**: Apenas análise do código (rotas, endpoints, eventos)
- **`plan`**: Análise + Geração de plano de testes
- **`scaffold`**: Análise + Plano + Templates de testes
- **`run`**: Executa testes existentes + Cobertura + Relatórios

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

### � Artifacts Gerados

Tudo é salvo em `qa/<produto>/tests/analyses/`:

```
qa/
└── my-product/
    ├── mcp-settings.json          # Configuração (auto-gerada)
    └── tests/
        └── analyses/
            ├── analyze.json        # Mapeamento do código
            ├── pyramid-report.json # Visualização da pirâmide
            ├── TEST-PLAN.md        # Plano de testes
            ├── coverage-analysis.json  # Cobertura atual
            ├── diff-coverage.json      # Cobertura do diff
            └── SUMMARY.md          # Resumo executivo
```

---

## �🚀 Funcionalidades

- **🧠 Linguagem Natural**: Comandos em PT/EN ("analise meu repositório")
- **🚀 Orquestrador One-Shot**: Zero-setup, detecta tudo automaticamente
- **Análise Automática**: Detecta rotas, endpoints, eventos e riscos no seu código
- **Geração de Plano**: Cria plano de testes estruturado por domínio/produto
- **Scaffold Inteligente**: Gera estrutura completa de testes Playwright
- **Execução com Cobertura**: Roda testes com relatórios HTML, JUnit, JSON
- **Relatório Executivo**: Consolida resultados para aprovação de QA/Release

## 📋 Pré-requisitos

- Node.js 20+
- npm ou yarn

## 🔧 Instalação

```bash
# Clone o repositório
git clone <repo-url>
cd mcp-Quality-CLI

# Instale as dependências
npm install

# Build
npm run build
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
  --product "ReclameAQUI" \
  --domains "autenticacao,reclamacao,busca" \
  --critical-flows "login,abrir_reclamacao,busca_empresa" \
  --targets '{"ci_p95_min":15,"flaky_pct_max":3,"diff_coverage_min":60}' \
  --base-url "https://staging.ra.com"
```

**Saída**: `plan/analyze.json` com rotas, endpoints, eventos e mapa de riscos.

#### 2. Geração do Plano de Testes

```bash
quality plan \
  --repo . \
  --product "ReclameAQUI" \
  --base-url "https://staging.ra.com" \
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
export E2E_BASE_URL="https://staging.ra.com"
export E2E_USER="test@ra.com"
export E2E_PASS="senha-segura"

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
  --product "ReclameAQUI" \
  --base-url "https://staging.ra.com" \
  --domains "autenticacao,reclamacao,busca" \
  --critical-flows "login,abrir_reclamacao,busca_empresa" \
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
  domains?: string[];        // ex: ["autenticacao","reclamacao"]
  critical_flows?: string[]; // ex: ["login","abrir_reclamacao"]
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
quality full --repo . --product "MeuApp" --base-url "http://localhost:3000"

# 3. Revise os arquivos gerados
# 4. Ajuste os testes conforme necessário
# 5. Execute novamente
quality run --repo . --e2e packages/product-e2e
```

### 2. Projeto Existente

```bash
# 1. Analise o código existente
quality analyze --repo . --product "MeuApp"

# 2. Gere o plano
quality plan --repo . --product "MeuApp" --base-url "http://localhost:3000"

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
