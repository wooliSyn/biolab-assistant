$vsPath = "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat"
$envOutput = cmd /c "`"$vsPath`" x64 >nul 2>&1 && set" 2>&1
foreach ($line in $envOutput) {
    if ($line -match "^([^=]+)=(.*)$") {
        [System.Environment]::SetEnvironmentVariable($Matches[1], $Matches[2], "Process")
    }
}
$env:PATH = "C:\Program Files\nodejs;$env:USERPROFILE\.cargo\bin;" + $env:PATH
Set-Location $PSScriptRoot
& npx tauri build 2>&1 | ForEach-Object { $_ }
