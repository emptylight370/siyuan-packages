$root = (Get-Location).Path
foreach ($relative in $args) {
    $pkgDir = Split-Path -Parent (Join-Path $root $relative)
    Write-Host "changelog: $pkgDir"
    mise -C $pkgDir run changelog
    if ($LASTEXITCODE -ne 0) { exit 1 }
}
