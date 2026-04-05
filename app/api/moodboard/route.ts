import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase-server'

const BUCKET = 'moodboard'

// GET — list all moodboard images
export async function GET() {
  try {
    const supabase = await createServerSupabaseClient()
    const { data: files, error } = await supabase.storage
      .from(BUCKET)
      .list('', { sortBy: { column: 'created_at', order: 'desc' } })

    if (error) {
      console.error('Moodboard list error:', error)
      return NextResponse.json({ images: [] })
    }

    const validExts = /\.(png|jpg|jpeg|webp|gif|avif|heic|svg)$/i
    const images = (files || [])
      .filter(f => validExts.test(f.name))
      .map(f => {
        const { data } = supabase.storage.from(BUCKET).getPublicUrl(f.name)
        const { data: thumb } = supabase.storage.from(BUCKET).getPublicUrl(f.name, {
          transform: { width: 600, quality: 75 },
        })
        return {
          id: f.name.replace(/\.[^.]+$/, ''),
          src: data.publicUrl,
          thumb: thumb.publicUrl,
          filename: f.name,
        }
      })

    return NextResponse.json({ images })
  } catch {
    return NextResponse.json({ images: [] })
  }
}

// POST — upload a new image
export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const validExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'avif', 'heic', 'svg']
    const ext = file.name.split('.').pop()?.toLowerCase() || ''
    const isImageType = file.type.startsWith('image/') || validExts.includes(ext)
    if (!isImageType) {
      return NextResponse.json({ error: 'File must be an image' }, { status: 400 })
    }

    const MAX_SIZE = 50 * 1024 * 1024
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { error: `File is ${(file.size / 1024 / 1024).toFixed(1)}MB — max is 50MB. Compress or resize before uploading.` },
        { status: 400 }
      )
    }

    const fileExt = ext || 'png'
    const timestamp = Date.now()
    const safeName = `${timestamp}.${fileExt}`

    const supabase = await createServerSupabaseClient()
    const buffer = Buffer.from(await file.arrayBuffer())

    const { error } = await supabase.storage
      .from(BUCKET)
      .upload(safeName, buffer, {
        contentType: file.type || `image/${fileExt}`,
        upsert: false,
      })

    if (error) {
      console.error('Moodboard upload error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(safeName)

    return NextResponse.json({
      image: {
        id: String(timestamp),
        src: data.publicUrl,
        filename: safeName,
      }
    })
  } catch (err) {
    console.error('Moodboard upload error:', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}

// DELETE — remove an image
export async function DELETE(req: NextRequest) {
  try {
    const { filename } = await req.json()
    if (!filename || filename.includes('..') || filename.includes('/')) {
      return NextResponse.json({ error: 'Invalid filename' }, { status: 400 })
    }

    const supabase = await createServerSupabaseClient()
    const { error } = await supabase.storage.from(BUCKET).remove([filename])

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: 'Delete failed' }, { status: 500 })
  }
}
