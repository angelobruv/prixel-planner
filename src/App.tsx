import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, KeyboardEvent, PointerEvent } from 'react'
import TextComposer from './TextComposer'
import { layoutText } from './text'
import type { TextOptions } from './text'
import InkPicker from './InkPicker'
import { layerInkHex } from './inks'
import { artwork, artworkScale } from './art'
import { useTheme, THEME_LABEL } from './theme'
import { ReferenceControls, ReferenceLayer, useReference } from './reference'
import { BY_SKU, FAMILIES, binHex, GRID, INVENTORY_ITEMS, inventoryLabel, PIECES, attemptPlacement, attemptPlacements, blankProject, bounds, fromView, layerCounts, negroniProject, newLayer, occupied, parseProject, placementTransform, plateSize, plateTransform, remaining, requiredInventory, uid, validate } from './model'
import { createGroup, groupBounds, groupPlacements, importGroup, moveGroup, rotateGroup } from './groups'
import type { PlacementGroup } from './groups'
import { buildSheetHtml, download, fileStem, plateSvg, policyLabel } from './export'
import type { Design, Layer, Placement, Project, Rotation } from './types'

const STORAGE_KEY = 'prixel-planner-v1'
interface FloatingGroup { group: PlacementGroup; layerId: string; replaceIds: string[]; label: string }
function boot() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY)
    const project = saved ? parseProject(saved) : negroniProject()
    const migrated = !!saved && JSON.parse(saved).design?.schemaVersion === 1
    if (migrated && !localStorage.getItem(`${STORAGE_KEY}-before-mono-v2`)) localStorage.setItem(`${STORAGE_KEY}-before-mono-v2`, saved!)
    return {project,error:'',migrated}
  } catch {
    return {project:blankProject(),error:'The saved project could not be read or backed up. It has been left untouched. Import a backup, or resume saving to replace it.',migrated:false}
  }
}

/** Paint one placement as the physical piece: its bin colour, outlined so a
 *  yellow square reads on cream paper and two touching pieces stay separable.
 *  Art scales itself down to cell units, which scales the stroke with it, so
 *  the width is pre-divided to land at a constant .03 of a cell. */
function pieceColours(sku: string) {
  return { color: binHex(sku), stroke: '#3a342c', strokeWidth: .03 / artworkScale(sku), strokeLinejoin: 'round' as const }
}
function Art({ sku }: { sku: string }) {
  return <g transform={`scale(${artworkScale(sku)})`} dangerouslySetInnerHTML={{ __html: artwork(sku) }} />
}
function PieceIcon({ sku }: { sku: string }) {
  const p = BY_SKU[sku]
  return <svg viewBox={`-.15 -.15 ${p.cells_w + .3} ${p.cells_h + .3}`} aria-hidden="true"><Art sku={sku} /></svg>
}
export default function App() {
  const [initial] = useState(boot)
  const [history, setHistory] = useState<{ past: Project[]; present: Project; future: Project[] }>({ past: [], present: initial.project, future: [] })
  const project = history.present, d = project.design
  const active = d.layers.find(l => l.id === d.activeLayerId)!
  const [saveBlocked, setSaveBlocked] = useState(!!initial.error)
  const [saveStatus, setSaveStatus] = useState(initial.error || 'Saved on this device')
  const [notice, setNotice] = useState(initial.migrated ? 'Mono inventory upgraded to 323 physical case pieces. Review shared-pool counts in Inventory; your previous project is backed up on this device.' : '')
  const [sku, setSku] = useState<string | null>(null)
  const [rotation, setRotation] = useState<Rotation>(0)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  // Pieces, not references: the source may be cut or undone before the paste.
  const [clipboard, setClipboard] = useState<Placement[]>([])
  const setSelected = (id: string | null) => setSelectedIds(id ? [id] : [])
  const selectedPieces = active.placements.filter(p => selectedIds.includes(p.id))
  const selection = selectedPieces.length === 1 ? selectedPieces[0] : undefined
  const [floating, setFloating] = useState<FloatingGroup | null>(null)
  const [pendingImport, setPendingImport] = useState<Project | null>(null)
  const [textDraft, setTextDraft] = useState<{options:TextOptions; id:string}|null>(null)
  const busy = !!floating || !!pendingImport || !!textDraft
  const [mirror, setMirror] = useState(false)
  const [showGrid, setShowGrid] = useState(true)
  // Build-sheet view is for setting the physical plate, so it defaults to the
  // colours of the actual pieces. Untick to see the pass in its printing ink.
  const [binView, setBinView] = useState(true)
  const [hidden, setHidden] = useState<string[]>([])
  const [tab, setTab] = useState<'pieces' | 'inventory'>('pieces')
  const [search, setSearch] = useState('')
  const [hover, setHover] = useState<[number, number] | null>(null)
  const [cursor, setCursor] = useState<[number, number]>([2, 2])
  const [dragPreview, setDragPreview] = useState<Placement | null>(null)
  const svgRef = useRef<SVGSVGElement>(null)
  const imageRef = useRef<HTMLInputElement>(null)
  const { theme, next: nextTheme, cycle: cycleTheme } = useTheme()
  const reference = useReference(setNotice)
  const fileRef = useRef<HTMLInputElement>(null)
  const drag = useRef<{ p: Placement; dx: number; dy: number; x: number; y: number; moved: boolean } | null>(null)
  const groupDrag = useRef<{ start: PlacementGroup; col: number; row: number; x: number; y: number; moved: boolean } | null>(null)
  const issues = validate(project)
  const required = requiredInventory(d)
  const { w, h } = plateSize(d)
  const total = d.layers.reduce((n, l) => n + l.placements.length, 0)
  const activeCounts = layerCounts(active)
  const textLayout = textDraft ? layoutText(textDraft.options,d,textDraft.id) : null
  const textResult = textLayout?.placements.length ? attemptPlacements(project,active.id,textLayout.placements) : null
  const textErrors = textLayout ? [...textLayout.errors,...(textResult?.errors??[])] : []
  const textValid = !!textLayout?.pieces && !textErrors.length
  const floatingPlacements = floating ? groupPlacements(floating.group) : textLayout?.placements ?? []
  const floatingBounds = floatingPlacements.length ? groupBounds(floatingPlacements) : null
  const floatingResult = floating ? attemptPlacements(project, floating.layerId, floatingPlacements, floating.replaceIds) : null

  function commit(next: Project | ((p: Project) => void)) {
    setHistory(current => {
      const p = typeof next === 'function' ? structuredClone(current.present) : next
      if (typeof next === 'function') next(p)
      return { past: [...current.past.slice(-99), current.present], present: p, future: [] }
    })
    setNotice('')
  }
  function undo() { if (busy) return; setHistory(s => s.past.length ? { past: s.past.slice(0, -1), present: s.past.at(-1)!, future: [s.present, ...s.future] } : s); setSelected(null); setNotice('') }
  function redo() { if (busy) return; setHistory(s => s.future.length ? { past: [...s.past, s.present], present: s.future[0], future: s.future.slice(1) } : s); setSelected(null); setNotice('') }
  function setDesign<K extends keyof Design>(key: K, value: Design[K]) { commit(p => { p.design[key] = value }) }
  function editLayer(fn: (l: Layer) => void) { commit(p => { fn(p.design.layers.find(l => l.id === active.id)!) }) }
  function chooseLayer(id: string) { setDesign('activeLayerId', id); setSelected(null); setHidden(hidden.filter(h => h !== id)); setHover(null) }
  function applyPlacement(p: Placement) {
    const result = attemptPlacement(project, active.id, p)
    if (result.project) { commit(result.project); setSelected(p.id) } else setNotice(result.error!)
  }
  function placeAt(col: number, row: number) {
    if (!sku || mirror || busy) return
    applyPlacement({ id: uid(), sku, col, row, rotation })
  }
  function beginGroup(group: PlacementGroup, replaceIds: string[], label: string) {
    setFloating({ group, layerId: active.id, replaceIds, label }); setPendingImport(null)
    setSku(null); setHover(null); setDragPreview(null); setMirror(false); setNotice('')
    setHidden(h => h.filter(id => id !== active.id))
    requestAnimationFrame(() => svgRef.current?.focus({ preventScroll: true }))
  }
  function moveSelection(transform: (group: PlacementGroup) => PlacementGroup = g => g) {
    if (!selectedPieces.length || mirror || busy) return
    beginGroup(transform(createGroup(selectedPieces)), selectedPieces.map(p => p.id), 'Move selection')
  }
  function beginText() {
    if (busy || mirror) return
    setTextDraft({id:uid(),options:{text:'',col:2,row:2,alignment:'left'}})
    setSelected(null); setSku(null); setHover(null); setNotice('')
    setHidden(h=>h.filter(id=>id!==active.id))
  }
  function finishText() {
    if (!textDraft || !textValid || !textResult?.project) return
    commit(textResult.project); setSelectedIds(textLayout!.placements.map(p=>p.id)); setTextDraft(null)
    setNotice('Text placed as physical pieces. Undo restores the previous composition.')
  }
  function finishGroup() {
    if (!floating) return
    const result = attemptPlacements(project, floating.layerId, groupPlacements(floating.group), floating.replaceIds)
    if (!result.project) { setNotice(result.error!); return }
    commit(result.project); setSelectedIds(groupPlacements(floating.group).map(p => p.id))
    setFloating(null); groupDrag.current = null; setNotice('Group placed. Undo restores the previous composition.')
  }
  function cancelGroup() {
    setFloating(null); setPendingImport(null); setTextDraft(null); groupDrag.current = null; drag.current = null; setDragPreview(null)
    setNotice('Cancelled. The composition is unchanged.')
    svgRef.current?.focus({ preventScroll: true })
  }
  function rotate() {
    if (pendingImport || textDraft || mirror) return
    if (floating) {
      if (groupDrag.current) groupDrag.current.start = rotateGroup(groupDrag.current.start)
      setFloating(f => f ? { ...f, group: rotateGroup(f.group) } : f)
    }
    else if (selectedPieces.length > 1) moveSelection(rotateGroup)
    else if (selection) applyPlacement({ ...selection, rotation: ((selection.rotation + 90) % 360) as Rotation })
    else setRotation(r => ((r + 90) % 360) as Rotation)
  }
  function remove() {
    if (selectedPieces.length && !mirror && !busy) {
      editLayer(l => { l.placements = l.placements.filter(p => !selectedIds.includes(p.id)) }); setSelected(null)
    }
  }
  const plural = (n: number) => `${n} piece${n === 1 ? '' : 's'}`
  function copySelection() {
    if (!selectedPieces.length || busy) return
    setClipboard(selectedPieces.map(p => ({ ...p })))
    setNotice(`${plural(selectedPieces.length)} copied. Choose a pass, then paste.`)
  }
  function cutSelection() {
    if (!selectedPieces.length || mirror || busy) return
    const n = selectedPieces.length
    setClipboard(selectedPieces.map(p => ({ ...p })))
    editLayer(l => { l.placements = l.placements.filter(p => !selectedIds.includes(p.id)) })
    setSelected(null)
    setNotice(`${plural(n)} cut. Choose a pass, then paste to land them there.`)
  }
  /** Paste into the ACTIVE pass. In place first — that is what moves a motif
   *  between passes without shifting it. Offset only if that square is taken,
   *  which is the same-pass duplicate case. */
  function pasteClipboard() {
    if (!clipboard.length || mirror || busy) return
    const attempt = (dx: number, dy: number) => {
      const fresh = clipboard.map(p => ({ ...p, id: uid(), col: p.col + dx, row: p.row + dy }))
      return { fresh, ...attemptPlacements(project, active.id, fresh) }
    }
    const inPlace = attempt(0, 0)
    const landed = inPlace.project ? inPlace : attempt(1, 1)
    if (!landed.project) { setNotice(inPlace.error ?? 'That paste does not fit on this pass.'); return }
    commit(landed.project); setSelectedIds(landed.fresh.map(p => p.id))
    setNotice(`${plural(landed.fresh.length)} pasted into ${active.name}`
      + (landed === inPlace ? '' : ', offset to clear the originals')
      + '. Undo restores the previous composition.')
  }
  function screenDelta(key: string): [number, number] {
    let [x, y] = key === 'ArrowLeft' ? [-1, 0] : key === 'ArrowRight' ? [1, 0] : key === 'ArrowUp' ? [0, -1] : [0, 1]
    if (mirror) x = -x
    return d.orientation === 'portrait' ? [y, -x] : [x, y]
  }
  function canvasKey(e: KeyboardEvent<SVGSVGElement>) {
    if (mirror || busy) return // floating controls are handled globally, including after toolbar clicks
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
      e.preventDefault(); setSelectedIds(active.placements.map(p => p.id)); setSku(null)
    } else if (e.key.startsWith('Arrow')) {
      e.preventDefault(); const [dx, dy] = screenDelta(e.key)
      if (selectedPieces.length > 1) { e.stopPropagation(); moveSelection(g => moveGroup(g, dx, dy)) }
      else if (selection) applyPlacement({ ...selection, col: selection.col + dx, row: selection.row + dy })
      else setCursor(([x,y]) => [Math.max(0, Math.min(GRID.cols - 1, x + dx)), Math.max(0, Math.min(GRID.rows - 1, y + dy))])
    } else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      if (sku) placeAt(...cursor)
      else {
        const hit = active.placements.find(p => occupied(p).some(([x,y]) => x === cursor[0] && y === cursor[1]))
        if (e.shiftKey && hit) setSelectedIds(ids => ids.includes(hit.id) ? ids.filter(id => id !== hit.id) : [...ids, hit.id])
        else setSelected(hit?.id ?? null)
      }
    }
  }
  useEffect(() => {
    function key(e: globalThis.KeyboardEvent) {
      if (textDraft) {
        if (e.key === 'Escape') { e.preventDefault(); cancelGroup() }
        else if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); finishText() }
        return
      }
      if ((e.target as HTMLElement).closest('input,textarea,select,[contenteditable="true"]')) return
      if (e.key === 'Escape') {
        e.preventDefault(); if (busy) cancelGroup(); else { setSelected(null); setSku(null); setNotice('') }; return
      }
      if (pendingImport) return
      if (floating) {
        if (e.key.startsWith('Arrow')) { e.preventDefault(); const [dx,dy] = screenDelta(e.key); if (groupDrag.current) groupDrag.current.start = moveGroup(groupDrag.current.start, dx, dy); setFloating(f => f ? { ...f, group: moveGroup(f.group, dx, dy) } : f) }
        else if (e.key.toLowerCase() === 'r' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); rotate() }
        else if (e.key === 'Enter' && !(e.target as HTMLElement).closest('[data-cancel-group]')) { e.preventDefault(); finishGroup() }
        else if ((e.metaKey || e.ctrlKey) && ['z','y','a'].includes(e.key.toLowerCase())) e.preventDefault()
        return
      }
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'z') { e.preventDefault(); if (e.shiftKey) redo(); else undo() }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'y') { e.preventDefault(); redo() }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') { e.preventDefault(); copySelection() }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'x') { e.preventDefault(); cutSelection() }
      else if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'v') { e.preventDefault(); pasteClipboard() }
      else if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'r') { e.preventDefault(); rotate() }
      else if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); remove() }
    }
    window.addEventListener('keydown', key); return () => window.removeEventListener('keydown', key)
  })
  useEffect(() => {
    if (saveBlocked) return
    const timer = setTimeout(() => {
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(project)); setSaveStatus('Saved on this device') }
      catch { setSaveStatus('Could not save on this device. Export a JSON backup.'); setSaveBlocked(true) }
    }, 250)
    return () => clearTimeout(timer)
  }, [project, saveBlocked])
  function cell(e: PointerEvent): [number, number] {
    const rect = svgRef.current!.getBoundingClientRect()
    const [x,y] = fromView(d, (e.clientX - rect.left) / rect.width * w, (e.clientY - rect.top) / rect.height * h, mirror)
    return [Math.floor(x), Math.floor(y)]
  }
  function pointerDown(e: PointerEvent<SVGSVGElement>) {
    if (mirror || pendingImport || e.button !== 0) return
    e.preventDefault(); e.currentTarget.focus({ preventScroll: true })
    const [col,row] = cell(e); setCursor([col,row])
    if (textDraft) {
      const [x,y] = d.orientation === 'portrait' ? [GRID.rows - 1 - row,col] : [col,row]
      setTextDraft(t=>t?{...t,options:{...t.options,col:x,row:y}}:t); return
    }
    if (floating) {
      groupDrag.current = { start: floating.group, col, row, x: e.clientX, y: e.clientY, moved: false }
      e.currentTarget.setPointerCapture(e.pointerId); return
    }
    const id = (e.target as Element).getAttribute('data-placement')
    const p = active.placements.find(p => p.id === id)
    if (p) {
      setSku(null)
      if (e.shiftKey) { setSelectedIds(ids => ids.includes(p.id) ? ids.filter(id => id !== p.id) : [...ids, p.id]); return }
      if (selectedPieces.length > 1 && selectedIds.includes(p.id)) {
        const group = createGroup(selectedPieces)
        beginGroup(group, selectedIds, 'Move selection')
        // Selecting/starting a drag should never commit on pointer-up.
        groupDrag.current = { start: group, col, row, x: e.clientX, y: e.clientY, moved: true }
        e.currentTarget.setPointerCapture(e.pointerId); return
      }
      setSelected(p.id)
      drag.current = { p, dx: col - p.col, dy: row - p.row, x: e.clientX, y: e.clientY, moved: false }
      e.currentTarget.setPointerCapture(e.pointerId)
    } else if (sku) placeAt(col, row); else setSelected(null)
  }
  function pointerMove(e: PointerEvent<SVGSVGElement>) {
    if (mirror || pendingImport || textDraft) return
    const [x,y] = cell(e)
    if (groupDrag.current) {
      const g = groupDrag.current
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 4) g.moved = true
      if (g.moved) setFloating(f => f ? { ...f, group: moveGroup(g.start, x - g.col, y - g.row) } : f)
      return
    }
    if (floating) return
    setHover([x,y])
    if (drag.current) {
      const g = drag.current
      if (Math.hypot(e.clientX - g.x, e.clientY - g.y) > 4) g.moved = true
      if (g.moved) setDragPreview({ ...g.p, col: x - g.dx, row: y - g.dy })
    }
  }
  function pointerUp(e: PointerEvent<SVGSVGElement>) {
    if (groupDrag.current) {
      const g = groupDrag.current
      if (g.moved) {
        const [x,y] = cell(e)
        setFloating(f => f ? { ...f, group: moveGroup(g.start, x - g.col, y - g.row) } : f)
      } else finishGroup()
      groupDrag.current = null
    } else if (drag.current?.moved) {
      const [x,y] = cell(e), g = drag.current
      applyPlacement({ ...g.p, col: x - g.dx, row: y - g.dy })
    }
    drag.current = null; setDragPreview(null)
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
  }
  function pointerCancel() {
    if (groupDrag.current) { const start = groupDrag.current.start; setFloating(f => f ? { ...f, group: start } : f) }
    groupDrag.current = null; drag.current = null; setDragPreview(null)
  }
  async function importFile(file: File | undefined) {
    if (!file || busy) return
    try {
      if (file.size > 2_000_000) throw new Error('This file is too large (maximum 2 MB).')
      const imported = parseProject(await file.text())
      setPendingImport(imported); setNotice(''); setHover(null)
    } catch (e) { setNotice(`Import failed: ${(e as Error).message}`) }
    if (fileRef.current) fileRef.current.value = ''
  }
  function replaceImport() {
    if (!pendingImport) return
    commit(pendingImport); setPendingImport(null); setSelected(null); setSku(null); setHidden([])
    setNotice('Project imported and revalidated. Undo restores the previous composition.')
  }
  function addImport() {
    if (!pendingImport) return
    try { beginGroup(importGroup(pendingImport.design, d), [], pendingImport.design.name || 'Imported group') }
    catch (e) { setNotice((e as Error).message) }
  }
  function sample() { const next = negroniProject(); next.inventory = project.inventory; commit(next); setHidden([]); setSelected(null); setSku(null); setMirror(false) }
  function newProject() { const next = blankProject(); next.inventory = project.inventory; commit(next); setHidden([]); setSelected(null); setSku(null); setMirror(false) }
  function reorder(delta: number) {
    const index = d.layers.findIndex(l => l.id === active.id)
    if (index + delta < 0 || index + delta >= d.layers.length) return
    commit(p => { const layers = p.design.layers; [layers[index], layers[index + delta]] = [layers[index + delta], layers[index]] })
  }
  const ghost: Placement | null = mirror || busy ? null : dragPreview ?? (sku ? { id: '__ghost__', sku, col: (hover ?? cursor)[0], row: (hover ?? cursor)[1], rotation } : null)
  const ghostValid = ghost ? !!attemptPlacement(project, active.id, ghost).project : true
  const filtered = (tab === 'inventory' ? INVENTORY_ITEMS : PIECES.filter(p=>!p.glyph)).filter(p => `${p.code} ${p.description} ${p.family}`.toLowerCase().includes(search.toLowerCase()))

  return <div className="app">
    <header className="app-header" inert={busy}>
      <a className="wordmark" href="#" onClick={e => e.preventDefault()} aria-label="PRIXEL Planner home"><span className="brand-grid" aria-hidden="true">▦</span>PRIXEL<span className="wordmark-sub">PLANNER</span></a>
      <div className="project-heading"><input aria-label="Design name" maxLength={150} value={d.name} onChange={e => setDesign('name', e.target.value)} /><span className={saveBlocked ? 'save-error' : ''}>{saveStatus}</span></div>
      <nav aria-label="Project actions"><button className="theme-toggle" onClick={cycleTheme} aria-label={`Theme: ${THEME_LABEL[theme]}. Switch to ${THEME_LABEL[nextTheme]}.`} title={theme === 'auto' ? 'Following your system setting' : `${THEME_LABEL[theme]} theme`}><span aria-hidden="true">{theme === 'dark' ? '☾' : theme === 'light' ? '☀' : '◐'}</span>{THEME_LABEL[theme]}</button><button onClick={newProject}>New</button><button onClick={() => fileRef.current?.click()}>Import</button><button onClick={() => download(JSON.stringify(project, null, 2), `${fileStem(d.name)}.json`, 'application/json')}>Save JSON</button><button className="primary" onClick={() => download(buildSheetHtml(project), `${fileStem(d.name)}-build-sheets.html`, 'text/html')}>Build sheets ↗</button></nav>
      <input ref={fileRef} className="visually-hidden" type="file" accept=".json,application/json" onChange={e => void importFile(e.target.files?.[0])} aria-label="Import project JSON" />
    </header>
    {saveBlocked && <div className="recovery">{saveStatus} <button onClick={() => { setSaveBlocked(false); setSaveStatus('Saving…') }}>Resume autosave</button></div>}
    <main className="workspace">
      <aside inert={busy} className="palette panel" aria-label="Piece library">
        <div className="panel-heading"><h2>Your kit</h2><span>{Object.values(project.inventory).reduce((a,b) => a + b, 0)} pieces</span></div>
        <div className="segmented"><button className={tab === 'pieces' ? 'active' : ''} onClick={() => setTab('pieces')}>Pieces</button><button className={tab === 'inventory' ? 'active' : ''} onClick={() => setTab('inventory')}>Inventory</button></div>
        <input className="search" type="search" placeholder="Find a shape or SKU…" value={search} onChange={e => setSearch(e.target.value)} aria-label="Search pieces" />
        <div className="palette-scroll">
          {tab === 'pieces' ? <>
            <p className="micro">Select a piece, then click the plate.<br/>Counts show what this pass can still use.</p>
            {FAMILIES.map(family => {
              const pieces = filtered.filter(p => p.family === family)
              if (!pieces.length) return null
              return <section className="family" key={family}><h3><span className="family-dot" style={{ background: pieces.find(p => p.fill)?.fill ?? '#777' }} />{family}</h3>
                <div className="piece-grid">{pieces.map(p => {
                  const n = remaining(project, active.id, p.code)
                  return <button key={p.code} disabled={!p.svg || n <= 0 || mirror} className={`piece ${sku === p.code ? 'chosen' : ''}`} aria-label={`${p.code} ${p.description}, ${n} remaining${p.svg ? '' : ', no artwork'}`} title={`${p.description} · ${p.cells_w} wide × ${p.cells_h} tall${p.svg ? '' : ' · Artwork unavailable'}`} onClick={() => { setSku(p.code); setSelected(null); setRotation(0); setNotice('') }}>
                    <span className="piece-art" style={{ color: p.fill ?? '#666' }}>{p.svg ? <PieceIcon sku={p.code} /> : '—'}</span><span className="piece-label">{p.glyph ?? p.code.replace('PX-', '')}<span>{p.svg ? `${n} left` : 'No SVG'}</span></span>
                  </button>
                })}</div></section>
            })}
            {!filtered.length && <p className="empty">No matching pieces. Try a shape name or SKU.</p>}
          </> : <>
            <p className="micro">Enter the pieces you actually own. Mono uses 56 shared physical pools: 323 counted pieces, versus 324 stated. Rotated variants and lowercase share counts.</p>
            <table className="inventory-table"><thead><tr><th>Piece</th><th>Need</th><th>Owned</th></tr></thead><tbody>{filtered.map(p => <tr key={p.code} className={(required[p.code] ?? 0) > project.inventory[p.code] ? 'shortage' : ''}><td title={p.description}>{inventoryLabel(p.code)}<small>{p.glyph ? 'Shared physical pool' : `${p.cells_w} × ${p.cells_h}${p.svg ? '' : ' · No SVG'}`}</small></td><td>{required[p.code] ?? 0}</td><td><input type="number" min={0} max={10000} step={1} aria-label={`Owned ${p.code}`} value={project.inventory[p.code]} onChange={e => { const value = Number(e.target.value); if (Number.isInteger(value) && value >= 0 && value <= 10000) commit(pj => { pj.inventory[p.code] = value }) }} /></td></tr>)}</tbody></table>
          </>}
        </div>
        <button className="sample-link" onClick={sample}>↗ Load the Negroni study</button>
      </aside>
      <section className="studio" aria-label="Composition workspace">
        <div className="canvas-toolbar"><div className="segmented view-switch"><button disabled={busy} className={!mirror ? 'active' : ''} onClick={() => { setMirror(false); setHover(null) }}>Design</button><button disabled={busy} className={mirror ? 'active' : ''} onClick={() => { setMirror(true); setHover(null); setSelected(null) }}>Build sheet ⇄</button></div><div className="toolbar-actions"><button aria-label="Undo" title="Undo (⌘/Ctrl Z)" disabled={busy || !history.past.length} onClick={undo}>↶</button><button aria-label="Redo" title="Redo (⌘/Ctrl Shift Z)" disabled={busy || !history.future.length} onClick={redo}>↷</button><span className="divider"/><button onClick={beginText} disabled={busy || mirror}>Text</button><button onClick={rotate} disabled={!!textDraft || !!pendingImport || mirror || (!floating && !sku && !selectedPieces.length)}>Rotate <kbd>R</kbd></button><button onClick={remove} disabled={busy || mirror || !selectedPieces.length} aria-label="Delete selected piece">Delete</button></div></div>
        {textDraft && textLayout && <TextComposer options={textDraft.options} layout={textLayout} errors={textErrors} inventory={project.inventory} cols={w} rows={h} valid={textValid} onChange={options=>setTextDraft(t=>t?{...t,options}:t)} onCommit={finishText} onCancel={cancelGroup}/>}
        {pendingImport && <section className="import-choice" aria-label="Import options">
          <div><h2>Import “{pendingImport.design.name || 'Untitled composition'}”</h2><p>{pendingImport.design.layers.reduce((n,l) => n + l.placements.length, 0)} pieces across {pendingImport.design.layers.length} passes.</p></div>
          <p>Adding combines every incoming pass into <strong>{active.name}</strong>, using this pass’s ink and your current inventory. Cross-pass overlaps will be checked as collisions.</p>
          <div className="import-actions"><button className="primary" autoFocus onClick={addImport} disabled={!pendingImport.design.layers.some(l => l.placements.length)}>Add to current pass</button><button onClick={replaceImport}>Replace composition</button><button data-cancel-group onClick={cancelGroup}>Cancel import</button></div>
        </section>}
        {floating && <section className="group-controls" aria-label="Place group">
          <div><strong>{floating.label}</strong><span>{floatingPlacements.length} pieces · {active.name} · not yet committed</span></div>
          <p>Drag to position. Arrow keys nudge. R rotates around the group centre, snapping to whole cells.</p>
          <div className="group-actions"><button className="primary" onClick={finishGroup} disabled={!floatingResult?.project}>Place group <kbd>Enter</kbd></button><button data-cancel-group onClick={cancelGroup}>Cancel <kbd>Esc</kbd></button><span className={floatingResult?.project ? 'group-valid' : 'group-invalid'}>{floatingResult?.project ? 'Ready to place' : 'Cannot place'}</span></div>
        </section>}
        {!busy && !mirror && <div className="selection-tools"><span>Shift-click to select multiple pieces.</span><button onClick={() => { setSelectedIds(active.placements.map(p => p.id)); setSku(null) }} disabled={!active.placements.length}>Select all</button><button onClick={() => moveSelection()} disabled={!selectedPieces.length}>Move selection{selectedPieces.length ? ` (${selectedPieces.length})` : ''}</button></div>}
        <div className="canvas-options"><span>{mirror ? `SETUP · ${active.name}` : 'PRINT PREVIEW'}<span className="subtle"> / {w * 5} × {h * 5} mm</span></span><label><input type="checkbox" checked={showGrid} onChange={e => setShowGrid(e.target.checked)} /> Grid</label>{mirror && <label title="Show each piece in the colour it is moulded in, so you can pick it out of the box by sight.">
          <input type="checkbox" checked={binView} onChange={e => setBinView(e.target.checked)} /> Piece colours</label>}{!mirror && !reference.ref && <button className="add-reference" onClick={() => imageRef.current?.click()} title="Put a picture behind the plate to trace over. It is never printed or exported.">Add reference image</button>}
          <input ref={imageRef} className="visually-hidden" type="file" accept="image/*" aria-label="Choose a reference image" onChange={e => { void reference.add(e.target.files?.[0]); e.target.value = '' }} /></div>
        {!mirror && reference.ref && <ReferenceControls reference={reference.ref} update={reference.update} remove={reference.remove} cols={w} rows={h} />}
        <div className={`stage ${d.orientation}`}>
          <div className="plate-wrap" style={{ '--plate-ratio': `${w} / ${h}` } as CSSProperties}>
            <div className="plate-label">{mirror ? '↑ TOP OF SETUP PLATE · MIRRORED' : '↑ TOP OF PRINT'}</div>
            <div className={`paper ${d.orientation === 'portrait' ? 'perforated' : ''}`} style={{ background: d.paperColor }}>
              <svg ref={svgRef} className="plate" data-testid="plate" viewBox={`0 0 ${w} ${h}`} tabIndex={0} role="application" aria-label={`${mirror ? 'Mirrored build sheet' : 'Design plate'}, ${w} by ${h} cells. ${mirror ? 'Read only.' : 'Arrow keys move selected piece or cursor, Enter places, R rotates, Delete removes.'}`} onKeyDown={canvasKey} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerCancel} onPointerLeave={() => { if (!drag.current) setHover(null) }}>
                {!mirror && reference.ref && <ReferenceLayer reference={reference.ref} cols={w} rows={h} />}
                <g transform={plateTransform(d, mirror)}>
                  {GRID.blocked_cells.map(([x,y]) => <g key={`${x},${y}`} pointerEvents="none"><rect x={x} y={y} width={1} height={1} fill="#cabfa8" fillOpacity={.5}/><path d={`M${x+.3},${y+.3}l.4,.4m0,-.4l-.4,.4`} stroke="#a69b83" strokeWidth={.045}/></g>)}
                  {d.layers.filter(l => mirror ? l.id === active.id : !hidden.includes(l.id)).map(layer => <g key={layer.id} color={layerInkHex(layer)} pointerEvents="none">{layer.placements.filter(p => !floating?.replaceIds.includes(p.id)).map(p => <g key={p.id} data-sku={p.sku} transform={placementTransform(p)} {...(mirror && binView ? pieceColours(p.sku) : null)}><Art sku={p.sku}/></g>)}</g>)}
                  {showGrid && <g stroke="#968a70" strokeOpacity={.23} strokeWidth={.018} pointerEvents="none">{Array.from({ length: GRID.cols + 1 }, (_,x) => <path key={`x${x}`} d={`M${x} 0V${GRID.rows}`}/>)}{Array.from({ length: GRID.rows + 1 }, (_,y) => <path key={`y${y}`} d={`M0 ${y}H${GRID.cols}`}/>)}</g>}
                  {!busy && !mirror && !hidden.includes(active.id) && active.placements.map(p => { const b = bounds(p); return <rect key={p.id} data-placement={p.id} x={p.col} y={p.row} width={b.w} height={b.h} fill="transparent" stroke={selectedIds.includes(p.id) ? '#284b48' : 'none'} strokeWidth={.08} strokeDasharray={selectedIds.includes(p.id) ? '.18 .1' : undefined} className="hit-target"/> })}
                  {!busy && !mirror && !selectedPieces.length && <rect className="keyboard-cursor" x={cursor[0]} y={cursor[1]} width={1} height={1} fill="none" stroke="#284b48" strokeWidth={.06} pointerEvents="none"/>}
                  {(floating || textDraft) && floatingBounds && <g data-testid={textDraft ? 'text-preview' : 'floating-group'} pointerEvents="none">
                    {floatingPlacements.map(p => <g key={p.id}><g transform={placementTransform(p)} color={layerInkHex(active)} opacity={.5}><Art sku={p.sku}/></g><rect x={p.col} y={p.row} width={bounds(p).w} height={bounds(p).h} fill={(textDraft ? textValid : floatingResult?.project) ? '#46766b' : '#b54230'} fillOpacity={.08} stroke={(textDraft ? textValid : floatingResult?.project) ? '#46766b' : '#b54230'} strokeWidth={.035}/></g>)}
                    <rect data-testid="group-bounds" x={floatingBounds.col} y={floatingBounds.row} width={floatingBounds.w} height={floatingBounds.h} fill="none" stroke={(textDraft ? textValid : floatingResult?.project) ? '#284b48' : '#b54230'} strokeWidth={.09} strokeDasharray=".24 .12"/>
                  </g>}
                  {ghost && <g pointerEvents="none"><g transform={placementTransform(ghost)} color={layerInkHex(active)} opacity={.5}><Art sku={ghost.sku}/></g><rect x={ghost.col} y={ghost.row} width={bounds(ghost).w} height={bounds(ghost).h} fill={ghostValid ? '#46766b' : '#b54230'} fillOpacity={.12} stroke={ghostValid ? '#46766b' : '#b54230'} strokeWidth={.06}/></g>}
                </g>
              </svg>
            </div>
            <div className="plate-measure"><span>{w} cells</span><span>5 mm pitch</span><span>{h} cells ↓</span></div>
          </div>
          {!total && !busy && <div className="canvas-empty">A small piece. A new possibility.<span>Choose a shape from your kit to begin.</span></div>}
        </div>
        <div className="canvas-footer"><span>{textDraft ? `${textLayout?.pieces ?? 0} text pieces · click plate to set the start cell` : floating ? `${floatingPlacements.length} floating pieces · drag or nudge, then Enter to commit` : mirror ? 'Read-only setup view. Export always mirrors each pass.' : selection ? `${selection.sku} · column ${selection.col + 1}, row ${selection.row + 1} · ${selection.rotation}°` : sku ? `${sku} · ${rotation}° · click to place` : selectedPieces.length > 1 ? `${selectedPieces.length} selected · drag, arrow keys or R to move as a group` : 'Select a shape to place. Shift-click pieces to select a group.'}</span><span>{total} placements · {d.layers.length} passes</span></div>
        <div className={`feedback ${notice || floatingResult?.errors.length || textErrors.length ? 'has-notice' : ''}`} role="status" aria-live="polite">{(textDraft ? (textErrors.length ? textErrors.join(' ') : 'Text fits. Place text or press Ctrl/Cmd Enter to commit.') : floating ? (floatingResult?.errors.length ? floatingResult.errors.join(' ') : 'Ready to place. Enter or click commits; Esc cancels.') : notice) || (mirror ? 'Labels stay readable. Print the downloaded build sheets at actual size.' : 'Preview assumes covering ink. Actual overprint and screen colours need a test print.')}</div>
      </section>
      <aside inert={busy} className="inspector panel" aria-label="Ink passes and build checks">
        <section className="inspector-section"><div className="panel-heading"><h2>Ink passes</h2><button aria-label="Add ink pass" disabled={d.layers.length >= 50} onClick={() => { const l = newLayer(`Pass ${d.layers.length + 1}`, '#456A64'); commit(p => { p.design.layers.push(l); p.design.activeLayerId = l.id }); setSelected(null) }}>+</button></div><p className="micro">Print from top to bottom. Later inks cover earlier ones in this preview.</p>
          <ol className="layer-list">{d.layers.map((l, i) => <li key={l.id} className={l.id === active.id ? 'active' : ''}><button className="layer-select" onClick={() => chooseLayer(l.id)} aria-pressed={l.id === active.id}><span className="ink-chip" style={{ background: layerInkHex(l) }}/><span><strong>{l.name}</strong><small>{l.placements.length} pieces · pass {i+1}</small></span></button><button className="visibility" aria-label={`${hidden.includes(l.id) ? 'Show' : 'Hide'} ${l.name}`} title="Preview visibility does not release inventory" disabled={mirror} onClick={() => setHidden(hidden.includes(l.id) ? hidden.filter(id => id !== l.id) : [...hidden, l.id])}>{hidden.includes(l.id) ? '○' : '●'}</button></li>)}</ol>
          <div className="layer-edit"><label>Pass name<input value={active.name} maxLength={100} onChange={e => editLayer(l => { l.name = e.target.value })}/></label><InkPicker key={active.id} layer={active} onChange={(hex, inkSku) => editLayer(l => { l.ink = hex; if (inkSku) l.inkSku = inkSku; else delete l.inkSku })}/></div>
          <div className="layer-tools"><button onClick={cutSelection} disabled={!selectedPieces.length || mirror || busy} title="Cut selection (Ctrl/Cmd+X)">Cut</button><button onClick={copySelection} disabled={!selectedPieces.length || busy} title="Copy selection (Ctrl/Cmd+C)">Copy</button><button onClick={pasteClipboard} disabled={!clipboard.length || mirror || busy} title="Paste into this pass (Ctrl/Cmd+V)">{clipboard.length ? `Paste ${clipboard.length} here` : 'Paste here'}</button></div><div className="layer-tools"><button onClick={() => reorder(-1)} disabled={d.layers[0].id === active.id}>↑ Earlier</button><button onClick={() => reorder(1)} disabled={d.layers.at(-1)!.id === active.id}>↓ Later</button><button disabled={d.layers.length === 1} onClick={() => { commit(p => { p.design.layers = p.design.layers.filter(l => l.id !== active.id); p.design.activeLayerId = p.design.layers[0].id }); setSelected(null) }}>Remove</button></div>
        </section>
        <section className="inspector-section"><h2>Plate & paper</h2><label className="field-row">Orientation<select aria-label="Orientation" value={d.orientation} onChange={e => { setDesign('orientation', e.target.value as Design['orientation']); setHover(null) }}><option value="landscape">Landscape</option><option value="portrait">Portrait</option></select></label><label className="color-field">Paper preview<input type="color" aria-label="Paper colour" value={d.paperColor} onChange={e => setDesign('paperColor', e.target.value)}/><span>{d.paperColor.toUpperCase()}</span></label></section>
        <section className="inspector-section"><h2>Assembly</h2><label className="stacked-label" htmlFor="inventory-mode">How will you use your pieces?</label><select id="inventory-mode" value={d.inventoryMode} onChange={e => setDesign('inventoryMode', e.target.value as Design['inventoryMode'])}><option value="concurrent">Keep passes assembled (sum)</option><option value="reuse">Reuse between passes (max)</option></select><p className="micro">{d.inventoryMode === 'concurrent' ? 'Every pass reserves its pieces at the same time.' : 'Dismantle and clean pieces before the next pass. Counts use the largest demand per SKU.'}</p>{d.layers.length > 2 && <p className="assembly-note">{d.inventoryMode === 'concurrent' ? `${d.layers.length} passes need ${d.layers.length} assembled plates. Your kit has two. Switch to reuse, or provide extra plates.` : `${d.layers.length} passes can be prepared sequentially using your two plates.`}</p>}</section>
        <section className="inspector-section build-check"><div className="panel-heading"><h2>Build checks</h2><span className={issues.length ? 'status-badge warning' : 'status-badge'}>{issues.length ? `${issues.length} to resolve` : 'Checks pass*'}</span></div>
          {!!issues.length && <ul className="issue-list">{issues.map((issue, i) => <li key={i}>{issue.message}</li>)}</ul>}
          <p className="micro">* Provisional L-shaped corners and rectangular footprints. Measure the plate and pieces before relying on fit. Vendor artwork face/impression orientation is unverified.</p>
          {d.plateProfile.version !== GRID.version && <p className="assembly-note">Saved plate profile v{d.plateProfile.version}; revalidated against current v{GRID.version}.</p>}
          {d.layers.some(l => l.placements.some(p => BY_SKU[p.sku]?.glyph)) && <p className="micro">Mono inventory counts physical pools shared by rotated glyphs and lowercase. 323 case pieces are recorded; the stated 324th is unresolved.</p>}
          <details><summary>Pick-list · {active.name}</summary><ul className="pick-list">{Object.entries(activeCounts).map(([code, n]) => <li key={code}><span>{inventoryLabel(code)}</span><strong>× {n}</strong></li>)}{!active.placements.length && <li>This pass is empty.</li>}</ul></details>
          <button className="export-svg" onClick={() => download(plateSvg(project, active), `${fileStem(d.name)}-${fileStem(active.name)}-mirrored.svg`, 'image/svg+xml')}>Export this pass as SVG ↓</button><p className="micro">Exact {w * 5} × {h * 5} mm. “Build sheets” includes every pass, external pick-lists and a 50 mm ruler. Open the HTML to print or save as PDF.</p>
        </section>
      </aside>
    </main>
    <footer className="app-footer"><span>PRIXEL · A little shape goes a long way.</span><span>{policyLabel(project)}</span><span>Local only · no account needed</span></footer>
  </div>
}
