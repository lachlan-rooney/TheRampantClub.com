import { NextResponse } from 'next/server'

export async function GET() {
  try {
    const res = await fetch(
      'https://api.open-meteo.com/v1/forecast?latitude=10.776&longitude=106.701&current_weather=true',
      { next: { revalidate: 600 } } // cache for 10 minutes
    )
    const data = await res.json()
    const temp = data?.current_weather?.temperature
    return NextResponse.json({ temp: temp != null ? Math.round(temp) : null })
  } catch {
    return NextResponse.json({ temp: null }, { status: 500 })
  }
}
