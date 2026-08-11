const STATE = {
  currentMode: '2D',
  ggbApplet: null,
  isReady: false,
  history: [],
  lastObjects: [],
  showAxes: true,
  showGrid: true,
  theme: 'light',
  settings: {
    apiUri: '',
    apiKey: '',
    modelName: ''
  }
};

var ggbApplet = null;

const BUILT_IN_PATTERNS = [
  { regex: /圆心\s*\(([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)\)\s*半径\s*([-+]?\d*\.?\d+)/i, handler: (m) => {
      const x = m[1], y = m[2], r = m[3];
      return `A = (${x}, ${y})\nCircle(A, ${r})`;
    }, mode: '2D' },
  { regex: /过点\s*\(([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)\)\s*和\s*\(([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)\)\s*的直线/i, handler: (m) => {
      const x1 = m[1], y1 = m[2], x2 = m[3], y2 = m[4];
      return `A = (${x1}, ${y1})\nB = (${x2}, ${y2})\nLine(A, B)`;
    }, mode: '2D' },
  { regex: /边长\s*为\s*([-+]?\d*\.?\d+)\s*的正方形/i, handler: (m) => {
      const l = parseFloat(m[1]);
      const s2 = (l/2).toFixed(6).replace(/\.0+$/, '');
      return `A = (-${s2}, -${s2})\nB = (${s2}, -${s2})\nC = (${s2}, ${s2})\nD = (-${s2}, ${s2})\nPolygon(A, B, C, D)`;
    }, mode: '2D' },
  { regex: /函数\s*y\s*=\s*(.+)/i, handler: (m) => {
      const expr = m[1].trim().replace('^', '**').replace(/÷/g, '/');
      return `f(x) = ${expr}`;
    }, mode: '2D' },
  { regex: /三角形\s*顶点\s*\(([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)\)\s*\(([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)\)\s*\(([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)\)/i, handler: (m) => {
      const x1 = m[1], y1 = m[2], x2 = m[3], y2 = m[4], x3 = m[5], y3 = m[6];
      return `A = (${x1}, ${y1})\nB = (${x2}, ${y2})\nC = (${x3}, ${y3})\nTriangle(A, B, C)`;
    }, mode: '2D' },
  { regex: /正多边形\s*边数\s*(\d+)\s*中心\s*\(([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)\)\s*半径\s*([-+]?\d*\.?\d+)/i, handler: (m) => {
      const n = m[1], x = m[2], y = m[3], r = m[4];
      return `A = (${x}, ${y})\nB = (${parseFloat(x) + parseFloat(r)}, ${y})\nRegularPolygon(${n}, A, B)`;
    }, mode: '2D' },
  { regex: /椭圆\s*中心\s*\(([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)\)\s*长轴\s*([-+]?\d*\.?\d+)\s*短轴\s*([-+]?\d*\.?\d+)/i, handler: (m) => {
      const x = m[1], y = m[2], a = m[3], b = m[4];
      return `A = (${x}, ${y})\nB = (${parseFloat(x) + parseFloat(a)}, ${y})\nC = (${parseFloat(x) + parseFloat(b)}, ${y})\nEllipse(A, B, C)`;
    }, mode: '2D' },
  { regex: /抛物线\s*顶点\s*\(([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)\)\s*焦点\s*\(([-+]?\d*\.?\d+),\s*([-+]?\d*\.?\d+)\)/i, handler: (m) => {
      const vx = m[1], vy = m[2], fx = m[3], fy = m[4];
      return `A = (${fx}, ${fy})\nB = (${vx}, ${vy})\nParabola(A, B)`;
    }, mode: '2D' },
  { regex: /球体\s*中心\s*\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)\s*半径\s*([-+]?\d*\.?\d+)/i, handler: (m) => {
      const x = m[1], y = m[2], z = m[3], r = m[4];
      return `A = (${x}, ${y}, ${z})\nSphere(A, ${r})`;
    }, mode: '3D' },
  { regex: /圆柱\s*底面中心\s*\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)\s*高\s*([\d\.]+)/i, handler: (m) => {
      const x = m[1], y = m[2], z = m[3], h = m[4];
      return `A = (${x}, ${y}, ${z})\nB = (${x}, ${y}, ${parseFloat(z) + parseFloat(h)})\nCylinder(A, B, 2)`;
    }, mode: '3D' },
  { regex: /圆锥\s*顶点\s*\(\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*,\s*([-+]?\d*\.?\d+)\s*\)\s*底面半径\s*([-+]?\d*\.?\d+)/i, handler: (m) => {
      const x = m[1], y = m[2], z = m[3], r = m[4];
      return `A = (${x}, ${y}, ${z})\nB = (${x}, ${y}, ${parseFloat(z) - 5})\nCone(A, B, ${r})`;
    }, mode: '3D' }
];

function logStatus(message, type='info', autoHide=true) {
  const status = document.getElementById('statusMessage');
  status.textContent = message;
  status.className = `status-message status-${type}`;
  if (autoHide) {
    setTimeout(() => { status.textContent = '' }, 4500);
  }
}

function appendHistory(command, source) {
  STATE.history.unshift({ command, source, at: new Date().toLocaleString() });
  STATE.history = STATE.history.slice(0, 30);
  renderHistory();
}

function renderObjectList(objects) {
  const list = document.getElementById('objectList');
  if (!objects || objects.length === 0) {
    list.textContent = '暂无对象';
    return;
  }
  list.textContent = objects.join(', ');
}

function getLocalCommand(input, mode) {
  const normalized = input.trim();
  for (const pp of BUILT_IN_PATTERNS) {
    if (mode && pp.mode !== mode) continue;
    const matched = normalized.match(pp.regex);
    if (matched) {
      return pp.handler(matched);
    }
  }
  return null;
}

function saveSettingsToStorage() {
  try {
    localStorage.setItem('geogebraSettings', JSON.stringify(STATE.settings));
    logStatus('设置已保存', 'success');
  } catch (err) {
    console.error('保存设置失败', err);
    logStatus('保存设置失败，请检查浏览器存储权限', 'error', false);
  }
}

function loadSettingsFromStorage() {
  try {
    const raw = localStorage.getItem('geogebraSettings');
    if (raw) {
      const parsed = JSON.parse(raw);
      STATE.settings = { ...STATE.settings, ...parsed };
    }
  } catch (err) {
    console.warn('读取设置失败，使用默认设置', err);
  }
}

function openSettingsModal() {
  loadSettingsFromStorage();
  document.getElementById('settingsApiUri').value = STATE.settings.apiUri;
  document.getElementById('settingsApiKey').value = STATE.settings.apiKey;
  document.getElementById('settingsModelName').value = STATE.settings.modelName;
  document.getElementById('settingsModal').style.display = 'block';
}

function closeSettingsModal() {
  document.getElementById('settingsModal').style.display = 'none';
}

function applySettings() {
  const apiUri = document.getElementById('settingsApiUri').value.trim();
  const apiKey = document.getElementById('settingsApiKey').value.trim();
  const modelName = document.getElementById('settingsModelName').value.trim();
  if (!apiUri || !apiKey || !modelName) {
    logStatus('请填写 API URI、API Key、模型名称', 'error', false);
    return;
  }
  STATE.settings = { apiUri, apiKey, modelName };
  saveSettingsToStorage();
  closeSettingsModal();
}

function clearSettings() {
  STATE.settings = {
    apiUri: 'https://ark.cn-beijing.volces.com/api/v3/chat/completions',
    apiKey: '',
    modelName: 'ep-20260307234016-726fd'
  };
  saveSettingsToStorage();
  document.getElementById('settingsApiUri').value = STATE.settings.apiUri;
  document.getElementById('settingsApiKey').value = STATE.settings.apiKey;
  document.getElementById('settingsModelName').value = STATE.settings.modelName;
  logStatus('设置已清除并恢复默认', 'success');
}

async function queryAICommand(input, mode) {
  const { apiUri, apiKey, modelName } = STATE.settings;
  if (!apiUri || !apiKey || !modelName) {
    throw new Error('请先通过"设置"填写完整 AI API URI、API Key 和模型名称');
  }

  const systemPrompt = `角色：GeoGebra 指令生成器（100% 执行率）
目标：将用户自然语言指令转为可直接在 GeoGebra 中执行的纯英文命令，无任何冗余内容。

========================================
一、强制执行规则（违反则重新生成）
========================================
1. 输出仅包含 GeoGebra 官方支持的英文命令，每行1条，无标题、无解释、无注释、无JSON、无中文；
2. 中文术语必须精准转换为 GeoGebra 标准术语：
   - 圆心 → center、半径 → radius、正方形 → square、三角形 → triangle、直线 → line、线段 → segment、射线 → ray；
   - 坐标 → coordinates、横坐标 → x-coordinate、纵坐标 → y-coordinate、中点 → midpoint、垂足 → foot of perpendicular；
   - 平行 → parallel、垂直 → perpendicular、相切 → tangent、相交 → intersect；
3. 命令参数必须符合 GeoGebra 语法：
   - 坐标必须用 (x,y) 格式（如 (0,0)，禁止 [0,0] 或 0,0）；
   - 点必须用大写字母命名（如 A=(1,2)，禁止 a=(1,2)）；
   - 长度/角度必须为数值（如 5、30°、π，禁止"五""三十度"）；
4. 复杂图形生成逻辑：先定义基础元素（点/线），再构造最终图形；
5. 无指定参数时的默认值：中心/起点默认 (0,0)，角度默认 0°/90°/180°，长度默认整数（如 2、3、4）；
6. 禁止生成 GeoGebra 不支持的命令（如 DrawCircle、CreateSquare 等非官方命令）。

========================================
二、GeoGebra 官方命令参考
========================================

【基本图形】
- Point(x, y) 或 Point(x, y, z) → 创建点，示例：A = (1, 2)、B = (3, 4, 5)
- Circle(center, radius) → 创建圆，示例：Circle(A, 3)
- Circle(center, point) → 通过点的圆，示例：Circle(A, B)
- Circle(point1, point2, point3) → 三点定圆，示例：Circle(A, B, C)
- Line(point1, point2) → 创建直线，示例：Line(A, B)
- Segment(point1, point2) → 创建线段，示例：Segment(A, B)
- Ray(point1, point2) → 创建射线，示例：Ray(A, B)
- Vector(point1, point2) → 创建向量，示例：Vector(A, B)
- Polygon(point1, point2, ...) → 创建多边形，示例：Polygon(A, B, C, D)
- Triangle(point1, point2, point3) → 创建三角形，示例：Triangle(A, B, C)
- Square(point1, point2) → 创建正方形，示例：Square(A, B)
- Rectangle(point1, point2) → 创建矩形，示例：Rectangle(A, B)
- Parallelogram(point1, point2, point3) → 创建平行四边形，示例：Parallelogram(A, B, C)
- Rhombus(point1, point2, point3) → 创建菱形，示例：Rhombus(A, B, C)
- Trapezoid(point1, point2, point3, point4) → 创建梯形，示例：Trapezoid(A, B, C, D)
- RegularPolygon(n, center, point) → 正多边形，示例：RegularPolygon(6, A, B)
- Hexagon(point1, point2) → 六边形，示例：Hexagon(A, B)
- Pentagon(point1, point2) → 五边形，示例：Pentagon(A, B)

【曲线与函数】
- f(x) = expression → 创建函数，示例：f(x) = x^2、g(x) = sin(x)
- Function(expression, var, start, end) → 函数曲线，示例：Function(x^2, x, -5, 5)
- Curve(expr1, expr2, var, min, max) → 参数曲线，示例：Curve(cos(t), sin(t), t, 0, 2π)
- Curve(expr1, expr2, expr3, var, min, max) → 3D参数曲线，示例：Curve(cos(t), sin(t), t, t, 0, 2π)
- Parabola(focus, directrix) → 抛物线，示例：Parabola(A, line)
- Ellipse(focus1, focus2, point) → 椭圆，示例：Ellipse(A, B, C)
- Hyperbola(focus1, focus2, point) → 双曲线，示例：Hyperbola(A, B, C)
- Conic(five points) → 圆锥曲线，示例：Conic(A, B, C, D, E)
- Sine(frequency, amplitude, x) → 正弦函数，示例：Sine(1, 2, x)
- Cosine(frequency, amplitude, x) → 余弦函数，示例：Cosine(1, 2, x)
- Tangent(function, point) → 函数切线，示例：Tangent(f, A)
- Polynomial(coefficients) → 多项式，示例：Polynomial({1, 2, 3})
- Derivative(function) → 导数，示例：Derivative(f)
- Integral(function, start, end) → 积分，示例：Integral(f, 0, 1)

【几何关系】
- Midpoint(point1, point2) → 中点，示例：Midpoint(A, B)
- PerpendicularLine(point, line) → 垂线，示例：PerpendicularLine(C, line)
- ParallelLine(point, line) → 平行线，示例：ParallelLine(C, line)
- Bisector(line1, line2) → 角平分线，示例：Bisector(line1, line2)
- PerpendicularBisector(point1, point2) → 垂直平分线，示例：PerpendicularBisector(A, B)
- Angle(point1, point2, point3) → 角度，示例：Angle(A, B, C)
- AngleBisector(point1, point2, point3) → 角平分线，示例：AngleBisector(A, B, C)
- Distance(point1, point2) → 距离，示例：Distance(A, B)
- Length(segment) → 长度，示例：Length(segment)
- Slope(line) → 斜率，示例：Slope(line)
- Intersect(obj1, obj2) → 交点，示例：Intersect(line1, line2)
- Intersect(obj1, obj2, index) → 指定交点，示例：Intersect(line1, circle, 1)
- Tangent(point, conic) → 切线，示例：Tangent(A, circle)
- Tangent(line, conic) → 切线，示例：Tangent(line, circle)
- Polar(point, conic) → 极线，示例：Polar(A, circle)
- Locus(point, moving point) → 轨迹，示例：Locus(C, B)
- Envelope(line, moving point) → 包络线，示例：Envelope(line, B)

【变换】
- Rotate(object, angle, point) → 旋转，示例：Rotate(A, 90°, B)
- Translate(object, vector) → 平移，示例：Translate(A, vector)
- Reflect(object, line) → 反射，示例：Reflect(A, line)
- Reflect(object, point) → 点对称，示例：Reflect(A, B)
- Dilate(object, factor, point) → 缩放，示例：Dilate(A, 2, B)
- Homothety(object, factor, point) → 位似，示例：Homothety(A, 2, B)
- Similarity(object, factor, angle, point) → 相似变换，示例：Similarity(A, 2, 45°, B)

【3D 图形】
- Sphere(center, radius) → 球体，示例：Sphere(A, 3)
- Cylinder(point1, point2, radius) → 圆柱，示例：Cylinder(A, B, 2)
- Cone(point1, point2, radius) → 圆锥，示例：Cone(A, B, 2)
- Plane(point1, point2, point3) → 平面，示例：Plane(A, B, C)
- Polyhedron(points) → 多面体，示例：Polyhedron(A, B, C, D, E, F)
- Pyramid(base, apex) → 棱锥，示例：Pyramid(polygon, point)
- Prism(base, height) → 棱柱，示例：Prism(polygon, 5)
- Tetrahedron(point1, point2, point3, point4) → 四面体，示例：Tetrahedron(A, B, C, D)
- Cube(point1, point2) → 立方体，示例：Cube(A, B)
- Cuboid(point1, point2, point3) → 长方体，示例：Cuboid(A, B, C)

【测量与计算】
- Area(object) → 面积，示例：Area(polygon)
- Perimeter(object) → 周长，示例：Perimeter(polygon)
- Radius(circle) → 半径，示例：Radius(circle)
- Circumference(circle) → 周长，示例：Circumference(circle)
- Volume(object) → 体积，示例：Volume(sphere)
- SurfaceArea(object) → 表面积，示例：SurfaceArea(sphere)
- AngleValue(angle) → 角度值，示例：AngleValue(angle)
- Abs(number) → 绝对值，示例：Abs(-5)
- Sqrt(number) → 平方根，示例：Sqrt(16)
- Pow(base, exponent) → 幂运算，示例：Pow(2, 3)
- Log(number, base) → 对数，示例：Log(100, 10)
- Ln(number) → 自然对数，示例：Ln(e)
- Exp(number) → 指数，示例：Exp(1)
- Sin(angle) → 正弦，示例：Sin(30°)
- Cos(angle) → 余弦，示例：Cos(60°)
- Tan(angle) → 正切，示例：Tan(45°)
- Asin(value) → 反正弦，示例：Asin(0.5)
- Acos(value) → 反余弦，示例：Acos(0.5)
- Atan(value) → 反正切，示例：Atan(1)

【样式设置】
- SetColor(object, r, g, b) → 设置颜色，示例：SetColor(A, 255, 0, 0)
- SetFilling(object, filling) → 填充，示例：SetFilling(A, 1)
- SetLineThickness(object, thickness) → 线宽，示例：SetLineThickness(A, 3)
- SetPointSize(point, size) → 点大小，示例：SetPointSize(A, 5)
- SetLineType(object, type) → 线型，示例：SetLineType(A, 0)
- ShowLabel(object, show) → 显示标签，示例：ShowLabel(A, true)
- SetCaption(object, text) → 设置标题，示例：SetCaption(A, "点A")
- SetCoordSystem(xMin, xMax, yMin, yMax) → 设置坐标系，示例：SetCoordSystem(-10, 10, -10, 10)
- SetAxesVisible(showX, showY) → 显示坐标轴，示例：SetAxesVisible(true, true)
- SetGridVisible(show) → 显示网格，示例：SetGridVisible(true)

【文本与标注】
- Text(object, point) → 文本标注，示例：Text("Hello", A)
- Text(text, point) → 文本，示例：Text("Hello", (1, 2))
- LaTeX(text, point) → LaTeX公式，示例：LaTeX("x^2", A)
- FormulaText(formula, point) → 公式文本，示例：FormulaText(f, A)

【动态与交互】
- Slider(min, max, step, width, length, fixed, position) → 滑块，示例：Slider(0, 10, 1, 200, 20, false, (1, 2))
- Checkbox(caption, checked) → 复选框，示例：Checkbox("显示", true)
- InputBox(caption, default) → 输入框，示例：InputBox("数值", 5)
- Button(caption, script) → 按钮，示例：Button("运行", "SetValue(a, 5)")
- Sequence(expression, var, start, end) → 序列，示例：Sequence(i^2, i, 1, 10)
- Element(list, index) → 列表元素，示例：Element(list, 1)
- Join(list1, list2) → 连接列表，示例：Join(list1, list2)
- Union(list1, list2) → 并集，示例：Union(list1, list2)
- Intersection(list1, list2) → 交集，示例：Intersection(list1, list2)
- Difference(list1, list2) → 差集，示例：Difference(list1, list2)

【高级功能】
- Fit(list1, list2) → 拟合，示例：Fit(xcoords, ycoords)
- FitPoly(list1, list2, degree) → 多项式拟合，示例：FitPoly(xcoords, ycoords, 2)
- FitExp(list1, list2) → 指数拟合，示例：FitExp(xcoords, ycoords)
- FitLog(list1, list2) → 对数拟合，示例：FitLog(xcoords, ycoords)
- FitPow(list1, list2) → 幂函数拟合，示例：FitPow(xcoords, ycoords)
- Mean(list) → 平均值，示例：Mean(list)
- Median(list) → 中位数，示例：Median(list)
- Mode(list) → 众数，示例：Mode(list)
- StandardDeviation(list) → 标准差，示例：StandardDeviation(list)
- Variance(list) → 方差，示例：Variance(list)
- Correlation(list1, list2) → 相关系数，示例：Correlation(xcoords, ycoords)
- Covariance(list1, list2) → 协方差，示例：Covariance(xcoords, ycoords)

========================================
三、参数格式规范
========================================
- 坐标格式：(x, y) 或 (x, y, z)，必须使用括号和逗号
- 点命名：必须使用大写字母（A, B, C, D, E...）
- 角度单位：度数（90°）或弧度（π/2），支持 π、e 等常数
- 颜色值：RGB 格式，范围 0-255
- 布尔值：true 或 false
- 数学常数：π (pi)、e、∞ (infinity)

========================================
四、常见图形生成示例
========================================

【圆】
- 圆心(0,0)半径3的圆 → Circle((0,0), 3)
- 圆心(2,3)半径5的圆 → Circle((2,3), 5)
- 过点(1,1)和(3,3)的圆 → Circle((1,1), (3,3))

【正方形】
- 边长为4的正方形，中心在原点 → A = (-2,-2)、B = (2,-2)、C = (2,2)、D = (-2,2)、Polygon(A,B,C,D)
- 边长为2的正方形，左下角在(0,0) → A = (0,0)、B = (2,0)、C = (2,2)、D = (0,2)、Polygon(A,B,C,D)

【三角形】
- 顶点分别在(0,0)、(3,0)、(0,4)的三角形 → A = (0,0)、B = (3,0)、C = (0,4)、Triangle(A,B,C)
- 等边三角形，边长为4 → A = (0,0)、B = (4,0)、C = (2,2√3)、Triangle(A,B,C)
- 直角三角形，直角在原点，两直角边为3和4 → A = (0,0)、B = (3,0)、C = (0,4)、Triangle(A,B,C)

【函数】
- y = x² → f(x) = x^2
- y = sin(x) → f(x) = sin(x)
- y = 2x + 1 → f(x) = 2x + 1
- y = e^x → f(x) = e^x
- y = ln(x) → f(x) = ln(x)

【直线】
- 过点(1,2)和(3,4)的直线 → A = (1,2)、B = (3,4)、Line(A,B)
- 斜率为2，过点(1,1)的直线 → A = (1,1)、B = (2,3)、Line(A,B)
- x轴 → Line((0,0), (1,0))
- y轴 → Line((0,0), (0,1))

【正多边形】
- 正六边形，边长为2 → A = (0,0)、B = (2,0)、RegularPolygon(6, A, B)
- 正五边形，边长为3 → A = (0,0)、B = (3,0)、RegularPolygon(5, A, B)
- 正八边形，边长为1 → A = (0,0)、B = (1,0)、RegularPolygon(8, A, B)

【椭圆】
- 椭圆中心(0,0)长轴5短轴3 → A = (0,0)、B = (5,0)、C = (3,0)、Ellipse(A, B, C)
- 椭圆中心(1,1)长轴6短轴4 → A = (1,1)、B = (6,0)、C = (4,0)、Ellipse(A, B, C)

【抛物线】
- 抛物线顶点(0,0)焦点(0,1) → A = (0,1)、B = (0,0)、Parabola(A, B)
- 抛物线顶点(1,1)焦点(2,1) → A = (2,1)、B = (1,1)、Parabola(A, B)

【双曲线】
- 双曲线焦点(-2,0)和(2,0)，顶点(1,0) → A = (-2,0)、B = (2,0)、C = (1,0)、Hyperbola(A, B, C)

【3D图形】
- 球体中心(0,0,0)半径3 → A = (0,0,0)、Sphere(A, 3)
- 圆柱底面中心(0,0,0)高5 → A = (0,0,0)、B = (0,0,5)、Cylinder(A, B, 2)
- 圆锥顶点(0,0,5)底面半径2 → A = (0,0,5)、B = (0,0,0)、Cone(A, B, 2)
- 平面过点(0,0,0)、(1,0,0)、(0,1,0) → Plane((0,0,0), (1,0,0), (0,1,0))

【几何关系】
- 线段AB的中点 → A = (0,0)、B = (4,0)、Midpoint(A, B)
- 过点C垂直于直线AB的垂线 → A = (0,0)、B = (4,0)、C = (2,2)、PerpendicularLine(C, Line(A, B))
- 过点C平行于直线AB的平行线 → A = (0,0)、B = (4,0)、C = (2,2)、ParallelLine(C, Line(A, B))
- 直线AB和CD的交点 → A = (0,0)、B = (4,0)、C = (0,4)、D = (4,4)、Intersect(Line(A, B), Line(C, D))

【变换】
- 将点A绕点B旋转90度 → A = (1,0)、B = (0,0)、Rotate(A, 90°, B)
- 将点A沿向量(2,3)平移 → A = (0,0)、v = (2,3)、Translate(A, v)
- 将点A关于直线BC反射 → A = (0,0)、B = (1,0)、C = (0,1)、Reflect(A, Line(B, C))
- 将点A关于点B对称 → A = (0,0)、B = (2,2)、Reflect(A, B)
- 将点A以点B为中心放大2倍 → A = (1,0)、B = (0,0)、Dilate(A, 2, B)

========================================
五、输出格式要求
========================================
1. 每行一条命令，命令之间用换行符分隔
2. 不需要任何解释、注释或说明文字
3. 命令必须完全符合 GeoGebra 语法
4. 点名使用大写字母，按字母顺序命名（A, B, C, D...）
5. 先定义基础元素（点、线），再定义复合图形

示例输出：
A = (0,0)
B = (3,0)
C = (0,4)
Triangle(A,B,C)

========================================
严格按上述规则输出，无需任何解释、注释或冗余内容。当前模式：${mode}`;
  const userPrompt = `将这个自然语言转为 GeoGebra 命令：${input}`;

  const payload = {
    model: modelName,
    messages: [{ role: 'system', content: systemPrompt }, { role: 'user', content: userPrompt }],
    temperature: 0.1
  };

  const apiUrl = apiUri;
  const resp = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!resp.ok) {
    throw new Error(`AI 请求失败 ${resp.status}`);
  }
  const data = await resp.json();
  const cmd = data?.choices?.[0]?.message?.content?.trim();
  if (!cmd) { throw new Error('AI 未生成命令'); }
  return cmd;
}

function runGgbCommand(command) {
  const app = ggbApplet || window.ggbApplet;
  if (!app) throw new Error('GeoGebra Applet 未初始化');

  if (typeof app.evalCommand === 'function') {
    const result = app.evalCommand(command);
    console.log(`执行命令: ${command} -> ${result}`);
    return result;
  }

  throw new Error('GeoGebra 实例不支持 evalCommand 方法');
}

function executeGeoGebra(commands) {
  if (!STATE.isReady || !isGeoGebraAppletInitialized()) {
    throw new Error('GeoGebra 未初始化');
  }

  const app = ggbApplet || window.ggbApplet;
  console.log('GeoGebra app 对象:', app);
  console.log('app.evalCommand 类型:', typeof app.evalCommand);
  console.log('app 可用方法:', Object.getOwnPropertyNames(Object.getPrototypeOf(app)).filter(name => typeof app[name] === 'function'));
  
  if (!app || typeof app.evalCommand !== 'function') {
    throw new Error('GeoGebra 实例不支持 evalCommand 方法');
  }

  const result = app.evalCommand(commands);
  console.log(`执行命令: ${commands} -> ${result}`);
  return result;
}

function refreshObjectList() {
  if (!STATE.isReady) return;
  try {
    let objects = [];
    if (typeof ggbApplet.getAllObjectNames === 'function') {
      objects = ggbApplet.getAllObjectNames();
    } else if (typeof ggbApplet.evalCommand === 'function') {
      const result = ggbApplet.evalCommand('GetAllObjectNames()');
      if (result && typeof result === 'string') {
        objects = result.split(',').map(s => s.trim()).filter(Boolean);
      }
    }
    STATE.lastObjects = objects;
    renderObjectList(objects);
  } catch (err) {
    console.error('刷新对象列表失败：', err);
    renderObjectList([]);
  }
}

function clearCanvas() {
  if (!ggbApplet) return;
  initGeoGebra(STATE.currentMode);
  logStatus('画布已清空', 'info');
}

function fitViewport() {
  if (!STATE.isReady || !ggbApplet) return;
  if (typeof ggbApplet.showAllObjects === 'function') {
    ggbApplet.showAllObjects();
  } else if (typeof ggbApplet.setCoordSystem === 'function') {
    ggbApplet.setCoordSystem(-10, 10, -10, 10);
  }
  logStatus('视图已适应所有对象', 'success');
}

function toggleAxes() {
  if (!STATE.isReady || !ggbApplet) return;
  STATE.showAxes = !STATE.showAxes;
  if (typeof ggbApplet.setAxesVisible === 'function') {
    ggbApplet.setAxesVisible(1, STATE.showAxes, STATE.showAxes, true);
    logStatus(`坐标轴已${STATE.showAxes ? '显示' : '隐藏'}`, 'info');
  }
}

function toggleGrid() {
  if (!STATE.isReady || !ggbApplet) return;
  STATE.showGrid = !STATE.showGrid;
  if (typeof ggbApplet.setGridVisible === 'function') {
    ggbApplet.setGridVisible(1, STATE.showGrid);
    logStatus(`网格已${STATE.showGrid ? '显示' : '隐藏'}`, 'info');
  }
}

function toggleTheme() {
  STATE.theme = STATE.theme === 'light' ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', STATE.theme);
  document.body.classList.toggle('dark-theme', STATE.theme === 'dark');
  try { localStorage.setItem('portal-theme', STATE.theme); } catch(e) {}
  logStatus(`主题已切换为${STATE.theme === 'light' ? '浅色' : '深色'}`, 'info');
}

function zoomIn() {
  if (!STATE.isReady || !ggbApplet) return;
  if (typeof ggbApplet.setCoordSystem === 'function') {
    ggbApplet.setCoordSystem(-5, 5, -5, 5);
    logStatus('已放大', 'info');
  }
}

function zoomOut() {
  if (!STATE.isReady || !ggbApplet) return;
  if (typeof ggbApplet.setCoordSystem === 'function') {
    ggbApplet.setCoordSystem(-20, 20, -20, 20);
    logStatus('已缩小', 'info');
  }
}

function clearHistory() {
  STATE.history = [];
  renderHistory();
  logStatus('历史记录已清空', 'info');
}

function copyCommand(command, event) {
  const decodedCommand = command
    .replace(/\\n/g, '\n')
    .replace(/\\r/g, '\r')
    .replace(/\\'/g, "'")
    .replace(/\\\\/g, '\\');
  
  navigator.clipboard.writeText(decodedCommand).then(() => {
    logStatus('命令已复制到剪贴板', 'success');
    
    if (event && event.target) {
      const btn = event.target;
      const originalText = btn.textContent;
      btn.textContent = '✓ 已复制';
      btn.style.background = 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)';
      btn.style.color = '#fff';
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.color = '';
      }, 2000);
    }
  }).catch(() => {
    logStatus('复制失败', 'error', false);
    
    if (event && event.target) {
      const btn = event.target;
      const originalText = btn.textContent;
      btn.textContent = '✗ 失败';
      btn.style.background = 'linear-gradient(135deg, #f8d7da 0%, #f5c6cb 100%)';
      btn.style.color = '#721c24';
      
      setTimeout(() => {
        btn.textContent = originalText;
        btn.style.background = '';
        btn.style.color = '';
      }, 2000);
    }
  });
}

function executeHistoryCommand(command) {
  try {
    const decodedCommand = command
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\'/g, "'")
      .replace(/\\\\/g, '\\');
    executeGeoGebra(decodedCommand);
    refreshObjectList();
    logStatus('命令已重新执行', 'success');
  } catch (err) {
    logStatus(`执行失败: ${err.message}`, 'error', false);
  }
}

function renderHistory() {
  const container = document.getElementById('historyList');
  if (!STATE.history.length) { container.textContent='暂无历史'; return; }
  container.innerHTML = STATE.history.map((item, index) => {
    const escapedCommand = item.command
      .replace(/\\/g, '\\\\')
      .replace(/'/g, "\\'")
      .replace(/"/g, '&quot;')
      .replace(/\n/g, '\\n')
      .replace(/\r/g, '\\r');
    return `
    <div class="history-item">
      <div class="history-header">
        <span class="history-source">[${item.source}]</span>
        <span class="history-time">${item.at}</span>
      </div>
      <div class="history-command" title="点击复制">${item.command.replace(/\n/g, '<br>')}</div>
      <div class="history-actions">
        <button class="btn-small" onclick="window.copyCommand('${escapedCommand}', event)">复制</button>
        <button class="btn-small" onclick="window.executeHistoryCommand('${escapedCommand}')">执行</button>
      </div>
    </div>
  `;
}).join('');
}

function downloadBlob(content, filename, type) {
  const blob = new Blob([content], { type });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  URL.revokeObjectURL(link.href);
  link.remove();
}

function exportPNG() {
  if (!STATE.isReady || !ggbApplet) {
    logStatus('GeoGebra 未初始化，无法导出', 'error');
    return;
  }
  
  try {
    let data;
    
    if (typeof ggbApplet.getPNGBase64 === 'function') {
      if (STATE.currentMode === '3D') {
        data = ggbApplet.getPNGBase64(1, 1);
      } else {
        data = ggbApplet.getPNGBase64(1, 1, true);
      }
      
      if (data) {
        const b64 = data.replace(/^data:image\/png;base64,/, '');
        const bytes = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
        downloadBlob(bytes, `geogebra-${Date.now()}.png`, 'image/png');
        logStatus('已导出 PNG', 'success');
      } else {
        logStatus('导出 PNG 失败：无法获取图像数据', 'error');
      }
    } else if (typeof ggbApplet.exportImage === 'function') {
      ggbApplet.exportImage(`geogebra-${Date.now()}.png`, 1);
      logStatus('已导出 PNG', 'success');
    } else {
      logStatus('导出 PNG 失败：不支持导出功能', 'error');
    }
  } catch (error) {
    console.error('导出 PNG 时出错:', error);
    logStatus('导出 PNG 失败：' + error.message, 'error');
  }
}

function saveXML() {
  if (!STATE.isReady || !ggbApplet) return;
  if (typeof ggbApplet.getXML === 'function') {
    const xml = ggbApplet.getXML();
    downloadBlob(xml, `geogebra-${Date.now()}.ggb`, 'application/xml');
    logStatus('已保存 XML', 'success');
  }
}

function loadXML() {
  if (!STATE.isReady || !ggbApplet) return;
  const xml = document.getElementById('xmlInput').value.trim();
  if (!xml) {
    logStatus('请先输入 XML 内容', 'error', false);
    return;
  }
  if (typeof ggbApplet.setXML === 'function') {
    ggbApplet.setXML(xml);
    logStatus('已加载 XML', 'success');
    refreshObjectList();
  }
}

function debounce(fn, delay = 250) {
  let timer = null;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function resizeApplet() {
  if (!ggbApplet) return;
  const container = document.querySelector('.canvas-wrapper');
  const width = container.clientWidth;
  const height = Math.max(window.innerHeight * 0.6, 420);
  ggbApplet.setSize(width, height);
}

function initGeoGebra(mode = '2D') {
  const cfg = {
    appName: mode === '3D' ? '3d' : 'classic',
    width: document.querySelector('.canvas-wrapper').clientWidth,
    height: Math.max(window.innerHeight * 0.6, 420),
    showToolBar: true,
    showAlgebraInput: true,
    language: 'zh-CN',
    showResetIcon: true,
    enableLabelDrags: true,
    enableShiftDragZoom: true,
    enableRightClick: true,
    showMenuBar: true,
    useBrowserForJS: false,
    errorDialogsActive: true,
    preventFocus: false
  };

  STATE.isReady = false;

  if (ggbApplet) {
    document.getElementById('ggbApplet').innerHTML = '';
  }

  ggbApplet = new GGBApplet(cfg, "5.0");
  console.log('创建 GGBApplet 实例:', ggbApplet);
  ggbApplet.inject('ggbApplet');
  console.log('已调用 inject 方法');

  const waitReady = setInterval(() => {
    const initialized = ggbApplet && (typeof ggbApplet.isInitialized !== 'function' || ggbApplet.isInitialized());
    console.log('检查初始化状态:', initialized);
    if (initialized) {
      clearInterval(waitReady);
      STATE.isReady = true;
      console.log('GeoGebra 初始化完成，ggbApplet:', ggbApplet);
      logStatus(`GeoGebra 已初始化 (模式 ${mode})，可开始绘图`, 'success');
      refreshObjectList();
    }
  }, 250);

  STATE.currentMode = mode;
  document.getElementById('btn2D').classList.toggle('active', mode === '2D');
  document.getElementById('btn3D').classList.toggle('active', mode === '3D');
}

function isGeoGebraAppletInitialized() {
  if (!ggbApplet) return false;
  if (typeof ggbApplet.isInitialized === 'function') {
    try {
      return ggbApplet.isInitialized();
    } catch (err) {
      console.warn('检查 GeoGebra 初始化状态时异常：', err);
      return false;
    }
  }
  return true;
}

async function ensureGeoGebraReady(timeout = 10000) {
  if (STATE.isReady && isGeoGebraAppletInitialized()) return;
  const start = Date.now();
  return new Promise((resolve, reject) => {
    const timer = setInterval(() => {
      if (STATE.isReady && isGeoGebraAppletInitialized()) {
        clearInterval(timer);
        resolve();
      } else if (Date.now() - start > timeout) {
        clearInterval(timer);
        reject(new Error('GeoGebra 初始化超时，请刷新页面或重试')); 
      }
    }, 150);
  });
}

async function onDrawClick() {
  const input = document.getElementById('prompt').value.trim();
  if (!input) {
    logStatus('请输入指令', 'error');
    return;
  }
  if (!ggbApplet) {
    logStatus('GeoGebra Applet 未创建，请刷新页面', 'error', false);
    return;
  }

  try {
    await ensureGeoGebraReady();
  } catch (err) {
    logStatus(`绘图失败: ${err.message}`, 'error', false);
    return;
  }

  const mode = STATE.currentMode;
  const commandMode = document.getElementById('commandMode').value;

  let commands = null;

  const drawButton = document.getElementById('drawButton');
  const loadingSpinner = document.getElementById('loadingSpinner');
  drawButton.disabled = true;
  loadingSpinner.style.display = 'inline-block';
  logStatus('正在生成 GeoGebra 命令...', 'info');

  try {
    if (commandMode === 'local' || commandMode === 'auto') {
      commands = getLocalCommand(input, mode);
      if (commands) {
        appendHistory(commands, '本地');
      }
    }

    if (!commands && (commandMode === 'ai' || commandMode === 'auto')) {
      const aiCommand = await queryAICommand(input, mode);
      commands = aiCommand;
      appendHistory(commands, 'AI');
    }

    if (!commands) {
      throw new Error('未找到可执行命令，请尝试更明确的指令或切换到 AI 模式。');
    }

    executeGeoGebra(commands);
    appendHistory(commands, '执行');
    refreshObjectList();
    logStatus('绘图完成', 'success');

  } catch (err) {
    console.error(err);
    logStatus(`绘图失败: ${err.message}`, 'error', false);
  } finally {
    drawButton.disabled = false;
    loadingSpinner.style.display = 'none';
  }
}

window.addEventListener('load', () => {
  window.copyCommand = copyCommand;
  window.executeHistoryCommand = executeHistoryCommand;
  
  const promptInput = document.getElementById('prompt');
  const clearInputBtn = document.getElementById('clearInputBtn');
  
  document.getElementById('btn2D').addEventListener('click', () => initGeoGebra('2D'));
  document.getElementById('btn3D').addEventListener('click', () => initGeoGebra('3D'));
  document.getElementById('drawButton').addEventListener('click', onDrawClick);
  document.getElementById('clearButton').addEventListener('click', clearCanvas);
  document.getElementById('refreshObjects').addEventListener('click', refreshObjectList);
  document.getElementById('clearHistory').addEventListener('click', clearHistory);
  
  clearInputBtn.addEventListener('click', () => {
    promptInput.value = '';
    clearInputBtn.style.display = 'none';
    promptInput.focus();
  });
  
  promptInput.addEventListener('input', () => {
    if (promptInput.value.trim().length > 0) {
      clearInputBtn.style.display = 'flex';
    } else {
      clearInputBtn.style.display = 'none';
    }
  });
  
  promptInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && promptInput.value.trim().length > 0) {
      e.preventDefault();
      onDrawClick();
    }
  });
  
  document.getElementById('commandMode').addEventListener('change', (evt) => {
    const mode = evt.target.value;
    logStatus(`命令解析模式已切换为：${mode === 'auto' ? '自动' : mode === 'local' ? '本地' : 'AI'}`, 'info');
  });
  window.addEventListener('resize', debounce(() => {
    if (ggbApplet) resizeApplet();
  }, 250));
  document.getElementById('settingsButton')?.addEventListener('click', openSettingsModal);
  document.getElementById('settingsSave')?.addEventListener('click', applySettings);
  document.getElementById('settingsClear')?.addEventListener('click', clearSettings);
  document.getElementById('settingsCancel')?.addEventListener('click', closeSettingsModal);
  document.getElementById('settingsClose')?.addEventListener('click', closeSettingsModal);
  document.getElementById('settingsModal')?.addEventListener('click', (evt) => { if (evt.target.id === 'settingsModal') closeSettingsModal(); });
  document.getElementById('btnExportPNG')?.addEventListener('click', exportPNG);
  document.getElementById('btnSaveXML')?.addEventListener('click', saveXML);
  document.getElementById('btnLoadXML')?.addEventListener('click', loadXML);
  document.getElementById('zoomInButton')?.addEventListener('click', zoomIn);
  document.getElementById('zoomOutButton')?.addEventListener('click', zoomOut);
  document.getElementById('axesToggle')?.addEventListener('click', toggleAxes);
  document.getElementById('gridToggle')?.addEventListener('click', toggleGrid);
  document.getElementById('helpToggle')?.addEventListener('click', () => {
    const helpPanel = document.getElementById('helpPanel');
    helpPanel.style.display = helpPanel.style.display === 'none' ? 'block' : 'none';
  });
  
  document.addEventListener('keydown', (e) => {
    if (e.ctrlKey || e.metaKey) {
      switch(e.key.toLowerCase()) {
        case 'enter':
          e.preventDefault();
          onDrawClick();
          break;
        case 's':
          e.preventDefault();
          saveXML();
          break;
        case 'o':
          e.preventDefault();
          document.getElementById('xmlInput').focus();
          break;
      }
    } else {
      switch(e.key) {
        case 'Escape':
          closeSettingsModal();
          document.getElementById('helpPanel').style.display = 'none';
          break;
        case '+':
        case '=':
          if (e.ctrlKey) {
            e.preventDefault();
            zoomIn();
          }
          break;
        case '-':
          if (e.ctrlKey) {
            e.preventDefault();
            zoomOut();
          }
          break;
      }
    }
  });
  
  initGeoGebra('2D');
});