#!/usr/bin/env pwsh
#MISE description="为各包创建本地发布 tag（按 meta.json 的版本，已存在或版本未变则跳过）"

# 扫描 packages/<type>/<pkg>/meta.json，逐层展开避免递归进入 node_modules
$root = (Get-Location).Path
$pkgDirs = Get-ChildItem (Join-Path $root 'packages') -Directory | ForEach-Object {
    Get-ChildItem $_.FullName -Directory |
        Where-Object { Test-Path (Join-Path $_.FullName 'meta.json') }
}

$created = 0
foreach ($pkgDir in $pkgDirs) {
    $pkgName = $pkgDir.Name
    $metaPath = Join-Path $pkgDir.FullName 'meta.json'
    $relative = [System.IO.Path]::GetRelativePath($root, $metaPath) -replace '\\', '/'

    # meta.json 有未提交改动时 tag 会指向不含该版本的提交，先要求提交
    if (git status --porcelain -- $relative) {
        Write-Warning "${pkgName}: meta.json 有未提交改动，请先提交后再打 tag"
        continue
    }

    $version = (Get-Content $metaPath -Raw | ConvertFrom-Json).version
    $tag = "$pkgName@$version"

    # 已有同名 tag 说明该版本已打过
    if (git tag -l $tag) {
        Write-Host "${pkgName}: tag $tag 已存在"
        continue
    }

    # 版本与上一个本包 tag 相同说明版本号未变（只改了其他字段）
    $latest = git tag -l "$pkgName@*" --sort=-v:refname | Select-Object -First 1
    if ($latest -eq $tag) {
        Write-Host "${pkgName}: 版本未变化（$latest）"
        continue
    }

    # 创建空消息的 annotated tag（仓库启用了 tag.gpgSign，必须带 -m）
    git tag -a $tag -m ''
    if ($LASTEXITCODE -ne 0) {
        Write-Error "创建 tag $tag 失败"
        exit 1
    }
    Write-Host "${pkgName}: 已创建 tag $tag，推送后触发发布：git push origin $tag"
    $created++
}

if ($created -eq 0) { Write-Host '没有需要创建的 tag' }
