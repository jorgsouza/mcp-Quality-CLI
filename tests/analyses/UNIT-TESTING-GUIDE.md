# Guia de Testes Unitários

## Framework: VITEST

### Executar Testes

```bash
npm test                  # Executar todos os testes
npm run test:watch       # Modo watch
npm run test:coverage    # Com cobertura
```

### Estrutura dos Testes

Os testes foram gerados seguindo o padrão:
- Testes em `__tests__/` ou `*.test.{ts,tsx}`
- Cada arquivo fonte tem seu arquivo de teste correspondente
- TODOs marcam onde você precisa adicionar lógica específica

### Próximos Passos

1. **Revisar testes gerados**: Abra os arquivos `.test.ts` e complete os TODOs
2. **Adicionar casos de teste**: Inclua edge cases, erros, etc
3. **Configurar CI**: Execute testes automaticamente em PRs
4. **Aumentar cobertura**: Meta de 80%+

### Boas Práticas

- ✅ Um teste deve testar apenas uma coisa
- ✅ Use nomes descritivos: `deve fazer X quando Y`
- ✅ Arrange, Act, Assert (AAA pattern)
- ✅ Mocks para dependências externas
- ✅ Testes rápidos (< 100ms cada)

### Exemplos

#### Função Simples
```typescript
describe('sum', () => {
  it('deve somar dois números', () => {
    expect(sum(2, 3)).toBe(5);
  });

  it('deve lidar com negativos', () => {
    expect(sum(-1, 1)).toBe(0);
  });
});
```

#### Componente React
```typescript
describe('Button', () => {
  it('deve chamar onClick quando clicado', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
```

### Recursos

- [vitest Documentation](https://vitest.io)
- [Testing Library](https://testing-library.com)
- [Kent C. Dodds - Testing JavaScript](https://testingjavascript.com)

---

**Gerado por:** Quality MCP v0.2.0
