# 📊 Dashboards de Test Quality

Este diretório contém **3 dashboards** diferentes para visualizar os dados de `test-explanations.json`.

---

## 🎯 Qual Dashboard Usar?

### 1️⃣ **`dashboard-demo.html`** ⭐ RECOMENDADO PARA DEMONSTRAÇÃO

**✅ Funciona sem servidor HTTP (duplo clique!)**

```bash
# Abrir diretamente:
xdg-open dashboard-demo.html
# ou duplo clique no arquivo
```

**📋 Características:**
- ✅ **5 testes de exemplo embutidos** (não precisa de `test-explanations.json`)
- ✅ **Funciona offline** (sem CORS)
- ✅ Design ReclameAQUI completo
- ✅ Todos os campos exibidos
- ✅ Busca + filtros funcionais
- ✅ Cards expandíveis
- 🎨 **Ideal para apresentações e demos**

**🎯 Use quando:**
- Precisar mostrar o dashboard rapidamente
- Não quiser iniciar servidor HTTP
- Quiser testar a interface

---

### 2️⃣ **`dashboard-advanced.html`** 🚀 RECOMENDADO PARA PRODUÇÃO

**⚠️ Precisa de servidor HTTP (devido ao CORS)**

```bash
# Opção 1: Python (mais simples)
cd qa/mcp-Quality-CLI/tests/analyses/
python3 -m http.server 8765
# Abra: http://localhost:8765/dashboard-advanced.html

# Opção 2: Node.js
npx http-server -p 8765
# Abra: http://localhost:8765/dashboard-advanced.html

# Opção 3: PHP
php -S localhost:8765
# Abra: http://localhost:8765/dashboard-advanced.html
```

**📋 Características:**
- ✅ **Carrega TODOS os 1.973 testes** de `test-explanations.json`
- ✅ **Busca avançada** (nome + arquivo)
- ✅ **Filtros múltiplos** (tipo, assert, smells)
- ✅ **Cards expandíveis** com Given/When/Then
- ✅ **Coverage visual** (barra de progresso)
- ✅ **Contracts CDC/Pact** (status + interações)
- ✅ **Paginação** (10 testes/página)
- 🎨 Design ReclameAQUI (logo RA + header verde)

**🎯 Use quando:**
- Precisar analisar TODOS os testes
- Quiser usar busca e filtros avançados
- Trabalhar com dados reais do projeto

**📊 Campos exibidos:**
- Nome do teste + arquivo
- **O que testa** / **Por que testa** / **Para que**
- Função testada
- **Given/When/Then** completo
- **Mocks/Spies** detectados
- **Coverage** (linhas + diff %)
- **Contracts** (Pact status + interações)
- **Code Smells** (destacado em vermelho)
- **Suggestions** (destacado em azul)

---

### 3️⃣ **`dashboard-standalone.html`** 📊 BÁSICO

**⚠️ Precisa de servidor HTTP**

```bash
cd qa/mcp-Quality-CLI/tests/analyses/
python3 -m http.server 8765
# Abra: http://localhost:8765/dashboard-standalone.html
```

**📋 Características:**
- ✅ Cards de métricas (6 cards principais)
- ✅ Gráficos Chart.js (tipo + asserts)
- ✅ Tabela simples (50 testes/página)
- ✅ Filtros básicos
- 🎨 Design Trust DS moderno

**🎯 Use quando:**
- Precisar de uma visão geral rápida
- Quiser focar em gráficos e métricas
- Preferir interface mais simples

---

## 🎨 Design System

Todos os dashboards usam o **Trust Design System**:

- **Cores**: Primárias (#3b82f6), Semânticas (success, warning, danger)
- **Espaçamento**: Sistema 4pt (4px, 8px, 12px, 16px...)
- **Tipografia**: Sistema escalável (xs, sm, base, lg, xl...)
- **Sombras**: 6 níveis (xs, sm, md, lg, xl, 2xl)
- **Animações**: Transições suaves + hover effects

### 🏷️ Badges Coloridos

| Tipo | Cor | Exemplo |
|------|-----|---------|
| **E2E** | Roxo (`#9333ea`) | ![#9333ea](https://via.placeholder.com/15/9333ea/000000?text=+) |
| **Unit** | Azul (`#1d4ed8`) | ![#1d4ed8](https://via.placeholder.com/15/1d4ed8/000000?text=+) |
| **Integration** | Laranja (`#b45309`) | ![#b45309](https://via.placeholder.com/15/b45309/000000?text=+) |
| **Assert Forte** | Verde (`#15803d`) | ![#15803d](https://via.placeholder.com/15/15803d/000000?text=+) |
| **Assert Médio** | Amarelo (`#b45309`) | ![#b45309](https://via.placeholder.com/15/b45309/000000?text=+) |
| **Assert Fraco** | Vermelho (`#dc2626`) | ![#dc2626](https://via.placeholder.com/15/dc2626/000000?text=+) |

---

## 🚨 Troubleshooting

### ❌ Dashboard em branco (sem dados)

**Causa:** Problema de CORS ao carregar `test-explanations.json` via `file://`

**Solução:**

```bash
# Opção 1: Use dashboard-demo.html (dados embutidos)
xdg-open dashboard-demo.html

# Opção 2: Inicie servidor HTTP
cd qa/mcp-Quality-CLI/tests/analyses/
python3 -m http.server 8765
# Abra: http://localhost:8765/dashboard-advanced.html
```

### 🔄 Servidor já está rodando na porta 8765

```bash
# Opção 1: Use outra porta
python3 -m http.server 9000

# Opção 2: Pare o servidor anterior
# Encontre o PID:
lsof -i :8765
# Mate o processo:
kill -9 <PID>
```

### 📂 Arquivo test-explanations.json não encontrado

Certifique-se de que está no diretório correto:

```bash
cd qa/mcp-Quality-CLI/tests/analyses/
ls -la test-explanations.json

# Se não existir, execute:
cd ../../..
npm run quality explain-tests --repo . --product mcp-Quality-CLI
```

---

## 📊 Comparação Rápida

| Feature | Demo | Advanced | Standalone |
|---------|------|----------|------------|
| **Sem servidor HTTP** | ✅ | ❌ | ❌ |
| **Dados reais (1973 testes)** | ❌ (5 testes) | ✅ | ✅ |
| **Busca avançada** | ✅ | ✅ | ✅ |
| **Filtros múltiplos** | ✅ | ✅ | ✅ |
| **Cards expandíveis** | ✅ | ✅ | ❌ |
| **Given/When/Then** | ✅ | ✅ | ❌ |
| **Coverage visual** | ✅ | ✅ | ✅ |
| **Contracts CDC** | ✅ | ✅ | ✅ |
| **Gráficos Chart.js** | ❌ | ✅ | ✅ |
| **Design ReclameAQUI** | ✅ | ✅ | ❌ |

---

## 🎯 Recomendação Final

1. **Para apresentações/demos rápidas**: Use `dashboard-demo.html` 🌟
2. **Para análise completa**: Use `dashboard-advanced.html` com servidor HTTP 🚀
3. **Para métricas gerais**: Use `dashboard-standalone.html` 📊

---

## 📝 Geração dos Dados

Para regenerar `test-explanations.json`:

```bash
cd /home/jorgesouza/Documents/dev/mcp-Quality-CLI

# Via CLI
npm run quality explain-tests --repo . --product mcp-Quality-CLI

# Via MCP
# (use o comando 'explain_tests' no MCP)
```

---

## 🔗 Links Úteis

- [Test Quality Metrics](./test-quality-metrics.json) - Métricas agregadas
- [Test Explanations](./test-explanations.json) - Dados completos (1973 testes)
- [MCP Quality CLI](../../../README.md) - Documentação principal

---

**✅ Status:** Todos os dashboards testados e funcionais!  
**📅 Última atualização:** 2025-11-04

