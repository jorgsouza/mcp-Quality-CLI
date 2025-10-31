# Contribuindo para Quality MCP

Obrigado por considerar contribuir para o Quality MCP! 🎉

## Como Contribuir

### 1. Fork e Clone

```bash
# Fork o repositório no GitHub
# Depois clone seu fork
git clone https://github.com/seu-usuario/mcp-Quality-CLI.git
cd mcp-Quality-CLI

# Adicione o upstream
git remote add upstream https://github.com/original/mcp-Quality-CLI.git
```

### 2. Configure o Ambiente

```bash
# Instale dependências
npm install

# Build
npm run build

# Teste localmente
npm run cli -- --help
```

### 3. Crie uma Branch

```bash
git checkout -b feature/minha-feature
# ou
git checkout -b fix/meu-bugfix
```

### 4. Desenvolva

- Escreva código limpo e bem documentado
- Siga as convenções do projeto
- Adicione testes se aplicável
- Atualize a documentação conforme necessário

### 5. Commit

Use mensagens de commit descritivas:

```bash
git commit -m "feat: adiciona suporte para detecção de rotas Vue.js"
git commit -m "fix: corrige parsing de OpenAPI 3.1"
git commit -m "docs: atualiza README com exemplos de uso"
```

Convenção de commits:
- `feat:` Nova funcionalidade
- `fix:` Correção de bug
- `docs:` Documentação
- `style:` Formatação
- `refactor:` Refatoração
- `test:` Testes
- `chore:` Manutenção

### 6. Push e Pull Request

```bash
git push origin feature/minha-feature
```

Então abra um Pull Request no GitHub.

## Diretrizes

### Código

- Use TypeScript
- Siga o estilo do código existente
- Mantenha funções pequenas e focadas
- Adicione tipos explícitos
- Evite `any` quando possível

### Testes

- Adicione testes para novas funcionalidades
- Garanta que todos os testes passem
- Teste edge cases

### Documentação

- Atualize o README se necessário
- Documente funções complexas
- Adicione comentários quando apropriado
- Mantenha exemplos atualizados

## Estrutura do Projeto

```
src/
├── server.ts       # MCP server principal
├── cli.ts          # CLI wrapper
├── tools/          # Ferramentas principais
├── detectors/      # Detectores de código
└── utils/          # Utilitários
```

## Adicionando Novos Detectores

Para adicionar suporte a um novo framework:

1. Crie um arquivo em `src/detectors/`
2. Implemente a lógica de detecção
3. Exporte função com interface consistente
4. Integre em `src/tools/analyze.ts`
5. Adicione testes
6. Documente no README

Exemplo:

```typescript
// src/detectors/vue.ts
export async function findVueRoutes(repoPath: string): Promise<string[]> {
  // Sua implementação aqui
}
```

## Adicionando Novas Tools MCP

1. Crie um arquivo em `src/tools/`
2. Defina interfaces TypeScript
3. Implemente a lógica
4. Adicione schema Zod em `server.ts`
5. Registre o handler
6. Adicione comando CLI em `cli.ts`
7. Documente

## Testando Localmente

### Como MCP Server

```bash
# Build
npm run build

# Teste via stdio
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | node dist/server.js
```

### Como CLI

```bash
npm run build
node dist/cli.js analyze --repo /path/to/test/repo --product Test
```

## Reportando Bugs

Ao reportar um bug, inclua:

1. Descrição clara do problema
2. Passos para reproduzir
3. Comportamento esperado vs atual
4. Versão do Node.js
5. Sistema operacional
6. Logs relevantes

## Sugerindo Funcionalidades

Para sugerir uma nova funcionalidade:

1. Descreva o caso de uso
2. Explique o benefício
3. Proponha uma solução (opcional)
4. Abra uma issue para discussão

## Código de Conduta

- Seja respeitoso e construtivo
- Aceite feedback graciosamente
- Foque no que é melhor para a comunidade
- Mostre empatia com outros membros

## Perguntas?

Abra uma issue ou entre em contato!

Obrigado por contribuir! 🙌

