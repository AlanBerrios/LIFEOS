Add-Type -AssemblyName System.Drawing

$assetsDir = Join-Path $PSScriptRoot '..\assets\branding'
New-Item -ItemType Directory -Force -Path $assetsDir | Out-Null

function New-LifeosImage {
  param(
    [string]$Path,
    [int]$Size = 1024,
    [bool]$WithRoundedFrame = $true,
    [bool]$Transparent = $false,
    [bool]$WithWordmark = $false,
    [double]$ForegroundScale = 1.0
  )

  $bmp = New-Object System.Drawing.Bitmap $Size, $Size
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality

  $coreBlack = [System.Drawing.Color]::FromArgb(255,0,0,0)
  $darkGrey = [System.Drawing.Color]::FromArgb(255,18,18,18)
  $volt = [System.Drawing.Color]::FromArgb(255,189,255,0)

  if ($Transparent) {
    $g.Clear([System.Drawing.Color]::Transparent)
  } else {
    $bgBrush = New-Object System.Drawing.Drawing2D.LinearGradientBrush(
      (New-Object System.Drawing.Point 0,0),
      (New-Object System.Drawing.Point $Size,$Size),
      $coreBlack,
      [System.Drawing.Color]::FromArgb(255,14,14,20)
    )
    $g.FillRectangle($bgBrush, 0, 0, $Size, $Size)
    $bgBrush.Dispose()
  }

  if ($WithRoundedFrame) {
    $pad = [int]($Size * 0.14)
    $radius = [int]($Size * 0.16)
    $rect = New-Object System.Drawing.Rectangle $pad, $pad, ($Size - 2*$pad), ($Size - 2*$pad)
    $shapePath = [System.Drawing.Drawing2D.GraphicsPath]::new()
    $d = $radius * 2
    $shapePath.AddArc($rect.X, $rect.Y, $d, $d, 180, 90)
    $shapePath.AddArc($rect.Right - $d, $rect.Y, $d, $d, 270, 90)
    $shapePath.AddArc($rect.Right - $d, $rect.Bottom - $d, $d, $d, 0, 90)
    $shapePath.AddArc($rect.X, $rect.Bottom - $d, $d, $d, 90, 90)
    $shapePath.CloseFigure()

    $frameBrush = New-Object System.Drawing.SolidBrush $darkGrey
    $framePen = [System.Drawing.Pen]::new([System.Drawing.Color]::FromArgb(255,40,40,40), [float]($Size * 0.006))
    $g.FillPath($frameBrush, $shapePath)
    $g.DrawPath($framePen, $shapePath)
    $frameBrush.Dispose(); $framePen.Dispose(); $shapePath.Dispose()
  }

  $g.TranslateTransform([float]($Size / 2), [float]($Size / 2))
  $g.ScaleTransform([float]$ForegroundScale, [float]$ForegroundScale)
  $g.TranslateTransform([float](-$Size / 2), [float](-$Size / 2))

  $baseY = [float]($Size * 0.67)
  $leftX = [float]($Size * 0.31)
  $baseW = [float]($Size * 0.34)
  $baseH = [float]($Size * 0.07)

  $base = New-Object System.Drawing.RectangleF $leftX, $baseY, $baseW, $baseH
  $voltBrush = New-Object System.Drawing.SolidBrush $volt
  $g.FillRectangle($voltBrush, $base)

  $shaft = New-Object System.Drawing.Drawing2D.GraphicsPath
  $sx1 = [float]($Size * 0.33); $sy1 = [float]($Size * 0.64)
  $sx2 = [float]($Size * 0.47); $sy2 = [float]($Size * 0.43)
  $sw = [float]($Size * 0.06)
  $vx = $sx2 - $sx1; $vy = $sy2 - $sy1
  $len = [math]::Sqrt($vx*$vx + $vy*$vy)
  $nx = -$vy / $len; $ny = $vx / $len

  $p1 = New-Object System.Drawing.PointF ($sx1 + $nx*$sw), ($sy1 + $ny*$sw)
  $p2 = New-Object System.Drawing.PointF ($sx1 - $nx*$sw), ($sy1 - $ny*$sw)
  $p3 = New-Object System.Drawing.PointF ($sx2 - $nx*$sw), ($sy2 - $ny*$sw)
  $p4 = New-Object System.Drawing.PointF ($sx2 + $nx*$sw), ($sy2 + $ny*$sw)
  $shaft.AddPolygon(@($p1,$p2,$p3,$p4))
  $g.FillPath($voltBrush, $shaft)
  $shaft.Dispose()

  $head = New-Object System.Drawing.Drawing2D.GraphicsPath
  $hx = [float]($Size * 0.57); $hy = [float]($Size * 0.32)
  $h1 = New-Object System.Drawing.PointF $hx, $hy
  $h2 = New-Object System.Drawing.PointF ([float]($Size * 0.46)), ([float]($Size * 0.38))
  $h3 = New-Object System.Drawing.PointF ([float]($Size * 0.52)), ([float]($Size * 0.49))
  $head.AddPolygon(@($h1,$h2,$h3))
  $g.FillPath($voltBrush, $head)
  $head.Dispose()

  if ($WithWordmark) {
    $font = New-Object System.Drawing.Font('Segoe UI', [float]($Size * 0.12), [System.Drawing.FontStyle]::Bold)
    $textBrush = New-Object System.Drawing.SolidBrush $volt
    $g.DrawString('LIFEOS', $font, $textBrush, [float]($Size*0.18), [float]($Size*0.80))
    $textBrush.Dispose(); $font.Dispose()
  }

  $g.ResetTransform()

  $voltBrush.Dispose()
  $g.Dispose()
  $bmp.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
}

New-LifeosImage -Path (Join-Path $assetsDir 'icon-v3.png') -Size 1024 -WithRoundedFrame $true -Transparent $false -WithWordmark $false -ForegroundScale 0.9
New-LifeosImage -Path (Join-Path $assetsDir 'adaptive-icon-v3.png') -Size 1024 -WithRoundedFrame $false -Transparent $true -WithWordmark $false -ForegroundScale 0.9
New-LifeosImage -Path (Join-Path $assetsDir 'splash-icon-v3.png') -Size 1024 -WithRoundedFrame $false -Transparent $true -WithWordmark $false
New-LifeosImage -Path (Join-Path $assetsDir 'favicon-v3.png') -Size 256 -WithRoundedFrame $true -Transparent $false -WithWordmark $false

Write-Output "Brand assets generated in $assetsDir"
