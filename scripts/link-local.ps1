#Requires -Version 7
<#
.SYNOPSIS
Makes the skills discoverable inside this repository while working on them.

.DESCRIPTION
The Windows counterpart of scripts/link-local.sh. Links plugin\skills\<name>
into .claude\skills, the per-project location Claude Code scans. That
directory is gitignored, so nothing here is committed.

On Windows the links are directory junctions, which need no administrator
rights and no developer mode; elsewhere they are symbolic links.

.PARAMETER Remove
Delete the links again.
#>
[CmdletBinding()]
param(
  [switch] $Remove
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$skillsSrc = Join-Path $repoRoot 'plugin' 'skills'
$claudeDir = Join-Path $repoRoot '.claude' 'skills'

if ($Remove) {
  if (Test-Path -LiteralPath $claudeDir) {
    Remove-Item -LiteralPath $claudeDir -Recurse -Force
  }
  Write-Host 'removed local skill links'
  return
}

# Junction is Windows-only and needs no elevation. SymbolicLink is what the
# other platforms have, and creating one there needs no elevation either.
$linkType = if ($IsWindows) { 'Junction' } else { 'SymbolicLink' }

New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null

$count = 0
foreach ($src in Get-ChildItem -LiteralPath $skillsSrc -Directory) {
  $link = Join-Path $claudeDir $src.Name
  if (Test-Path -LiteralPath $link) {
    Remove-Item -LiteralPath $link -Recurse -Force
  }
  New-Item -ItemType $linkType -Path $link -Target $src.FullName | Out-Null
  Write-Host "linked $($src.Name)"
  $count++
}

Write-Host ''
Write-Host "$count skill(s) linked into .claude\skills"
