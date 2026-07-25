$ErrorActionPreference = "Stop"

$presentationPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\02-ColdPilot-GOAI-Preliminary.pptx"))
$pdfPath = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\02-ColdPilot-GOAI-Preliminary.pdf"))
$renderDirectory = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot "..\qa-render"))

New-Item -ItemType Directory -Force -Path $renderDirectory | Out-Null

$powerPointApplication = New-Object -ComObject PowerPoint.Application
try {
    $presentation = $powerPointApplication.Presentations.Open($presentationPath, $true, $false, $false)
    try {
        $presentation.SaveAs($pdfPath, 32)
        $presentation.Export($renderDirectory, "PNG", 1600, 900)
    }
    finally {
        $presentation.Close()
    }
}
finally {
    $powerPointApplication.Quit()
    [System.Runtime.InteropServices.Marshal]::ReleaseComObject($powerPointApplication) | Out-Null
}

Write-Output $pdfPath
Write-Output $renderDirectory
