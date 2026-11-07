import { useState } from 'react'
import { ClubImage, Eyebrow } from '@/components/studio'
import rawProductVideos from '../../../../../fixtures/product_videos.json'
import type { HeadSlug, HeadVideoData } from '../ProductVideo'
import { headName } from '../specLabel'

const productVideos = rawProductVideos as unknown as Record<HeadSlug, HeadVideoData>

/**
 * Aside video tile (R3, K7 `product_video`): 120px tile with the head and an orange play button; a click
 * plays the head's main clip inline (the studio mp4 when there is one, else its main video, from
 * fixtures/product_videos.json). Remount with `key={head}` to reset when the head changes.
 */
export function VideoTile({ head }: { head: string }) {
  const d = productVideos[head as HeadSlug]
  const [playing, setPlaying] = useState(false)
  if (!d || (!d.hero_mp4_url && !d.youtube_id)) return null
  const name = headName(head)
  const title = d.hero_mp4_url ? `${name}, studio clip` : d.title

  if (playing) {
    return (
      <div className="flex flex-col gap-1.5">
        {d.hero_mp4_url ? (
          <video
            src={d.hero_mp4_url}
            controls
            autoPlay
            playsInline
            aria-label={title}
            className="aspect-video w-full rounded-14 border border-grey-26 bg-midnight"
          />
        ) : (
          <iframe
            title={title}
            src={`https://www.youtube-nocookie.com/embed/${encodeURIComponent(d.youtube_id)}?autoplay=1&rel=0`}
            allow="autoplay; encrypted-media; picture-in-picture"
            referrerPolicy="strict-origin-when-cross-origin"
            allowFullScreen
            className="aspect-video w-full rounded-14 border border-grey-26 bg-midnight"
          />
        )}
        <span className="flex items-center gap-3 text-[13px] text-grey-a3">
          <span className="min-w-0 flex-1 truncate">{title}</span>
          <button
            type="button"
            onClick={() => setPlaying(false)}
            className="cursor-pointer border-0 bg-transparent p-0 text-[13px] text-washed-white underline hover:text-orange-hover"
          >
            Close video
          </button>
        </span>
      </div>
    )
  }

  return (
    <button
      type="button"
      aria-label={`Play video: ${title}`}
      onClick={() => setPlaying(true)}
      className="relative block h-[120px] w-full flex-none cursor-pointer overflow-hidden rounded-14 border-0 bg-[radial-gradient(ellipse_at_70%_40%,#2A2A2A,#0B0B0B_70%)] p-0 text-left text-washed-white shadow-[inset_0_0_0_1px_#262626] transition-ui hover:shadow-[inset_0_0_0_1px_#3D3D3D]"
    >
      <ClubImage slug={head} className="absolute top-2 right-3 h-[104px] w-auto opacity-85" />
      <span className="absolute inset-y-0 left-4 flex w-[64%] items-center gap-3">
        <span className="flex size-[46px] flex-none items-center justify-center rounded-full bg-tiger-orange">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="#0B0B0B" aria-hidden="true">
            <path d="M7 4l13 8-13 8z" />
          </svg>
        </span>
        <span className="flex min-w-0 flex-col gap-0.5">
          <Eyebrow size={11} className="text-grey-a3">
            Video
          </Eyebrow>
          <span className="line-clamp-3 text-[14px] leading-tight font-semibold [text-shadow:0_1px_6px_#0B0B0B]">{title}</span>
        </span>
      </span>
    </button>
  )
}
