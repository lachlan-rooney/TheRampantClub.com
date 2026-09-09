// Every `const [a, b] = await Promise.all([...])` where the number of BINDINGS
// does not match the number of PROMISES.
//
// Why this is worth a script: almost every call in this codebase resolves to the
// same `{ data, error }` shape, so a mis-ordered or mis-counted destructure
// TYPE-CHECKS CLEANLY and binds the wrong result to the wrong name. I shipped
// exactly that today by splicing a fetch into the middle of one.
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const files = []
const walk = d => { for (const e of readdirSync(d)) {
  const p = join(d, e)
  if (e === 'node_modules' || e === '.next' || e === '.git') continue
  if (statSync(p).isDirectory()) walk(p)
  else if (/\.(ts|tsx|mts)$/.test(p)) files.push(p)
} }
for (const d of ['app', 'lib', 'components']) walk(d)

// Split a bracketed region into top-level segments, tracking nesting, strings
// and comments. Counting commas + 1 is WRONG: these arrays habitually carry a
// TRAILING COMMA, which inflated every clean site by one and made the first run
// of this script report 43 phantom failures.
const topLevelSegments = (s) => {
  const out = []
  let depth = 0, cur = '', str = null, i = 0
  for (; i < s.length; i++) {
    const c = s[i], n = s[i + 1]
    if (str) { cur += c; if (c === '\\') { cur += n; i++; continue } if (c === str) str = null; continue }
    if (c === '/' && n === '/') { while (i < s.length && s[i] !== '\n') i++; continue }
    if (c === '/' && n === '*') { i += 2; while (i < s.length && !(s[i] === '*' && s[i + 1] === '/')) i++; i++; continue }
    if (c === '"' || c === "'" || c === '`') { str = c; cur += c; continue }
    if ('([{'.includes(c)) { depth++; cur += c; continue }
    if (')]}'.includes(c)) { if (depth === 0) break; depth--; cur += c; continue }
    if (c === ',' && depth === 0) { out.push(cur); cur = ''; continue }
    cur += c
  }
  out.push(cur)
  // Drop the empty tail a trailing comma leaves behind.
  return out.filter(x => x.trim().length > 0)
}

let flagged = 0, checked = 0
for (const f of files) {
  const src = readFileSync(f, 'utf8')
  // `[^;]*?` and no `const` inside: without it the pattern ran from a useState
  // destructure on one line into an unrelated Promise.all further down the file.
  const re = /(?:const|let)\s*\[((?:(?!const |let |;)[\s\S])*?)\]\s*=\s*await\s+Promise\.all\(\s*\[/g
  let m
  while ((m = re.exec(src))) {
    const bindings = topLevelSegments(m[1] + ']').length
    const arrStart = m.index + m[0].length
    const elements = topLevelSegments(src.slice(arrStart)).length
    checked++
    if (bindings !== elements) {
      flagged++
      const line = src.slice(0, m.index).split('\n').length
      console.log(`✗ ${f}:${line}  ${bindings} binding(s) vs ${elements} promise(s)`)
      console.log(`    [${m[1].replace(/\s+/g, ' ').trim().slice(0, 90)}]`)
    }
  }
}
console.log(`\nchecked ${checked} destructured Promise.all sites`)
console.log(flagged === 0 ? 'PASS — every one binds exactly as many names as it awaits\n'
                          : `FAIL — ${flagged} mismatched\n`)
process.exit(flagged ? 1 : 0)
