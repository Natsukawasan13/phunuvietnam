import { useCallback, useEffect, useRef, useState } from 'react'
import confetti from 'canvas-confetti'
import { CalendarDays, Volume2 } from 'lucide-react'
import bamtenAudioUrl from './assets/audio/bamten.mp3?url'
import chaoAudioUrl from './assets/audio/chao.mp3?url'
import gioithieuAudioUrl from './assets/audio/gioithieu.mp3?url'
import gioithieu2AudioUrl from './assets/audio/gioithieu2.mp3?url'
import huongdanAudioUrl from './assets/audio/huongdan.mp3?url'
import xinphepAudioUrl from './assets/audio/xinphep.mp3?url'
import lailamayAudioUrl from './assets/audio/lailamay.mp3?url'
import layanhAudioUrl from './assets/audio/layanh.mp3?url'
import nhaptenAudioUrl from './assets/audio/nhapten.mp3?url'
import saitenAudioUrl from './assets/audio/saiten.mp3?url'
import mohopquaAudioUrl from './assets/audio/mohopqua.mp3?url'
import loichucaiAudioUrl from './assets/audio/loichucai.mp3?url'
import luachonAudioUrl from './assets/audio/luachon.mp3?url'
import hoitamthuAudioUrl from './assets/audio/hoitamthu.mp3?url'
import longAudioUrl from './assets/audio/long.mp3?url'
import tuanAudioUrl from './assets/audio/tuan.mp3?url'
import endAudioUrl from './assets/audio/end.mp3?url'
import nhacendAudioUrl from './assets/audio/nhacend.mp3?url'
import nhacnenAudioUrl from './assets/audio/nhacnen.mp3?url'
import PetalCanvas from './components/PetalCanvas'
import ScreenRecorder from './components/ScreenRecorder'
import StorySlides from './components/StorySlides'
import { AudioControls } from './components/AudioControls'
import { StepProgress } from './components/StepProgress'
import { getConsentStorageKey, hasTelemetryConsent, trackVisitorEvent } from './services/telemetry'

const allowedRecipients = ['Nhi', 'Nguyên', 'Nguyễn Thảo Nguyên', 'Thảo Nguyên', 'Đoan', 'Ngô Thục Đoan', 'Thục Đoan', 'Trang', 'Vy', 'Ngân', 'Hường', 'Hương', 'Khanh', 'Hạnh', 'Út Hạnh', 'Thư', 'My', 'Thu']
const stepAudio: Record<number, { url: string; name: string; status: string }> = {
  1: { url: chaoAudioUrl, name: 'chao.mp3', status: 'Voice AI: Đang phát lời chào...' },
  2: { url: huongdanAudioUrl, name: 'huongdan.mp3', status: 'Voice AI: Đang phát hướng dẫn...' },
  4: { url: nhaptenAudioUrl, name: 'nhapten.mp3', status: 'Voice AI: Đang phát yêu cầu nhập tên...' },
  5: { url: mohopquaAudioUrl, name: 'mohopqua.mp3', status: 'Voice AI: Đang phát lời mời mở quà...' },
  6: { url: loichucaiAudioUrl, name: 'loichucai.mp3', status: 'Voice AI: Đang phát lời chúc...' },
  7: { url: luachonAudioUrl, name: 'luachon.mp3', status: 'Voice AI: Đang phát lời mời chọn tâm thư...' },
  8: { url: hoitamthuAudioUrl, name: 'hoitamthu.mp3', status: 'Voice AI: Đang hỏi có muốn nghe tâm thư...' },
  9: { url: endAudioUrl, name: 'end.mp3', status: 'Voice AI: Đang phát lời kết...' },
}
const letterAudio: Record<'Long' | 'Tuấn', { url: string; name: string }> = {
  Long: { url: longAudioUrl, name: 'long.mp3' },
  Tuấn: { url: tuanAudioUrl, name: 'tuan.mp3' },
}

const getVoiceScript = (step: number, recipientName: string) => {
  const scripts: Record<number, string> = {
    2: 'Để có trải nghiệm cảm xúc và âm thanh sống động nhất, bạn hãy đeo tai nghe và bật âm lượng vừa đủ nghe nha.',
    3: 'Xin chào! Mình là trợ lý AI, người sẽ đồng hành và gửi gắm những lời chúc ngọt ngào nhất đến bạn hôm nay.',
    4: 'Hãy cho mình biết tên của bạn hoặc người mà bạn muốn gửi tặng món quà này nhé.',
    6: `Chúc mừng ngày phụ nữ Việt Nam 20 tháng 10, ${recipientName}! Chúc bạn luôn rạng rỡ, xinh đẹp và ngập tràn hạnh phúc!`,
    9: 'Cảm ơn bạn đã đồng hành. Chúc bạn một ngày 20 tháng 10 thật trọn vẹn và nhiều niềm vui!',
  }

  return scripts[step]
}

function App() {
  const [telemetryConsent, setTelemetryConsent] = useState<'pending' | 'granted' | 'declined'>(() => {
    const savedConsent = window.localStorage.getItem(getConsentStorageKey())
    if (savedConsent === 'declined') return 'declined'
    return hasTelemetryConsent() ? 'granted' : 'pending'
  })
  const [privacyDialogOpen, setPrivacyDialogOpen] = useState(telemetryConsent === 'pending')
  const [consentError, setConsentError] = useState('')
  const [consentSaving, setConsentSaving] = useState(false)
  const [step, setStep] = useState(1)
  const [recipientName, setRecipientName] = useState('')
  const [letterAuthor, setLetterAuthor] = useState<'Long' | 'Tuấn' | null>(null)
  const [recipientInput, setRecipientInput] = useState('')
  const [nameError, setNameError] = useState<'required' | 'not-listed' | null>(null)
  const [voiceEnabled, setVoiceEnabled] = useState(true)
  const [interactionEnabled, setInteractionEnabled] = useState(false)
  const [voiceStatus, setVoiceStatus] = useState('Voice AI: Sẵn sàng')
  const [bgmEnabled, setBgmEnabled] = useState(true)
  const [bgmAudio] = useState(() => {
    const audio = new Audio(nhacnenAudioUrl)
    audio.loop = false
    audio.volume = 0.12
    return audio
  })
  const [audioNotice, setAudioNotice] = useState('')
  const [giftOpening, setGiftOpening] = useState(false)
  const [letterVoicePlaying, setLetterVoicePlaying] = useState(false)
  const [letterPromptDismissed, setLetterPromptDismissed] = useState(false)
  const [finalPromptDismissed, setFinalPromptDismissed] = useState(false)
  const [finalPromptVisible, setFinalPromptVisible] = useState(false)
  const [screenRecorderPromptVisible, setScreenRecorderPromptVisible] = useState(false)
  const [birthdayDate, setBirthdayDate] = useState('')
  const [birthdayFeedback, setBirthdayFeedback] = useState('')
  const [birthdaySubmitted, setBirthdaySubmitted] = useState(false)
  const currentStepAudio = useRef<HTMLAudioElement | null>(null)
  const audioDelay = useRef<number | null>(null)
  const giftOpenTimer = useRef<number | null>(null)
  const giftOpeningRef = useRef(false)
  const audioSequence = useRef(0)
  const speechActive = useRef(false)
  const bgmRestarting = useRef(false)
  const avatarVoicePlayed = useRef(false)
  const avatarVoiceScheduled = useRef(false)
  const bgmEnabledRef = useRef(true)
  const recipientInputRef = useRef<HTMLInputElement>(null)
  const screenRecorderReady = useRef(false)
  const screenIntroductionComplete = useRef(false)
  const handleScreenRecorderReady = useCallback(() => {
    screenRecorderReady.current = true
    setScreenRecorderPromptVisible(false)
    if (screenIntroductionComplete.current) setInteractionEnabled(true)
  }, [])
  const chooseTelemetryConsent = async (consent: 'granted' | 'declined') => {
    setConsentSaving(true)
    setConsentError('')
    try {
      const response = await fetch('/api/consent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ granted: consent === 'granted' }),
      })
      if (!response.ok && consent === 'granted') {
        throw new Error('Không thể lưu lựa chọn quyền riêng tư lên máy chủ. Hãy thử lại.')
      }
    } catch (error) {
      if (consent === 'granted') {
        setConsentError(error instanceof Error ? error.message : 'Không thể lưu lựa chọn quyền riêng tư.')
        setConsentSaving(false)
        return
      }
      console.error('Could not revoke telemetry consent:', error)
    }
    const storedConsent = consent === 'granted'
      ? `granted:${Date.now() + 365 * 24 * 60 * 60 * 1000 - 60_000}`
      : consent
    window.localStorage.setItem(getConsentStorageKey(), storedConsent)
    setTelemetryConsent(consent)
    setPrivacyDialogOpen(false)
    setConsentSaving(false)
    if (consent === 'granted') {
      void trackVisitorEvent({
        eventType: 'privacy_consent_granted',
        pageStep: step,
        target: 'privacy-consent',
        details: { consentVersion: 1 },
      })
      if (step === 1 && screenIntroductionComplete.current && !screenRecorderReady.current) {
        setScreenRecorderPromptVisible(true)
        setInteractionEnabled(false)
      }
    } else {
      screenRecorderReady.current = true
      setScreenRecorderPromptVisible(false)
      if (step === 1 && screenIntroductionComplete.current) setInteractionEnabled(true)
    }
  }

  useEffect(() => {
    if (telemetryConsent !== 'granted') return

    const captureClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null
      const clicked = target?.closest<HTMLElement>('button, a, [role="button"], select, input[type="checkbox"], input[type="radio"]')
        ?? (target instanceof HTMLElement ? target : null)
      if (!clicked || clicked.closest('[data-no-telemetry]')) return
      const label = clicked.getAttribute('aria-label')
        || clicked.innerText.trim()
        || clicked.getAttribute('title')
        || clicked.id
        || clicked.tagName.toLowerCase()
      void trackVisitorEvent({
        eventType: 'click',
        pageStep: step,
        target: label.trim().slice(0, 200),
        details: {
          element: clicked.tagName.toLowerCase(),
          id: clicked.id || null,
          href: clicked instanceof HTMLAnchorElement ? clicked.href : null,
          x: Math.round(event.clientX),
          y: Math.round(event.clientY),
        },
      })
    }
    const captureChange = (event: Event) => {
      const input = event.target
      if (!(input instanceof HTMLInputElement || input instanceof HTMLSelectElement || input instanceof HTMLTextAreaElement)) return
      if (input.closest('[data-no-telemetry]') || input.type === 'password' || input.type === 'file') return
      if (input instanceof HTMLInputElement && !['checkbox', 'radio'].includes(input.type)) return
      void trackVisitorEvent({
        eventType: 'option_selected',
        pageStep: step,
        target: input.name || input.id || input.tagName.toLowerCase(),
        details: { value: input.value, checked: input instanceof HTMLInputElement ? input.checked : null },
      })
    }
    const captureSubmit = (event: Event) => {
      const form = event.target
      if (!(form instanceof HTMLFormElement) || form.closest('[data-no-telemetry]')) return
      const values: Record<string, string | string[]> = {}
      for (const [key, value] of new FormData(form).entries()) {
        if (value instanceof File || /password|token|secret/i.test(key)) continue
        const textValue = String(value).slice(0, 4000)
        if (key in values) {
          const previous = values[key]
          values[key] = Array.isArray(previous) ? [...previous, textValue] : [previous, textValue]
        } else {
          values[key] = textValue
        }
      }
      void trackVisitorEvent({
        eventType: 'form_submitted',
        pageStep: step,
        target: form.id || form.getAttribute('aria-label') || 'form',
        details: { values },
      })
    }
    document.addEventListener('click', captureClick)
    document.addEventListener('change', captureChange)
    document.addEventListener('submit', captureSubmit)
    return () => {
      document.removeEventListener('click', captureClick)
      document.removeEventListener('change', captureChange)
      document.removeEventListener('submit', captureSubmit)
    }
  }, [step, telemetryConsent])

  useEffect(() => {
    if (telemetryConsent !== 'granted') return
    void trackVisitorEvent({
      eventType: 'page_view',
      pageStep: step,
      target: window.location.pathname,
      details: { title: document.title },
    })
  }, [step, telemetryConsent])

  useEffect(
    () => () => {
      if (audioDelay.current !== null) window.clearTimeout(audioDelay.current)
      if (giftOpenTimer.current !== null) window.clearTimeout(giftOpenTimer.current)
      currentStepAudio.current?.pause()
      if ('speechSynthesis' in window) window.speechSynthesis.cancel()
    },
    [],
  )

  useEffect(() => {
    bgmEnabledRef.current = true
    void bgmAudio.play().then(() => {
      if (bgmEnabledRef.current) setBgmEnabled(true)
    }).catch(() => {
      bgmEnabledRef.current = false
      setBgmEnabled(false)
      setAudioNotice('Trình duyệt đã chặn tự phát nhạc nền. Nhấn nút nhạc nền để bật.')
    })
  }, [bgmAudio])

  useEffect(
    () => {
      const handleAudioError = () => {
        bgmEnabledRef.current = false
        setBgmEnabled(false)
        setAudioNotice('Không thể tải nhạc nền từ nguồn âm thanh.')
      }
      const restartBeforeEnd = () => {
        if (
          bgmEnabledRef.current &&
          !bgmRestarting.current &&
          bgmAudio.duration > 1 &&
          Number.isFinite(bgmAudio.duration) &&
          bgmAudio.duration - bgmAudio.currentTime <= 1 &&
          bgmAudio.currentTime > 0
        ) {
          bgmRestarting.current = true
          bgmAudio.currentTime = 0
        }
      }
      const finishRestart = () => {
        bgmRestarting.current = false
      }
      const restartAfterEnd = () => {
        if (!bgmEnabledRef.current) return
        bgmRestarting.current = true
        bgmAudio.currentTime = 0
        void bgmAudio.play().catch(() => {
          bgmRestarting.current = false
          bgmEnabledRef.current = false
          setBgmEnabled(false)
          setAudioNotice('Không thể phát lại nhạc nền.')
        })
      }
      bgmAudio.addEventListener('error', handleAudioError)
      bgmAudio.addEventListener('timeupdate', restartBeforeEnd)
      bgmAudio.addEventListener('seeked', finishRestart)
      bgmAudio.addEventListener('ended', restartAfterEnd)
      return () => {
        bgmAudio.removeEventListener('error', handleAudioError)
        bgmAudio.removeEventListener('timeupdate', restartBeforeEnd)
        bgmAudio.removeEventListener('seeked', finishRestart)
        bgmAudio.removeEventListener('ended', restartAfterEnd)
        bgmAudio.pause()
      }
    },
    [bgmAudio],
  )

  const stopCurrentStepAudio = useCallback(() => {
    audioSequence.current += 1
    speechActive.current = false
    setLetterVoicePlaying(false)
    if (audioDelay.current !== null) {
      window.clearTimeout(audioDelay.current)
      audioDelay.current = null
      avatarVoiceScheduled.current = false
    }
    if (currentStepAudio.current) {
      currentStepAudio.current.onended = null
      currentStepAudio.current.onerror = null
      currentStepAudio.current.pause()
      currentStepAudio.current.currentTime = 0
      currentStepAudio.current = null
    }
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel()
    }
  }, [])

  const playStepAudio = useCallback((targetStep: number, name: string) => {
    stopCurrentStepAudio()
    setAudioNotice('')
    setInteractionEnabled(!voiceEnabled)
    setVoiceStatus(voiceEnabled ? 'Voice AI: Sẵn sàng' : 'Voice AI: Tắt tiếng')
    if (!voiceEnabled) {
      if (targetStep === 9) setFinalPromptVisible(true)
      if (targetStep === 1) {
        screenIntroductionComplete.current = true
        const requiresScreenConsent = telemetryConsent === 'granted' && !screenRecorderReady.current
        setScreenRecorderPromptVisible(requiresScreenConsent)
        if (!requiresScreenConsent) screenRecorderReady.current = true
        setInteractionEnabled(!requiresScreenConsent)
      }
      return
    }

    const sequence = audioSequence.current
    audioDelay.current = window.setTimeout(() => {
      audioDelay.current = null
      if (sequence !== audioSequence.current) return

      const completeAudio = (status: string) => {
        if (sequence !== audioSequence.current) return
        audioSequence.current += 1
        speechActive.current = false
        currentStepAudio.current = null
        if (targetStep === 1) {
          screenIntroductionComplete.current = true
          const requiresScreenConsent = telemetryConsent === 'granted' && !screenRecorderReady.current
          setScreenRecorderPromptVisible(requiresScreenConsent)
          if (!requiresScreenConsent) screenRecorderReady.current = true
          setInteractionEnabled(!requiresScreenConsent)
        } else {
          setInteractionEnabled(true)
        }
        setVoiceStatus(status)
      }

      if (stepAudio[targetStep]) {
        const { url: audioUrl, name: audioName, status } = stepAudio[targetStep]
        const audioSequenceForStep = targetStep === 1
          ? [
              { url: audioUrl, name: audioName, status },
              { url: xinphepAudioUrl, name: 'xinphep.mp3', status: 'Voice AI: Đang phát lời xin phép...' },
            ]
          : targetStep === 9
          ? [
              { url: audioUrl, name: audioName, status },
              { url: nhacendAudioUrl, name: 'nhacend.mp3', status: 'Voice AI: Đang phát nhạc kết thúc...' },
            ]
          : [{ url: audioUrl, name: audioName, status }]
        const playAudioAt = (index: number) => {
          if (sequence !== audioSequence.current) return
          const clip = audioSequenceForStep[index]
          const audio = new Audio(clip.url)
          audio.loop = false
          currentStepAudio.current = audio
          setVoiceStatus(clip.status)
          const advance = (failed: boolean) => {
            if (sequence !== audioSequence.current) return
            audio.onended = null
            audio.onerror = null
            if (failed) setAudioNotice(`Không thể phát file ${clip.name}.`)
            if (targetStep === 9 && index === 0) {
              setFinalPromptVisible(true)
              setInteractionEnabled(true)
            }
            if (index + 1 < audioSequenceForStep.length) {
              playAudioAt(index + 1)
            } else {
              completeAudio(failed ? 'Voice AI: Lỗi phát audio' : 'Voice AI: Sẵn sàng')
            }
          }
          audio.onended = () => advance(false)
          audio.onerror = () => advance(true)
          void audio.play().catch(() => advance(true))
        }
        setAudioNotice('')
        playAudioAt(0)
        return
      }

      if (targetStep === 3) {
        const introductions = [gioithieuAudioUrl, gioithieu2AudioUrl, bamtenAudioUrl]
        const introductionNames = ['gioithieu.mp3', 'gioithieu2.mp3', 'bamten.mp3']
        const playIntroduction = (index: number) => {
          if (sequence !== audioSequence.current) return
          if (index === introductions.length) {
            completeAudio('Voice AI: Sẵn sàng')
            return
          }

          const audio = new Audio(introductions[index])
          audio.loop = false
          currentStepAudio.current = audio
          let advanced = false
          const advance = (failed: boolean) => {
            if (advanced || sequence !== audioSequence.current) return
            advanced = true
            audio.onended = null
            audio.onerror = null
            if (failed) {
              setAudioNotice(`Không thể phát file ${introductionNames[index]}.`)
            }
            playIntroduction(index + 1)
          }
          audio.onended = () => advance(false)
          audio.onerror = () => advance(true)
          setVoiceStatus(`Voice AI: Đang phát giới thiệu ${index + 1}/${introductions.length}...`)
          void audio.play().catch(() => {
            advance(true)
          })
        }

        playIntroduction(0)
        return
      }

      if (!('speechSynthesis' in window)) {
        completeAudio('Voice AI: Trình duyệt không hỗ trợ')
        return
      }

      const utterance = new SpeechSynthesisUtterance(getVoiceScript(targetStep, name))
      utterance.lang = 'vi-VN'
      utterance.rate = 0.95
      utterance.pitch = 1.05

      const vietnameseVoice = window.speechSynthesis
        .getVoices()
        .find((voice) => voice.lang.toLowerCase().startsWith('vi'))
      if (vietnameseVoice) utterance.voice = vietnameseVoice

      utterance.onstart = () => {
        if (sequence === audioSequence.current) setVoiceStatus('Voice AI: Đang thuyết minh...')
      }
      utterance.onend = () => completeAudio('Voice AI: Sẵn sàng')
      utterance.onerror = () => completeAudio('Voice AI: Lỗi phát giọng')

      try {
        speechActive.current = true
        window.speechSynthesis.speak(utterance)
      } catch {
        completeAudio('Voice AI: Lỗi phát giọng')
      }
    }, 500)
  }, [stopCurrentStepAudio, telemetryConsent, voiceEnabled])

  useEffect(() => {
    const startTimer = window.setTimeout(() => playStepAudio(step, recipientName), 0)
    return () => window.clearTimeout(startTimer)
  }, [playStepAudio, recipientName, step])

  const playAvatarVoice = useCallback((delayMs: number) => {
    stopCurrentStepAudio()
    if (!voiceEnabled) return

    setAudioNotice('')
    const sequence = audioSequence.current
    const startPlayback = () => {
      audioDelay.current = null
      avatarVoiceScheduled.current = false
      if (sequence !== audioSequence.current) return

      const audio = new Audio(layanhAudioUrl)
      audio.loop = false
      currentStepAudio.current = audio
      const complete = (failed: boolean) => {
        if (sequence !== audioSequence.current) return
        audio.onended = null
        audio.onerror = null
        currentStepAudio.current = null
        audioSequence.current += 1
        setVoiceStatus(failed ? 'Voice AI: Lỗi phát audio' : 'Voice AI: Sẵn sàng')
        if (failed) setAudioNotice('Không thể phát file layanh.mp3.')
      }

      setVoiceStatus('Voice AI: Đang phát lời giới thiệu avatar...')
      audio.onended = () => complete(false)
      audio.onerror = () => complete(true)
      void audio.play().catch(() => complete(true))
    }

    if (delayMs > 0) {
      avatarVoiceScheduled.current = true
      audioDelay.current = window.setTimeout(startPlayback, delayMs)
    } else {
      startPlayback()
    }
  }, [stopCurrentStepAudio, voiceEnabled])

  const handleAvatarShown = useCallback(() => {
    if (!voiceEnabled || avatarVoicePlayed.current || avatarVoiceScheduled.current) return
    avatarVoiceScheduled.current = true
    audioDelay.current = window.setTimeout(() => {
      avatarVoiceScheduled.current = false
      audioDelay.current = null
      if (!voiceEnabled || step !== 3) return
      avatarVoicePlayed.current = true
      playAvatarVoice(0)
    }, 500)
  }, [playAvatarVoice, step, voiceEnabled])

  const playInvalidNameAudio = useCallback(() => {
    stopCurrentStepAudio()
    if (!voiceEnabled) {
      setInteractionEnabled(true)
      return
    }

    setInteractionEnabled(false)
    const sequence = audioSequence.current
    const audio = new Audio(saitenAudioUrl)
    audio.loop = false
    currentStepAudio.current = audio
    let completed = false

    const complete = (failed: boolean) => {
      if (completed || sequence !== audioSequence.current) return
      completed = true
      audio.onended = null
      audio.onerror = null
      currentStepAudio.current = null
      audioSequence.current += 1
      setInteractionEnabled(true)
      setVoiceStatus(failed ? 'Voice AI: Lỗi phát audio' : 'Voice AI: Sẵn sàng')
      if (failed) setAudioNotice('Không thể phát file saiten.mp3.')
    }

    setAudioNotice('')
    setVoiceStatus('Voice AI: Đang phát thông báo tên không hợp lệ...')
    audio.onended = () => complete(false)
    audio.onerror = () => complete(true)
    void audio.play().catch(() => complete(true))
  }, [stopCurrentStepAudio, voiceEnabled])

  const playBlockedNameAudio = useCallback(() => {
    stopCurrentStepAudio()
    if (!voiceEnabled) {
      setInteractionEnabled(true)
      return
    }

    setInteractionEnabled(false)
    const sequence = audioSequence.current
    const audio = new Audio(lailamayAudioUrl)
    audio.loop = false
    currentStepAudio.current = audio

    const complete = (failed: boolean) => {
      if (sequence !== audioSequence.current) return
      audio.onended = null
      audio.onerror = null
      currentStepAudio.current = null
      audioSequence.current += 1
      setInteractionEnabled(true)
      setVoiceStatus(failed ? 'Voice AI: Lỗi phát audio' : 'Voice AI: Sẵn sàng')
      if (failed) setAudioNotice('Không thể phát file lailamay.mp3.')
    }

    setAudioNotice('')
    setVoiceStatus('Voice AI: Đang phát thông báo...')
    audio.onended = () => complete(false)
    audio.onerror = () => complete(true)
    void audio.play().catch(() => complete(true))
  }, [stopCurrentStepAudio, voiceEnabled])

  const playLetterVoice = useCallback(() => {
    if (!letterAuthor || !interactionEnabled || letterVoicePlaying) return
    setLetterPromptDismissed(true)
    stopCurrentStepAudio()
    if (!voiceEnabled) {
      setInteractionEnabled(true)
      return
    }

    const { url, name } = letterAudio[letterAuthor]
    const sequence = audioSequence.current
    const audio = new Audio(url)
    audio.loop = false
    currentStepAudio.current = audio
    setLetterVoicePlaying(true)
    setInteractionEnabled(false)
    setAudioNotice('')
    setVoiceStatus(`Voice AI: Đang đọc tâm thư của ${letterAuthor}...`)

    const complete = (failed: boolean) => {
      if (sequence !== audioSequence.current) return
      audio.onended = null
      audio.onerror = null
      currentStepAudio.current = null
      audioSequence.current += 1
      setLetterVoicePlaying(false)
      setInteractionEnabled(true)
      setVoiceStatus(failed ? 'Voice AI: Lỗi phát audio' : 'Voice AI: Sẵn sàng')
      if (failed) setAudioNotice(`Không thể phát file ${name}.`)
    }

    audio.onended = () => complete(false)
    audio.onerror = () => complete(true)
    void audio.play().catch(() => complete(true))
  }, [interactionEnabled, letterAuthor, letterVoicePlaying, stopCurrentStepAudio, voiceEnabled])

  const goToStep = (nextStep: number) => {
    if (nextStep < 1 || nextStep > 9) return
    if (!bgmEnabledRef.current) void toggleBgm()
    if (nextStep === 1) {
      screenIntroductionComplete.current = false
      setScreenRecorderPromptVisible(false)
    }
    if (nextStep === 9) {
      setFinalPromptDismissed(false)
      setFinalPromptVisible(false)
      setBirthdaySubmitted(false)
      setBirthdayDate('')
      setBirthdayFeedback('')
    }
    setInteractionEnabled(!voiceEnabled && (nextStep !== 1 || screenRecorderReady.current))
    setStep(nextStep)
    if (nextStep === 6) celebrate()
  }

  const toggleVoice = () => {
    if (voiceEnabled) {
      setVoiceEnabled(false)
      stopCurrentStepAudio()
      if (step === 1) {
        screenIntroductionComplete.current = true
        const requiresScreenConsent = telemetryConsent === 'granted' && !screenRecorderReady.current
        setScreenRecorderPromptVisible(requiresScreenConsent)
        if (!requiresScreenConsent) screenRecorderReady.current = true
        setInteractionEnabled(!requiresScreenConsent)
      } else {
        setInteractionEnabled(true)
      }
      setVoiceStatus('Voice AI: Tắt tiếng')
      if (step === 9) setFinalPromptVisible(true)
      return
    }

    setVoiceEnabled(true)
    setVoiceStatus('Voice AI: Đang bật')
  }

  const toggleBgm = async () => {
    setAudioNotice('')
    if (bgmEnabledRef.current) {
      bgmEnabledRef.current = false
      bgmAudio.pause()
      setBgmEnabled(false)
      return
    }

    try {
      await bgmAudio.play()
      bgmEnabledRef.current = true
      setBgmEnabled(true)
    } catch {
      bgmEnabledRef.current = false
      setBgmEnabled(false)
      setAudioNotice('Không thể phát nhạc nền. Hãy thử lại hoặc kiểm tra kết nối mạng.')
    }
  }

  const confirmRecipient = () => {
    const cleanedName = recipientInput.trim()
    if (!cleanedName) {
      setNameError('required')
      recipientInputRef.current?.focus()
      return
    }

    void trackVisitorEvent({
      eventType: 'recipient_name_submitted',
      pageStep: step,
      target: 'recipient-name',
      details: { name: cleanedName },
    })
    const normalizedName = cleanedName.toLocaleLowerCase('vi')
    if (normalizedName === 'long' || normalizedName === 'tuấn') {
      setNameError(null)
      recipientInputRef.current?.focus()
      playBlockedNameAudio()
      return
    }

    const matchingRecipient = allowedRecipients.find(
      (name) => name.toLocaleLowerCase('vi') === normalizedName,
    )
    if (!matchingRecipient) {
      setNameError('not-listed')
      recipientInputRef.current?.focus()
      playInvalidNameAudio()
      return
    }

    setNameError(null)
    setRecipientName(matchingRecipient)
    goToStep(5)
  }

  const openGift = () => {
    if (!interactionEnabled || giftOpeningRef.current) return
    giftOpeningRef.current = true
    setGiftOpening(true)
    setInteractionEnabled(false)
    stopCurrentStepAudio()

    try {
      const audioContext = new AudioContext()
      const master = audioContext.createGain()
      master.gain.value = 0.18
      master.connect(audioContext.destination)

      const noiseBuffer = audioContext.createBuffer(1, Math.floor(audioContext.sampleRate * 0.16), audioContext.sampleRate)
      const noiseData = noiseBuffer.getChannelData(0)
      for (let index = 0; index < noiseData.length; index += 1) {
        noiseData[index] = Math.sin(index * 12.9898) * Math.cos(index * 78.233) * (1 - index / noiseData.length)
      }
      const noise = audioContext.createBufferSource()
      noise.buffer = noiseBuffer
      const noiseFilter = audioContext.createBiquadFilter()
      noiseFilter.type = 'highpass'
      noiseFilter.frequency.value = 700
      const noiseGain = audioContext.createGain()
      noiseGain.gain.setValueAtTime(0.55, audioContext.currentTime)
      noiseGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.16)
      noise.connect(noiseFilter)
      noiseFilter.connect(noiseGain)
      noiseGain.connect(master)
      noise.start()
      noise.stop(audioContext.currentTime + 0.16)

      const thump = audioContext.createOscillator()
      const thumpGain = audioContext.createGain()
      thump.type = 'sine'
      thump.frequency.setValueAtTime(115, audioContext.currentTime)
      thump.frequency.exponentialRampToValueAtTime(48, audioContext.currentTime + 0.18)
      thumpGain.gain.setValueAtTime(0.7, audioContext.currentTime)
      thumpGain.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.18)
      thump.connect(thumpGain)
      thumpGain.connect(master)
      thump.start()
      thump.stop(audioContext.currentTime + 0.18)
      window.setTimeout(() => void audioContext.close(), 250)
    } catch {
      setAudioNotice('Trình duyệt không hỗ trợ phát hiệu ứng âm thanh mở quà.')
    }

    giftOpenTimer.current = window.setTimeout(() => {
      giftOpenTimer.current = null
      giftOpeningRef.current = false
      setGiftOpening(false)
      goToStep(6)
    }, 650)
  }

  const celebrate = () => {
    confetti({
      particleCount: 80,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#f43f5e', '#fb7185', '#fda4af', '#fef08a', '#ffffff'],
    })
  }

  return (
    <div className="app-shell relative flex min-h-screen flex-col items-center justify-center overflow-x-hidden bg-gradient-to-br from-[#fdf2f8] via-[#fffbf5] to-[#fce7f3] text-gray-800 selection:bg-rose-200">
      <PetalCanvas />
      <div className="ambient-orb ambient-orb--rose" aria-hidden="true" />
      <div className="ambient-orb ambient-orb--gold" aria-hidden="true" />

      <StepProgress step={step} />
      <AudioControls
        bgmEnabled={bgmEnabled}
        voiceEnabled={voiceEnabled}
        voiceStatus={voiceStatus}
        audioNotice={audioNotice}
        onToggleBgm={() => void toggleBgm()}
        onToggleVoice={toggleVoice}
      />

      <main className="relative z-10 flex min-h-[580px] w-full max-w-3xl flex-col items-center justify-center px-4 py-28 sm:px-6 sm:py-24">
        <StorySlides
          step={step}
          interactionEnabled={interactionEnabled}
          recipientName={recipientName}
          recipientInput={recipientInput}
          recipientInputRef={recipientInputRef}
          nameError={nameError}
          onGoToStep={goToStep}
          onRecipientInputChange={(value) => {
            setRecipientInput(value)
            if (value.trim()) setNameError(null)
          }}
          onConfirmRecipient={confirmRecipient}
          onOpenGift={openGift}
          giftOpening={giftOpening}
          letterAuthor={letterAuthor}
          onChooseLetter={(author) => {
            setLetterAuthor(author)
            setLetterPromptDismissed(false)
            goToStep(8)
          }}
          onAvatarShown={handleAvatarShown}
          onReplayAvatarVoice={() => playAvatarVoice(0)}
          onRestart={() => goToStep(1)}
          onCelebrate={() => void celebrate()}
        />
      </main>
      <ScreenRecorder
        visible={step === 1 && screenRecorderPromptVisible}
        allowed={telemetryConsent === 'granted'}
        onReady={handleScreenRecorderReady}
      />
      <button
        type="button"
        className="fixed bottom-4 right-4 z-30 rounded-full border border-rose-200 bg-white/90 px-4 py-2 text-xs font-semibold text-rose-700 shadow-lg"
        onClick={() => setPrivacyDialogOpen(true)}
      >
        Quyền riêng tư
      </button>
      {privacyDialogOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4">
          <section
            className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl sm:p-8"
            role="dialog"
            aria-modal="true"
            aria-labelledby="privacy-consent-title"
            data-no-telemetry
          >
            <h2 id="privacy-consent-title" className="mb-3 text-xl font-bold text-gray-900 sm:text-2xl">
              Quyền riêng tư và dữ liệu
            </h2>
            <p className="mb-4 text-sm leading-relaxed text-gray-700">
              Chỉ khi bạn đồng ý, website mới lưu thời điểm, trang và mục tiêu click, lựa chọn, tên người nhận,
              cùng giá trị form sau khi gửi. Video màn hình/micro chỉ được ghi khi bạn chủ động bấm chia sẻ và cấp
              quyền trong trình duyệt. Dữ liệu lưu trong PostgreSQL để quản trị viên đã xác thực xem tại /admin,
              và được giữ đến khi quản trị viên xóa.
            </p>
            <p className="mb-6 text-xs leading-relaxed text-gray-500">
              Mật khẩu không được ghi lại. Form chỉ được lưu khi gửi, không ghi từng phím khi đang gõ. Video không
              được tạo nếu bạn từ chối chia sẻ; bạn có thể rút lại đồng ý tại mục Quyền riêng tư, nhưng dữ liệu đã
              lưu chỉ bị xóa khi quản trị viên xóa.
            </p>
            <div className="flex flex-col justify-end gap-3 sm:flex-row">
              <button type="button" className="secondary-button" disabled={consentSaving} onClick={() => void chooseTelemetryConsent('declined')}>
                Không đồng ý, tiếp tục
              </button>
              <button type="button" className="primary-button" disabled={consentSaving} onClick={() => void chooseTelemetryConsent('granted')}>
                {consentSaving ? 'Đang lưu lựa chọn...' : 'Tôi đồng ý'}
              </button>
            </div>
            {consentError && <p className="mt-4 text-sm text-rose-700" role="alert">{consentError}</p>}
          </section>
        </div>
      )}
      {step === 8 && letterAuthor && !letterPromptDismissed && (
        <div className="letter-prompt-overlay" role="presentation">
          <section
            className="letter-prompt-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="letter-prompt-title"
            aria-describedby="letter-prompt-description"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <Volume2 className="h-7 w-7" aria-hidden="true" />
            </div>
            <h2 id="letter-prompt-title" className="mb-2 text-xl font-bold text-gray-800 sm:text-2xl">
              Bạn có muốn nghe tâm thư?
            </h2>
            <p id="letter-prompt-description" className="mb-6 text-sm leading-relaxed text-gray-600">
              Bạn có muốn tôi đọc lên tâm thư của {letterAuthor} không?
              {letterVoicePlaying ? ' Đang đọc tâm thư...' : ''}
            </p>
            <div className="flex w-full flex-col justify-center gap-3 sm:flex-row">
              <button
                type="button"
                className="primary-button"
                disabled={!interactionEnabled}
                onClick={playLetterVoice}
              >
                <span>Có, hãy đọc tâm thư</span>
                <Volume2 className="h-4 w-4" aria-hidden="true" />
              </button>
              <button
                type="button"
                className="secondary-button"
                disabled={!interactionEnabled}
                onClick={() => goToStep(9)}
              >
                Không, cảm ơn
              </button>
            </div>
          </section>
        </div>
      )}
      {step === 9 && finalPromptVisible && !finalPromptDismissed && (
        <div className="letter-prompt-overlay" role="presentation">
          <section
            className="letter-prompt-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="final-prompt-title"
            aria-describedby="final-prompt-description"
          >
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-100 text-rose-600">
              <CalendarDays className="h-7 w-7" aria-hidden="true" />
            </div>
            {birthdaySubmitted ? (
              <>
                <h2 id="final-prompt-title" className="mb-2 text-xl font-bold text-gray-800 sm:text-2xl">
                  Cảm ơn bạn!
                </h2>
                <p id="final-prompt-description" className="mb-3 text-sm leading-relaxed text-gray-600">
                  Đã nhận ngày sinh {new Date(`${birthdayDate}T00:00:00`).toLocaleDateString('vi-VN')}.
                </p>
                <p className="mb-6 max-w-md whitespace-pre-wrap text-sm leading-relaxed text-gray-600">
                  {birthdayFeedback.trim()
                    ? `Cảm ơn bạn đã chia sẻ cảm nhận: “${birthdayFeedback.trim()}”`
                    : 'Cảm ơn bạn đã cùng tham gia hành trình này.'}
                </p>
                <button
                  type="button"
                  className="primary-button"
                  onClick={() => setFinalPromptDismissed(true)}
                >
                  Đóng
                </button>
              </>
            ) : (
              <>
                <h2 id="final-prompt-title" className="mb-2 text-xl font-bold text-gray-800 sm:text-2xl">
                  Bạn có muốn chia sẻ ngày sinh và cảm nhận của mình không?
                </h2>
                <p id="final-prompt-description" className="mb-5 text-sm leading-relaxed text-gray-600">
                  Hãy cho biết ngày sinh và cảm nhận của bạn về hành trình vừa rồi nhé.
                </p>
                <form
                  className="flex w-full flex-col items-center gap-4"
                  onSubmit={(event) => {
                    event.preventDefault()
                    setBirthdaySubmitted(true)
                  }}
                >
                  <label className="w-full text-left text-sm font-medium text-gray-700" htmlFor="birthday-date">
                    Ngày sinh
                  </label>
                  <input
                    id="birthday-date"
                    name="birthdayDate"
                    className="w-full rounded-xl border border-rose-200 bg-white px-4 py-3 text-gray-800 shadow-inner focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-100"
                    type="date"
                    required
                    value={birthdayDate}
                    onChange={(event) => setBirthdayDate(event.target.value)}
                  />
                  <label className="w-full text-left text-sm font-medium text-gray-700" htmlFor="birthday-feedback">
                    Cảm nhận của bạn (không bắt buộc)
                  </label>
                  <textarea
                    id="birthday-feedback"
                    name="birthdayFeedback"
                    className="min-h-28 w-full resize-y rounded-xl border border-rose-200 bg-white px-4 py-3 text-gray-800 shadow-inner focus:border-rose-500 focus:outline-none focus:ring-4 focus:ring-rose-100"
                    placeholder="Bạn cảm thấy thế nào về món quà này?"
                    value={birthdayFeedback}
                    onChange={(event) => setBirthdayFeedback(event.target.value)}
                  />
                  <div className="mt-2 flex w-full flex-col justify-center gap-3 sm:flex-row">
                    <button type="submit" className="primary-button">
                      OK
                    </button>
                    <button
                      type="button"
                      className="secondary-button"
                      onClick={() => setFinalPromptDismissed(true)}
                    >
                      Để sau
                    </button>
                  </div>
                </form>
              </>
            )}
          </section>
        </div>
      )}
    </div>
  )
}

export default App
