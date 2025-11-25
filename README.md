# Folder Structure Navigator

Generate beautiful, customizable folder structure diagrams for your projects with advanced filtering, multiple export formats, and AI-powered insights.

## ✨ Features

- **Multiple Formats**: Export as Tree, JSON, Markdown, XML, or CSV
- **Smart Filtering**: Respect .gitignore, filter by extension, exclude folders
- **AI Analysis**: Detect project type, find issues, get recommendations
- **Memory Efficient**: Streaming mode for large repositories (10,000+ files)
- **Interactive Wizard**: Step-by-step configuration without editing settings
- **Directory Comparison**: Compare two folders side-by-side
- **Batch Processing**: Generate reports for multiple directories
- **Rich Metadata**: Include file sizes, permissions, and modified dates

## 🚀 Quick Start

1. Right-click any folder in VS Code Explorer
2. Select **Generate Folder Structure**
3. View the generated structure (auto-saved)

**Keyboard Shortcuts:**
- `Ctrl+Alt+S` (Mac: `Cmd+Alt+S`) - Quick generate
- `Ctrl+Alt+Shift+S` - Interactive mode with wizard

## 📋 Commands

Open Command Palette (`Ctrl+Shift+P`) and search for:

- `Generate Folder Structure` - Quick generation with default settings
- `Generate Interactive Structure` - Step-by-step wizard
- `Compare Directory Structures` - Compare two folders
- `Export Structure` - Choose format after selecting folder
- `Generate with Analysis` - Include AI-powered insights
- `Batch Process Directories` - Process multiple folders
- `Manage Templates` - Save/load configuration presets

## ⚙️ Configuration

Access settings via `File > Preferences > Settings` and search for "Folder Structure Navigator":

**Essential Settings:**
- `includeHiddenFiles` - Show hidden files/folders
- `maxDepth` - Maximum directory depth (0 = unlimited)
- `outputFormat` - Default format: tree, json, markdown, xml, csv
- `excludeFolders` - Folders to skip (default: node_modules, .git, dist)
- `respectGitignore` - Honor .gitignore rules
- `useStreaming` - Enable for large repos (10,000+ files)

**Presets:** Apply quick configurations:
- `Minimal` - Basic structure, limited depth
- `Detailed` - Include all metadata
- `Documentation` - Markdown format, shallow depth
- `Development` - Source code files only

## 💡 Examples

**Basic tree structure:**
```
📁 my-project
──────────────────────────────────────────────────
├── 📁 src
│   ├── 📄 index.ts
│   └── 📄 utils.ts
├── 📄 package.json
└── 📄 README.md
```

**With metadata:**
```
├── 📄 app.ts (2.5 KB) [rw-r--r--] ⏰ 2025-01-15
```

**AI Analysis:**
```markdown
## 📊 Project analysis
- **Detected type:** React/Next.js
- **Issues:** Missing common files: LICENSE, .gitignore
- **Recommendations:** Add ESLint configuration
- **Technologies:** JavaScript/TypeScript, NodeJS, Webpack
```

## 🎯 Use Cases

- **Documentation** - Include folder structures in README files
- **Onboarding** - Help new team members understand project layout
- **Code Reviews** - Visualize project organization
- **Architecture** - Document and share project structure
- **Backup** - Keep snapshots of directory organization

## 🔧 Advanced Features

**Worker Threads:** Enable `useWorker` for CPU-intensive operations (experimental)

**Streaming Mode:** Enable `useStreaming` for memory-efficient processing of massive repositories

**Custom Icons:** Define custom file type icons in settings:
```json
{
  "advanced-folder-structure-navigator.customIcons": {
    ".vue": "🎨",
    ".go": "🐹"
  }
}
```

**Compression:** Large directories (50+ items) are automatically collapsed - adjust threshold in settings

## 📝 Tips

- Use `.gitignore` to automatically exclude build artifacts
- Save configurations as templates for reuse across projects
- Enable metadata (size, dates) for documentation snapshots
- Use CSV format for importing into spreadsheets
- Compare directories before/after major refactoring

## 🐛 Issues & Feedback

Report issues or request features on [GitHub](https://github.com/DEADSERPENT/folder-structure-navigator/issues)

## 📄 License

MIT License - see LICENSE file for details

---

**Version:** 2.0.0
**Publisher:** samarthasmg14
**Last Updated:** November 2025
