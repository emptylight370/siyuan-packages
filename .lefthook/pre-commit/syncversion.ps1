# pre-commit：把 meta.json 的 version 同步到同目录的 package.json，并单独暂存该文件
# $args 来自 lefthook 的 {staged_files}，已按 glob 过滤为 meta.json 路径（相对仓库根）

$root = (Get-Location).Path

foreach ($relative in $args) {
    $metaPath = Join-Path $root $relative
    if (-not (Test-Path $metaPath)) { continue }

    $pkgDir = Split-Path -Parent $metaPath
    $pkgName = Split-Path -Leaf $pkgDir
    $pkgJsonPath = Join-Path $pkgDir 'package.json'
    if (-not (Test-Path $pkgJsonPath)) { continue }

    # 读取元数据版本（发布版本的唯一来源）
    $version = (Get-Content $metaPath -Raw | ConvertFrom-Json).version

    # 只替换顶层 version 的值，保留其余字段、键顺序与缩进
    $raw = Get-Content $pkgJsonPath -Raw
    $pattern = '("version"\s*:\s*")[^"]*(")'
    $replacement = '${1}' + $version + '${2}'
    $updated = [regex]::new($pattern).Replace($raw, $replacement, 1)

    if ($updated -eq $raw) {
        Write-Host "${pkgName}: package.json 的 version 已是 $version"
        continue
    }

    # 写回后单独暂存，使该改动进入本次提交
    [System.IO.File]::WriteAllText($pkgJsonPath, $updated, [System.Text.UTF8Encoding]::new($false))
    git add -- $pkgJsonPath
    if ($LASTEXITCODE -ne 0) {
        Write-Error "暂存 ${pkgJsonPath} 失败"
        exit 1
    }
    Write-Host "${pkgName}: package.json 已同步为 $version 并暂存"
}
