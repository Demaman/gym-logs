'use client'
import { useEffect, useState } from 'react'
import { Play, X, ExternalLink } from 'lucide-react'
import { useI18n } from '@/providers/i18n-provider'
import { parseVideoEmbed } from '@/lib/utils/video'

export function VideoPreviewButton({ url, name }: { url: string; name: string }) {
  const { t } = useI18n()
  const [show, setShow] = useState(false)
  return (
    <>
      <button
        type="button"
        aria-label={`${t.training.watchDemo}: ${name}`}
        onClick={(e) => { e.stopPropagation(); setShow(true) }}
        className="shrink-0 rounded-md p-1 text-primary transition-colors hover:bg-primary/10"
      >
        <Play className="size-3.5" aria-hidden />
      </button>
      {show && (
        <ExerciseVideoModal url={url} exerciseName={name} onClose={() => setShow(false)} />
      )}
    </>
  )
}

interface Props {
  url: string
  exerciseName: string
  onClose: () => void
}

export function ExerciseVideoModal({ url, exerciseName, onClose }: Props) {
  const { t } = useI18n()
  const [videoError, setVideoError] = useState(false)

  // Prepend API base for relative /media/ paths
  const resolvedUrl =
    url.startsWith('/') && !url.startsWith('//')
      ? `${process.env.NEXT_PUBLIC_API_URL ?? ''}${url}`
      : url

  const embed = parseVideoEmbed(resolvedUrl)

  useEffect(() => { setVideoError(false) }, [url])

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/70" onClick={onClose} aria-hidden />

      {/* Centering shell — extra bottom padding on mobile clears the fixed nav bar */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pb-20 lg:pb-4" role="presentation">
        <div
          className="w-full max-w-[min(92vw,640px)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl"
          role="dialog"
          aria-modal
          aria-label={exerciseName}
        >
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-2.5">
            <h3 className="min-w-0 flex-1 truncate text-sm font-semibold text-foreground">
              {exerciseName}
            </h3>
            <div className="flex shrink-0 items-center">
              {embed && !videoError && (
                <a
                  href={embed.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={t.training.openInNewTab}
                  className="flex h-10 items-center gap-1.5 rounded-lg px-3 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                >
                  <ExternalLink className="size-3.5 shrink-0" aria-hidden />
                  <span className="hidden sm:inline">{t.training.openInNewTab}</span>
                </a>
              )}
              <button
                type="button"
                aria-label={t.common.close}
                onClick={onClose}
                className="flex h-10 w-10 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          </div>

          {/* Video — padding-bottom trick caps height in landscape (min of 56.25% or 55dvh) */}
          <div
            className="relative w-full overflow-hidden bg-black"
            style={{ paddingBottom: 'min(56.25%, 55dvh)' }}
          >
            <div className="absolute inset-0">
              {!embed || videoError ? (
                <div className="flex h-full flex-col items-center justify-center gap-3 px-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    {videoError
                      ? "This video can't be played inline."
                      : 'Could not load video.'}
                  </p>
                  <a
                    href={embed?.sourceUrl ?? url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1.5 rounded-lg bg-primary/10 px-4 py-2.5 text-sm font-medium text-primary hover:bg-primary/20"
                  >
                    <ExternalLink className="size-3.5" aria-hidden />
                    {t.training.openInNewTab}
                  </a>
                </div>
              ) : embed.type === 'youtube' || embed.type === 'vimeo' ? (
                <iframe
                  src={embed.embedUrl}
                  className="h-full w-full"
                  allow="autoplay; fullscreen; picture-in-picture"
                  allowFullScreen
                  title={exerciseName}
                />
              ) : (
                <video
                  src={embed.embedUrl}
                  controls
                  autoPlay
                  className="h-full w-full object-contain"
                  title={exerciseName}
                  onError={() => setVideoError(true)}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
