#!/usr/bin/env pwsh
#MISE description="构建指定包并把 dist 部署到思源工作空间（mise run deploy -- -package <name> [-target <workspace>] [-all]）"

param (
    # 包名，例如 sy-format-helper
    [Parameter(Mandatory = $true, HelpMessage = '包名，例如 sy-format-helper')]
    [string]$package,
    # 目标工作空间名称；省略时使用当前打开的工作空间
    [string]$target,
    # 部署到所有工作空间
    [switch]$all
)

$root = $env:MISE_CONFIG_ROOT

# 包类型 -> 思源数据目录名
$dataDirs = @{
    plugin   = 'plugins'
    theme    = 'themes'
    widget   = 'widgets'
    template = 'templates'
    icon     = 'icons'
}

# 在 packages/<type>/<pkg> 中唯一定位包目录
$matches = @(Get-ChildItem (Join-Path $root 'packages') -Directory -ErrorAction SilentlyContinue | ForEach-Object {
        Get-ChildItem $_.FullName -Directory | Where-Object { $_.Name -eq $package }
    })
if ($matches.Count -ne 1) {
    Write-Error -Message "Package '$package' not found or ambiguous (matched $($matches.Count) directories under packages/*/$package)"
    exit 1
}

$pkgDir = $matches[0].FullName
$pkgType = Split-Path -Leaf (Split-Path -Parent $pkgDir)
$dataDir = $dataDirs[$pkgType]
if (-not $dataDir) {
    Write-Error -Message "Unsupported package type '$pkgType' (known: $($dataDirs.Keys -join ', '))"
    exit 1
}

$workspaces = @(siyuan workspace list --format json | ConvertFrom-Json)
if ($workspaces.Count -le 0) {
    Write-Error -Message 'SiYuan workspace not found!'
    exit 1
}

# 构建到 dist，部署内容即产物目录
Push-Location $root
try {
    pnpm --filter $package build
    if ($LASTEXITCODE -ne 0) {
        Write-Error -Message "Build failed for '$package'"
        exit 1
    }
}
finally {
    Pop-Location
}

$distDir = Join-Path $pkgDir 'dist'
if (-not (Test-Path $distDir)) {
    Write-Error -Message "Build output not found: $distDir"
    exit 1
}

# 镜像同步：先清空目标目录再整体复制，避免残留旧文件
function DeployToWorkspace([string]$workspacePath, [string]$workspaceName) {
    $dest = Join-Path $workspacePath "data/$dataDir/$package"
    if (Test-Path $dest) {
        Remove-Item -Path $dest -Recurse -Force
    }
    New-Item -ItemType Directory -Path $dest -Force | Out-Null
    Copy-Item -Path (Join-Path $distDir '*') -Destination $dest -Recurse -Force
    Write-Output "Deployed $package -> $dest ($workspaceName)"
}

if ($all) {
    foreach ($item in $workspaces) {
        DeployToWorkspace $item.path $item.name
    }
    exit 0
}

if ($target) {
    $workspace = $workspaces | Where-Object { $_.name -eq $target } | Select-Object -First 1
    if (-not $workspace) {
        Write-Error -Message "Workspace '$target' not found!"
        exit 1
    }
}
else {
    # workspace info 接口没有 name 字段，按 path 反查列表中的完整条目
    $current = siyuan workspace info --format json | ConvertFrom-Json
    $workspace = $workspaces | Where-Object { $_.path -eq $current.path } | Select-Object -First 1
    if (-not $workspace) {
        Write-Error -Message 'Current workspace not found in workspace list!'
        exit 1
    }
}

DeployToWorkspace $workspace.path $workspace.name
