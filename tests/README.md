# Aperture Test Suite

This directory contains the test suite for Aperture, covering unit tests, integration tests, and fixtures.

## Test Structure

```
tests/
├── unit/               # Unit tests for individual modules
├── integration/        # Integration tests for CLI and components
└── fixtures/           # Test data and mock files
```

## Running Tests

```bash
# Run all tests
npm test

# Run only unit tests
npm run test:unit

# Run only integration tests
npm run test:integration

# Run tests in watch mode (during development)
npm test -- --watch

# Run tests with coverage report
npm test -- --coverage
```

## Test Coverage

### Unit Tests (31 tests)

- **Config Schema** (6 tests) - Validates configuration structure and types
- **Export Types** (4 tests) - Validates export sizes and device configurations
- **Logger** (3 tests) - Validates logging functionality
- **Template Engine** (9 tests) - Validates template loading and style definitions
- **Translation Service** (5 tests) - Validates translation hash generation and prompt building
- **Parameterizer** (4 tests) - Validates parameter detection and substitution

### Integration Tests (13 tests)

- **CLI Help** (13 tests) - Validates CLI help output, version, and command listing

## Test Requirements

### Prerequisites

1. **Built project**: Tests require the project to be compiled
   ```bash
   npm run build
   ```

2. **Node.js 18+**: Required for native ES modules and fetch API

### Integration Test Requirements

Integration tests that interact with iOS Simulators require:
- macOS with Xcode installed
- iOS Simulators installed
- At least one Simulator booted

**Note**: Current integration tests only validate CLI help and don't require Simulators.

## Writing Tests

### Unit Test Example

```typescript
import { describe, it, expect } from 'vitest';

describe('MyModule', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

### Integration Test Example

```typescript
import { describe, it, expect } from 'vitest';
import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

describe('CLI Integration', () => {
  it('should execute command', async () => {
    const { stdout } = await execFileAsync('node', ['dist/cli/index.js', '--version']);
    expect(stdout).toMatch(/\d+\.\d+\.\d+/);
  });
});
```

## Test Fixtures

The `fixtures/` directory contains mock data for testing:

- **mock-recording.json**: Sample recording with steps and screenshot points
- Additional fixtures can be added as needed

## Continuous Integration

Tests are designed to run in CI environments. For CI pipelines:

1. Install dependencies: `npm install`
2. Build project: `npm run build`
3. Run tests: `npm run test:unit` (integration tests may require Simulator setup)

## Coverage Goals

- **Unit tests**: Aim for >80% code coverage on core business logic
- **Integration tests**: Cover all CLI commands and major workflows
- **E2E tests**: Test complete recording → export pipeline (requires Simulator)

## Current Status

✅ Unit test infrastructure complete
✅ 31 unit tests passing
✅ 13 integration tests passing
⏳ E2E tests with Simulator (future work)

## Future Test Areas

1. **Simulator Integration**: Tests that boot Simulators and verify device management
2. **Recording Flow**: End-to-end recording with mock app
3. **Playback Flow**: Replay with selector cascade and AI fallback
4. **Export Pipeline**: Full template application and export generation
5. **Error Scenarios**: Comprehensive error handling validation
