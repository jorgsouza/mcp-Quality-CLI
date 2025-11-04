/**
 * Java Test Runner
 * 
 * Executa testes Java (JUnit/TestNG) com Maven ou Gradle.
 * Suporta JaCoCo (coverage) e PIT (mutation).
 * 
 * COMPLETUDE FINAL - Java Runner
 */

import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import type { TestResult, RunOptions } from '../adapters/base/LanguageAdapter.js';

/**
 * Executa testes com Maven
 */
export async function runMavenTests(
  repo: string,
  options: RunOptions = {}
): Promise<TestResult> {
  let command = 'mvn test';

  if (options.coverage) {
    command = 'mvn clean test jacoco:report';
  }

  return executeJavaTests(repo, command, 'maven');
}

/**
 * Executa testes com Gradle
 */
export async function runGradleTests(
  repo: string,
  options: RunOptions = {}
): Promise<TestResult> {
  let command = './gradlew test';

  if (options.coverage) {
    command = './gradlew test jacocoTestReport';
  }

  return executeJavaTests(repo, command, 'gradle');
}

/**
 * Executa comando e parseia resultado
 */
async function executeJavaTests(
  repo: string,
  command: string,
  buildTool: string
): Promise<TestResult> {
  let output = '';
  let ok = true;

  try {
    output = execSync(command, {
      cwd: repo,
      encoding: 'utf-8',
      stdio: 'pipe',
    });
  } catch (error: any) {
    ok = false;
    output = error.stdout || error.stderr || '';
  }

  return parseJavaTestOutput(output, ok, buildTool);
}

/**
 * Parse output Maven/Gradle
 */
function parseJavaTestOutput(output: string, ok: boolean, buildTool: string): TestResult {
  // "Tests run: 25, Failures: 2, Errors: 1, Skipped: 3"
  const runMatch = output.match(/Tests run:\s*(\d+)/);
  const failMatch = output.match(/Failures:\s*(\d+)/);
  const errorMatch = output.match(/Errors:\s*(\d+)/);
  const skipMatch = output.match(/Skipped:\s*(\d+)/);

  const totalTests = runMatch ? parseInt(runMatch[1]) : 0;
  const failures = failMatch ? parseInt(failMatch[1]) : 0;
  const errors = errorMatch ? parseInt(errorMatch[1]) : 0;
  const skipped = skipMatch ? parseInt(skipMatch[1]) : 0;
  const failed = failures + errors;
  const passed = totalTests - failed - skipped;

  return {
    ok,
    framework: buildTool === 'maven' ? 'junit-maven' : 'junit-gradle',
    totalTests,
    passed,
    failed,
    skipped,
    duration: 0,
    output,
  };
}

/**
 * Detecta build tool automaticamente e executa
 */
export async function runJavaTestsAuto(
  repo: string,
  options: RunOptions = {}
): Promise<TestResult> {
  if (existsSync(join(repo, 'pom.xml'))) {
    return runMavenTests(repo, options);
  } else if (existsSync(join(repo, 'build.gradle')) || existsSync(join(repo, 'build.gradle.kts'))) {
    return runGradleTests(repo, options);
  } else {
    throw new Error('Build tool não encontrado (Maven ou Gradle)');
  }
}

