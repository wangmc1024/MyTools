# update-devlog

为 Gizmo Galaxy 的开发时间线 (`devlog/timeline.json`) 添加新条目。

## 触发条件

- 用户说"更新日志"、"添加日志条目"、"update devlog"
- 重大功能发布或里程碑达成后
- `/git-sync` 完成后可选触发

## 执行步骤

### 1. 获取上次记录的日期

```bash
cat devlog/timeline.json | python3 -c "import json,sys; d=json.load(sys.stdin); print(d[-1]['date'])"
```

### 2. 拉取新提交

```bash
git log --oneline --date=short --format="%H|%ad|%s" --since="<last_date>"
```

### 3. 合并分组

- 同一天的多个提交合并为一个事件
- 按功能相关性分组（而非严格按时间）
- 合并后 commit hash 数组取各提交的前 7 位

### 4. 生成条目 JSON

```json
{
  "date": "2026-09-15",
  "label": "September 2026",
  "title": "简短标题",
  "icon": "🔧",
  "type": "feature",
  "description": "1-2 句中文事实性描述，简洁直接。",
  "tags": ["标签1", "标签2"],
  "commits": ["abc1234", "def5678"]
}
```

**字段规则：**
- `date`: 真实提交日期 (YYYY-MM-DD)
- `label`: 仅当该条目跨入新月份时设置（如 `"September 2026"`），同月内不重复
- `title`: 中文或中英混合，简短
- `type`: 从以下选一 — `milestone` | `feature` | `refactor` | `maintenance`
- `description`: 简洁事实性，说明做了什么，不渲染情感
- `tags`: 2-4 个相关标签
- `commits`: 该事件关联的 commit hash 前 7 位数组

### 5. 写入文件

用 Edit 工具在 `timeline.json` 的 `]` 之前追加新条目（确保前面的 `}` 后加逗号）。

### 6. 验证

```bash
python3 -c "import json; json.load(open('devlog/timeline.json'))" && echo "JSON valid"
```

## 描述风格

- **要**: 简洁、事实性、说清楚做了什么
- **不要**: 抒情、感叹号、比喻渲染
- ✅ 「Article Reader 接入百度翻译 API，通过 Cloudflare Worker 代理实现渐进式翻译。」
- ❌ 「翻译能力的飞速提升让 Galaxy 越过了语言的边界！」

## 合并策略

- 多个 bug 修复 → 合并为一个 maintenance 条目
- 一个大 feature 拆了多次 commit → 合并为一个 feature 条目
- 无关功能的 commit → 分开写成不同条目
- 事件之间保持合理的节奏感，不要挤在一起
