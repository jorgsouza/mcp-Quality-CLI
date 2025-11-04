# Contribuindo para MCP Quality CLI

Obrigado por considerar contribuir para o MCP Quality CLI! 🎉

## 📋 Índice

- [Código de Conduta](#código-de-conduta)
- [Como Posso Contribuir?](#como-posso-contribuir)
- [Processo de Desenvolvimento](#processo-de-desenvolvimento)
- [Guia de Estilo](#guia-de-estilo)
- [Estrutura do Projeto](#estrutura-do-projeto)
- [Rodando Testes](#rodando-testes)
- [Submetendo Pull Requests](#submetendo-pull-requests)

---

## 📜 Código de Conduta

Este projeto segue o [Contributor Covenant](https://www.contributor-covenant.org/). Ao participar, você concorda em manter um ambiente respeitoso e acolhedor.

---

## 🤝 Como Posso Contribuir?

### Reportando Bugs

Se você encontrou um bug:

1. Verifique se já existe uma [issue aberta](https://github.com/jorgsouza/mcp-Quality-CLI/issues)
2. Se não existir, crie uma nova issue com:
   - Descrição clara do problema
   - Passos para reproduzir
   - Comportamento esperado vs atual
   - Versão do Node.js e do MCP Quality CLI
   - Logs relevantes

### Sugerindo Melhorias

Para sugerir uma nova funcionalidade:

1. Abra uma issue com o prefixo `[Feature Request]`
2. Descreva o caso de uso
3. Explique como a funcionalidade beneficiaria o projeto
4. Se possível, sugira uma implementação

### Contribuindo com Código

1. **Fork** o repositório
2. **Clone** seu fork
3. **Crie uma branch** para sua feature/fix
4. **Faça suas mudanças**
5. **Commit** seguindo o [padrão de commits](#commits)
6. **Push** para seu fork
7. **Abra um Pull Request**

---

## 🔧 Processo de Desenvolvimento

### Setup Local

```bash
# Clone o repositório
git clone https://github.com/jorgsouza/mcp-Quality-CLI.git
cd mcp-Quality-CLI

# Instale dependências
npm install

# Compile o projeto
npm run build

# Rode os testes
npm test

# Rode em modo watch (desenvolvimento)
npm run dev
```

### Estrutura de Branches

- `main`: código estável em produção
- `develop`: desenvolvimento ativo
- `feature/*`: novas funcionalidades
- `fix/*`: correções de bugs
- `docs/*`: atualizações de documentação

---

## 🎨 Guia de Estilo

### Código TypeScript

- **ESLint**: Seguimos as regras do ESLint configurado
- **Prettier**: Formatação automática
- **Imports**: Organizados e com `.js` no final
- **Types**: Prefira interfaces explícitas a `any`

```typescript
// ✅ Bom
export interface UserOptions {
  name: string;
  age: number;
}

export async function createUser(options: UserOptions): Promise<User> {
  // ...
}

// ❌ Evite
export async function createUser(options: any): Promise<any> {
  // ...
}
```

### Commits

Seguimos o [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>

[optional body]

[optional footer]
```

**Types**:
- `feat`: Nova funcionalidade
- `fix`: Correção de bug
- `docs`: Documentação
- `style`: Formatação, ponto e vírgula faltando, etc
- `refactor`: Refatoração de código
- `test`: Adição ou correção de testes
- `chore`: Tarefas de manutenção

**Exemplos**:
```bash
feat(mutation): add support for Python mutmut
fix(coverage): correct branch coverage calculation
docs(readme): update Quality Gates section
test(gates): add unit tests for quality gates
```

### Documentação

- Use Markdown para documentação
- Inclua exemplos de código
- Mantenha o tom amigável e claro
- Documente APIs públicas com JSDoc

---

## 📁 Estrutura do Projeto

```
mcp-Quality-CLI/
├── src/
│   ├── tools/           # Tools principais (analyze, scaffold, etc)
│   │   └── __tests__/   # Testes unitários dos tools
│   ├── adapters/        # Adapters multi-language
│   ├── runners/         # Executores (mutation, coverage, etc)
│   ├── parsers/         # Parsers de relatórios
│   ├── detectors/       # Detectores (language, framework, etc)
│   ├── schemas/         # Schemas Zod
│   ├── utils/           # Utilitários
│   ├── server.ts        # MCP Server
│   └── mcp-tools.manifest.ts  # Manifesto de tools MCP
├── docs/
│   ├── QUALITY-GATES-GUIDE.md  # Guia de Quality Gates
│   ├── SETUP-BY-LANGUAGE.md    # Setup por linguagem
│   ├── USAGE-BY-STACK.md       # Uso por stack
│   └── ci-cd/                  # Exemplos de CI/CD
├── qa/                  # Testes E2E e análises
├── README.md            # Documentação principal
├── CHANGELOG.md         # Histórico de mudanças
└── CONTRIBUTING.md      # Este arquivo
```

### Onde Adicionar Novas Funcionalidades

- **Novo Tool**: `src/tools/<tool-name>.ts`
- **Novo Adapter**: `src/adapters/<language>-adapter.ts`
- **Novo Runner**: `src/runners/<runner-name>.ts`
- **Novo Detector**: `src/detectors/<detector-name>.ts`
- **Testes**: `src/<categoria>/__tests__/<nome>.test.ts`

---

## 🧪 Rodando Testes

### Todos os Testes

```bash
npm test
```

### Testes Específicos

```bash
# Rodar apenas unit tests
npm test -- src/tools/__tests__/

# Rodar apenas E2E tests
npm test -- qa/mcp-Quality-CLI/tests/e2e/

# Rodar teste específico
npm test -- src/tools/__tests__/auto.test.ts

# Watch mode
npm test -- --watch
```

### Coverage

```bash
npm run test:coverage
```

### Linting

```bash
npm run lint
npm run lint:fix
```

---

## 🚀 Submetendo Pull Requests

### Checklist

Antes de submeter um PR, verifique:

- [ ] Código compila sem erros (`npm run build`)
- [ ] Todos os testes passam (`npm test`)
- [ ] Linting está ok (`npm run lint`)
- [ ] Commit messages seguem o padrão
- [ ] Documentação atualizada (se necessário)
- [ ] CHANGELOG.md atualizado (para features/fixes significativos)
- [ ] Testes adicionados para novas funcionalidades

### Template de PR

```markdown
## Descrição
[Descreva suas mudanças]

## Tipo de Mudança
- [ ] Bug fix (mudança não-breaking que corrige um issue)
- [ ] New feature (mudança não-breaking que adiciona funcionalidade)
- [ ] Breaking change (fix ou feature que causa mudança na API)
- [ ] Documentação

## Como Testar
[Descreva como testar suas mudanças]

## Screenshots (se aplicável)
[Adicione screenshots se relevante]

## Checklist
- [ ] Meu código segue o style guide
- [ ] Realizei self-review do código
- [ ] Comentei partes complexas do código
- [ ] Atualizei a documentação
- [ ] Minhas mudanças não geram novos warnings
- [ ] Adicionei testes que provam que meu fix funciona
- [ ] Testes novos e existentes passam localmente
```

---

## 🎯 Áreas que Precisam de Ajuda

### Alta Prioridade

- [ ] Testes E2E para Quality Gates completo
- [ ] Suporte para Ruby (RSpec + SimpleCov + mutant)
- [ ] Suporte para Rust (cargo test + tarpaulin + cargo-mutants)
- [ ] Integração com mais fontes de prod metrics (New Relic, Prometheus)
- [ ] Dashboard web interativo (ao invés de HTML estático)

### Média Prioridade

- [ ] Melhorias na detecção de language/framework
- [ ] Otimização de performance do mutation testing
- [ ] Mais exemplos de CI/CD (CircleCI, Travis CI, Bitbucket Pipelines)
- [ ] Suporte para monorepos
- [ ] Plugin para VS Code

### Documentação

- [ ] Tutoriais em vídeo
- [ ] Mais exemplos práticos
- [ ] Tradução para inglês
- [ ] Blog posts sobre casos de uso

---

## 💬 Comunicação

- **Issues**: Para bugs, features e perguntas
- **Pull Requests**: Para contribuições de código
- **Discussions**: Para discussões gerais e ideias

---

## 📝 Notas Adicionais

### Convenções de Nomeação

- **Arquivos**: kebab-case (`my-new-file.ts`)
- **Classes**: PascalCase (`MyNewClass`)
- **Funções**: camelCase (`myNewFunction`)
- **Constantes**: UPPER_SNAKE_CASE (`MY_CONSTANT`)

### Boas Práticas

1. **KISS**: Keep It Simple, Stupid
2. **DRY**: Don't Repeat Yourself
3. **YAGNI**: You Aren't Gonna Need It
4. **Single Responsibility**: Uma função, um propósito
5. **Testável**: Código fácil de testar é código bem escrito

---

## 🙏 Agradecimentos

Obrigado por contribuir para o MCP Quality CLI! Cada contribuição, por menor que seja, é valiosa. 🎉

---

**Versão**: 1.0.0  
**Atualizado**: 2024-11-04  
**Mantido por**: MCP Quality CLI Team
