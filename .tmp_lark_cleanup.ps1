$searchRoots = @(
    'C:\Users\admin\.agents',
    'C:\Users\admin\.codeartsdoer',
    'C:\Users\admin\.codeium',
    'C:\Users\admin\.cursor',
    'C:\Users\admin\.claude'
)

foreach ($root in $searchRoots) {
    if (-not (Test-Path $root)) { continue }
    $hits = Get-ChildItem -Path $root -Recurse -Force -ErrorAction SilentlyContinue |
        Where-Object { $_.Name -like 'lark*' -or $_.Name -like '*lark-cli*' }
    if ($hits) {
        Write-Output ("=== {0} ===" -f $root)
        $hits | ForEach-Object { Write-Output ("  {0}  {1}" -f $_.Mode, $_.FullName) }
    } else {
        Write-Output ("{0}: clean" -f $root)
    }
}

# Also check the standalone .lark-cli directory
if (Test-Path 'C:\Users\admin\.lark-cli') {
    Write-Output "=== C:\Users\admin\.lark-cli exists (lark CLI config dir, not a skill) ==="
    Get-ChildItem 'C:\Users\admin\.lark-cli' -Force -ErrorAction SilentlyContinue |
        ForEach-Object { Write-Output ("  {0}  {1}" -f $_.Mode, $_.Name) }
}
