Of course. Here is a refined version of your README, structured for clarity, readability, and accuracy based on the provided source files. It includes tables for commands and settings, adds professional touches like badges, and ensures all features mentioned are verifiable from the code.

-----

# Folder Structure Navigator v2.0

A powerful VS Code extension for generating comprehensive, customizable folder structure representations with advanced filtering, multiple output formats, performance optimization, and AI-powered analysis.

-----

## 🚀 Key Features

| Feature | Description |
| :--- | :--- |
| **Multiple Output Formats** | Generate structures as a classic tree view, JSON, Markdown, or XML. |
| **Advanced Filtering** | Exclude folders, filter by file extension, ignore glob patterns, and respect `.gitignore` rules. |
| **AI-Powered Analysis** | Get insights into your project: detects project type, finds structural issues, and offers recommendations. |
| **Directory Comparison** | Generate a side-by-side comparison report for two different directories. |
| **Batch Processing** | Run generation on multiple directories at once and receive a consolidated report. |
| **Template System** | Save and load custom configuration presets directly within your workspace. |
| **Performance Optimized** | Uses caching for file stats and gitignore rules to ensure speed on repeated operations. |
| **Detailed Metadata** | Optionally include file sizes, permissions, and last modified dates in the output. |
| **Interactive Wizard** | A step-by-step guide to configure your structure generation without touching settings files. |

## 📦 Installation

1.  Open **Visual Studio Code**.
2.  Go to the **Extensions** view (`Ctrl+Shift+X`).
3.  Search for "**Folder Structure Navigator v2.0**".
4.  Click **Install**.

Alternatively, install via the command line:

```bash
code --install-extension samarthasmg14.folder-structure-navigator
```

## 🎯 Quick Start

1.  **Right-click** on any folder in the VS Code Explorer.
2.  Select **Generate Folder Structure**.
3.  The structure will be generated in a new file based on your current settings.

For a customized output, select **Generate Interactive Structure** and follow the step-by-step wizard.

## 🛠️ Commands

The extension provides the following commands, accessible via the Command Palette (`Ctrl+Shift+P`) or context menus:

| Command Title | ID | Default Shortcut |
| :--- | :--- | :--- |
| **Generate Folder Structure** | `generateStructure` | `Ctrl+Alt+S` |
| **Generate Interactive Structure** | `generateInteractiveStructure` | `Ctrl+Alt+Shift+S` |
| **Compare Directory Structures** | `compareDirectories` | - |
| **Export Structure (Multiple Formats)**| `exportStructure` | - |
| **Manage Structure Templates** | `manageTemplates` | - |
| **Show Performance Report** | `showPerformanceReport` | - |
| **Generate Structure with Analysis** | `generateWithAnalysis` | - |
| **Batch Process Directories** | `batchProcess` | - |

## ⚙️ Configuration

Customize the extension's behavior in your `settings.json` file.

| Setting | Description | Default |
| :--- | :--- | :--- |
| `includeHiddenFiles` | Include hidden files and directories (those starting with `.`). | `false` |
| `extensionFilter` | Only include files with these extensions (e.g., `["js", "ts"]`). | `null` |
| `excludeFolders` | A list of folder names to exclude from generation. | `["node_modules", ".git", ...]` |
| `excludePatterns` | Glob patterns to exclude from the structure (e.g., `*.log`). | `["*.log", "*.tmp", ...]` |
| `maxDepth` | Maximum directory depth to traverse. `0` means unlimited. | `10` |
| `respectGitignore` | Respect `.gitignore` rules when generating structures. | `true` |
| `includeSize` | Include file and directory sizes in the output. | `false` |
| `includePermissions` | Include file permissions in the output (Unix-like systems). | `false` |
| `includeModifiedDate`| Include the last modified date in the output. | `false` |
| `sortBy` | Sort files and directories by `name`, `size`, `modified`, or `type`. | `"name"` |
| `outputFormat` | Default output format for structure generation: `tree`, `json`, `markdown`, `xml`. | `"tree"` |
| `useProgressIndicator`| Show a progress indicator during structure generation. | `true` |
| `enableCaching` | Enable caching for improved performance on repeated operations. | `true` |
| `iconStyle` | Icon style for file and folder representation: `emoji`, `unicode`, `ascii`, `none`. | `"emoji"` |
| `customIcons` | Custom icon mappings for file extensions (e.g., `  {".vue": "🎨"} `). | `{}` |
| `compressLargeDirs` | Compress directories with many files for better readability. | `true` |
| `compressionThreshold`| Number of items in a directory before compression is applied. | `50` |
| `autoSave` | Automatically save generated structures to a file. | `true` |
| `autoOpen` | Automatically open the generated structure file after creation. | `true` |

## 📋 Output Formats

#### Tree Format (default)

A classic, readable tree view.

```
📁 my-project
├── 📄 README.md (2.1 KB)
├── 📁 src
│   ├── 📄 index.js (3.2 KB)
│   └── 📁 components
│       └── 📄 Header.jsx (1.8 KB)
```

#### JSON Format

Detailed, machine-readable output perfect for scripting and tools.

```json
{
  "metadata": {
    "generatedAt": "2025-08-16T15:37:12.000Z",
    "generationTime": "150ms",
    "itemsProcessed": 25
  },
  "structure": {
    "name": "my-project",
    "type": "directory",
    "children": [...]
  }
}
```

#### Markdown Format

Ideal for embedding in `README.md` files or other documentation.

```markdown
# 📁 my-project

**Generated:** 2025-08-16T15:37:12.000Z
**Generation Time:** 150ms

## Directory Structure
...
```

## 🔧 Advanced Usage

### Template Management

Save and reuse your favorite configurations without editing `settings.json` every time.

  * **Save a Template:** Run `Manage Structure Templates` → `Save Current Config as Template`.
  * **Load a Template:** Run `Manage Structure Templates` → `Load Template`.
  * Templates are saved locally in your project's `.vscode/folder-navigator-templates.json` file.

### AI-Powered Analysis

Get automated insights into your project's architecture.

1.  Run the **Generate Structure with Analysis** command.
2.  The extension will produce a markdown report including:
      * **Detected Project Type:** (e.g., React, Node.js API, Python).
      * **Structure Health:** Highlights potential issues like deep nesting or missing `LICENSE` files.
      * **Recommendations:** Suggests improvements based on best practices.
      * **Detected Technology Stack:** A list of frameworks and tools found in the project.

## 🐛 Troubleshooting & Support

  * **Slow Generation:** For very large projects, ensure `maxDepth` is set to a reasonable number and that large asset folders (like `node_modules`) are in `excludeFolders`.
  * **Bugs & Feature Requests:** Please open an issue on the [GitHub repository](https://github.com/DEADSERPENT/folder-structure-navigator/issues). Provide steps to reproduce, your configuration, and any relevant logs.

## 🤝 Contributing

Contributions are welcome\! Please fork the repository and submit a pull request with your changes.

## 📄 License

This project is licensed under the MIT License. See the [LICENSE](https://www.google.com/search?q=https://github.com/DEADSERPENT/folder-structure-navigator/blob/main/LICENSE) file for details.