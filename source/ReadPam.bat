@IF EXIST "%~dp0\node.exe" (
  "%~dp0\node.exe" ReadPam.mjs %1
) ELSE (
  node ReadPam.mjs %1
)