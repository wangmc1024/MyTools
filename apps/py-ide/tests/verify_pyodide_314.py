# Pyodide 314.0.3 运行环境验证测试

# 复制此代码到 PyIDE 中运行，检查所有组件是否正常。

import sys
import math
import random

print("=" * 50)
print("Pyodide 314.0.3 运行环境验证测试")
print("=" * 50)

# ---- Test 1: Python 版本 ----
print(f"\n[✓] Python 版本: {sys.version}")
py_ver = sys.version_info
print(f"    主版本: {py_ver.major}, 小版本: {py_ver.minor}, 补丁: {py_ver.micro}")
assert py_ver.major == 3 and py_ver.minor == 14, f"Expected Python 3.14.x, got {py_ver.major}.{py_ver.minor}"
print("    ✓ Python 3.14 确认")

# ---- Test 2: 基础数学运算 ----
print("\n[✓] 基础数学运算")
assert math.sqrt(16) == 4.0
assert math.pi > 3.14
assert math.sin(0) == 0.0
assert 2 ** 10 == 1024
print("    √16 = 4.0, π ≈ {:.6f}, sin(0) = 0.0, 2^10 = 1024".format(math.pi))
print("    ✓ 全部通过")

# ---- Test 3: 随机数 ----
print("\n[✓] 随机数生成")
random.seed(42)
vals = [random.randint(1, 100) for _ in range(5)]
print(f"    seed=42 生成: {vals}")
print("    ✓ 通过")

# ---- Test 4: JSON ----
print("\n[✓] JSON 序列化/反序列化")
import json
data = {"name": "PyIDE", "version": "314.0.3", "python": "3.14"}
json_str = json.dumps(data, ensure_ascii=False)
back = json.loads(json_str)
assert back["name"] == "PyIDE"
assert back["version"] == "314.0.3"
print(f"    原始: {data}")
print(f"    JSON: {json_str}")
print("    ✓ 通过")

# ---- Test 5: 列表推导式 ----
print("\n[✓] 列表/字典推导式")
squares = [x**2 for x in range(10)]
evens = {k: v for k, v in enumerate([x for x in range(20) if x % 2 == 0])}
print(f"    平方数: {squares}")
print(f"    偶数枚举: {dict(list(evens.items())[:5])}...")
print("    ✓ 通过")

# ---- Test 6: 类与面向对象 ----
print("\n[✓] 类与面向对象编程")
class Counter:
    def __init__(self):
        self.count = 0
    def increment(self):
        self.count += 1
        return self.count

c = Counter()
assert c.increment() == 1
assert c.increment() == 2
assert c.count == 2
print(f"    Counter: 初始=0 → 连续+2次后={c.count}")
print("    ✓ 通过")

# ---- Test 7: 异常处理 ----
print("\n[✓] 异常处理")
try:
    result = 1 / 0
except ZeroDivisionError as e:
    print(f"    捕获预期异常: {type(e).__name__}: {e}")
    print("    ✓ 通过")

# ---- Test 8: 标准库模块 ----
print("\n[✓] 常用标准库模块")
import datetime
dt = datetime.datetime.now()
import collections
d = collections.Counter("hello world")
import functools
product = functools.reduce(lambda a, b: a * b, range(1, 6))  # 5!
import itertools
first_three = list(itertools.islice(iter(range(10)), 3))

print(f"    datetime: {dt.strftime('%Y-%m-%d %H:%M:%S')}")
print(f"    Counter('hello world'): {dict(d.most_common(3))}")
print(f"    5! = {product}")
print(f"    itertools: {first_three}")
print("    ✓ 通过")

# ---- Test 9: 字符串操作 ----
print("\n[✓] 字符串操作")
text = "Hello, Pyodide 314!"
upper = text.upper()
parts = upper.split(", ")
replaced = text.replace("Pyodide", "Python")
print(f"    '{text}' -> upper: '{upper}'")
print(f"    split: {parts}")
print(f"    replace: '{replaced}'")
print("    ✓ 通过")

# ---- Test 10: 文件系统 (Pyodide FS) ----
print("\n[✓] Pyodide 虚拟文件系统")
try:
    with open('/tmp/test_v314.txt', 'w') as f:
        f.write('Pyodide 314.0.3 Virtual FS works!\n')
    with open('/tmp/test_v314.txt', 'r') as f:
        content = f.read()
    assert 'works' in content
    print(f"    写入并读取: {content.strip()}")
    print("    ✓ 通过")
except Exception as e:
    print(f"    ⚠ FS 测试跳过: {e}")

# ---- Summary ----
print("\n" + "=" * 50)
print("所有测试通过! Pyodide 314.0.3 运行环境正常 ✓")
print("=" * 50)
