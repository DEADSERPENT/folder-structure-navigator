# 📂 Folder Structure Navigator v1.0

A simple yet powerful **VS Code extension** to generate and explore folder structures in multiple formats, with filtering, templates, and AI-powered insights.

---

## 🚀 Features

* Generate folder structures in **Tree, JSON, Markdown, or XML**.
* **Filters & Exclusions**: skip hidden files, `node_modules`, or by extension/pattern.
* **AI Insights**: detect project type, highlight issues, and suggest improvements.
* **Compare Directories**: side-by-side reports.
* **Templates**: save & reuse configs.
* **Performance Optimized** with caching & progress indicator.

---

## 📦 Installation

Open VS Code → Extensions (`Ctrl+Shift+X`) → search **“Folder Structure Navigator v2.0”** → Install.

Or via CLI:

```bash
code --install-extension samarthasmg14.folder-structure-navigator
```

---

## 🎯 Usage

1. **Right-click** a folder in VS Code Explorer.
2. Choose **Generate Folder Structure**.
3. View the structure in a new file.

For custom setup, run **Generate Interactive Structure** and follow the wizard.

---

## 🛠️ Commands

| Command                   | Shortcut           | Description             |
| ------------------------- | ------------------ | ----------------------- |
| Generate Folder Structure | `Ctrl+Alt+S`       | Create a structure file |
| Interactive Structure     | `Ctrl+Alt+Shift+S` | Step-by-step wizard     |
| Compare Directories       | –                  | Side-by-side report     |
| Export Structure          | –                  | Multiple formats        |
| Manage Templates          | –                  | Save/load presets       |

---

## ⚙️ Basic Settings

Add to your VS Code `settings.json`:

```json
{
  "folderNavigator.maxDepth": 10,
  "folderNavigator.excludeFolders": ["node_modules", ".git"],
  "folderNavigator.outputFormat": "tree",
  "folderNavigator.respectGitignore": true
}
```

---

## 📋 Example Output (Tree)

```
📁 my-project
├── 📄 README.md
├── 📁 src
│   ├── 📄 index.js
│   └── 📁 components
│       └── 📄 Header.jsx
```

---

## 🐛 Troubleshooting

* **Slow on big projects?** Increase `excludeFolders` and lower `maxDepth`.
* Report issues → [GitHub Issues](https://github.com/DEADSERPENT/folder-structure-navigator/issues)

---

## 🤝 Contributing

Fork → Improve → PRs welcome!

## 📄 License

MIT License – see [LICENSE](https://github.com/DEADSERPENT/folder-structure-navigator/blob/main/LICENSE).

---

👉 This trimmed version removes bulk tables and details but keeps **installation, usage, key settings, and example output** so anyone can get started quickly.

Do you want me to also prepare a **super-short "minimal README.md" (just 5 sections: About, Install, Usage, Example, License)** for publishing on the marketplace?
