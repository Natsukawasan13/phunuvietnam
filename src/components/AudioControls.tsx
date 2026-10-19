import { Mic, Music } from 'lucide-react'

type AudioControlsProps = {
  bgmEnabled: boolean
  voiceEnabled: boolean
  voiceStatus: string
  audioNotice: string
  onToggleBgm: () => void
  onToggleVoice: () => void
}

export function AudioControls({
  bgmEnabled,
  voiceEnabled,
  voiceStatus,
  audioNotice,
  onToggleBgm,
  onToggleVoice,
}: AudioControlsProps) {
  return (
    <header className="fixed right-3 top-3 z-50 flex flex-col items-end gap-2 sm:right-6 sm:top-6">
      <div className="flex items-center gap-3">
        <div className="voice-status-pill hidden items-center gap-2 rounded-full border border-rose-200/60 bg-white/80 px-3 py-1.5 text-xs font-medium text-rose-600 shadow-sm backdrop-blur sm:flex">
          <span className="relative flex h-2 w-2">
            {voiceStatus.includes('Đang') && (
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-rose-400 opacity-75" />
            )}
            <span
              className={`relative inline-flex h-2 w-2 rounded-full ${
                voiceEnabled ? 'bg-rose-500' : 'bg-gray-400'
              }`}
            />
          </span>
          <span aria-live="polite">{voiceStatus}</span>
        </div>

        <div className="flex items-center gap-2 rounded-full border border-rose-100 bg-white/90 p-1.5 shadow-lg backdrop-blur-md">
          <button
            type="button"
            className={`audio-button group ${bgmEnabled ? 'audio-button--active' : ''}`}
            title={bgmEnabled ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
            aria-label={bgmEnabled ? 'Tắt nhạc nền' : 'Bật nhạc nền'}
            aria-pressed={bgmEnabled}
            onClick={onToggleBgm}
          >
            <Music className="h-5 w-5 transition-transform group-hover:scale-110" aria-hidden="true" />
            {!bgmEnabled && <span className="audio-slash" aria-hidden="true" />}
            <span className="audio-tooltip">Nhạc nền (12%)</span>
          </button>
          <button
            type="button"
            className={`audio-button group ${voiceEnabled ? 'audio-button--active' : ''}`}
            title={voiceEnabled ? 'Tắt giọng đọc AI' : 'Bật giọng đọc AI'}
            aria-label={voiceEnabled ? 'Tắt giọng đọc AI' : 'Bật giọng đọc AI'}
            aria-pressed={voiceEnabled}
            onClick={onToggleVoice}
          >
            <Mic className="h-5 w-5 transition-transform group-hover:scale-110" aria-hidden="true" />
            {!voiceEnabled && <span className="audio-slash" aria-hidden="true" />}
            <span className="audio-tooltip">Giọng AI</span>
          </button>
        </div>
      </div>
      {audioNotice && (
        <p
          className="max-w-64 rounded-xl border border-rose-200 bg-white/95 px-3 py-2 text-xs text-rose-700 shadow-lg"
          role="alert"
        >
          {audioNotice}
        </p>
      )}
    </header>
  )
}
