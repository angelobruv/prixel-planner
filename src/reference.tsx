import { useEffect, useRef, useState } from 'react'

/** A picture traced over, never printed. It lives beside the project rather than
 *  in it: it is not part of the design, it would bloat every saved JSON by
 *  megabytes, and it has no place on a build sheet. */
export interface Reference {
  src: string
  /** width / height of the image, so it can be sized in cells without distortion */
  aspect: number
  opacity: number
  /** 1 = the image spans the plate's width */
  scale: number
  /** offsets in cells, from centred */
  x: number
  y: number
  visible: boolean
}

const KEY = 'prixel-planner-v1-reference'
const LONG_EDGE = 1600
/** localStorage is ~5MB per origin and the project shares it. */
const STORE_LIMIT = 2_500_000

function load(): Reference | null {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? JSON.parse(raw) as Reference : null
  } catch { return null }
}

/** Downscale before storing: a phone photo is 4000px and 5MB, which would not
 *  fit in storage and is far more detail than a 24-cell plate can use. */
async function shrink(file: File): Promise<{ src: string; aspect: number }> {
  const bitmap = await createImageBitmap(file)
  const k = Math.min(1, LONG_EDGE / Math.max(bitmap.width, bitmap.height))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(bitmap.width * k)
  canvas.height = Math.round(bitmap.height * k)
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
  const aspect = bitmap.width / bitmap.height
  bitmap.close()
  // WebP keeps transparency at a fraction of PNG's size; browsers that cannot
  // encode it hand back PNG, which then falls through to JPEG if too large.
  let src = canvas.toDataURL('image/webp', 0.85)
  if (src.length > STORE_LIMIT) src = canvas.toDataURL('image/jpeg', 0.8)
  return { src, aspect }
}

export function useReference(notify: (message: string) => void) {
  const [ref, setRef] = useState<Reference | null>(load)
  const warned = useRef(false)

  useEffect(() => {
    try {
      if (ref) localStorage.setItem(KEY, JSON.stringify(ref))
      else localStorage.removeItem(KEY)
      warned.current = false
    } catch {
      if (warned.current) return
      warned.current = true
      notify('The reference image is too large to keep between visits. It stays until you reload.')
    }
  }, [ref, notify])

  async function add(file: File | undefined) {
    if (!file) return
    if (!file.type.startsWith('image/')) { notify(`${file.name} is not an image. Choose a PNG, JPEG or WebP.`); return }
    try {
      const { src, aspect } = await shrink(file)
      setRef({ src, aspect, opacity: 0.5, scale: 1, x: 0, y: 0, visible: true })
      notify('Reference image added behind the plate. It is not printed or exported.')
    } catch {
      notify(`${file.name} could not be read as an image.`)
    }
  }
  const update = (patch: Partial<Reference>) => setRef(r => r ? { ...r, ...patch } : r)
  return { ref, add, update, remove: () => setRef(null) }
}

/** Drawn in view space — the plate as the user sees it — so it lines up with
 *  the preview whichever way the design is oriented. */
export function ReferenceLayer({ reference: r, cols, rows }: { reference: Reference; cols: number; rows: number }) {
  if (!r.visible) return null
  const width = cols * r.scale
  const height = width / r.aspect
  // The plate SVG lets pieces' strokes overflow, so an enlarged image would
  // spill onto the studio; this nested viewport crops it to the paper.
  return <svg x={0} y={0} width={cols} height={rows} overflow="hidden" pointerEvents="none">
    <image href={r.src} x={(cols - width) / 2 + r.x} y={(rows - height) / 2 + r.y}
      width={width} height={height} opacity={r.opacity} preserveAspectRatio="none"
      data-testid="reference-image" />
  </svg>
}

/** Offsets are in plate cells (5mm each) — say so, or "+2" means nothing. */
const cells = (v: number) => `${v > 0 ? '+' : ''}${v} ${Math.abs(v) === 1 ? 'cell' : 'cells'}`

export function ReferenceControls({ reference: r, update, remove, cols, rows }: {
  reference: Reference; update: (p: Partial<Reference>) => void; remove: () => void; cols: number; rows: number
}) {
  const slider = (id: string, label: string, value: number, min: number, max: number, step: number,
    set: (v: number) => void, shown: string) =>
    <label className="ref-control" htmlFor={id}>
      <span>{label}</span>
      <input id={id} type="range" min={min} max={max} step={step} value={value}
        disabled={!r.visible} onChange={e => set(Number(e.target.value))} />
      <output htmlFor={id}>{shown}</output>
    </label>
  return <div className="reference-tools" aria-label="Reference image">
    <label className="ref-toggle"><input type="checkbox" checked={r.visible}
      onChange={e => update({ visible: e.target.checked })} /> Reference</label>
    {slider('ref-opacity', 'Opacity', r.opacity, 0.1, 1, 0.05, v => update({ opacity: v }), `${Math.round(r.opacity * 100)}%`)}
    {slider('ref-scale', 'Size', r.scale, 0.25, 3, 0.05, v => update({ scale: v }), `${Math.round(r.scale * 100)}%`)}
    {slider('ref-x', 'Across', r.x, -cols, cols, 0.25, v => update({ x: v }), cells(r.x))}
    {slider('ref-y', 'Down', r.y, -rows, rows, 0.25, v => update({ y: v }), cells(r.y))}
    <button onClick={() => update({ scale: 1, x: 0, y: 0 })} disabled={!r.visible}>Recentre</button>
    <button onClick={remove}>Remove image</button>
  </div>
}
