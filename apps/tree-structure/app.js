/* ============================================================
   树结构全品类可视化教学平台 — app.js
   纯原生 JavaScript，零依赖
   分层：数据层 → 算法层 → 渲染层 → 动画层 → 交互层
   ============================================================ */

'use strict';

/* ============================================================
   全局状态
   ============================================================ */
const State = {
  currentType: 'binary',      // 当前树类型
  tree: null,                 // 当前树数据结构（兼容旧逻辑）
  trees: [],                  // 多树并存列表 [{type, tree, treeIdx}]
  selectedNode: null,         // 选中的节点
  animSteps: [],              // 动画步骤队列
  animIndex: 0,
  animPlaying: false,
  animSpeed: 1.0,             // 1x ~ 3x
  animTimer: null,
  // 画布变换
  view: { x: 0, y: 0, scale: 1 },
  // B树阶数
  btreeOrder: 3,
  // 堆类型
  heapType: 'max',
  // 当前遍历模式
  traverseMode: null,
  // 并查集
  unionFind: null,
  // 日志
  logCounter: 0,
  // 节点ID计数器
  idCounter: 0,
  // 错误演示索引（循环切换）
  wrongDemoIndex: 0,
  // 对比模式：'compare'|null
  compareMode: null,
  // 当前选中的树（多树并存时）
  selectedTreeIdx: null,
  // 画布全屏
  fullscreen: false,
};

/* ============================================================
   节点工厂（通用二叉树节点）
   ============================================================ */
function makeNode(value) {
  return {
    id: ++State.idCounter,
    value,
    left: null,
    right: null,
    parent: null,
    x: 0, y: 0,                // 渲染坐标
    // AVL
    height: 1,
    // 红黑树
    color: 'red',
    // 线索二叉树
    ltag: 0, rtag: 0,          // 0=child, 1=thread
    // 临时状态
    state: 'normal',           // normal|visited|comparing|swapping|invalid|selected
  };
}

/* ============================================================
   日志系统
   ============================================================ */
function log(msg, type = 'info') {
  const console = document.getElementById('logConsole');
  if (!console) return;
  const entry = document.createElement('div');
  entry.className = `log-entry ${type}`;
  State.logCounter++;
  entry.innerHTML = `<span class="step-num">[${State.logCounter}]</span>${msg}`;
  console.appendChild(entry);
  console.scrollTop = console.scrollHeight;
}

function clearLog() {
  document.getElementById('logConsole').innerHTML = '';
  State.logCounter = 0;
}

/* ============================================================
   知识点数据（严蔚敏/王道 408 标准）
   ============================================================ */
const KNOWLEDGE = {
  binary: {
    name: '普通二叉树',
    def: '每个节点最多有两个子树的树结构，度数不超过2，且左右子树有严格区分。',
    props: ['节点的度 ≤ 2', '子树有左右之分（有序树）', '第 i 层最多 2^(i-1) 个节点', '深度为 k 的二叉树最多 2^k - 1 个节点'],
    exam: ['n0 = n2 + 1（叶子数 = 度2节点数 + 1）', '完全二叉树深度 ⌊log2(n)⌋ + 1', '遍历：前序/中序/后序/层序'],
    complexity: { search: 'O(n)', insert: 'O(n)', delete: 'O(n)' },
    mistakes: '普通二叉树无排序性质，查找需遍历。注意区分二叉树与度为2的树。',
  },
  perfect: {
    name: '满二叉树（完美二叉树）',
    def: '所有非叶子节点都有两棵子树，且所有叶子都在同一层的二叉树。',
    props: ['深度 k → 节点数 2^k - 1', '叶子数 = 2^(k-1)', '非叶子节点度均为2', '同深度下节点数最多'],
    exam: ['满二叉树是完全二叉树的特例', '节点数必为奇数', '叶子节点全部在最底层'],
    complexity: { search: 'O(log n)', insert: 'O(log n)', delete: 'O(log n)' },
    mistakes: '满二叉树 ≠ 完全二叉树。满二叉树要求所有非叶子都有两子且叶子同层。',
  },
  complete: {
    name: '完全二叉树',
    def: '按层序编号，每个节点编号与同深度满二叉树对应编号一致。叶子只在最下两层，最下层从左到右连续。',
    props: ['叶子只能出现在最下两层', '最下层叶子集中在左侧', '度1的节点最多1个，且只有左孩子', '深度 ⌊log2(n)⌋ + 1'],
    exam: ['节点 i 的左孩子 2i，右孩子 2i+1', '节点 i 的父节点 ⌊i/2⌋', 'n 为奇数时 n0 = (n+1)/2', '深度 = ⌊log2(n)⌋ + 1'],
    complexity: { search: 'O(n)', insert: 'O(log n)', delete: 'O(log n)' },
    mistakes: '完全二叉树允许最后一层不满，但必须从左往右连续。叶子右侧出现空缺即非法。',
  },
  threaded: {
    name: '线索二叉树（中序）',
    def: '利用二叉链表的 n+1 个空链域存放前驱/后继指针，ltag/rtag 标志区分孩子与线索。',
    props: ['n 个节点有 n+1 个空链域可线索化', 'ltag=0 指向左孩子，ltag=1 指向前驱', 'rtag=0 指向右孩子，rtag=1 指向后继', '中序线索化便于中序遍历'],
    exam: ['线索化的实质：遍历中改空指针为线索', '前驱/后继查找 O(1) 或 O(height)', '中序线索第一个节点 = 最左下节点'],
    complexity: { search: 'O(h)', insert: 'O(h)', delete: 'O(h)' },
    mistakes: '线索二叉树需区分实线孩子边与虚线线索边。前驱后继线索方向易混淆。',
  },
  bst: {
    name: '二叉搜索树 BST',
    def: '左子树所有节点值 < 根节点值 < 右子树所有节点值（左小右大）。',
    props: ['中序遍历得到递增序列', '左子树 < 根 < 右子树', '查找类似二分', '删除度2节点用后继替换'],
    exam: ['插入必为新叶子（查找失败处）', '删除度2：用右子树最小值（后继）替换', '最坏退化为链表 O(n)'],
    complexity: { search: 'O(h) 平均 O(log n)', insert: 'O(h) 平均 O(log n)', delete: 'O(h) 平均 O(log n)' },
    mistakes: 'BST 不平衡时会退化。删除度2节点用后继（右子树最左）而非前驱，教材标准。',
  },
  heap: {
    name: '二叉堆',
    def: '完全二叉树 + 堆序性质。大根堆：父 ≥ 子；小根堆：父 ≤ 子。',
    props: ['完全二叉树结构', '大根堆根最大，小根堆根最小', '父节点 i，左孩子 2i，右孩子 2i+1', '存储于数组下标1开始'],
    exam: ['建堆 O(n)（自下而上调整）', 'shiftUp 插入，shiftDown 删除', '堆排序：建堆 + n-1 次删除', '优先队列基础'],
    complexity: { search: 'O(n)', insert: 'O(log n)', delete: 'O(log n)' },
    mistakes: '堆只保证父子关系，不保证左右子树大小关系。建堆从 ⌊n/2⌋ 开始向下调整。',
  },
  avl: {
    name: 'AVL 平衡二叉树',
    def: '任意节点左右子树高度差（平衡因子 BF）绝对值 ≤ 1 的 BST。',
    props: ['BF = 左子树高 - 右子树高 ∈ {-1,0,1}', '四种旋转：LL/LR/RR/RL', '严格平衡，高度 O(log n)', '查找效率稳定 O(log n)'],
    exam: ['LL: 左孩子的左子树插入 → 右旋', 'RR: 右孩子的右子树插入 → 左旋', 'LR: 左孩子的右子树插入 → 先左后右双旋', 'RL: 右孩子的左子树插入 → 先右后左双旋'],
    complexity: { search: 'O(log n)', insert: 'O(log n)', delete: 'O(log n)' },
    mistakes: 'BF 计算方向：左-右。删除可能多次旋转。LL/LR/RR/RL 判断看失衡点与新插入点的相对位置。',
  },
  rbtree: {
    name: '红黑树',
    def: '节点红黑色的自平衡 BST，通过性质约束保证最长路径不超过最短路径两倍。',
    props: ['①节点非红即黑', '②根为黑', '③叶子(NIL)为黑', '④红节点子必黑（不能连续红）', '⑤任一节点到叶子所有路径黑高相同'],
    exam: ['红黑树高度 ≤ 2log(n+1)', '插入新节点为红，需修复', '插入修复：叔红变色上溯，叔黑旋转', '删除修复更复杂，涉及双黑'],
    complexity: { search: 'O(log n)', insert: 'O(log n)', delete: 'O(log n)' },
    mistakes: '红黑树非严格平衡，旋转次数少（最多3次）。五大性质缺一不可，性质④⑤最易错。',
  },
  btree: {
    name: 'B树（B-树，别名B树）',
    def: 'm 阶平衡多路搜索树。根节点 1~m-1 关键字，非根 ⌈m/2⌉-1 ~ m-1 关键字，所有叶子同层。',
    props: [`根 1≤关键字≤m-1`, `非根 ⌈m/2⌉-1≤关键字≤m-1`, '关键字 k 的节点有 k+1 个子树', '所有叶子同层', '查找是多路查找'],
    exam: ['插入满则分裂：中间关键字上移', '删除不足则先借后合并', '磁盘I/O友好，数据库索引', '高度 O(log_m n)'],
    complexity: { search: 'O(log m n)', insert: 'O(log m n)', delete: 'O(log m n)' },
    mistakes: 'B树 = B-树（同一结构不同写法）。阶数 m 决定关键字上下限。分裂是中间值上移非平均。',
  },
  bplustree: {
    name: 'B+树',
    def: 'B树变体：所有数据只在叶子节点，索引节点只存关键字用于路由，叶子节点用双向链表连接。',
    props: ['所有数据存于叶子', '索引节点仅作路由', '叶子节点双向链表', '非根 ⌈m/2⌉-1 ≤ 关键字 ≤ m-1', '索引节点关键字会在叶子重复出现'],
    exam: ['范围查询高效（遍历链表）', '查找必到叶子层', '数据库索引首选', '分裂时关键字复制上移（非移动）'],
    complexity: { search: 'O(log m n)', insert: 'O(log m n)', delete: 'O(log m n)' },
    mistakes: 'B+树索引节点关键字在叶子重复。B树关键字全树唯一。B+树范围查询远优于B树。',
  },
  bstar: {
    name: 'B*树',
    def: 'B树变体：节点空间利用率至少 2/3，分裂时优先向兄弟借位，满则两个分裂成三个。',
    props: ['节点最少 ⌈2m/3⌉-1 关键字', '空间利用率 ≥ 2/3（高于B/B+）', '分裂优先借位兄弟', '两节点满→分裂成三个'],
    exam: ['利用率 2/3 vs B树 1/2', '实现复杂，工程少用', '理解思想即可，408低频', '与B/B+对比记忆'],
    complexity: { search: 'O(log m n)', insert: 'O(log m n)', delete: 'O(log m n)' },
    mistakes: 'B*树分裂成三节点是核心特征。利用率高于B树和B+树。低频考点，理解即可。',
  },
  forest: {
    name: '森林',
    def: '零棵互不相交的树的集合。树与二叉树可相互转换：树→二叉树用"左孩子右兄弟"法。',
    props: ['森林 = m(m≥0) 棵互不相交树', '树转二叉树：左孩子右兄弟', '森林转二叉树：根相连后转换', '先根遍历对应二叉树先序'],
    exam: ['树先根 = 二叉树先序', '树后根 = 二叉树中序', '森林先根遍历 = 二叉树先序', '左孩子右兄弟法是核心'],
    complexity: { search: 'O(n)', insert: 'O(1)', delete: 'O(n)' },
    mistakes: '树与森林的遍历对应关系易混淆：树先根↔二叉树先序，树后根↔二叉树中序。',
  },
  disjoint: {
    name: '并查集（森林表示）',
    def: '用森林表示集合，每棵树一个集合，根为代表元。支持 find（查集合）和 union（合并）。',
    props: ['parent 数组存储父指针', '根节点 parent[i]=i', 'find：沿父指针到根', 'union：一棵树根指向另一棵', '路径压缩 + 按秩合并 → 近 O(1)'],
    exam: ['路径压缩：find 时把节点直接连到根', '按秩合并：矮树连高树', 'rank 是高度上界', '复杂度 O(m·α(m,n)) 近似常数'],
    complexity: { search: 'O(α(n))≈O(1)', insert: 'O(1)', delete: 'O(α(n))' },
    mistakes: '路径压缩改变树形态。按秩合并的 rank 不等于实际高度（压缩后）。α 是阿克曼反函数。',
  },
};

/* ============================================================
   树类型配色表
   每种树提供：stroke（边/描边色）、fill（节点淡色填充，透明度较高）
   多树并存时使用 fill 区分，透明度 0.18~0.30，保持背景可读
   ============================================================ */
const TREE_COLORS = {
  binary:    { stroke: '#6b7280', fill: 'rgba(107,114,128,0.22)' },
  perfect:   { stroke: '#6b7280', fill: 'rgba(107,114,128,0.22)' },
  complete:  { stroke: '#6b7280', fill: 'rgba(107,114,128,0.22)' },
  threaded:  { stroke: '#6b7280', fill: 'rgba(107,114,128,0.22)' },
  bst:       { stroke: '#3b82f6', fill: 'rgba(59,130,246,0.22)' },
  heap:      { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.22)' },
  avl:       { stroke: '#10b981', fill: 'rgba(16,185,129,0.22)' },
  rbtree:    { stroke: '#ef4444', fill: 'rgba(239,68,68,0.22)' },
  btree:     { stroke: '#8b5cf6', fill: 'rgba(139,92,246,0.22)' },
  bplustree: { stroke: '#7c3aed', fill: 'rgba(124,58,237,0.22)' },
  bstar:     { stroke: '#a855f7', fill: 'rgba(168,85,247,0.22)' },
  forest:    { stroke: '#06b6d4', fill: 'rgba(6,182,212,0.22)' },
  disjoint:  { stroke: '#ec4899', fill: 'rgba(236,72,153,0.22)' },
};
// 多树并存时循环使用的强调色（淡色透明度较高，互不冲突）
const MULTI_TREE_PALETTE = [
  { stroke: '#3b82f6', fill: 'rgba(59,130,246,0.20)' },   // 蓝
  { stroke: '#10b981', fill: 'rgba(16,185,129,0.20)' },   // 绿
  { stroke: '#f59e0b', fill: 'rgba(245,158,11,0.20)' },   // 琥珀
  { stroke: '#ec4899', fill: 'rgba(236,72,153,0.20)' },   // 粉
  { stroke: '#8b5cf6', fill: 'rgba(139,92,246,0.20)' },   // 紫
  { stroke: '#06b6d4', fill: 'rgba(6,182,212,0.20)' },    // 青
  { stroke: '#ef4444', fill: 'rgba(239,68,68,0.20)' },    // 红
  { stroke: '#a855f7', fill: 'rgba(168,85,247,0.20)' },   // 紫罗兰
  { stroke: '#84cc16', fill: 'rgba(132,204,22,0.20)' },   // 黄绿
  { stroke: '#f97316', fill: 'rgba(249,115,22,0.20)' },   // 橙
];
// 对比模式配色
const COMPARE_COLORS = {
  bst:    { stroke: '#3b82f6', fill: 'rgba(59,130,246,0.22)' },
  avl:    { stroke: '#10b981', fill: 'rgba(16,185,129,0.22)' },
  rbtree: { stroke: '#ef4444', fill: 'rgba(239,68,68,0.22)' },
};

/* ============================================================
   算法层 — 二叉树基础
   ============================================================ */
const BinaryTreeOps = {
  // 从序列构建普通二叉树（按层序）
  buildFromSeq(seq) {
    if (!seq.length) return null;
    const root = makeNode(seq[0]);
    const queue = [root];
    let i = 1;
    while (i < seq.length) {
      const node = queue.shift();
      if (i < seq.length) { node.left = makeNode(seq[i]); node.left.parent = node; queue.push(node.left); i++; }
      if (i < seq.length) { node.right = makeNode(seq[i]); node.right.parent = node; queue.push(node.right); i++; }
    }
    return root;
  },

  height(node) {
    if (!node) return 0;
    const l = node.ltag === 0 ? this.height(node.left) : 0;
    const r = node.rtag === 0 ? this.height(node.right) : 0;
    return 1 + Math.max(l, r);
  },

  count(node) {
    if (!node) return 0;
    const l = node.ltag === 0 ? this.count(node.left) : 0;
    const r = node.rtag === 0 ? this.count(node.right) : 0;
    return 1 + l + r;
  },

  countLeaves(node) {
    if (!node) return 0;
    const hasL = node.left && node.ltag === 0;
    const hasR = node.right && node.rtag === 0;
    if (!hasL && !hasR) return 1;
    return (hasL ? this.countLeaves(node.left) : 0) + (hasR ? this.countLeaves(node.right) : 0);
  },

  countDegree(node, deg) {
    if (!node) return 0;
    let d = 0;
    const c = (node.left && node.ltag === 0 ? 1 : 0) + (node.right && node.rtag === 0 ? 1 : 0);
    if (c === deg) d = 1;
    const l = node.ltag === 0 ? this.countDegree(node.left, deg) : 0;
    const r = node.rtag === 0 ? this.countDegree(node.right, deg) : 0;
    return d + l + r;
  },

  isPerfect(node) {
    const h = this.height(node);
    return this.count(node) === Math.pow(2, h) - 1;
  },

  isComplete(node) {
    if (!node) return true;
    const queue = [node];
    let seenNull = false;
    while (queue.length) {
      const n = queue.shift();
      if (!n) { seenNull = true; continue; }
      if (seenNull) return false;
      queue.push(n.ltag === 0 ? n.left : null);
      queue.push(n.rtag === 0 ? n.right : null);
    }
    return true;
  },

  // 遍历
  preOrder(node, result = []) {
    if (!node) return result;
    result.push(node);
    if (node.ltag === 0) this.preOrder(node.left, result);
    if (node.rtag === 0) this.preOrder(node.right, result);
    return result;
  },
  inOrder(node, result = []) {
    if (!node) return result;
    if (node.ltag === 0) this.inOrder(node.left, result);
    result.push(node);
    if (node.rtag === 0) this.inOrder(node.right, result);
    return result;
  },
  postOrder(node, result = []) {
    if (!node) return result;
    if (node.ltag === 0) this.postOrder(node.left, result);
    if (node.rtag === 0) this.postOrder(node.right, result);
    result.push(node);
    return result;
  },
  levelOrder(node) {
    if (!node) return [];
    const result = [], queue = [node];
    while (queue.length) {
      const n = queue.shift();
      result.push(n);
      if (n.ltag === 0 && n.left) queue.push(n.left);
      if (n.rtag === 0 && n.right) queue.push(n.right);
    }
    return result;
  },
};

/* ============================================================
   BST 算法
   ============================================================ */
const BSTOps = {
  buildFromSeq(seq) {
    let root = null;
    seq.forEach(v => { root = this.insert(root, v); });
    return root;
  },
  insert(node, value, parent = null) {
    if (!node) {
      const n = makeNode(value);
      n.parent = parent;
      return n;
    }
    if (value < node.value) node.left = this.insert(node.left, value, node);
    else if (value > node.value) node.right = this.insert(node.right, value, node);
    return node;
  },
  search(node, value) {
    if (!node) return null;
    if (value === node.value) return node;
    return value < node.value ? this.search(node.left, value) : this.search(node.right, value);
  },
  findMin(node) {
    while (node && node.left) node = node.left;
    return node;
  },
  findMax(node) {
    while (node && node.right) node = node.right;
    return node;
  },
  delete(node, value) {
    if (!node) return null;
    if (value < node.value) node.left = this.delete(node.left, value);
    else if (value > node.value) node.right = this.delete(node.right, value);
    else {
      if (!node.left) return node.right;
      if (!node.right) return node.left;
      const succ = this.findMin(node.right);
      node.value = succ.value;
      node.right = this.delete(node.right, succ.value);
    }
    return node;
  },
  isBST(node, min = -Infinity, max = Infinity) {
    if (!node) return true;
    if (node.value <= min || node.value >= max) return false;
    return this.isBST(node.left, min, node.value) && this.isBST(node.right, node.value, max);
  },
};

/* ============================================================
   AVL 算法（严蔚敏/王道标准）
   BF = 左子树高 - 右子树高 ∈ {-1,0,1}
   ============================================================ */
const AVLOps = {
  buildFromSeq(seq) {
    let root = null;
    seq.forEach(v => {
      root = this.insert(root, v);
    });
    return root;
  },
  height(node) { return node ? node.height : 0; },
  updateHeight(node) {
    node.height = 1 + Math.max(this.height(node.left), this.height(node.right));
  },
  balanceFactor(node) {
    return node ? this.height(node.left) - this.height(node.right) : 0;
  },
  // 右旋（LL 型）
  rotateRight(y) {
    const x = y.left;
    const T2 = x.right;
    x.right = y;
    y.left = T2;
    if (T2) T2.parent = y;
    x.parent = y.parent;
    y.parent = x;
    this.updateHeight(y);
    this.updateHeight(x);
    return x;
  },
  // 左旋（RR 型）
  rotateLeft(x) {
    const y = x.right;
    const T2 = y.left;
    y.left = x;
    x.right = T2;
    if (T2) T2.parent = x;
    y.parent = x.parent;
    x.parent = y;
    this.updateHeight(x);
    this.updateHeight(y);
    return y;
  },
  insert(node, value) {
    if (!node) {
      const n = makeNode(value);
      n.height = 1;
      return n;
    }
    if (value < node.value) node.left = this.insert(node.left, value);
    else if (value > node.value) node.right = this.insert(node.right, value);
    else return node;
    if (node.left) node.left.parent = node;
    if (node.right) node.right.parent = node;

    this.updateHeight(node);
    const bf = this.balanceFactor(node);

    // LL
    if (bf > 1 && value < node.left.value) return this.rotateRight(node);
    // RR
    if (bf < -1 && value > node.right.value) return this.rotateLeft(node);
    // LR
    if (bf > 1 && value > node.left.value) {
      node.left = this.rotateLeft(node.left);
      return this.rotateRight(node);
    }
    // RL
    if (bf < -1 && value < node.right.value) {
      node.right = this.rotateRight(node.right);
      return this.rotateLeft(node);
    }
    return node;
  },
  isAVL(node) {
    if (!node) return { valid: true, reason: '' };
    const bf = this.balanceFactor(node);
    if (Math.abs(bf) > 1) return { valid: false, reason: `节点 ${node.value} 平衡因子 ${bf} 超出 [-1,1]` };
    if (!BSTOps.isBST(node)) return { valid: false, reason: `非合法 BST` };
    const l = this.isAVL(node.left);
    if (!l.valid) return l;
    const r = this.isAVL(node.right);
    return r;
  },
};

/* ============================================================
   红黑树算法（严蔚敏/算法导论标准）
   五大性质：
   ① 节点非红即黑
   ② 根为黑
   ③ 叶子(NIL)为黑
   ④ 红节点的孩子必黑
   ⑤ 任一节点到叶子所有路径黑高相同
   ============================================================ */
const RBOps = {
  buildFromSeq(seq) {
    let root = null;
    seq.forEach(v => { root = this.insert(root, v); });
    return root;
  },
  isRed(node) { return node && node.color === 'red'; }
  ,
  // 左旋
  rotateLeft(node, root) {
    const r = node.right;
    node.right = r.left;
    if (r.left) r.left.parent = node;
    r.parent = node.parent;
    if (!node.parent) root = r;
    else if (node === node.parent.left) node.parent.left = r;
    else node.parent.right = r;
    r.left = node;
    node.parent = r;
    return root;
  },
  // 右旋
  rotateRight(node, root) {
    const l = node.left;
    node.left = l.right;
    if (l.right) l.right.parent = node;
    l.parent = node.parent;
    if (!node.parent) root = l;
    else if (node === node.parent.right) node.parent.right = l;
    else node.parent.left = l;
    l.right = node;
    node.parent = l;
    return root;
  },
  insert(root, value) {
    const n = makeNode(value);
    n.color = 'red';
    n.left = n.right = n.parent = null;

    let y = null, x = root;
    while (x) {
      y = x;
      if (value < x.value) x = x.left;
      else if (value > x.value) x = x.right;
      else return root; // 重复
    }
    n.parent = y;
    if (!y) root = n;
    else if (value < y.value) y.left = n;
    else y.right = n;

    // 插入修复
    root = this.insertFixup(root, n);
    return root;
  },
  insertFixup(root, z) {
    while (z.parent && this.isRed(z.parent)) {
      let grandparent = z.parent.parent;
      if (z.parent === grandparent.left) {
        const uncle = grandparent.right;
        if (this.isRed(uncle)) {
          // Case 1: 叔红 → 变色上溯
          z.parent.color = 'black';
          uncle.color = 'black';
          grandparent.color = 'red';
          z = grandparent;
        } else {
          if (z === z.parent.right) {
            // Case 2: 叔黑，z 是右孩子 → 左旋父
            z = z.parent;
            root = this.rotateLeft(z, root);
          }
          // Case 3: 叔黑，z 是左孩子 → 变色 + 右旋祖父
          z.parent.color = 'black';
          z.parent.parent.color = 'red';
          root = this.rotateRight(z.parent.parent, root);
        }
      } else {
        const uncle = grandparent.left;
        if (this.isRed(uncle)) {
          z.parent.color = 'black';
          uncle.color = 'black';
          grandparent.color = 'red';
          z = grandparent;
        } else {
          if (z === z.parent.left) {
            z = z.parent;
            root = this.rotateRight(z, root);
          }
          z.parent.color = 'black';
          z.parent.parent.color = 'red';
          root = this.rotateLeft(z.parent.parent, root);
        }
      }
    }
    root.color = 'black';
    return root;
  },
  // 校验五大性质
  validate(node) {
    if (!node) return { valid: true, blackH: 1, reason: '' };
    // 性质①②在渲染时保证
    // 性质④：红节点的孩子必黑
    if (this.isRed(node)) {
      if ((node.left && this.isRed(node.left)) || (node.right && this.isRed(node.right))) {
        return { valid: false, blackH: 0, reason: `红节点 ${node.value} 有红孩子（违反性质④）` };
      }
    }
    const l = this.validate(node.left);
    if (!l.valid) return l;
    const r = this.validate(node.right);
    if (!r.valid) return r;
    // 性质⑤：左右黑高相同
    if (l.blackH !== r.blackH) {
      return { valid: false, blackH: 0, reason: `节点 ${node.value} 左右黑高不等（${l.blackH} vs ${r.blackH}）` };
    }
    return { valid: true, blackH: l.blackH + (node.color === 'black' ? 1 : 0), reason: '' };
  },
  isRBTree(root) {
    if (!root) return { valid: true, reason: '空树合法' };
    if (root.color !== 'black') return { valid: false, reason: '根节点非黑（违反性质②）' };
    const r = this.validate(root);
    return { valid: r.valid, reason: r.reason };
  },
};

/* ============================================================
   堆算法（大根/小根堆）
   数组下标从 1 开始
   ============================================================ */
const HeapOps = {
  buildFromSeq(seq, type = 'max') {
    const arr = [null, ...seq];  // 下标1开始
    // O(n) 建堆：从 ⌊n/2⌋ 开始向下调整
    const n = seq.length;
    for (let i = Math.floor(n / 2); i >= 1; i--) {
      this.shiftDown(arr, i, n, type);
    }
    return arr;
  },
  compare(a, b, type) {
    return type === 'max' ? a > b : a < b;
  },
  shiftUp(arr, i, type) {
    while (i > 1) {
      const parent = Math.floor(i / 2);
      if (this.compare(arr[i], arr[parent], type)) {
        [arr[i], arr[parent]] = [arr[parent], arr[i]];
        i = parent;
      } else break;
    }
  },
  shiftDown(arr, i, n, type) {
    while (2 * i <= n) {
      let child = 2 * i;
      if (child + 1 <= n && this.compare(arr[child + 1], arr[child], type)) child++;
      if (this.compare(arr[child], arr[i], type)) {
        [arr[i], arr[child]] = [arr[child], arr[i]];
        i = child;
      } else break;
    }
  },
  insert(arr, value, type) {
    arr.push(value);
    this.shiftUp(arr, arr.length - 1, type);
  },
  deleteRoot(arr, type) {
    if (arr.length <= 1) return null;
    const root = arr[1];
    const last = arr.pop();
    if (arr.length > 1) {
      arr[1] = last;
      this.shiftDown(arr, 1, arr.length - 1, type);
    }
    return root;
  },
  isValidHeap(arr, type) {
    const n = arr.length - 1;
    for (let i = 1; i <= Math.floor(n / 2); i++) {
      const l = 2 * i, r = 2 * i + 1;
      if (l <= n && !this.compare(arr[i], arr[l], type) && arr[i] !== arr[l]) {
        return { valid: false, reason: `节点 ${arr[i]}(${i}) 不满足与左孩子 ${arr[l]} 的堆序` };
      }
      if (r <= n && !this.compare(arr[i], arr[r], type) && arr[i] !== arr[r]) {
        return { valid: false, reason: `节点 ${arr[i]}(${i}) 不满足与右孩子 ${arr[r]} 的堆序` };
      }
    }
    return { valid: true, reason: '合法堆' };
  },
  // 将数组转为树节点结构用于渲染
  arrayToTree(arr) {
    if (arr.length <= 1) return null;
    const nodes = arr.slice(1).map(v => makeNode(v));
    for (let i = 0; i < nodes.length; i++) {
      const idx = i + 1; // 1-based
      if (2 * idx - 1 < nodes.length) nodes[i].left = nodes[2 * idx - 1];
      if (2 * idx < nodes.length) nodes[i].right = nodes[2 * idx];
    }
    return nodes[0];
  },
};

/* ============================================================
   线索二叉树算法（中序线索化）
   ltag/rtag: 0=孩子指针, 1=线索指针
   ============================================================ */
const ThreadedOps = {
  buildFromSeq(seq) {
    const root = BinaryTreeOps.buildFromSeq(seq);
    if (root) this.threadify(root);
    return root;
  },
  threadify(node) {
    let pre = null;
    const inOrder = (n) => {
      if (!n) return;
      inOrder(n.left);
      if (!n.left) { n.ltag = 1; n.left = pre; }
      if (pre && !pre.right) { pre.rtag = 1; pre.right = n; }
      pre = n;
      inOrder(n.right);
    };
    inOrder(node);
    // 最后一个节点的右线索指向 null
    if (pre) pre.rtag = 1;
  },
  // 中序线索遍历
  firstNode(node) {
    while (node && node.ltag === 0 && node.left) node = node.left;
    return node;
  },
  nextNode(node) {
    if (!node) return null;
    if (node.rtag === 1) return node.right;
    return this.firstNode(node.right);
  },
};

/* ============================================================
   B树算法（m 阶，严蔚敏标准）
   根: 1≤关键字≤m-1
   非根: ⌈m/2⌉-1 ≤ 关键字 ≤ m-1
   ============================================================ */
const BTreeOps = {
  order: 3,
  buildFromSeq(seq, order) {
    this.order = order;
    let root = null;
    seq.forEach(v => { root = this.insert(root, v); });
    return root;
  },
  minKeys(t) { return t === null ? 0 : (t.leaf ? Math.ceil(this.order / 2) - 1 : Math.ceil(this.order / 2) - 1); },
  maxKeys() { return this.order - 1; },

  createNode(leaf = false) {
    return {
      keys: [],
      children: [],
      leaf,
      x: 0, y: 0,
      id: ++State.idCounter,
      state: 'normal',
    };
  },
  search(node, key) {
    let i = 0;
    while (i < node.keys.length && key > node.keys[i]) i++;
    if (i < node.keys.length && key === node.keys[i]) return { node, idx: i };
    if (node.leaf) return null;
    return this.search(node.children[i], key);
  },
  insert(root, key) {
    if (!root) {
      root = this.createNode(true);
      root.keys.push(key);
      return root;
    }
    // 满则预分裂
    if (root.keys.length === this.order - 1) {
      const newRoot = this.createNode(false);
      newRoot.children.push(root);
      this.splitChild(newRoot, 0);
      this.insertNonFull(newRoot, key);
      return newRoot;
    }
    this.insertNonFull(root, key);
    return root;
  },
  splitChild(parent, i) {
    const t = Math.ceil(this.order / 2);
    const full = parent.children[i];
    const newNode = this.createNode(full.leaf);
    // 右半部分移到新节点
    newNode.keys = full.keys.slice(t);
    if (!full.leaf) {
      newNode.children = full.children.slice(t);
    }
    // 中间关键字上移到父节点
    const midKey = full.keys[t - 1];
    parent.keys.splice(i, 0, midKey);
    parent.children.splice(i + 1, 0, newNode);
    full.keys = full.keys.slice(0, t - 1);
    if (!full.leaf) full.children = full.children.slice(0, t);
  },
  insertNonFull(node, key) {
    let i = node.keys.length - 1;
    if (node.leaf) {
      node.keys.push(0);
      while (i >= 0 && key < node.keys[i]) {
        node.keys[i + 1] = node.keys[i];
        i--;
      }
      node.keys[i + 1] = key;
    } else {
      while (i >= 0 && key < node.keys[i]) i--;
      i++;
      if (node.children[i].keys.length === this.order - 1) {
        this.splitChild(node, i);
        if (key > node.keys[i]) i++;
      }
      this.insertNonFull(node.children[i], key);
    }
  },
  // 校验
  validate(node, isRoot = true, depth = 0) {
    if (!node) return { valid: true, reason: '' };
    const max = this.order - 1;
    const min = isRoot ? 1 : Math.ceil(this.order / 2) - 1;
    if (node.keys.length < min || node.keys.length > max) {
      return { valid: false, reason: `节点关键字数 ${node.keys.length} 超出范围 [${min}, ${max}]` };
    }
    // 关键字必须有序
    for (let i = 1; i < node.keys.length; i++) {
      if (node.keys[i] <= node.keys[i - 1]) {
        return { valid: false, reason: `关键字未严格递增` };
      }
    }
    // 非叶子节点 children = keys + 1
    if (!node.leaf && node.children.length !== node.keys.length + 1) {
      return { valid: false, reason: `非叶子节点孩子数 ≠ 关键字数+1` };
    }
    for (const child of node.children) {
      const r = this.validate(child, false, depth + 1);
      if (!r.valid) return r;
    }
    return { valid: true, reason: '合法B树' };
  },
};

/* ============================================================
   B+树算法（数据库索引标准）
   所有数据在叶子，叶子双向链表
   ============================================================ */
const BPlusOps = {
  order: 3,
  buildFromSeq(seq, order) {
    this.order = order;
    let root = null;
    seq.forEach(v => { root = this.insert(root, v); });
    return root;
  },
  createNode(leaf = false) {
    return {
      keys: [],
      children: [],
      leaf,
      next: null,  // 叶子链表后继
      prev: null,  // 叶子链表前驱
      x: 0, y: 0,
      id: ++State.idCounter,
      state: 'normal',
    };
  },
  insert(root, key) {
    if (!root) {
      root = this.createNode(true);
      root.keys.push(key);
      return root;
    }
    // 找到叶子
    let leaf = root;
    while (!leaf.leaf) {
      let i = 0;
      while (i < leaf.keys.length && key >= leaf.keys[i]) i++;
      leaf = leaf.children[i];
    }
    // 插入到叶子
    let pos = 0;
    while (pos < leaf.keys.length && leaf.keys[pos] < key) pos++;
    if (pos < leaf.keys.length && leaf.keys[pos] === key) return root; // 已存在
    leaf.keys.splice(pos, 0, key);
    // 检查是否需要分裂
    if (leaf.keys.length >= this.order) {
      return this.splitLeaf(root, leaf);
    }
    return root;
  },
  splitLeaf(root, leaf) {
    const t = Math.ceil(this.order / 2);
    const newLeaf = this.createNode(true);
    newLeaf.keys = leaf.keys.slice(t);
    leaf.keys = leaf.keys.slice(0, t);
    // 维护双向链表
    newLeaf.next = leaf.next;
    if (leaf.next) leaf.next.prev = newLeaf;
    leaf.next = newLeaf;
    newLeaf.prev = leaf;
    // 上移关键字（复制，非移动）
    const upKey = newLeaf.keys[0];
    if (leaf === root) {
      const newRoot = this.createNode(false);
      newRoot.keys.push(upKey);
      newRoot.children.push(leaf);
      newRoot.children.push(newLeaf);
      return newRoot;
    }
    return this.insertInParent(root, leaf, upKey, newLeaf);
  },
  insertInParent(root, left, key, right) {
    if (left === root) {
      const newRoot = this.createNode(false);
      newRoot.keys.push(key);
      newRoot.children.push(left);
      newRoot.children.push(right);
      return newRoot;
    }
    // 简化处理：递归上插（实际B+树实现需更复杂）
    const parent = this.findParent(root, left);
    if (!parent) return root;
    let pos = 0;
    while (pos < parent.keys.length && key >= parent.keys[pos]) pos++;
    parent.keys.splice(pos, 0, key);
    parent.children.splice(pos + 1, 0, right);
    if (parent.children.length > this.order) {
      // 索引节点分裂
      const t = Math.ceil((this.order + 1) / 2);
      const newIdx = this.createNode(false);
      newIdx.keys = parent.keys.slice(t);
      newIdx.children = parent.children.slice(t);
      const upKey = parent.keys[t - 1];
      parent.keys = parent.keys.slice(0, t - 1);
      parent.children = parent.children.slice(0, t);
      if (parent === root) {
        const newRoot = this.createNode(false);
        newRoot.keys.push(upKey);
        newRoot.children.push(parent);
        newRoot.children.push(newIdx);
        return newRoot;
      }
      return this.insertInParent(root, parent, upKey, newIdx);
    }
    return root;
  },
  findParent(root, node) {
    if (!root || root.leaf) return null;
    for (const child of root.children) {
      if (child === node) return root;
      const p = this.findParent(child, node);
      if (p) return p;
    }
    return null;
  },
  validate(node, isRoot = true) {
    if (!node) return { valid: true, reason: '' };
    const max = this.order - 1;
    const min = isRoot ? 1 : Math.ceil(this.order / 2) - 1;
    if (node.keys.length < min || node.keys.length > max) {
      return { valid: false, reason: `节点关键字数 ${node.keys.length} 超出范围 [${min}, ${max}]` };
    }
    if (node.leaf) return { valid: true, reason: '合法' };
    for (const child of node.children) {
      const r = this.validate(child, false);
      if (!r.valid) return r;
    }
    return { valid: true, reason: '合法B+树' };
  },
};

/* ============================================================
   B*树算法（利用率 ≥ 2/3）
   ============================================================ */
const BStarOps = {
  order: 3,
  buildFromSeq(seq, order) {
    this.order = order;
    let root = null;
    seq.forEach(v => { root = this.insert(root, v); });
    return root;
  },
  createNode(leaf = false) {
    return {
      keys: [],
      children: [],
      leaf,
      x: 0, y: 0,
      id: ++State.idCounter,
      state: 'normal',
    };
  },
  minKeys() { return Math.ceil(2 * this.order / 3) - 1; },
  maxKeys() { return this.order - 1; },
  insert(root, key) {
    if (!root) {
      root = this.createNode(true);
      root.keys.push(key);
      return root;
    }
    // 满则预分裂（与 B 树相同的 CLRS 框架，分裂比例按 2/3）
    if (root.keys.length === this.order - 1) {
      const newRoot = this.createNode(false);
      newRoot.children.push(root);
      this.splitChild(newRoot, 0);
      this.insertNonFull(newRoot, key);
      return newRoot;
    }
    this.insertNonFull(root, key);
    return root;
  },
  // B*树分裂：尽量按 2:1 比例分裂以满足 ≥2/3 利用率；阶数过小时回退均分
  splitChild(parent, i) {
    const full = parent.children[i];
    const m = full.keys.length;          // = order-1
    // 中间关键字索引：优先 ceil(2m/3)，但须落在 [0, m-1]
    let midIdx = Math.ceil(2 * m / 3);
    if (midIdx >= m) midIdx = Math.floor(m / 2);
    const newNode = this.createNode(full.leaf);
    newNode.keys = full.keys.slice(midIdx + 1);
    if (!full.leaf) newNode.children = full.children.slice(midIdx + 1);
    const midKey = full.keys[midIdx];
    parent.keys.splice(i, 0, midKey);
    parent.children.splice(i + 1, 0, newNode);
    full.keys = full.keys.slice(0, midIdx);
    if (!full.leaf) full.children = full.children.slice(0, midIdx + 1);
  },
  insertNonFull(node, key) {
    let i = node.keys.length - 1;
    if (node.leaf) {
      node.keys.push(0);
      while (i >= 0 && key < node.keys[i]) { node.keys[i + 1] = node.keys[i]; i--; }
      node.keys[i + 1] = key;
    } else {
      while (i >= 0 && key < node.keys[i]) i--;
      i++;
      if (node.children[i].keys.length === this.order - 1) {
        this.splitChild(node, i);
        if (key > node.keys[i]) i++;
      }
      this.insertNonFull(node.children[i], key);
    }
  },
  validate(node, isRoot = true) {
    if (!node) return { valid: true, reason: '' };
    const max = this.order - 1;
    const min = isRoot ? 1 : Math.ceil(2 * this.order / 3) - 1;
    if (node.keys.length < min || node.keys.length > max) {
      return { valid: false, reason: `B*树节点关键字数 ${node.keys.length} 不满足利用率≥2/3` };
    }
    for (const child of node.children) {
      const r = this.validate(child, false);
      if (!r.valid) return r;
    }
    return { valid: true, reason: '合法B*树' };
  },
};

/* ============================================================
   并查集算法
   ============================================================ */
const UnionFindOps = {
  init(elements) {
    const parent = {}, rank = {};
    elements.forEach(e => {
      parent[e] = e;
      rank[e] = 0;
    });
    return { parent, rank, elements };
  },
  find(uf, x, compress = true) {
    // 迭代实现 + 环路检测，避免错误演示（parent 成环）时栈溢出
    if (uf.parent[x] === x) return x;
    const path = [];
    let cur = x;
    const seen = new Set();
    while (uf.parent[cur] !== cur) {
      if (seen.has(cur)) {
        // 检测到环路（错误演示用），返回当前节点作为"根"以终止
        return cur;
      }
      seen.add(cur);
      path.push(cur);
      cur = uf.parent[cur];
    }
    if (compress) {
      path.forEach(n => { uf.parent[n] = cur; });
    }
    return cur;
  },
  union(uf, x, y, byRank = true) {
    const rx = this.find(uf, x);
    const ry = this.find(uf, y);
    if (rx === ry) return false;
    if (byRank) {
      if (uf.rank[rx] < uf.rank[ry]) uf.parent[rx] = ry;
      else if (uf.rank[rx] > uf.rank[ry]) uf.parent[ry] = rx;
      else { uf.parent[ry] = rx; uf.rank[rx]++; }
    } else {
      uf.parent[rx] = ry;
    }
    return true;
  },
  // 构建森林结构用于渲染
  buildForest(uf) {
    const trees = {};
    uf.elements.forEach(e => {
      const root = this.find(uf, e);
      if (!trees[root]) trees[root] = [];
      trees[root].push(e);
    });
    // 构建树结构
    const forest = [];
    Object.keys(trees).forEach(root => {
      const members = trees[root];
      const nodeMap = {};
      members.forEach(m => {
        nodeMap[m] = makeNode(m);
      });
      members.forEach(m => {
        const p = uf.parent[m];
        if (p !== m) {
          if (nodeMap[p]) {
            if (!nodeMap[p].left) nodeMap[p].left = nodeMap[m];
            else {
              // 右兄弟
              let sib = nodeMap[p].left;
              while (sib.right) sib = sib.right;
              sib.right = nodeMap[m];
            }
          }
        } else {
          forest.push(nodeMap[m]);
        }
      });
    });
    return forest;
  },
};

/* ============================================================
   渲染层 — SVG 绘制
   ============================================================ */
const Renderer = {
  svg: null,
  nodesLayer: null,
  edgesLayer: null,
  threadsLayer: null,
  labelsLayer: null,
  tooltipLayer: null,
  canvasGroup: null,

  init() {
    this.svg = document.getElementById('mainSvg');
    this.nodesLayer = document.getElementById('nodesLayer');
    this.edgesLayer = document.getElementById('edgesLayer');
    this.threadsLayer = document.getElementById('threadsLayer');
    this.labelsLayer = document.getElementById('labelsLayer');
    this.tooltipLayer = document.getElementById('tooltipLayer');
    this.canvasGroup = document.getElementById('canvasGroup');
    this.setupPanZoom();
  },

  setupPanZoom() {
    const svg = this.svg;
    let isPanning = false;
    let startX = 0, startY = 0;

    svg.addEventListener('mousedown', (e) => {
      if (e.target.tagName === 'circle' || e.target.tagName === 'text') return;
      isPanning = true;
      startX = e.clientX; startY = e.clientY;
    });
    svg.addEventListener('mousemove', (e) => {
      if (!isPanning) return;
      State.view.x += e.clientX - startX;
      State.view.y += e.clientY - startY;
      startX = e.clientX; startY = e.clientY;
      this.applyTransform();
    });
    svg.addEventListener('mouseup', () => isPanning = false);
    svg.addEventListener('mouseleave', () => isPanning = false);

    svg.addEventListener('wheel', (e) => {
      e.preventDefault();
      const delta = e.deltaY > 0 ? 0.9 : 1.1;
      State.view.scale = Math.max(0.2, Math.min(3, State.view.scale * delta));
      this.applyTransform();
    });
  },

  applyTransform() {
    this.canvasGroup.setAttribute('transform',
      `translate(${State.view.x},${State.view.y}) scale(${State.view.scale})`);
  },

  clear() {
    // 清理节点拖动监听器，避免内存泄漏
    this._cleanupNodeDragListeners();
    this.nodesLayer.innerHTML = '';
    this.edgesLayer.innerHTML = '';
    this.threadsLayer.innerHTML = '';
    this.labelsLayer.innerHTML = '';
    this.tooltipLayer.innerHTML = '';
  },

  /* 清理所有节点 <g> 上绑定的 window 级拖动监听器 */
  _cleanupNodeDragListeners() {
    const groups = this.nodesLayer.querySelectorAll('g[data-node-id]');
    groups.forEach(g => {
      if (g._dragCleanup) { g._dragCleanup(); g._dragCleanup = null; }
    });
  },

  // 计算二叉树布局（层次布局）
  layoutBinary(node, depth = 0, pos = { x: 0 }) {
    if (!node) return;

    // threaded 模式下 node.left/node.right 可能是线索（ltag/rtag=1），跳过线索避免死循环
    if (node.ltag === 0) this.layoutBinary(node.left, depth + 1, pos);

    node.x = pos.x * 60;
    node.y = depth * 70 + 40;
    pos.x++;

    if (node.rtag === 0) this.layoutBinary(node.right, depth + 1, pos);
  },

  // 渲染二叉树（通用）
  renderBinary(root, options = {}) {
    this.clear();
    if (!root) return;
    const pos = { x: 0 };
    this.layoutBinary(root, 0, pos);
    this.drawBinary(root, options);
  },

  drawBinary(node, options = {}) {
    if (!node) return;
    // 先画边
    if (node.left && node.ltag === 0) this.drawEdge(node, node.left, options);
    if (node.right && node.rtag === 0) this.drawEdge(node, node.right, options);
    // 线索边
    if (node.ltag === 1 && node.left) this.drawThread(node, node.left, 'left');
    if (node.rtag === 1 && node.right) this.drawThread(node, node.right, 'right');

    this.drawNode(node, options);
    if (node.left && node.ltag === 0) this.drawBinary(node.left, options);
    if (node.right && node.rtag === 0) this.drawBinary(node.right, options);
  },

  drawEdge(from, to, options) {
    const NS = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', from.x);
    line.setAttribute('y1', from.y);
    line.setAttribute('x2', to.x);
    line.setAttribute('y2', to.y);
    const cls = [
      'edge-line',
      (to.state === 'visited' || from.state === 'visited') ? 'active' : ''
    ].filter(Boolean).join(' ');
    line.setAttribute('class', cls);
    // inline 边色（多树淡色）
    const palette = options && options.palette;
    if (palette && palette.stroke) line.style.stroke = palette.stroke;
    this.edgesLayer.appendChild(line);
  },

  drawThread(from, to, side) {
    const NS = 'http://www.w3.org/2000/svg';
    const path = document.createElementNS(NS, 'path');
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    // 曲线
    const cx = (from.x + to.x) / 2 + (side === 'left' ? -30 : 30);
    const cy = (from.y + to.y) / 2;
    path.setAttribute('d', `M ${from.x} ${from.y} Q ${cx} ${cy} ${to.x} ${to.y}`);
    path.setAttribute('class', 'thread-line');
    this.threadsLayer.appendChild(path);
  },

  drawNode(node, options = {}) {
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${node.x},${node.y})`);
    g.setAttribute('data-node-id', node.id);
    // 错误示例节点：加 error-node 类（红色高亮）
    if (options.isError || node._isErrorNode) g.setAttribute('class', 'node-group error-node');
    else g.setAttribute('class', 'node-group');

    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('r', '18');
    let cls = 'node-circle';
    if (node.state === 'selected') cls += ' selected';
    else if (node.state === 'visited') cls += ' visited';
    else if (node.state === 'comparing') cls += ' comparing';
    else if (node.state === 'swapping') cls += ' swapping';
    else if (node.state === 'invalid') cls += ' invalid';

    // 红黑树颜色（优先级最高，覆盖淡色）
    if (options.redBlack && node.color === 'red') cls = 'node-circle rb-red';
    if (options.redBlack && node.color === 'black') cls = 'node-circle rb-black';

    circle.setAttribute('class', cls);
    circle.setAttribute('data-id', node.id);

    // 淡色填充（多树并存 / 单树着色）：使用 inline style 覆盖默认 fill
    // 红黑树保留其专属配色，不覆盖
    const colorKey = options.colorKey;
    if (!options.redBlack && colorKey) {
      const palette = options.palette || (TREE_COLORS[colorKey] || {});
      if (palette.fill)   circle.style.fill = palette.fill;
      if (palette.stroke) circle.style.stroke = palette.stroke;
    }

    const text = document.createElementNS(NS, 'text');
    text.setAttribute('class', 'node-text' + ((node.state !== 'normal' || (options.redBlack && node.color === 'red')) ? ' on-color' : ''));
    text.textContent = node.value;

    g.appendChild(circle);
    g.appendChild(text);

    // AVL 平衡因子
    if (options.showBF) {
      const bf = AVLOps.balanceFactor(node);
      const bfText = document.createElementNS(NS, 'text');
      bfText.setAttribute('class', 'node-bf-text');
      bfText.setAttribute('x', '0');
      bfText.setAttribute('y', '-26');
      bfText.textContent = `BF=${bf}`;
      g.appendChild(bfText);
    }

    this.nodesLayer.appendChild(g);

    // 悬浮提示
    const tipNS = 'http://www.w3.org/2000/svg';
    const tipRect = document.createElementNS(tipNS, 'rect');
    const tipText = document.createElementNS(tipNS, 'text');
    tipRect.setAttribute('rx', '4');
    tipRect.setAttribute('ry', '4');
    tipRect.setAttribute('fill', 'rgba(0,0,0,0.75)');
    tipRect.setAttribute('width', '0');
    tipRect.setAttribute('height', '0');
    tipText.setAttribute('fill', '#fff');
    tipText.setAttribute('font-size', '11');
    tipText.setAttribute('font-family', 'JetBrains Mono, Consolas, monospace');
    tipText.setAttribute('text-anchor', 'middle');
    tipText.setAttribute('y', '4');
    tipText.textContent = '';
    g.appendChild(tipRect);
    g.appendChild(tipText);
    g.style.cursor = 'pointer';
    g.addEventListener('mouseenter', () => {
      const label = options.treeLabel
        ? `${options.treeLabel}：${node.value}`
        : `节点 ${node.value}`;
      tipText.textContent = label;
      const tw = label.length * 7.5 + 8;
      tipRect.setAttribute('width', tw);
      tipRect.setAttribute('height', '16');
      tipRect.setAttribute('x', -tw / 2);
      tipRect.setAttribute('y', '-34');
      tipText.setAttribute('x', '0');
      tipText.setAttribute('y', '-22');
    });
    g.addEventListener('mouseleave', () => {
      tipRect.setAttribute('width', '0');
      tipRect.setAttribute('height', '0');
      tipText.textContent = '';
    });

    // 点击选中
    g.addEventListener('click', (e) => {
      if (this._dragMoved) return; // 拖动后的 click 不触发选中
      e.stopPropagation();
      Interaction.selectNode(node);
    });
    // 双击修改
    g.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      Interaction.editNode(node);
    });

    // —— 节点拖动 / 整树拖动 ——
    this._bindNodeDrag(g, node, circle, options);
  },

  /* 绑定节点拖动：左键拖动=移动节点；Shift+左键拖动=移动整棵子树 */
  _bindNodeDrag(g, node, circle, options) {
    let dragging = false;
    let moved = false;
    let startX = 0, startY = 0;
    let origNodeX = 0, origNodeY = 0;
    let shiftKey = false;
    // 整树拖动时记录所有受影响节点的原始坐标
    let affectedNodes = [];

    const collectSubtree = (n, acc) => {
      if (!n) return;
      acc.push(n);
      if (n.ltag === 0) collectSubtree(n.left, acc);
      if (n.rtag === 0) collectSubtree(n.right, acc);
    };

    g.addEventListener('mousedown', (e) => {
      // 右键不触发拖动（保留给浏览器菜单）
      if (e.button !== 0) return;
      dragging = true;
      moved = false;
      this._dragMoved = false;
      startX = e.clientX;
      startY = e.clientY;
      origNodeX = node.x;
      origNodeY = node.y;
      shiftKey = e.shiftKey;
      affectedNodes = [];
      if (shiftKey) {
        // 整树拖动：收集子树所有节点
        collectSubtree(node, affectedNodes);
        affectedNodes.forEach(n => { n._dragOrigX = n.x; n._dragOrigY = n.y; });
      }
      circle.classList.add('dragging');
      e.stopPropagation();
      e.preventDefault();
    });

    const onMove = (e) => {
      if (!dragging) return;
      const dx = (e.clientX - startX) / State.view.scale;
      const dy = (e.clientY - startY) / State.view.scale;
      if (!moved && Math.hypot(e.clientX - startX, e.clientY - startY) > 3) {
        moved = true;
        this._dragMoved = true;
      }
      if (!moved) return;

      if (shiftKey) {
        // 整树平移：更新所有受影响节点坐标 + 对应 <g> transform
        affectedNodes.forEach(n => {
          n.x = n._dragOrigX + dx;
          n.y = n._dragOrigY + dy;
          const ng = this.nodesLayer.querySelector(`g[data-node-id="${n.id}"]`);
          if (ng) ng.setAttribute('transform', `translate(${n.x},${n.y})`);
        });
        // 重画所有边（边坐标依赖节点）
        this._redrawEdgesOnly(options);
      } else {
        // 单节点平移：仅更新当前 <g> transform + 相关边
        node.x = origNodeX + dx;
        node.y = origNodeY + dy;
        g.setAttribute('transform', `translate(${node.x},${node.y})`);
        this._redrawEdgesOnly(options);
      }
    };

    const onUp = (e) => {
      if (!dragging) return;
      dragging = false;
      circle.classList.remove('dragging');
      if (moved) {
        log(shiftKey
          ? `整树平移 Δ(${Math.round(node.x - origNodeX)},${Math.round(node.y - origNodeY)})`
          : `节点 ${node.value} 移动到 (${Math.round(node.x)},${Math.round(node.y)})`, 'info');
      }
      // 清理临时字段
      affectedNodes.forEach(n => { delete n._dragOrigX; delete n._dragOrigY; });
      // 延迟清除 _dragMoved 标志，避免 click 立即触发
      setTimeout(() => { this._dragMoved = false; }, 0);
    };

    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
    // 注意：listener 会随每次 drawNode 调用而累积；为避免泄漏，在 g 上保存并支持清理
    g._dragCleanup = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
  },

  /* 仅重画边（拖动时调用，不触碰节点层，避免中断拖动） */
  _redrawEdgesOnly(options) {
    this.edgesLayer.innerHTML = '';
    this.threadsLayer.innerHTML = '';
    // 重新绘制所有边：遍历当前所有树
    const drawEdgesForRoot = (root) => {
      if (!root) return;
      if (root.left && root.ltag === 0) this.drawEdge(root, root.left, options);
      if (root.right && root.rtag === 0) this.drawEdge(root, root.right, options);
      if (root.ltag === 1 && root.left) this.drawThread(root, root.left, 'left');
      if (root.rtag === 1 && root.right) this.drawThread(root, root.right, 'right');
      if (root.left && root.ltag === 0) drawEdgesForRoot(root.left);
      if (root.right && root.rtag === 0) drawEdgesForRoot(root.right);
    };

    if (State.trees && State.trees.length) {
      State.trees.forEach((item, treeIdx) => {
        if (!item) return;
        const treeType = item.type;
        if (treeType === 'btree' || treeType === 'bplustree' || treeType === 'bstar') return;
        const palette = MULTI_TREE_PALETTE[treeIdx % MULTI_TREE_PALETTE.length];
        const opts = { colorKey: treeType, palette };
        if (treeType === 'disjoint') {
          const forest = item.unionFind ? UnionFindOps.buildForest(item.unionFind) : [];
          forest.forEach(r => drawEdgesForRoot(r));
        } else if (treeType === 'forest') {
          const roots = Array.isArray(item.tree) ? item.tree : (item.tree ? [item.tree] : []);
          roots.forEach(r => drawEdgesForRoot(r));
        } else {
          drawEdgesForRoot(item.tree);
        }
      });
    } else {
      const type = State.currentType;
      const palette = TREE_COLORS[type] || {};
      const opts = { colorKey: type, palette };
      if (type === 'disjoint') {
        const forest = State.unionFind ? UnionFindOps.buildForest(State.unionFind) : [];
        forest.forEach(r => drawEdgesForRoot(r));
      } else if (type === 'forest') {
        const roots = Array.isArray(State.tree) ? State.tree : (State.tree ? [State.tree] : []);
        roots.forEach(r => drawEdgesForRoot(r));
      } else if (type === 'btree' || type === 'bplustree' || type === 'bstar') {
        // B树边在 drawBTree 内绘制，拖动暂不支持 B树
      } else {
        drawEdgesForRoot(State.tree);
      }
    }
  },

  // 渲染B树（矩形节点）
  renderBTree(root, options = {}) {
    this.clear();
    if (!root) return;
    const layout = this.layoutBTree(root, 0, { x: 0 });
    this.drawBTree(root, options);
  },

  layoutBTree(node, depth, pos) {
    if (!node) return;
    const width = Math.max(40, (node.keys ? node.keys.length : 0) * 30 + 10);
    const children = node.children || [];
    if (node.leaf || children.length === 0) {
      node.x = pos.x;
      node.y = depth * 80 + 40;
      pos.x += width + 10;
    } else {
      children.forEach(c => this.layoutBTree(c, depth + 1, pos));
      node.x = (children[0].x + children[children.length - 1].x) / 2;
      node.y = depth * 80 + 40;
    }
  },

  drawBTree(node, options = {}) {
    if (!node) return;
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    const keys = node.keys || [];
    const w = Math.max(40, keys.length * 30 + 10);
    const h = 34;
    g.setAttribute('transform', `translate(${node.x - w / 2},${node.y - h / 2})`);

    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('class', 'btree-node-bg' + (node.state === 'visited' ? ' visited' : ''));
    // 错误演示节点用淡色填充
    const palette = options && options.palette;
    if (palette && palette.fill) rect.style.fill = palette.fill;
    if (palette && palette.stroke) rect.style.stroke = palette.stroke;
    g.appendChild(rect);

    // 分隔线 + 关键字
    keys.forEach((k, i) => {
      const cell = document.createElementNS(NS, 'rect');
      cell.setAttribute('x', i * 30 + 5);
      cell.setAttribute('y', 2);
      cell.setAttribute('width', 25);
      cell.setAttribute('height', h - 4);
      cell.setAttribute('class', 'btree-key-cell' + (node.state === 'visited' ? ' visited' : ''));
      g.appendChild(cell);

      const text = document.createElementNS(NS, 'text');
      text.setAttribute('x', i * 30 + 17.5);
      text.setAttribute('y', h / 2);
      text.setAttribute('class', 'btree-key-text');
      text.textContent = k;
      g.appendChild(text);
    });

    this.nodesLayer.appendChild(g);

    // 连接子节点
    const children = node.children || [];
    if (!node.leaf && children.length) {
      children.forEach((child, i) => {
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', node.x);
        line.setAttribute('y1', node.y + h / 2);
        line.setAttribute('x2', child.x);
        line.setAttribute('y2', child.y - h / 2);
        line.setAttribute('class', 'edge-line');
        if (palette && palette.stroke) line.style.stroke = palette.stroke;
        this.edgesLayer.appendChild(line);
        this.drawBTree(child, options);
      });
    }
  },

  // 渲染森林（并查集）
  renderForest(forest, options = {}) {
    this.clear();
    if (!forest || !forest.length) return;
    let xOffset = 0;
    forest.forEach((root, i) => {
      const pos = { x: xOffset };
      this.layoutBinary(root, 0, pos);
      xOffset = pos.x + 1;
      this.drawBinary(root, options);
    });
  },

  // 渲染堆（树+数组联动）
  renderHeap(arr, options = {}) {
    this.clear();
    const root = HeapOps.arrayToTree(arr);
    if (!root) return;
    // 居中布局
    const pos = { x: 0 };
    this.layoutBinary(root, 0, pos);
    this.drawBinary(root, options);
    // 数组视图作为标签
    this.drawArrayView(arr, options);
  },

  drawArrayView(arr, options = {}) {
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    const startX = 20, startY = 380;
    const cellSize = 28;
    g.setAttribute('transform', `translate(${startX},${startY})`);

    const label = document.createElementNS(NS, 'text');
    label.setAttribute('x', '0');
    label.setAttribute('y', '-8');
    label.setAttribute('fill', 'var(--color-text-muted)');
    label.setAttribute('font-size', '11');
    label.textContent = '数组视图:';
    g.appendChild(label);

    arr.forEach((v, i) => {
      if (i === 0) {
        const t = document.createElementNS(NS, 'text');
        t.setAttribute('x', '0');
        t.setAttribute('y', '14');
        t.setAttribute('font-size', '10');
        t.setAttribute('fill', 'var(--color-text-muted)');
        t.textContent = '[0]';
        g.appendChild(t);
        return;
      }
      const rect = document.createElementNS(NS, 'rect');
      rect.setAttribute('x', (i - 1) * cellSize);
      rect.setAttribute('y', 0);
      rect.setAttribute('width', cellSize - 2);
      rect.setAttribute('height', cellSize - 2);
      rect.setAttribute('class', 'btree-key-cell');
      g.appendChild(rect);

      const text = document.createElementNS(NS, 'text');
      text.setAttribute('x', (i - 1) * cellSize + 13);
      text.setAttribute('y', 17);
      text.setAttribute('class', 'btree-key-text');
      text.textContent = v;
      g.appendChild(text);

      const idx = document.createElementNS(NS, 'text');
      idx.setAttribute('x', (i - 1) * cellSize + 13);
      idx.setAttribute('y', -2);
      idx.setAttribute('font-size', '9');
      idx.setAttribute('fill', 'var(--color-text-muted)');
      idx.textContent = i;
      g.appendChild(idx);
    });

    this.labelsLayer.appendChild(g);
  },

  // 多树并存渲染：并排展示；每棵树使用不同淡色透明色区分
  renderMultiTrees(trees) {
    this.clear();
    if (!trees || !trees.length) return;

    const groupW = 360;
    const groupGap = 60;

    const traverseChildren = (n, fn) => {
      if (!n) return;
      fn(n);
      if (n.ltag === 0) traverseChildren(n.left, fn);
      if (n.rtag === 0) traverseChildren(n.right, fn);
    };

    const layoutAndMark = (root, dx, dy, treeIdx, treeType) => {
      this.layoutBinary(root, 0, { x: 0 });
      traverseChildren(root, (n) => {
        n.x += dx;
        n.y += dy;
        n._treeIdx = treeIdx;
        n._treeType = treeType;
      });
    };

    trees.forEach((item, treeIdx) => {
      if (!item) return;
      const treeType = item.type;
      const isError = !!item.isError;

      // B树系列：暂不参与多树并存绘制（避免清屏式覆盖）
      if (treeType === 'btree' || treeType === 'bplustree' || treeType === 'bstar') return;

      const dx = 20 + treeIdx * (groupW + groupGap);
      const dy = 20;
      const label = isError ? `✗ ${KNOWLEDGE[treeType]?.name || treeType}（错误）` : (KNOWLEDGE[treeType]?.name || treeType);
      // 错误树用红色系，正常树用多树淡色
      const palette = isError
        ? { stroke: '#f05252', fill: 'rgba(240,82,82,0.15)' }
        : MULTI_TREE_PALETTE[treeIdx % MULTI_TREE_PALETTE.length];

      if (treeType === 'disjoint') {
        const forest = item.unionFind ? UnionFindOps.buildForest(item.unionFind) : [];
        forest.forEach((r, j) => {
          if (!r) return;
          layoutAndMark(r, dx + j * 180, dy, treeIdx, treeType);
          const opts = { colorKey: treeType, palette, treeLabel: label, isError };
          this.drawBinary(r, opts);
        });
        this._drawTreeLabel(label, dx, dy - 8, palette, treeIdx, isError);
        return;
      }

      if (treeType === 'forest') {
        const roots = Array.isArray(item.tree) ? item.tree : (item.tree ? [item.tree] : []);
        roots.forEach((r, j) => {
          layoutAndMark(r, dx + j * 180, dy, treeIdx, treeType);
          const opts = { colorKey: treeType, palette, treeLabel: label, isError };
          this.drawBinary(r, opts);
        });
        this._drawTreeLabel(label, dx, dy - 8, palette, treeIdx, isError);
        return;
      }

      const root = item.tree;
      if (!root) return;
      layoutAndMark(root, dx, dy, treeIdx, treeType);
      const opts = { colorKey: treeType, palette, treeLabel: label, isError };
      if (treeType === 'avl') opts.showBF = true;
      if (treeType === 'rbtree') opts.redBlack = true;
      if (treeType === 'threaded') opts.threaded = true;
      this.drawBinary(root, opts);
      // 树标签
      this._drawTreeLabel(label, dx, dy - 8, palette, treeIdx, isError);
    });

    // 自动居中
    const totalW = trees.length * (groupW + groupGap) - groupGap + 40;
    State.view.x = Math.max(0, -(totalW / 2 - this.svg.clientWidth / 2));
    State.view.y = 0;
    State.view.scale = 1;
    this.applyTransform();

    // 渲染完成后，为所有错误树补画错误标注
    trees.forEach((item, treeIdx) => {
      if (item && item.isError && item.errorMsg) {
        this._drawErrorAnnotation(treeIdx, item.errorMsg);
      }
    });
  },

  /* 绘制多树并存时的树标签（带淡色背景药丸，可拖拽移动整棵树） */
  _drawTreeLabel(text, x, y, palette, treeIdx, isError) {
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${x},${y})`);
    g.setAttribute('class', 'tree-legend-group' + (isError ? ' error-legend' : ''));
    g.setAttribute('data-tree-idx', treeIdx);
    g.style.cursor = 'move';
    // 背景药丸：用 getBBox 精确测量后回填，先用估算值
    // 中文字符约 13px，英文约 8px，取加权平均
    const cjkCount = (text.match(/[\u4e00-\u9fff]/g) || []).length;
    const otherCount = text.length - cjkCount;
    const tw = cjkCount * 14 + otherCount * 8 + 24;
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('x', -6);
    rect.setAttribute('y', -14);
    rect.setAttribute('width', tw);
    rect.setAttribute('height', 22);
    rect.setAttribute('rx', 11);
    rect.setAttribute('ry', 11);
    rect.setAttribute('fill', palette.fill);
    rect.setAttribute('stroke', palette.stroke);
    rect.setAttribute('stroke-width', 1.2);
    g.appendChild(rect);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('class', 'multi-tree-label');
    t.setAttribute('x', tw / 2 - 6);
    t.setAttribute('y', 0);
    t.setAttribute('text-anchor', 'middle');
    t.setAttribute('dominant-baseline', 'central');
    t.setAttribute('fill', palette.stroke);
    t.textContent = text;
    g.appendChild(t);
    // 绑定拖拽：按住图例移动整棵树
    this._bindLegendDrag(g, treeIdx);
    this.labelsLayer.appendChild(g);
    // 入列后用 getBBox 精确回填宽度，确保背景框完全覆盖文字
    try {
      const bbox = t.getBBox();
      const padX = 10, padY = 4;
      rect.setAttribute('x', bbox.x - padX);
      rect.setAttribute('y', bbox.y - padY);
      rect.setAttribute('width', bbox.width + padX * 2);
      rect.setAttribute('height', bbox.height + padY * 2);
      rect.setAttribute('rx', (bbox.height + padY * 2) / 2);
      rect.setAttribute('ry', (bbox.height + padY * 2) / 2);
      t.setAttribute('x', bbox.x + bbox.width / 2);
    } catch (e) { /* getBBox 在未渲染时可能失败，保留估算值 */ }
  },

  /* 绑定图例拖拽：拖动图例平移整棵树（含所有节点、边、图例自身） */
  _bindLegendDrag(g, treeIdx) {
    let dragging = false, startMouse = null, startNodePositions = null, startLegendX = 0, startLegendY = 0;
    const onDown = (e) => {
      // 仅响应主键
      if (e.button !== 0) return;
      e.stopPropagation();
      dragging = true;
      const pt = this._svgPoint(e.clientX, e.clientY);
      startMouse = { x: pt.x, y: pt.y };
      // 记入当前 view 缩放
      startMouse.x /= State.view.scale || 1;
      startMouse.y /= State.view.scale || 1;
      const tr = g.getAttribute('transform').match(/translate\(([-\d.]+),([-\d.]+)\)/);
      startLegendX = parseFloat(tr[1]); startLegendY = parseFloat(tr[2]);
      // 收集该树所有节点的起始坐标
      startNodePositions = new Map();
      const item = State.trees && State.trees[treeIdx];
      if (!item) return;
      const collect = (n) => {
        if (!n) return;
        startNodePositions.set(n, { x: n.x, y: n.y });
        if (n.ltag === 0) collect(n.left);
        if (n.rtag === 0) collect(n.right);
      };
      if (item.type === 'disjoint' && item.unionFind) {
        UnionFindOps.buildForest(item.unionFind).forEach(r => collect(r));
      } else if (item.type === 'forest') {
        const roots = Array.isArray(item.tree) ? item.tree : (item.tree ? [item.tree] : []);
        roots.forEach(r => collect(r));
      } else {
        collect(item.tree);
      }
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup', onUp);
    };
    const onMove = (e) => {
      if (!dragging) return;
      const pt = this._svgPoint(e.clientX, e.clientY);
      pt.x /= State.view.scale || 1; pt.y /= State.view.scale || 1;
      const dx = pt.x - startMouse.x, dy = pt.y - startMouse.y;
      // 更新所有节点坐标
      for (const [n, p] of startNodePositions) {
        n.x = p.x + dx; n.y = p.y + dy;
      }
      // 移动图例自身
      g.setAttribute('transform', `translate(${startLegendX + dx},${startLegendY + dy})`);
      // 重画（只重绘边和节点，不重新 layout）
      this._redrawAfterTreeMove();
    };
    const onUp = () => {
      dragging = false;
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    g.addEventListener('mousedown', onDown);
  },

  /* 树被拖动后，仅重绘边和节点（不重新 layout，保留新坐标） */
  _redrawAfterTreeMove() {
    // 清空边和节点层，保留 labelsLayer（图例自身已手动移动）
    this.edgesLayer.innerHTML = '';
    this.nodesLayer.innerHTML = '';
    this.threadsLayer.innerHTML = '';
    // 重新绘制所有树（用节点当前坐标，不调 layoutBinary）
    const trees = State.trees;
    if (!trees || !trees.length) return;
    trees.forEach((item, treeIdx) => {
      if (!item) return;
      const treeType = item.type;
      if (treeType === 'btree' || treeType === 'bplustree' || treeType === 'bstar') return;
      const isError = !!item.isError;
      const palette = isError
        ? { stroke: '#f05252', fill: 'rgba(240,82,82,0.15)' }
        : MULTI_TREE_PALETTE[treeIdx % MULTI_TREE_PALETTE.length];
      const label = isError ? `✗ ${KNOWLEDGE[treeType]?.name || treeType}（错误）` : (KNOWLEDGE[treeType]?.name || treeType);
      const opts = { colorKey: treeType, palette, treeLabel: label, isError };
      if (treeType === 'avl') opts.showBF = true;
      if (treeType === 'rbtree') opts.redBlack = true;
      if (treeType === 'threaded') opts.threaded = true;
      if (treeType === 'disjoint') {
        const forest = item.unionFind ? UnionFindOps.buildForest(item.unionFind) : [];
        forest.forEach(r => { if (r) this.drawBinary(r, opts); });
      } else if (treeType === 'forest') {
        const roots = Array.isArray(item.tree) ? item.tree : (item.tree ? [item.tree] : []);
        roots.forEach(r => { if (r) this.drawBinary(r, opts); });
      } else {
        if (item.tree) this.drawBinary(item.tree, opts);
      }
    });
  },

  /* 将屏幕坐标转换为 SVG 内容坐标（考虑 view transform） */
  _svgPoint(clientX, clientY) {
    const pt = this.svg.createSVGPoint();
    pt.x = clientX; pt.y = clientY;
    const ctm = this.svg.getScreenCTM();
    if (ctm) {
      const inv = ctm.inverse();
      const p = pt.matrixTransform(inv);
      return { x: p.x - State.view.x, y: p.y - State.view.y };
    }
    return { x: clientX, y: clientY };
  },

  /* 在画布上绘制错误说明标注（红色文字 + 淡红背景） */
  _drawErrorAnnotation(treeIdx, msg) {
    const NS = 'http://www.w3.org/2000/svg';
    const item = State.trees[treeIdx];
    if (!item) return;
    // 找到该树的边界（取所有节点坐标的最小 y 作为标注位置）
    let minX = Infinity, minY = Infinity, maxX = -Infinity;
    const collect = (n) => {
      if (!n) return;
      if (n.x < minX) minX = n.x;
      if (n.x > maxX) maxX = n.x;
      if (n.y < minY) minY = n.y;
      if (n.ltag === 0) collect(n.left);
      if (n.rtag === 0) collect(n.right);
    };
    if (Array.isArray(item.tree)) item.tree.forEach(r => collect(r));
    else collect(item.tree);
    if (minX === Infinity) return;

    const g = document.createElementNS(NS, 'g');
    g.setAttribute('class', 'error-annotation-group');
    g.setAttribute('data-tree-idx', treeIdx);
    const ax = minX;
    const ay = minY - 28; // 标注在树上方

    // 截断过长消息
    const text = msg.length > 40 ? msg.slice(0, 38) + '…' : msg;
    const tw = text.length * 7 + 12;
    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('class', 'error-annotation-bg');
    rect.setAttribute('x', ax - 4);
    rect.setAttribute('y', ay - 10);
    rect.setAttribute('width', tw);
    rect.setAttribute('height', 18);
    rect.setAttribute('rx', 4);
    rect.setAttribute('ry', 4);
    g.appendChild(rect);

    const t = document.createElementNS(NS, 'text');
    t.setAttribute('class', 'error-annotation');
    t.setAttribute('x', ax + 2);
    t.setAttribute('y', ay + 2);
    t.setAttribute('dominant-baseline', 'central');
    t.textContent = '✗ ' + text;
    g.appendChild(t);

    this.labelsLayer.appendChild(g);
  },

  // 主渲染入口
  render() {
    // 多树并存渲染
    if (State.trees && State.trees.length) {
      this.renderMultiTrees(State.trees);
      return;
    }

    const type = State.currentType;
    const tree = State.tree;
    const palette = TREE_COLORS[type] || {};
    const colorKey = type;
    if (type === 'btree') {
      this.renderBTree(tree, { colorKey, palette });
    } else if (type === 'bplustree' || type === 'bstar') {
      this.renderBTree(tree, { colorKey, palette });
    } else if (type === 'heap') {
      this.renderHeap(State.heapArr || [null], { colorKey, palette });
    } else if (type === 'disjoint') {
      this.renderForest(State.unionFind ? UnionFindOps.buildForest(State.unionFind) : [], { colorKey, palette });
    } else if (type === 'forest') {
      this.renderForest(Array.isArray(tree) ? tree : (tree ? [tree] : []), { colorKey, palette });
    } else if (type === 'avl') {
      this.renderBinary(tree, { showBF: true, colorKey, palette });
    } else if (type === 'rbtree') {
      this.renderBinary(tree, { redBlack: true, colorKey, palette });
    } else if (type === 'threaded') {
      this.renderBinary(tree, { threaded: true, colorKey, palette });
    } else {
      this.renderBinary(tree, { colorKey, palette });
    }
  },
};

/* ============================================================
   交互层
   ============================================================ */
const Interaction = {
  selectNode(node) {
    if (State.selectedNode) State.selectedNode.state = 'normal';
    State.selectedNode = node;
    node.state = 'selected';

    // 多树：根据节点所属组选择对应树
    if (typeof node._treeIdx === 'number') {
      State.selectedTreeIdx = node._treeIdx;
    }

    Renderer.render();
    log(`选中节点 ${node.value}`, 'action');
  },

  editNode(node) {
    // 使用非模态浮动弹窗替代 prompt()
    FloatingDialog.open({
      title: '编辑节点',
      label: '新数值',
      value: node.value,
      hint: `当前节点值 ${node.value}，输入新值后回车或点确定。弹窗可拖动，不阻塞操作。`,
      onConfirm: (val) => {
        const num = parseInt(val);
        if (isNaN(num)) { log('输入非法！', 'error'); return false; }
        log(`修改节点 ${node.value} → ${num}`, 'action');
        node.value = num;
        rebuildTree();
        Renderer.render();
        updateStatus();
        return true;
      },
    });
  },
};

/* ============================================================
   非模态浮动弹窗（FloatingDialog）
   - 不阻塞主线程，可同时操作画布
   - 可拖动（按住标题栏移动）
   - Esc 关闭，Enter 确认
   ============================================================ */
const FloatingDialog = {
  el: null,
  input: null,
  confirmCb: null,

  init() {
    this.el = document.getElementById('floatingDialog');
    this.input = document.getElementById('fdInput');
    if (!this.el || !this.input) return;

    const header = document.getElementById('fdHeader');
    const closeBtn = document.getElementById('fdClose');
    const cancelBtn = document.getElementById('fdCancel');
    const confirmBtn = document.getElementById('fdConfirm');

    // 关闭
    const close = () => this.close();
    closeBtn.addEventListener('click', close);
    cancelBtn.addEventListener('click', close);

    // 确认
    confirmBtn.addEventListener('click', () => this._confirm());

    // 输入框键盘事件
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') { e.preventDefault(); this._confirm(); }
      else if (e.key === 'Escape') { e.preventDefault(); close(); }
    });

    // 拖动弹窗
    let dragging = false, sx = 0, sy = 0, ox = 0, oy = 0;
    header.addEventListener('mousedown', (e) => {
      dragging = true;
      sx = e.clientX; sy = e.clientY;
      const rect = this.el.getBoundingClientRect();
      ox = rect.left; oy = rect.top;
      e.preventDefault();
    });
    window.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      this.el.style.left = (ox + e.clientX - sx) + 'px';
      this.el.style.top  = (oy + e.clientY - sy) + 'px';
      this.el.style.right = 'auto';
      this.el.style.bottom = 'auto';
    });
    window.addEventListener('mouseup', () => { dragging = false; });

    // Esc 全局关闭
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && !this.el.hidden) close();
    });
  },

  open({ title = '输入', label = '数值', value = '', hint = '', onConfirm = null } = {}) {
    if (!this.el) return;
    document.getElementById('fdTitle').textContent = title;
    document.getElementById('fdLabel').textContent = label;
    document.getElementById('fdHint').textContent = hint;
    this.input.value = value;
    this.confirmCb = onConfirm;
    this.el.hidden = false;
    // 默认定位：画布右上角
    const canvas = document.querySelector('.canvas-area');
    if (canvas) {
      const rect = canvas.getBoundingClientRect();
      this.el.style.left = (rect.right - 300) + 'px';
      this.el.style.top  = (rect.top + 60) + 'px';
      this.el.style.right = 'auto';
      this.el.style.bottom = 'auto';
    }
    // 聚焦
    setTimeout(() => { this.input.focus(); this.input.select(); }, 50);
  },

  close() {
    if (!this.el) return;
    this.el.hidden = true;
    this.confirmCb = null;
  },

  _confirm() {
    if (!this.confirmCb) { this.close(); return; }
    const val = this.input.value;
    const ok = this.confirmCb(val);
    if (ok !== false) this.close();
  },
};

/* ============================================================
   树构建与重建
   ============================================================ */
function parseInput(str) {
  if (!str.trim()) return [];
  const parts = str.split(/[,，\s]+/).filter(s => s.trim());
  const nums = [];
  for (const p of parts) {
    const n = parseInt(p);
    if (isNaN(n)) { log(`非法输入: "${p}"`, 'error'); return null; }
    nums.push(n);
  }
  return nums;
}

function buildTree(seq) {
  // 单次构建模式：清空多树并存
  State.trees = [];
  State.isWrongDemo = false; // 构建正常树时清除错误示例标记
  const type = State.currentType;
  log(`开始构建 ${KNOWLEDGE[type].name}，序列: [${seq.join(', ')}]`, 'action');

  switch (type) {
    case 'binary':
    case 'perfect':
    case 'complete':
    case 'forest':
      State.tree = BinaryTreeOps.buildFromSeq(seq);
      break;
    case 'threaded':
      State.tree = ThreadedOps.buildFromSeq(seq);
      log('已完成中序线索化', 'success');
      break;
    case 'bst':
      State.tree = BSTOps.buildFromSeq(seq);
      break;
    case 'avl':
      State.tree = AVLOps.buildFromSeq(seq);
      break;
    case 'rbtree':
      State.tree = RBOps.buildFromSeq(seq);
      log('红黑树插入完成，根为黑', 'success');
      break;
    case 'heap':
      State.heapArr = HeapOps.buildFromSeq(seq, State.heapType);
      State.tree = HeapOps.arrayToTree(State.heapArr);
      log(`${State.heapType === 'max' ? '大' : '小'}根堆建堆完成（O(n) 建堆）`, 'success');
      break;
    case 'btree':
      State.tree = BTreeOps.buildFromSeq(seq, State.btreeOrder);
      log(`B树阶数 m=${State.btreeOrder}，关键字范围 [${Math.ceil(State.btreeOrder / 2) - 1}, ${State.btreeOrder - 1}]`, 'info');
      break;
    case 'bplustree':
      State.tree = BPlusOps.buildFromSeq(seq, State.btreeOrder);
      log(`B+树阶数 m=${State.btreeOrder}，所有数据存叶子`, 'info');
      break;
    case 'bstar':
      State.tree = BStarOps.buildFromSeq(seq, State.btreeOrder);
      log(`B*树阶数 m=${State.btreeOrder}，利用率 ≥ 2/3`, 'info');
      break;
    case 'disjoint':
      State.unionFind = UnionFindOps.init(seq);
      log(`并查集初始化 ${seq.length} 个元素`, 'success');
      break;
  }
  Renderer.render();
  updateStatus();
  updateValidation();
}

function rebuildTree() {
  // 保留当前结构重新布局
  Renderer.render();
}

/* ============================================================
   状态栏更新
   ============================================================ */
function updateStatus() {
  const type = State.currentType;
  document.getElementById('statusName').textContent = KNOWLEDGE[type].name;
  let nodeCount = 0, height = 0;

  if (type === 'disjoint' && State.unionFind) {
    nodeCount = State.unionFind.elements.length;
    height = '—';
  } else if (type === 'heap' && State.heapArr) {
    nodeCount = State.heapArr.length - 1;
    height = Math.floor(Math.log2(nodeCount)) + 1;
  } else if (State.tree) {
    if (Array.isArray(State.tree)) {
      nodeCount = State.tree.reduce((s, t) => s + BinaryTreeOps.count(t), 0);
      height = Math.max(...State.tree.map(t => BinaryTreeOps.height(t)));
    } else if (type === 'btree' || type === 'bplustree' || type === 'bstar') {
      // B树计数
      const countBTree = (n) => n ? n.keys.length + (n.children || []).reduce((s, c) => s + countBTree(c), 0) : 0;
      nodeCount = countBTree(State.tree);
      const heightB = (n) => n ? 1 + ((n.children && n.children.length) ? Math.max(...n.children.map(heightB)) : 0) : 0;
      height = heightB(State.tree);
    } else {
      nodeCount = BinaryTreeOps.count(State.tree);
      height = BinaryTreeOps.height(State.tree);
    }
  }

  document.getElementById('statusNodes').textContent = nodeCount;
  document.getElementById('statusHeight').textContent = height;
}

/* ============================================================
   结构校验
   ============================================================ */
function updateValidation() {
  const type = State.currentType;
  let result = { valid: false, reason: '未构建' };

  if (!State.tree && !State.unionFind) {
    result = { valid: false, reason: '未构建树' };
  } else {
    switch (type) {
      case 'binary':
        result = { valid: true, reason: '合法二叉树（普通二叉树无额外约束）' };
        break;
      case 'perfect':
        result = BinaryTreeOps.isPerfect(State.tree)
          ? { valid: true, reason: '合法满二叉树' }
          : { valid: false, reason: '非满二叉树（节点数 ≠ 2^k-1）' };
        break;
      case 'complete':
        result = BinaryTreeOps.isComplete(State.tree)
          ? { valid: true, reason: '合法完全二叉树' }
          : { valid: false, reason: '非完全二叉树（最后一层需从左到右连续）' };
        break;
      case 'bst':
        result = BSTOps.isBST(State.tree)
          ? { valid: true, reason: '合法 BST（左<根<右）' }
          : { valid: false, reason: '非合法 BST' };
        break;
      case 'avl':
        const avlR = AVLOps.isAVL(State.tree);
        result = avlR;
        break;
      case 'rbtree':
        result = RBOps.isRBTree(State.tree);
        break;
      case 'heap':
        result = HeapOps.isValidHeap(State.heapArr, State.heapType);
        break;
      case 'btree':
        result = BTreeOps.validate(State.tree);
        break;
      case 'bplustree':
        result = BPlusOps.validate(State.tree);
        break;
      case 'bstar':
        result = BStarOps.validate(State.tree);
        break;
      case 'threaded':
        result = { valid: true, reason: '线索化完成' };
        break;
      case 'disjoint':
        result = { valid: true, reason: '并查集已初始化' };
        break;
      case 'forest':
        result = { valid: true, reason: '森林结构合法' };
        break;
    }
  }

  const valEl = document.getElementById('statusValid');
  valEl.textContent = result.valid ? '✓ 合法' : '✕ 非法';
  valEl.className = 'value ' + (result.valid ? 'valid' : 'invalid');

  const infoVal = document.getElementById('infoValidation');
  infoVal.innerHTML = `<div class="${result.valid ? 'valid' : 'invalid'}">${result.valid ? '✓' : '✕'} ${result.reason}</div>`;

  if (!result.valid) {
    log(`校验: ${result.reason}`, 'error');
  } else {
    log(`校验: ${result.reason}`, 'success');
  }
}

/* ============================================================
   知识点面板更新
   ============================================================ */
function updateInfoPanel() {
  const type = State.currentType;
  const k = KNOWLEDGE[type];
  document.getElementById('infoDef').textContent = k.def;
  document.getElementById('infoProps').innerHTML = k.props.map(p => `<li>${p}</li>`).join('');
  document.getElementById('infoExam').innerHTML = k.exam.map(p => `<li>${p}</li>`).join('');
  document.getElementById('infoMistakes').textContent = k.mistakes;

  const tbl = document.getElementById('infoComplexity');
  tbl.innerHTML = `<tr><th>操作</th><th>查找</th><th>插入</th><th>删除</th></tr>
    <tr><td>复杂度</td><td>${k.complexity.search}</td><td>${k.complexity.insert}</td><td>${k.complexity.delete}</td></tr>`;
}

/* ============================================================
   切换树类型 & 填充专属操作区
   ============================================================ */
function switchType(type) {
  State.currentType = type;
  State.tree = null;
  State.heapArr = null;
  State.unionFind = null;
  State.selectedNode = null;
  // State.trees 保持多树并存；切换类型只重置「当前激活树/动画/对比」状态
  State.traverseMode = null;
  State.compareMode = null;
  State._compareTrees = null;
  State.wrongDemoIndex = 0;
  State.isWrongDemo = false;
  Animator.reset();
  Renderer.clear();
  document.querySelectorAll('.btn-traverse').forEach(b => b.classList.remove('active'));
  updateInfoPanel();
  updateStatus();
  document.getElementById('statusValid').textContent = '—';
  document.getElementById('statusValid').className = 'value';
  document.getElementById('infoValidation').innerHTML = '';

  // 清空并填充专属操作区
  const specific = document.getElementById('specificBody');
  specific.innerHTML = '';

  const TOOL_CONFIG = {
    bst: {
      ops: `<div class="btn-row">
        <input type="number" id="bstOpValue" placeholder="值" class="num-input">
        <button id="btnBstInsert" class="btn btn-accent">插入</button>
        <button id="btnBstDelete" class="btn btn-danger">删除</button>
        <button id="btnBstSearch" class="btn btn-secondary">查找</button>
      </div>`,
      hint: 'BST：左小右大，插入为新叶子。删除度2节点时用后继替换值。',
    },
    heap: {
      ops: `<div class="btn-row" style="justify-content:center;">
        <button id="btnMaxHeap" class="btn btn-accent">大根堆</button>
        <button id="btnMinHeap" class="btn btn-secondary">小根堆</button>
      </div>
      <div class="btn-row" style="justify-content:center;margin-top:6px;">
        <input type="number" id="heapOpVal" placeholder="插入值" class="num-input" style="width:70px;">
        <button id="btnHeapInsert" class="btn btn-primary">插入</button>
        <button id="btnHeapDel" class="btn btn-danger">删除根</button>
      </div>`,
      hint: '堆：完全二叉树+堆序。数组下标1开始，父 i 左 2i 右 2i+1。',
    },
    avl: {
      ops: `<div class="btn-row">
        <input type="number" id="avlOpValue" placeholder="插入值" class="num-input" style="width:70px;">
        <button id="btnAvlInsert" class="btn btn-accent">插入</button>
      </div>`,
      hint: 'AVL 自动平衡。BF = 左高 - 右高 ∈ {-1,0,1}。插入后若 |BF|>1 自动旋转修复。四种情况：LL(右旋)、RR(左旋)、LR(先左后右)、RL(先右后左)。',
    },
    rbtree: {
      ops: `<div class="btn-row">
        <input type="number" id="rbOpValue" placeholder="插入值" class="num-input" style="width:70px;">
        <button id="btnRbInsert" class="btn btn-accent">插入</button>
      </div>`,
      hint: '红黑树五大性质：①红/黑 ②根黑 ③叶子黑 ④红节点子必黑 ⑤路径黑高相同。插入为红，叔红变色上溯，叔黑旋转。',
    },
    btree: {
      ops: `<div class="btn-row" style="justify-content:center;gap:12px;">
        <button id="btnDecOrder" class="btn btn-secondary">−</button>
        <span id="orderDisplay" class="order-display">m = ${State.btreeOrder}</span>
        <button id="btnIncOrder" class="btn btn-secondary">+</button>
      </div>`,
      hint: `B树阶数m=${State.btreeOrder}。关键字范围：非根 ⌈m/2⌉-1 ~ m-1，根 1 ~ m-1。满则分裂，缺则合并。`,
    },
    bplustree: {
      ops: `<div class="btn-row" style="justify-content:center;gap:12px;">
        <button id="btnDecOrder" class="btn btn-secondary">−</button>
        <span id="orderDisplay" class="order-display">m = ${State.btreeOrder}</span>
        <button id="btnIncOrder" class="btn btn-secondary">+</button>
      </div>`,
      hint: `B+树阶数m=${State.btreeOrder}。所有关键字存储在叶子节点，叶子节点用指针链接。非叶子节点仅作为索引。`,
    },
    bstar: {
      ops: `<div class="btn-row" style="justify-content:center;gap:12px;">
        <button id="btnDecOrder" class="btn btn-secondary">−</button>
        <span id="orderDisplay" class="order-display">m = ${State.btreeOrder}</span>
        <button id="btnIncOrder" class="btn btn-secondary">+</button>
      </div>`,
      hint: `B*树阶数m=${State.btreeOrder}。节点关键字数下限为 ⌈3m/2⌉-1（B树为 ⌈m/2⌉-1），更紧密填充，减少分裂概率。`,
    },
    disjoint: {
      ops: `<div class="btn-row">
        <input type="number" id="ufX" placeholder="x" class="num-input">
        <input type="number" id="ufY" placeholder="y" class="num-input">
        <button id="btnUnion" class="btn btn-accent">Union</button>
        <button id="btnFind" class="btn btn-secondary">Find</button>
      </div>`,
      hint: '并查集：parent[] 数组表示森林。Union 合并两棵树，Find 查根并路径压缩。',
    },
    threaded: {
      ops: null,
      hint: '线索二叉树：利用 n+1 个空链域存储前驱/后继。ltag/rtag 区分孩子指针(0)与线索(1)。实线=孩子，虚线=线索。',
    },
    forest: {
      ops: null,
      hint: '森林：m≥0 棵互不相交树的集合。树与二叉树转换：左孩子右兄弟法。先根遍历↔二叉树先序，后根遍历↔二叉树中序。',
    },
    binary: {
      ops: null,
      hint: '普通二叉树：每个节点最多两个子树，左右子树严格区分。点击「错误演示」可生成左右值颠倒的非法布局。',
    },
    perfect: {
      ops: null,
      hint: '满二叉树：所有非叶子节点都有两子，且所有叶子在同一层。点击「错误演示」可生成缺叶子的非满结构。',
    },
    complete: {
      ops: null,
      hint: '完全二叉树：除最后一层外全满，最后一层从左到右连续填充。点击「错误演示」可生成最后一层不连续的非法结构。',
    },
  };

  // 通用操作（所有类型可用）—— 错误演示独占一行（红色色系），对比按钮另起一行
  const commonOps = `
    <div class="btn-row btn-row-error">
      <button id="btnWrongDemo" class="btn btn-danger">⚠ 错误示例</button>
    </div>
    <div class="btn-row">
      <button id="btnCompareMode" class="btn btn-secondary">⇄ 对比</button>
    </div>`;
  const commonHint = '错误示例：生成非法结构让学生识别（红色标注）。对比模式：同序列 BST/AVL/红黑树高度对比。';

  // 获取当前类型的工具配置
  const cfg = TOOL_CONFIG[type] || { ops: null, hint: '' };

  // 渲染「可用操作」区块
  const opsSection = document.createElement('div');
  opsSection.className = 'tool-section';
  const opsTitle = document.createElement('div');
  opsTitle.className = 'tool-section-title';
  opsTitle.textContent = '可用操作';
  opsSection.appendChild(opsTitle);
  const opsBody = document.createElement('div');
  opsBody.className = 'sec-body';
  opsBody.style.padding = '0';
  if (cfg.ops) {
    opsBody.innerHTML = cfg.ops;
  } else {
    opsBody.innerHTML = `<p class="tool-empty">此结构无专属操作按钮，通过输入序列构建后在画布上交互。</p>`;
  }
  opsSection.appendChild(opsBody);
  specific.appendChild(opsSection);

  // 渲染「知识点提示」区块
  const hintSection = document.createElement('div');
  hintSection.className = 'tool-section';
  const hintTitle = document.createElement('div');
  hintTitle.className = 'tool-section-title';
  hintTitle.textContent = '知识点提示';
  hintSection.appendChild(hintTitle);
  const hintBody = document.createElement('div');
  hintBody.className = 'sec-body';
  hintBody.style.padding = '0';
  hintBody.innerHTML = `<p class="tool-hint">${cfg.hint}</p>`;
  hintSection.appendChild(hintBody);
  specific.appendChild(hintSection);

  // 通用操作区块（仅在配置中没有 hint 时才显示）
  if (cfg.hint !== commonHint) {
    const genSection = document.createElement('div');
    genSection.className = 'tool-section';
    const genTitle = document.createElement('div');
    genTitle.className = 'tool-section-title';
    genTitle.textContent = '通用演示';
    genSection.appendChild(genTitle);
    const genBody = document.createElement('div');
    genBody.className = 'sec-body';
    genBody.style.padding = '0';
    genBody.innerHTML = `<div class="btn-row">${commonOps}</div><p class="tool-hint">${commonHint}</p>`;
    genSection.appendChild(genBody);
    specific.appendChild(genSection);
  }

  log(`切换到 ${KNOWLEDGE[type].name}`, 'action');
}

function rebuildAfterOrderChange() {
  const seq = parseInput(document.getElementById('inputSeq').value);
  if (seq && seq.length) buildTree(seq);
}

function bstOp(op) {
  const v = parseInt(document.getElementById('bstOpValue').value);
  if (isNaN(v)) { log('请输入数值', 'warn'); return; }
  if (op === 'insert') {
    State.tree = BSTOps.insert(State.tree, v);
    log(`BST 插入 ${v}`, 'action');
  } else if (op === 'delete') {
    State.tree = BSTOps.delete(State.tree, v);
    log(`BST 删除 ${v}（度2用后继替换）`, 'action');
  } else if (op === 'search') {
    const found = BSTOps.search(State.tree, v);
    log(found ? `查找 ${v} 成功` : `查找 ${v} 失败`, found ? 'success' : 'warn');
    if (found) {
      if (State.selectedNode) State.selectedNode.state = 'normal';
      found.state = 'visited';
      State.selectedNode = found;
    }
  }
  Renderer.render();
  updateStatus();
  updateValidation();
}

function ufUnion() {
  const x = parseInt(document.getElementById('ufX').value);
  const y = parseInt(document.getElementById('ufY').value);
  if (isNaN(x) || isNaN(y)) { log('请输入 x 和 y', 'warn'); return; }
  if (!State.unionFind) { log('请先构建并查集', 'warn'); return; }
  const result = UnionFindOps.union(State.unionFind, x, y, true);
  log(result ? `Union(${x}, ${y}) 合并成功（按秩合并）` : `Union(${x}, ${y}) 已属同集合`, result ? 'success' : 'warn');
  Renderer.render();
}

function ufFind() {
  const x = parseInt(document.getElementById('ufX').value);
  if (isNaN(x)) { log('请输入 x', 'warn'); return; }
  if (!State.unionFind) { log('请先构建并查集', 'warn'); return; }
  const root = UnionFindOps.find(State.unionFind, x, true);
  log(`Find(${x}) → 根为 ${root}（路径压缩）`, 'success');
  Renderer.render();
}

/* 各类型错误演示模板（多种模式，循环切换） */
const WRONG_DEMOS = {
  binary: [
    () => {
      // 模式A：左右值颠倒
      const r = makeNode(50);
      r.left = makeNode(70); r.right = makeNode(30);
      r.left.parent = r; r.right.parent = r;
      return { tree: r, msg: '左右子树值颠倒（左70 > 根50，若这是BST则非法）' };
    },
    () => {
      // 模式B：只有左子树，没有右子树（退化形态）
      const r = makeNode(1);
      r.left = makeNode(2); r.left.left = makeNode(3);
      r.left.parent = r; r.left.left.parent = r.left;
      return { tree: r, msg: '右子树为空，退化为单链表形态' };
    },
  ],
  perfect: [
    () => {
      // 缺少一个叶子
      const r = makeNode(1);
      r.left = makeNode(2); r.right = makeNode(3);
      r.left.left = makeNode(4); r.left.right = makeNode(5);
      r.right.left = makeNode(6);
      r.left.parent = r; r.right.parent = r;
      r.left.left.parent = r.left; r.left.right.parent = r.left; r.right.left.parent = r.right;
      return { tree: r, msg: '右子节点3缺少右孩子，叶子不在同一层' };
    },
    () => {
      // 多一个叶子
      const r = makeNode(1);
      r.left = makeNode(2); r.right = makeNode(3);
      r.left.left = makeNode(4); r.left.right = makeNode(5);
      r.right.left = makeNode(6); r.right.right = makeNode(7);
      r.left.left.left = makeNode(8); // 多出一层
      r.left.left.parent = r.left; r.left.right.parent = r.left;
      r.right.left.parent = r.right; r.right.right.parent = r.right;
      r.left.left.left.parent = r.left.left;
      return { tree: r, msg: '最深层出现第4层叶子，破坏满二叉树定义' };
    },
  ],
  complete: [
    () => {
      // 最后一层不连续（左空右有）
      const r = makeNode(1);
      r.left = makeNode(2); r.right = makeNode(3);
      r.left.left = null; r.left.right = makeNode(5);
      r.right.left = makeNode(6); r.right.right = makeNode(7);
      r.left.parent = r; r.right.parent = r;
      r.right.left.parent = r.right; r.right.right.parent = r.right;
      return { tree: r, msg: '最后一层不连续：节点5前有空位（完全二叉树必须从左到右连续）' };
    },
    () => {
      // 中间层有空缺
      const r = makeNode(1);
      r.left = makeNode(2);
      // r.right 缺失
      r.left.left = makeNode(4); r.left.right = makeNode(5);
      r.left.parent = r; r.left.left.parent = r.left; r.left.right.parent = r.left;
      return { tree: r, msg: '第二层右侧空缺，违反完全二叉树从左到右连续填充规则' };
    },
  ],
  bst: [
    () => {
      // 模式A：左大右小
      const r = makeNode(50);
      r.left = makeNode(70); r.right = makeNode(30);
      r.left.parent = r; r.right.parent = r;
      return { tree: r, msg: '左孩子70 > 根50，违反左小右大' };
    },
    () => {
      // 模式B：右子树中出现更小的值
      const r = makeNode(50);
      r.right = makeNode(70);
      r.right.left = makeNode(40); // 40 < 50，应在左子树
      r.right.left.parent = r.right; r.right.parent = r;
      return { tree: r, msg: '右子树70的左孩子40 < 根50，违反BST全局有序性' };
    },
    () => {
      // 模式C：重复值
      const r = makeNode(50);
      r.left = makeNode(30); r.right = makeNode(70);
      r.left.right = makeNode(50); // 重复值
      r.left.parent = r; r.right.parent = r; r.left.right.parent = r.left;
      return { tree: r, msg: '右子树中出现与根相同的值50，BST不应有重复值' };
    },
  ],
  avl: [
    () => {
      // 左重失衡
      const r = makeNode(10);
      r.left = makeNode(8); r.left.left = makeNode(5); r.left.left.left = makeNode(2);
      return { tree: r, msg: '左子树过高，BF=3，未做右旋修复' };
    },
    () => {
      // 右重失衡
      const r = makeNode(10);
      r.right = makeNode(20); r.right.right = makeNode(30); r.right.right.right = makeNode(40);
      return { tree: r, msg: '右子树过高，BF=-3，未做左旋修复' };
    },
    () => {
      // LR型失衡
      const r = makeNode(30);
      r.left = makeNode(10); r.left.right = makeNode(20);
      r.left.right.left = makeNode(15); r.left.right.right = makeNode(25);
      r.left.parent = r; r.left.right.parent = r.left;
      r.left.right.left.parent = r.left.right; r.left.right.right.parent = r.left.right;
      return { tree: r, msg: 'LR型失衡：左孩子的右子树过高，需先左旋后右旋' };
    },
  ],
  heap: [
    () => {
      // 大根堆违规：父小于子
      State.heapArr = [null, 3, 10, 5, 20];
      State.tree = HeapOps.arrayToTree(State.heapArr);
      return { tree: State.tree, msg: '节点3的子节点10>3，违反大根堆序（父 ≥ 子）' };
    },
    () => {
      // 大根堆违规：根不是最大
      State.heapArr = [null, 5, 20, 10, 30];
      State.tree = HeapOps.arrayToTree(State.heapArr);
      return { tree: State.tree, msg: '根5不是最大值30，违反堆序性质' };
    },
  ],
  rbtree: [
    () => {
      // 连续红节点
      const r = makeNode(10); r.color = 'black';
      r.left = makeNode(5); r.left.color = 'red';
      r.left.left = makeNode(2); r.left.left.color = 'red';
      return { tree: r, msg: '连续两个红节点（5→2），违反性质④' };
    },
    () => {
      // 根不是黑色
      const r = makeNode(10); r.color = 'red'; // 根应为黑
      r.left = makeNode(5); r.left.color = 'black';
      r.right = makeNode(15); r.right.color = 'black';
      return { tree: r, msg: '根节点10为红色，违反性质②（根必为黑）' };
    },
    () => {
      // 黑高不一致
      const r = makeNode(10); r.color = 'black';
      r.left = makeNode(5); r.left.color = 'black';
      r.right = makeNode(15); r.right.color = 'black';
      r.left.left = makeNode(2); r.left.left.color = 'black';
      // r.right 无子节点（NIL黑高不同）
      return { tree: r, msg: '左路径黑高3，右路径黑高2，违反性质⑤（路径黑高相同）' };
    },
  ],
  threaded: [
    () => {
      // 线索方向错误
      const r = makeNode(50);
      const l = makeNode(30), ri = makeNode(70);
      r.left = l; r.right = ri; l.parent = r; ri.parent = r;
      l.state = 'threaded'; l.right = ri; l.rtag = 1;
      ri.state = 'threaded'; ri.left = l; ri.ltag = 1;
      return { tree: r, msg: '线索方向错误：30的后继指向70，跳过中序中间节点50' };
    },
    () => {
      // 线索标签错误（孩子指针被标为线索）
      const r = makeNode(50);
      const l = makeNode(30), ri = makeNode(70);
      r.left = l; r.right = ri; l.parent = r; ri.parent = r;
      l.ltag = 1; ri.rtag = 1; // 错误：这些是真实孩子，不是线索
      return { tree: r, msg: 'ltag/rtag标签错误：真实孩子被标记为线索（应为0）' };
    },
  ],
  btree: [
    () => {
      // 关键字过多
      const m = State.btreeOrder;
      const keys = []; for (let i = 0; i < m; i++) keys.push(i + 1);
      State.tree = { keyCount: keys.length, maxKeys: m - 1, keys, children: [] };
      State.tree.keys = keys;
      return { tree: State.tree, msg: `关键字数${keys.length} > 上限${m - 1}，应触发分裂` };
    },
    () => {
      // 关键字过少（非根节点）
      const m = State.btreeOrder;
      State.tree = { keyCount: 0, maxKeys: m - 1, minKeys: Math.ceil(m / 2) - 1, keys: [], children: [] };
      return { tree: State.tree, msg: `关键字数0 < 下限${Math.ceil(m / 2) - 1}，应触发合并` };
    },
  ],
  bplustree: [
    () => {
      const m = State.btreeOrder;
      const keys = []; for (let i = 0; i < m; i++) keys.push(i + 1);
      State.tree = { keyCount: keys.length, maxKeys: m - 1, keys, children: [], isLeaf: true };
      return { tree: State.tree, msg: 'B+树内部节点关键字过多，非叶子节点应只作索引' };
    },
    () => {
      // 叶子节点间缺少链接
      State.tree = { keys: [1, 2, 3], next: null, isLeaf: true };
      return { tree: State.tree, msg: '叶子节点next指针为null，B+树叶节点应链接成有序链表' };
    },
  ],
  bstar: [
    () => {
      const m = State.btreeOrder;
      const keys = []; for (let i = 0; i < Math.ceil(m * 2 / 3); i++) keys.push(i + 1);
      State.tree = { keyCount: keys.length, maxKeys: m - 1, minKeys: Math.ceil(3 * m / 4) - 1, keys, children: [] };
      return { tree: State.tree, msg: `B*树关键字数${keys.length}低于下限${Math.ceil(3 * m / 4) - 1}，违反紧密填充要求` };
    },
    () => {
      const m = State.btreeOrder;
      const keys = []; for (let i = 0; i < m; i++) keys.push(i + 1);
      State.tree = { keyCount: keys.length, maxKeys: m - 1, minKeys: Math.ceil(3 * m / 4) - 1, keys, children: [] };
      return { tree: State.tree, msg: `B*树关键字数${keys.length}达到上限，应尝试与兄弟合并而非分裂` };
    },
  ],
  forest: [
    () => {
      // 森林中两棵树相连
      const t1 = makeNode(1);
      const t2 = makeNode(10);
      t1.right = t2; // 错误连接
      t1.right.parent = t1;
      return { tree: [t1, t2], msg: '两棵树通过右指针相连，破坏森林互不相交定义' };
    },
    () => {
      // 森林为空（0棵树，但用户认为有树）
      State.tree = null;
      return { tree: null, msg: '森林为空（0棵树），但状态栏仍显示结构信息' };
    },
  ],
  disjoint: [
    () => {
      // 应合并但未合并
      State.unionFind = { elements: [1, 2, 3, 4, 5], parent: [0, 1, 2, 3, 4, 5] };
      return { tree: State.unionFind, msg: '元素1-5各自为根，本应通过Union合并为同一集合' };
    },
    () => {
      // 环路错误（parent形成环）
      State.unionFind = { elements: [1, 2, 3], parent: [0, 2, 1, 3] }; // 1→2→1 形成环
      return { tree: State.unionFind, msg: 'parent[1]=2, parent[2]=1，形成环路，find无法终止' };
    },
  ],
};

function generateWrongDemo() {
  const type = State.currentType;
  const demos = WRONG_DEMOS[type];
  if (!demos || !demos.length) {
    log('当前结构无错误示例模板，可手动双击节点修改制造错误', 'warn');
    return;
  }
  // 循环切换错误模式
  State.wrongDemoIndex = (State.wrongDemoIndex + 1) % demos.length;
  const demo = demos[State.wrongDemoIndex];
  const result = demo();
  log(`【错误示例 #${State.wrongDemoIndex + 1}/${demos.length}】${result.msg}`, 'action');

  // 标记错误演示状态（禁用动画）
  State.isWrongDemo = true;

  // 将错误树追加到多树并存（支持展示多棵错误示例）
  const errorTree = result.tree;
  if (errorTree === undefined || errorTree === null) return;

  // 给错误树节点打标
  const idx = State.trees.length;
  const markNodes = (n) => {
    if (!n) return;
    n._treeIdx = idx; n._treeType = type; n._isError = true;
    markNodes(n.left); markNodes(n.right);
  };
  if (Array.isArray(errorTree)) errorTree.forEach(t => markNodes(t));
  else markNodes(errorTree);

  // 若 demo 指定了 errorNodes（具体哪些节点出错），标记它们
  if (result.errorNodes && Array.isArray(result.errorNodes)) {
    result.errorNodes.forEach(n => { if (n) n._isErrorNode = true; });
  }

  State.trees.push({
    type, tree: errorTree,
    heapArr: null, unionFind: null,
    isError: true,
    errorMsg: result.msg,
    errorNodes: result.errorNodes || null,
  });
  State.selectedTreeIdx = State.trees.length - 1;
  State.tree = errorTree;
  Renderer.render();
  // renderMultiTrees 内部已负责绘制错误标注，无需重复调用
  updateStatus();
  updateValidation();
}

/* ============================================================
   动画系统
   ============================================================ */
const Animator = {
  steps: [],
  index: 0,
  playing: false,
  timer: null,

  setSteps(steps) {
    this.steps = steps;
    this.index = 0;
  },

  getDelay() {
    return 800 / State.animSpeed;
  },

  play() {
    if (this.index >= this.steps.length) {
      this.playing = false;
      log('动画播放完成', 'success');
      return;
    }
    this.playing = true;
    this.executeStep();
  },

  pause() {
    this.playing = false;
    if (this.timer) { clearTimeout(this.timer); this.timer = null; }
    log('动画暂停', 'info');
  },

  step() {
    if (this.index >= this.steps.length) return;
    this.executeStep();
    if (!this.playing) log(`步骤 ${this.index}/${this.steps.length}`, 'info');
  },

  reset() {
    this.index = 0;
    this.pause();
    this.steps = [];

    const clearStates = (n) => {
      if (!n) return;
      n.state = 'normal';
      if (n.ltag === 0) clearStates(n.left);
      if (n.rtag === 0) clearStates(n.right);
    };

    if (State.trees && State.trees.length) {
      const idx = typeof State.selectedTreeIdx === 'number' ? State.selectedTreeIdx : (State.trees.length - 1);
      const item = State.trees[idx];
      if (item) {
        if (item.type === 'disjoint') {
          const forest = item.unionFind ? UnionFindOps.buildForest(item.unionFind) : [];
          forest.forEach(root => clearStates(root));
        } else if (item.type === 'forest') {
          const roots = Array.isArray(item.tree) ? item.tree : (item.tree ? [item.tree] : []);
          roots.forEach(root => clearStates(root));
        } else {
          clearStates(item.tree);
        }
      }
      Renderer.render();
    } else if (State.tree) {
      clearStates(State.tree);
      Renderer.render();
    }

    log('动画重置', 'info');
  },

  executeStep() {
    if (this.index >= this.steps.length) {
      this.playing = false;
      return;
    }
    const step = this.steps[this.index];
    this.index++;

    // 执行步骤
    if (step.action) step.action();
    if (step.log) log(step.log, step.logType || 'info');
    Renderer.render();

    if (this.playing) {
      this.timer = setTimeout(() => this.play(), this.getDelay());
    }
  },
};

/* ============================================================
   遍历动画生成
   ============================================================ */
function generateTraversalSteps(traverseType) {
  let root = null;

  // 多树并存：只对「选中树」生成遍历步骤
  if (State.trees && State.trees.length) {
    const idx = typeof State.selectedTreeIdx === 'number' ? State.selectedTreeIdx : (State.trees.length - 1);
    const item = State.trees[idx];
    if (item) {
      if (item.type === 'heap') root = item.tree || HeapOps.arrayToTree(item.heapArr || State.heapArr);
      else if (item.type === 'disjoint') {
        const forest = item.unionFind ? UnionFindOps.buildForest(item.unionFind) : [];
        root = forest[0] || null;
      } else if (item.type === 'forest') {
        const roots = Array.isArray(item.tree) ? item.tree : (item.tree ? [item.tree] : []);
        root = roots[0] || null;
      } else {
        root = item.tree;
      }
    }
  }

  // 单树回退
  if (!root) {
    const type = State.currentType;
    root = State.tree;
    if (type === 'heap') root = HeapOps.arrayToTree(State.heapArr);
    if (type === 'disjoint') {
      const forest = UnionFindOps.buildForest(State.unionFind);
      root = forest[0] || null;
    }
  }

  if (!root) { log('请先构建树', 'warn'); return []; }

  let sequence = [];
  if (traverseType === 'pre') sequence = BinaryTreeOps.preOrder(root);
  else if (traverseType === 'in') sequence = BinaryTreeOps.inOrder(root);
  else if (traverseType === 'post') sequence = BinaryTreeOps.postOrder(root);
  else if (traverseType === 'level') sequence = BinaryTreeOps.levelOrder(root);

  const steps = sequence.map((node, i) => ({
    action: () => {
      // 清除上一个
      sequence.forEach(n => { if (n.state === 'visited') n.state = 'normal'; });
      node.state = 'visited';
    },
    log: `${traverseType === 'pre' ? '前序' : traverseType === 'in' ? '中序' : traverseType === 'post' ? '后序' : '层序'}访问节点 ${node.value}（第 ${i + 1} 个）`,
    logType: 'action',
  }));
  return steps;
}

/* ============================================================
   事件绑定
   ============================================================ */
/* ============================================================
   事件委托 — 统一处理 #leftPanel 下所有交互
   ============================================================ */
function bindPanelDelegation() {
  const panel = document.getElementById('leftPanel');
  if (!panel) return;

  // ——— 所有按钮点击 ———
  panel.addEventListener('click', (e) => {
    const btn = e.target.closest('button');
    if (!btn) return;

    // 静态按钮
    if (btn.id === 'btnBuild')       { buildFromInput(false); return; }
    if (btn.id === 'btnBuildAppend') { buildFromInput(true);  return; }
    if (btn.id === 'btnRandom')      { generateRandom(); return; }
    if (btn.id === 'btnClear')       { doClear();        return; }
    if (btn.id === 'btnPlay')        { doPlay();         return; }
    if (btn.id === 'btnPause')       { doPause();        return; }
    if (btn.id === 'btnStep')        { doStep();         return; }
    if (btn.id === 'btnReset')       { Animator.reset(); return; }
    if (btn.id === 'btnClearLog')    { clearLog();       return; }

    // 遍历
    if (btn.classList.contains('btn-traverse')) {
      const mode = btn.dataset.traverse;
      document.querySelectorAll('.btn-traverse').forEach(b => b.classList.remove('active'));
      if (State.traverseMode === mode) {
        State.traverseMode = null;
        Animator.reset();
        log('已取消遍历模式', 'info');
      } else {
        btn.classList.add('active');
        State.traverseMode = mode;
        const steps = generateTraversalSteps(mode);
        if (steps.length) { Animator.setSteps(steps); log(`${mode}遍历已选定，共 ${steps.length} 步，点击播放`, 'action'); }
      }
      return;
    }

    // 堆类型
    if (btn.id === 'btnMaxHeap') { State.heapType = 'max'; refreshHeapClasses(); Renderer.render(); return; }
    if (btn.id === 'btnMinHeap') { State.heapType = 'min'; refreshHeapClasses(); Renderer.render(); return; }

    // BST
    if (btn.id === 'btnBstInsert') { bstOp('insert'); return; }
    if (btn.id === 'btnBstDelete') { bstOp('delete'); return; }
    if (btn.id === 'btnBstSearch') { bstOp('search');  return; }

    // 堆操作
    if (btn.id === 'btnHeapInsert') { heapInsert(); return; }
    if (btn.id === 'btnHeapDel')    { heapDelete(); return; }

    // AVL / 红黑树
    if (btn.id === 'btnAvlInsert')  { avlInsert();  return; }
    if (btn.id === 'btnRbInsert')   { rbInsert();   return; }

    // B树阶数
    if (btn.id === 'btnIncOrder') {
      State.btreeOrder = Math.min(7, State.btreeOrder + 1);
      const d = document.getElementById('orderDisplay');
      if (d) d.textContent = 'm = ' + State.btreeOrder;
      rebuildAfterOrderChange(); return;
    }
    if (btn.id === 'btnDecOrder') {
      State.btreeOrder = Math.max(3, State.btreeOrder - 1);
      const d = document.getElementById('orderDisplay');
      if (d) d.textContent = 'm = ' + State.btreeOrder;
      rebuildAfterOrderChange(); return;
    }

    // 并查集
    if (btn.id === 'btnUnion') { ufUnion(); return; }
    if (btn.id === 'btnFind')  { ufFind();  return; }

    // 教学演示
    if (btn.id === 'btnWrongDemo') { generateWrongDemo(); return; }
    if (btn.id === 'btnCompareMode') { doCompare(); return; }
  });

  // ——— 输入框 input 事件 ———
  panel.addEventListener('input', (e) => {
    if (e.target.id === 'inputSeq') return;
    if (e.target.id === 'randomCount') {
      const v = document.getElementById('randomCountVal');
      if (v) v.textContent = e.target.value;
    } else if (e.target.id === 'randomMax') {
      const v = document.getElementById('randomMaxVal');
      if (v) v.textContent = e.target.value;
    } else if (e.target.id === 'animSpeed') {
      State.animSpeed = parseInt(e.target.value) / 5;
      const v = document.getElementById('speedVal');
      if (v) v.textContent = State.animSpeed.toFixed(1) + 'x';
    }
  });
}

/* ============================================================
   辅助函数
   ============================================================ */
function buildFromInput(appendMode = false) {
  const seq = parseInput(document.getElementById('inputSeq').value);
  if (seq === null) return;
  if (State.currentType !== 'disjoint' && new Set(seq).size !== seq.length) {
    log('警告：存在重复值，部分结构（BST/AVL/红黑树）将忽略重复', 'warn');
  }
  if (appendMode) {
    buildTreeAppend(seq);
  } else {
    buildTree(seq);
  }
}

function buildTreeAppend(seq) {
  const type = State.currentType;
  let tree = null;
  switch (type) {
    case 'binary': case 'perfect': case 'complete': case 'forest':
      tree = BinaryTreeOps.buildFromSeq(seq); break;
    case 'threaded':
      tree = ThreadedOps.buildFromSeq(seq); log('已完成中序线索化', 'success'); break;
    case 'bst': tree = BSTOps.buildFromSeq(seq); break;
    case 'avl': tree = AVLOps.buildFromSeq(seq); break;
    case 'rbtree': tree = RBOps.buildFromSeq(seq); log('红黑树插入完成，根为黑', 'success'); break;
    case 'heap':
      State.heapArr = HeapOps.buildFromSeq(seq, State.heapType);
      tree = HeapOps.arrayToTree(State.heapArr);
      log(`${State.heapType === 'max' ? '大' : '小'}根堆建堆完成`, 'success'); break;
    case 'btree':
      tree = BTreeOps.buildFromSeq(seq, State.btreeOrder);
      log(`B树阶数 m=${State.btreeOrder}`, 'info'); break;
    case 'bplustree':
      tree = BPlusOps.buildFromSeq(seq, State.btreeOrder);
      log(`B+树阶数 m=${State.btreeOrder}`, 'info'); break;
    case 'bstar':
      tree = BStarOps.buildFromSeq(seq, State.btreeOrder);
      log(`B*树阶数 m=${State.btreeOrder}`, 'info'); break;
    case 'disjoint':
      State.unionFind = UnionFindOps.init(seq);
      log(`并查集初始化 ${seq.length} 个元素`, 'success'); break;
  }
  if (!tree) return;
  const idx = State.trees.length;
  // 给节点打标，方便 tooltip 显示所属组
  if (type !== 'disjoint') {
    const markNodes = (n) => {
      if (!n) return;
      n._treeIdx = idx; n._treeType = type;
      markNodes(n.left); markNodes(n.right);
    };
    if (Array.isArray(tree)) tree.forEach(t => markNodes(t));
    else markNodes(tree);
  }
  State.trees.push({ type, tree, heapArr: State.heapArr && type === 'heap' ? State.heapArr : null, unionFind: State.unionFind && type === 'disjoint' ? State.unionFind : null });
  State.selectedTreeIdx = State.trees.length - 1;
  State.tree = tree;
  log(`追加 [${idx + 1}/${type}] 成功，共 ${State.trees.length} 棵树`, 'action');
  Renderer.render();
  updateStatus();
}
function generateRandom() {
  const count = parseInt(document.getElementById('randomCount').value);
  const max   = parseInt(document.getElementById('randomMax').value);
  const seq = [], used = new Set();
  while (seq.length < count) {
    const v = Math.floor(Math.random() * max) + 1;
    if (!used.has(v)) { used.add(v); seq.push(v); }
  }
  document.getElementById('inputSeq').value = seq.join(',');
  log(`随机生成 ${count} 个节点: [${seq.join(', ')}]，请点「构建」生成树`, 'info');
}
function doClear() {
  State.tree = null; State.heapArr = null; State.unionFind = null; State.selectedNode = null;
  State.trees = []; State.isWrongDemo = false; State.isWrongDemo = false;
  document.getElementById('inputSeq').value = '';
  Renderer.clear(); updateStatus();
  const el = document.getElementById('statusValid');
  if (el) { el.textContent = '—'; el.className = 'value'; }
  const iv = document.getElementById('infoValidation');
  if (iv) iv.innerHTML = '';
  clearLog(); log('已清空', 'info');
}
function doPlay()    {
  if (State.isWrongDemo) { log('错误示例模式下不可播放动画（仅用于对比识别错误）', 'warn'); return; }
  if (!Animator.steps.length) { log('请先选择遍历方式或操作', 'warn'); return; }
  Animator.play(); log('动画播放', 'action');
}
function doPause()   { Animator.pause(); }
function doStep()    { Animator.step(); }
function refreshHeapClasses() {
  const mx = document.getElementById('btnMaxHeap'), mn = document.getElementById('btnMinHeap');
  if (mx) mx.className = 'btn ' + (State.heapType === 'max' ? 'btn-accent' : 'btn-secondary');
  if (mn) mn.className = 'btn ' + (State.heapType === 'min' ? 'btn-accent' : 'btn-secondary');
}
function heapInsert() {
  const v = parseInt(document.getElementById('heapOpVal')?.value);
  if (isNaN(v)) { log('请输入数值', 'warn'); return; }
  HeapOps.insert(State.heapArr, v, State.heapType);
  State.tree = HeapOps.arrayToTree(State.heapArr);
  log(`堆插入 ${v}，shiftUp ${Math.log2(State.heapArr.length).toFixed(0)} 层`, 'action');
  Renderer.render(); updateStatus(); updateValidation();
}
function heapDelete() {
  HeapOps.deleteRoot(State.heapArr, State.heapType);
  State.tree = HeapOps.arrayToTree(State.heapArr);
  log(`删除根节点，shiftDown`, 'action');
  Renderer.render(); updateStatus(); updateValidation();
}
function avlInsert() {
  const v = parseInt(document.getElementById('avlOpValue')?.value);
  if (isNaN(v)) { log('请输入数值', 'warn'); return; }
  State.tree = AVLOps.insert(State.tree, v);
  log(`AVL 插入 ${v}，自动平衡`, 'action');
  Renderer.render(); updateStatus(); updateValidation();
}
function rbInsert() {
  const v = parseInt(document.getElementById('rbOpValue')?.value);
  if (isNaN(v)) { log('请输入数值', 'warn'); return; }
  State.tree = RBOps.insert(State.tree, v);
  log(`红黑树插入 ${v}（红色），自动修复五大性质`, 'action');
  Renderer.render(); updateStatus(); updateValidation();
}
function doCompare() {
  const seq = parseInput(document.getElementById('inputSeq').value);
  if (!seq || !seq.length) { log('请先输入序列', 'warn'); return; }
  log(`对比模式 [${seq.join(',')}]: 绘制 BST / AVL / 红黑树`, 'action');
  const bst = BSTOps.buildFromSeq(seq), avl = AVLOps.buildFromSeq(seq), rb = RBOps.buildFromSeq(seq);
  const hBst = BinaryTreeOps.height(bst), hAvl = BinaryTreeOps.height(avl), hRb = BinaryTreeOps.height(rb);
  log(`BST 高度: ${hBst} | AVL 高度: ${hAvl} | 红黑树高度: ${hRb}`, 'info');
  // 保存对比状态
  State.compareMode = 'compare';
  State._compareTrees = { bst, avl, rb };
  State._compareLabels = ['BST', 'AVL', '红黑树'];
  // 清除当前类型状态，避免干扰
  State.tree = null;
  // 用自定义方法渲染对比图
  Renderer.renderCompare();
}

/* 对比模式渲染：三棵树并排 */
const CompareRender = {
  layoutSideBySide(trees, labels, options = {}) {
    // 对每棵树独立布局，然后水平平铺
    const W = 320, H = 480, gap = 60;
    trees.forEach((root, i) => {
      if (!root) return;
      const ox = i * (W + gap) + gap / 2;
      const pos = { x: ox + W / 2 };
      Renderer.layoutBinary(root, 0, pos);
      // 记录偏移量
      root._cmpOffsetX = ox;
      root._cmpOffsetY = 60;
      root._cmpLabel = labels[i];
      root._cmpColorKey = options.colors ? options.colors[i] : TREE_COLORS[labels[i].toLowerCase().replace(/\s/g, '')];
    });
    return trees;
  },
  drawBinaryWithOffset(node, offsetX, offsetY, colorKey, label) {
    const NS = 'http://www.w3.org/2000/svg';
    node.x += offsetX; node.y += offsetY;
    // 边
    if (node.left) {
      this.drawEdgeWithOffset(node, node.left, offsetX, offsetY);
      this.drawBinaryWithOffset(node.left, offsetX, offsetY, colorKey, label);
    }
    if (node.right) {
      this.drawEdgeWithOffset(node, node.right, offsetX, offsetY);
      this.drawBinaryWithOffset(node.right, offsetX, offsetY, colorKey, label);
    }
    // 节点
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${node.x},${node.y})`);
    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('r', '18');
    let cls = 'node-circle';
    if (colorKey) cls += ' tree-color-' + colorKey;
    circle.setAttribute('class', cls);
    const text = document.createElementNS(NS, 'text');
    text.setAttribute('class', 'node-text');
    text.textContent = node.value;
    g.appendChild(circle);
    g.appendChild(text);
    // tooltip
    const tipNS = 'http://www.w3.org/2000/svg';
    const tipRect = document.createElementNS(tipNS, 'rect');
    const tipText = document.createElementNS(tipNS, 'text');
    tipRect.setAttribute('rx', '4'); tipRect.setAttribute('ry', '4');
    tipRect.setAttribute('fill', 'rgba(0,0,0,0.75)');
    tipRect.setAttribute('width', '0'); tipRect.setAttribute('height', '0');
    tipText.setAttribute('fill', '#fff');
    tipText.setAttribute('font-size', '11');
    tipText.setAttribute('font-family', 'JetBrains Mono, Consolas, monospace');
    tipText.setAttribute('text-anchor', 'middle');
    tipText.setAttribute('y', '4');
    tipText.textContent = '';
    g.appendChild(tipRect); g.appendChild(tipText);
    g.style.cursor = 'pointer';
    g.addEventListener('mouseenter', () => {
      const lbl = `${label}: ${node.value}`;
      tipText.textContent = lbl;
      const tw = lbl.length * 7.5 + 8;
      tipRect.setAttribute('width', tw); tipRect.setAttribute('height', '16');
      tipRect.setAttribute('x', -tw / 2); tipRect.setAttribute('y', '-34');
      tipText.setAttribute('x', '0'); tipText.setAttribute('y', '-22');
    });
    g.addEventListener('mouseleave', () => {
      tipRect.setAttribute('width', '0'); tipRect.setAttribute('height', '0');
      tipText.textContent = '';
    });
    g.addEventListener('click', (e) => { e.stopPropagation(); Interaction.selectNode(node); });
    g.addEventListener('dblclick', (e) => { e.stopPropagation(); Interaction.editNode(node); });
    Renderer.nodesLayer.appendChild(g);
    // 标签
    const lg = document.createElementNS(NS, 'g');
    lg.setAttribute('transform', `translate(${node.x},${offsetY - 8})`);
    const lt = document.createElementNS(NS, 'text');
    lt.setAttribute('class', 'cmp-label');
    lt.textContent = label;
    lg.appendChild(lt);
    Renderer.labelsLayer.appendChild(lg);
  },
  drawEdgeWithOffset(from, to, ox, oy) {
    const NS = 'http://www.w3.org/2000/svg';
    const line = document.createElementNS(NS, 'line');
    line.setAttribute('x1', from.x + ox); line.setAttribute('y1', from.y + oy);
    line.setAttribute('x2', to.x + ox); line.setAttribute('y2', to.y + oy);
    line.setAttribute('class', 'edge-line');
    Renderer.edgesLayer.appendChild(line);
  },
  drawTreeLabel(text, x, y) {
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    g.setAttribute('transform', `translate(${x},${y})`);
    const t = document.createElementNS(NS, 'text');
    t.setAttribute('class', 'cmp-label');
    t.textContent = text;
    g.appendChild(t);
    Renderer.labelsLayer.appendChild(g);
  },
};

Renderer.renderCompare = function() {
  this.clear();
  if (!State._compareTrees) return;
  const { bst, avl, rb } = State._compareTrees;
  const trees = [bst, avl, rb];
  const labels = ['BST', 'AVL', '红黑树'];
  const colors = ['#3b82f6', '#10b981', '#ef4444'];
  // 布局
  const W = 320, H = 440, gap = 60;
  trees.forEach((root, i) => {
    if (!root) return;
    const ox = i * (W + gap) + gap / 2;
    const pos = { x: ox + W / 2 };
    this.layoutBinary(root, 0, pos);
    root._cmpOx = ox; root._cmpOy = 60;
  });
  // 绘制每棵树
  trees.forEach((root, i) => {
    if (!root) return;
    // 遍历绘制
    const draw = (node) => {
      if (!node) return;
      node.x += root._cmpOx; node.y += root._cmpOy;
      // 边
      if (node.left) {
        const NS = 'http://www.w3.org/2000/svg';
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', node.x); line.setAttribute('y1', node.y);
        const lx = node.left.x + root._cmpOx, ly = node.left.y + root._cmpOy;
        node.left.x = lx; node.left.y = ly;
        line.setAttribute('x2', lx); line.setAttribute('y2', ly);
        line.setAttribute('class', 'edge-line');
        this.edgesLayer.appendChild(line);
        draw(node.left);
      }
      if (node.right) {
        const NS = 'http://www.w3.org/2000/svg';
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', node.x); line.setAttribute('y1', node.y);
        const rx = node.right.x + root._cmpOx, ry = node.right.y + root._cmpOy;
        node.right.x = rx; node.right.y = ry;
        line.setAttribute('x2', rx); line.setAttribute('y2', ry);
        line.setAttribute('class', 'edge-line');
        this.edgesLayer.appendChild(line);
        draw(node.right);
      }
      // 节点
      const NS = 'http://www.w3.org/2000/svg';
      const g = document.createElementNS(NS, 'g');
      g.setAttribute('transform', `translate(${node.x},${node.y})`);
      const circle = document.createElementNS(NS, 'circle');
      circle.setAttribute('r', '18');
      circle.setAttribute('class', 'node-circle tree-color-' + colors[i]);
      const text = document.createElementNS(NS, 'text');
      text.setAttribute('class', 'node-text');
      text.textContent = node.value;
      g.appendChild(circle); g.appendChild(text);
      // tooltip
      const tipNS = 'http://www.w3.org/2000/svg';
      const tipRect = document.createElementNS(tipNS, 'rect');
      const tipTxt = document.createElementNS(tipNS, 'text');
      tipRect.setAttribute('rx', '4'); tipRect.setAttribute('ry', '4');
      tipRect.setAttribute('fill', 'rgba(0,0,0,0.75)');
      tipRect.setAttribute('width', '0'); tipRect.setAttribute('height', '0');
      tipTxt.setAttribute('fill', '#fff'); tipTxt.setAttribute('font-size', '11');
      tipTxt.setAttribute('font-family', 'JetBrains Mono, Consolas, monospace');
      tipTxt.setAttribute('text-anchor', 'middle'); tipTxt.setAttribute('y', '4'); tipTxt.textContent = '';
      g.appendChild(tipRect); g.appendChild(tipTxt);
      g.style.cursor = 'pointer';
      g.addEventListener('mouseenter', () => {
        const lbl = `${labels[i]}: ${node.value}`;
        tipTxt.textContent = lbl;
        const tw = lbl.length * 7.5 + 8;
        tipRect.setAttribute('width', tw); tipRect.setAttribute('height', '16');
        tipRect.setAttribute('x', -tw / 2); tipRect.setAttribute('y', '-34');
        tipTxt.setAttribute('x', '0'); tipTxt.setAttribute('y', '-22');
      });
      g.addEventListener('mouseleave', () => {
        tipRect.setAttribute('width', '0'); tipRect.setAttribute('height', '0');
        tipTxt.textContent = '';
      });
      g.addEventListener('click', (e) => { e.stopPropagation(); Interaction.selectNode(node); });
      g.addEventListener('dblclick', (e) => { e.stopPropagation(); Interaction.editNode(node); });
      this.nodesLayer.appendChild(g);
    };
    draw(root);
    // 标签
    const lg = document.createElementNS(NS, 'g');
    lg.setAttribute('transform', `translate(${root._cmpOx + W / 2},48)`);
    const lt = document.createElementNS(NS, 'text');
    lt.setAttribute('class', 'cmp-label');
    lt.textContent = labels[i];
    lg.appendChild(lt);
    this.labelsLayer.appendChild(lg);
  });
  // 自动居中
  const totalW = trees.length * (W + gap) - gap;
  State.view.x = Math.max(0, -(totalW / 2 - this.svg.clientWidth / 2));
  State.view.y = 20;
  State.view.scale = 1;
  this.applyTransform();
};

/* ============================================================
   面板标签页切换
   ============================================================ */
function bindPanelTabs() {
  document.querySelectorAll('.ptab').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.ptab').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.sec').forEach(s => s.classList.remove('active'));
      btn.classList.add('active');
      const secId = 'sec-' + btn.dataset.sec;
      const sec = document.getElementById(secId);
      if (sec) sec.classList.add('active');
    });
  });
}

/* ============================================================
   主题初始化
   ============================================================ */
function initTheme() {
  const saved = localStorage.getItem('portal-theme');
  if (saved) document.documentElement.setAttribute('data-theme', saved);
  const icon = document.getElementById('themeIcon');
  if (icon) icon.textContent = document.documentElement.getAttribute('data-theme') === 'dark' ? '☽️' : '☀️';
}

/* ============================================================
   初始化入口
   ============================================================ */
function init() {
  Renderer.init();
  FloatingDialog.init();
  initTheme();
  updateInfoPanel();
  bindPanelDelegation();
  bindPanelTabs();
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchType(btn.dataset.type);
    });
  });

  // ——— 画布工具栏 ———
  const btnZoomIn  = document.getElementById('btnCanvasZoomIn');
  const btnZoomOut = document.getElementById('btnCanvasZoomOut');
  const btnReset   = document.getElementById('btnCanvasReset');
  const btnFs      = document.getElementById('btnCanvasFullscreen');
  if (btnZoomIn)  btnZoomIn.addEventListener('click',  () => { State.view.scale = Math.min(3, State.view.scale * 1.3); Renderer.applyTransform(); });
  if (btnZoomOut) btnZoomOut.addEventListener('click', () => { State.view.scale = Math.max(0.2, State.view.scale / 1.3); Renderer.applyTransform(); });
  if (btnReset)   btnReset.addEventListener('click',   () => { State.view = { x: 0, y: 0, scale: 1 }; Renderer.applyTransform(); });
  if (btnFs) {
    btnFs.addEventListener('click', () => {
      const wrapper = document.querySelector('.main-wrapper');
      State.fullscreen = !State.fullscreen;
      wrapper.classList.toggle('fullscreen', State.fullscreen);
      btnFs.textContent = State.fullscreen ? '⛶' : '⛶';
      btnFs.title = State.fullscreen ? '退出全屏 (Esc)' : '全屏';
      if (State.fullscreen) log('画布已全屏（按 Esc 退出）', 'action');
      else log('退出全屏', 'info');
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && State.fullscreen) {
        State.fullscreen = false;
        document.querySelector('.main-wrapper').classList.remove('fullscreen');
        log('退出全屏', 'info');
      }
    });
  }

  // ——— 面板折叠 ———
  const btnCL = document.getElementById('btnCollapseLeft');
  const btnCI = document.getElementById('btnCollapseInfo');
  const btnCLo = document.getElementById('btnCollapseLog');
  const leftPanel  = document.getElementById('leftPanel');
  const infoPanel  = document.querySelector('.info-panel');
  const logPanel   = document.querySelector('.log-panel');
  const mainWrapper = document.querySelector('.main-wrapper');
  if (btnCL) btnCL.addEventListener('click', () => {
    leftPanel.classList.toggle('collapsed');
    btnCL.textContent = leftPanel.classList.contains('collapsed') ? '▶' : '◀';
    btnCL.title = leftPanel.classList.contains('collapsed') ? '展开面板' : '收起面板';
    if (mainWrapper) mainWrapper.classList.toggle('left-collapsed', leftPanel.classList.contains('collapsed'));
  });
  if (btnCI) btnCI.addEventListener('click', () => {
    infoPanel.classList.toggle('collapsed');
    btnCI.textContent = infoPanel.classList.contains('collapsed') ? '◀' : '▶';
    btnCI.title = infoPanel.classList.contains('collapsed') ? '展开面板' : '收起面板';
    if (mainWrapper) mainWrapper.classList.toggle('right-collapsed', infoPanel.classList.contains('collapsed'));
  });
  if (btnCLo) btnCLo.addEventListener('click', () => {
    logPanel.classList.toggle('collapsed');
    btnCLo.textContent = logPanel.classList.contains('collapsed') ? '▲' : '▼';
    btnCLo.title = logPanel.classList.contains('collapsed') ? '展开日志' : '收起日志';
  });

  log('树结构可视化教学平台已加载', 'success');
  log('严蔚敏/王道 408 标准对齐，支持13类树结构', 'info');
  log('请选择Tab，输入序列后点「构建」生成树', 'info');
}
document.addEventListener('DOMContentLoaded', init);
