# 只处理 main 分支，避免在特性分支上产出指向未合并提交的 tag
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne 'main') {
    Write-Host "当前分支为 $branch，跳过打包 tag"
    exit 0
}

# 待推送范围：优先用 upstream，缺失时回退到 origin/main
$changed = git diff --name-only '@{push}..HEAD' 2>$null
if ($LASTEXITCODE -ne 0) {
    $changed = git diff --name-only 'origin/main..HEAD' 2>$null
}
if (-not $changed) { exit 0 }

# 只关心各包的元数据文件
$metas = $changed | Where-Object { $_ -match '^packages/[^/]+/[^/]+/meta\.json$' }

foreach ($relative in $metas) {
    $metaPath = Join-Path (Get-Location).Path $relative
    if (-not (Test-Path $metaPath)) { continue }

    $pkgDir = Split-Path -Parent $metaPath
    $pkgName = Split-Path -Leaf $pkgDir
    $version = (Get-Content $metaPath -Raw | ConvertFrom-Json).version
    $tag = "$pkgName@$version"

    # 已有同名 tag 说明该版本打过；当前版本与上一个 tag 相同说明版本号未变
    if (git tag -l $tag) {
        Write-Host "${pkgName}: tag $tag 已存在，跳过"
        continue
    }
    $latest = git tag -l "$pkgName@*" --sort=-v:refname | Select-Object -First 1
    if ($latest -eq $tag) { continue }

    # 创建空消息的 annotated tag（仓库启用了 tag.gpgSign，必须带 -m）
    git tag -a $tag -m ''
    if ($LASTEXITCODE -ne 0) {
        Write-Error "创建 tag $tag 失败"
        exit 1
    }
    Write-Host "已创建本地 tag $tag，推送后执行：git push origin $tag"
}
