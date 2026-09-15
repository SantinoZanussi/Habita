$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$root = Split-Path $PSScriptRoot -Parent
$source = [System.Drawing.Image]::FromFile((Join-Path $root 'brand/logos/habita-isotipo.png'))
$sizes = @{ mdpi = 48; hdpi = 72; xhdpi = 96; xxhdpi = 144; xxxhdpi = 192 }
try {
    foreach ($density in $sizes.Keys) {
        $size = $sizes[$density]
        $bitmap = [System.Drawing.Bitmap]::new($size, $size)
        $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
        try {
            $graphics.Clear([System.Drawing.Color]::White)
            $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
            $graphics.DrawImage($source, 0, 0, $size, $size)
            $path = Join-Path $root "mobile/android/app/src/main/res/mipmap-$density/ic_launcher.png"
            $bitmap.Save($path, [System.Drawing.Imaging.ImageFormat]::Png)
        } finally {
            $graphics.Dispose()
            $bitmap.Dispose()
        }
    }
} finally {
    $source.Dispose()
}
