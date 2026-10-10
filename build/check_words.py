#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""检查 words.js 词库：总数、重复、每个词性是否至少 2 个中文意思。"""

import os
import re
import sys
from collections import Counter

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT = os.path.normpath(os.path.join(HERE, "..", "words.js"))

SPLIT_MEANING = re.compile(r"[；;，,、]")
POS_RE = re.compile(r"^([a-zA-Z]{1,6}\.)\s*(.*)$")


def load(path):
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()
    start = src.index("window.CET4_RAW")
    body = src[src.index("`", start) + 1:src.rindex("`")]
    return [l.strip() for l in body.split("\n") if l.strip() and not l.startswith("#")]


def meanings_of_pos(chunk):
    m = POS_RE.match(chunk.strip())
    cn = m.group(2) if m else chunk
    return [x for x in (p.strip() for p in SPLIT_MEANING.split(cn)) if x]


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    lines = load(path)
    words = [l.split("|")[0].strip() for l in lines]
    dupes = [w for w, c in Counter(words).items() if c > 1]

    bad = []
    for line in lines:
        parts = line.split("|")
        if len(parts) < 3:
            bad.append(line)
            continue
        for chunk in parts[2].split("/"):
            if not chunk.strip():
                continue
            if len(meanings_of_pos(chunk)) < 2:
                bad.append(line)
                break

    print("词条数       : %d" % len(lines))
    print("唯一单词数   : %d" % len(set(words)))
    print("重复单词     : %d %s" % (len(dupes), dupes[:10]))
    print("不合格词条   : %d（每个词性应有 2 个以上中文意思）" % len(bad))
    for line in bad[:40]:
        print("   " + line)
    return 0


if __name__ == "__main__":
    sys.exit(main())
