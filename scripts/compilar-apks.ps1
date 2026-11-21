<#
.SYNOPSIS
  Compilador dual de APKs Android co-instalables para UDES Control Dron (Pedido 4.2 / Estructura v5).
.DESCRIPTION
  1. Reutiliza OpenJDK 17 y Android SDK 34 en .build-tools (en la raiz del repositorio).
  2. Compila el flavor 'drontesteo' (www-testeo -> com.udes.drontesteo -> Dron Testeo)
     y lo publica en releases\dron-testeo.apk.
  3. Compila el flavor 'oficial' (www-oficial -> com.udes.dronoficial -> Dron Oficial)
     y lo publica en releases\dron-oficial.apk.
  4. Verifica tamanos y applicationId/label con aapt2.
#>

$ErrorActionPreference = "Stop"
$ProgressPreference = "SilentlyContinue"

$ScriptDir     = Split-Path -Parent $MyInvocation.MyCommand.Definition
$ProjectRoot   = Split-Path -Parent $ScriptDir
$BuildToolsDir = Join-Path $ProjectRoot ".build-tools"
$JdkRootDir    = Join-Path $BuildToolsDir "jdk-17"
$AndroidSdkDir = Join-Path $BuildToolsDir "android-sdk"
$AppDir        = Join-Path $ProjectRoot "app-android"
$AndroidDir    = Join-Path $AppDir "android"
$WwwDir        = Join-Path $AppDir "www"
$PublicAssets  = Join-Path $AndroidDir "app\src\main\assets\public"
$OutApksDir    = Join-Path $ProjectRoot "releases"

Write-Host "======================================================================" -ForegroundColor Cyan
Write-Host " COMPILADOR DUAL DE APKs ANDROID CO-INSTALABLES (TESTEO + OFICIAL)" -ForegroundColor Cyan
Write-Host "======================================================================" -ForegroundColor Cyan

# 1. Resolver JDK 17 en .build-tools
function Resolve-Jdk17Home {
  if ($env:JAVA_HOME -and (Test-Path (Join-Path $env:JAVA_HOME "bin\javac.exe"))) {
    return $env:JAVA_HOME
  }
  if (Test-Path $JdkRootDir) {
    $javac = Get-ChildItem -Path $JdkRootDir -Filter "javac.exe" -Recurse -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($javac) {
      return $javac.Directory.Parent.FullName
    }
  }
  return $null
}

$ResolvedJavaHome = Resolve-Jdk17Home
if (-not $ResolvedJavaHome) {
  throw "No se encontro OpenJDK 17 en $JdkRootDir"
}
$env:JAVA_HOME = $ResolvedJavaHome
$env:PATH = "$($env:JAVA_HOME)\bin;$($env:PATH)"
Write-Host "[OK] JAVA_HOME: $env:JAVA_HOME" -ForegroundColor Green

# 2. Resolver Android SDK 34 en .build-tools (o variables de entorno)
if (-not (Test-Path (Join-Path $AndroidSdkDir "platforms\android-34"))) {
  if ($env:ANDROID_HOME -and (Test-Path (Join-Path $env:ANDROID_HOME "platforms\android-34"))) {
    $AndroidSdkDir = $env:ANDROID_HOME
  } elseif ($env:ANDROID_SDK_ROOT -and (Test-Path (Join-Path $env:ANDROID_SDK_ROOT "platforms\android-34"))) {
    $AndroidSdkDir = $env:ANDROID_SDK_ROOT
  }
}

$Platform34Dir   = Join-Path $AndroidSdkDir "platforms\android-34"
$BuildTools34Dir = Join-Path $AndroidSdkDir "build-tools\34.0.0"
$Aapt2Exe        = Join-Path $BuildTools34Dir "aapt2.exe"

if (-not ((Test-Path $Platform34Dir) -and (Test-Path $BuildTools34Dir))) {
  throw "No se encontro Android SDK 34 completo en $AndroidSdkDir"
}

$env:ANDROID_HOME = $AndroidSdkDir
$env:ANDROID_SDK_ROOT = $AndroidSdkDir
$env:PATH = "$AndroidSdkDir\platform-tools;$BuildTools34Dir;$($env:PATH)"
Write-Host "[OK] ANDROID_HOME: $env:ANDROID_HOME" -ForegroundColor Green

$EscapedSdkPath = $AndroidSdkDir.Replace("\", "\\")
Set-Content -Path (Join-Path $AndroidDir "local.properties") -Value "sdk.dir=$EscapedSdkPath" -Encoding ASCII

if (-not (Test-Path $OutApksDir)) {
  New-Item -ItemType Directory -Path $OutApksDir -Force | Out-Null
}

function Build-EditionApk {
  param(
    [string]$EditionName,
    [string]$SourceWwwFolder,
    [string]$GradleTask,
    [string]$GeneratedApkRelPath,
    [string]$TargetApkFileName
  )

  $SrcDir = Join-Path $AppDir $SourceWwwFolder
  if (-not (Test-Path $SrcDir)) {
    throw "No existe la carpeta origen: $SrcDir"
  }

  Write-Host "----------------------------------------------------------------------" -ForegroundColor Yellow
  Write-Host " Construyendo edicion [$EditionName] desde $SourceWwwFolder..." -ForegroundColor Yellow
  Write-Host "----------------------------------------------------------------------" -ForegroundColor Yellow

  # Limpiar www/ y assets/public/ para garantizar cero residuos previos
  if (Test-Path $WwwDir) {
    Get-ChildItem -Path $WwwDir -Force | Remove-Item -Recurse -Force
  } else {
    New-Item -ItemType Directory -Path $WwwDir -Force | Out-Null
  }

  if (Test-Path $PublicAssets) {
    Get-ChildItem -Path $PublicAssets -Force | Remove-Item -Recurse -Force
  }

  Copy-Item -Path (Join-Path $SrcDir "*") -Destination $WwwDir -Recurse -Force

  Push-Location $AppDir
  try {
    if (-not (Test-Path (Join-Path $AppDir "node_modules"))) {
      cmd.exe /c "npm install"
      if ($LASTEXITCODE -ne 0) { throw "Error en npm install (exit code $LASTEXITCODE)" }
    }
    cmd.exe /c "npx cap sync android"
    if ($LASTEXITCODE -ne 0) { throw "Error en npx cap sync android para $EditionName (exit code $LASTEXITCODE)" }
  } finally {
    Pop-Location
  }

  Push-Location $AndroidDir
  try {
    & .\gradlew.bat $GradleTask --no-daemon
    if ($LASTEXITCODE -ne 0) { throw "Error en gradlew $GradleTask (exit code $LASTEXITCODE)" }
  } finally {
    Pop-Location
  }

  $GeneratedApk = Join-Path $AndroidDir $GeneratedApkRelPath
  if (-not (Test-Path $GeneratedApk)) {
    throw "No se encontro el APK generado en: $GeneratedApk"
  }

  $DestApk = Join-Path $OutApksDir $TargetApkFileName
  Copy-Item -Path $GeneratedApk -Destination $DestApk -Force
  $SizeMB = [Math]::Round(((Get-Item $DestApk).Length / 1MB), 2)

  Write-Host "[OK] Generado: $DestApk ($SizeMB MB)" -ForegroundColor Green
  if (Test-Path $Aapt2Exe) {
    $badging = & $Aapt2Exe dump badging $DestApk
    $pkgLine = $badging | Select-String -Pattern "^package:" | Select-Object -First 1
    $lblLine = $badging | Select-String -Pattern "^application-label:" | Select-Object -First 1
    Write-Host "     $pkgLine" -ForegroundColor Cyan
    Write-Host "     $lblLine" -ForegroundColor Cyan
  }
}

# 3. Compilar APK 1 — Dron Testeo
Build-EditionApk `
  -EditionName "drontesteo" `
  -SourceWwwFolder "www-testeo" `
  -GradleTask "assembleDrontesteoDebug" `
  -GeneratedApkRelPath "app\build\outputs\apk\drontesteo\debug\app-drontesteo-debug.apk" `
  -TargetApkFileName "dron-testeo.apk"

# 4. Compilar APK 2 — Dron Oficial
Build-EditionApk `
  -EditionName "oficial" `
  -SourceWwwFolder "www-oficial" `
  -GradleTask "assembleOficialDebug" `
  -GeneratedApkRelPath "app\build\outputs\apk\oficial\debug\app-oficial-debug.apk" `
  -TargetApkFileName "dron-oficial.apk"

Write-Host "======================================================================" -ForegroundColor Green
Write-Host " COMPILACION DUAL COMPLETADA EXITOSAMENTE" -ForegroundColor Green
Write-Host "======================================================================" -ForegroundColor Green
