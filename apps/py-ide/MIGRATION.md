# PyIDE — Pyodide 0.27.1 → 314.0.3 迁移文档

## 概述

本次升级将 PyIDE 的 WebAssembly Python 运行时从 Pyodide **0.27.1**（CPython 3.12）升级至 **314.0.3**（CPython 3.14）。版本号等于主版本号的改变是因为 Pyodide 从 0.28+ 开始使用 Python 主版本号作为发布前缀（Python 3.14 → `314.x`）。

---

## 一、架构变更

### 1.1 文件拆分

| 拆分前 | 拆分后 |
|---|---|
| `apps/py-ide/index.html`（~1370行，全部内联） | `index.html` (~300行，仅 HTML/CSS) |
| | `js/pyodide-core.js` (~230行，Pyodide 初始化 + API 封装) |
| | `js/pyide-app.js` (~798行，UI 逻辑 + Pyodide 调用) |

好处：可维护性提升、CDN 缓存命中、后续迭代独立。

---

## 二、破坏性 API 变更对照表

### 2.1 stdout / stderr 捕获

| 维度 | v0.27.1 | v314.0.3 |
|---|---|---|
| 设置位置 | 加载后赋值到实例属性 | 加载时通过配置对象传入 |
| 旧写法 | `pyodideInst.stdout = fn` | 不适用 |
| 新写法 | `await loadPyodide({ indexURL, stdout: fn, stderr: fn })` | — |

**代码变更** (`pyide-app.js:509-515`):
```js
// [v314] stdout/stderr via config callbacks instead of instance properties
await pyodideCore.initPyodide(
    function(text) { appendOutput(text, 'stdout'); },
    function(text) { appendOutput(text, 'stderr'); }
);
```

**原因**: v314 使用 emscripten 的 `print`/`printErr` 设置器 + `initializeStreams()`，在 Wasm 模块初始化阶段就把 stdin/stdout/stderr 连接到配置对象提供的回调。在实例创建后修改 `.stdout` 不再有效。

---

### 2.2 Python-side sys.stdout/sys.stderr 重定向

| 维度 | v0.27.1 | v314.0.3 |
|---|---|---|
| 需要 JsWriter? | **是** — 因为 C 层输出与 JS 无关联 | **否** — 配置级管道已打通 |
| FFI 导入 | `from pyodide.ffi import JsProxy` | 不需要 |

**移除的代码** (原 `index.html:1077-1089`):
```python
# ❌ 整个块已删除
import sys
from pyodide.ffi import JsProxy

class JsWriter:
    def write(self, s):
        if hasattr(window, '_appendPyOutput'):
            window._appendPyOutput(s, 'stdout')
    def flush(self): pass

sys.stdout = JsWriter()
sys.stderr = JsWriter()
```

**原因**: 由于 config-level stdout/stderr 已经桥接到 emscripten 的 C 管道，`print()` 和异常输出的 tracebacks 自动流向 JavaScript 回调。无需在 Python 侧再包装一个 `JsWriter`。

---

### 2.3 window._appendPyOutput 桥接函数

| 维度 | v0.27.1 | v314.0.3 |
|---|---|---|
| 存在性 | **需要** — Python JsWriter 调用此 JS 函数 | **不需要** — 已删除 |

**移除的代码**:
```js
// ❌ 删除
window._appendPyOutput = function(text, type) {
    appendOutput(text, type || 'stdout');
};
```

---

### 2.4 REPL 结果处理 (JsProxy 字符串检查)

| 维度 | v0.27.1 | v314.0.3 |
|---|---|---|
| runPythonAsync 返回值 | 可能是 PyProxy / JsProxy | 自动转为 JS 原生值 |
| 结果转换 | `String(result)` + `<JsProxy` 检查 | `String(result)` 即可 |

**代码变更** (`pyide-app.js:622-628`):
```js
// [v314] runPythonAsync returns JS-friendly values automatically
// v0.27: result often wrapped as <JsProxy>, required String inspection
var result = await pyodideCore.runPythonAsync(expr);
if (result !== undefined && result !== null) {
    appendOutput(String(result), 'stdout');
}
```

旧版需要检测 `<JsProxy` 来判断是否要调用 `.toJs()`。v314 的 `runPythonAsync` 对返回值有更智能的类型转换。

---

### 2.5 loadPyodide 配置选项变更

| 选项 | v0.27.1 | v314.0.3 |
|---|---|---|
| `fullStdLib` | `{ fullStdLib: false }` — 必须指定，否则标准库不完整 | **已移除** — 总��完整加载标准库 |
| `lockFileURL` | `lockFileURL: t + "pyodide-lock.json"` | `lockFileContents` 或 `lockFileURL` 任选 |
| `indexURL` | 必需，指向版本目录 | 必需，行为不变 |
| `packageBaseUrl` | 可选 | 可选，默认指向 jsdelivr CDN |
| `enableRunUntilComplete` | 不存在 | 新增 `true` — 支持 `runUntilComplete()` API |
| `checkAPIVersion` | 不存在 | 新增 `true` — 严格检查版本匹配 |

---

### 2.6 包预编译格式变更

| 维度 | v0.27.1 | v314.0.3 |
|---|---|---|
| 包 wheel 名称模式 | `numpy-1.xx-cp312-cp312-pyodide_2023_x_wasm32.whl` | `numpy-2.4.3-cp314-cp314-pyemscripten_2026_0_wasm32.whl` |
| Python ABI tag | `cp312` | `cp314` |
| Platform tag | `pyodide_2023_x` | `pyemscripten_2026_0` |
| 内置包数量 | ~100+ | 354+ (lock file 中) |
| numpy | 内置预编译 | 仍为内置预编译 (2.4.3) |
| matplotlib/scipy/pandas | 需要 micropip 安装 | 部分有预编译 wheel (numpy)，其他仍需 micropip |

**注意**: `loadPackagesFromImports()` 的行为在 v314 中保持不变 — 自动分析 import 语句并下载对应 wheel。预编译包优先从 index 获取，非预编译包通过内置 micropip 安装。

---

## 三、确认不变的 API

以下 API 在 v314.0.3 中保持兼容，无需改动：

| API | 说明 |
|---|---|
| `loadPyodide(config)` | 工厂函数签名不变 |
| `pyodideInstance.runPythonAsync(code)` | 异步执行 Python 代码 |
| `pyodideInstance.loadPackagesFromImports(code, options)` | 自动加载 import 依赖 |
| `pyodideInstance.toJs()` | PyProxy 方法，转为 JS 对象 |
| `PyProxy` 构造函数 | 仍然存在（内部使用） |

---

## 四、迁移验证清单

- [x] 文件拆分完成
- [x] CDN 镜像链更新到 v314.0.3
- [x] stdout/stderr 改为 config 方式
- [x] 移除 Python-side JsWriter 重定向
- [x] 移除 window._appendPyOutput 桥接
- [x] REPL 结果处理简化（移除 JsProxy 检查）
- [x] 所有 UI 功能完整保留
- [x] 示例代码无需修改（纯 Python 脚本）
- [ ] 浏览器实际运行测试
- [ ] numpy / matplotlib 包加载测试

---

## 五、已知限制与注意事项

1. **matplotlib inline 显示**: 旧方案通过 Python 端重定向 sys.stdout 配合 matplotlib backend 显示图片。v314 中 C 层管道自动工作，但 matplotlib 的 `%matplotlib inline` magic 可能行为略有不同。如需测试，请查看 `examples/data-visualization.py`。

2. **PyProxy 内存管理**: v314 中 Python 对象的生命周期由 GC 更严格地管理。如果之前依赖手动 `.destroy()` 清理 PyProxy 的 JS 代码，现在可以���松要求，但仍建议在长时间运行的场景下显式清理。

3. **micropip**: v314 不再提供独立的 `micropip.py` 文件（HTTP 403）。micropip 作为内置功能通过 `pyodide.micropip` Python 模块提供。如需手动安装 PyPI 包：
   ```python
   import micropip
   await micropip.install("some-package")
   ```

4. **CDN 可靠性**: 旧的 6 个镜像中，部分为国内加速节点。如果遇到加载失败，建议替换为可用的替代源。
