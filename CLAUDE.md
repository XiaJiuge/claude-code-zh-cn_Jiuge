# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 项目概述

这是一个 **Claude Code for VS Code 扩展的中文汉化工具**。通过 VS Code 扩展对 Claude Code 的 `webview/index.js` 文件进行字符串替换，将英文界面文本转换为中文。

该项目是一个 **VS Code 扩展**，安装后自动汉化 Claude Code 扩展的界面。

## 常用命令

### 开发相关命令

```bash
# 代码检查（ESLint）
pnpm run lint

# 运行测试（需要先通过 lint）
pnpm run test

# 开发模式构建（监听文件变化）
pnpm run dev

# 打包 VS Code 扩展
pnpm run build
```

## 高层架构

### 核心模块

- [lib/locator.js](lib/locator.js) - 扩展定位器，查找 Claude Code 的 `webview/index.js` 和 `package.json`
- [lib/translator.js](lib/translator.js) - 翻译引擎，实现三阶段汉化（前置→内置→后置）+ 设置面板翻译
- [lib/backup.js](lib/backup.js) - 备份管理器，创建和还原 `.bak` 备份
- [lib/config.js](lib/config.js) - 配置管理器，读取用户自定义规则
- [translations/built-in.json](translations/built-in.json) - 内置 webview 翻译规则
- [translations/settings.json](translations/settings.json) - 设置面板翻译规则

**重要说明**：
- Claude Code 的界面文本位于 `webview/index.js` 而非 `extension.js`
- 设置面板文本位于 Claude Code 扩展的 `package.json` 的 `contributes.configuration.properties` 中
- 扩展自动查找并汉化 `webview/index.js` 和 `package.json`
- 支持用户通过配置添加前置和后置翻译规则

### 使用场景

**典型工作流程：**

1. 用户安装本 VS Code 扩展
2. 扩展自动定位 Claude Code 的 `webview/index.js`
3. 自动创建备份并应用汉化
4. 重启 VS Code 使变更生效

## 技术栈

- **Node.js** - 脚本运行环境
- **pnpm** - 包管理器
- **VS Code Extension API** - 类型定义（@types/vscode）

## 项目文件说明

| 文件 | 说明 |
|------|------|
| [extension.js](extension.js) | VS Code 扩展入口 |
| [package.json](package.json) | 项目配置和依赖定义 |
| [lib/](lib/) | 核心模块（locator、translator、backup、config） |
| [translations/built-in.json](translations/built-in.json) | 内置 webview 翻译规则 |
| [translations/settings.json](translations/settings.json) | 设置面板翻译规则 |
| [README.md](README.md) | 项目说明 |
| [CHANGELOG.md](CHANGELOG.md) | 版本更新日志 |

## 已知问题与限制

### IPC 协议保护

翻译引擎内置 IPC 协议保护机制。`applyRules()` 在执行非正则规则替换前，会检测规则原文是否出现在
`sendRequest({type:...})` 或 `postMessage({type/command:...})` 的 IPC 发送上下文中。

如果检测到 IPC 上下文，整个规则将被跳过并输出警告日志（前缀 `[IPC 保护]`）。

**添加翻译规则时注意**：
- 不要翻译 IPC 协议标识符（如 `install_plugin`、`add_marketplace` 等 snake_case 标识符）
- 如果规则原文可能出现在 IPC 发送上下文中，该规则会被自动跳过
- 此保护仅对非正则规则生效（正则规则需要人工审核）
- 运行测试：`node test/ipc-protection.test.js`

1. **侵入式修改**
   - 直接修改已安装的 Claude Code 扩展文件
   - Claude Code 更新时会覆盖汉化，需重新运行扩展

2. **局限性**
   - 纯字符串替换方式，无法处理动态生成的文本
   - 无法本地化 UI 布局、图标等非文本元素

## 开发注意事项

- 修改汉化规则时，编辑 [translations/built-in.json](translations/built-in.json) 中的翻译条目
- 每条规则包含 `original`（英文原文）和 `chinese`（中文翻译）
- 支持正则表达式：设置 `"regex": true` 和 `"flags": "g"`
- 当前规则共 1816 条，执行顺序为：**精确复合规则 → 生成规则 → 原有规则 → 短语兜底规则**
  - 短语规则会替换整句中的片段，必须放在最后，否则会破坏更长的精确规则
  - 含复数辅助函数 `h9()` 的文本，用完整中文模板覆盖整段调用，不要单独修改 `h9` 函数或其中的参数
- 更新前运行 `npm run lint` 检查代码质量（ESLint 9 扁平配置见 [eslint.config.js](eslint.config.js)）
- 打包扩展前确保测试通过：`npm test`
- 当前版本设置面板翻译由 `extension.js` 中的 `ENABLE_SETTINGS_TRANSLATION` 控制，默认关闭

### 设置面板翻译规范（重要！踩坑记录）

设置面板的翻译目标是 Claude Code 扩展的 `package.json` 中的 `contributes.configuration.properties`。

**⚠️ 严禁操作**：
1. **不要删除 `description` 字段** — VS Code Settings UI 要求保留 `description`，删除后整个设置项会消失
2. **不要用 `description` → `markdownDescription` 转换** — 会导致设置项渲染异常（黑块、布局错乱）
3. **不要在描述中用 `\n` 换行** — VS Code 设置面板不渲染 JSON 中的 `\n` 为换行
4. **不要设置 `title` 字段** — VS Code 对单个设置不支持 `title`，设置名从 key 自动生成（如 `initialPermissionMode` → "Initial Permission Mode"），无法覆盖
5. **不要使用 `enumItemLabels`** — VS Code 1.126.0 有已知 bug（[#243901](https://github.com/microsoft/vscode/issues/243901)），会导致下拉菜单空白、黑块。等官方修复后再使用

**✅ 正确操作**：
- **只替换现有字段的值**，不新增、不删除字段
- 标题翻译格式：`中文标题：描述文本`（冒号连接，放在 description 里）
- 枚举下拉选项：用 `enumDescriptions`（稳定无 bug），在每个英文选项下方显示中文描述
- `usePythonEnvironment` 用的是 `markdownDescription`（含链接），翻译时保持 markdown 格式

**translator.js 翻译逻辑**：
```
for each property:
  if settings.descriptions[key] exists:
    if prop.description exists → replace prop.description (不删除!)
    if prop.markdownDescription exists → replace prop.markdownDescription (不删除!)
  if settings.enumItemLabels[key] exists → set prop.enumItemLabels
  if settings.enumDescriptions[key] exists → set prop.enumDescriptions
```

## 未来改进方向

1. 更新 README.md，移除过时内容
2. 考虑采用更规范的 i18n 框架
3. 实现 VS Code 扩展的完整激活逻辑（补充 extension.js）
