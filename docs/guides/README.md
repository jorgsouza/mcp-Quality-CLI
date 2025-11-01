# 🚀 Guias de Usuário - Quality MCP

Esta pasta contém guias práticos para usar o Quality MCP no seu dia a dia.

## 📖 Guias Disponíveis

### [AUTO-GUIDE.md](AUTO-GUIDE.md)
**Orquestrador One-Shot**

Aprenda a usar o comando `auto` para executar todo o pipeline de qualidade em um único comando:

```bash
quality auto --mode full --repo /path/to/project
```

Tópicos:
- ✅ Modos de execução (full, analyze, plan, scaffold, run)
- ✅ Configuração agnóstica com mcp-settings.json
- ✅ Detecção automática de linguagem e framework
- ✅ Personalização de domínios e fluxos críticos

**Ideal para:** Automação completa, CI/CD, execução rápida

---

### [NL-GUIDE.md](NL-GUIDE.md)
**Comandos em Linguagem Natural**

Use o Quality MCP com comandos em português ou inglês via MCP server:

```typescript
"Analise meu repositório e gere testes"
"Create a test plan for my Express API"
```

Tópicos:
- ✅ Sintaxe de comandos naturais
- ✅ Suporte PT-BR e EN
- ✅ Mapeamento de intenções
- ✅ Integração com Claude/Cline

**Ideal para:** Uso com LLMs, prototipagem rápida, exploratory testing

---

### [EXAMPLES.md](EXAMPLES.md)
**Exemplos Práticos**

Coleção de exemplos reais de uso do Quality MCP:

- ✅ Next.js App Router
- ✅ Express.js API
- ✅ NestJS Application
- ✅ React SPA
- ✅ Monorepo com múltiplos produtos

**Ideal para:** Aprender por exemplos, casos de uso reais, copy-paste

---

## 🎯 Qual Guia Usar?

### Você quer automação completa?
→ [AUTO-GUIDE.md](AUTO-GUIDE.md)

### Você prefere linguagem natural?
→ [NL-GUIDE.md](NL-GUIDE.md)

### Você quer ver exemplos práticos?
→ [EXAMPLES.md](EXAMPLES.md)

### Você é iniciante?
→ Comece com [EXAMPLES.md](EXAMPLES.md), depois [AUTO-GUIDE.md](AUTO-GUIDE.md)

### Você usa Claude/Cline?
→ [NL-GUIDE.md](NL-GUIDE.md)

### Você vai integrar com CI/CD?
→ [AUTO-GUIDE.md](AUTO-GUIDE.md)

## 📚 Outros Recursos

- 🏠 [Documentação Principal](../README.md)
- ✨ [Features](../features/README.md)
- 🏗️ [Arquitetura](../architecture/ARCHITECTURE.md)
- 🚀 [Quickstart](../../QUICKSTART.md)

---

**Dica:** Todos os guias assumem que você já instalou e configurou o Quality MCP. Se ainda não fez isso, veja o [QUICKSTART.md](../../QUICKSTART.md).
