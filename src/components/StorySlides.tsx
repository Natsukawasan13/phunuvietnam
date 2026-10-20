import { useCallback, useEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import longAvatar from '../assets/avatar/long.jpg'
import tuanAvatar from '../assets/avatar/tuan.jpg'
import longVideoUrl from '../assets/video/x1.mp4?url'
import tuanVideoUrl from '../assets/video/x2.mp4?url'
import ReactionPanel from './ReactionPanel'
import {
  createMockReactionState,
  type ReactionKind,
  type ReactionState,
  type ReactionThread,
} from './reactionData'
import {
  AlertCircle,
  ArrowLeft,
  Bot,
  Flower2,
  Gift,
  Headphones,
  Heart,
  Mail,
  MailOpen,
  PartyPopper,
  Rocket,
  RotateCcw,
  Scroll,
  Sparkles,
  Volume2,
  Video,
  X,
} from 'lucide-react'

type StorySlidesProps = {
  step: number
  interactionEnabled: boolean
  recipientName: string
  recipientInput: string
  recipientInputRef: RefObject<HTMLInputElement | null>
  nameError: 'required' | 'not-listed' | null
  onGoToStep: (step: number) => void
  onExplore: () => void
  onRecipientInputChange: (value: string) => void
  onConfirmRecipient: () => void
  onOpenGift: () => void
  giftOpening: boolean
  letterAuthor: 'Long' | 'Tuấn' | null
  onChooseLetter: (author: 'Long' | 'Tuấn') => void
  onAvatarShown: () => void
  onReplayAvatarVoice: () => void
  onRestart: () => void
  onCelebrate: () => void
}

type CardProps = {
  children: ReactNode
}

function Card({ children }: CardProps) {
  return (
    <section className="slide-step active w-full text-center" aria-live="polite">
      <div className="glass-card relative flex w-full flex-col items-center overflow-hidden rounded-3xl p-7 sm:p-12">
        {children}
      </div>
    </section>
  )
}

type BackButtonProps = {
  step: number
  interactionEnabled: boolean
  label?: string
  onGoToStep: (step: number) => void
}

function BackButton({
  step,
  interactionEnabled,
  label = 'Trước đó',
  onGoToStep,
}: BackButtonProps) {
  return (
    <button
      type="button"
      className="secondary-button"
      disabled={!interactionEnabled}
      onClick={() => onGoToStep(step)}
    >
      <ArrowLeft className="h-4 w-4" aria-hidden="true" />
      <span>{label}</span>
    </button>
  )
}

type PrimaryButtonProps = {
  interactionEnabled: boolean
  children: ReactNode
  onClick: () => void
  icon: ReactNode
}

function PrimaryButton({ children, interactionEnabled, onClick, icon }: PrimaryButtonProps) {
  return (
    <button
      type="button"
      className="primary-button"
      disabled={!interactionEnabled}
      onClick={onClick}
    >
      <span>{children}</span>
      {icon}
    </button>
  )
}

type LetterVideoModalProps = {
  author: 'Long' | 'Tuấn'
  onClose: () => void
}

function LetterVideoModal({ author, onClose }: LetterVideoModalProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [videoError, setVideoError] = useState(false)
  const videoUrl = author === 'Long' ? longVideoUrl : tuanVideoUrl

  useEffect(() => {
    const video = videoRef.current
    if (!video) return

    void video.play().catch(() => setVideoError(true))
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKeyDown)

    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      video.pause()
      video.currentTime = 0
    }
  }, [onClose])

  return (
    <div className="letter-video-overlay">
      <section
        className="letter-video-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Video đính kèm tâm thư của ${author}`}
      >
        <button
          type="button"
          className="letter-video-close"
          onClick={onClose}
          aria-label="Đóng video"
        >
          <X className="h-5 w-5" aria-hidden="true" />
        </button>
        <video
          ref={videoRef}
          className="letter-video-player"
          src={videoUrl}
          controls
          autoPlay
          playsInline
          onEnded={onClose}
          onError={() => setVideoError(true)}
        >
          Trình duyệt của bạn không hỗ trợ phát video.
        </video>
        {videoError && (
          <p className="mt-3 text-center text-sm text-rose-100" role="alert">
            Không thể tự phát video. Hãy kiểm tra file hoặc nhấn nút phát trên trình phát.
          </p>
        )}
      </section>
    </div>
  )
}

function StorySlides({
  step,
  interactionEnabled,
  recipientName,
  recipientInput,
  recipientInputRef,
  nameError,
  onGoToStep,
  onExplore,
  onRecipientInputChange,
  onConfirmRecipient,
  onOpenGift,
  giftOpening,
  letterAuthor,
  onChooseLetter,
  onAvatarShown,
  onReplayAvatarVoice,
  onRestart,
  onCelebrate,
}: StorySlidesProps) {
  const [selectedFounder, setSelectedFounder] = useState<'Long' | 'Tuấn' | null>(null)
  const [videoOpen, setVideoOpen] = useState(false)
  const [reactionThreads, setReactionThreads] = useState<Record<ReactionThread, ReactionState>>(() => ({
    'avatar-Long': createMockReactionState('avatar-Long'),
    'avatar-Tuấn': createMockReactionState('avatar-Tuấn'),
    celebration: createMockReactionState('celebration'),
    'letter-Long': createMockReactionState('letter-Long'),
    'letter-Tuấn': createMockReactionState('letter-Tuấn'),
  }))
  const closeVideo = useCallback(() => setVideoOpen(false), [])
  const selectedAvatar = selectedFounder === 'Long' ? longAvatar : tuanAvatar
  const updateReactionThread = (thread: ReactionThread, update: (current: ReactionState) => ReactionState) => {
    setReactionThreads((current) => ({
      ...current,
      [thread]: update(current[thread]),
    }))
  }
  const renderReactionPanel = (thread: ReactionThread, title: string) => (
    <ReactionPanel
      title={title}
      state={reactionThreads[thread]}
      onReact={(kind: ReactionKind) => updateReactionThread(thread, (current) => ({
        ...current,
        counts: { ...current.counts, [kind]: current.counts[kind] + 1 },
      }))}
      onComment={(text) => updateReactionThread(thread, (current) => ({
        ...current,
        comments: [...current.comments, { author: 'Bạn', text }],
      }))}
    />
  )

  switch (step) {
    case 1:
      return (
        <Card>
          <div className="mb-6 flex h-16 w-16 animate-float-slow items-center justify-center rounded-full bg-rose-100 text-rose-500 shadow-inner">
            <Heart className="h-8 w-8 fill-rose-500/30" aria-hidden="true" />
          </div>
          <span className="mb-4 inline-block rounded-full border border-rose-200 bg-rose-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-widest text-rose-600 shadow-sm">
            Ngày Phụ Nữ Việt Nam • 20 Tháng 10
          </span>
          <h1 className="mb-4 font-script text-4xl font-bold leading-tight text-rose-600 drop-shadow-sm sm:text-6xl">
            Gửi Một Nửa Dịu Dàng Của Thế Giới
          </h1>
          <p className="mb-8 max-w-xl text-base leading-relaxed text-gray-600 sm:text-lg">
            Mỗi khoảnh khắc bạn hiện diện đều điểm tô cho cuộc sống thêm ngát hương. Chúng mình đã chuẩn bị một hành trình nhỏ ngày hôm nay bạn nhé.
          </p>
          <PrimaryButton
            interactionEnabled={interactionEnabled}
            onClick={onExplore}
            icon={<Sparkles className="h-4 w-4 transition-transform group-hover:rotate-12" aria-hidden="true" />}
          >
            Khám phá ngay
          </PrimaryButton>
        </Card>
      )
    case 2:
      return (
        <Card>
          <div className="relative mb-6">
            <div className="flex h-24 w-24 animate-pulse-soft items-center justify-center rounded-full bg-gradient-to-tr from-rose-200 to-pink-100 text-rose-600 shadow-md">
              <Headphones className="h-12 w-12" aria-hidden="true" />
            </div>
            <div className="absolute -right-1 -top-1 flex h-8 w-8 animate-bounce items-center justify-center rounded-full bg-rose-500 text-xs text-white shadow">
              ❤️
            </div>
          </div>
          <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-500">
            Lời Nhắn Nhỏ Dành Cho Bạn
          </span>
          <h2 className="mb-4 text-2xl font-bold text-gray-800 sm:text-3xl">
            Hãy Đeo Tai Nghe &amp; Bật Âm Lượng Nhé
          </h2>
          <p className="mb-8 max-w-lg text-base leading-relaxed text-gray-600">
            Để cảm nhận trọn vẹn từng giai điệu ngọt ngào cùng lời dẫn lối ấm áp từ giọng đọc AI, hãy chuẩn bị một chiếc tai nghe hoặc bật âm lượng vừa đủ nghe 🎧❤️
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <BackButton
              step={1}
              interactionEnabled={interactionEnabled}
              label="Quay lại"
              onGoToStep={onGoToStep}
            />
            <PrimaryButton
              interactionEnabled={interactionEnabled}
              onClick={() => onGoToStep(3)}
              icon={<Rocket className="h-4 w-4" aria-hidden="true" />}
            >
              Đã sẵn sàng
            </PrimaryButton>
          </div>
        </Card>
      )
    case 3:
      return (
        <div className={`intro-stage${selectedFounder ? ' intro-stage--founder-selected' : ''}`}>
          <aside
            id="founder-avatars"
            className="founder-avatar-panel"
            role="region"
            aria-label={selectedFounder ? `Avatar của ${selectedFounder}` : 'Avatar người được chọn'}
            aria-live="polite"
            hidden={!selectedFounder}
          >
            {selectedFounder && (
              <>
                <img
                  className="founder-avatar-photo"
                  src={selectedAvatar}
                  alt={`Avatar của ${selectedFounder}`}
                />
                <span className="founder-avatar__name">{selectedFounder}</span>
                {renderReactionPanel(`avatar-${selectedFounder}`, `Cảm xúc về ${selectedFounder}`)}
                <button
                  type="button"
                  className="avatar-replay-button"
                  aria-label="Phát lại lời giới thiệu avatar"
                  onClick={onReplayAvatarVoice}
                >
                  <Volume2 className="h-4 w-4" aria-hidden="true" />
                  Nghe lại
                </button>
              </>
            )}
          </aside>
          <Card>
            <div className="relative mb-6">
              <div className="absolute inset-0 animate-pulse rounded-full bg-rose-400/20 blur-xl" />
              <div className="relative flex h-24 w-24 items-center justify-center rounded-full border-4 border-white/80 bg-gradient-to-b from-rose-400 to-rose-600 text-white shadow-xl">
                <Bot className="h-12 w-12" aria-hidden="true" />
              </div>
              <span className="absolute bottom-0 right-0 rounded-full border-2 border-white bg-emerald-500 px-2 py-0.5 text-[10px] font-bold text-white shadow">
                ONLINE
              </span>
            </div>
            <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-500">
              Người Bạn Đồng Hành
            </span>
            <h2 className="mb-4 text-2xl font-bold text-gray-800 sm:text-3xl">
              Xin Chào, Mình Là Trợ Lý AI 20/10
            </h2>
            <div className="intro-layout mb-8">
              <div className="intro-quote rounded-2xl border border-rose-100 bg-rose-50/70 p-5 text-left shadow-sm">
                <p className="text-sm leading-relaxed text-gray-700 sm:text-base">
                  <span className="mr-1 font-script text-xl font-semibold text-rose-500">"</span>
                  Tôi là một mô hình AI được tạo ra dựa trên dữ liệu tính cách của{' '}
                  <button
                    type="button"
                    className="founder-name"
                    disabled={!interactionEnabled}
                    aria-expanded={selectedFounder === 'Long'}
                    aria-controls="founder-avatars"
                    onClick={() => {
                      setSelectedFounder((selected) => (selected === 'Long' ? null : 'Long'))
                      onAvatarShown()
                    }}
                  >
                    Long
                  </button>{' '}
                  và{' '}
                  <button
                    type="button"
                    className="founder-name"
                    disabled={!interactionEnabled}
                    aria-expanded={selectedFounder === 'Tuấn'}
                    aria-controls="founder-avatars"
                    onClick={() => {
                      setSelectedFounder((selected) => (selected === 'Tuấn' ? null : 'Tuấn'))
                      onAvatarShown()
                    }}
                  >
                    Tuấn
                  </button>{' '}
                  và hôm nay tôi được hai thằng đó giao nhiệm vụ đồng hành cùng bạn để tạo ra 1 kỷ niệm ngày 20 tháng 10 đáng nhớ
                  <span className="ml-1 font-script text-xl font-semibold text-rose-500">"</span>
                </p>
                <p className="mt-3 text-xs font-medium text-rose-500" aria-live="polite">
                  Gợi ý: nhấn vào tên Long hoặc Tuấn để xem avatar nhé!
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <BackButton
                step={2}
                interactionEnabled={interactionEnabled}
                onGoToStep={onGoToStep}
              />
              <PrimaryButton
                interactionEnabled={interactionEnabled}
                onClick={() => onGoToStep(4)}
                icon={<Mail className="h-4 w-4" aria-hidden="true" />}
              >
                Tiếp tục
              </PrimaryButton>
            </div>
          </Card>
        </div>
      )
    case 4:
      return (
        <Card>
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-rose-100 text-rose-500 shadow-sm">
            <Gift className="h-8 w-8" aria-hidden="true" />
          </div>
          <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-rose-500">
            Cá Nhân Hóa Món Quà
          </span>
          <h2 className="mb-2 text-2xl font-bold text-gray-800 sm:text-3xl">
            Món Quà Này Dành Tặng Cho Ai?
          </h2>
          <p className="mx-auto mb-6 max-w-md text-sm text-gray-600">
            Hãy nhập tên của bạn vào ô bên dưới nhé!
          </p>
          {/* <p className="-mt-4 mb-5 text-xs font-medium text-rose-500">
            Tên hợp lệ: Nguyên
          </p> */}
          <div className="mb-8 flex w-full max-w-md flex-col items-center">
            <label htmlFor="recipient-name" className="sr-only">
              Tên người nhận
            </label>
            <div className="relative w-full">
              <Heart className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-rose-400" aria-hidden="true" />
              <input
                id="recipient-name"
                ref={recipientInputRef}
                type="text"
                disabled={!interactionEnabled}
                placeholder="Nhập tên của bạn hoặc người ấy..."
                value={recipientInput}
                aria-invalid={nameError !== null}
                aria-describedby={nameError ? 'name-error' : undefined}
                className="w-full rounded-full border-2 border-rose-200 bg-white/90 py-3.5 pl-12 pr-4 text-base font-medium text-gray-800 shadow-inner transition-all placeholder:text-gray-400 focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-100"
                onChange={(event) => onRecipientInputChange(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') onConfirmRecipient()
                }}
              />
            </div>
            {nameError && (
              <p id="name-error" className="mt-2 flex items-center gap-1 text-xs font-medium text-rose-500" role="alert">
                <AlertCircle className="h-3.5 w-3.5" aria-hidden="true" />
                {nameError === 'not-listed'
                  ? 'tên không có trong danh sách'
                  : 'Vui lòng nhập tên người nhận trước khi tiếp tục nha ❤️'}
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <BackButton
              step={3}
              interactionEnabled={interactionEnabled}
              onGoToStep={onGoToStep}
            />
            <PrimaryButton
              interactionEnabled={interactionEnabled}
              onClick={onConfirmRecipient}
              icon={<Gift className="h-4 w-4" aria-hidden="true" />}
            >
              Xác nhận &amp; Nhận quà
            </PrimaryButton>
          </div>
        </Card>
      )
    case 5:
      return (
        <Card>
          <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-500">
            Một Món Quà Đang Chờ Bạn
          </span>
          <h2 className="mb-3 text-2xl font-bold text-gray-800 sm:text-3xl">
            Sẵn sàng mở quà chưa, <span className="text-rose-600">{recipientName}</span>?
          </h2>
          <p className="mb-8 max-w-lg text-base leading-relaxed text-gray-600">
            Nhấn vào hộp quà để khám phá lời chúc đặc biệt dành riêng cho bạn.
          </p>
          <button
            type="button"
            className={`gift-open-button mb-8${giftOpening ? ' gift-open-button--opening' : ''}`}
            disabled={!interactionEnabled || giftOpening}
            onClick={onOpenGift}
            aria-label="Mở hộp quà"
          >
            <span className="gift-box" aria-hidden="true">
              <span className="gift-box__lid" />
              <span className="gift-box__ribbon" />
              <Gift className="gift-box__icon" />
            </span>
          </button>
          <p className="mb-6 text-sm font-medium text-rose-500" aria-live="polite">
            {giftOpening ? 'Món quà đang được mở...' : 'Chạm vào hộp quà để mở'}
          </p>
          <BackButton
            step={4}
            interactionEnabled={interactionEnabled && !giftOpening}
            onGoToStep={onGoToStep}
          />
        </Card>
      )
    case 6:
      return (
        <Card>
          <span className="mb-4 inline-block animate-bounce rounded-full bg-rose-100 px-4 py-1.5 text-xs font-bold uppercase tracking-wider text-rose-700">
            🎉 Chúc Mừng 20/10 Rực Rỡ 🎉
          </span>
          <h2 className="mb-3 font-script text-3xl font-bold leading-tight text-rose-600 sm:text-5xl">
            Chúc Mừng Ngày 20/10, <br />
            <span className="recipient-name">{recipientName}</span>!
          </h2>
          <p className="mb-6 max-w-xl text-base leading-relaxed text-gray-700 sm:text-lg">
            Chúc bạn một ngày 20/10 luôn rạng rỡ như ánh mai, ngọt ngào như đóa hồng và luôn được bao bọc trong niềm vui!
          </p>
          <div className="mb-8 grid w-full max-w-xl grid-cols-1 gap-3 sm:grid-cols-2">
            <div className="wish-card">
              <span className="mb-1 text-2xl">🌸</span>
              <span className="text-xs font-bold text-gray-800">Xinh Đẹp &amp; An Yên</span>
              <span className="mt-0.5 text-center text-[11px] text-gray-500">Tươi tắn mỗi sớm mai</span>
            </div>
            <div className="wish-card">
              <span className="mb-1 text-2xl">✨</span>
              <span className="text-xs font-bold text-gray-800">Tự Tin &amp; Tỏa Sáng</span>
              <span className="mt-0.5 text-center text-[11px] text-gray-500">Chinh phục mọi ước mơ</span>
            </div>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <BackButton
              step={5}
              interactionEnabled={interactionEnabled}
              onGoToStep={onGoToStep}
            />
            <PrimaryButton
              interactionEnabled={interactionEnabled}
              onClick={() => onGoToStep(7)}
              icon={<Scroll className="h-4 w-4" aria-hidden="true" />}
            >
              Đọc tâm thư cá nhân
            </PrimaryButton>
          </div>
          {renderReactionPanel('celebration', 'Cảm xúc về lời chúc')}
        </Card>
      )
    case 7:
      return (
        <Card>
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-600 shadow-sm">
            <Mail className="h-8 w-8" aria-hidden="true" />
          </div>
          <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-rose-500">
            Một Lời Nhắn Riêng Dành Cho Bạn
          </span>
          <h2 className="mb-4 text-2xl font-bold text-gray-800 sm:text-3xl">
            Chọn tâm thư muốn đọc
          </h2>
          <p className="mb-7 max-w-lg text-sm leading-relaxed text-gray-600">
            Long và Tuấn đều có vài lời muốn gửi đến {recipientName}. Hãy chọn một tâm thư nhé.
          </p>
          <div className="mb-8 grid w-full max-w-xl grid-cols-1 gap-4 sm:grid-cols-2">
            {(['Long', 'Tuấn'] as const).map((author) => (
              <button
                key={author}
                type="button"
                className="letter-choice"
                disabled={!interactionEnabled}
                onClick={() => onChooseLetter(author)}
              >
                <MailOpen className="h-8 w-8 text-rose-500" aria-hidden="true" />
                <span className="font-semibold text-gray-800">Tâm thư của {author}</span>
                <span className="text-xs text-gray-500">Nhấn để mở lời nhắn</span>
              </button>
            ))}
          </div>
          <BackButton step={6} interactionEnabled={interactionEnabled} onGoToStep={onGoToStep} />
        </Card>
      )
    case 8:
      return (
        <Card>
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full border border-amber-200 bg-amber-50 text-amber-600 shadow-sm">
            <MailOpen className="h-8 w-8" aria-hidden="true" />
          </div>
          <span className="mb-1 text-xs font-semibold uppercase tracking-wider text-rose-500">
            Tâm Thư Của {letterAuthor ?? 'Long'}
          </span>
          <h2 className="mb-4 text-2xl font-bold text-gray-800 sm:text-3xl">
            Gửi riêng <span className="text-rose-600">{recipientName}</span>
          </h2>
          <div className="relative mb-8 w-full max-w-xl rounded-2xl border-2 border-[#f3e8d2] bg-[#fffef9] p-6 text-left shadow-md sm:p-8">
            <div className="absolute right-4 top-4 flex h-14 w-12 rotate-6 flex-col items-center justify-center rounded border-2 border-dashed border-rose-300 opacity-80">
              <span className="text-[9px] font-bold text-rose-400">20.10</span>
              <Flower2 className="h-4 w-4 text-rose-400" aria-hidden="true" />
            </div>
            <p className="mb-3 pr-12 font-script text-2xl font-bold text-rose-600">
              {letterAuthor === 'Tuấn' ? 'Gửi bạn bằng tất cả sự chân thành,' : 'Gửi người bạn đặc biệt,'}
            </p>
            <div className="space-y-3 text-sm leading-relaxed text-gray-700 sm:text-base">
              {letterAuthor === 'Tuấn' ? (
                <>
                  <p>
                    Nhân ngày 20/10, Tuấn muốn gửi bạn lời cảm ơn vì đã luôn mang đến sự ấm áp và những nụ cười cho mọi người xung quanh. Mong rằng hôm nay bạn sẽ nhận được thật nhiều niềm vui và những điều dễ thương.
                  </p>
                  <p>
                    Hãy luôn tin vào bản thân, dành thời gian chăm sóc chính mình và đừng quên rằng bạn xứng đáng với những điều tốt đẹp nhất.
                  </p>
                  <p className="pt-2 font-medium text-gray-800">
                    Chúc bạn một ngày 20/10 thật vui, bình yên và đáng nhớ!
                  </p>
                </>
              ) : (
                <>
                  <p>
                    Long chúc bạn luôn giữ được nụ cười tươi và sự tự tin của mình. Cảm ơn bạn đã làm cho những khoảnh khắc quanh mình trở nên vui vẻ và đáng nhớ hơn.
                  </p>
                  <p>
                    Dù ngày nào cũng bận rộn, hãy nhớ dành một chút thời gian cho bản thân, làm điều mình thích và tự hào về những gì bạn đã cố gắng. Và đừng quan tâm những ánh nhìn của người khác về bạn, đừng sống dưới ánh nhìn và suy nghĩ của người khác
                  </p>
                  <p className="pt-2 font-medium text-gray-800">
                    Chúc bạn luôn gặp nhiều may mắn, niềm vui và có một ngày 20/10 thật rực rỡ!
                  </p>
                </>
              )}
            </div>
            <div className="mt-6 text-right font-script text-2xl text-rose-600">
              {letterAuthor === 'Tuấn' ? 'Thân mến Tuấn hay nói' : 'Thân mến Long đại ca'} ❤️
            </div>
          </div>
          <button
            type="button"
            className="secondary-button mb-8"
            disabled={!interactionEnabled}
            onClick={() => setVideoOpen(true)}
          >
            <Video className="h-4 w-4" aria-hidden="true" />
            <span>Mở video đính kèm</span>
          </button>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <BackButton step={7} interactionEnabled={interactionEnabled} onGoToStep={onGoToStep} />
            <PrimaryButton
              interactionEnabled={interactionEnabled}
              onClick={() => onGoToStep(9)}
              icon={<Sparkles className="h-4 w-4" aria-hidden="true" />}
            >
              Lời kết
            </PrimaryButton>
          </div>
          {letterAuthor && renderReactionPanel(`letter-${letterAuthor}`, `Cảm xúc về tâm thư của ${letterAuthor}`)}
          {videoOpen && letterAuthor && (
            <LetterVideoModal author={letterAuthor} onClose={closeVideo} />
          )}
        </Card>
      )
    case 9:
      return (
        <Card>
          <div className="mb-6 flex h-20 w-20 animate-heart-beat items-center justify-center rounded-full bg-rose-100 text-rose-500 shadow">
            <Heart className="h-10 w-10 fill-rose-500" aria-hidden="true" />
          </div>
          <span className="mb-2 text-xs font-semibold uppercase tracking-wider text-rose-500">
            Trọn Vẹn Yêu Thương
          </span>
          <h2 className="mb-4 font-script text-3xl font-bold text-rose-600 sm:text-5xl">
            Happy Vietnamese Women&apos;s Day!
          </h2>
          <p className="mx-auto mb-8 max-w-lg text-base leading-relaxed text-gray-600 sm:text-lg">
            Cảm ơn bạn đã lắng nghe và cùng đi qua hành trình 20/10 ý nghĩa này. Chúc bạn một ngày ngập tràn hoa, quà và những tiếng cười rộn rã bên những người thân yêu nhất!
          </p>
          <div className="flex flex-col items-center gap-4 sm:flex-row">
            <button
              type="button"
              className="restart-button"
              disabled={!interactionEnabled}
              onClick={onRestart}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span>Xem lại từ đầu 🔄</span>
            </button>
            <button
              type="button"
              className="primary-button"
              disabled={!interactionEnabled}
              onClick={onCelebrate}
            >
              <PartyPopper className="h-4 w-4" aria-hidden="true" />
              <span>Bắn pháo hoa 🎆</span>
            </button>
          </div>
        </Card>
      )
    default:
      return null
  }
}

export default StorySlides
