@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe" test.mjs %1
) ELSE (
  node test.mjs %1
)