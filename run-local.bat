@echo off
REM Run CTG Tools locally. Then open http://localhost:8000 and use "Install app".
cd /d "%~dp0"
start "" http://localhost:8000
python -m http.server 8000
