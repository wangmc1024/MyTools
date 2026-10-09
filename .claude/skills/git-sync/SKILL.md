---
name: git-sync
description: 自动执行 Git add/commit/push 流程
---

# git-sync: Git 自动同步工具

## 任务

你需要执行完整的 Git 同步流程：

1. **检查当前状态**: `git status` 查看变更
2. **暂存所有变更**: `git add .`
3. **提交**:
   - 如果用户提供了信息：直接使用
   - 如果没有：根据变更文件自动生成提交信息
4. **推送到远程**: `git push`

## 自动生成提交信息的规则

根据变更文件类型生成：
- 新增 Web 应用 → `feat: 添加新工具: xxx`
- 修改代码/文档 → `refactor: 优化 xxx`
- 更新配置/JSON → `chore: 更新配置`
- 多种变更 → `更新: 多项调整`

## 现在开始

请先执行 `git status` 查看当前状态，然后询问用户确认，或按以上规则继续。
