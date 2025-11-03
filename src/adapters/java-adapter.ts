import type { LanguageAdapter, TestGenerationOptions, TestScenario } from './base-adapter.js';

export class JavaAdapter implements LanguageAdapter {
  language = 'java';
  defaultFramework = 'junit';
  
  generateUnitTest(functionName: string, filePath: string, options?: TestGenerationOptions): string {
    const scenarios = options?.scenarios || ['happy', 'error', 'edge'];
    const includeComments = options?.includeComments !== false;
    
    // Extrai classe e package do arquivo
    const className = this.capitalize(functionName);
    const packageName = this.extractPackageName(filePath);
    
    const testCases = this.generateScenarios(functionName, scenarios, includeComments);
    
    return `package ${packageName};

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import static org.junit.jupiter.api.Assertions.*;

@DisplayName("${className} Unit Tests")
class ${className}Test {
    
    private ${className} ${functionName};
    
    @BeforeEach
    void setUp() {
        ${functionName} = new ${className}();
    }
    
${testCases.map(tc => tc.code).join('\n\n')}
}
`;
  }
  
  generateIntegrationTest(componentName: string, options?: TestGenerationOptions): string {
    const className = this.capitalize(componentName);
    
    return `package com.example.integration;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.DisplayName;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.boot.test.web.client.TestRestTemplate;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import static org.junit.jupiter.api.Assertions.*;

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@DisplayName("${className} Integration Tests")
class ${className}IntegrationTest {
    
    @Autowired
    private TestRestTemplate restTemplate;
    
    @BeforeEach
    void setUp() {
        // Setup: Initialize test database, mocks, etc.
    }
    
    @AfterEach
    void tearDown() {
        // Cleanup: Clean test data
    }
    
    @Test
    @DisplayName("Should handle successful requests")
    void shouldHandleSuccessfulRequest() {
        ResponseEntity<String> response = restTemplate.getForEntity(
            "/api/${componentName.toLowerCase()}",
            String.class
        );
        
        assertEquals(HttpStatus.OK, response.getStatusCode());
        assertNotNull(response.getBody());
    }
    
    @Test
    @DisplayName("Should handle invalid input")
    void shouldHandleInvalidInput() {
        // TODO: Implement invalid input test
    }
    
    @Test
    @DisplayName("Should handle database errors")
    void shouldHandleDatabaseErrors() {
        // TODO: Implement database error test
    }
}
`;
  }
  
  generateE2ETest(scenarioName: string, options?: TestGenerationOptions): string {
    const className = this.capitalize(scenarioName);
    
    return `package com.example.e2e;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.openqa.selenium.WebDriver;
import org.openqa.selenium.chrome.ChromeDriver;
import static org.junit.jupiter.api.Assertions.*;

@DisplayName("${className} E2E Tests")
class ${className}E2ETest {
    
    private WebDriver driver;
    
    @BeforeEach
    void setUp() {
        driver = new ChromeDriver();
        driver.get("http://localhost:8080");
    }
    
    @Test
    @DisplayName("Should complete ${scenarioName} flow")
    void shouldCompleteFlow() {
        // 1. Arrange: Navigate to initial page
        
        // 2. Act: Execute user actions
        
        // 3. Assert: Verify expected result
        // TODO: Implement E2E test
    }
    
    @Test
    @DisplayName("Should handle errors gracefully")
    void shouldHandleErrors() {
        // TODO: Implement error test
    }
}
`;
  }
  
  getTestFileExtension(): string {
    return 'Test.java';
  }
  
  getTestPatterns(): string[] {
    return [
      '**/src/test/**/*Test.java',
      '**/src/test/**/*Tests.java'
    ];
  }
  
  getTestCommand(): string {
    return 'mvn test';
  }
  
  getCoverageCommand(): string {
    return 'mvn clean test jacoco:report';
  }
  
  getCoverageFile(): string {
    return 'target/site/jacoco/jacoco.xml';
  }
  
  private capitalize(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1);
  }
  
  private extractPackageName(filePath: string): string {
    // Ex: src/main/java/com/example/utils/Math.java → com.example.utils
    const parts = filePath.split('/');
    const javaIndex = parts.indexOf('java');
    
    if (javaIndex >= 0 && javaIndex < parts.length - 1) {
      return parts.slice(javaIndex + 1, -1).join('.');
    }
    
    return 'com.example.test';
  }
  
  private generateScenarios(functionName: string, scenarios: string[], includeComments: boolean): TestScenario[] {
    const result: TestScenario[] = [];
    const methodName = functionName.charAt(0).toLowerCase() + functionName.slice(1);
    
    if (scenarios.includes('happy')) {
      result.push({
        name: 'happy path',
        description: 'Tests successful execution with valid input',
        code: `    @Test
    @DisplayName("Should work correctly with valid input")
    void shouldWorkCorrectlyWithValidInput() {
        ${includeComments ? '// Arrange: Prepare valid input\n        ' : ''}Object input = new Object(); // TODO: Define valid input
        
        ${includeComments ? '// Act: Execute function\n        ' : ''}Object result = ${methodName}.${functionName}(input);
        
        ${includeComments ? '// Assert: Verify expected result\n        ' : ''}assertNotNull(result);
        // TODO: Add specific assertions
    }`
      });
    }
    
    if (scenarios.includes('error')) {
      result.push({
        name: 'error handling',
        description: 'Tests error handling',
        code: `    @Test
    @DisplayName("Should handle errors appropriately")
    void shouldHandleErrorsAppropriately() {
        ${includeComments ? '// Arrange: Prepare invalid input\n        ' : ''}Object invalidInput = null;
        
        ${includeComments ? '// Act & Assert: Verify exception is thrown\n        ' : ''}assertThrows(IllegalArgumentException.class, () -> {
            ${methodName}.${functionName}(invalidInput);
        });
        // TODO: Verify exception message/type
    }`
      });
    }
    
    if (scenarios.includes('edge')) {
      result.push({
        name: 'edge cases',
        description: 'Tests edge cases',
        code: `    @Test
    @DisplayName("Should handle edge cases")
    void shouldHandleEdgeCases() {
        ${includeComments ? '// Arrange: Prepare edge cases\n        ' : ''}Object[] edgeCases = {null, "", 0, -1, Integer.MAX_VALUE};
        
        ${includeComments ? '// Act & Assert: Test each edge case\n        ' : ''}for (Object edgeCase : edgeCases) {
            Object result = ${methodName}.${functionName}(edgeCase);
            assertNotNull(result);
            // TODO: Validate behavior for edge case
        }
    }`
      });
    }
    
    return result;
  }
}
