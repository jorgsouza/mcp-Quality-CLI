# Guia de Início Rápido 🚀

Este guia vai te ajudar a começar a usar o Quality MCP em poucos minutos.

## 📦 Instalação Rápida

```bash
# 1. Clone o repositório
git clone https://github.com/seu-usuario/mcp-Quality-CLI.git
cd mcp-Quality-CLI

# 2. Instale dependências
npm install

# 3. Build
npm run build

# 4. Configure variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações
```

## 🎮 Primeiro Uso

### Opção 1: CLI (Mais Simples)

```bash
# Teste o CLI
node dist/cli.js --help

# Execute o pipeline completo no seu projeto
cd /path/to/seu/projeto
node /path/to/mcp-Quality-CLI/dist/cli.js full \
  --repo . \
  --product "MeuApp" \
  --base-url "http://localhost:3000"
```

### Opção 2: MCP Server (Para uso com Claude/Cline)

1. **Configure o MCP Server**

Edite seu arquivo de configuração MCP (localização varia por ferramenta):

**Claude Desktop**: `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS)

**Cline**: Settings → MCP Servers

```json
{
  "mcpServers": {
    "quality": {
      "command": "node",
      "args": ["/caminho/absoluto/para/mcp-Quality-CLI/dist/server.js"],
      "env": {
        "E2E_BASE_URL": "http://localhost:3000",
        "E2E_USER": "test@example.com",
        "E2E_PASS": "test123"
      }
    }
  }
}
```

2. **Reinicie o Claude/Cline**

3. **Use as ferramentas MCP**

No Claude, você pode pedir:

> "Analise meu repositório em /path/to/projeto e gere um plano de testes E2E"

O Claude vai usar automaticamente as ferramentas MCP disponíveis.

## 📝 Exemplo Prático: Projeto React

```bash
# 1. Navegue até seu projeto
cd ~/projetos/meu-app-react

# 2. Configure variáveis de ambiente
export E2E_BASE_URL="http://localhost:3000"
export E2E_USER="test@example.com"
export E2E_PASS="test123"

# 3. Execute o pipeline completo
/path/to/mcp-Quality-CLI/dist/cli.js full \
  --repo . \
  --product "MeuAppReact" \
  --base-url "$E2E_BASE_URL" \
  --domains "auth,dashboard,settings" \
  --critical-flows "login,signup,checkout"

# 4. Arquivos gerados:
# ✅ plan/analyze.json - Análise do código
# ✅ plan/TEST-PLAN.md - Plano de testes
# ✅ packages/product-e2e/ - Testes Playwright
# ✅ reports/ - Relatórios de execução
# ✅ SUMMARY.md - Resumo para QA

# 5. Visualize o relatório HTML
open reports/html/index.html
```

## 🎯 Fluxo de Trabalho Recomendado

### Para um Novo Projeto

```bash
# 1. Análise inicial
quality analyze --repo . --product "MeuApp"

# 2. Revise o resultado em plan/analyze.json
cat plan/analyze.json

# 3. Gere o plano de testes
quality plan \
  --repo . \
  --product "MeuApp" \
  --base-url "http://localhost:3000" \
  --include-examples

# 4. Revise e ajuste o plano em plan/TEST-PLAN.md
vim plan/TEST-PLAN.md

# 5. Crie os testes
quality scaffold --repo . --plan plan/TEST-PLAN.md

# 6. Revise e customize os testes gerados
vim packages/product-e2e/tests/auth/login.spec.ts

# 7. Execute os testes
quality run --repo . --e2e packages/product-e2e

# 8. Gere o relatório
quality report --in reports --out SUMMARY.md
```

### Para um Projeto Existente com Testes

```bash
# Se você já tem testes Playwright, apenas execute:
quality run --repo . --e2e ./e2e --report ./test-reports

# Depois gere o relatório consolidado:
quality report --in test-reports --out SUMMARY.md
```

## 🔧 Customização dos Testes

Depois do scaffold, você pode customizar:

### 1. Configuração do Playwright

Edite `packages/product-e2e/playwright.config.ts`:

```typescript
export default defineConfig({
  // Adicione seus projetos
  projects: [{ name: "mobile", use: devices["iPhone 13"] }],

  // Configure workers
  workers: 4,

  // Timeouts
  timeout: 60_000,
});
```

### 2. Fixtures Customizadas

Edite `packages/product-e2e/fixtures/auth.ts` para implementar autenticação real.

### 3. Dados de Teste

Edite `packages/product-e2e/utils/test-data.ts` para seus dados específicos.

### 4. Adicione Novos Testes

```bash
cd packages/product-e2e/tests
mkdir payments
vim payments/checkout.spec.ts
```

## 🚀 Integração com CI/CD

### GitHub Actions

1. **Copie os workflows**

```bash
cp -r .github/workflows /path/to/seu/projeto/
```

2. **Configure secrets no GitHub**

Settings → Secrets and variables → Actions → New repository secret:

- `E2E_BASE_URL`
- `E2E_BASE_URL_STAGING`
- `E2E_USER`
- `E2E_PASS`
- `SLACK_WEBHOOK_URL` (opcional)

3. **Commit e push**

```bash
git add .github/workflows
git commit -m "ci: adiciona workflows de E2E testing"
git push
```

Pronto! Seus testes vão rodar automaticamente em PRs e daily.

### Outros CIs

Para GitLab CI, CircleCI, etc., adapte os comandos dos workflows:

```yaml
# Exemplo genérico
script:
  - npm install -g /path/to/quality-mcp
  - quality full --repo . --product "MeuApp" --base-url "$E2E_BASE_URL"
```

## 💡 Dicas

### 1. Execute testes específicos

```bash
# Apenas testes de auth
cd packages/product-e2e
npx playwright test tests/auth

# Um teste específico
npx playwright test tests/auth/login.spec.ts

# Debug mode
npx playwright test --debug
```

### 2. Update browsers

```bash
cd packages/product-e2e
npx playwright install
```

### 3. Veja relatórios anteriores

```bash
cd packages/product-e2e
npm run report
```

### 4. Configure VS Code

Instale a extensão Playwright Test for VS Code para:

- Rodar testes diretamente do editor
- Debug interativo
- Ver testes na sidebar

## 📚 Próximos Passos

1. ✅ Rode seu primeiro pipeline completo
2. 📖 Leia o [README.md](README.md) para entender todas as opções
3. 🔧 Customize os testes gerados
4. 🤖 Configure CI/CD
5. 📊 Monitore métricas de qualidade
6. 🎓 Explore recursos avançados

## 🆘 Problemas Comuns

### "Command not found: quality"

Use o caminho completo:

```bash
node /path/to/mcp-Quality-CLI/dist/cli.js
```

Ou crie um alias:

```bash
alias quality="node /path/to/mcp-Quality-CLI/dist/cli.js"
```

### "Cannot find module '@modelcontextprotocol/sdk'"

```bash
cd /path/to/mcp-Quality-CLI
npm install
npm run build
```

### "Tests failing with timeout"

Aumente o timeout em `playwright.config.ts`:

```typescript
timeout: 60_000, // 60 segundos
```

### "Browser not found"

```bash
cd packages/product-e2e
npx playwright install chromium
```

## 🎉 Pronto!

Você está pronto para começar! Se tiver dúvidas:

- 📖 Consulte o [README.md](README.md)
- 🐛 Abra uma [issue](https://github.com/seu-usuario/mcp-Quality-CLI/issues)
- 💬 Entre em contato

**Happy Testing!** 🧪✨
