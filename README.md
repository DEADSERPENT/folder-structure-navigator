
# 📁 Folder Structure Navigator

> 🚀 A powerful VS Code extension to **generate, explore, and export** your project’s folder structure — with smart `.gitignore` integration and advanced filtering.

---

## ✨ Features

* ✅ **Generate Folder Structure**

  * Right-click any folder in VS Code Explorer and instantly create a neat tree view of its directory structure.
  * Saves to a configurable `.txt` file (default: `structure.txt`).
  * Automatically updates the nearest `.gitignore` to exclude this file.

* ✅ **Generate Custom Structure**

  * Customize how the structure is generated:

    * Include hidden files (dotfiles).
    * Filter by specific file extensions (e.g. `js`, `ts`, `json`).
    * Exclude selected folders (like `node_modules`, `dist`, etc).
  * Saves as `custom_structure.txt`.

* ✅ **Smart Output Options**

  * After generation, quickly:

    * **Open the file** in the editor.
    * **Copy the structure** directly to clipboard.

---

## ⚙ Extension Settings

This extension contributes the following settings:

| Setting                                                     | Description                                    | Default                                     |
| ----------------------------------------------------------- | ---------------------------------------------- | ------------------------------------------- |
| `advanced-folder-structure-navigator.outputFileName`        | Default filename for generated structure files | `structure.txt`                             |
| `advanced-folder-structure-navigator.includeHiddenFiles`    | Include hidden files (dotfiles)                | `false`                                     |
| `advanced-folder-structure-navigator.maxDepth`              | Maximum depth for directory traversal          | `10`                                        |
| `advanced-folder-structure-navigator.defaultExcludeFolders` | Default folders to exclude from the structure  | `["node_modules", ".git", "dist", "build"]` |

---

## 🖱 Usage

* Right-click on any folder in the **VS Code Explorer** and select:

  * 📂 `Generate Folder Structure`
  * ⚙ `Generate Custom Structure`
* Follow the interactive prompts to tailor your structure.

---

## ✅ Requirements

* Visual Studio Code `1.80.0` or higher.
* No additional setup needed.

---

## 🚀 Known Issues

* Generating structures for very large folders may take longer.
* Extremely deep directory trees may exceed `maxDepth`.

---

## 📝 Release Notes

### 0.0.1

* Initial release:

  * Generate folder structure and save to file.
  * Generate custom structures with advanced filters.
  * Automatically update nearest `.gitignore`.

---

## 📚 Useful Links

* [VS Code Extension API](https://code.visualstudio.com/api)
* [VS Code Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

---

## 💻 Contributing

Found a bug or have an idea for a new feature?
Feel free to open an issue or submit a pull request — contributions are welcome!

---

## 📄 License

MIT — use freely, modify, and share.

---

🚀 **Enjoy using Folder Structure Navigator!**
If you like it, ⭐ star it on GitHub (when published) or leave a review on the Marketplace.

---