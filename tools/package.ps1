<#
  Builds the zip that gets uploaded to itch.io (or any other host that
  serves a folder of static files).

  There is no build step for the game itself and this does not add one --
  it copies two files and compresses them. index.html is the whole game;
  sw.js is the service worker, which is the one thing that cannot be
  inlined because a browser will only accept one fetched from a real URL.

  api.php is deliberately NOT included. It belongs to rootlabs.us, it is
  the only part of the game that knows the site has WordPress or accounts
  at all, and the game already treats a failed call to it as "playing
  signed out" -- which is exactly the state every copy outside rootlabs.us
  should be in.

  Run from the repo root:
      powershell -ExecutionPolicy Bypass -File tools/package.ps1
#>

$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root "dist"
$stage = Join-Path $dist "msp-tycoon"
$zip = Join-Path $dist "msp-tycoon-web.zip"

$index = Join-Path $root "index.html"
if (-not (Test-Path $index)) { throw "index.html not found at $index" }

# A sanity check worth having before anything is published: the game must
# be one self-contained page, and a stray <script src> would mean the zip
# is missing a file nobody notices until the upload is live.
$html = Get-Content $index -Raw
if ($html -match '<script[^>]*\ssrc=') {
    throw "index.html references an external script -- the zip would be incomplete"
}
if ($html -match '<link[^>]*rel=["'']?stylesheet' -and $html -notmatch 'fonts\.googleapis\.com') {
    throw "index.html references an external stylesheet that is not Google Fonts"
}

if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage -Force | Out-Null

Copy-Item $index (Join-Path $stage "index.html")
$sw = Join-Path $root "sw.js"
if (Test-Path $sw) { Copy-Item $sw (Join-Path $stage "sw.js") }

if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -CompressionLevel Optimal

$size = [math]::Round((Get-Item $zip).Length / 1KB, 1)
Write-Output "built $zip ($size KB)"
Write-Output "contents:"
Get-ChildItem $stage | ForEach-Object { Write-Output ("  " + $_.Name + "  " + [math]::Round($_.Length / 1KB, 1) + " KB") }
Write-Output ""
Write-Output "Upload to itch.io as an HTML project, tick 'This file will be played in the browser'."
Write-Output "Viewport 1280x720, and tick 'Mobile friendly' -- the layout has a phone mode."
