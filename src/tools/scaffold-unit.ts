import { promises as fs } from 'node:fs';
import { join, dirname, basename } from 'node:path';
import { writeFileSafe, readFile, fileExists } from '../utils/fs.js';

export interface ScaffoldUnitParams {
  repo: string;
  files?: string[];  // Arquivos específicos ou todos
  framework?: 'jest' | 'vitest' | 'mocha';
  auto_detect?: boolean;
}

export async function scaffoldUnitTests(input: ScaffoldUnitParams): Promise<{
  ok: boolean;
  generated: string[];
  framework: string;
}> {
  console.log(`🧪 Gerando testes unitários...`);

  const framework = input.framework || await detectTestFramework(input.repo);
  console.log(`📦 Framework detectado: ${framework}`);

  let filesToTest: string[] = [];
  if (input.files) {
    filesToTest = input.files;
  } else if (input.auto_detect) {
    filesToTest = await autoDetectSourceFiles(input.repo);
  } else {
    filesToTest = await getFilesNeedingTests(input.repo);
  }
  
  const generated: string[] = [];

  for (const sourceFile of filesToTest.slice(0, 20)) { // Limita a 20 por vez
    try {
      const testFile = await generateUnitTest(input.repo, sourceFile, framework);
      if (testFile) {
        generated.push(testFile);
        console.log(`  ✅ ${testFile}`);
      }
    } catch (error) {
      console.warn(`  ⚠️  Erro ao gerar teste para ${sourceFile}:`, error);
    }
  }

  // Atualiza package.json com scripts de teste se necessário
  await ensureTestScripts(input.repo, framework);

  // Gera README com instruções
  await generateUnitTestGuide(input.repo, framework);

  console.log(`\n✅ ${generated.length} testes unitários gerados!`);
  
  return {
    ok: true,
    generated,
    framework
  };
}

async function detectTestFramework(repoPath: string): Promise<'jest' | 'vitest' | 'mocha'> {
  try {
    const packageJson = JSON.parse(
      await readFile(join(repoPath, 'package.json'))
    );

    const deps = {
      ...packageJson.dependencies,
      ...packageJson.devDependencies
    };

    if (deps.vitest) return 'vitest';
    if (deps.jest || deps['@jest/globals']) return 'jest';
    if (deps.mocha) return 'mocha';

    // Default para projetos modernos
    return 'vitest';
  } catch {
    return 'vitest';
  }
}

async function getFilesNeedingTests(repoPath: string): Promise<string[]> {
  // Lê da análise de cobertura se existir
  const coverageAnalysis = join(repoPath, 'tests', 'analyses', 'coverage-analysis.json');
  
  if (await fileExists(coverageAnalysis)) {
    try {
      const analysis = JSON.parse(await readFile(coverageAnalysis));
      return analysis.pyramid.unit.missing_tests || [];
    } catch {
      return [];
    }
  }

  return [];
}

async function autoDetectSourceFiles(repoPath: string): Promise<string[]> {
  const { glob } = await import('glob');
  
  // Busca por arquivos .ts, .tsx, .js, .jsx no src/
  const patterns = [
    'src/**/*.ts',
    'src/**/*.tsx', 
    'src/**/*.js',
    'src/**/*.jsx'
  ];
  
  const files: string[] = [];
  for (const pattern of patterns) {
    const matches = await glob(pattern, { cwd: repoPath });
    files.push(...matches);
  }
  
  // Filtra arquivos que não são de teste
  return files.filter(file => 
    !file.includes('.test.') && 
    !file.includes('.spec.') &&
    !file.includes('__tests__')
  );
}

async function generateUnitTest(
  repoPath: string,
  sourceFile: string,
  framework: 'jest' | 'vitest' | 'mocha'
): Promise<string | null> {
  const sourceContent = await readFile(join(repoPath, sourceFile));
  
  // Analisa o arquivo fonte
  const analysis = analyzeSourceFile(sourceContent, sourceFile);
  
  if (!analysis.testable) {
    return null;
  }

  // Gera path do teste
  const testPath = getTestPath(sourceFile);
  
  // Gera conteúdo do teste
  const testContent = generateTestContent(analysis, framework, sourceFile);
  
  await writeFileSafe(join(repoPath, testPath), testContent);
  
  return testPath;
}

interface FileAnalysis {
  testable: boolean;
  type: 'component' | 'function' | 'class' | 'hook' | 'util';
  exports: Array<{ name: string; type: string }>;
  hasReact: boolean;
  hasAsync: boolean;
}

function analyzeSourceFile(content: string, filename: string): FileAnalysis {
  const hasReact = /import.*React|from ['"]react['"]/.test(content);
  const hasAsync = /async\s+function|async\s*\(/.test(content);
  
  // Detecta exports
  const exports: Array<{ name: string; type: string }> = [];
  
  // export function/const
  const exportMatches = content.matchAll(/export\s+(const|function|class)\s+(\w+)/g);
  for (const match of exportMatches) {
    exports.push({ name: match[2], type: match[1] });
  }
  
  // export default
  if (/export\s+default/.test(content)) {
    const defaultName = basename(filename, '.ts').replace(/\.tsx?$/, '');
    exports.push({ name: defaultName, type: 'default' });
  }

  let type: 'component' | 'function' | 'class' | 'hook' | 'util' = 'util';
  
  if (hasReact && /\.tsx$/.test(filename)) {
    type = 'component';
  } else if (/^use[A-Z]/.test(exports[0]?.name || '')) {
    type = 'hook';
  } else if (exports.some(e => e.type === 'class')) {
    type = 'class';
  } else if (exports.some(e => e.type === 'function')) {
    type = 'function';
  }

  return {
    testable: exports.length > 0,
    type,
    exports,
    hasReact,
    hasAsync
  };
}

function getTestPath(sourceFile: string): string {
  // Se está em src/, coloca __tests__ ao lado
  if (sourceFile.startsWith('src/')) {
    const dir = dirname(sourceFile);
    const file = basename(sourceFile);
    const testFile = file.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
    return join(dir, '__tests__', testFile);
  }
  
  // Senão, coloca .test ao lado
  return sourceFile.replace(/\.(ts|tsx|js|jsx)$/, '.test.$1');
}

function generateTestContent(
  analysis: FileAnalysis,
  framework: 'jest' | 'vitest' | 'mocha',
  sourceFile: string
): string {
  const imports = generateImports(analysis, framework, sourceFile);
  const tests = generateTests(analysis, framework);
  
  return `${imports}

${tests}
`;
}

function generateImports(
  analysis: FileAnalysis,
  framework: 'jest' | 'vitest' | 'mocha',
  sourceFile: string
): string {
  const relativePath = './' + basename(sourceFile).replace(/\.(ts|tsx|js|jsx)$/, '');
  const imports: string[] = [];

  // Framework imports
  if (framework === 'vitest') {
    imports.push("import { describe, it, expect, vi, beforeEach } from 'vitest';");
  } else if (framework === 'jest') {
    imports.push("import { describe, it, expect, jest, beforeEach } from '@jest/globals';");
  } else {
    imports.push("import { describe, it } from 'mocha';");
    imports.push("import { expect } from 'chai';");
  }

  // React Testing Library
  if (analysis.type === 'component') {
    imports.push("import { render, screen } from '@testing-library/react';");
    imports.push("import userEvent from '@testing-library/user-event';");
  }

  // Hooks testing
  if (analysis.type === 'hook') {
    imports.push("import { renderHook, waitFor } from '@testing-library/react';");
  }

  // Import do código fonte
  const exportNames = analysis.exports.map(e => e.name).join(', ');
  imports.push(`import { ${exportNames} } from '${relativePath}';`);

  return imports.join('\n');
}

function generateTests(
  analysis: FileAnalysis,
  framework: 'jest' | 'vitest' | 'mocha'
): string {
  const tests: string[] = [];

  for (const exp of analysis.exports) {
    if (analysis.type === 'component') {
      tests.push(generateComponentTests(exp.name, framework));
    } else if (analysis.type === 'hook') {
      tests.push(generateHookTests(exp.name, framework));
    } else if (analysis.type === 'function') {
      tests.push(generateFunctionTests(exp.name, framework, analysis.hasAsync));
    } else if (analysis.type === 'class') {
      tests.push(generateClassTests(exp.name, framework));
    } else {
      tests.push(generateUtilTests(exp.name, framework));
    }
  }

  return tests.join('\n\n');
}

function generateComponentTests(name: string, framework: string): string {
  return `describe('${name}', () => {
  it('deve renderizar sem erros', () => {
    render(<${name} />);
    expect(screen.getByRole('main')).toBeInTheDocument();
  });

  it('deve renderizar com props', () => {
    // TODO: Adicionar props necessárias
    const props = {};
    render(<${name} {...props} />);
  });

  it('deve lidar com interações do usuário', async () => {
    const user = userEvent.setup();
    render(<${name} />);
    
    // TODO: Adicionar interações
    // await user.click(screen.getByRole('button'));
  });

  // TODO: Adicionar mais testes específicos do componente
});`;
}

function generateHookTests(name: string, framework: string): string {
  return `describe('${name}', () => {
  it('deve inicializar com valores padrão', () => {
    const { result } = renderHook(() => ${name}());
    expect(result.current).toBeDefined();
  });

  it('deve atualizar estado corretamente', async () => {
    const { result } = renderHook(() => ${name}());
    
    // TODO: Testar mudanças de estado
    // act(() => {
    //   result.current.someFunction();
    // });
    
    await waitFor(() => {
      // expect(result.current.someValue).toBe(expected);
    });
  });

  // TODO: Adicionar mais testes específicos do hook
});`;
}

function generateFunctionTests(name: string, framework: string, isAsync: boolean): string {
  if (isAsync) {
    return `describe('${name}', () => {
  it('deve executar com sucesso', async () => {
    const input = {}; // TODO: Definir input
    const result = await ${name}(input);
    expect(result).toBeDefined();
  });

  it('deve lidar com erros', async () => {
    const invalidInput = null;
    await expect(${name}(invalidInput)).rejects.toThrow();
  });

  // TODO: Adicionar mais casos de teste
});`;
  }

  return `describe('${name}', () => {
  it('deve retornar resultado esperado', () => {
    const input = {}; // TODO: Definir input
    const result = ${name}(input);
    expect(result).toBeDefined();
  });

  it('deve lidar com entrada inválida', () => {
    expect(() => ${name}(null)).toThrow();
  });

  // TODO: Adicionar casos de borda e edge cases
});`;
}

function generateClassTests(name: string, framework: string): string {
  return `describe('${name}', () => {
  let instance: ${name};

  beforeEach(() => {
    instance = new ${name}();
  });

  it('deve instanciar corretamente', () => {
    expect(instance).toBeInstanceOf(${name});
  });

  it('deve ter métodos públicos', () => {
    // TODO: Testar métodos públicos
    // expect(typeof instance.method).toBe('function');
  });

  // TODO: Adicionar testes para cada método público
});`;
}

function generateUtilTests(name: string, framework: string): string {
  return `describe('${name}', () => {
  it('deve ter comportamento esperado', () => {
    // TODO: Implementar teste
    expect(${name}).toBeDefined();
  });

  // TODO: Adicionar casos de teste específicos
});`;
}

async function ensureTestScripts(repoPath: string, framework: string) {
  const packageJsonPath = join(repoPath, 'package.json');
  
  if (!await fileExists(packageJsonPath)) return;

  try {
    const packageJson = JSON.parse(await readFile(packageJsonPath));
    
    if (!packageJson.scripts) {
      packageJson.scripts = {};
    }

    const scripts: Record<string, Record<string, string>> = {
      vitest: {
        'test': 'vitest',
        'test:ui': 'vitest --ui',
        'test:coverage': 'vitest --coverage'
      },
      jest: {
        'test': 'jest',
        'test:watch': 'jest --watch',
        'test:coverage': 'jest --coverage'
      },
      mocha: {
        'test': 'mocha',
        'test:watch': 'mocha --watch',
        'test:coverage': 'nyc mocha'
      }
    };

    Object.assign(packageJson.scripts, scripts[framework]);

    await writeFileSafe(packageJsonPath, JSON.stringify(packageJson, null, 2));
  } catch (error) {
    console.warn('Não foi possível atualizar package.json:', error);
  }
}

async function generateUnitTestGuide(repoPath: string, framework: string) {
  const guide = `# Guia de Unit Testing (Testes Unitários)

## Framework: ${framework.toUpperCase()}

### Executar Testes

\`\`\`bash
npm test                  # Executar todos os testes
npm run test:watch       # Modo watch
npm run test:coverage    # Com cobertura
\`\`\`

### Estrutura dos Testes

Os testes foram gerados seguindo o padrão:
- Testes em \`__tests__/\` ou \`*.test.{ts,tsx}\`
- Cada arquivo fonte tem seu arquivo de teste correspondente
- TODOs marcam onde você precisa adicionar lógica específica

### Próximos Passos

1. **Revisar testes gerados**: Abra os arquivos \`.test.ts\` e complete os TODOs
2. **Adicionar casos de teste**: Inclua edge cases, erros, etc
3. **Configurar CI**: Execute testes automaticamente em PRs
4. **Aumentar cobertura**: Meta de 80%+

### Boas Práticas

- ✅ Um teste deve testar apenas uma coisa
- ✅ Use nomes descritivos: \`deve fazer X quando Y\`
- ✅ Arrange, Act, Assert (AAA pattern)
- ✅ Mocks para dependências externas
- ✅ Testes rápidos (< 100ms cada)

### Exemplos

#### Função Simples
\`\`\`typescript
describe('sum', () => {
  it('deve somar dois números', () => {
    expect(sum(2, 3)).toBe(5);
  });

  it('deve lidar com negativos', () => {
    expect(sum(-1, 1)).toBe(0);
  });
});
\`\`\`

#### Componente React
\`\`\`typescript
describe('Button', () => {
  it('deve chamar onClick quando clicado', async () => {
    const handleClick = vi.fn();
    const user = userEvent.setup();
    
    render(<Button onClick={handleClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    
    expect(handleClick).toHaveBeenCalledOnce();
  });
});
\`\`\`

### Recursos

- [${framework} Documentation](https://${framework}.io)
- [Testing Library](https://testing-library.com)
- [Kent C. Dodds - Testing JavaScript](https://testingjavascript.com)

---

**Gerado por:** Quality MCP v0.2.0
`;

  await writeFileSafe(
    join(repoPath, 'tests', 'analyses', 'UNIT-TESTING-GUIDE.md'),
    guide
  );
}
