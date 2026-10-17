# [非官方] Claude Code for VS Code 简体中文汉化包

**本扩展是由社区开发的非官方汉化补丁，旨在为 Claude Code for VS Code 提供简体中文界面支持。**

注意： 本项目与 Anthropic 官方或 Claude 团队无任何关联。

## 功能特性

- ✅ **手动汉化**：仅在命令面板中执行命令时应用汉化，不在启动或扩展更新时自动执行
- ✅ **三阶段汉化**：支持前置规则 → 内置规则 → 后置规则
- ✅ **自定义规则**：通过配置添加自己的翻译规则
- ✅ **自动备份**：修改前自动创建备份文件
- ✅ **一键还原**：随时还原到原版
- ✅ **版本感知**：Claude Code 或汉化规则升级后，再次执行汉化命令会按新版本重新翻译，不会还原成旧版文件

> **当前版本范围**：仅汉化 Claude Code 的 Webview 聊天界面；设置面板（`package.json`）翻译在本版本中暂时关闭。

## 安装

### 从 `.vsix` 手动安装

1. 打开 VS Code 扩展视图（`Ctrl+Shift+X`）
2. 点击右上角 `...` → **从 VSIX 安装…**
3. 选择 `claude-code-zhcn-1.5.4.vsix`
4. 重新加载窗口

也可以在命令行安装：

```bash
code --install-extension claude-code-zhcn-1.5.4.vsix
```

安装后扩展不会自动汉化。请在命令面板中执行 **Claude Code 汉化: 应用汉化**，然后重新打开聊天窗口。

## 使用方法

### 命令面板

按 `Ctrl+Shift+P` (Windows/Linux) 或 `Cmd+Shift+P` (macOS) 打开命令面板，然后输入：

- **Claude Code 汉化: 应用汉化** - 手动应用汉化
- **Claude Code 汉化: 还原原版** - 还原到原版
- **Claude Code 汉化: 打开配置** - 打开配置页面
- **Claude Code 汉化: 重新加载汉化** - 重新应用汉化规则

### 状态栏

点击右下角的 `$(globe) Claude 汉化` 按钮可快速打开配置。

## 配置选项

在 VS Code 设置中搜索 `claudeCodeZhCn` 可以找到以下配置：

### 基础配置

- **createBackup** (默认: `true`)
  应用汉化前创建备份文件

- **showNotifications** (默认: `true`)
  显示操作完成的通知

- **claudeCodeExtensionId** (默认: `"Anthropic.claude-code"`)
  Claude Code 扩展的 ID（格式：Publisher.ExtensionName）

  **注意**：扩展 ID 必须与 Claude Code 的实际 ID 匹配。如果使用的是不同版本或分支，可能需要调整此配置。

### 自定义翻译规则

#### 前置规则 (preTranslationRules)

在内置规则之前执行的自定义翻译规则。

示例配置：

```json
{
  "claudeCodeZhCn.preTranslationRules": [
    {
      "original": "My Custom Text",
      "chinese": "我的自定义文本",
      "regex": false
    }
  ]
}
```

#### 后置规则 (postTranslationRules)

在内置规则之后执行的自定义翻译规则，可以覆盖内置翻译。

示例配置：

```json
{
  "claudeCodeZhCn.postTranslationRules": [
    {
      "original": "Ask before edits",
      "chinese": "编辑前询问",
      "regex": false
    }
  ]
}
```

#### 使用正则表达式

```json
{
  "claudeCodeZhCn.postTranslationRules": [
    {
      "original": "\\bfile\\b",
      "chinese": "文件",
      "regex": true,
      "flags": "gi"
    }
  ]
}
```

## 工作原理

1. **定位扩展**：优先使用 VS Code API (`vscode.extensions.getExtension`) 查找 Claude Code 扩展
   - 这种方法最可靠，即使用户修改了扩展安装位置也能正常工作
   - 只在 API 失败时才使用手动搜索作为备用方案
2. **查找 webview 文件**：找到 `webview/index.js` 文件（Claude Code 的界面文本所在位置）
3. **创建备份**：在修改前创建 `.bak` 备份文件
4. **应用汉化**：按照 前置规则 → 内置规则 → 后置规则 的顺序替换文本
5. **写入文件**：将汉化后的内容原子写回 webview 文件
6. **记录版本**：保存 Claude Code 版本与规则版本，下次手动执行汉化时据此判断是否需要重新翻译
7. **重新加载**：提示用户重新加载窗口以生效

## 项目结构

```
claude-code-zh-cn/
├── lib/
│   ├── backup.js          # 备份管理器
│   ├── config.js          # 配置管理器
│   ├── locator.js         # 扩展定位器
│   └── translator.js      # 翻译引擎
├── translations/
│   └── built-in.json      # 内置 Webview 翻译规则（1995 条）
├── test/                  # IPC 协议保护测试
├── extension.js           # 扩展主入口
├── package.json           # 扩展配置
└── README.md              # 本文档
```

## 注意事项

1. **文件权限**：在某些系统上可能需要管理员权限修改扩展文件
2. **扩展更新**：Claude Code 更新时会覆盖汉化，需要再次执行 **Claude Code 汉化: 应用汉化** 命令
3. **备份文件**：首次汉化会创建 `.bak` 备份，不会覆盖已有备份
4. **还原功能**：可随时通过命令还原到原版

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 作者

- zstings
- XiaJiuge

## 相关链接

- [Claude Code 官方文档](https://docs.anthropic.com/claude/docs)
- [VS Code 扩展开发文档](https://code.visualstudio.com/api)
