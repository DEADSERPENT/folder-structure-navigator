# 📂 Folder Structure Navigator v2.0.0

A **VS Code extension** to generate, explore, and export customizable folder structures — with advanced filtering, multiple formats, AI-powered insights, and performance optimization.

---

## 🚀 Key Features

| Feature                     | Description                                                                            |
| :-------------------------- | :------------------------------------------------------------------------------------- |
| **Multiple Output Formats** | Export structures as Tree View, JSON, Markdown, or XML.                                |
| **Advanced Filtering**      | Exclude folders, filter by extensions, ignore glob patterns, and respect `.gitignore`. |
| **AI-Powered Analysis**     | Detects project type, finds structural issues, and provides recommendations.           |
| **Directory Comparison**    | Side-by-side comparison of two different directories.                                  |
| **Batch Processing**        | Generate reports for multiple directories at once.                                     |
| **Template System**         | Save/load configuration presets for reuse.                                             |
| **Performance Optimized**   | Uses caching for faster repeated operations.                                           |
| **Detailed Metadata**       | Optionally include size, permissions, and modified dates.                              |
| **Interactive Wizard**      | Step-by-step guide to configure generation without editing settings.                   |

---

## 📦 Installation

1. Open **Visual Studio Code**.
2. Go to **Extensions** (`Ctrl+Shift+X`).
3. Search for **"Folder Structure Navigator v2.0"**.
4. Click **Install**.

Or via CLI:

```bash
code --install-extension samarthasmg14.folder-structure-navigator
```

---

## 🎯 Quick Start

1. **Right-click** on any folder in the VS Code Explorer.
2. Select **Generate Folder Structure**.
3. View the structure in a new file (auto-saved).

👉 For more control, choose **Generate Interactive Structure** and follow the prompts.

---

## 🛠️ Commands

| Command                            | ID                             | Shortcut           |
| :--------------------------------- | :----------------------------- | :----------------- |
| **Generate Folder Structure**      | `generateStructure`            | `Ctrl+Alt+S`       |
| **Generate Interactive Structure** | `generateInteractiveStructure` | `Ctrl+Alt+Shift+S` |
| **Compare Directories**            | `compareDirectories`           | –                  |
| **Export Structure**               | `exportStructure`              | –                  |
| **Manage Templates**               | `manageTemplates`              | –                  |
| **Show Performance Report**        | `showPerformanceReport`        | –                  |
| **Generate with Analysis**         | `generateWithAnalysis`         | –                  |
| **Batch Process Directories**      | `batchProcess`                 | –                  |

---

## ⚙️ Configuration

Add custom settings in `settings.json`:

| Setting                | Description                                         | Default                   |
| :--------------------- | :-------------------------------------------------- | :------------------------ |
| `includeHiddenFiles`   | Include hidden files (`.` prefix).                  | `false`                   |
| `extensionFilter`      | Limit by extensions (`["js","ts"]`).                | `null`                    |
| `excludeFolders`       | Folders to skip.                                    | `["node_modules",".git"]` |
| `excludePatterns`      | Glob patterns to skip (e.g., `*.log`).              | `["*.log","*.tmp"]`       |
| `maxDepth`             | Max folder depth (0 = unlimited).                   | `10`                      |
| `respectGitignore`     | Respect `.gitignore` rules.                         | `true`                    |
| `includeSize`          | Show file/folder sizes.                             | `false`                   |
| `includePermissions`   | Show file permissions.                              | `false`                   |
| `includeModifiedDate`  | Show last modified date.                            | `false`                   |
| `sortBy`               | Sort by `name`, `size`, `modified`, or `type`.      | `"name"`                  |
| `outputFormat`         | Default format (`tree`, `json`, `markdown`, `xml`). | `"tree"`                  |
| `useProgressIndicator` | Show progress during generation.                    | `true`                    |
| `enableCaching`        | Enable caching for speed.                           | `true`                    |
| `iconStyle`            | Icon style: `emoji`, `unicode`, `ascii`, `none`.    | `"emoji"`                 |
| `customIcons`          | Map extensions to icons.                            | `{}`                      |
| `compressLargeDirs`    | Collapse large directories.                         | `true`                    |
| `compressionThreshold` | Collapse if > N items.                              | `50`                      |
| `autoSave`             | Auto-save generated structures.                     | `true`                    |
| `autoOpen`             | Auto-open after creation.                           | `true`                    |

---

## 📋 Output Formats

**Tree View (default)**

```
📁 my-project
├── 📄 README.md (2.1 KB)
├── 📁 src
│   ├── 📄 index.js (3.2 KB)
│   └── 📁 components
│       └── 📄 Header.jsx (1.8 KB)
```

**JSON**

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

**Markdown**

```markdown
# 📁 my-project
**Generated:** 2025-08-16T15:37:12.000Z  
**Generation Time:** 150ms  

## Directory Structure
...
```

---

## 🔧 Advanced Usage

### Templates

* **Save Template:** `Manage Templates` → *Save Current Config*
* **Load Template:** `Manage Templates` → *Load Template*
* Stored in `.vscode/folder-navigator-templates.json`.

### AI-Powered Analysis

Run **Generate with Analysis** → produces a report with:

* Detected project type (e.g., React, Node.js, Python).
* Health checks (deep nesting, missing LICENSE, etc).
* Best practice recommendations.
* Detected frameworks/tools.

---

## 🐛 Troubleshooting

* **Slow on big projects?** Exclude heavy folders (`node_modules`) and lower `maxDepth`.
* Report bugs/requests → [GitHub Issues](https://github.com/DEADSERPENT/folder-structure-navigator/issues).

---

## 🤝 Contributing

Contributions welcome! Fork → improve → PR.

---

## 📄 License

MIT License — see [LICENSE](https://github.com/DEADSERPENT/folder-structure-navigator/blob/main/LICENSE).