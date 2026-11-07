param(
  [string]$Url = 'https://westendpower-configurator-api.westendpower-nm.workers.dev/pages/stihl-blowers'
)
$ErrorActionPreference = 'Stop'
$target = [Uri]$Url
if ($target.Scheme -ne 'https') { throw 'Use a public HTTPS page URL.' }
$chromePaths = @(
  (Join-Path $env:ProgramFiles 'Google\Chrome\Application\chrome.exe'),
  (Join-Path ${env:ProgramFiles(x86)} 'Google\Chrome\Application\chrome.exe'),
  (Join-Path $env:LOCALAPPDATA 'Google\Chrome\Application\chrome.exe')
)
$traceChrome = $chromePaths | Where-Object { Test-Path -LiteralPath $_ } | Select-Object -First 1
if (-not $traceChrome) { throw 'Google Chrome was not found. Install Chrome before recording this trace.' }
$traceFolder = Join-Path ([Environment]::GetFolderPath('Desktop')) ('WEP-Performance-Trace-' + (Get-Date -Format 'yyyyMMdd-HHmmss'))
New-Item -ItemType Directory -Path $traceFolder | Out-Null
$reportPath = Join-Path $traceFolder 'report'
$priorChrome = $env:CHROME_PATH
try {
  $env:CHROME_PATH = $traceChrome
  & npx.cmd --yes lighthouse $Url --only-categories=performance --form-factor=mobile --save-assets --output=html --output=json "--output-path=$reportPath" '--chrome-flags=--headless=new'
  if ($LASTEXITCODE -ne 0) { throw 'Trace recording failed. Review the Lighthouse output above.' }
} finally {
  $env:CHROME_PATH = $priorChrome
}
Write-Host "Report and Chrome trace saved to: $traceFolder"
Write-Host 'Share the report JSON and trace JSON for investigation. Local timings may differ from PageSpeed.'
