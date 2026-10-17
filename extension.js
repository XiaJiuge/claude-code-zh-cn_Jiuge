const vscode = require('vscode');
const fs = require('fs');
const Locator = require('./lib/locator');
const Translator = require('./lib/translator');
const BackupManager = require('./lib/backup');
const ConfigManager = require('./lib/config');

// 本次更新范围仅限 Webview 界面；设置面板翻译暂时关闭
const ENABLE_SETTINGS_TRANSLATION = false;

/**
 * 原子写入：先写临时文件再 rename，防止中途失败导致文件损坏
 */
function atomicWriteSync(filePath, content) {
    const tmpPath = filePath + '.tmp';
    fs.writeFileSync(tmpPath, content, 'utf8');
    fs.renameSync(tmpPath, filePath);
}

/**
 * 扩展激活时调用
 */
async function activate(context) {
    console.log('Claude Code 汉化扩展已激活');

    const config = new ConfigManager();
    const locator = new Locator(config);
    const backup = new BackupManager(config);
    const translator = new Translator(config);

    // 状态栏按钮
    const statusBarItem = vscode.window.createStatusBarItem(
        vscode.StatusBarAlignment.Right,
        100
    );
    statusBarItem.text = "$(globe) Claude 汉化";
    statusBarItem.tooltip = "Claude Code 汉化状态";
    statusBarItem.command = 'claudeCodeZhCn.openConfig';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);

    // 注册命令：应用汉化
    let applyCommand = vscode.commands.registerCommand(
        'claudeCodeZhCn.applyTranslation',
        async () => {
            await applyTranslation(locator, translator, backup, config, context);
        }
    );
    context.subscriptions.push(applyCommand);

    // 注册命令：还原原版
    let restoreCommand = vscode.commands.registerCommand(
        'claudeCodeZhCn.restoreOriginal',
        async () => {
            await restoreOriginal(locator, backup, config);
        }
    );
    context.subscriptions.push(restoreCommand);

    // 注册命令：打开配置
    let configCommand = vscode.commands.registerCommand(
        'claudeCodeZhCn.openConfig',
        () => {
            vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'claudeCodeZhCn'
            );
        }
    );
    context.subscriptions.push(configCommand);

    // 注册命令：重新加载汉化
    let reloadCommand = vscode.commands.registerCommand(
        'claudeCodeZhCn.reloadExtension',
        async () => {
            // 强制重新汉化：有备份时先还原再汉化
            await applyTranslation(locator, translator, backup, config, context, false, true);
        }
    );
    context.subscriptions.push(reloadCommand);

    // 监听 Claude Code 扩展的安装/更新
    vscode.extensions.onDidChange(async () => {
        if (config.get('autoApplyOnUpdate')) {
            const claudeExt = vscode.extensions.getExtension(
                config.get('claudeCodeExtensionId')
            );
            if (claudeExt) {
                setTimeout(async () => {
                    await applyTranslation(locator, translator, backup, config, context, true);
                }, 1000);
            }
        }
    });

    // 启动时自动应用汉化
    if (config.get('autoApplyOnStartup')) {
        // 延迟执行，确保所有扩展都已加载
        setTimeout(async () => {
            await applyTranslation(locator, translator, backup, config, context, true);
        }, 2000);
    }
}

/**
 * 应用汉化
 * @param {object} context - 扩展上下文（用于记录已应用的版本）
 * @param {boolean} silent - 静默模式（启动时自动调用）
 * @param {boolean} forceReapply - 强制重新汉化（重新加载命令使用）
 */
async function applyTranslation(locator, translator, backup, config, context, silent = false, forceReapply = false) {
    try {
        // 定位 Claude Code 扩展
        const claudePath = await locator.findClaudeCodeExtension();
        if (!claudePath) {
            vscode.window.showErrorMessage(
                'Claude Code 扩展未安装或未找到'
            );
            return;
        }

        // 找到 webview 文件
        const mainFilePath = locator.findMainFile(claudePath);
        if (!mainFilePath) {
            vscode.window.showErrorMessage(
                '未找到 Claude Code 扩展的 webview 文件'
            );
            return;
        }

        // 记录 Claude Code 与汉化规则版本，用于判断是否需要重新汉化
        const claudeExt = vscode.extensions.getExtension(
            config.get('claudeCodeExtensionId')
        );
        const claudeVersion = claudeExt?.packageJSON?.version || 'unknown';
        const rulesVersion = translator.loadBuiltInRules()?.version || 'unknown';
        const appliedClaudeVersion = context.globalState.get('appliedClaudeVersion');
        const appliedRulesVersion = context.globalState.get('appliedRulesVersion');

        // Claude Code 版本变化：安装目录中已是新版原文件，不能还原旧备份
        const claudeVersionChanged =
            !!appliedClaudeVersion && appliedClaudeVersion !== claudeVersion;
        // 汉化规则版本变化（或从未记录过）：需要用新规则重新翻译原文件
        const rulesVersionChanged = appliedRulesVersion !== rulesVersion;

        // 检查是否已汉化（备份文件存在则说明曾创建过备份）
        const hasExistingBackup = backup.hasBackup(mainFilePath);

        if (hasExistingBackup) {
            if (claudeVersionChanged) {
                // 新版原文件已覆盖旧版，重新记录备份，避免还原成旧版
                console.log(
                    '检测到 Claude Code 版本变化:',
                    appliedClaudeVersion,
                    '->',
                    claudeVersion,
                    '，重建备份'
                );
                if (config.get('createBackup')) {
                    await backup.overwriteBackup(mainFilePath);
                }
            } else if (forceReapply) {
                // 强制重新汉化：先还原备份，再重新汉化
                console.log('强制重新汉化：先还原备份');
                await backup.restoreBackup(mainFilePath);
            } else if (rulesVersionChanged) {
                console.log(
                    '检测到汉化规则版本变化:',
                    appliedRulesVersion,
                    '->',
                    rulesVersion,
                    '，重新汉化'
                );
                await backup.restoreBackup(mainFilePath);
            } else if (silent) {
                // 静默模式下，若文件仍是原版则继续汉化，否则跳过
                const currentContent = fs.readFileSync(mainFilePath, 'utf8');
                const originalContent = fs.readFileSync(
                    backup.getBackupPath(mainFilePath),
                    'utf8'
                );
                if (currentContent === originalContent) {
                    console.log('检测到文件仍为原版，继续汉化');
                } else {
                    console.log('检测到备份文件，已汉化，跳过重复汉化');
                    return;
                }
            }
        }

        // 创建备份（如果没有现有备份）
        if (config.get('createBackup') && !hasExistingBackup) {
            const backupCreated = await backup.createBackup(mainFilePath);
            if (!backupCreated) {
                const choice = await vscode.window.showWarningMessage(
                    '备份创建失败，是否继续？',
                    '继续', '取消'
                );
                if (choice !== '继续') return;
            }
        }

        // 读取文件内容
        let content = fs.readFileSync(mainFilePath, 'utf8');

        // 应用三阶段汉化
        content = await translator.translate(content);

        // 写入文件（原子写入：临时文件 + rename，防止中途失败导致文件损坏）
        atomicWriteSync(mainFilePath, content);

        const packageJsonPath = locator.findPackageJson(claudePath);

        if (packageJsonPath) {
            // Claude Code 升级后，旧版 package.json 备份已失效，重建或删除以免还原成旧版
            if (claudeVersionChanged) {
                if (config.get('createBackup')) {
                    await backup.overwriteBackup(packageJsonPath);
                } else if (backup.hasBackup(packageJsonPath)) {
                    await backup.deleteBackup(packageJsonPath);
                }
            } else if ((forceReapply || rulesVersionChanged) && backup.hasBackup(packageJsonPath)) {
                await backup.restoreBackup(packageJsonPath);
            }

            if (config.get('createBackup') && !backup.hasBackup(packageJsonPath)) {
                await backup.createBackup(packageJsonPath);
            }

            // 翻译 VS Code 命令面板中的命令标题
            const pkgContent = fs.readFileSync(packageJsonPath, 'utf8');
            const translatedPkg = await translator.translateCommandTitles(pkgContent);
            if (translatedPkg !== pkgContent) {
                atomicWriteSync(packageJsonPath, translatedPkg);
                console.log('package.json 命令标题汉化完成');
            }

            // 翻译设置面板文本（当前版本暂不启用）
            if (ENABLE_SETTINGS_TRANSLATION) {
                const settingsContent = fs.readFileSync(packageJsonPath, 'utf8');
                const translatedSettings =
                    await translator.translatePackageJson(settingsContent);
                atomicWriteSync(packageJsonPath, translatedSettings);
                console.log('package.json 设置面板汉化完成');
            }
        }

        // 记录已应用的版本，供下次启动判断
        // 规则版本未记录过（例如从旧版扩展升级）时也视为需要重新汉化
        await context.globalState.update('appliedClaudeVersion', claudeVersion);
        await context.globalState.update('appliedRulesVersion', rulesVersion);

        // 通知用户
        if (config.get('showNotifications') && !silent) {
            const choice = await vscode.window.showInformationMessage(
                '汉化应用成功！需要重新打开新的聊天窗口或者重新加载窗口以生效。',
                '立即重新加载', '稍后'
            );
            if (choice === '立即重新加载') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        }
    } catch (error) {
        vscode.window.showErrorMessage(
            `汉化应用失败：${error.message}`
        );
        console.error(error);
    }
}

/**
 * 还原原版
 */
async function restoreOriginal(locator, backup, config) {
    try {
        // 定位 Claude Code 扩展
        const claudePath = await locator.findClaudeCodeExtension();
        if (!claudePath) {
            vscode.window.showErrorMessage(
                'Claude Code 扩展未安装或未找到'
            );
            return;
        }

        // 找到 webview 文件
        const mainFilePath = locator.findMainFile(claudePath);
        if (!mainFilePath) {
            vscode.window.showErrorMessage(
                '未找到 Claude Code 扩展的 webview 文件'
            );
            return;
        }

        // 还原备份
        const restored = await backup.restoreBackup(mainFilePath);
        if (!restored) {
            vscode.window.showErrorMessage(
                '备份文件不存在，无法还原'
            );
            return;
        }

        // 还原 package.json 备份
        const packageJsonPath = locator.findPackageJson(claudePath);
        if (packageJsonPath && backup.hasBackup(packageJsonPath)) {
            await backup.restoreBackup(packageJsonPath);
            console.log('package.json 已还原');
        }

        // 通知用户
        if (config.get('showNotifications')) {
            const choice = await vscode.window.showInformationMessage(
                '已还原到原版！需要重新打开新的聊天窗口或者重新加载窗口以生效。',
                '立即重新加载', '稍后'
            );
            if (choice === '立即重新加载') {
                vscode.commands.executeCommand('workbench.action.reloadWindow');
            }
        }
    } catch (error) {
        vscode.window.showErrorMessage(
            `还原失败：${error.message}`
        );
        console.error(error);
    }
}

/**
 * 扩展停用时调用
 */
function deactivate() {
    console.log('Claude Code 汉化扩展已停用');
}

module.exports = {
    activate,
    deactivate
};
