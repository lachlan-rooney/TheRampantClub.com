import { NextResponse } from 'next/server'

const SHEET_URL = 'https://docs.google.com/spreadsheets/d/e/2PACX-1vTrnzXhnbicxCBOQYdoAN4zwzucMXvfsUAoMqjWsfUeT6fnmo-ZjgRCvnHBJHHwSRX1DB85n37kGjyM/pub?gid=900697544&single=true&output=csv'

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let row: string[] = []
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

export async function GET() {
  try {
    const res = await fetch(SHEET_URL, { next: { revalidate: 60 } })
    const csv = await res.text()
    const rows = parseCSV(csv)
    if (rows.length < 2) return NextResponse.json([])

    const headers = rows[0]
    const members = rows.slice(1)
      .filter(r => r[1] && r[1].length > 0)
      .map(r => {
        const obj: Record<string, string> = {}
        headers.forEach((h, i) => { obj[h] = r[i] || '' })
        return obj
      })

    return NextResponse.json(members)
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 })
  }
}
