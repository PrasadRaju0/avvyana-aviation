@echo off
setlocal

cd /d "%~dp0"

if not exist "node_modules\vite\bin\vite.js" (
  echo Dependencies are missing. Run npm.cmd install first.
  exit /b 1
)

echo Starting Avyanna Aviation at http://localhost:5173
node "node_modules\vite\bin\vite.js" --host 0.0.0.0