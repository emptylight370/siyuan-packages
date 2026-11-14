#!/usr/bin/env pwsh
#MISE description="Create and push the release tag for the version in meta.json"

# 读取包名与版本，并校验 package.json 与 meta.json 的版本一致（版本手动同步，容易漏改）
$pkgDir = Get-Location
$meta = Get-Content (Join-Path $pkgDir 'meta.json') -Raw | ConvertFrom-Json
$pkgJson = Get-Content (Join-Path $pkgDir 'package.json') -Raw | ConvertFrom-Json
$name = Split-Path -Leaf $pkgDir
$tag = "$name@$($meta.version)"
if ($pkgJson.version -ne $meta.version) {
    throw "package.json 的 version ($($pkgJson.version)) 与 meta.json ($($meta.version)) 不一致"
}

# 本地与远端都不允许存在同名 tag，避免覆盖已发布的版本
if (git tag --list $tag) { throw "本地已存在 tag $tag" }
if (git ls-remote --tags origin "refs/tags/$tag") { throw "远端已存在 tag $tag" }

# 发布说明必须已生成，避免 tag 对应的 release 没有变更记录
$whatschange = Join-Path $pkgDir 'whatschange.md'
if (-not (Select-String -Path $whatschange -Pattern "^## \[$([regex]::Escape($meta.version))\]" -Quiet)) {
    throw "whatschange.md 缺少 $($meta.version) 段落，请先运行 changelog 任务"
}

# 创建空消息的 annotated tag（仓库启用了 tag.gpgSign，必须带 -m），推送后触发发布工作流
git tag -a $tag -m ''
if ($LASTEXITCODE -ne 0) { throw "创建 tag $tag 失败" }
git push origin $tag
if ($LASTEXITCODE -ne 0) { throw "推送 tag $tag 失败" }
Write-Host "已推送 $tag"
