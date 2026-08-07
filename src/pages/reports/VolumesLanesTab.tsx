import { useState } from 'react'
import ExportAirTab from './ExportAirTab'
import ExportSeaTab from './ExportSeaTab'
import ImportAirTab from './ImportAirTab'
import ImportSeaTab from './ImportSeaTab'
import { Seg } from './reportsUi'

type Mode = 'expair' | 'expsea' | 'impair' | 'impsea'

export default function VolumesLanesTab() {
  const [mode, setMode] = useState<Mode>('expair')
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div style={{ padding: '2px 2px 0' }}>
        <Seg
          options={[
            { k: 'expair', label: 'Export Air' },
            { k: 'expsea', label: 'Export Sea' },
            { k: 'impair', label: 'Import Air' },
            { k: 'impsea', label: 'Import Sea' },
          ]}
          value={mode}
          onChange={setMode}
        />
      </div>
      {mode === 'expair' && <ExportAirTab />}
      {mode === 'expsea' && <ExportSeaTab />}
      {mode === 'impair' && <ImportAirTab />}
      {mode === 'impsea' && <ImportSeaTab />}
    </div>
  )
}
