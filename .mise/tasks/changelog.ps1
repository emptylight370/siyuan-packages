#!/usr/bin/env pwsh
#MISE description="Generate the changelog file for the version in meta.json"
#MISE dir="{{cwd}}"

# 各插件包共用的 changelog 生成任务（根文件任务，任务名 //:changelog），由各包
# mise.toml 的 [tasks.changelog]（run = "mise run //:changelog" + env）嵌套调用。
# 输入约定：不使用脚本参数——
#   - #MISE dir="{{cwd}}" 使执行目录 = 嵌套调用发起处（子任务的包目录），Get-Location 定位 meta.json；
#   - 输出文件名与旧日志文件名由子任务 env 注入（CHANGELOG_OUTPUT / CHANGELOG_LEGACY）：
#     env 随嵌套 mise run 按普通子进程继承（2026.11.8 实测），无需 vars / 模板。
#   - 直接在仓库根 mise run //:changelog 时 cwd = 仓库根、读不到包 meta.json 而失败，
#     该任务仅应由子项目触发。

# 读取包名与版本：包名取目录名，版本取 meta.json（唯一来源）
$pkgDir = Get-Location
$meta = Get-Content (Join-Path $pkgDir 'meta.json') -Raw | ConvertFrom-Json
$tag = "$(Split-Path -Leaf $pkgDir)@$($meta.version)"
$target = Join-Path $pkgDir $env:CHANGELOG_OUTPUT

# 由 git-cliff 全量重写 changelog，重复运行结果一致，不做手工去重
git cliff -t $tag -o $target
if ($LASTEXITCODE -ne 0) { throw 'git cliff 生成 changelog 失败' }

# 追加迁移前的历史记录：cliff 无法再为这些版本生成段落，历史存档单独保存；
# 包未声明 CHANGELOG_LEGACY（为空）或存档文件不存在时跳过
if ($env:CHANGELOG_LEGACY) {
    $legacy = Join-Path $pkgDir $env:CHANGELOG_LEGACY
    if (Test-Path $legacy) {
        $legacyText = (Get-Content $legacy -Raw).TrimEnd()
        [System.IO.File]::AppendAllText($target, "`n$legacyText`n", [System.Text.UTF8Encoding]::new($false))
    }
}

# 统一格式并加入暂存区，便于与版本提交一起提交
prettier -w $target
git add $target
Write-Host "已更新 $($env:CHANGELOG_OUTPUT)（$($meta.version)）"
