#!/usr/bin/env python3
"""Build docs/prixel-datasheet.html from assets/.

Sources of truth: assets/catalogue.json, assets/shapes/*.svg. The PRIXEL Mono font is not
stored in this repo; pass --embed-font FILE to inline a copy you downloaded yourself.
Never hand-edit docs/prixel-datasheet.html — edit the data or this script and re-run.

    python3 scripts/build-datasheet.py                 # embed the font (default)
    python3 scripts/build-datasheet.py --no-embed-font # omit it (see NOTICE.md)

Requires fontTools only if you change the charset extraction; the charset is
read from the font at build time.
"""
import base64, glob, html, json, os, re, sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
EMBED_FONT = "--embed-font" in sys.argv  # never commit an embedded build: see NOTICE.md


CAT = json.load(open(os.path.join(ROOT, "assets", "catalogue.json")))
P = {p["code"]: p for p in CAT["pieces"]}

def clean(path):
    s=open(path,encoding='utf-8').read()
    # map class -> fill
    fills={}
    for m in re.finditer(r'\.(cls-\d+)\s*\{([^}]*)\}',s):
        names=[m.group(1)]; body=m.group(2)
        f=re.search(r'fill:\s*([^;\s]+)',body)
        if f: fills[m.group(1)]=f.group(1)
    # multi-selector rules like ".cls-1, .cls-2 { stroke-width:0 }" ignored (no fill)
    for m in re.finditer(r'\.(cls-\d+)(?:\s*,\s*\.(cls-\d+))*\s*\{([^}]*)\}',s):
        pass
    vb=re.search(r'viewBox="([^"]+)"',s).group(1)
    inner=re.sub(r'^.*?<svg[^>]*>','',s,flags=re.S)
    inner=re.sub(r'</svg>\s*$','',inner,flags=re.S)
    inner=re.sub(r'<defs>.*?</defs>','',inner,flags=re.S)
    inner=re.sub(r'<(rect|path|circle|ellipse|line|polyline|polygon)([^>]*?)>\s*</\1>', r'<\1\2/>', inner)
    # drop elements whose class resolves to none
    def repl(m):
        tag=m.group(0); cls=m.group(1)
        fill=fills.get(cls)
        if fill in (None,'none'): return '<!--x-->'
        return tag.replace(f'class="{cls}"', f'fill="{fill}"')
    inner=re.sub(r'<(?:path|rect|circle|ellipse|line|polyline|polygon)[^>]*class="(cls-\d+)"[^>]*/?>',repl,inner)
    inner=re.sub(r'<!--x-->','',inner)
    inner=re.sub(r'\s+',' ',inner).strip()
    return vb,inner

SH = {}
for _p in CAT["pieces"]:
    if not _p["svg"]:
        continue
    _vb, _inner = clean(os.path.join(ROOT, "assets", "shapes", _p["svg"]))
    SH[_p["code"]] = {"vb": _vb, "inner": _inner}

_font_path = sys.argv[sys.argv.index("--embed-font") + 1] if EMBED_FONT else ""
FONT_B64 = base64.b64encode(open(_font_path, "rb").read()).decode() if EMBED_FONT else ""

# The character list comes from the glyph metadata, not the font, so the
# datasheet builds without a copy of PRIXEL Mono in the repo.
_META = json.load(open(os.path.join(ROOT, "assets", "mono-glyphs.meta.json")))
CPS = sorted(int(k[2:], 16) for k in _META["glyphs"])
CPS = [c for c in CPS if c not in (0x20, 0xA0)]

FAMILIES = [
    ("Square",            "#fcee21", ["PX-001", "PX-002", "PX-003", "PX-004"]),
    ("Triangle",          "#ff1d25", ["PX-005", "PX-006", "PX-007"]),
    ("Circle & arc",      "#3fa9f5", ["PX-008", "PX-009", "PX-010", "PX-011", "PX-012", "PX-016", "PX-017", "PX-033", "PX-034"]),
    ("Inverted circle",   "#99d9e8", ["PX-013", "PX-014", "PX-015"]),
    ("Straight line",     "#7ac943", ["PX-018", "PX-019", "PX-020", "PX-029"]),
    ("Circle & arc line", "#a0c75e", ["PX-024", "PX-025", "PX-026", "PX-027", "PX-028"]),
    ("Diagonal line",     "#459261", ["PX-021", "PX-022", "PX-023"]),
]
NOT_IN_KIT = [("PX-030", 1, 1, "half round square"),
              ("PX-031", 1, 1, "isosceles triangle"),
              ("PX-032", 2, 2, "isosceles triangle")]


def tile(code, px=None):
    """Render one piece at true relative scale inside a 4x4-cell stage."""
    p = P[code]
    s = SH[code]
    h, w = p["cells_h"], p["cells_w"]
    stage = 4.0  # cells
    ox, oy = (stage - w) / 2, (stage - h) / 2
    u = 14.1732
    return (
        f'<svg class="pc" viewBox="0 0 {stage*u:.4f} {stage*u:.4f}" role="img" '
        f'aria-label="{code} {h} by {w} cells, {p["description"]}">'
        f'<g transform="translate({ox*u:.4f} {oy*u:.4f})">{s["inner"]}</g></svg>'
    )


def piece_card(code):
    p = P[code]
    h, w = p["cells_h"], p["cells_w"]
    qty = p["qty_in_kit"]
    return f"""<figure class="piece">
  <div class="stage">{tile(code)}</div>
  <figcaption>
    <span class="sku">{code}</span>
    <span class="dim">{h}×{w}<i> · {h*5}×{w*5}mm</i></span>
    <span class="desc">{html.escape(p["description"])}</span>
    <span class="qty"><b>{qty}</b> in kit</span>
  </figcaption>
</figure>"""


# ---------------------------------------------------------------- plate SVG
def plate():
    C, R, PITCH = 24, 16, 5.0
    Wmm, Hmm = C * PITCH, R * PITCH
    cut = set()
    for cx, cy in ((0, 0), (C - 1, 0), (0, R - 1), (C - 1, R - 1)):
        dx = 1 if cx == 0 else -1
        dy = 1 if cy == 0 else -1
        cut |= {(cx, cy), (cx + dx, cy), (cx, cy + dy)}

    holes = []
    for r in range(R):
        for c in range(C):
            if (c, r) in cut:
                continue
            holes.append(f'<rect x="{c*PITCH+0.85:.2f}" y="{r*PITCH+0.85:.2f}" '
                         f'width="3.3" height="3.3" rx=".75"/>')
    mags = "".join(f'<circle cx="{x}" cy="{y}" r="3.7"/>'
                   for x, y in ((5, 5), (Wmm - 5, 5), (5, Hmm - 5), (Wmm - 5, Hmm - 5)))

    # composition: cell coords (col, row)
    place = [("PX-017", 3, 2), ("PX-016", 7, 4), ("PX-009", 18, 2), ("PX-010", 16, 4),
             ("PX-005", 11, 6), ("PX-012", 20, 5),
             ("PX-004", 3, 9), ("PX-004", 7, 9), ("PX-004", 11, 9), ("PX-004", 15, 9),
             ("PX-020", 3, 11), ("PX-020", 15, 11)]
    k = PITCH / 14.1732  # scale vendor pt-units -> mm
    comp = []
    for code, c, r in place:
        comp.append(f'<g transform="translate({c*PITCH} {r*PITCH}) scale({k:.6f})">'
                    f'{SH[code]["inner"]}</g>')
    comp.append(f'<text class="mono-set" x="{9*PITCH}" y="{13*PITCH+4}" '
                f'font-size="5" letter-spacing="0">PRIXEL</text>')

    return f"""<svg id="plate" viewBox="-13 -11 {Wmm+26} {Hmm+24}" aria-label="PRIXEL setup plate, 24 by 16 cells at 5 millimetre pitch, with a sample composition">
  <rect class="plate-body" x="-2.4" y="-2.4" width="{Wmm+4.8}" height="{Hmm+4.8}" rx="4"/>
  <g class="holes">{''.join(holes)}</g>
  <g class="mags">{mags}</g>
  <g id="comp">{''.join(comp)}</g>
  <g class="dims">
    <line x1="0" y1="-6.5" x2="{Wmm}" y2="-6.5"/>
    <line x1="0" y1="-8.6" x2="0" y2="-4.4"/><line x1="{Wmm}" y1="-8.6" x2="{Wmm}" y2="-4.4"/>
    <text x="{Wmm/2}" y="-8.2" text-anchor="middle">120 mm · 24 cells</text>
    <line x1="-6.5" y1="0" x2="-6.5" y2="{Hmm}"/>
    <line x1="-8.6" y1="0" x2="-4.4" y2="0"/><line x1="-8.6" y1="{Hmm}" x2="-4.4" y2="{Hmm}"/>
    <text x="-8.4" y="{Hmm/2}" text-anchor="middle" transform="rotate(-90 -8.4 {Hmm/2})">80 mm · 16 rows</text>
    <line x1="{Wmm-10}" y1="{Hmm+6}" x2="{Wmm-5}" y2="{Hmm+6}"/>
    <line x1="{Wmm-10}" y1="{Hmm+4.4}" x2="{Wmm-10}" y2="{Hmm+7.6}"/>
    <line x1="{Wmm-5}" y1="{Hmm+4.4}" x2="{Wmm-5}" y2="{Hmm+7.6}"/>
    <text x="{Wmm-7.5}" y="{Hmm+11.5}" text-anchor="middle">5 mm pitch</text>
  </g>
</svg>"""


# ---------------------------------------------------------------- charset
def charset():
    out = []
    for cp in CPS:
        ch = chr(cp)
        esc = html.escape(ch)
        if cp in (0x300, 0x302):          # combining marks need a carrier
            esc = "&#x25CC;" + esc
        out.append(f'<span class="gl" title="U+{cp:04X}">{esc}</span>')
    return "".join(out)


total_kit = sum(p["qty_in_kit"] for p in CAT["pieces"])
fam_rows = ""
for name, hexv, codes in FAMILIES:
    n = sum(P[c]["qty_in_kit"] for c in codes)
    fam_rows += (f'<tr><td><span class="sw" style="background:{hexv}"></span>{name}</td>'
                 f'<td class="n">{len(codes)}</td><td class="n">{n}</td>'
                 f'<td class="hx">{hexv}</td></tr>')

fam_blocks = ""
for name, hexv, codes in FAMILIES:
    n = sum(P[c]["qty_in_kit"] for c in codes)
    fam_blocks += f"""<section class="fam">
  <header class="fam-h">
    <span class="sw lg" style="background:{hexv}"></span>
    <h3>{name}</h3>
    <span class="fam-m">{len(codes)} SKU{'s' if len(codes)>1 else ''} · {n} pieces · <code>{hexv}</code></span>
  </header>
  <div class="pieces">{''.join(piece_card(c) for c in codes)}</div>
</section>"""

missing = "".join(
    f'<li><code>{c}</code> <span>{h}×{w} {d}</span></li>' for c, h, w, d in NOT_IN_KIT)

FIGURES = [("24 × 16", "cells on a plate"), ("5 mm", "grid pitch"),
           ("120 × 80", "millimetres printable"), ("372", "usable holes of 384"),
           ("316", "pieces in the kit"), ("34", "distinct SKUs")]
fig_html = "".join(f'<div class="fig"><b>{a}</b><span>{b}</span></div>' for a, b in FIGURES)

band = "".join(f'<i style="background:{h}"></i>' for _, h, _ in FAMILIES)

HTML = f"""<!-- GENERATED FILE — do not hand-edit.
     Built by scripts/build-datasheet.py from assets/catalogue.json + assets/shapes/.
     Regenerate:  python3 scripts/build-datasheet.py  -->
<title>PRIXEL Plate &amp; Pieces</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Archivo:wght@500;600;800&family=Newsreader:opsz,wght@6..72,300;6..72,400;6..72,500&family=IBM+Plex+Mono:wght@400;500;600&display=swap">
<style>
@font-face {{
  font-family: "PRIXEL Mono";
  src: url(data:font/otf;base64,{FONT_B64}) format("opentype");
  font-display: swap;
}}

:root {{
  --paper:#f3f1ea; --panel:#eae5d9; --sunk:#e2ddcf;
  --ink:#191712; --ink-2:#5d5749; --ink-3:#8b8474;
  --rule:#d5cdb9; --rule-soft:#e3dccb;
  --accent:#bf2f37;
  --plate:#ffffff; --plate-edge:#cfc8b6; --hole:#dcd6c6; --mag:#b9ae91;
  --s1:.45rem; --s2:.9rem; --s3:1.5rem; --s4:2.4rem; --s5:4rem;
  --mono:"IBM Plex Mono",ui-monospace,SFMono-Regular,Menlo,monospace;
  --disp:"Archivo","Helvetica Neue",Arial,sans-serif;
  --body:"Newsreader",Georgia,"Times New Roman",serif;
}}
@media (prefers-color-scheme: dark) {{
  :root:not([data-theme="light"]) {{
    --paper:#121110; --panel:#1c1a16; --sunk:#16150f;
    --ink:#f0ebdd; --ink-2:#a49d8b; --ink-3:#7a7364;
    --rule:#332f27; --rule-soft:#272420;
    --accent:#ff6d63;
    --plate:#24221c; --plate-edge:#3b372e; --hole:#151410; --mag:#5c5342;
  }}
}}
:root[data-theme="dark"] {{
  --paper:#121110; --panel:#1c1a16; --sunk:#16150f;
  --ink:#f0ebdd; --ink-2:#a49d8b; --ink-3:#7a7364;
  --rule:#332f27; --rule-soft:#272420;
  --accent:#ff6d63;
  --plate:#24221c; --plate-edge:#3b372e; --hole:#151410; --mag:#5c5342;
}}

* {{ box-sizing:border-box; }}
body {{
  margin:0; background:var(--paper); color:var(--ink);
  font-family:var(--body); font-size:17px; line-height:1.62;
  -webkit-font-smoothing:antialiased;
}}
.wrap {{ max-width:1120px; margin:0 auto; padding-inline:24px; padding-block:0 var(--s5); }}
h1,h2,h3 {{ font-family:var(--disp); margin:0; text-wrap:balance; }}
p {{ margin:0; max-width:64ch; }}
code {{ font-family:var(--mono); font-size:.86em; }}
a {{ color:var(--accent); text-underline-offset:3px; text-decoration-thickness:1px; }}
:focus-visible {{ outline:2px solid var(--accent); outline-offset:3px; }}

/* ---------- masthead ---------- */
.top {{ padding-block:var(--s4) var(--s3); }}
.band {{ display:flex; height:7px; border-radius:2px; overflow:hidden; margin-bottom:var(--s3); }}
.band i {{ flex:1; }}
.eyebrow {{
  font-family:var(--mono); font-size:11.5px; font-weight:500; letter-spacing:.16em;
  text-transform:uppercase; color:var(--ink-3);
}}
h1 {{ font-size:clamp(2.6rem,8vw,4.4rem); font-weight:800; letter-spacing:-.035em; line-height:.92; margin-block:var(--s2) var(--s2); }}
h1 em {{ font-style:normal; color:var(--accent); }}
.lede {{ font-size:1.16rem; color:var(--ink-2); }}
.figs {{
  display:grid; grid-template-columns:repeat(auto-fit,minmax(150px,1fr));
  gap:1px; background:var(--rule); border-block:1px solid var(--rule);
  margin-top:var(--s4);
}}
.fig {{ background:var(--paper); padding:var(--s2) var(--s2) calc(var(--s2) + 2px); }}
.fig b {{
  display:block; font-family:var(--disp); font-weight:600; font-size:1.5rem;
  letter-spacing:-.02em; font-variant-numeric:tabular-nums;
}}
.fig span {{ display:block; font-family:var(--mono); font-size:11px; letter-spacing:.05em; color:var(--ink-3); margin-top:2px; }}

/* ---------- sections ---------- */
section.blk {{ padding-block:var(--s5) 0; }}
.sec-h {{ display:flex; align-items:baseline; gap:var(--s2); border-bottom:2px solid var(--ink); padding-bottom:var(--s1); margin-bottom:var(--s3); flex-wrap:wrap; }}
.sec-h h2 {{ font-size:1.6rem; font-weight:600; letter-spacing:-.02em; }}
.sec-h .eyebrow {{ margin-left:auto; }}
.intro {{ margin-bottom:var(--s3); }}

/* ---------- plate ---------- */
.plate-wrap {{ background:var(--panel); border:1px solid var(--rule); border-radius:3px; padding:var(--s3); }}
#plate {{ display:block; width:100%; height:auto; }}
.plate-body {{ fill:var(--plate); stroke:var(--plate-edge); stroke-width:.5; }}
.holes rect {{ fill:var(--hole); }}
.mags circle {{ fill:var(--mag); }}
.dims line {{ stroke:var(--ink-3); stroke-width:.35; }}
.dims text {{ fill:var(--ink-2); font-family:var(--mono); font-size:3.1px; letter-spacing:.04em; }}
.mono-set {{ font-family:"PRIXEL Mono",var(--mono); fill:#191712; }}
:root[data-theme="dark"] .mono-set {{ fill:#f0ebdd; }}
@media (prefers-color-scheme: dark) {{ :root:not([data-theme="light"]) .mono-set {{ fill:#f0ebdd; }} }}
#comp {{ transition:transform .55s cubic-bezier(.66,0,.24,1); }}
@media (prefers-reduced-motion: reduce) {{ #comp {{ transition:none; }} }}

.flip {{ display:flex; align-items:center; gap:var(--s2); margin-top:var(--s2); flex-wrap:wrap; }}
.flip button {{
  font-family:var(--mono); font-size:12px; font-weight:500; letter-spacing:.09em;
  text-transform:uppercase; cursor:pointer;
  background:var(--ink); color:var(--paper); border:0; border-radius:2px;
  padding:.62em 1.1em;
}}
.flip button:hover {{ background:var(--accent); }}
.flip .state {{ font-family:var(--mono); font-size:12.5px; color:var(--ink-2); }}
.flip .state b {{ color:var(--accent); font-weight:500; }}

/* ---------- rules of the system ---------- */
.rules {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:var(--s3) var(--s4); margin-top:var(--s4); }}
.rule-i {{ border-top:1px solid var(--rule); padding-top:var(--s2); }}
.rule-i h3 {{ font-size:1.02rem; font-weight:600; letter-spacing:-.01em; margin-bottom:.3em; }}
.rule-i p {{ font-size:.97rem; color:var(--ink-2); }}
.rule-i .eyebrow {{ color:var(--accent); display:block; margin-bottom:.35em; }}

/* ---------- catalogue ---------- */
.fam {{ margin-bottom:var(--s4); }}
.fam-h {{ display:flex; align-items:center; gap:var(--s2); border-bottom:1px solid var(--rule); padding-bottom:var(--s1); margin-bottom:var(--s2); flex-wrap:wrap; }}
.fam-h h3 {{ font-size:1.08rem; font-weight:600; }}
.fam-m {{ font-family:var(--mono); font-size:11.5px; color:var(--ink-3); margin-left:auto; }}
.sw {{ width:11px; height:11px; border-radius:2px; display:inline-block; box-shadow:inset 0 0 0 1px rgba(0,0,0,.22); flex:none; }}
.sw.lg {{ width:15px; height:15px; }}
.pieces {{ display:grid; grid-template-columns:repeat(auto-fill,minmax(112px,1fr)); gap:var(--s2); }}
.piece {{ margin:0; }}
.stage {{ background:var(--sunk); border-radius:2px; padding:9px; }}
.pc {{ display:block; width:100%; height:auto; }}
figcaption {{ display:flex; flex-direction:column; gap:1px; margin-top:7px; }}
.sku {{ font-family:var(--mono); font-size:11px; font-weight:600; letter-spacing:.03em; }}
.dim {{ font-family:var(--mono); font-size:11px; color:var(--ink-2); font-variant-numeric:tabular-nums; }}
.dim i {{ font-style:normal; color:var(--ink-3); }}
.desc {{ font-size:.83rem; line-height:1.3; color:var(--ink-2); }}
.qty {{ font-family:var(--mono); font-size:10.5px; letter-spacing:.04em; color:var(--ink-3); text-transform:uppercase; }}
.qty b {{ color:var(--accent); font-weight:600; }}

.tbl {{ overflow-x:auto; }}
table {{ border-collapse:collapse; width:100%; min-width:420px; }}
th, td {{ text-align:left; padding:.5em .7em; border-bottom:1px solid var(--rule-soft); }}
th {{ font-family:var(--mono); font-size:10.5px; letter-spacing:.11em; text-transform:uppercase; color:var(--ink-3); border-bottom:1px solid var(--rule); }}
td {{ font-size:.95rem; }}
td:first-child {{ display:flex; align-items:center; gap:8px; }}
td.n {{ font-family:var(--mono); font-variant-numeric:tabular-nums; font-size:.9rem; }}
td.hx {{ font-family:var(--mono); font-size:.82rem; color:var(--ink-3); }}
tfoot td {{ font-family:var(--mono); font-size:.86rem; font-weight:600; border-bottom:0; border-top:2px solid var(--ink); }}

.missing {{ list-style:none; margin:var(--s3) 0 0; padding:var(--s2) 0 0; border-top:1px solid var(--rule); display:flex; flex-wrap:wrap; gap:var(--s1) var(--s3); }}
.missing li {{ font-size:.9rem; color:var(--ink-2); }}
.missing code {{ color:var(--ink); font-weight:600; }}

/* ---------- mono specimen ---------- */
.spec {{ background:var(--panel); border:1px solid var(--rule); border-radius:3px; padding:var(--s3); }}
.glyphs {{ display:flex; flex-wrap:wrap; gap:3px; }}
.gl {{
  font-family:"PRIXEL Mono",var(--mono); font-size:26px; line-height:1;
  width:34px; height:34px; display:grid; place-items:center;
  background:var(--paper); border-radius:2px; color:var(--ink);
}}
.big {{ font-family:"PRIXEL Mono",var(--mono); font-size:clamp(2.2rem,9vw,4.2rem); line-height:1.05; letter-spacing:0; margin-bottom:var(--s3); word-break:break-word; }}
.meta-grid {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(190px,1fr)); gap:var(--s2) var(--s3); margin-top:var(--s3); }}
.meta-grid div {{ border-top:1px solid var(--rule); padding-top:6px; }}
.meta-grid dt {{ font-family:var(--mono); font-size:10.5px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-3); }}
.meta-grid dd {{ margin:2px 0 0; font-size:.95rem; font-variant-numeric:tabular-nums; }}

/* ---------- notes ---------- */
.notes {{ display:grid; grid-template-columns:repeat(auto-fit,minmax(270px,1fr)); gap:var(--s3) var(--s4); }}
.note {{ border-top:1px solid var(--rule); padding-top:var(--s2); }}
.note h3 {{ font-size:1rem; font-weight:600; margin-bottom:.3em; }}
.note p {{ font-size:.95rem; color:var(--ink-2); }}
.warn {{ border-top-color:var(--accent); }}
.warn h3 {{ color:var(--accent); }}

footer {{ margin-top:var(--s5); border-top:1px solid var(--rule); padding-top:var(--s2); font-family:var(--mono); font-size:11.5px; color:var(--ink-3); line-height:1.9; }}
footer a {{ color:var(--ink-2); }}
</style>

<div class="wrap">

<header class="top">
  <div class="band">{band}</div>
  <span class="eyebrow">Hardware reference · scraped Sept 2026 · prixel.com</span>
  <h1>PRIXEL<br><em>plate &amp; pieces</em></h1>
  <p class="lede">Everything the planner app needs to know about the physical kit: one 24&nbsp;×&nbsp;16 grid at 5&nbsp;mm pitch, 34 silicone piece SKUs, and a 1&nbsp;×&nbsp;1 typeface. Measurements are the vendor's own, cross-checked against the shipped SVGs and the Illustrator template.</p>
  <div class="figs">{fig_html}</div>
</header>

<section class="blk">
  <div class="sec-h"><h2>The setup plate</h2><span class="eyebrow">drawn to scale</span></div>
  <p class="intro">Pieces push into the flat face; the plate snaps to the acrylic press on four corner magnets. Those magnet bosses eat three holes at each corner — 372 of 384 cells are usable. The composition below is built from real kit pieces, with <span style="font-family:'PRIXEL Mono',monospace">PRIXEL</span> set in PRIXEL Mono at one cell per character.</p>
  <div class="plate-wrap">
    {plate()}
    <div class="flip">
      <button id="flipBtn" type="button" aria-pressed="false">Flip to setup view</button>
      <span class="state">Showing <b id="flipState">the print</b> — what comes off the paper.</span>
    </div>
  </div>

  <div class="rules">
    <div class="rule-i">
      <span class="eyebrow">Constraint 01</span>
      <h3>Every print is mirrored</h3>
      <p>What you lay out on the plate prints reversed. The app needs a design view and a mirrored build sheet, and the build sheet is the one you actually work from.</p>
    </div>
    <div class="rule-i">
      <span class="eyebrow">Constraint 02</span>
      <h3>Inventory is finite</h3>
      <p>A design is only buildable if it fits the counts below. Live "pieces remaining" per SKU is the thing a planner does that a paper grid cannot.</p>
    </div>
    <div class="rule-i">
      <span class="eyebrow">Constraint 03</span>
      <h3>Two plates, one registration</h3>
      <p>Both plates overlay through the clear press for multi-colour prints. Model colours as layers that share one grid, not as separate documents.</p>
    </div>
    <div class="rule-i">
      <span class="eyebrow">Constraint 04</span>
      <h3>The press rotates 45°</h3>
      <p>Turning the press on the paper reuses the same shapes off-axis. Worth supporting as a plate-level rotation rather than per-piece.</p>
    </div>
  </div>
</section>

<section class="blk">
  <div class="sec-h"><h2>Piece catalogue</h2><span class="eyebrow">31 of 34 SKUs ship in the kit</span></div>
  <p class="intro">Size labels are <strong>height × width</strong> in cells — a <code>1×4</code> is four cells wide and one tall. That ordering is verified against the viewBox of all 31 shipped SVGs, and it is the single easiest thing to get backwards. Colour is the physical sort-bin coding, so it doubles as the app's grouping key. Shapes below are the vendor's own vector art, drawn at true relative scale.</p>
  {fam_blocks}
  <ul class="missing"><li><strong>Sold separately, not in the kit:</strong></li>{missing}</ul>
</section>

<section class="blk">
  <div class="sec-h"><h2>Inventory by colour family</h2><span class="eyebrow">sort-bin groups</span></div>
  <div class="tbl">
    <table>
      <thead><tr><th>Family</th><th>SKUs</th><th>Pieces</th><th>Fill</th></tr></thead>
      <tbody>{fam_rows}</tbody>
      <tfoot><tr><td>Total shipped</td><td class="n">31</td><td class="n">{total_kit}</td><td class="hx">—</td></tr></tfoot>
    </table>
  </div>
</section>

<section class="blk">
  <div class="sec-h"><h2>PRIXEL Mono</h2><span class="eyebrow">rendered in the real typeface</span></div>
  <p class="intro">A monospaced face where every glyph occupies exactly one 5&nbsp;mm cell, designed to be rotated and stacked alongside the shapes. The specimen below is set in the shipped <code>PRIXELMono.otf</code>, so these are the actual letterforms — not a stand-in.</p>
  <div class="spec">
    <div class="big">THINK OUTSIDE THE BASELINE,<br>INSIDE THE GRID</div>
    <div class="glyphs">{charset()}</div>
    <dl class="meta-grid">
      <div><dt>Physical set</dt><dd>324 pieces · $25</dd></div>
      <div><dt>Mapped codepoints</dt><dd>123</dd></div>
      <div><dt>Glyphs in font</dt><dd>273</dd></div>
      <div><dt>Units per em</dt><dd>1000 · 270 of 273 advances</dd></div>
      <div><dt>Cap height / ascender</dt><dd>600 / 800</dd></div>
      <div><dt>Licence</dt><dd>Non-commercial use only</dd></div>
      <div><dt>Zero-advance glyphs</dt><dd><code>|</code> U+007C — a font defect</dd></div>
    </dl>
  </div>
</section>

<section class="blk">
  <div class="sec-h"><h2>Notes for the build</h2><span class="eyebrow">before you write the data model</span></div>
  <div class="notes">
    <div class="note warn">
      <h3>310 or 316?</h3>
      <p>The product page headline says 310 pieces; its own spec table sums to {total_kit}. Take {total_kit} as the table truth and make every count user-editable — kits get lost pieces and bought expansions.</p>
    </div>
    <div class="note warn">
      <h3>Corner cut-outs are unconfirmed</h3>
      <p>"Three holes in each corner" is the vendor's wording, and the plate photo reads as an L-triomino. Measure the real plate before locking the placement mask.</p>
    </div>
    <div class="note">
      <h3>Vector art is free</h3>
      <p>All 31 shape SVGs are authored at <code>width="5mm"</code> with <code>14.1732</code> user units per cell. Scale by 5/14.1732 to work in millimetres. No redrawing.</p>
    </div>
    <div class="note">
      <h3>Mono counts aren't published</h3>
      <p>324 physical characters against 123 codepoints means duplicates of the common letters, but the per-character breakdown isn't documented anywhere. Make it editable too.</p>
    </div>
    <div class="note">
      <h3>Rotations multiply the catalogue</h3>
      <p>Most pieces are placed in four orientations and several are chiral, so the real placement vocabulary is far larger than 34. Store <code>{{sku, cell, rotation}}</code>, not a pre-rotated sprite per variant.</p>
    </div>
    <div class="note">
      <h3>Line pieces print differently</h3>
      <p>Green line pieces need noticeably less pressure than solid shapes. Worth surfacing on a build sheet that mixes both — it is the vendor's top troubleshooting entry.</p>
    </div>
  </div>
</section>

<footer>
  Sources: <a href="https://prixel.com/products/the-prixel-printing-kit">the kit</a> ·
  <a href="https://prixel.com/pages/help">help &amp; templates</a> ·
  <a href="https://prixel.com/products/expansion-packs">expansion packs</a> ·
  <a href="https://prixel.com/products/prixel-mono">PRIXEL Mono</a> ·
  <a href="https://prixel.com/products/ps-002-prixel-setup-plates">setup plates</a><br>
  Also checked: the 2024 Idea Book PDF, the 2025 Q1 Illustrator template (MediaBox 340.157 × 226.772 pt = 120.00 × 80.00 mm), and PRIXELMono.otf. PRIXEL is US Patent 20230264503A1. Type by Andrew Bellamy / Otherwhere Collective.
</footer>

</div>

<script>
(function () {{
  var comp = document.getElementById("comp");
  var btn  = document.getElementById("flipBtn");
  var lbl  = document.getElementById("flipState");
  var mirrored = false;
  btn.addEventListener("click", function () {{
    mirrored = !mirrored;
    comp.setAttribute("transform", mirrored ? "translate(120 0) scale(-1 1)" : "");
    btn.textContent = mirrored ? "Flip to print view" : "Flip to setup view";
    btn.setAttribute("aria-pressed", String(mirrored));
    lbl.textContent = mirrored ? "the setup" : "the print";
    lbl.parentNode.lastChild.nodeValue = mirrored
      ? " \\u2014 how you actually place the pieces."
      : " \\u2014 what comes off the paper.";
  }});
}})();
</script>
"""

out = os.path.join(ROOT, "docs", "prixel-datasheet.html")
open(out, "w", encoding="utf-8").write(HTML)
print("wrote", out, len(HTML) // 1024, "KB")
