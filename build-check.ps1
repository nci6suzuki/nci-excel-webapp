# 第32回：ビルド確認スクリプト
# プロジェクト直下で実行してください。

Write-Host "=============================="
Write-Host "NCI 管理システム ビルド確認"
Write-Host "=============================="
Write-Host ""

Write-Host "1. Node / npm version"
node -v
npm -v
Write-Host ""

Write-Host "2. package.json check"
if (Test-Path "package.json") {
  Write-Host "package.json found"
} else {
  Write-Host "package.json not found"
  exit 1
}
Write-Host ""

Write-Host "3. TypeScript / Next.js build"
npm run build

if ($LASTEXITCODE -eq 0) {
  Write-Host ""
  Write-Host "=============================="
  Write-Host "Build Success"
  Write-Host "=============================="
} else {
  Write-Host ""
  Write-Host "=============================="
  Write-Host "Build Failed"
  Write-Host "エラー全文をChatGPTへ貼ってください。"
  Write-Host "=============================="
  exit 1
}
