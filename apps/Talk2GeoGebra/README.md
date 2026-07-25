# GeoGebra AI 自动绘图应用

一个基于 GeoGebra Apps API 的智能绘图应用，支持自然语言指令转换为 GeoGebra 命令。

## 功能特性

- **自然语言绘图**: 支持自然语言指令自动转换为 GeoGebra 命令
- **AI 集成**: 集成 AI 服务 进行复杂指令解析
- **本地模板**: 内置常用图形模板，支持快速绘图
- **2D/3D 模式**: 支持二维和三维图形绘制
- **导出功能**: 支持 PNG 格式导出
- **保存/加载**: 支持 XML 格式的构造保存和加载
- **视图控制**: 坐标轴、网格显示切换，视图适应
- **历史记录**: 命令执行历史追踪

## 快速开始

### 本地打开（推荐）

1. 克隆或下载项目到本地目录。
2. 直接用浏览器打开 `index.html`（file://）即可运行。
3. 如果你的浏览器严格 CORS，推荐使用 `Ctrl+O` 打开文件，不必专门启动服务器。

### 服务器启动（可选）

```bash
npm install
npm start
```

然后在浏览器中访问 `http://localhost:8000`

## 使用方法

1. **AI 设置**: 点击“设置”，填写 `API URI`、`API Key` 和 `Model Name`，然后保存。
2. **快速清除配置**: 设置界面点击“清除设置”即可恢复默认值并清空 `localStorage`。
3. **基本绘图**: 在输入框中输入自然语言指令，如"圆心(0,0)半径3的圆"。
4. **模式切换**: 2D/3D 按钮切换绘图模式。
5. **解析策略**: 下拉菜单选择“自动/本地/AI”。
6. **命令历史**: 历史记录区跟踪已执行命令。
7. **导出图形**: 通过导出按钮保存 SVG/PNG。
8. **保存加载**: XML 输入区保存或加载构造。

## 支持的指令示例

### 2D 图形
- "圆心(0,0)半径3的圆"
- "过点(1,2)和(3,4)的直线"
- "边长为4的正方形"
- "长4宽2的矩形"
- "函数 y = x^2"

## GeoGebra 命令格式与参数

AI 生成的命令必须是 GeoGebra 原生命令，逐行输出，一条命令对应一行，例如：

```
A = (0,0)
B = (3,0)
C = (0,4)
Triangle(A, B, C)
```

调用 `evalCommand` 时按行传入，上述语句会依次执行。

如果执行失败，`evalCommand` 返回 `false`，或者抛异常（已由 app.js 兼容处理）。

基础规则：
- 先创建点 (A, B, C 等)，再做几何构造；
- 2D 使用 `Circle`, `Line`, `Polygon` 等；
- 3D 使用 `Sphere`, `Cylinder`, `Plane` 等；
- 可以使用 `SetColor`, `SetLineThickness`, `ShowLabel` 等样式设置。

### 3D 图形
- "球体中心(0,0,0)半径3"
- "圆柱底面中心(0,0,0)高5半径2"

### 控制指令
- "清空" - 清空画布
- "适合视图" - 适应视图
- "切换坐标轴" - 显示/隐藏坐标轴
- "切换网格" - 显示/隐藏网格

## 项目结构

```
geogebra-app/
├── index.html          # 主页面
├── app.js             # 应用逻辑（ES6模块）
├── ggb-api.js         # GeoGebra API 封装
├── style.css          # 样式文件
├── package.json       # 项目配置
└── README.md          # 项目文档
```

## API 文档

### GeoGebraManager 类

封装了 GeoGebra Apps API 的主要功能：

- `init(mode)`: 初始化 GeoGebra 实例
- `evalCommands(commands)`: 执行 GeoGebra 命令
- `exportSVG(filename)`: 导出 SVG
- `exportPNG(filename)`: 导出 PNG
- `getXML()`: 获取构造 XML
- `setXML(xml)`: 加载构造 XML

## 技术栈

- **前端**: HTML5, CSS3, ES6 Modules
- **绘图引擎**: GeoGebra Apps API
- **AI 服务**: Volces API (兼容 OpenAI)
- **构建工具**: 无需构建，直接运行

## 浏览器支持

- Chrome 70+
- Firefox 65+
- Safari 12+
- Edge 79+

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！

## 更新日志

### v1.0.0
- 初始版本发布
- 支持 2D/3D 绘图
- AI 集成
- 导出功能
- 保存/加载构造</content>
### v1.1.0
- 新增本地模板功能
- 优化 AI 解析逻辑
- 新增历史记录功能
### v1.2.0
- 修复部分浏览器兼容性问题
- 优化界面交互体验
- 新增清除输入按钮
### v1.3.0
- 新增命令执行结果提示
- 新增夜间模式
### v1.4.0
- 新增设置，支持自定义 API URI、API Key 和 Model Name