# ⚡ AI Doc Generator

[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Available-brightgreen)](https://github.com/marketplace)
[![DeepSeek](https://img.shields.io/badge/AI-DeepSeek_V4-4B93BF)](https://deepseek.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-green)](LICENSE)
[![version](https://img.shields.io/badge/version-v3.1.0-purple)](https://github.com/s544vrmd4t-del/doc-generator/releases)

> 代码变更自动生成中文注释和文档，DeepSeek V4 驱动，支持多种语言和输出格式。

---

## 🚀 同系列 Action 全家桶

| Action | 用途 | 状态 |
|--------|------|------|
| [🤖 AI Code Review](https://github.com/s544vrmd4t-del/code-review-bot) | PR 自动 AI 代码审查 | :white_check_mark: 已发布 |
| [:book: AI PR Summarizer](https://github.com/s544vrmd4t-del/pr-summarizer) | 长 PR 一键中文总结 | :white_check_mark: 已发布 |
| [:lock: AI Security Scanner](https://github.com/s544vrmd4t-del/security-scanner) | 安全漏洞自动扫描 | :white_check_mark: 已发布 |
| [:clipboard: AI Release Notes](https://github.com/s544vrmd4t-del/release-notes) | 自动生成 Release Notes | :white_check_mark: 已发布 |
| [:memo: AI Doc Generator](https://github.com/s544vrmd4t-del/doc-generator) | 自动生成代码文档 | :white_check_mark: 已发布 |
| [:test_tube: AI Test Writer](https://github.com/s544vrmd4t-del/test-writer) | 自动生成单元测试 | :white_check_mark: 已发布 |

> :bulb: **建议组合使用**: 在 Workflow 中串联多个 Action 实现 PR 审查 + 安全扫描 + 文档生成一站式自动化。

---

## 快速使用

```yaml
# .github/workflows/doc-generator.yml
name: AI Doc Generator

on:
  pull_request:
    types: [opened, synchronize]

permissions:
  contents: read
  pull-requests: write

jobs:
  run:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: s544vrmd4t-del/doc-generator@v1
        with:
          api_key: ${{ secrets.DEEPSEEK_API_KEY }}
```

---

## 效果示例

```
⚡ AI AI Doc Generator — 文档生成

:bar_chart: 报告摘要
- 共扫描/处理 X 个文件
- 发现问题/生成内容 Y 项
- 耗时 Z 秒

:white_check_mark: 详细结果见评论区
```

---

## 配置项

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `api_key` | (必填) | DeepSeek API Key |
| `model` | `deepseek-chat` | 模型名称 |
| `base_url` | `https://api.deepseek.com/v1` | API 端点 |
| `language` | `zh-CN` | 输出语言 |
| `max_tokens` | `2000` | 最大输出 token 数 |

---

## 定价

| 方案 | 价格 |
|------|------|
| 公开仓库 | 免费 |
| 私人仓库 | $9/月 |

---

## 隐私声明

- 代码仅发送到 DeepSeek API 用于处理
- 不存储、不记录、不训练
- 所有处理在 GitHub Actions 运行环境中完成

---

## 相关资源

- [DeepSeek API 文档](https://platform.deepseek.com/docs)
- [GitHub Actions 文档](https://docs.github.com/actions)
- [所有同系列 Action](https://github.com/s544vrmd4t-del?tab=repositories)

---

<p align="center">
  Made with ⚡ by AI Toolchain
</p>
