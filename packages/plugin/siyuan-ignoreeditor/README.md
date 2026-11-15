# VSCode Lite Edit

![GitHub Release Date](https://img.shields.io/github/release-date/emptylight370/siyuan-ignoreeditor?display_date=published_at&link=https%3A%2F%2Fgithub.com%2Femptylight370%2Fsiyuan-ignoreeditor/releases/latest)
![GitHub Release](https://img.shields.io/github/v/release/emptylight370/siyuan-ignoreeditor?link=https%3A%2F%2Fgithub.com%2Femptylight370%2Fsiyuan-ignoreeditor/releases/latest)
![GitHub Release](https://img.shields.io/github/v/release/emptylight370/siyuan-ignoreeditor?link=https%3A%2F%2Fgithub.com%2Femptylight370%2Fsiyuan-ignoreeditor/releases/latest&label=Current%20plugin%20version)
![GitHub issue custom search in repo](https://img.shields.io/github/issues-search/emptylight370/siyuan-ignoreeditor?link=https%3A%2F%2Fgithub.com%2Femptylight370%2Fsiyuan-ignoreeditor&query=state%3Aopen%20label%3A%22help%20wanted%22&label=Issues%20need%20helps&labelColor=%23112E32)
![GitHub Repo stars](https://img.shields.io/github/stars/emptylight370/siyuan-ignoreeditor?link=https%3A%2F%2Fgithub.com%2Femptylight370%2Fsiyuan-ignoreeditor)

## Ingore files editor

SiYuan Note has some built-in ignore files for different scenarios. It's too troublesome to manually edit them every time, so I decide to make this editor.

### Supported ignore files

| Ignore file      | Path                           | Purpose                                              | User guide                                           |
| ---------------- | ------------------------------ | ---------------------------------------------------- | ---------------------------------------------------- |
| Index ignore     | `data/.siyuan/indexignore`     | Exclude matched docs/assets from indexing            | [User guide](siyuan://blocks/20240119211017-1vbbt95) |
| Search ignore    | `data/.siyuan/searchignore`    | Exclude matched SQL conditions from global search    | [User guide](siyuan://blocks/20240119212048-0huuevw) |
| Reference ignore | `data/.siyuan/refsearchignore` | Exclude matched SQL conditions from reference search | [User guide](siyuan://blocks/20240119212048-0huuevw) |
| Sync ignore      | `data/.siyuan/syncignore`      | Exclude matched docs/assets from cloud syncing       | [User guide](siyuan://blocks/20210928101257-l27t5uo) |

User guide links use the `siyuan://` protocol and open in SiYuan Note (not clickable on GitHub).
