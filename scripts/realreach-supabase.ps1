<#
RealReach-only operator helper. Never prints the personal access token.
The DPAPI credential can be decrypted only in the original Windows user context.
Examples:
  & ./scripts/realreach-supabase.ps1 -Operation ProjectInfo
  & ./scripts/realreach-supabase.ps1 -CliArguments @('functions', 'list')
  & ./scripts/realreach-supabase.ps1 -Operation ReadOnlyQuery -Sql 'select 1 as access_check'
Authorization for an individual deployment or database mutation is still required.
#>
param(
    [ValidateSet('Cli', 'ProjectInfo', 'ReadOnlyQuery')]
    [string]$Operation = 'Cli',
    [string[]]$CliArguments = @(),
    [string]$Sql
)

$ErrorActionPreference = 'Stop'
$rrProjectRef = 'jabwuawiqsusjrccapab'
$rrRepo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$rrCredentialPath = Join-Path $rrRepo '.local-credentials/supabase-pat.dpapi'
$rrConfiguration = Get-Content -LiteralPath (Join-Path $rrRepo 'supabase/config.toml') -Raw
if ($rrConfiguration -notmatch '(?m)^project_id\s*=\s*"jabwuawiqsusjrccapab"\s*$') {
    throw 'This helper is restricted to the RealReach repository and project.'
}

if ($Operation -eq 'Cli') {
    if ($CliArguments.Count -eq 0 -or $CliArguments[0] -notin @('functions', 'secrets', 'db', 'migration', 'gen', 'inspect', 'link')) {
        throw 'Use a project-scoped CLI command; account-wide commands are not supported.'
    }
    for ($rrIndex = 0; $rrIndex -lt $CliArguments.Count; $rrIndex++) {
        $rrArgument = $CliArguments[$rrIndex]
        if ($rrArgument -match '^--(profile|workdir|db-url|debug)(=|$)') {
            throw 'Credential, repository, connection and debug overrides are not allowed.'
        }
        if ($rrArgument -match '^--project-(ref|id)=(.+)$' -and $Matches[2] -ne $rrProjectRef) {
            throw 'A different project is not allowed.'
        }
        if ($rrArgument -in @('--project-ref', '--project-id')) {
            if ($rrIndex + 1 -ge $CliArguments.Count -or $CliArguments[$rrIndex + 1] -ne $rrProjectRef) {
                throw 'A different project is not allowed.'
            }
        }
    }
    if ($CliArguments[0] -in @('functions', 'secrets', 'link') -and -not ($CliArguments -match '^--project-ref(=|$)')) {
        $CliArguments += @('--project-ref', $rrProjectRef)
    }
    if ($CliArguments[0] -eq 'gen' -and -not ($CliArguments -contains '--local') -and -not ($CliArguments -contains '--help')) {
        if (-not ($CliArguments -match '^--project-id(=|$)')) {
            throw 'Remote type generation must specify the RealReach project ID.'
        }
    }
    if ($CliArguments[0] -in @('db', 'migration', 'inspect') -and -not ($CliArguments -contains '--local') -and -not ($CliArguments -contains '--help')) {
        $rrLinkedPath = Join-Path $rrRepo 'supabase/.temp/project-ref'
        if (-not (Test-Path -LiteralPath $rrLinkedPath) -or (Get-Content -LiteralPath $rrLinkedPath -Raw).Trim() -ne $rrProjectRef) {
            throw 'Link this checkout to the RealReach project before using linked database commands.'
        }
    }
}
if ($Operation -eq 'ReadOnlyQuery' -and [string]::IsNullOrWhiteSpace($Sql)) {
    throw 'A read-only SQL query is required.'
}

$rrPriorToken = [Environment]::GetEnvironmentVariable('SUPABASE_ACCESS_TOKEN', 'Process')
$rrSecureCredential = $null
$rrPlainCredential = $null
$rrCredentialPointer = [IntPtr]::Zero
$rrHeaders = $null
Push-Location -LiteralPath $rrRepo
try {
    $rrSecureCredential = ConvertTo-SecureString -String (Get-Content -LiteralPath $rrCredentialPath -Raw).Trim()
    $rrCredentialPointer = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($rrSecureCredential)
    $rrPlainCredential = [Runtime.InteropServices.Marshal]::PtrToStringBSTR($rrCredentialPointer)
    $rrHeaders = @{ Authorization = 'Bearer ' + $rrPlainCredential }
    $rrProject = Invoke-RestMethod -Method Get -Uri ('https://api.supabase.com/v1/projects/' + $rrProjectRef) -Headers $rrHeaders -TimeoutSec 30
    $rrReturnedRef = if ($rrProject.ref) { $rrProject.ref } else { $rrProject.id }
    if ($rrReturnedRef -ne $rrProjectRef) {
        throw 'Supabase returned a different project; refusing further access.'
    }
    switch ($Operation) {
        'ProjectInfo' {
            [pscustomobject]@{ project_ref = $rrReturnedRef; name = $rrProject.name; status = $rrProject.status; api_url = 'https://jabwuawiqsusjrccapab.supabase.co' }
        }
        'ReadOnlyQuery' {
            $rrBody = @{ query = $Sql } | ConvertTo-Json -Compress
            Invoke-RestMethod -Method Post -Uri ('https://api.supabase.com/v1/projects/' + $rrProjectRef + '/database/query/read-only') -Headers $rrHeaders -ContentType 'application/json' -Body $rrBody -TimeoutSec 30
        }
        'Cli' {
            $env:SUPABASE_ACCESS_TOKEN = $rrPlainCredential
            & supabase @CliArguments
            if ($LASTEXITCODE -ne 0) { throw ('Supabase command failed with exit code ' + $LASTEXITCODE) }
        }
    }
} finally {
    [Environment]::SetEnvironmentVariable('SUPABASE_ACCESS_TOKEN', $rrPriorToken, 'Process')
    if ($rrCredentialPointer -ne [IntPtr]::Zero) { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($rrCredentialPointer) }
    if ($rrSecureCredential) { $rrSecureCredential.Dispose() }
    if ($rrHeaders) { $rrHeaders.Clear() }
    $rrPlainCredential = $null
    Pop-Location
}
