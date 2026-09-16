import { useEffect, useId, useState } from 'react'
import type { Layer } from './types'
import { OWNED_INKS, isHex, layerInkHex, nearestOwnedInks, selectedOwnedInk, swatchHex, swatchSource } from './inks'
import type { OwnedInk } from './inks'

export default function InkPicker({ layer, onChange }: { layer: Layer; onChange: (hex: string, sku?: string) => void }) {
  const current = layerInkHex(layer)
  const selected = selectedOwnedInk(layer)
  const [expanded, setExpanded] = useState(false)
  const [search, setSearch] = useState('')
  const [draft, setDraft] = useState(current)
  const [error, setError] = useState('')
  const id = useId()
  useEffect(() => { setDraft(current); setError('') }, [current, layer.id])
  const filtered = OWNED_INKS.filter(ink => `${ink.name} ${ink.sku}`.toLowerCase().includes(search.toLowerCase()))
  function choose(ink: OwnedInk) {
    const hex = swatchHex(ink)
    if (!hex) return
    onChange(hex, ink.sku); setExpanded(false); setSearch(''); setDraft(hex); setError('')
  }
  function applyCustom() {
    const hex = draft.trim().startsWith('#') ? draft.trim() : `#${draft.trim()}`
    if (!isHex(hex)) { setError('Use six hex digits, for example #C0392B.'); return }
    onChange(hex); setDraft(hex); setError('')
  }
  function option(ink: OwnedInk) {
    const hex = swatchHex(ink)
    return <button key={ink.sku} className="owned-ink-option" type="button" aria-label={`Use ${ink.name} ${ink.sku}${ink.base === 'oil' ? ', oil-based, no reinker' : ''}`} aria-pressed={selected?.sku === ink.sku} disabled={!hex} onClick={() => choose(ink)}>
      <span className="owned-swatch" style={{ background: hex ?? 'transparent' }} aria-hidden="true"/>
      <span className="owned-ink-name"><strong>{ink.name}{ink.qty > 1 && <span> ×{ink.qty}</span>}</strong><small>{ink.sku}</small><small className={ink.base === 'oil' ? 'oil-note' : ''}>{ink.base === 'oil' ? 'Oil-based · no reinker' : ink.printed_hex ? 'Measured print' : 'Approximate'}</small></span>
      <span className="owned-hex">{hex?.toUpperCase() ?? 'No swatch'}</span>
    </button>
  }
  return <div className="ink-picker" aria-label="Pass ink">
    <div className="current-ink"><span className="owned-swatch" style={{ background: current }}/><div><strong>{selected?.name ?? 'Custom colour'}</strong><small>{selected?.sku ?? 'Not in your owned palette'}</small></div></div>
    <p className="ink-provenance">{selected ? swatchSource(selected) : 'Custom preview, not a measured print.'}</p>
    {selected?.base === 'oil' && <p className="ink-caution">Bronze is oil-based. Do not mix with your water-based inks. No reinker is available.</p>}
    <button type="button" className="owned-toggle" aria-expanded={expanded} aria-controls={`${id}-palette`} onClick={() => setExpanded(!expanded)}>{expanded ? 'Close owned palette' : `Choose owned ink (${OWNED_INKS.length})`} <span aria-hidden="true">{expanded ? '−' : '+'}</span></button>
    {expanded && <div id={`${id}-palette`} className="owned-palette" role="group" aria-label="Owned ink palette">
      <input type="search" aria-label="Search owned inks" placeholder="Name or VS code…" value={search} onChange={e => setSearch(e.target.value)}/>
      <p className="micro">{OWNED_INKS.length} colours · {OWNED_INKS.reduce((n,i) => n+i.qty,0)} pads. Vendor swatches are approximate, not measured pigment colours. A measured printed swatch takes precedence when available.</p>
      <div className="owned-ink-list">{filtered.map(option)}{!filtered.length && <p className="micro">No owned inks match that search.</p>}</div>
      <p className="micro">Bronze (094) is oil-based, cannot mix with the other inks and has no reinker. Only a stamped, photographed swatch supplies a measured value.</p>
    </div>}
    {!selected && !expanded && <div className="nearest-inks" role="group" aria-label="Nearest owned colours"><h3>Nearest owned swatches</h3>{nearestOwnedInks(current).map(option)}<p className="micro">Approximate screen-colour matches. Choose one to change this pass.</p></div>}
    <label className="custom-ink-label" htmlFor={`${id}-hex`}>Custom mix / hex</label>
    <div className="custom-ink-controls"><input aria-label="Ink colour" type="color" value={current} onChange={e => { onChange(e.target.value); setDraft(e.target.value); setError('') }}/><input id={`${id}-hex`} type="text" spellCheck={false} maxLength={7} value={draft} aria-invalid={!!error} aria-describedby={error ? `${id}-error` : undefined} onChange={e => { setDraft(e.target.value); setError('') }} onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); applyCustom() } }}/><button type="button" onClick={applyCustom}>Apply</button></div>
    {error && <p id={`${id}-error`} className="ink-caution" role="alert">{error}</p>}
  </div>
}
