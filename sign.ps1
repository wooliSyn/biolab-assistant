# BioLab 代码签名脚本
# 用法: .\sign.ps1 -CertPath "path\to\cert.pfx" -CertPass "password"
# 签名后 Windows Smart App Control 和 SmartScreen 不再拦截
param(
    [Parameter(Mandatory=$true)]
    [string]$CertPath,
    [Parameter(Mandatory=$true)]
    [string]$CertPass
)

$ErrorActionPreference = "Stop"

# 查找 signtool.exe
$signtool = Get-ChildItem "C:\Program Files (x86)\Windows Kits\10\bin" -Recurse -Filter "signtool.exe" |
    Where-Object { $_.FullName -match "x64" } | Select-Object -First 1 -ExpandProperty FullName

if (-not $signtool) {
    Write-Error "找不到 signtool.exe，请安装 Windows SDK"
    exit 1
}

Write-Host "signtool: $signtool"
Write-Host "证书: $CertPath"

$nsisDir = "src-tauri\target\release\bundle\nsis"
$exeDir = "src-tauri\target\release"

# 签名主程序 exe
$mainExe = Join-Path $exeDir "biolab-assistant.exe"
if (Test-Path $mainExe) {
    Write-Host "签名主程序..."
    & $signtool sign /f $CertPath /p $CertPass /tr http://timestamp.digicert.com /td sha256 /fd sha256 $mainExe
    if ($LASTEXITCODE -ne 0) { Write-Error "签名主程序失败"; exit 1 }
}

# 签名 NSIS 安装包
$installer = Get-ChildItem $nsisDir -Filter "BioLab_*_x64-setup.exe" | Select-Object -First 1 -ExpandProperty FullName
if ($installer) {
    Write-Host "签名安装包: $installer"
    & $signtool sign /f $CertPath /p $CertPass /tr http://timestamp.digicert.com /td sha256 /fd sha256 $installer
    if ($LASTEXITCODE -ne 0) { Write-Error "签名安装包失败"; exit 1 }
}

Write-Host ""
Write-Host "=== 签名完成 ===" -ForegroundColor Green
Write-Host "已签名文件:"
Write-Host "  - $mainExe"
if ($installer) { Write-Host "  - $installer" }
