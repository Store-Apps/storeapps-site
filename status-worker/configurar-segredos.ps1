# Cadastra no Worker storeapps-status as chaves das checagens de saldo e conta.
# Rodar no PowerShell, dentro desta pasta:   .\configurar-segredos.ps1
#
# Nada é mostrado na tela: cada valor vai direto para `wrangler secret put`.
# Pode rodar de novo quando trocar uma chave; o que já existe é sobrescrito.
# Precisa: wrangler logado na conta StoreApps, AWS CLI com o perfil "vumborala"
# e o gh com a conta bruno-storeapps.

$ErrorActionPreference = 'Stop'
$env:AWS_PROFILE = 'vumborala'
$regiao = 'sa-east-1'

function Gravar([string]$nome, [string]$valor) {
  if ([string]::IsNullOrWhiteSpace($valor)) { Write-Host "  - ${nome}: sem valor, pulado" -ForegroundColor Yellow; return }
  $valor | npx --yes wrangler@4 secret put $nome | Out-Null
  Write-Host "  ok $nome" -ForegroundColor Green
}

function DoSegredoAws([string]$id, [string]$chave) {
  try {
    $json = aws secretsmanager get-secret-value --region $regiao --secret-id $id --query SecretString --output text
    return ($json | ConvertFrom-Json).$chave
  } catch { return $null }
}

function Perguntar([string]$nome, [string]$explicacao) {
  Write-Host ""
  Write-Host "$nome  ($explicacao)  [Enter vazio pula]"
  $s = Read-Host -AsSecureString
  $v = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($s))
  # Caminho de arquivo (ex.: o .json do Firebase): usa o conteúdo, numa linha só.
  $caminho = $v.Trim().Trim('"')
  if ($caminho -and (Test-Path -LiteralPath $caminho -PathType Leaf)) {
    return ((Get-Content -LiteralPath $caminho -Raw | ConvertFrom-Json) | ConvertTo-Json -Depth 20 -Compress)
  }
  return $v
}

Write-Host "1) Chaves que já estão no AWS Secrets Manager" -ForegroundColor Cyan
Gravar 'ANTHROPIC_KEY_HUBGAMERS'    (DoSegredoAws 'hubgamers/api' 'ANTHROPIC_API_KEY')
Gravar 'SMSFIRE_USERNAME_HUBGAMERS' (DoSegredoAws 'hubgamers/api' 'SMSFIRE_USERNAME')
Gravar 'SMSFIRE_TOKEN_HUBGAMERS'    (DoSegredoAws 'hubgamers/api' 'SMSFIRE_API_TOKEN')
Gravar 'OPENAI_KEY_HUBGAMERS'       (DoSegredoAws 'hubgamers/api' 'OPENAI_API_KEY')
Gravar 'X_BEARER_HUBGAMERS'         (DoSegredoAws 'hubgamers/api' 'X_BEARER_TOKEN')
Gravar 'FACEIT_KEY_HUBGAMERS'       (DoSegredoAws 'hubgamers/api' 'FACEIT_API_KEY')
Gravar 'STEAM_KEY_HUBGAMERS'        (DoSegredoAws 'hubgamers/api' 'STEAM_WEB_API_KEY')
Gravar 'FIREBASE_SA_HUBGAMERS'      (DoSegredoAws 'hubgamers/api' 'FCM_SERVICE_ACCOUNT_JSON')

Write-Host ""
Write-Host "2) Chave AWS só de leitura das máquinas (EC2)" -ForegroundColor Cyan
$usuario = 'storeapps-status-leitura'
$politica = '{"Version":"2012-10-17","Statement":[{"Effect":"Allow","Action":["ec2:DescribeInstanceStatus","ec2:DescribeInstances"],"Resource":"*"}]}'
# cmd /c: no Windows PowerShell, aviso no stderr com $ErrorActionPreference=Stop derrubaria o script.
cmd /c "aws iam get-user --user-name $usuario >nul 2>nul"
if ($LASTEXITCODE -ne 0) { aws iam create-user --user-name $usuario --tags Key=uso,Value=storeapps-status | Out-Null }
# A política vai por arquivo: passada direto, o Windows PowerShell tira as aspas do JSON.
$arquivoPolitica = Join-Path $env:TEMP 'storeapps-status-politica.json'
[IO.File]::WriteAllText($arquivoPolitica, $politica)
aws iam put-user-policy --user-name $usuario --policy-name SoLerEstadoDasMaquinas --policy-document "file://$arquivoPolitica"
Remove-Item $arquivoPolitica
# Uma chave por vez: as antigas saem antes de criar a nova.
$antigas = aws iam list-access-keys --user-name $usuario --query 'AccessKeyMetadata[].AccessKeyId' --output text
if ($antigas) {
  foreach ($k in "$antigas".Split("`t ", [StringSplitOptions]::RemoveEmptyEntries)) {
    if ($k -ne 'None') { aws iam delete-access-key --user-name $usuario --access-key-id $k }
  }
}
$nova = aws iam create-access-key --user-name $usuario --output json | ConvertFrom-Json
Gravar 'AWS_STATUS_KEY_ID' $nova.AccessKey.AccessKeyId
Gravar 'AWS_STATUS_SECRET' $nova.AccessKey.SecretAccessKey
$nova = $null

Write-Host ""
Write-Host "3) GitHub Actions (token da conta bruno-storeapps)" -ForegroundColor Cyan
Gravar 'GITHUB_STATUS_TOKEN' (gh auth token --user bruno-storeapps)
# O repositório do Oxe (BrunoCarvalhoSI/oxe-sushi) fica na outra conta do gh.
Gravar 'GITHUB_STATUS_TOKEN_OXE' (gh auth token --user BrunoCarvalhoSI)

Write-Host ""
Write-Host "3b) Apple: chave do App Store Connect (a mesma que envia as versões)" -ForegroundColor Cyan
$p8 = Join-Path $env:USERPROFILE '.keys\AuthKey_DSUJS39D7G.p8'
if (Test-Path $p8) {
  Gravar 'ASC_KEY_ID' 'DSUJS39D7G'
  Gravar 'ASC_KEY_P8' (Get-Content -LiteralPath $p8 -Raw)
  Gravar 'ASC_ISSUER_ID' (Perguntar 'ASC_ISSUER_ID' 'Issuer ID do App Store Connect: Usuários e acesso > Integrações > App Store Connect API')
} else {
  Write-Host "  - chave .p8 não encontrada em $p8, pulado" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "4) Chaves que só você tem (cole quando pedir)" -ForegroundColor Cyan
Gravar 'SMSFIRE_USERNAME_VUMBORALA' (Perguntar 'SMSFIRE_USERNAME_VUMBORALA' 'SMSFIRE_USERNAME do VumboraLá, no .env do servidor')
Gravar 'SMSFIRE_TOKEN_VUMBORALA' (Perguntar 'SMSFIRE_TOKEN_VUMBORALA' 'SMSFIRE_API_TOKEN do VumboraLá')
Gravar 'FIREBASE_SA_VUMBORALA' (Perguntar 'FIREBASE_SA_VUMBORALA' 'caminho do arquivo .json da conta de serviço do Firebase do VumboraLá')
Gravar 'ANTHROPIC_KEY_OXE'   (Perguntar 'ANTHROPIC_KEY_OXE' 'ANTHROPIC_API_KEY do oxe-financeiro, no .env da Hostinger')
Gravar 'OPENAI_KEY_OXE'      (Perguntar 'OPENAI_KEY_OXE' 'OPENAI_API_KEY do oxe-financeiro')
Gravar 'TELEGRAM_TOKEN_OXE'  (Perguntar 'TELEGRAM_TOKEN_OXE' 'TELEGRAM_BOT_TOKEN do oxe-financeiro')
Gravar 'IPROYAL_TOKEN_HUBGAMERS' (Perguntar 'IPROYAL_TOKEN_HUBGAMERS' 'token de API do painel da IPRoyal (não é a senha do proxy)')
Gravar 'NEON_KEY_VUMBORALA'  (Perguntar 'NEON_KEY_VUMBORALA' 'chave de API do Neon com acesso ao projeto VumboraLA')
Gravar 'NEON_KEY_QUERIDO'    (Perguntar 'NEON_KEY_QUERIDO' 'chave de API do Neon do projeto QueridoDelivery')

Write-Host ""
Write-Host "Pronto. A próxima verificação (até 5 min) já usa as chaves." -ForegroundColor Green
