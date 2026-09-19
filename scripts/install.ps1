#Requires -Version 7
<#
.SYNOPSIS
Installs the skills into ~\.claude\skills, where Claude Code discovers
personal skills in every project.

.DESCRIPTION
The Windows counterpart of scripts/install.sh. Each plugin\skills\<name>
directory is copied whole, so the installed copy is independent of this
checkout. To work on the skills instead, use scripts\link-local.ps1.

.PARAMETER Force
Overwrite skills that are already installed.

.PARAMETER DryRun
Print what would happen and change nothing.
#>
[CmdletBinding()]
param(
  [switch] $Force,
  [switch] $DryRun
)

Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'

$repoRoot = Split-Path -Parent $PSScriptRoot
$skillsSrc = Join-Path $repoRoot 'plugin' 'skills'
$claudeDir = Join-Path $HOME '.claude' 'skills'

if (-not (Test-Path -LiteralPath $skillsSrc)) {
  Write-Error "$skillsSrc not found"
}

$installed = 0
$skipped = 0
$conflicts = 0

$packName = 'functional-design-skills'

# Skills are copied flat into ~/.claude/skills, so two packs can claim the
# same directory name. Without this the second install just says "skip" and
# the user is quietly missing skills they believe they installed. Every
# SKILL.md carries the pack it came from under metadata.pack.
function Get-PackName {
  param([string] $Dir)
  $file = Join-Path $Dir 'SKILL.md'
  if (-not (Test-Path -LiteralPath $file)) { return $null }
  foreach ($line in (Get-Content -LiteralPath $file -TotalCount 20)) {
    if ($line -match '^  pack:\s*(.+)$') { return $Matches[1].Trim() }
  }
  return $null
}

foreach ($src in Get-ChildItem -LiteralPath $skillsSrc -Directory) {
  $dest = Join-Path $claudeDir $src.Name

  if (Test-Path -LiteralPath $dest) {
    $owner = Get-PackName $dest
    # A directory that names no pack is not this pack's to delete. Most
    # skills in the world carry no marker -- metadata.pack is this pack's
    # own convention -- so treating "unmarked" as "mine" meant -Force
    # removed a stranger's work without saying so. Being told to remove it
    # by hand is the cost of never doing that.
    if (-not $owner) {
      Write-Host "unmarked $($src.Name) claims no pack; remove it first if this pack should own it"
      $conflicts++
      continue
    }
    if ($owner -ne $packName) {
      Write-Host "conflict $($src.Name) belongs to $owner; remove it first"
      $conflicts++
      continue
    }
    if (-not $Force) {
      Write-Host "skip   $($src.Name) (already installed; use -Force to replace)"
      $skipped++
      continue
    }
  }

  if ($DryRun) {
    Write-Host "would   copy $($src.Name) -> $dest"
  } else {
    New-Item -ItemType Directory -Path $claudeDir -Force | Out-Null
    if (Test-Path -LiteralPath $dest) {
      Remove-Item -LiteralPath $dest -Recurse -Force
    }
    Copy-Item -LiteralPath $src.FullName -Destination $dest -Recurse
    Write-Host "copied $($src.Name) -> $dest"
  }
  $installed++
}

Write-Host ''
Write-Host "$installed skill(s) installed, $skipped skipped, $conflicts in conflict"

if ($conflicts -gt 0) {
  Write-Host 'A conflict means that skill name is already taken, by another'
  Write-Host 'pack or by something that does not say. Neither is replaced, even'
  Write-Host 'with -Force. Remove the directory yourself to hand it over.'
}

if ($installed -gt 0 -and -not $DryRun) {
  Write-Host 'Start a new session for the skills to be discovered.'
}
