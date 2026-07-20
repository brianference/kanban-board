/**
 * Resize + compress images in the browser before upload.
 * D1 storage is tight (~1MB after base64); we target under MAX_UPLOAD_BYTES.
 */

/** Must stay under server MAX (functions attachments ~900KB). */
export const MAX_UPLOAD_BYTES = 850_000

const MAX_EDGE = 1920
const MIN_QUALITY = 0.45
const START_QUALITY = 0.88

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read image'))
    }
    img.src = url
  })
}

function canvasToBlob(
  canvas: HTMLCanvasElement,
  type: string,
  quality: number,
): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) reject(new Error('Image compression failed'))
        else resolve(blob)
      },
      type,
      quality,
    )
  })
}

function scaleSize(w: number, h: number, maxEdge: number): { w: number; h: number } {
  const long = Math.max(w, h)
  if (long <= maxEdge) return { w, h }
  const scale = maxEdge / long
  return {
    w: Math.max(1, Math.round(w * scale)),
    h: Math.max(1, Math.round(h * scale)),
  }
}

/**
 * Prepare a file for upload: pass through if already small enough,
 * otherwise resize (max edge 1920) and JPEG-compress to fit budget.
 */
export async function prepareImageForUpload(file: File): Promise<{
  file: File
  optimized: boolean
  originalBytes: number
  finalBytes: number
}> {
  const originalBytes = file.size
  if (originalBytes <= 0) throw new Error('Empty file')

  const type = (file.type || '').toLowerCase()
  const isImage =
    type.startsWith('image/') ||
    /\.(png|jpe?g|gif|webp)$/i.test(file.name || '')
  if (!isImage) throw new Error('Only image files are allowed')

  // Small enough — keep original (preserves GIF animation / PNG transparency)
  if (originalBytes <= MAX_UPLOAD_BYTES) {
    return { file, optimized: false, originalBytes, finalBytes: originalBytes }
  }

  // Animated GIF over budget: compress first frame as JPEG
  const img = await loadImage(file)
  let maxEdge = MAX_EDGE
  let { w, h } = scaleSize(img.naturalWidth || img.width, img.naturalHeight || img.height, maxEdge)

  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas not available for image compression')

  let quality = START_QUALITY
  let blob: Blob | null = null
  let outName = (file.name || 'image').replace(/\.[^.]+$/, '') + '.jpg'

  for (let attempt = 0; attempt < 10; attempt++) {
    canvas.width = w
    canvas.height = h
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, w, h)
    ctx.drawImage(img, 0, 0, w, h)
    blob = await canvasToBlob(canvas, 'image/jpeg', quality)

    if (blob.size <= MAX_UPLOAD_BYTES) break

    if (quality > MIN_QUALITY) {
      quality = Math.max(MIN_QUALITY, quality - 0.08)
    } else {
      maxEdge = Math.round(maxEdge * 0.75)
      if (maxEdge < 640) break
      const next = scaleSize(
        img.naturalWidth || img.width,
        img.naturalHeight || img.height,
        maxEdge,
      )
      w = next.w
      h = next.h
      quality = START_QUALITY
    }
  }

  if (!blob || blob.size > MAX_UPLOAD_BYTES) {
    throw new Error(
      `Could not compress image under ${Math.round(MAX_UPLOAD_BYTES / 1024)}KB. Try a smaller crop or screenshot.`,
    )
  }

  const out = new File([blob], outName, { type: 'image/jpeg', lastModified: Date.now() })
  return {
    file: out,
    optimized: true,
    originalBytes,
    finalBytes: out.size,
  }
}
