import type { TextLayout, TextOptions } from './text'
import type { Inventory } from './types'
import { inventoryLabel } from './model'
export default function TextComposer({options,layout,inventory,onChange,onCommit,onCancel,valid,cols,rows,errors}: {
  options:TextOptions; layout:TextLayout; inventory:Inventory; onChange:(next:TextOptions)=>void
  onCommit:()=>void; onCancel:()=>void; valid:boolean; cols:number; rows:number; errors:string[]
}) {
  return <section className="text-composer" aria-label="Text tool">
    <div className="text-heading"><h2>PRIXEL Mono text</h2><span>One physical piece per glyph · unicase</span></div>
    <label className="visually-hidden" htmlFor="mono-text">Text to place</label>
    <textarea id="mono-text" autoFocus value={options.text} maxLength={4000} rows={4} spellCheck={false} placeholder={'Type a line or paste a menu…\nBlank lines leave empty rows.'} onChange={e=>onChange({...options,text:e.target.value})}/>
    <div className="text-settings"><label>Start column<input type="number" min={1} max={cols} value={options.col+1} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=cols)onChange({...options,col:n-1})}}/></label><label>Start row<input type="number" min={1} max={rows} value={options.row+1} onChange={e=>{const n=Number(e.target.value);if(Number.isInteger(n)&&n>=1&&n<=rows)onChange({...options,row:n-1})}}/></label><label>Alignment<select aria-label="Alignment" value={options.alignment} onChange={e=>onChange({...options,alignment:e.target.value as TextOptions['alignment']})}><option value="left">Left</option><option value="centre">Centre</option><option value="right">Right</option></select></label></div>
    <p className="micro">Click the plate to choose the starting cell. Start row is the top of the block; an accented line reserves a row above its letters. Spaces advance one cell; lines do not wrap.</p>
    <div className="text-census-summary"><strong>{layout.pieces} pieces</strong><span>{layout.width} / 24 columns · {layout.depth} / 16 rows (accents included)</span></div>
    {!!errors.length && <div className="text-errors"><strong>Cannot place yet</strong><ul>{errors.slice(0,5).map((error,i)=><li key={i}>{error}</li>)}</ul>{errors.length>5 && <p>{errors.length-5} more issues. Shorten or reposition the text to review the rest.</p>}</div>}
    {layout.warnings.map(w=><p key={w} className="ink-caution">{w}</p>)}
    {!!layout.pieces && <details className="text-census"><summary>Physical-piece census</summary><ul>{Object.entries(layout.census).map(([key,n])=><li key={key}><span>{inventoryLabel(key)}</span><strong>{n} of {inventory[key]??0}</strong></li>)}</ul></details>}
    <div className="text-actions"><button className="primary" onClick={onCommit} disabled={!valid}>Place text <kbd>⌘/Ctrl Enter</kbd></button><button data-cancel-group onClick={onCancel}>Cancel text <kbd>Esc</kbd></button><span>{valid?'Ready to place':'Cannot place yet'}</span></div>
    <p className="micro">Case inventory: 323 counted vs 324 stated, still unconfirmed. Counts are editable by physical pool under Inventory.</p>
  </section>
}
