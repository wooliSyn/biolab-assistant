@echo off
call "C:\Program Files (x86)\Microsoft Visual Studio\2022\BuildTools\VC\Auxiliary\Build\vcvarsall.bat" x64
set "PATH=C:\Program Files\nodejs;C:\Users\Wan\.cargo\bin;%PATH%"
cd /d "C:\Users\Wan\.qoderworkcn\workspace\mrub8fj2efm3sv2l\outputs\biolab-desktop"
npx tauri build
