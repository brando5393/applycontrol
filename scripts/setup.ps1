New-Item -ItemType Directory -Force -Path "extension","dashboard" | Out-Null

$extConfig = "extension\config.js"
$extExample = "extension\config.example.js"
if (-Not (Test-Path $extConfig)) {
  Copy-Item $extExample $extConfig
  Write-Host "Created $extConfig from template."
} else {
  Write-Host "$extConfig already exists."
}

$dashConfig = "dashboard\config.js"
$dashExample = "dashboard\config.example.js"
if (-Not (Test-Path $dashConfig)) {
  Copy-Item $dashExample $dashConfig
  Write-Host "Created $dashConfig from template."
} else {
  Write-Host "$dashConfig already exists."
}
