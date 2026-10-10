# ============================================================
#  四级记忆 · 一键打包 EXE
#  用法：在 PowerShell 里运行  .\build-exe.ps1
#  结果：..\dist\四级记忆.exe   （一个文件，双击就能用）
# ============================================================

$ErrorActionPreference = 'Stop'

$here    = Split-Path -Parent $MyInvocation.MyCommand.Path
$root    = Split-Path -Parent $here          # 四级记忆
$dist    = Join-Path (Split-Path -Parent $root) 'dist'

$csc = @(
  'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe',
  'C:\Windows\Microsoft.NET\Framework\v4.0.30319\csc.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1

if(-not $csc){ throw '找不到 csc.exe（.NET Framework 编译器）。' }
if(-not (Test-Path $dist)){ New-Item -ItemType Directory -Path $dist | Out-Null }

$assets = @('index.html','app.js','words.js','manifest.json','sw.js',
            'icon-192.png','icon-512.png','favicon.png')

$resArgs = @()
foreach($a in $assets){
  $p = Join-Path $root $a
  if(Test-Path $p){ $resArgs += ('/resource:{0}' -f $p) }
}

$iconArg = @()
$ico = Join-Path $root 'icon.ico'
if(Test-Path $ico){ $iconArg = @('/win32icon:' + $ico) }

$out = Join-Path $dist '四级记忆.exe'

& $csc /nologo /target:winexe /optimize+ `
      "/out:$out" `
      @iconArg `
      /reference:System.dll `
      /reference:System.Windows.Forms.dll `
      @resArgs `
      (Join-Path $here 'Launcher.cs')

if($LASTEXITCODE -ne 0){ throw '编译失败。' }

Write-Host ''
Write-Host ('✅ 打包完成：' + $out) -ForegroundColor Green
Write-Host '   双击它就能打开“四级记忆”。'
