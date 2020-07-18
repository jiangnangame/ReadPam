@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe" start.mjs %1
) ELSE (
  node start.mjs %1
)