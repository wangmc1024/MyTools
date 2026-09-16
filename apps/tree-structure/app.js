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
  tree: null,                 // 当前树数据结构
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
  // 并查集
  unionFind: null,
  // 日志
  logCounter: 0,
  // 节点ID计数器
  idCounter: 0,
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
    return 1 + Math.max(this.height(node.left), this.height(node.right));
  },

  count(node) {
    if (!node) return 0;
    return 1 + this.count(node.left) + this.count(node.right);
  },

  countLeaves(node) {
    if (!node) return 0;
    if (!node.left && !node.right) return 1;
    return this.countLeaves(node.left) + this.countLeaves(node.right);
  },

  countDegree(node, deg) {
    if (!node) return 0;
    let d = 0;
    const c = (node.left ? 1 : 0) + (node.right ? 1 : 0);
    if (c === deg) d = 1;
    return d + this.countDegree(node.left, deg) + this.countDegree(node.right, deg);
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
      queue.push(n.left);
      queue.push(n.right);
    }
    return true;
  },

  // 遍历
  preOrder(node, result = []) {
    if (!node) return result;
    result.push(node);
    this.preOrder(node.left, result);
    this.preOrder(node.right, result);
    return result;
  },
  inOrder(node, result = []) {
    if (!node) return result;
    this.inOrder(node.left, result);
    result.push(node);
    this.inOrder(node.right, result);
    return result;
  },
  postOrder(node, result = []) {
    if (!node) return result;
    this.postOrder(node.left, result);
    this.postOrder(node.right, result);
    result.push(node);
    return result;
  },
  levelOrder(node) {
    if (!node) return [];
    const result = [], queue = [node];
    while (queue.length) {
      const n = queue.shift();
      result.push(n);
      if (n.left) queue.push(n.left);
      if (n.right) queue.push(n.right);
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
    // 简化：使用B树式插入但强调2/3利用率
    const result = this._insert(root, key);
    return result.root;
  },
  _insert(node, key) {
    let i = 0;
    while (i < node.keys.length && key > node.keys[i]) i++;
    if (node.leaf) {
      node.keys.splice(i, 0, key);
      let split = false;
      if (node.keys.length > this.maxKeys()) split = true;
      return { node, split, splitKey: node.keys[Math.floor(node.keys.length / 2)] };
    }
    const childResult = this._insert(node.children[i], key);
    if (!childResult.split) return { node, split: false };
    // 简化分裂
    if (node.keys.length > this.maxKeys()) {
      return { node, split: true, splitKey: node.keys[Math.floor(node.keys.length / 2)] };
    }
    return { node, split: false };
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
    if (uf.parent[x] === x) return x;
    if (compress) uf.parent[x] = this.find(uf, uf.parent[x], compress);
    return uf.parent[x];
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
  canvasGroup: null,

  init() {
    this.svg = document.getElementById('mainSvg');
    this.nodesLayer = document.getElementById('nodesLayer');
    this.edgesLayer = document.getElementById('edgesLayer');
    this.threadsLayer = document.getElementById('threadsLayer');
    this.labelsLayer = document.getElementById('labelsLayer');
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
    this.nodesLayer.innerHTML = '';
    this.edgesLayer.innerHTML = '';
    this.threadsLayer.innerHTML = '';
    this.labelsLayer.innerHTML = '';
  },

  // 计算二叉树布局（层次布局）
  layoutBinary(node, depth = 0, pos = { x: 0 }) {
    if (!node) return;
    this.layoutBinary(node.left, depth + 1, pos);
    node.x = pos.x * 60;
    node.y = depth * 70 + 40;
    pos.x++;
    this.layoutBinary(node.right, depth + 1, pos);
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
    line.setAttribute('class', 'edge-line' + (to.state === 'visited' || from.state === 'visited' ? ' active' : ''));
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

    const circle = document.createElementNS(NS, 'circle');
    circle.setAttribute('r', '18');
    let cls = 'node-circle';
    if (node.state === 'selected') cls += ' selected';
    else if (node.state === 'visited') cls += ' visited';
    else if (node.state === 'comparing') cls += ' comparing';
    else if (node.state === 'swapping') cls += ' swapping';
    else if (node.state === 'invalid') cls += ' invalid';

    // 红黑树颜色
    if (options.redBlack && node.color === 'red') cls = 'node-circle rb-red';
    if (options.redBlack && node.color === 'black') cls = 'node-circle rb-black';

    circle.setAttribute('class', cls);
    circle.setAttribute('data-id', node.id);

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

    // 点击选中
    g.addEventListener('click', (e) => {
      e.stopPropagation();
      Interaction.selectNode(node);
    });
    // 双击修改
    g.addEventListener('dblclick', (e) => {
      e.stopPropagation();
      Interaction.editNode(node);
    });
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
    const width = Math.max(40, node.keys.length * 30 + 10);
    if (node.leaf) {
      node.x = pos.x;
      node.y = depth * 80 + 40;
      pos.x += width + 10;
    } else {
      node.children.forEach(c => this.layoutBTree(c, depth + 1, pos));
      node.x = (node.children[0].x + node.children[node.children.length - 1].x) / 2;
      node.y = depth * 80 + 40;
    }
  },

  drawBTree(node, options = {}) {
    if (!node) return;
    const NS = 'http://www.w3.org/2000/svg';
    const g = document.createElementNS(NS, 'g');
    const w = Math.max(40, node.keys.length * 30 + 10);
    const h = 34;
    g.setAttribute('transform', `translate(${node.x - w / 2},${node.y - h / 2})`);

    const rect = document.createElementNS(NS, 'rect');
    rect.setAttribute('width', w);
    rect.setAttribute('height', h);
    rect.setAttribute('class', 'btree-node-bg' + (node.state === 'visited' ? ' visited' : ''));
    g.appendChild(rect);

    // 分隔线 + 关键字
    node.keys.forEach((k, i) => {
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
    if (!node.leaf) {
      node.children.forEach((child, i) => {
        const line = document.createElementNS(NS, 'line');
        line.setAttribute('x1', node.x);
        line.setAttribute('y1', node.y + h / 2);
        line.setAttribute('x2', child.x);
        line.setAttribute('y2', child.y - h / 2);
        line.setAttribute('class', 'edge-line');
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

  // 主渲染入口
  render() {
    const type = State.currentType;
    const tree = State.tree;
    if (type === 'btree') {
      this.renderBTree(tree);
    } else if (type === 'bplustree' || type === 'bstar') {
      this.renderBTree(tree); // 复用矩形渲染
    } else if (type === 'heap') {
      this.renderHeap(State.heapArr || [null]);
    } else if (type === 'disjoint') {
      this.renderForest(State.unionFind ? UnionFindOps.buildForest(State.unionFind) : []);
    } else if (type === 'forest') {
      this.renderForest(Array.isArray(tree) ? tree : (tree ? [tree] : []));
    } else if (type === 'avl') {
      this.renderBinary(tree, { showBF: true });
    } else if (type === 'rbtree') {
      this.renderBinary(tree, { redBlack: true });
    } else if (type === 'threaded') {
      this.renderBinary(tree, { threaded: true });
    } else {
      this.renderBinary(tree);
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
    Renderer.render();
    log(`选中节点 ${node.value}`, 'action');
  },

  editNode(node) {
    const newVal = prompt('输入新数值:', node.value);
    if (newVal === null) return;
    const num = parseInt(newVal);
    if (isNaN(num)) { log('输入非法！', 'error'); return; }
    log(`修改节点 ${node.value} → ${num}`, 'action');
    node.value = num;
    rebuildTree();
    Renderer.render();
    updateStatus();
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
      const heightB = (n) => n ? 1 + (n.children.length ? Math.max(...n.children.map(heightB)) : 0) : 0;
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
    if (State.tree) {
      const clearStates = (n) => {
        if (!n) return;
        n.state = 'normal';
        clearStates(n.left); clearStates(n.right);
      };
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
  const type = State.currentType;
  let root = State.tree;
  if (type === 'heap') root = HeapOps.arrayToTree(State.heapArr);
  if (type === 'disjoint') {
    const forest = UnionFindOps.buildForest(State.unionFind);
    root = forest[0] || null;
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
function bindEvents() {
  // Tab 切换
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      switchType(btn.dataset.type);
    });
  });

  // 构建
  document.getElementById('btnBuild').addEventListener('click', () => {
    const seq = parseInput(document.getElementById('inputSeq').value);
    if (seq === null) return;
    if (State.currentType !== 'disjoint' && new Set(seq).size !== seq.length) {
      log('警告：存在重复值，部分结构（BST/AVL/红黑树）将忽略重复', 'warn');
    }
    buildTree(seq);
  });

  // 随机生成
  document.getElementById('btnRandom').addEventListener('click', () => {
    const count = parseInt(document.getElementById('randomCount').value);
    const max = parseInt(document.getElementById('randomMax').value);
    const seq = [];
    const used = new Set();
    while (seq.length < count) {
      const v = Math.floor(Math.random() * max) + 1;
      if (!used.has(v)) { used.add(v); seq.push(v); }
    }
    document.getElementById('inputSeq').value = seq.join(',');
    log(`随机生成 ${count} 个节点: [${seq.join(', ')}]`, 'info');
    buildTree(seq);
  });

  // 清空
  document.getElementById('btnClear').addEventListener('click', () => {
    State.tree = null;
    State.heapArr = null;
    State.unionFind = null;
    State.selectedNode = null;
    document.getElementById('inputSeq').value = '';
    Renderer.clear();
    updateStatus();
    document.getElementById('statusValid').textContent = '—';
    document.getElementById('statusValid').className = 'value';
    document.getElementById('infoValidation').innerHTML = '';
    clearLog();
    log('已清空', 'info');
  });

  // 随机数量显示
  document.getElementById('randomCount').addEventListener('input', (e) => {
    document.getElementById('randomCountVal').textContent = e.target.value;
  });
  document.getElementById('randomMax').addEventListener('input', (e) => {
    document.getElementById('randomMaxVal').textContent = e.target.value;
  });

  // 动画控制
  document.getElementById('btnPlay').addEventListener('click', () => {
    if (!Animator.steps.length) {
      log('请先选择遍历方式或操作', 'warn');
      return;
    }
    Animator.play();
    log('动画播放', 'action');
  });
  document.getElementById('btnPause').addEventListener('click', () => Animator.pause());
  document.getElementById('btnStep').addEventListener('click', () => Animator.step());
  document.getElementById('btnReset').addEventListener('click', () => Animator.reset());

  // 速度
  document.getElementById('animSpeed').addEventListener('input', (e) => {
    State.animSpeed = parseInt(e.target.value) / 5;
    document.getElementById('speedVal').textContent = State.animSpeed.toFixed(1) + 'x';
  });

  // 遍历
  document.querySelectorAll('.btn-traverse').forEach(btn => {
    btn.addEventListener('click', () => {
      const steps = generateTraversalSteps(btn.dataset.traverse);
      if (steps.length) {
        Animator.setSteps(steps);
        log(`生成 ${steps.length} 步动画，点击播放`, 'action');
      }
    });
  });

  // B树阶数
  document.getElementById('btnIncOrder').addEventListener('click', () => {
    State.btreeOrder = Math.min(7, State.btreeOrder + 1);
    document.getElementById('orderDisplay').textContent = State.btreeOrder;
    rebuildAfterOrderChange();
  });
  document.getElementById('btnDecOrder').addEventListener('click', () => {
    State.btreeOrder = Math.max(3, State.btreeOrder - 1);
    document.getElementById('orderDisplay').textContent = State.btreeOrder;
    rebuildAfterOrderChange();
  });

  // 堆类型
  document.getElementById('btnMaxHeap').addEventListener('click', () => {
    State.heapType = 'max';
    document.getElementById('btnMaxHeap').classList.add('active');
    document.getElementById('btnMinHeap').classList.remove('active');
    rebuildHeap();
  });
  document.getElementById('btnMinHeap').addEventListener('click', () => {
    State.heapType = 'min';
    document.getElementById('btnMinHeap').classList.add('active');
    document.getElementById('btnMaxHeap').classList.remove('active');
    rebuildHeap();
  });

  // 错误演示
  document.getElementById('btnWrongDemo').addEventListener('click', generateWrongDemo);

  // 清空日志
  document.getElementById('btnClearLog').addEventListener('click', clearLog);

  // 对比模式
  document.getElementById('btnCompareMode').addEventListener('click', () => {
    log('对比模式：同时构建 BST/AVL/红黑树 对比相同序列', 'action');
    const seq = parseInput(document.getElementById('inputSeq').value);
    if (!seq || !seq.length) { log('请先输入序列', 'warn'); return; }
    log(`序列 [${seq.join(',')}] 三树对比:`, 'action');
    const bst = BSTOps.buildFromSeq(seq);
    const avl = AVLOps.buildFromSeq(seq);
    const rb = RBOps.buildFromSeq(seq);
    log(`BST 高度: ${BinaryTreeOps.height(bst)}`, 'info');
    log(`AVL 高度: ${BinaryTreeOps.height(avl)}`, 'info');
    log(`红黑树高度: ${BinaryTreeOps.height(rb)}`, 'info');
    log('对比结论：BST 可能退化为链表，AVL 最严格平衡，红黑树放宽平衡减少旋转', 'success');
  });
}

function rebuildAfterOrderChange() {
  const seq = parseInput(document.getElementById('inputSeq').value);
  if (seq && seq.length) buildTree(seq);
}

function rebuildHeap() {
  const seq = parseInput(document.getElementById('inputSeq').value);
  if (seq && seq.length) buildTree(seq);
}

/* ============================================================
   类型切换
   ============================================================ */
function switchType(type) {
  State.currentType = type;
  State.tree = null;
  State.heapArr = null;
  State.unionFind = null;
  State.selectedNode = null;
  Animator.reset();
  Renderer.clear();
  updateInfoPanel();
  updateStatus();
  document.getElementById('statusValid').textContent = '—';
  document.getElementById('statusValid').className = 'value';
  document.getElementById('infoValidation').innerHTML = '';

  // 显示/隐藏特定控制
  document.getElementById('btreeOrderSection').style.display =
    (type === 'btree' || type === 'bplustree' || type === 'bstar') ? 'block' : 'none';
  document.getElementById('heapTypeSection').style.display =
    (type === 'heap') ? 'block' : 'none';
  document.getElementById('unionFindSection').style.display =
    (type === 'disjoint') ? 'block' : 'none';

  // 更新专属按钮
  const specific = document.getElementById('specificButtons');
  specific.innerHTML = '';

  if (type === 'bst') {
    specific.innerHTML = `
      <input type="number" id="bstOpValue" placeholder="值" class="num-input">
      <button id="btnBstInsert" class="btn-primary">插入</button>
      <button id="btnBstDelete" class="btn-danger">删除</button>
      <button id="btnBstSearch" class="btn-secondary">查找</button>
    `;
    setTimeout(() => {
      document.getElementById('btnBstInsert').addEventListener('click', () => bstOp('insert'));
      document.getElementById('btnBstDelete').addEventListener('click', () => bstOp('delete'));
      document.getElementById('btnBstSearch').addEventListener('click', () => bstOp('search'));
    }, 0);
  } else if (type === 'avl') {
    specific.innerHTML = `<p style="font-size:11px;color:var(--color-text-secondary)">AVL 自动平衡，插入时自动旋转</p>`;
  } else if (type === 'rbtree') {
    specific.innerHTML = `<p style="font-size:11px;color:var(--color-text-secondary)">红黑树自动修复五大性质</p>`;
  } else if (type === 'disjoint') {
    specific.innerHTML = `
      <div class="btn-row">
        <input type="number" id="ufX" placeholder="x" class="num-input">
        <input type="number" id="ufY" placeholder="y" class="num-input">
        <button id="btnUnion" class="btn-primary">Union</button>
        <button id="btnFind" class="btn-secondary">Find</button>
      </div>
    `;
    setTimeout(() => {
      document.getElementById('btnUnion').addEventListener('click', ufUnion);
      document.getElementById('btnFind').addEventListener('click', ufFind);
    }, 0);
  }

  log(`切换到 ${KNOWLEDGE[type].name}`, 'action');
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

/* ============================================================
   错误结构演示
   ============================================================ */
function generateWrongDemo() {
  const type = State.currentType;
  log('【错误演示】生成非法结构让学生识别', 'action');

  if (type === 'bst') {
    // 构建非BST：左孩子大于根
    const root = makeNode(50);
    root.left = makeNode(70);  // 错！70 > 50
    root.right = makeNode(30); // 错！30 < 50
    root.left.parent = root; root.right.parent = root;
    State.tree = root;
    log('生成错误BST：左孩子70 > 根50，违反左小右大', 'error');
  } else if (type === 'avl') {
    // 构建失衡树（不旋转的BST）
    const root = makeNode(10);
    root.left = makeNode(8);
    root.left.left = makeNode(5);
    root.left.left.left = makeNode(2);
    // 不做AVL旋转，导致失衡
    State.tree = root;
    log('生成失衡AVL：左子树过高，BF>1', 'error');
  } else if (type === 'complete') {
    // 非完全二叉树：最后一层右侧有节点但左侧空缺
    const root = makeNode(1);
    root.left = makeNode(2);
    root.right = makeNode(3);
    root.left.left = null;  // 左空
    root.left.right = makeNode(5);  // 右有 → 非完全
    State.tree = root;
    log('生成非完全二叉树：最后一层不连续', 'error');
  } else if (type === 'heap') {
    // 非法堆：父小于子（大根堆）
    State.heapArr = [null, 3, 10, 5, 20]; // 20 是 10 的孩子但 20>10
    State.tree = HeapOps.arrayToTree(State.heapArr);
    log('生成错误大根堆：节点3的子节点10>3', 'error');
  } else if (type === 'rbtree') {
    // 连续两个红节点
    const root = makeNode(10); root.color = 'black';
    root.left = makeNode(5); root.left.color = 'red';
    root.left.left = makeNode(2); root.left.left.color = 'red'; // 错！红→红
    State.tree = root;
    log('生成错误红黑树：连续红节点（违反性质④）', 'error');
  } else {
    log('当前结构无错误演示模板，可手动双击节点修改制造错误', 'warn');
  }
  Renderer.render();
  updateStatus();
  updateValidation();
}

/* ============================================================
   主题与初始化
   ============================================================ */
function initTheme() {
  const saved = getTheme();
  setTheme(saved);
  const icon = document.getElementById('portalThemeIcon');
  if (icon) icon.textContent = saved === 'dark' ? '☀️' : '☽️';
}

function init() {
  Renderer.init();
  initTheme();
  updateInfoPanel();
  bindEvents();
  log('树结构可视化教学平台已加载', 'success');
  log('严蔚敏/王道 408 标准对齐，支持13类树结构', 'info');
  log('请选择Tab并输入序列构建', 'info');

  // 默认构建示例
  document.getElementById('inputSeq').value = '50,30,70,20,40,60,80';
}

document.addEventListener('DOMContentLoaded', init);
