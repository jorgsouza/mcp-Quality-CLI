# Quality MCP - Guia Rápido 🚀

**5 minutos para ter testes automatizados no seu projeto!**

## 📦 Instalação

```bash
# Clone o repositório
git clone https://github.com/jorgsouza/mcp-Quality-CLI
cd mcp-Quality-CLI

# Instale dependências
npm install

# Build
npm run build
```

## ⚡ Uso Básico - Um Comando para Tudo

### Opção 1: CLI Direto

```bash
# Sintaxe básica
npx quality auto --repo <caminho> --product <nome>

# Exemplo real
npx quality auto --repo . --product "MyApp"
```

**Pronto!** Em ~2 minutos você terá:
- ✅ Estrutura completa de testes em `qa/MyApp/`
- ✅ Análise de código (rotas, eventos, endpoints)
- ✅ Plano de testes com 30-50 cenários
- ✅ Templates de testes (unit, integration, e2e)
- ✅ Dashboard HTML interativo
- ✅ Relatórios de cobertura

### Opção 2: Linguagem Natural (via MCP)

Se você usa Claude, Cursor, Cline ou outro cliente MCP:

```json
{
  "tool": "nl_command",
  "params": {
    "query": "analise meu repositório e crie tudo automaticamente"
  }
}
```

**Comandos que funcionam:**
- `"analise meu repositório"` → Análise completa
- `"criar plano de testes"` → Só o planejamento
- `"gerar estrutura de testes"` → Só os templates
- `"rodar testes com cobertura"` → Só executar

## 📁 Estrutura Gerada

Após rodar `quality auto`, você terá:

```
qa/MyApp/
├── tests/
│   ├── analyses/              # 📊 Dados JSON (para ferramentas)
│   │   ├── analyze.json
│   │   ├── coverage-analysis.json
│   │   └── risk-map.json
│   ├── reports/               # 📋 Relatórios legíveis (para humanos)
│   │   ├── QUALITY-REPORT.md
│   │   ├── PLAN.md
│   │   ├── PYRAMID.html
│   │   └── SELF-CHECK.md
│   ├── unit/                  # 🔬 Testes unitários
│   ├── integration/           # 🔗 Testes de integração
│   └── e2e/                   # 🎭 Testes E2E
├── dashboards/
│   └── dashboard.html         # 📈 Dashboard principal
└── fixtures/
    └── auth/                  # 🔐 Dados de autenticação
```

## 🎯 Modos de Execução

| Modo | O que faz | Tempo | Use quando |
|------|-----------|-------|------------|
| `full` | Tudo (análise + plano + scaffold + run) | ~3-5min | Começando do zero |
| `analyze` | Só análise de código | ~30s | Quer entender a arquitetura |
| `plan` | Análise + plano de testes | ~1min | Quer revisar estratégia |
| `scaffold` | Análise + plano + templates | ~2min | Quer estrutura sem executar |
| `run` | Só executa testes existentes | ~1min | Já tem testes, quer rodar |

### Exemplos

```bash
# Análise rápida apenas
npx quality auto --repo . --product "API" --mode analyze

# Criar plano sem gerar testes
npx quality auto --repo . --product "API" --mode plan

# Gerar estrutura sem executar
npx quality auto --repo . --product "API" --mode scaffold

# Executar testes + cobertura
npx quality auto --repo . --product "API" --mode run
```

## 📊 Retorno Estruturado (v0.3.1+)

O comando `auto` retorna um objeto JSON com todos os arquivos gerados:

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
    "dashboard": "dashboards/dashboard.html"
  },
  "steps": [
    "self-check",
    "analyze",
    "coverage",
    "plan",
    "scaffold-unit",
    "scaffold-integration",
    "pyramid-report",
    "dashboard",
    "report"
  ],
  "duration": 45230
}
```

**Benefícios:**
- ✅ Clientes MCP podem construir UI com links clicáveis
- ✅ CI/CD pode parsear resultados facilmente
- ✅ Paths organizados por categoria (reports vs analyses)

## 🛠️ Configuração Avançada

### Thresholds Personalizados

```bash
npx quality auto \
  --repo . \
  --product "API" \
  --min-coverage 80 \
  --min-branch 75 \
  --min-mutation 70
```

### Pular Etapas

```bash
# Análise sem executar testes
npx quality auto --repo . --product "API" --skipRun

# Análise sem gerar templates
npx quality auto --repo . --product "API" --skipScaffold

# Ambos
npx quality auto --repo . --product "API" --skipRun --skipScaffold
```

## 🔍 Validação de Ambiente

Antes de rodar a análise completa, o Quality MCP valida:

- ✅ Node.js >= 18
- ✅ npm >= 8
- ✅ Git instalado e repositório inicializado
- ✅ Test runner (vitest/jest) instalado
- ✅ Permissões de escrita em `qa/<product>/`
- ⚠️ Playwright (opcional para E2E)

Se algo estiver faltando, você verá um relatório em `qa/<product>/tests/reports/SELF-CHECK.md`.

## 📋 Próximos Passos

Após rodar `quality auto`:

1. **Abra o dashboard**:
   ```bash
   open qa/MyApp/dashboards/dashboard.html
   ```

2. **Leia o plano de testes**:
   ```bash
   cat qa/MyApp/tests/reports/PLAN.md
   ```

3. **Execute os testes gerados**:
   ```bash
   npm test
   ```

4. **Customize os templates**:
   - Edite arquivos em `qa/MyApp/tests/unit/`
   - Adicione casos específicos do seu domínio
   - Configure fixtures em `qa/MyApp/fixtures/`

## 🆘 Troubleshooting

### "Permission denied in qa/<product>/"
```bash
# Dê permissões ao diretório
chmod -R 755 qa/
```

### "vitest not found"
```bash
# Instale vitest
npm install -D vitest
```

### "Playwright browsers not installed"
```bash
# Instale browsers (opcional, só para E2E)
npm install -D @playwright/test
npx playwright install
```

## 🔗 Links Úteis

- [Documentação Completa](./README.md)
- [Plano DEIXE-ME-ÓTIMO](./docs/development/DEIXE-ME-OTIMO.md)
- [Exemplos](./docs/guides/EXAMPLES.md)
- [Guia Auto Mode](./docs/guides/AUTO-GUIDE.md)

---

**Pronto para começar?**

```bash
npx quality auto --repo . --product "$(basename $(pwd))"
```

🎉 **Em 5 minutos você terá testes automatizados!**
