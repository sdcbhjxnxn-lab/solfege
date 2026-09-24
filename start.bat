@echo off
setlocal
cd /d "%~dp0"
set SOLFEGE_NO_BROWSER=1
set "PORT=8765"
if not "%~1"=="" set "PORT=%~1"
set "URL=http://localhost:%PORT%/"

echo.
echo ======================================================
echo   Solfege Trainer  -  Local Server
echo ------------------------------------------------------
echo   URL  : %URL%
echo   Stop : press Ctrl+C in this window
echo ------------------------------------------------------
echo   set SOLFEGE_NO_BROWSER=1 to skip opening the browser
echo ======================================================
echo.

where python >nul 2>nul
if not errorlevel 1 goto run_python

where py >nul 2>nul
if not errorlevel 1 goto run_py

where node >nul 2>nul
if not errorlevel 1 goto run_node

goto no_runtime

:run_python
echo [INFO] Starting with Python ...
if not "%SOLFEGE_NO_BROWSER%"=="1" start "" "%URL%"
python -m http.server %PORT%
goto finished

:run_py
echo [INFO] Starting with Python Launcher ...
if not "%SOLFEGE_NO_BROWSER%"=="1" start "" "%URL%"
py -m http.server %PORT%
goto finished

:run_node
echo [INFO] Starting with Node.js ...
if not "%SOLFEGE_NO_BROWSER%"=="1" start "" "%URL%"
node "tools\serve.js" %PORT%
goto finished

:no_runtime
echo [ERROR] Python or Node.js was not found on this computer.
echo.
echo   Fix      : install Python 3 from https://www.python.org/downloads/
echo              or Node.js from https://nodejs.org/ , then run this file again.
echo   Fallback : you can open index.html directly, but the browser will
echo              block the microphone, so sight-singing practice is unavailable.
echo.
pause
goto :eof

:finished
echo.
echo [INFO] Server stopped.
pause
goto :eof
