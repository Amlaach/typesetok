Add-Type -AssemblyName System.Drawing

$width = 328
$height = 628
$bmp = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$g.TextRenderingHint = [System.Drawing.Text.TextRenderingHint]::AntiAliasGridFit
$g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Background: Authentic warm paper tone (#F4F3EF to #E5E2D9 - yellowish cream book paper)
$rect = New-Object System.Drawing.Rectangle(0, 0, $width, $height)
$topColor = [System.Drawing.Color]::FromArgb(255, 248, 247, 244)      # #F8F7F4 soft parchment
$bottomColor = [System.Drawing.Color]::FromArgb(255, 228, 226, 219)   # #E4E2DB warm desk tone
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $topColor, $bottomColor, 90.0)
$g.FillRectangle($brush, $rect)
$brush.Dispose()

# Ambient warm paper subtle halo in upper center
$pathGlow = New-Object System.Drawing.Drawing2D.GraphicsPath
$pathGlow.AddEllipse(-20, 20, 368, 260)
$pbg = New-Object System.Drawing.Drawing2D.PathGradientBrush($pathGlow)
$pbg.CenterColor = [System.Drawing.Color]::FromArgb(80, 255, 253, 248) # Warm cream light
$pbg.SurroundColors = @([System.Drawing.Color]::FromArgb(0, 244, 243, 239))
$g.FillPath($pbg, $pathGlow)
$pbg.Dispose()
$pathGlow.Dispose()

# Load clean emblem (book + OK)
$emblemPath = Join-Path (Get-Location) "assets\emblem-clean-dark.png"
# In emblem-clean-dark.png, OK was turned to cyan. For warm paper, let's create a rich ink version!
$srcIcon = [System.Drawing.Bitmap]::FromFile("assets\icon.png")
$w = $srcIcon.Width
$h = $srcIcon.Height
$inkEmblem = New-Object System.Drawing.Bitmap($w, $h, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)

for ($y = 0; $y -lt $h; $y++) {
    for ($x = 0; $x -lt $w; $x++) {
        $c = $srcIcon.GetPixel($x, $y)
        $inEmblemZone = ($x -ge 65 -and $x -le 450 -and $y -ge 80 -and $y -le 425)
        if (-not $inEmblemZone) {
            $inkEmblem.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0,0,0,0))
            continue
        }
        if ($c.R -gt 210 -and $c.G -gt 210 -and $c.B -gt 210) {
            # Background transparent (NO white box!)
            $inkEmblem.SetPixel($x, $y, [System.Drawing.Color]::FromArgb(0,0,0,0))
        }
        else {
            # Keep original book pages and dark navy OK
            $inkEmblem.SetPixel($x, $y, $c)
        }
    }
}
$srcIcon.Dispose()

# Warm paper emblem backing (warm circular badge, tinted #EFECE5, thin ink border #1E4A9E)
$cardX = 104
$cardY = 38
$cardSize = 120

$warmParchmentBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 238, 235, 228)) # #EEEBE4
$g.FillEllipse($warmParchmentBrush, $cardX, $cardY, $cardSize, $cardSize)
$warmParchmentBrush.Dispose()

$penInk = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 30, 74, 158), 2.5) # #1E4A9E Ink blue
$g.DrawEllipse($penInk, $cardX, $cardY, $cardSize, $cardSize)
$penInk.Dispose()

# Draw emblem inside
$g.DrawImage($inkEmblem, $cardX + 12, $cardY + 12, $cardSize - 24, $cardSize - 24)

# Typography (Warm Ink Colors from tok-ui)
$fontTitle = New-Object System.Drawing.Font("Segoe UI", 21, [System.Drawing.FontStyle]::Bold)
$fontSub = New-Object System.Drawing.Font("Segoe UI", 11, [System.Drawing.FontStyle]::Bold)
$fontBadge = New-Object System.Drawing.Font("Segoe UI", 9, [System.Drawing.FontStyle]::Bold)
$fontSmall = New-Object System.Drawing.Font("Segoe UI", 8.5, [System.Drawing.FontStyle]::Regular)

$brushInkPrimary = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 27, 26, 23))     # #1B1A17 deep ink
$brushInkBlue = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 30, 74, 158))       # #1E4A9E ink blue
$brushInkMuted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 87, 83, 75))       # #57534B warm sepia

$sfCenter = New-Object System.Drawing.StringFormat
$sfCenter.Alignment = [System.Drawing.StringAlignment]::Center

# App Title
$g.DrawString("TypesetOK", $fontTitle, $brushInkPrimary, ($width / 2), 178, $sfCenter)

# Hebrew subtitle: תוכנת עימוד מקצועית
$subHebrew = [System.Text.Encoding]::UTF8.GetString([byte[]]@(0xD7,0xAA,0xD7,0x95,0xD7,0x9B,0xD7,0xA0,0xD7,0xAA,0x20,0xD7,0xA2,0xD7,0x99,0xD7,0x9E,0xD7,0x95,0xD7,0x93,0x20,0xD7,0x9E,0xD7,0xA7,0xD7,0xA6,0xD7,0x95,0xD7,0xA2,0xD7,0x99,0xD7,0xAA))
$g.DrawString($subHebrew, $fontSub, $brushInkBlue, ($width / 2), 218, $sfCenter)

# Accent line
$penWarmLine = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(160, 201, 197, 187), 1.5) # #C9C5BB
$g.DrawLine($penWarmLine, 45, 256, $width - 45, 256)
$penWarmLine.Dispose()

# Warm paper cards
function Draw-WarmCard($graphics, $y, $title, $detail) {
    $rectCard = New-Object System.Drawing.Rectangle(24, $y, 280, 58)
    $bgCard = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(220, 236, 233, 225)) # #ECE9E1
    
    $p = New-Object System.Drawing.Drawing2D.GraphicsPath
    $r = 10
    $p.AddArc($rectCard.X, $rectCard.Y, $r*2, $r*2, 180, 90)
    $p.AddArc($rectCard.Right - $r*2, $rectCard.Y, $r*2, $r*2, 270, 90)
    $p.AddArc($rectCard.Right - $r*2, $rectCard.Bottom - $r*2, $r*2, $r*2, 0, 90)
    $p.AddArc($rectCard.X, $rectCard.Bottom - $r*2, $r*2, $r*2, 90, 90)
    $p.CloseFigure()
    
    $graphics.FillPath($bgCard, $p)
    $penCard = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(180, 201, 197, 187), 1) # #C9C5BB
    $graphics.DrawPath($penCard, $p)
    
    $fMain = New-Object System.Drawing.Font("Segoe UI", 9.5, [System.Drawing.FontStyle]::Bold)
    $fSub = New-Object System.Drawing.Font("Segoe UI", 8, [System.Drawing.FontStyle]::Regular)
    $bDark = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(27, 26, 23))
    $bMuted = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(87, 83, 75))
    $sf = New-Object System.Drawing.StringFormat
    $sf.Alignment = [System.Drawing.StringAlignment]::Center
    
    $graphics.DrawString($title, $fMain, $bDark, 164, $y + 10, $sf)
    $graphics.DrawString($detail, $fSub, $bMuted, 164, $y + 32, $sf)
    
    $fMain.Dispose(); $fSub.Dispose(); $bDark.Dispose(); $bMuted.Dispose(); $bgCard.Dispose(); $penCard.Dispose(); $p.Dispose()
}

Draw-WarmCard $g 278 "Hebrew Book Publishing" "Multi-Column Layouts & Classical Text"
Draw-WarmCard $g 353 "Fast Native Engine" "Offline, Private & Zero Telemetry"
Draw-WarmCard $g 428 "Embedded Typography" "Professional Hebrew Fonts Pack"

# Bottom badge: Windows 64-Bit Edition
$badgeRect = New-Object System.Drawing.Rectangle(54, 525, 220, 32)
$badgeBg = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(240, 232, 238, 248)) # soft ink soft #E8EEF8
$badgePen = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(200, 30, 74, 158), 1.5)
$g.FillRectangle($badgeBg, $badgeRect)
$g.DrawRectangle($badgePen, $badgeRect)
$g.DrawString("WINDOWS 64-BIT EDITION", $fontBadge, $brushInkBlue, 164, 533, $sfCenter)
$badgeBg.Dispose(); $badgePen.Dispose()

# Footer
$g.DrawString("TypesetOK Publishing System  v0.9", $fontSmall, $brushInkMuted, 164, 595, $sfCenter)

# Save BMP (24bpp RGB) and PNG
$outBmp = Join-Path (Get-Location) "assets\installer-sidebar.bmp"
$outPng = Join-Path (Get-Location) "assets\installer-sidebar.png"

$bmp24 = New-Object System.Drawing.Bitmap($width, $height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$g24 = [System.Drawing.Graphics]::FromImage($bmp24)
$g24.DrawImage($bmp, 0, 0)
$bmp24.Save($outBmp, [System.Drawing.Imaging.ImageFormat]::Bmp)
$bmp.Save($outPng, [System.Drawing.Imaging.ImageFormat]::Png)

$g24.Dispose()
$bmp24.Dispose()
$g.Dispose()
$bmp.Dispose()

# Now create Header Small Image (116x116 -> 58x58) with 100% warm paper background (#F4F3EF)
$headerSize = 116
$hBmp = New-Object System.Drawing.Bitmap($headerSize, $headerSize, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
$hg = [System.Drawing.Graphics]::FromImage($hBmp)
$hg.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
$hg.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic

# Fill with exact warm paper background (#F4F3EF - matches WizardBackColor!)
$warmBgBrush = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(255, 244, 243, 239))
$hg.FillRectangle($warmBgBrush, 0, 0, $headerSize, $headerSize)
$warmBgBrush.Dispose()

# Warm paper ring with ink blue border
$hRing = New-Object System.Drawing.Pen([System.Drawing.Color]::FromArgb(220, 30, 74, 158), 3)
$hg.DrawEllipse($hRing, 6, 6, $headerSize - 12, $headerSize - 12)
$hRing.Dispose()

# Draw clean emblem
$hg.DrawImage($inkEmblem, 18, 18, $headerSize - 36, $headerSize - 36)
$inkEmblem.Dispose()

$outHeaderBmp = Join-Path (Get-Location) "assets\installer-header.bmp"
$outHeaderPng = Join-Path (Get-Location) "assets\installer-header.png"

$hBmp24 = New-Object System.Drawing.Bitmap($headerSize, $headerSize, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
$hg24 = [System.Drawing.Graphics]::FromImage($hBmp24)
$hg24.Clear([System.Drawing.Color]::FromArgb(244, 243, 239)) # Exact warm cream #F4F3EF!
$hg24.DrawImage($hBmp, 0, 0)
$hBmp24.Save($outHeaderBmp, [System.Drawing.Imaging.ImageFormat]::Bmp)
$hBmp.Save($outHeaderPng, [System.Drawing.Imaging.ImageFormat]::Png)

$hg24.Dispose()
$hBmp24.Dispose()
$hg.Dispose()
$hBmp.Dispose()

Write-Output "Successfully generated authentic warm paper installer graphics!"
