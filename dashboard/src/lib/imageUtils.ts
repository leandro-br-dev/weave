/**
 * Image conversion utilities
 *
 * Converts raster images to WebP before upload to reduce payload size.
 * Vector (SVG) and animated (GIF) formats are left untouched to avoid
 * quality/animation loss.
 */

/** Quality used when encoding WebP (0-1) */
export const WEBP_QUALITY = 0.85

/** Formats that must never be re-encoded */
const NON_CONVERTIBLE_TYPES = new Set(['image/svg+xml', 'image/gif'])

function isConvertibleImage(file: File): boolean {
  return file.type.startsWith('image/') && !NON_CONVERTIBLE_TYPES.has(file.type)
}

function toWebpFileName(originalName: string): string {
  const baseName = originalName.replace(/\.[^.]+$/, '')
  return `${baseName || 'image'}.webp`
}

/**
 * Converts an image File to WebP at the given quality.
 *
 * Falls back to the original file when:
 * - the file is not a convertible raster image (SVG/GIF are skipped)
 * - the browser cannot decode the image
 * - canvas 2D context is unavailable
 * - WebP encoding is unsupported (blob comes back as PNG or null)
 */
export async function convertImageToWebP(
  file: File,
  quality: number = WEBP_QUALITY
): Promise<File> {
  if (!isConvertibleImage(file)) return file

  const objectUrl = URL.createObjectURL(file)
  try {
    const image = await new Promise<HTMLImageElement>((resolve, reject) => {
      const img = new Image()
      img.onload = () => resolve(img)
      img.onerror = () => reject(new Error(`Failed to decode image: ${file.name}`))
      img.src = objectUrl
    })

    const canvas = document.createElement('canvas')
    canvas.width = image.naturalWidth
    canvas.height = image.naturalHeight
    const context = canvas.getContext('2d')
    if (!context || canvas.width === 0 || canvas.height === 0) return file

    context.drawImage(image, 0, 0)

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((result) => resolve(result), 'image/webp', quality)
    })

    // Unsupported browsers silently fall back to PNG — detect and bail out
    if (!blob || blob.type !== 'image/webp') return file

    return new File([blob], toWebpFileName(file.name), { type: 'image/webp' })
  } catch {
    return file
  } finally {
    URL.revokeObjectURL(objectUrl)
  }
}
