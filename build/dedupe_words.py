#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""把 words.js 里的词条去重并按字母排序（保留词性最全、释义最长的一条）。

用法： python dedupe_words.py [path/to/words.js]
默认路径：脚本上一级目录的 words.js
"""

import os
import re
import sys

HERE = os.path.dirname(os.path.abspath(__file__))
DEFAULT = os.path.normpath(os.path.join(HERE, "..", "words.js"))


def score(defn):
    pos = len(re.findall(r"[a-zA-Z]{1,6}\.", defn))
    return pos * 1000 + len(defn)


def main():
    path = sys.argv[1] if len(sys.argv) > 1 else DEFAULT
    with open(path, "r", encoding="utf-8") as f:
        src = f.read()

    start = src.index("window.CET4_RAW")
    bt_open = src.index("`", start)
    bt_close = src.rindex("`")
    head = src[:bt_open]
    body = src[bt_open + 1:bt_close]
    tail = src[bt_close + 1:]

    best = {}
    order = []
    for line in body.split("\n"):
        line = line.strip()
        if not line or line.startswith("#"):
            continue
        parts = line.split("|")
        if len(parts) < 3:
            continue
        word = parts[0].strip()
        if not word:
            continue
        if word not in best:
            best[word] = line
            order.append(word)
        elif score(parts[2]) > score(best[word].split("|")[2]):
            best[word] = line

    order.sort(key=lambda w: w.lower())
    out = head + "`\n" + "\n".join(best[w] for w in order) + "\n`" + tail

    with open(path, "w", encoding="utf-8", newline="\n") as f:
        f.write(out)

    print("去重后词条数：%d（原 %d 行）" % (len(order), len(body.split(chr(10)))))
    return 0


if __name__ == "__main__":
    sys.exit(main())
