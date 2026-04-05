'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import Link from 'next/link'

interface MoodboardImage {
  id: string
  src: string
  filename: string
}

export default function MoodboardUploadPage() {
  const [images, setImages] = useState<MoodboardImage[]>([])
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchImages = useCallback(async () => {
    try {
      const res = await fetch('/api/moodboard')
      const data = await res.json()
      setImages(data.images || [])
    } catch (err) {
      setError(`Fetch failed: ${err}`)
    }
  }, [])

  useEffect(() => {
    fetchImages()
  }, [fetchImages])

  const uploadFiles = useCallback(async (files: FileList | File[]) => {
    setUploading(true)
    setError(null)
    const fileArray = Array.from(files)

    if (fileArray.length === 0) {
      setError('No files selected')
      setUploading(false)
      return
    }

    for (const file of fileArray) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        const res = await fetch('/api/moodboard', { method: 'POST', body: formData })
        const data = await res.json()
        if (!res.ok) {
          setError(`Upload error for ${file.name}: ${data.error || res.statusText}`)
        }
      } catch (err) {
        setError(`Upload failed for ${file.name}: ${err}`)
      }
    }

    await fetchImages()
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }, [fetchImages])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragOver(false)
    if (e.dataTransfer.files.length > 0) {
      uploadFiles(e.dataTransfer.files)
    }
  }, [uploadFiles])

  const handleDelete = useCallback(async (filename: string, id: string) => {
    setDeletingId(id)
    await fetch('/api/moodboard', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename }),
    })
    await fetchImages()
    setDeletingId(null)
  }, [fetchImages])

  return (
    <>
      <style suppressHydrationWarning dangerouslySetInnerHTML={{ __html: `
        @import url('https://fonts.googleapis.com/css2?family=DM+Mono:ital,wght@0,300;0,400;0,500;1,300;1,400&family=Playfair+Display:wght@400;500;600;700;800;900&display=swap');

        :root {
          --trc-green-deep: #E5D4C2;
          --trc-green-mid: #28483C;
          --trc-green-accent: #B2AA98;
          --trc-cream: #052E20;
          --trc-cream-dim: #B2AA98;
          --trc-sand: #052E20;
          --trc-red: #8B3A3A;
          --trc-red-bg: rgba(139, 58, 58, 0.1);
          --trc-red-border: rgba(139, 58, 58, 0.2);
        }

        * { margin: 0; padding: 0; box-sizing: border-box; }

        .upload-page {
          min-height: 100vh;
          background: var(--trc-sand);
          font-family: 'DM Mono', monospace;
          position: relative;
        }

        .upload-grain {
          position: fixed; inset: 0; pointer-events: none; z-index: 9998; opacity: 0.025;
          background-image: url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E");
          background-repeat: repeat; background-size: 200px;
        }

        .upload-container {
          max-width: 840px;
          margin: 0 auto;
          padding: 100px 24px 80px;
          position: relative;
          z-index: 2;
        }

        .upload-back {
          font-size: 11px;
          color: var(--trc-green-accent);
          opacity: 0.4;
          text-decoration: none;
          letter-spacing: 0.06em;
          transition: opacity 0.2s;
          display: inline-block;
          margin-bottom: 32px;
        }
        .upload-back:hover { opacity: 0.7; }

        .upload-header {
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          margin-bottom: 36px;
          padding-bottom: 20px;
          border-bottom: 1px solid rgba(229, 212, 194, 0.08);
        }
        .upload-title {
          font-family: 'Rampant Sans', serif;
          font-size: 26px; font-weight: 700;
          color: var(--trc-green-deep);
          letter-spacing: 0.02em;
        }
        .upload-count {
          font-size: 11px;
          color: var(--trc-green-accent);
          opacity: 0.6; margin-top: 4px;
          letter-spacing: 0.06em;
        }

        .upload-error {
          padding: 12px 16px;
          background: var(--trc-red-bg);
          border: 1px solid var(--trc-red-border);
          border-radius: 8px;
          margin-bottom: 20px;
          color: var(--trc-red);
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          letter-spacing: 0.02em;
        }
        .upload-error button {
          background: none; border: none;
          color: var(--trc-red); cursor: pointer;
          font-family: 'DM Mono', monospace;
          font-size: 14px; font-weight: 500;
          padding: 0 4px; opacity: 0.6;
          transition: opacity 0.2s;
        }
        .upload-error button:hover { opacity: 1; }

        .upload-zone {
          border: 1.5px dashed rgba(229, 212, 194, 0.25);
          border-radius: 12px;
          padding: 52px 24px;
          text-align: center;
          cursor: pointer;
          background: rgba(255, 255, 255, 0.04);
          transition: all 0.25s ease;
          margin-bottom: 36px;
        }
        .upload-zone.active {
          border-color: var(--trc-green-accent);
          background: rgba(229, 212, 194, 0.06);
        }
        .upload-zone:hover {
          border-color: rgba(229, 212, 194, 0.4);
          background: rgba(255, 255, 255, 0.06);
        }
        .upload-zone-icon {
          display: inline-flex;
          align-items: center; justify-content: center;
          width: 44px; height: 44px;
          border-radius: 50%;
          background: var(--trc-green-deep);
          color: var(--trc-cream);
          font-size: 20px; font-weight: 300;
          margin-bottom: 14px;
        }
        .upload-zone-title {
          font-family: 'Rampant Sans', serif;
          font-size: 16px; font-weight: 600;
          color: var(--trc-green-deep);
          letter-spacing: 0.02em;
        }
        .upload-zone-subtitle {
          font-size: 11px;
          color: var(--trc-green-accent);
          margin-top: 6px; opacity: 0.5;
          letter-spacing: 0.04em;
        }
        .upload-zone-uploading {
          font-size: 13px;
          color: var(--trc-green-accent);
          font-weight: 500;
          letter-spacing: 0.06em;
        }

        .upload-grid {
          display: grid;
          grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
          gap: 12px;
        }
        .upload-grid-item {
          position: relative;
          background: rgba(255, 255, 255, 0.04);
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid rgba(229, 212, 194, 0.06);
          aspect-ratio: 1;
          transition: opacity 0.3s ease;
        }
        .upload-grid-item.deleting { opacity: 0.3; }
        .upload-grid-item img {
          position: absolute; inset: 0;
          width: 100%; height: 100%;
          object-fit: contain;
        }
        .upload-grid-delete {
          position: absolute; top: 6px; right: 6px;
          width: 26px; height: 26px;
          border-radius: 50%; border: none;
          background: rgba(229, 212, 194, 0.6);
          color: var(--trc-cream);
          font-family: 'DM Mono', monospace;
          font-size: 12px; cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          opacity: 0;
          transition: all 0.2s ease;
          backdrop-filter: blur(4px);
        }
        .upload-grid-item:hover .upload-grid-delete { opacity: 1; }
        .upload-grid-delete:hover { background: var(--trc-red); }

        .upload-empty {
          text-align: center; margin-top: 48px;
        }
        .upload-empty p {
          color: var(--trc-green-accent);
          font-size: 13px; opacity: 0.35;
          letter-spacing: 0.04em;
        }

        ::-webkit-scrollbar { width: 6px; }
        ::-webkit-scrollbar-track { background: var(--trc-sand); }
        ::-webkit-scrollbar-thumb { background: rgba(229, 212, 194, 0.2); border-radius: 3px; }

        @media (max-width: 768px) {
          .upload-container { padding: 80px 16px 60px; }
          .upload-header { flex-direction: column; align-items: flex-start; gap: 16px; }
          .upload-grid { grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 10px; }
          .upload-grid-delete { opacity: 1; }
        }
      ` }} />

      <div className="upload-page">
        <div className="upload-grain" />
        <div className="upload-container">
          <Link href="/members" className="upload-back">&larr; Back</Link>

          <div className="upload-header">
            <div>
              <h1 className="upload-title">Moodboard</h1>
              <p className="upload-count">
                {images.length} image{images.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>

          {error && (
            <div className="upload-error">
              <span>{error}</span>
              <button onClick={() => setError(null)} aria-label="Dismiss error">&times;</button>
            </div>
          )}

          <div
            className={`upload-zone ${dragOver ? 'active' : ''}`}
            onClick={() => fileInputRef.current?.click()}
            onDragOver={(e) => { e.preventDefault(); setDragOver(true) }}
            onDragLeave={() => setDragOver(false)}
            onDrop={handleDrop}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".png,.jpg,.jpeg,.webp,.gif,.avif,.heic,image/*"
              multiple
              onChange={(e) => {
                if (e.target.files && e.target.files.length > 0) {
                  uploadFiles(e.target.files)
                }
              }}
              style={{ display: 'none' }}
            />
            {uploading ? (
              <p className="upload-zone-uploading">Uploading&hellip;</p>
            ) : (
              <>
                <div className="upload-zone-icon">+</div>
                <p className="upload-zone-title">Drop images here or click to upload</p>
                <p className="upload-zone-subtitle">PNG, JPG, WebP, GIF &mdash; up to 50MB each</p>
              </>
            )}
          </div>

          {images.length > 0 && (
            <div className="upload-grid">
              {images.map((img) => (
                <div
                  key={img.id}
                  className={`upload-grid-item ${deletingId === img.id ? 'deleting' : ''}`}
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={img.src} alt={img.filename} />
                  <button
                    className="upload-grid-delete"
                    onClick={(e) => { e.stopPropagation(); handleDelete(img.filename, img.id) }}
                    aria-label={`Delete ${img.filename}`}
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}

          {images.length === 0 && !uploading && (
            <div className="upload-empty">
              <p>No images yet. Upload some inspiration to get started.</p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
