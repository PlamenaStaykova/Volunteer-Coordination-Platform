param(
  [string]$ProjectRef = "eijcwbrmxnvzynnnvtka",
  [string]$DbUrl,
  [SecureString]$DbPassword,
  [string]$AccessToken,
  [switch]$DryRun
)

$ErrorActionPreference = "Stop"

Write-Host "Running Supabase migrations from supabase/migrations..."

if (-not $DbUrl -and (-not $DbPassword -or -not $AccessToken)) {
  throw "Provide either -DbUrl, or both -DbPassword and -AccessToken."
}

if ($DbUrl) {
  if ($DryRun) {
    npx supabase db push --db-url $DbUrl --include-all --dry-run
  }
  else {
    npx supabase db push --db-url $DbUrl --include-all --yes
  }
  exit $LASTEXITCODE
}

$env:SUPABASE_ACCESS_TOKEN = $AccessToken

npx supabase link --project-ref $ProjectRef --password $DbPassword

if ($DryRun) {
  npx supabase db push --linked --include-all --dry-run
}
else {
  npx supabase db push --linked --include-all --yes
}

exit $LASTEXITCODE
