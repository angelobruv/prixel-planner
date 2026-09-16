// Extract only the acceptance sample's seven glyphs from the supplied vendor font.
// See NOTICE.md: these outlines inherit the font's non-commercial restrictions.
import opentype from 'opentype.js'
import fs from 'node:fs'
const buffer = fs.readFileSync('assets/fonts/PRIXELMono.otf')
const font = opentype.parse(buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength))
const glyphs = Object.fromEntries([...new Set('Negroni')].map(char => [char, font.charToGlyph(char).getPath(0, 800, 1000).toSVG(3).replace('<path ', '<path fill="currentColor" ')]))
fs.writeFileSync('assets/negroni-glyphs.json', JSON.stringify(glyphs, null, 2) + '\n')
