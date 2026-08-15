New-Item -ItemType Directory -Force -Path "extension" | Out-Null

$extConfig = "extension\config.js"
$extExample = "extension\config.example.js"
if (-Not (Test-Path $extConfig)) {
  Copy-Item $extExample $extConfig
  Write-Host "Created $extConfig from template."
} else {
  Write-Host "$extConfig already exists."
}
