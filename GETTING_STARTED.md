# 🚀 Getting Started - Quality MCP

Bem-vindo ao Quality MCP! Este guia vai te ajudar a configurar e executar o projeto pela primeira vez.

## ✅ Pré-requisitos Verificados

Antes de começar, certifique-se de ter:

- ✅ Node.js 20+ instalado (`node --version`)
- ✅ npm instalado (`npm --version`)
- ✅ Git instalado (`git --version`)

## 📦 Passo 1: Instalar Dependências

```bash
cd /home/jorgesouza/Documents/dev/mcp-Quality-CLI
npm install
```

Isso vai instalar:
- `@modelcontextprotocol/sdk` - SDK do MCP
- `@playwright/test` - Framework de testes
- `commander` - CLI framework
- `zod` - Validação de schemas
- `glob` - Busca de arquivos
- `typescript` - Compilador TypeScript

## 🔨 Passo 2: Build do Projeto

```bash
npm run build
```

Isso compila os arquivos TypeScript de `src/` para JavaScript em `dist/`.

## 🧪 Passo 3: Teste Rápido

### Teste o CLI

```bash
# Verificar se o CLI funciona
node dist/cli.js --help

# Deve mostrar:
# Usage: quality [options] [command]
# Quality CLI - Análise e geração automatizada de testes Playwright
```

### Teste o MCP Server

```bash
# Teste básico do servidor MCP
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}' | node dist/server.js 2>/dev/null | jq .

# Deve retornar lista de 5 tools:
# - analyze_codebase
# - generate_test_plan
# - scaffold_playwright
# - run_playwright
# - build_report
```

## 📝 Passo 4: Configure Variáveis de Ambiente

```bash
# Copie o exemplo
cp .env.example .env

# Edite com suas configurações
nano .env  # ou vim, code, etc.
```

Exemplo de `.env`:
```bash
E2E_BASE_URL=http://localhost:3000
E2E_USER=test@example.com
E2E_PASS=test123
```

## 🎯 Passo 5: Primeiro Teste Real

Vamos testar em um projeto exemplo:

```bash
# Crie um diretório de teste
mkdir -p /tmp/test-project
cd /tmp/test-project

# Crie uma estrutura simples de Next.js (simulada)
mkdir -p app/auth app/dashboard
touch app/auth/page.tsx app/dashboard/page.tsx

# Execute o Quality MCP
node /home/jorgesouza/Documents/dev/mcp-Quality-CLI/dist/cli.js analyze \
  --repo . \
  --product "TestApp" \
  --base-url "http://localhost:3000"

# Verifique o resultado
cat plan/analyze.json
```

## 🔧 Passo 6: Configurar como MCP Server

### Para Claude Desktop

1. Encontre o arquivo de configuração:
   - **macOS**: `~/Library/Application Support/Claude/claude_desktop_config.json`
   - **Linux**: `~/.config/Claude/claude_desktop_config.json`
   - **Windows**: `%APPDATA%\Claude\claude_desktop_config.json`

2. Adicione o servidor:

```json
{
  "mcpServers": {
    "quality": {
      "command": "node",
      "args": ["/home/jorgesouza/Documents/dev/mcp-Quality-CLI/dist/server.js"],
      "env": {
        "E2E_BASE_URL": "http://localhost:3000",
        "E2E_USER": "test@example.com",
        "E2E_PASS": "test123"
      }
    }
  }
}
```

3. Reinicie o Claude Desktop

4. Teste no Claude:
   > "Liste as ferramentas MCP disponíveis"

### Para Cline (VS Code)

1. Abra Cline Settings
2. Vá para "MCP Servers"
3. Adicione novo servidor:
   - **Name**: quality
   - **Command**: node
   - **Args**: /home/jorgesouza/Documents/dev/mcp-Quality-CLI/dist/server.js
   - **Environment Variables**: E2E_BASE_URL, E2E_USER, E2E_PASS

## 🎓 Passo 7: Execute o Pipeline Completo

Agora teste em um projeto real seu:

```bash
# Configure
export E2E_BASE_URL="http://localhost:3000"
export E2E_USER="test@example.com"
export E2E_PASS="test123"

# Execute pipeline completo
node /home/jorgesouza/Documents/dev/mcp-Quality-CLI/dist/cli.js full \
  --repo /path/to/seu/projeto \
  --product "SeuProduto" \
  --base-url "$E2E_BASE_URL" \
  --domains "auth,dashboard,settings" \
  --critical-flows "login,signup" \
  --targets '{"ci_p95_min":15,"flaky_pct_max":3,"diff_coverage_min":60}'
```

## 📂 O que foi Gerado?

Após execução bem-sucedida, você terá:

```
seu-projeto/
├── plan/
│   ├── analyze.json      # ✅ Análise do código
│   └── TEST-PLAN.md     # ✅ Plano de testes
├── packages/
│   └── product-e2e/     # ✅ Testes Playwright
│       ├── playwright.config.ts
│       ├── tests/
│       │   ├── auth/
│       │   ├── dashboard/
│       │   └── settings/
│       └── fixtures/
├── reports/             # ✅ Relatórios de execução
│   ├── html/
│   ├── json/
│   └── junit/
└── SUMMARY.md          # ✅ Resumo para QA
```

## 🐛 Troubleshooting

### Erro: "Cannot find module '@modelcontextprotocol/sdk'"

```bash
cd /home/jorgesouza/Documents/dev/mcp-Quality-CLI
rm -rf node_modules package-lock.json
npm install
npm run build
```

### Erro: "npx playwright: command not found"

```bash
npm install -g @playwright/test
npx playwright install
```

### Erro: "Permission denied"

```bash
chmod +x dist/cli.js dist/server.js
```

### Tests failing to run

```bash
# Certifique-se de que as variáveis estão definidas
echo $E2E_BASE_URL
echo $E2E_USER

# Se não estiverem, exporte novamente:
export E2E_BASE_URL="http://localhost:3000"
export E2E_USER="test@example.com"
export E2E_PASS="test123"
```

## 📚 Próximos Passos

Agora que tudo está funcionando:

1. ✅ Leia o [README.md](README.md) completo
2. ✅ Veja exemplos em [docs/EXAMPLES.md](docs/EXAMPLES.md)
3. ✅ Entenda a arquitetura em [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md)
4. ✅ Configure CI/CD (veja [.github/workflows/](..github/workflows/))
5. ✅ Customize os testes gerados
6. ✅ Compartilhe com seu time!

## 💡 Dicas

### Atalho Global

Crie um alias para facilitar o uso:

```bash
# Adicione ao seu ~/.bashrc ou ~/.zshrc
alias quality="node /home/jorgesouza/Documents/dev/mcp-Quality-CLI/dist/cli.js"

# Recarregue
source ~/.bashrc  # ou ~/.zshrc

# Agora você pode usar:
quality analyze --repo . --product "MeuApp"
```

### Modo de Desenvolvimento

Para desenvolver o próprio Quality MCP:

```bash
cd /home/jorgesouza/Documents/dev/mcp-Quality-CLI

# Watch mode (recompila automaticamente)
npm run dev

# Em outro terminal, teste suas mudanças
node dist/cli.js --help
```

## 🆘 Precisa de Ajuda?

- 📖 Documentação: [README.md](README.md)
- 🚀 Guia Rápido: [QUICKSTART.md](QUICKSTART.md)
- 💬 Issues: [GitHub Issues](https://github.com/seu-usuario/mcp-Quality-CLI/issues)
- 📧 Email: seu-email@example.com

## 🎉 Tudo Pronto!

Você está pronto para usar o Quality MCP! 

**Happy Testing!** 🧪✨

---

**Versão**: 0.1.0  
**Última atualização**: 2025-10-31

