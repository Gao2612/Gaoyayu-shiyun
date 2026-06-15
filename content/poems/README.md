# 诗歌 Markdown 格式

每首诗使用一个 Markdown 文件，文件名建议采用
`编号-标题.md`，例如 `001-晨雾.md`。

```yaml
---
id: "001"
title: "晨雾"
writtenAt: "2024-01-08"
tags:
  - 清晨
  - 城市
location: "杭州"
collection: "未归档"
emotions:
  - 安静
featured: false
rating: 3
relatedPoemIds: []
---
```

Front Matter 之后是诗歌正文，支持普通 Markdown 换行。

必填字段：

- `id`：唯一编号，推荐使用三位数字字符串。
- `title`：非空标题。
- `writtenAt`：有效的 `YYYY-MM-DD` 日期。
- `tags`：至少包含一个非空标签。

可选字段：

- `location`：创作地点，省略时为 `null`。
- `collection`：诗集名称，省略时为“未归档”。
- `emotions`：情绪标签列表，省略时为空数组。
- `featured`：是否重点展示，省略时为 `false`。
- `rating`：一至五的整数，省略时为 `3`。
- `relatedPoemIds`：相关诗歌编号，省略时为空数组。

运行 `npm run data:build` 后，数据会写入
`data/poems.json`。空标题、空正文、重复编号或非法字段会使
命令失败，并输出对应文件和具体原因。
