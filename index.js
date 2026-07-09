#!/usr/bin/env node
/**
 * AI Code Reviewer — GitHub Action v2.0
 * PR 自动审查 + 行内评论 + 总结报告
 */

const fs = require("fs");
const path = require("path");

// ============ 配置加载 ============

const CONFIG = {
  apiKey: process.env.INPUT_API_KEY || "",
  model: process.env.INPUT_MODEL || "deepseek-chat",
  baseUrl: process.env.INPUT_BASE_URL || "https://api.deepseek.com/v1",
  reviewScope: process.env.INPUT_REVIEW_SCOPE || "changed",
  language: process.env.INPUT_LANGUAGE || "zh-CN",
  maxTokens: parseInt(process.env.INPUT_MAX_TOKENS || "2000", 10),
};

const GITHUB = {
  token: process.env.GITHUB_TOKEN || "",
  repository: process.env.GITHUB_REPOSITORY || "",
  eventPath: process.env.GITHUB_EVENT_PATH || "",
  eventName: process.env.GITHUB_EVENT_NAME || "",
};

// ============ GitHub API 封装 ============

async function githubApi(endpoint, opts = {}) {
  const url = endpoint.startsWith("http")
    ? endpoint
    : `https://api.github.com/repos/${GITHUB.repository}/${endpoint.replace(/^\//, "")}`;

  const headers = {
    Authorization: `Bearer ${GITHUB.token}`,
    Accept: "application/vnd.github+json",
    "User-Agent": "CodeReviewBot/2.0",
    ...opts.headers,
  };

  const resp = await fetch(url, { ...opts, headers });
  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`GitHub API ${resp.status}: ${body.slice(0, 300)}`);
  }
  return resp.json();
}

// ============ PR 信息提取 ============

function getPRFromEvent() {
  if (!GITHUB.eventPath || !fs.existsSync(GITHUB.eventPath)) {
    throw new Error("无法读取 GitHub Event: event_path 不存在");
  }
  const event = JSON.parse(fs.readFileSync(GITHUB.eventPath, "utf-8"));

  if (event.pull_request) {
    return {
      number: event.pull_request.number,
      title: event.pull_request.title,
      body: event.pull_request.body || "",
      base: event.pull_request.base.ref,
      head: event.pull_request.head.ref,
      headSha: event.pull_request.head.sha,
      url: event.pull_request._links?.html?.href || event.pull_request.html_url,
      diffUrl: event.pull_request.diff_url,
    };
  }

  throw new Error(`不支持的事件类型: ${GITHUB.eventName}`);
}

// ============ 内联评论解析 ============

/**
 * 从 AI 审查结果中提取可定位到具体行的发现
 * 匹配格式: - 【位置】文件名:行号
 */
function parseInlineFindings(reviewText) {
  const findings = [];
  const lines = reviewText.split("\n");

  let currentFinding = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // 匹配 【位置】文件名:行号
    const match = line.match(/【位置】\s*(\S+)\s*:\s*(\d+)(?:\s*[-–]\s*(\d+))?/);
    if (match) {
      if (currentFinding) findings.push(currentFinding);

      const file = match[1];
      const lineNum = parseInt(match[2], 10);
      const endLine = match[3] ? parseInt(match[3], 10) : lineNum;

      // 获取上下文（问题描述）
      let body = "";
      for (let j = i + 1; j < Math.min(i + 5, lines.length); j++) {
        if (lines[j].includes("【位置】")) break;
        if (lines[j].trim()) {
          body += lines[j].trim() + "\n";
        }
      }
      body = body.replace(/^【[^】]+】\s*/gm, "").trim();

      if (body) {
        currentFinding = { file, line: lineNum, endLine, body };
      }
    }
  }
  if (currentFinding) findings.push(currentFinding);

  return findings;
}

/**
 * 从 diff 中计算 GitHub 行内评论所需的 position
 * 简化版：用 line 参数直接定位（GitHub API 支持新的 line/side 参数）
 */
function buildInlineComments(findings, changedFiles) {
  return findings
    .filter((f) => changedFiles.some((cf) => cf.endsWith(f.file) || cf === f.file))
    .map((f) => ({
      path: f.file,
      line: f.line,
      side: "RIGHT",
      body: `🤖 ${f.body}`,
    }));
}

// ============ AI 审查核心 ============

const SYSTEM_PROMPT = `你是技术文档工程师。审查代码变更，检查文档完整性。

## 扫描维度
1. 新增函数/类是否有注释
2. 复杂逻辑是否有说明
3. 公共 API 是否有使用示例
4. 配置项是否有文档

## 输出格式

### 📄 缺失文档
- 【位置】文件名:行号
- 【缺失】缺少什么文档
- 【建议】建议添加的内容

### ✅ 文档良好的部分
- 列出文档质量好的代码

如果没有文档问题，说"✅ 文档完整"。`;

async function reviewDiff(diff) {
  if (!diff || diff.trim().length === 0) {
    return "无法获取代码变更内容，请检查 PR diff。";
  }

  const MAX_DIFF = 30000;
  const truncated = diff.length > MAX_DIFF
    ? diff.slice(0, MAX_DIFF) + "\n\n... (diff 过大，已截断)"
    : diff;

  const userPrompt = `请审查以下代码变更：\n\n\`\`\`diff\n${truncated}\n\`\`\``;

  const resp = await fetch(`${CONFIG.baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${CONFIG.apiKey}`,
    },
    body: JSON.stringify({
      model: CONFIG.model,
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: userPrompt },
      ],
      max_tokens: CONFIG.maxTokens,
      temperature: 0.1,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`DeepSeek API ${resp.status}: ${err.slice(0, 500)}`);
  }

  const data = await resp.json();
  return data.choices?.[0]?.message?.content || "审查未生成有效输出";
}

// ============ 发布 ============

async function postPRComment(prNumber, body) {
  return githubApi(`/issues/${prNumber}/comments`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      body: `🤖 **AI 代码审查报告** — DocGenerator v1.0\n\n${body}\n\n---\n<sub>由 DeepSeek 驱动 | 范围: ${CONFIG.reviewScope}</sub>`,
    }),
  });
}

/**
 * 创建带行内评论的 PR Review
 */
async function createPRReview(prNumber, headSha, comments, summaryBody) {
  if (!comments || comments.length === 0) return null;

  // 限制评论数量
  const limited = comments.slice(0, 10);

  return githubApi(`/pulls/${prNumber}/reviews`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      commit_id: headSha,
      body: `🤖 **AI Doc Generator标记** — 共 ${limited.length} 条\n\n${summaryBody ? summaryBody.slice(0, 500) : ""}`,
      event: "COMMENT",
      comments: limited,
    }),
  });
}

// ============ 主流程 ============

async function main() {
  if (!CONFIG.apiKey) throw new Error("缺少 API Key!");
  if (!GITHUB.token) throw new Error("缺少 GITHUB_TOKEN!");

  console.log("🤖 DocGenerator v1.0 启动...");
  console.log(`  模型: ${CONFIG.model}`);

  // 1. 获取 PR 信息
  const pr = getPRFromEvent();
  console.log(`  PR: #${pr.number} — ${pr.title}`);

  // 2. 获取 diff
  let diff;
  if (pr.diffUrl) {
    const resp = await fetch(pr.diffUrl, {
      headers: { Authorization: `Bearer ${GITHUB.token}`, Accept: "application/vnd.github.diff" },
    });
    diff = resp.ok ? await resp.text() : "";
  } else {
    const compareData = await githubApi(`/compare/${pr.base}...${pr.head}`);
    diff = compareData.diff || compareData.files?.map(f => f.patch).join("\n") || "";
  }
  console.log(`  diff: ${diff.length} 字符`);

  // 3. AI 审查
  console.log("  AI 审查中...");
  const review = await reviewDiff(diff);
  console.log(`  审查完成 (${review.length} 字)`);

  // 4. 发布总结评论
  await postPRComment(pr.number, review);
  console.log("✅ 总结评论已发布");

  // 5. 发布行内评论
  const findings = parseInlineFindings(review);
  if (findings.length > 0 && pr.headSha) {
    // 获取变更文件列表
    const prData = await githubApi(`/pulls/${pr.number}/files?per_page=50`);
    const changedFiles = prData.map(f => f.filename);

    const inlineComments = buildInlineComments(findings, changedFiles);
    console.log(`  解析到 ${findings.length} 个发现，${inlineComments.length} 条可定位到代码行`);

    if (inlineComments.length > 0) {
      await createPRReview(pr.number, pr.headSha, inlineComments);
      console.log("✅ 行内评论已发布");
    }
  }
}

main().catch((err) => {
  console.error(`❌ 失败: ${err.message}`);
  process.exit(1);
});
