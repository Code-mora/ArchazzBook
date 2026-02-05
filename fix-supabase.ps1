$filePath = "d:\ARCHAZZ\supabase-config.js"
$content = Get-Content $filePath -Raw
$content = $content -replace 'await supabase\.', 'await window.supabaseClient.'
$content = $content -replace '} = supabase\.', '} = window.supabaseClient.'
$content = $content -replace '\) supabase\.', ') window.supabaseClient.'
Set-Content $filePath $content -NoNewline
Write-Host "File updated successfully"
