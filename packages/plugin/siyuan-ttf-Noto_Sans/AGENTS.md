# siyuan-ttf-Noto_Sans

思源字体插件「NotoSans字体」（`siyuan-ttf-Noto_Sans`）的包级指引。跨包规则以仓库根 `AGENTS.md` 为准；本包与 `siyuan-ttf-Alibaba_PuHui_Sans` 同构，注入机制、字体资源、构建要点等详细约定见该包 `AGENTS.md`，以下仅列差异。

## 差异点

- 字体为 Google Noto Sans 可变字体（`fonts/*.woff`），每个语言区域一个文件；`fonts/` 内的 `OFL_*.txt` 与 `README_*.txt` 是字体授权与来源说明，**必须随包分发**（经 `publish.resources: ["fonts/"]` 整树复制进 dist）
- `src/style.scss` 中字体族名为 `'NotoSans Plugin'` / `'NotoSans SC Plugin'` / `'NotoSans TC Plugin'` / `'NotoSans JP Plugin'`，字体栈优先复用系统已装的 Noto（`'Noto Sans SC'`、`'Noto Sans CJK SC'` 等）再回退到随包字体
- LICENSE 为 OFL/MIT 混合说明，代码部分 MIT

## changelog

与 Alibaba 包相同：输出 `changelog.md`、历史存档 `changelog.old.md`，不要删除或重命名。
