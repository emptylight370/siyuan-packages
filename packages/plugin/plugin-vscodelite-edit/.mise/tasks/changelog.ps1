#!/usr/bin/env pwsh
#MISE description="Generate whatschange.md for the version in meta.json"

# 读取包名与版本：包名取目录名，版本取 meta.json（唯一来源）
$pkgDir = Get-Location
$meta = Get-Content (Join-Path $pkgDir 'meta.json') -Raw | ConvertFrom-Json
$tag = "$(Split-Path -Leaf $pkgDir)@$($meta.version)"
$target = Join-Path $pkgDir 'whatschange.md'

# 由 git-cliff 全量重写 whatschange.md，重复运行结果一致；该包从未发布，无需追加历史存档
git cliff -t $tag -o $target
if ($LASTEXITCODE -ne 0) { throw 'git cliff 生成 changelog 失败' }

# 统一格式并加入暂存区，便于与版本提交一起提交
prettier -w $target
git add $target
Write-Host "已更新 whatschange.md（$($meta.version)）"
