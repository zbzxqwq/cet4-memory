---
name: cet4-daily-memo
description: Generate and track a daily CET-4 vocabulary plan (default 50 words) from the 四级记忆 word database, writing the day's 抄写 (copy, words only) and 默写 (dictation, word + meaning) Word tables into the user's study folders. Use for daily 四级/四级记忆 word assignment, "今天学哪些单词" requests, study reminders, or regenerating a day's word list.
metadata:
  short-description: 自动排四级每日单词表
---

# 四级记忆 · 每日单词计划

给正在准备英语四级的学生每天排一份单词表，并跟踪哪些已经掌握。

## 工作方式

所有路径都写在技能目录下的 `config.json` 里（相对路径以该文件为基准）：

- `dbPath` —— 词库，即 `四级记忆/words.js`
- `progressPath` —— 学习进度，即 `四级记忆/data/进度.json`
- `copyDir` / `dictationDir` —— 抄写、默写文件夹

排词规则固定为：

1. 已掌握的单词**永远不再出现**（`progress.json` 的 `mastered` 列表）；
2. 之前点过"还不会"的词**优先排在最前面**，错得越多越靠前；
3. 其余新词按考试重要程度排序：`1 核心必考 → 2 高频常考 → 3 常考 → 4 拓展`；
4. 同等级内部按日期固定打乱，所以同一天重复运行结果一致，每天又有新变化。

## 排今天的计划

```bash
python scripts/daily_plan.py
```

会用 `config.json` 里的 `dailyCount`（默认 50）排好今天，并写出：

- `抄写/M.D.docx` —— 只有「序号 + 单词」，给学生照着抄；
- `默写/M.D.docx` —— 「序号 + 单词 + 中文意思」，用来对答案。

文件名沿用学生已有习惯（`9.5.docx`、`10.8.docx` 这种「月.日」），不要改成别的格式。

常用参数：

| 参数 | 作用 |
| --- | --- |
| `--count 30` | 今天只排 30 个 |
| `--date 10.9` | 指定日期（默认今天） |
| `--dry-run` | 只在屏幕上显示，不写任何文件 |
| `--status` | 只看学习进度 |
| `--force` | 覆盖已存在的同名 Word 文件 |

**重要：** 默认**不覆盖**已存在的 Word 文件；脚本会提示并退出码 2。学生当天已经写过的抄写/默写表不能被冲掉，只有用户明确要求覆盖时才加 `--force`。

## 看进度

```bash
python scripts/daily_plan.py --status
```

输出词库总数、已掌握数量、还没掌握数量、错词数量和学习天数。

## 更新进度

`进度.json` 由两边共同维护：

- 程序里点「💾 导出学习记录」会得到一个 json，把它放到 `四级记忆/data/进度.json` 即可；
- 也可以在对话里直接告诉 Codex「这几个词我会了 / 这几个词还不会」，据此更新
  `mastered`（数组）和 `wrong`（`{"单词": 错误次数}`）。

改完 `progress.json` 后重新跑一次脚本，就能得到排除已掌握单词的新计划。

## 提醒未完成内容

用户问"今天学完了吗"或需要提醒时，用 `--status` 看进度；如果当天的计划里还有单词没进 `mastered`，
就直接用一句话列出还剩多少个（例如「今天还有 12 个单词没完成」），并建议打开「四级记忆」程序完成。

## 学生背景

使用者是小学生，语言要简单、鼓励为主，不要用专业术语，需要具体到"先点哪个按钮"。
每天的单词量宁可少一点也不要让人做不完。
