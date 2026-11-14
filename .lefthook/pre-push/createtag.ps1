# pre-push：处理 lefthook 传入的 meta.json（{push_files} 经 glob 过滤），为其创建本地 tag
# 只处理 main 分支，避免在特性分支上产出指向未合并提交的 tag
$branch = git rev-parse --abbrev-ref HEAD
if ($branch -ne 'main') {
    Write-Host "当前分支为 $branch，跳过打包 tag"
    exit 0
}

foreach ($relative in $args) {
    $metaPath = Join-Path (Get-Location).Path $relative
    if (-not (Test-Path $metaPath)) { continue }

    $pkgDir = Split-Path -Parent $metaPath
    $pkgName = Split-Path -Leaf $pkgDir
    $version = (Get-Content $metaPath -Raw | ConvertFrom-Json).version
    $tag = "$pkgName@$version"

    # 已有同名 tag 说明该版本打过
    if (git tag -l $tag) {
        Write-Host "${pkgName}: tag $tag 已存在，跳过"
        continue
    }

    # 版本未变（与上一个本包 tag 相同）不打 tag
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
