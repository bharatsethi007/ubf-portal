# Downloads shipping line logos into public/line-logos/{CODE}.png (bundled, offline-safe).
# Codes must match src/features/importSea/shippingLineLogo.ts
$map = @{
  MAERSK='maersk.com'; ANL='anl.com.au'; COSCO='coscoshipping.com'; CMA='cma-cgm.com'
  PIL='pilship.com'; ONE='one-line.com'; OOCL='oocl.com'; NPDL='npdlship.com'
  MSC='msc.com'; HLAG='hapag-lloyd.com'; EMC='evergreen-line.com'; HMM='hmm21.com'
  YML='yangming.com'; ZIM='zim.com'; MATSON='matson.com'; SWIRE='swireshipping.com'
}
$dir = Join-Path $PSScriptRoot '..\public\line-logos'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
foreach ($k in $map.Keys) {
  $out = Join-Path $dir "$k.png"
  try {
    Invoke-WebRequest "https://www.google.com/s2/favicons?domain=$($map[$k])&sz=64" -OutFile $out -UseBasicParsing
    Write-Host "OK   $k"
  } catch { Write-Host "FAIL $k" }
}
