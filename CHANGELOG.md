# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2025-10-31

### Added

- Initial release of Quality MCP
- MCP server with 5 core tools:
  - `analyze_codebase`: Detect routes, endpoints, events, and risks
  - `generate_test_plan`: Generate Playwright test plans
  - `scaffold_playwright`: Create Playwright test structure
  - `run_playwright`: Execute tests with coverage
  - `build_report`: Generate QA summary reports
- CLI wrapper with commands: analyze, plan, scaffold, run, report, full
- Detectors for:
  - Next.js routes (app and pages directory)
  - Express/Fastify routes
  - OpenAPI specifications
  - Event emitters (Kafka, SQS, generic events)
- GitHub Actions workflows:
  - CI for pull requests
  - Nightly full test suite
- Comprehensive documentation
- Examples and templates
- Automatic test scaffolding with:
  - Auth tests
  - Form validation tests
  - Search tests
  - Fixtures and utilities

### Features

- Automatic risk assessment based on code analysis
- Flaky test detection and reporting
- Quality gates (CI p95, flaky rate, diff coverage)
- Multi-browser support (Chromium, Firefox, WebKit)
- HTML, JUnit, and JSON reporting
- Slack notifications for CI failures
- PR comments with test results

## [Unreleased]

### Planned

- Support for API testing (REST/GraphQL)
- Cypress integration
- Mutation testing support
- Web dashboard for metrics visualization
- Jira/Linear integration for flaky test tracking
- Multi-environment support (dev, staging, prod)
- Automatic mock generation
- Performance testing integration
- Visual regression testing
- A11y testing integration

