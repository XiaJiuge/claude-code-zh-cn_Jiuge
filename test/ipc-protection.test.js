/**
 * IPC 协议保护单元测试
 * 运行方式: node test/ipc-protection.test.js
 *
 * 从 translator.js 导入生产代码，确保测试与实现同步
 */

// Mock vscode 模块（translator.js 顶部 require('vscode')）
const Module = require('module');
const originalResolveFilename = Module._resolveFilename;
Module._resolveFilename = function (request, _parent) {
    if (request === 'vscode') {
        return request; // 返回自身，用 mock 填充
    }
    return originalResolveFilename.apply(this, arguments);
};
require.cache['vscode'] = {
    id: 'vscode', filename: 'vscode', loaded: true,
    exports: { extensions: { getExtension: () => null } },
};

const Translator = require('../lib/translator.js');
const translator = new Translator({ get: () => [] });

// 恢复原始 resolve
Module._resolveFilename = originalResolveFilename;

let passed = 0;
let failed = 0;

function assert(condition, testName) {
    if (condition) {
        console.log('  PASS:', testName);
        passed++;
    } else {
        console.error('  FAIL:', testName);
        failed++;
    }
}

function isInIpcContext(content, ruleOriginal) {
    const ipcValues = translator.extractIpcValues(content);
    return translator.isInIpcValues(ipcValues, ruleOriginal);
}

console.log('=== IPC 协议保护测试 ===\n');

// ============================================================
// Test group 1: 应该被检测为 IPC 上下文
// ============================================================
console.log('--- 应检测为 IPC 上下文 ---');

assert(
    isInIpcContext(
        'sendRequest({type:"install_plugin",data:{}})',
        '"install_plugin"'
    ),
    'sendRequest 中的 install_plugin'
);

assert(
    isInIpcContext(
        'sendRequest({type:"uninstall_plugin",id:1})',
        '"uninstall_plugin"'
    ),
    'sendRequest 中的 uninstall_plugin'
);

assert(
    isInIpcContext(
        'sendRequest({type:"set_plugin_enabled"})',
        '"set_plugin_enabled"'
    ),
    'sendRequest 中的 set_plugin_enabled'
);

assert(
    isInIpcContext(
        'sendRequest({type:"add_marketplace"})',
        '"add_marketplace"'
    ),
    'sendRequest 中的 add_marketplace'
);

assert(
    isInIpcContext(
        'sendRequest({type:"remove_marketplace"})',
        '"remove_marketplace"'
    ),
    'sendRequest 中的 remove_marketplace'
);

assert(
    isInIpcContext(
        'sendRequest({type:"refresh_marketplace"})',
        '"refresh_marketplace"'
    ),
    'sendRequest 中的 refresh_marketplace'
);

assert(
    isInIpcContext(
        'postMessage({type:"install_plugin"})',
        '"install_plugin"'
    ),
    'postMessage 中的 install_plugin'
);

assert(
    isInIpcContext(
        'postMessage({command:"install_plugin"})',
        '"install_plugin"'
    ),
    'postMessage 带 command 属性'
);

assert(
    isInIpcContext(
        'postMessage({ command: "install_plugin" })',
        '"install_plugin"'
    ),
    'postMessage 带空格的属性'
);

// ============================================================
// Test group 2: 不应被检测为 IPC 上下文 (正常 UI 文本)
// ============================================================
console.log('\n--- 不应检测为 IPC 上下文 ---');

assert(
    !isInIpcContext(
        '"Install plugin"',
        '"Install plugin"'
    ),
    '正常 UI 文本 (不在 send 调用中)'
);

assert(
    !isInIpcContext(
        'text = "install_plugin"',
        '"install_plugin"'
    ),
    '变量赋值 (非 IPC 上下文)'
);

assert(
    !isInIpcContext(
        'console.log("install_plugin")',
        '"install_plugin"'
    ),
    'console.log 中的字符串'
);

assert(
    !isInIpcContext(
        '"Manage Plugins"',
        '"Manage Plugins"'
    ),
    'UI 标签文本'
);

assert(
    !isInIpcContext(
        '"Hello world"',
        '"Hello world"'
    ),
    '简单 UI 字符串'
);

// ============================================================
// Test group 3: 特殊字符转义
// ============================================================
console.log('\n--- 特殊字符转义测试 ---');

assert(
    isInIpcContext(
        'sendRequest({type:"test.value"})',
        '"test.value"'
    ),
    '原文包含点号'
);

assert(
    isInIpcContext(
        'sendRequest({type:"test+value"})',
        '"test+value"'
    ),
    '原文包含加号'
);

assert(
    !isInIpcContext(
        '"normal text"',
        '"normal text"'
    ),
    '普通文本不误报'
);

// ============================================================
// Test group 4: 嵌套花括号（旧版 bug 修复验证）
// ============================================================
console.log('\n--- 嵌套花括号测试 ---');

assert(
    isInIpcContext(
        'sendRequest({data:{id:1},type:"install_plugin"})',
        '"install_plugin"'
    ),
    '嵌套花括号: {data:{id:1},type:...}'
);

assert(
    isInIpcContext(
        'sendRequest({data:{},type:"install_plugin"})',
        '"install_plugin"'
    ),
    '空嵌套对象: {data:{},type:...}'
);

assert(
    isInIpcContext(
        'sendRequest({payload:{items:[1,2]},type:"add_marketplace"})',
        '"add_marketplace"'
    ),
    '深层嵌套: {payload:{items:[...]},type:...}'
);

// ============================================================
// Test group 5: 单引号支持（旧版 bug 修复验证）
// ============================================================
console.log('\n--- 单引号支持测试 ---');

assert(
    isInIpcContext(
        "sendRequest({type:'install_plugin'})",
        '"install_plugin"'
    ),
    '单引号: {type:\'install_plugin\'} (ruleOriginal 带双引号)'
);

assert(
    isInIpcContext(
        "sendRequest({type:'install_plugin'})",
        'install_plugin'
    ),
    '单引号: ruleOriginal 不带引号'
);

assert(
    isInIpcContext(
        "postMessage({command:'add_marketplace'})",
        'add_marketplace'
    ),
    'postMessage 单引号 command'
);

// ============================================================
// Test group 6: 括号间空格（旧版 bug 修复验证）
// ============================================================
console.log('\n--- 括号间空格测试 ---');

assert(
    isInIpcContext(
        'sendRequest( {type:"install_plugin"})',
        '"install_plugin"'
    ),
    '括号后有空格: sendRequest( {type:...})'
);

assert(
    isInIpcContext(
        'sendRequest(\n  {type:"install_plugin"}\n)',
        '"install_plugin"'
    ),
    '括号后有换行: sendRequest(\\n  {type:...})'
);

// ============================================================
// Test group 7: 非 type/command 属性不误报
// ============================================================
console.log('\n--- 非 type/command 属性不误报测试 ---');

assert(
    !isInIpcContext(
        'sendRequest({data:"install_plugin",type:"get"})',
        '"install_plugin"'
    ),
    'data 属性值不误报 (type 是不同值)'
);

assert(
    !isInIpcContext(
        'sendRequest({name:"add_marketplace",type:"list"})',
        '"add_marketplace"'
    ),
    'name 属性值不误报'
);

// ============================================================
// Test group 8: ruleOriginal 不带引号
// ============================================================
console.log('\n--- ruleOriginal 不带引号测试 ---');

assert(
    isInIpcContext(
        'sendRequest({type:"install_plugin"})',
        'install_plugin'
    ),
    'ruleOriginal 不带引号, content 双引号'
);

assert(
    isInIpcContext(
        "sendRequest({type:'install_plugin'})",
        'install_plugin'
    ),
    'ruleOriginal 不带引号, content 单引号'
);

// ============================================================
// Test group 9: command 属性
// ============================================================
console.log('\n--- command 属性测试 ---');

assert(
    isInIpcContext(
        'postMessage({command:"install_plugin",data:{}})',
        '"install_plugin"'
    ),
    'postMessage command 带嵌套数据'
);

assert(
    isInIpcContext(
        "postMessage({data:{key:'val'},command:'refresh_marketplace'})",
        '"refresh_marketplace"'
    ),
    'postMessage command 单引号 + 嵌套'
);

// Summary
console.log('\n=== 结果: ' + passed + ' 通过, ' + failed + ' 失败 ===');
process.exit(failed > 0 ? 1 : 0);
