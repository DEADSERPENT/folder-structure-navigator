# Folder Structure Navigator v2.0 - Developer Quickstart

Welcome to the **Folder Structure Navigator** extension! This guide will help you get started with development.

---

## 🏗️ Architecture (v2.0 Refactored)

This extension has been completely refactored from a monolithic 1,828-line file into a **modular, testable architecture**:

```
src/
├── models/              # TypeScript interfaces & types
│   ├── config.interface.ts
│   ├── file-entry.interface.ts
│   └── stream.interface.ts
│
├── core/                # Pure business logic (NO vscode dependencies)
│   ├── generator.ts          # Main structure generator
│   ├── streaming-generator.ts # Memory-efficient streaming mode
│   ├── analyzer.ts           # AI/heuristic analysis
│   └── worker.ts             # Worker thread entry point
│
├── utils/               # Shared utilities
│   ├── performance.ts   # Performance monitoring
│   ├── cache.ts         # Caching (gitignore, stats)
│   ├── fs-helpers.ts    # Filesystem utilities
│   ├── formatting.ts    # Output formatters (tree, JSON, etc.)
│   ├── streaming-formatter.ts # Event-based formatter
│   └── config.ts        # Configuration loading & wizards
│
├── commands/            # VS Code command handlers
│   ├── generate.ts      # Main generation command
│   ├── compare.ts       # Directory comparison
│   ├── export.ts        # Export command
│   ├── analysis.ts      # AI analysis command
│   ├── templates.ts     # Template management
│   ├── batch.ts         # Batch processing
│   └── performance.ts   # Performance report
│
├── test/                # Test suites (54 tests, 100% passing)
│   ├── generator.test.ts
│   ├── streaming.test.ts
│   ├── formatting.test.ts
│   ├── cache.test.ts
│   └── extension.test.ts
│
└── extension.ts         # Entry point (129 lines)
```

**Total:** 17 focused modules + comprehensive test suite

---

## 🚀 Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Open in VS Code

```bash
code .
```

### 3. Run the Extension

Press **F5** to launch a new VS Code window with the extension loaded in debug mode.

### 4. Test Commands

In the debug window:
1. Right-click any folder in Explorer
2. Select **"Generate Folder Structure"** or **"Generate Interactive Structure"**
3. Check the Debug Console for logs

---

## 🔧 Development Workflow

### Compile TypeScript

```bash
npm run compile        # One-time compilation
npm run watch          # Watch mode (auto-recompile)
```

### Run Tests

```bash
npm test              # Run all tests (54 tests)
npm run compile-tests # Compile tests only
```

**Test Structure:**
- `generator.test.ts` - Core logic (17 tests)
- `streaming.test.ts` - Streaming mode (11 tests)
- `formatting.test.ts` - Output formats (12 tests)
- `cache.test.ts` - Caching utilities (13 tests)
- `extension.test.ts` - Extension activation (1 test)

### Linting

```bash
npm run lint          # Check code quality
```

### Build for Production

```bash
npm run package       # Creates optimized dist/ bundle
```

---

## 📋 Key Files

### `package.json`
- Defines extension metadata, commands, configuration schema
- **Important sections:**
  - `contributes.commands` - All available commands
  - `contributes.configuration` - User settings
  - `contributes.menus` - Context menu entries
  - `contributes.keybindings` - Keyboard shortcuts

### `src/extension.ts` (Entry Point)
- Registers all commands
- Wires up command handlers
- Manages extension lifecycle (`activate`, `deactivate`)
- **Clean and minimal** (129 lines vs. original 1,828)

### `esbuild.js`
- Bundles the extension using esbuild
- **Two bundles:**
  1. `dist/extension.js` - Main extension
  2. `dist/core/worker.js` - Worker thread (NO vscode dependency)

### `tsconfig.json`
- TypeScript compiler configuration
- Target: ES2020
- Module: CommonJS

---

## 🎯 Core Features

### 1. **Standard Generation**
File: `src/core/generator.ts`
- Builds complete tree in memory
- Fast for small-medium projects (<10,000 files)
- Returns formatted string

### 2. **Streaming Generation** (v2.1)
File: `src/core/streaming-generator.ts`
- Uses async generators (`function*`)
- Memory-efficient for massive repos (100,000+ files)
- Yields events incrementally

### 3. **Worker Threads** (Experimental)
File: `src/core/worker.ts`
- Offloads generation to separate thread
- Prevents UI blocking
- **Fixed in v2.0** - No longer crashes!

### 4. **AI Analysis**
File: `src/core/analyzer.ts`
- Detects project type (React, Node.js, Python, etc.)
- Finds structural issues
- Provides recommendations

---

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Watch mode for test development
npm run watch-tests
```

### Writing Tests

Tests use **Mocha** and VS Code's testing framework. Example:

```typescript
import * as assert from 'assert';
import { StructureGenerator } from '../core/generator';

test('Generates simple tree structure', async () => {
    const config = { maxDepth: 10, outputFormat: 'tree' };
    const generator = new StructureGenerator(config);
    const result = await generator.generate(testDir);

    assert.ok(result.includes('file1.txt'));
});
```

**Test Coverage:** 54 tests covering all major features

---

## 🐛 Debugging

### Set Breakpoints
- Click left gutter in any `.ts` file to set breakpoints
- Press **F5** to start debugging
- Trigger commands in the debug window

### Debug Console
- View `console.log()` output
- Check for errors and warnings

### Debug Worker Threads
Worker threads are harder to debug. Add `console.log()` statements in `src/core/worker.ts` and check terminal output.

---

## 📦 Building for Release

### 1. Update Version

Edit `package.json`:
```json
{
  "version": "2.1.0"
}
```

### 2. Build Production Bundle

```bash
npm run package
```

This creates optimized files in `dist/`:
- `extension.js` (minified, ~50KB)
- `core/worker.js` (minified, ~20KB)

### 3. Package Extension

```bash
vsce package
```

Creates `folder-structure-navigator-2.1.0.vsix`

### 4. Publish

```bash
vsce publish
```

---

## 🔍 Key Concepts

### **Clean Architecture**
The extension follows separation of concerns:
- **Models** - Data structures (no logic)
- **Core** - Pure business logic (no VS Code API)
- **Utils** - Shared helpers
- **Commands** - VS Code integration layer

### **Why Core Has No `vscode` Imports**
This enables:
- ✅ Worker thread support (workers can't access `vscode` module)
- ✅ Unit testing without VS Code environment
- ✅ Better separation of concerns

### **Streaming vs. Non-Streaming**
| Aspect | Non-Streaming | Streaming |
|--------|---------------|-----------|
| Memory | O(n) | O(1) |
| Speed | Faster | Slightly slower |
| Use Case | Small repos | Large repos (10K+ files) |

---

## 📚 Resources

### VS Code Extension Development
- [Extension API](https://code.visualstudio.com/api)
- [Extension Guides](https://code.visualstudio.com/api/extension-guides/overview)
- [Testing Extensions](https://code.visualstudio.com/api/working-with-extensions/testing-extension)

### TypeScript
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [Async Generators](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Statements/async_function*)

### Project Documentation
- `REFACTORING_SUMMARY.md` - Architecture refactoring details
- `STREAMING_FEATURE.md` - Streaming implementation guide
- `TEST_SUMMARY.md` - Test coverage report

---

## 🎓 Learning Path

### For New Contributors

1. **Read the README** - Understand what the extension does
2. **Review `extension.ts`** - See how commands are registered
3. **Explore `core/generator.ts`** - Understand core logic
4. **Run tests** - See how features are tested
5. **Make a small change** - Fix a bug or add a feature
6. **Submit a PR** - Contribute back!

### For Advanced Development

1. Study `core/streaming-generator.ts` - Async generator pattern
2. Review `core/worker.ts` - Worker thread implementation
3. Explore `utils/formatting.ts` - Output format handling
4. Read test suites - Learn edge cases and best practices

---

## 🚨 Common Issues

### "Extension host terminated unexpectedly"
- Check Debug Console for errors
- Ensure all imports are valid
- Verify `esbuild.js` is bundling correctly

### Tests Failing
- Run `npm run compile-tests` first
- Clear cache: `rm -rf out/`
- Check test file syntax

### Worker Thread Crashes
- Verify `core/worker.ts` has no `vscode` imports
- Check `esbuild.js` bundles worker separately
- Ensure worker file exists in `dist/core/worker.js`

---

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes
4. Run tests (`npm test`)
5. Commit (`git commit -m 'Add amazing feature'`)
6. Push (`git push origin feature/amazing-feature`)
7. Open a Pull Request

---

## 📄 License

MIT License - See LICENSE file for details

---

**Happy Coding! 🚀**

For questions or issues, open an issue on [GitHub](https://github.com/DEADSERPENT/folder-structure-navigator/issues).
