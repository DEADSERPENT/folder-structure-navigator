# 📁 Folder Structure Navigator — VS Code Extension

This repository contains the complete source code for your **Folder Structure Navigator** — a VS Code extension to generate, explore, and export your project’s folder structure, with smart `.gitignore` integration and powerful custom filtering.

---

## 🚀 What's in this folder?

* `package.json`:
  Defines the extension manifest, commands, settings, activation events, and VS Code metadata.

* `src/extension.ts`:
  The main entry point. This is where:

  * The `activate` function is defined (called by VS Code when the extension loads).
  * Commands like `generateStructure` and `generateCustomStructure` are registered.
  * All core logic for traversing folders and writing structure files lives.

* `test/`:
  Contains automated tests using Mocha & VS Code Test Runner.

* `esbuild.js` & `tsconfig.json`:
  For bundling TypeScript efficiently.

---

## ⚙ Setup for development

* Install recommended extensions:

  * `dbaeumer.vscode-eslint` for linting
  * `amodio.tsl-problem-matcher` for better TypeScript errors in tasks
  * `ms-vscode.extension-test-runner` for running extension tests

---

## 🚀 Get up and running immediately

1. Open this folder in VS Code.

2. Press `F5` to launch a new VS Code window **with your extension loaded in development mode**.

3. Right-click on any folder in the Explorer to:

   * 🗂 `Generate Folder Structure`
   * ⚙ `Generate Custom Structure`

4. Debug by setting breakpoints in `src/extension.ts` — check the Debug Console for logs.

---

## 🔄 Making changes

* Modify code in `src/extension.ts`.
* Re-run your extension with the debug toolbar, or reload the VS Code window (`Ctrl+R` / `Cmd+R` on Mac).

---

## 🧪 Running tests

* Run the `"watch"` task via **Tasks: Run Task**, so TypeScript stays in sync.
* Open the Testing view (`Ctrl+Shift+;` on Windows / `Cmd+Shift+;` on Mac) and click Run Tests.
* Modify or add tests in `test/**/*.test.ts`.

---

## 💡 Exploring the VS Code API

* For full intellisense, open `node_modules/@types/vscode/index.d.ts`.
* Or browse the [VS Code Extension API docs](https://code.visualstudio.com/api).

---

## 🚀 Going further

* Reduce size & improve startup time by [bundling your extension](https://code.visualstudio.com/api/working-with-extensions/bundling-extension) with esbuild (already set up here).
* [Publish your extension](https://code.visualstudio.com/api/working-with-extensions/publishing-extension) to the Marketplace.
* Automate builds & tests with [CI/CD for extensions](https://code.visualstudio.com/api/working-with-extensions/continuous-integration).

---
