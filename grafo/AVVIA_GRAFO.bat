@echo off
cd /d "%~dp0"
echo Avvio server HTTP locale su porta 8765...
echo Apertura GrafoEGM nel browser...
start "" "http://localhost:8765/GrafoEGM.html"
python -m http.server 8765
pause
