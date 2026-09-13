/**
 * Loads PRIXEL's own shape artwork from assets/shapes/.
 *
 * The vendor SVGs carry their fills in a <style> block keyed by .cls-N classes,
 * with invisible fill:none bounding rects mixed in. Strip those and inline the
 * real fills so each shape can be dropped into the plate as a plain <g>.
 */
const raw = import.meta.glob('../assets/shapes/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

export interface ShapeArt {
  /** Inner SVG markup with fills inlined, in vendor units (14.1732 per cell). */
  inner: string
}

function clean(src: string): ShapeArt {
  const fills = new Map<string, string>()
  for (const m of src.matchAll(/\.(cls-\d+)\s*\{([^}]*)\}/g)) {
    const fill = /fill:\s*([^;\s]+)/.exec(m[2])
    if (fill) fills.set(m[1], fill[1])
  }

  let inner = src
    .replace(/^[\s\S]*?<svg[^>]*>/, '')
    .replace(/<\/svg>\s*$/, '')
    .replace(/<defs>[\s\S]*?<\/defs>/g, '')
    // normalise <rect ...></rect> to self-closing so dropping one leaves no orphan
    .replace(/<(rect|path|circle|ellipse|line|polyline|polygon)([^>]*?)>\s*<\/\1>/g, '<$1$2/>')

  inner = inner.replace(
    /<(?:path|rect|circle|ellipse|line|polyline|polygon)[^>]*class="(cls-\d+)"[^>]*\/?>/g,
    (tag, cls: string) => {
      const fill = fills.get(cls)
      if (!fill || fill === 'none') return ''
      return tag.replace(`class="${cls}"`, `fill="${fill}"`)
    },
  )

  return { inner: inner.replace(/\s+/g, ' ').trim() }
}

/** SKU code -> artwork. Keyed off the filename prefix, e.g. PX-017-3x3-arc.svg. */
export const SHAPES: Record<string, ShapeArt> = Object.fromEntries(
  Object.entries(raw)
    .map(([path, src]) => {
      const code = /\/(PX-\d{3})-/.exec(path)?.[1]
      return code ? ([code, clean(src)] as const) : null
    })
    .filter((x): x is readonly [string, ShapeArt] => x !== null),
)
