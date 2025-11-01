import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import { join } from 'node:path';
import { detectLanguage } from '../language';

describe('detectLanguage', () => {
  let testDir: string;

  beforeEach(async () => {
    testDir = `/tmp/language-test-${Date.now()}`;
    await fs.mkdir(testDir, { recursive: true });
  });

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true });
  });

  it('deve detectar TypeScript com Vitest', async () => {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        devDependencies: { vitest: '^2.0.0' }
      })
    );

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe('typescript');
    expect(lang.framework).toBe('vitest');
    expect(lang.coverageCommand).toBe('npm run test:coverage');
  });

  it('deve detectar TypeScript com Jest', async () => {
    await fs.writeFile(
      join(testDir, 'package.json'),
      JSON.stringify({
        devDependencies: { jest: '^29.0.0' }
      })
    );

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe('typescript');
    expect(lang.framework).toBe('jest');
    expect(lang.coverageCommand).toBe('npm test -- --coverage');
  });

  it('deve detectar Java com Maven', async () => {
    await fs.writeFile(join(testDir, 'pom.xml'), '<project></project>');

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe('java');
    expect(lang.framework).toBe('junit');
    expect(lang.coverageCommand).toContain('jacoco');
  });

  it('deve detectar Java com Gradle', async () => {
    await fs.writeFile(join(testDir, 'build.gradle'), 'plugins { }');

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe('java');
    expect(lang.framework).toBe('junit');
  });

  it('deve detectar Go', async () => {
    await fs.writeFile(join(testDir, 'go.mod'), 'module test\n\ngo 1.21');

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe('go');
    expect(lang.framework).toBe('go-test');
    expect(lang.coverageCommand).toContain('go test');
  });

  it('deve detectar Ruby com RSpec', async () => {
    await fs.writeFile(join(testDir, 'Gemfile'), "gem 'rspec'\ngem 'rails'");

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe('ruby');
    expect(lang.framework).toBe('rspec');
  });

  it('deve detectar Python', async () => {
    await fs.writeFile(join(testDir, 'requirements.txt'), 'pytest\ndjango');

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe('python');
    expect(lang.framework).toBe('pytest');
  });

  it('deve detectar Python com pyproject.toml', async () => {
    await fs.writeFile(
      join(testDir, 'pyproject.toml'),
      '[tool.poetry]\nname = "test"'
    );

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe('python');
    expect(lang.framework).toBe('pytest');
  });

  it('deve detectar PHP', async () => {
    await fs.writeFile(
      join(testDir, 'composer.json'),
      JSON.stringify({ name: 'test/project' })
    );

    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe('php');
    expect(lang.framework).toBe('phpunit');
  });

  it('deve usar fallback para TypeScript quando não detectado', async () => {
    const lang = await detectLanguage(testDir);

    expect(lang.primary).toBe('typescript');
    expect(lang.framework).toBe('vitest');
    expect(lang.coverageFile).toBe('coverage/coverage-summary.json');
  });
});

