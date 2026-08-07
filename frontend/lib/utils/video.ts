export type VideoType = 'youtube' | 'vimeo' | 'direct'

export interface VideoEmbed {
  type: VideoType
  embedUrl: string
  sourceUrl: string
}

function extractYouTubeId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl)
    const host = u.hostname.replace(/^www\./, '').replace(/^m\./, '')

    if (host === 'youtu.be') {
      // https://youtu.be/VIDEO_ID
      const id = u.pathname.slice(1).split('/')[0]
      return id.length >= 11 ? id.slice(0, 11) : null
    }

    if (host === 'youtube.com') {
      // /watch?v=VIDEO_ID (v= can be anywhere in query string)
      const v = u.searchParams.get('v')
      if (v) return v.slice(0, 11)

      // /shorts/VIDEO_ID  /embed/VIDEO_ID  /live/VIDEO_ID  /v/VIDEO_ID
      const pathMatch = u.pathname.match(/\/(shorts|embed|live|v)\/([A-Za-z0-9_-]{11})/)
      if (pathMatch) return pathMatch[2]
    }
  } catch { /* invalid URL */ }
  return null
}

function extractVimeoId(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl)
    const host = u.hostname.replace(/^www\./, '').replace(/^player\./, '')
    if (host !== 'vimeo.com') return null
    // /123456789  or  /video/123456789
    const match = u.pathname.match(/\/?(?:video\/)?(\d+)/)
    return match?.[1] ?? null
  } catch { /* invalid URL */ }
  return null
}

export function parseVideoEmbed(rawUrl: string): VideoEmbed | null {
  if (!rawUrl?.trim()) return null
  const url = rawUrl.trim()

  const ytId = extractYouTubeId(url)
  if (ytId) {
    return {
      type: 'youtube',
      embedUrl: `https://www.youtube.com/embed/${ytId}?rel=0`,
      sourceUrl: `https://www.youtube.com/watch?v=${ytId}`,
    }
  }

  const vimeoId = extractVimeoId(url)
  if (vimeoId) {
    return {
      type: 'vimeo',
      embedUrl: `https://player.vimeo.com/video/${vimeoId}`,
      sourceUrl: `https://vimeo.com/${vimeoId}`,
    }
  }

  // Relative /media/… paths and direct http(s) URLs
  if (url.startsWith('/') || url.startsWith('http://') || url.startsWith('https://')) {
    return { type: 'direct', embedUrl: url, sourceUrl: url }
  }

  return null
}
