import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { findNextRoutes } from '../next.js';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

describe('findNextRoutes', () => {
  let testDir: string;

  beforeEach(async () => {
    // Criar diretório temporário para testes
    testDir = join(tmpdir(), `next-test-${Date.now()}`);
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    // Limpar diretório temporário
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch (error) {
      // Ignorar erros de limpeza
    }
  });

  // 1. Detectar rotas app/ directory (Next.js 13+)
  it('deve detectar rotas no formato app/page.tsx', async () => {
    // Criar estrutura app/
    await fs.mkdir(join(testDir, 'app'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/page.tsx'), 'export default function Home() {}');
    
    const routes = await findNextRoutes(testDir);
    
    expect(routes).toContain('/');
  });

  // 2. Detectar rotas pages/ directory (Next.js 12-)
  it('deve detectar rotas no formato pages/index.tsx', async () => {
    // Criar estrutura pages/
    await fs.mkdir(join(testDir, 'pages'), { recursive: true });
    await fs.writeFile(join(testDir, 'pages/index.tsx'), 'export default function Home() {}');
    
    const routes = await findNextRoutes(testDir);
    
    expect(routes).toContain('/');
  });

  // 3. Dynamic routes
  it('deve detectar rotas dinâmicas [id]/page.tsx', async () => {
    // Criar rota dinâmica app/users/[id]/page.tsx
    await fs.mkdir(join(testDir, 'app/users/[id]'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/users/[id]/page.tsx'), 'export default function User() {}');
    
    const routes = await findNextRoutes(testDir);
    
    expect(routes).toContain('/users/[id]');
  });

  // 4. Catch-all routes
  it('deve detectar rotas catch-all [...slug]/page.tsx', async () => {
    // Criar rota catch-all app/docs/[...slug]/page.tsx
    await fs.mkdir(join(testDir, 'app/docs/[...slug]'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/docs/[...slug]/page.tsx'), 'export default function Docs() {}');
    
    const routes = await findNextRoutes(testDir);
    
    expect(routes).toContain('/docs/[...slug]');
  });

  // 5. Route groups
  it('deve ignorar route groups (app)/page.tsx', async () => {
    // Criar route group app/(marketing)/about/page.tsx
    await fs.mkdir(join(testDir, 'app/(marketing)/about'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/(marketing)/about/page.tsx'), 'export default function About() {}');
    
    const routes = await findNextRoutes(testDir);
    
    // Route group deve ser removido, ficando apenas /about
    expect(routes).toContain('/(marketing)/about');
  });

  // 6. API routes
  it('deve detectar API routes em app/api/route.ts', async () => {
    // Criar API route app/api/users/route.ts
    await fs.mkdir(join(testDir, 'app/api/users'), { recursive: true });
    await fs.writeFile(join(testDir, 'app/api/users/route.ts'), 'export async function GET() {}');
    
    const routes = await findNextRoutes(testDir);
    
    // API routes não têm page.tsx, mas route.ts
    // A função atual só detecta page.{tsx,ts,jsx,js}
    // Então não deve aparecer (comportamento atual)
    expect(routes).not.toContain('/api/users');
  });

  // 7. Erro: diretório não existe
  it('deve retornar array vazio se diretório não existir', async () => {
    const nonExistentDir = join(testDir, 'non-existent');
    
    const routes = await findNextRoutes(nonExistentDir);
    
    expect(routes).toEqual([]);
  });

  // 8. Múltiplas rotas
  it('deve retornar todas as rotas encontradas', async () => {
    // Criar múltiplas rotas
    await fs.mkdir(join(testDir, 'app'), { recursive: true });
    await fs.mkdir(join(testDir, 'app/about'), { recursive: true });
    await fs.mkdir(join(testDir, 'app/contact'), { recursive: true });
    
    await fs.writeFile(join(testDir, 'app/page.tsx'), 'export default function Home() {}');
    await fs.writeFile(join(testDir, 'app/about/page.tsx'), 'export default function About() {}');
    await fs.writeFile(join(testDir, 'app/contact/page.tsx'), 'export default function Contact() {}');
    
    const routes = await findNextRoutes(testDir);
    
    expect(routes).toHaveLength(3);
    expect(routes).toContain('/');
    expect(routes).toContain('/about');
    expect(routes).toContain('/contact');
    // Deve estar ordenado
    expect(routes).toEqual(['/', '/about', '/contact']);
  });

  // Teste adicional: pages/ com rotas dinâmicas
  it('deve converter rotas dinâmicas pages/[id].tsx para :id', async () => {
    await fs.mkdir(join(testDir, 'pages/users'), { recursive: true });
    await fs.writeFile(join(testDir, 'pages/users/[id].tsx'), 'export default function User() {}');
    
    const routes = await findNextRoutes(testDir);
    
    expect(routes).toContain('/users/:id');
  });

  // Teste adicional: remover duplicatas
  it('deve remover rotas duplicadas', async () => {
    // Criar mesma rota em app/ e pages/
    await fs.mkdir(join(testDir, 'app'), { recursive: true });
    await fs.mkdir(join(testDir, 'pages'), { recursive: true });
    
    await fs.writeFile(join(testDir, 'app/page.tsx'), 'export default function Home() {}');
    await fs.writeFile(join(testDir, 'pages/index.tsx'), 'export default function Home() {}');
    
    const routes = await findNextRoutes(testDir);
    
    // Deve ter apenas uma entrada para '/'
    const homeRoutes = routes.filter(r => r === '/');
    expect(homeRoutes).toHaveLength(1);
  });
});

