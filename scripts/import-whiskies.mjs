import { readFileSync } from 'fs'

const csv = readFileSync('public/documents/Rampant Room Bottle Storage Register.xlsx - Bottle Share Room.csv', 'utf-8')

// Parse CSV (handle quoted fields with commas/newlines)
function parseCSV(text) {
  const rows = []
  let row = []
  let field = ''
  let inQuotes = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') { field += '"'; i++ }
      else if (ch === '"') { inQuotes = false }
      else { field += ch }
    } else {
      if (ch === '"') { inQuotes = true }
      else if (ch === ',') { row.push(field.trim()); field = '' }
      else if (ch === '\n') { row.push(field.trim()); rows.push(row); row = []; field = '' }
      else if (ch !== '\r') { field += ch }
    }
  }
  if (field || row.length) { row.push(field.trim()); rows.push(row) }
  return rows
}

const rows = parseCSV(csv)

// Find header row (starts with "Slot")
const headerIdx = rows.findIndex(r => r[0] && r[0].includes('Slot'))
if (headerIdx === -1) { console.error('Header not found'); process.exit(1) }

const dataRows = rows.slice(headerIdx + 1).filter(r => r[2] && r[2].length > 0) // must have Brand

// Map regions to Supabase enum
function mapRegion(country, region) {
  const r = (region || '').trim()
  const c = (country || '').trim()

  if (c === 'Japan') return 'Japan'
  if (c === 'Ireland') return 'Ireland'

  // Scottish regions
  if (r === 'Speyside') return 'Speyside'
  if (r === 'Islay') return 'Islay'
  if (r === 'Highland' || r === 'Highlands') return 'Highland'
  if (r === 'Lowland' || r === 'Lowlands') return 'Lowland'
  if (r === 'Campbeltown' || r === 'Campbelltown') return 'Campbeltown'
  if (r === 'Island' || r.startsWith('Island')) return 'Islands'

  return 'Other'
}

function esc(s) {
  if (!s) return 'null'
  return "'" + s.replace(/'/g, "''") + "'"
}

// First: clear existing whiskies
let sql = '-- Clear existing seed data\nDELETE FROM public.whiskies;\n\n'
sql += '-- Import from spreadsheet\n'

for (const r of dataRows) {
  const brand = r[2] || ''
  const expression = r[3] || ''
  const distillery = r[4] || ''
  const country = r[5] || ''
  const region = r[6] || ''
  const age = r[7] || ''
  const abv = r[9] ? r[9] + '%' : ''
  const status = (r[11] || '').trim()
  const notes = r[12] || ''

  // Avoid duplicating expression if brand already ends with it
  let name = brand
  if (expression && !brand.endsWith(expression)) {
    name = `${brand} ${expression}`.trim()
  }
  const mappedRegion = mapRegion(country, region)
  const inStock = status !== 'Empty' && status !== 'Removed'

  // Combine country info into tasting notes if non-Scottish
  let tastingNotes = notes
  if (country && country !== 'Scotland') {
    tastingNotes = country + (tastingNotes ? '. ' + tastingNotes : '')
  }

  sql += `INSERT INTO public.whiskies (name, distillery, region, cask_type, age, abv, tasting_notes, committees_pick, in_stock) VALUES (${esc(name)}, ${esc(distillery || null)}, ${esc(mappedRegion)}, null, ${esc(age || null)}, ${esc(abv || null)}, ${esc(tastingNotes || null)}, false, ${inStock});\n`
}

console.log(sql)
