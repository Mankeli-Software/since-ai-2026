import { useState, useEffect } from 'react'
import { Play, Award, Film, Users, Sparkles, Video as VideoIcon } from 'lucide-react'
import { cn } from '@/lib/utils'
import rawProductVideos from '../../../../fixtures/product_videos.json'

export type HeadSlug = '101-mkii' | '201-mkii' | '201t-mkii' | '301-cb' | '301-mb'

export type VideoKind = 'official' | 'influencer_witb' | 'independent_review'

export interface Influencer {
  name: string
  handle: string
  channel: string
  role_or_note: string
  youtube_id: string
  video_title: string
}

export interface VideoItem {
  id: string
  youtube_id: string
  title: string
  channel: string
  creator: string
  kind: VideoKind
  start_s: number
  summary: string
}

export interface HeadVideoData {
  head: HeadSlug
  headline: string
  tagline: string
  youtube_id: string
  title: string
  hero_mp4_url: string | null
  hero_hls_url: string | null
  influencers: Influencer[]
  videos: VideoItem[]
}

const productVideos = rawProductVideos as Record<HeadSlug, HeadVideoData>

export interface ProductVideoProps {
  head: HeadSlug
  className?: string
}

export function ProductVideo({ head, className }: ProductVideoProps) {
  const data = productVideos[head] ?? productVideos['201t-mkii']
  const videos = data?.videos.filter((v) => v.kind === 'official' || v.kind === 'influencer_witb') ?? []

  const [activeYoutubeId, setActiveYoutubeId] = useState<string>(
    data?.youtube_id ?? videos[0]?.youtube_id ?? ''
  )
  const [isPlayingMp4, setIsPlayingMp4] = useState<boolean>(false)
  const [activeFilter, setActiveFilter] = useState<'all' | VideoKind>('all')

  // When head changes, reset to that head's primary video and defaults
  useEffect(() => {
    if (data) {
      const vids = data.videos.filter((v) => v.kind === 'official' || v.kind === 'influencer_witb')
      setActiveYoutubeId(data.youtube_id || vids[0]?.youtube_id || '')
      setIsPlayingMp4(false)
      setActiveFilter('all')
    }
  }, [head, data])

  if (!data) {
    return (
      <div className={cn('p-4 text-sm text-muted-foreground', className)}>
        No video data available for {head}.
      </div>
    )
  }

  const activeVideo = videos.find((v) => v.youtube_id === activeYoutubeId) ?? videos[0]

  const filteredVideos =
    activeFilter === 'all'
      ? videos
      : videos.filter((v) => v.kind === activeFilter)

  const handleSelectInfluencer = (inf: Influencer) => {
    setIsPlayingMp4(false)
    setActiveYoutubeId(inf.youtube_id)
  }

  const handleSelectVideo = (v: VideoItem) => {
    setIsPlayingMp4(false)
    setActiveYoutubeId(v.youtube_id)
  }

  const handleSelectMp4Hero = () => {
    setIsPlayingMp4(true)
  }

  const kindLabel = (kind: VideoKind) => {
    switch (kind) {
      case 'official':
        return 'Official Testing'
      case 'influencer_witb':
        return 'In The Bag'
      case 'independent_review':
        return 'Independent Review'
    }
  }

  const kindBadgeClass = (kind: VideoKind) => {
    switch (kind) {
      case 'official':
        return 'bg-tiger-orange/15 text-orange-ink border-tiger-orange/30'
      case 'influencer_witb':
        return 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30'
      case 'independent_review':
        return 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30'
    }
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-4 rounded-xl border border-border bg-card p-4 sm:p-5 text-card-foreground shadow-sm transition-all',
        className
      )}
      data-testid="product-video-card"
    >
      {/* Header with Head Info */}
      <div className="flex flex-col gap-1 border-b border-border/70 pb-3">
        <div className="flex items-center justify-between gap-2">
          <span className="font-display text-xs font-bold tracking-wider uppercase text-orange-ink">
            Takomo Video Showcase
          </span>
          <span className="text-xs font-mono font-medium text-muted-foreground uppercase">
            {head}
          </span>
        </div>
        <h3 className="font-display text-xl font-bold uppercase tracking-tight text-foreground">
          {data.headline}
        </h3>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {data.tagline}
        </p>
      </div>

      {/* Influencer Badges / "Who Plays This" */}
      {data.influencers && data.influencers.length > 0 && (
        <div className="flex flex-col gap-2 rounded-lg bg-secondary/50 p-3">
          <div className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            <Users className="size-3.5 text-tiger-orange" />
            <span>Played & Endorsed By</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.influencers.map((inf) => {
              const isSelected = !isPlayingMp4 && activeYoutubeId === inf.youtube_id
              return (
                <button
                  key={inf.name}
                  type="button"
                  onClick={() => handleSelectInfluencer(inf)}
                  className={cn(
                    'group flex items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs transition-all cursor-pointer',
                    isSelected
                      ? 'border-tiger-orange bg-tiger-orange text-white shadow-xs font-medium'
                      : 'border-border bg-background hover:border-tiger-orange/60 hover:bg-tiger-orange/5 text-foreground'
                  )}
                  title={`${inf.role_or_note} — Click to watch WITB setup`}
                >
                  <Award
                    className={cn(
                      'size-3.5 shrink-0 transition-transform group-hover:scale-110',
                      isSelected ? 'text-white' : 'text-tiger-orange'
                    )}
                  />
                  <div className="flex flex-col leading-tight">
                    <span className="font-semibold">{inf.name}</span>
                    <span
                      className={cn(
                        'text-[10px]',
                        isSelected ? 'text-white/90' : 'text-muted-foreground'
                      )}
                    >
                      {inf.channel}
                    </span>
                  </div>
                  <Play
                    className={cn(
                      'ml-1 size-3 shrink-0 opacity-70 transition-opacity group-hover:opacity-100',
                      isSelected ? 'text-white' : 'text-tiger-orange'
                    )}
                  />
                </button>
              )
            })}

            {data.hero_mp4_url && (
              <button
                type="button"
                onClick={handleSelectMp4Hero}
                className={cn(
                  'group flex items-center gap-2 rounded-full border px-3 py-1.5 text-left text-xs transition-all cursor-pointer',
                  isPlayingMp4
                    ? 'border-tiger-orange bg-tiger-orange text-white shadow-xs font-medium'
                    : 'border-border bg-background hover:border-tiger-orange/60 hover:bg-tiger-orange/5 text-foreground'
                )}
                title="Watch official high-definition Takomo studio clip"
              >
                <Sparkles
                  className={cn(
                    'size-3.5 shrink-0',
                    isPlayingMp4 ? 'text-white' : 'text-tiger-orange'
                  )}
                />
                <span className="font-semibold">Studio Reel (HD)</span>
              </button>
            )}
          </div>
        </div>
      )}

      {/* Main Video Player Container */}
      <div className="relative aspect-video w-full overflow-hidden rounded-lg bg-black shadow-inner">
        {isPlayingMp4 && data.hero_mp4_url ? (
          <video
            src={data.hero_mp4_url}
            controls
            autoPlay
            playsInline
            className="h-full w-full object-cover"
          />
        ) : activeYoutubeId ? (
          <iframe
            src={`https://www.youtube-nocookie.com/embed/${activeYoutubeId}?rel=0`}
            title={activeVideo?.title ?? data.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowFullScreen
            className="h-full w-full border-0"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-xs text-white/60">
            No active video selected
          </div>
        )}
      </div>

      {/* Active Video Details */}
      <div className="flex flex-col gap-1.5 rounded-lg border border-border/60 bg-secondary/30 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          {isPlayingMp4 ? (
            <span className="inline-flex items-center gap-1 rounded-sm border border-tiger-orange/30 bg-tiger-orange/15 px-2 py-0.5 text-[11px] font-semibold text-orange-ink uppercase tracking-wider">
              <Film className="size-3" /> Official 4K Studio Reel
            </span>
          ) : activeVideo ? (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-sm border px-2 py-0.5 text-[11px] font-semibold uppercase tracking-wider',
                kindBadgeClass(activeVideo.kind)
              )}
            >
              <VideoIcon className="size-3" /> {kindLabel(activeVideo.kind)}
            </span>
          ) : null}

          <span className="text-[11px] text-muted-foreground font-medium">
            {isPlayingMp4 ? 'Takomo Golf Media' : activeVideo?.creator || activeVideo?.channel}
          </span>
        </div>

        <h4 className="font-sans text-sm font-bold text-foreground leading-snug">
          {isPlayingMp4 ? `${data.headline} — Official Studio Clip` : activeVideo?.title}
        </h4>

        {activeVideo?.summary && !isPlayingMp4 && (
          <p className="text-xs text-muted-foreground leading-relaxed">
            {activeVideo.summary}
          </p>
        )}
      </div>

      {/* Video Selector Tabs */}
      <div className="flex flex-col gap-2 pt-1">
        <div className="flex items-center justify-between">
          <span className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            Explore Videos ({videos.length})
          </span>
          <div className="flex items-center gap-1 rounded-md bg-secondary p-0.5 text-[11px]">
            <button
              type="button"
              onClick={() => setActiveFilter('all')}
              className={cn(
                'rounded-sm px-2 py-1 font-medium transition-all cursor-pointer',
                activeFilter === 'all'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              All
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('official')}
              className={cn(
                'rounded-sm px-2 py-1 font-medium transition-all cursor-pointer',
                activeFilter === 'official'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              Official
            </button>
            <button
              type="button"
              onClick={() => setActiveFilter('influencer_witb')}
              className={cn(
                'rounded-sm px-2 py-1 font-medium transition-all cursor-pointer',
                activeFilter === 'influencer_witb'
                  ? 'bg-background text-foreground shadow-xs'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              In The Bag
            </button>
          </div>
        </div>

        {/* Video Cards Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 max-h-72 overflow-y-auto pr-1">
          {filteredVideos.map((video) => {
            const isCurrent = !isPlayingMp4 && activeYoutubeId === video.youtube_id
            return (
              <button
                key={video.id}
                type="button"
                onClick={() => handleSelectVideo(video)}
                className={cn(
                  'group flex gap-2.5 rounded-lg border p-2 text-left transition-all cursor-pointer items-start',
                  isCurrent
                    ? 'border-tiger-orange bg-tiger-orange/10 ring-1 ring-tiger-orange/40'
                    : 'border-border/80 bg-background hover:border-tiger-orange/50 hover:bg-secondary/40'
                )}
              >
                {/* Thumbnail */}
                <div className="relative aspect-video w-24 shrink-0 overflow-hidden rounded bg-black">
                  <img
                    src={`https://img.youtube.com/vi/${video.youtube_id}/mqdefault.jpg`}
                    alt={video.title}
                    loading="lazy"
                    className="h-full w-full object-cover transition-transform group-hover:scale-105"
                  />
                  <div className="absolute inset-0 flex items-center justify-center bg-black/25 opacity-0 transition-opacity group-hover:opacity-100">
                    <Play className="size-4 fill-white text-white drop-shadow-sm" />
                  </div>
                  {isCurrent && (
                    <div className="absolute bottom-1 right-1 rounded bg-tiger-orange px-1 py-0.2 text-[9px] font-bold text-white uppercase tracking-wider">
                      Playing
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="flex min-w-0 flex-1 flex-col justify-between self-stretch">
                  <div className="flex flex-col gap-0.5">
                    <span
                      className={cn(
                        'text-[10px] font-semibold uppercase tracking-wider',
                        video.kind === 'official'
                          ? 'text-orange-ink'
                          : video.kind === 'influencer_witb'
                          ? 'text-amber-600 dark:text-amber-400'
                          : 'text-blue-600 dark:text-blue-400'
                      )}
                    >
                      {kindLabel(video.kind)}
                    </span>
                    <p className="line-clamp-2 text-xs font-semibold leading-snug text-foreground group-hover:text-orange-ink transition-colors">
                      {video.title}
                    </p>
                  </div>
                  <span className="text-[10px] text-muted-foreground truncate font-medium">
                    {video.creator || video.channel}
                  </span>
                </div>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
