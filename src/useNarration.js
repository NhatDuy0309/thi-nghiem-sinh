import { useCallback, useEffect, useMemo, useRef, useState } from 'react'

const PREF_KEY = 'banana-dna-audio-v1'
const DEFAULTS = { enabled: true, subtitles: true, volume: 0.9, rate: 0.92 }

function readPreferences() {
  try {
    const saved = JSON.parse(sessionStorage.getItem(PREF_KEY) || 'null')
    return saved ? {
      enabled: saved.enabled !== false,
      subtitles: saved.subtitles !== false,
      volume: Number.isFinite(saved.volume) ? Math.max(0, Math.min(1, saved.volume)) : DEFAULTS.volume,
      rate: Number.isFinite(saved.rate) ? Math.max(0.75, Math.min(1.25, saved.rate)) : DEFAULTS.rate,
    } : DEFAULTS
  } catch { return DEFAULTS }
}

function sentencesOf(text) {
  return text.match(/[^.!?]+[.!?]?/gu)?.map((sentence) => sentence.trim()).filter(Boolean) || [text]
}

function sentenceAtProgress(sentences, progress) {
  const total = sentences.reduce((sum, sentence) => sum + sentence.length, 0)
  let boundary = Math.max(0, Math.min(0.999, progress)) * total
  for (let index = 0; index < sentences.length - 1; index += 1) {
    boundary -= sentences[index].length
    if (boundary < 0) return index
  }
  return Math.max(0, sentences.length - 1)
}

export function useNarration() {
  const [preferences, setPreferences] = useState(readPreferences)
  const [voices, setVoices] = useState([])
  const [voicesLoaded, setVoicesLoaded] = useState(false)
  const [currentText, setCurrentText] = useState('')
  const [isSpeaking, setIsSpeaking] = useState(false)
  const [isPaused, setIsPaused] = useState(false)
  const [status, setStatus] = useState('')
  const queue = useRef({ token: 0, text: '', audioSrc: '', sentences: [], index: 0, timer: null, mode: '', utterance: null, audio: null })
  const synthSupported = typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function'

  const voice = useMemo(() => voices
    .filter((candidate) => /^vi(?:-|$)/i.test(candidate.lang || ''))
    .sort((a, b) => Number(b.lang.toLowerCase() === 'vi-vn') - Number(a.lang.toLowerCase() === 'vi-vn') || Number(b.localService) - Number(a.localService))[0], [voices])

  useEffect(() => {
    try { sessionStorage.setItem(PREF_KEY, JSON.stringify(preferences)) } catch { /* Keep audio settings in memory if storage is unavailable. */ }
  }, [preferences])

  useEffect(() => {
    if (!synthSupported) { setVoicesLoaded(true); return }
    const synth = window.speechSynthesis
    const refresh = () => { setVoices(synth.getVoices()); setVoicesLoaded(true) }
    refresh()
    synth.addEventListener?.('voiceschanged', refresh)
    const fallback = setTimeout(refresh, 900)
    return () => { clearTimeout(fallback); synth.removeEventListener?.('voiceschanged', refresh) }
  }, [synthSupported])

  const clearActive = useCallback((clearSubtitle = true) => {
    const active = queue.current
    active.token += 1
    clearTimeout(active.timer)
    active.timer = null
    active.utterance = null
    active.mode = ''
    if (active.audio) {
      active.audio.pause()
      active.audio.onloadedmetadata = null
      active.audio.ontimeupdate = null
      active.audio.onended = null
      active.audio.onerror = null
      active.audio = null
    }
    if (synthSupported) window.speechSynthesis.cancel()
    setIsSpeaking(false)
    setIsPaused(false)
    if (clearSubtitle) setCurrentText('')
  }, [synthSupported])

  const scheduleCaption = useCallback((token, index, duration) => {
    const active = queue.current
    if (active.token !== token || index >= active.sentences.length) {
      if (active.token === token) { active.mode = ''; setIsSpeaking(false); setIsPaused(false); setCurrentText('') }
      return
    }
    active.index = index
    active.mode = 'caption'
    active.timerDuration = duration
    active.timerAt = performance.now()
    setCurrentText(active.sentences[index])
    active.timer = setTimeout(() => scheduleCaption(token, index + 1, 0), duration)
  }, [])

  const saySentence = useCallback((token, index) => {
    const active = queue.current
    if (active.token !== token) return
    if (index >= active.sentences.length) {
      active.mode = ''
      setIsSpeaking(false); setIsPaused(false); setCurrentText('')
      return
    }
    active.index = index
    const sentence = active.sentences[index]
    setCurrentText(sentence)
    if (!preferences.enabled || !synthSupported || !voice) {
      if (preferences.enabled && voicesLoaded && !voice) setStatus(synthSupported ? 'Thiết bị chưa có giọng tiếng Việt; đang dùng phụ đề.' : 'Trình duyệt không hỗ trợ đọc văn bản; đang dùng phụ đề.')
      setIsSpeaking(false); setIsPaused(false)
      scheduleCaption(token, index, Math.max(2300, sentence.length * 62 / preferences.rate))
      return
    }
    const utterance = new window.SpeechSynthesisUtterance(sentence)
    utterance.lang = voice.lang || 'vi-VN'
    utterance.voice = voice
    utterance.volume = preferences.volume
    utterance.rate = preferences.rate
    utterance.pitch = 1
    active.mode = 'speech'
    active.utterance = utterance
    setStatus(`Giọng đọc: ${voice.name}`)
    setIsSpeaking(true); setIsPaused(false)
    utterance.onend = () => { if (queue.current.token === token) saySentence(token, index + 1) }
    utterance.onerror = (event) => {
      if (queue.current.token !== token || ['canceled', 'interrupted'].includes(event.error)) return
      setStatus('Không phát được giọng đọc; đang tiếp tục bằng phụ đề.')
      setIsSpeaking(false)
      scheduleCaption(token, index, Math.max(2300, sentence.length * 62 / preferences.rate))
    }
    window.speechSynthesis.speak(utterance)
  }, [preferences, scheduleCaption, synthSupported, voice, voicesLoaded])

  const playRecording = useCallback((token, audioSrc) => {
    const active = queue.current
    const audio = new Audio(audioSrc)
    active.mode = 'audio'
    active.audio = audio
    audio.volume = preferences.volume
    audio.playbackRate = preferences.rate
    const updateCaption = () => {
      if (queue.current.token !== token) return
      const progress = Number.isFinite(audio.duration) && audio.duration > 0 ? audio.currentTime / audio.duration : 0
      const index = sentenceAtProgress(active.sentences, progress)
      active.index = index
      setCurrentText(active.sentences[index] || active.text)
    }
    audio.onloadedmetadata = updateCaption
    audio.ontimeupdate = updateCaption
    audio.onended = () => {
      if (queue.current.token !== token) return
      active.mode = ''
      active.audio = null
      setCurrentText('')
      setIsSpeaking(false)
      setIsPaused(false)
    }
    audio.onerror = () => {
      if (queue.current.token !== token) return
      active.audio = null
      active.mode = ''
      setStatus('Không phát được bản thu; đang chuyển sang lời đọc dự phòng.')
      saySentence(token, 0)
    }
    setStatus('Đang phát bản thu âm.')
    setCurrentText(active.sentences[0] || active.text)
    setIsSpeaking(true)
    setIsPaused(false)
    audio.play().catch(() => {
      if (queue.current.token !== token) return
      active.audio = null
      active.mode = ''
      setStatus('Không phát được bản thu; đang chuyển sang lời đọc dự phòng.')
      saySentence(token, 0)
    })
  }, [preferences.rate, preferences.volume, saySentence])

  const speak = useCallback((text, audioSrc = '') => {
    if (!text) return
    clearActive()
    const token = queue.current.token
    queue.current = { ...queue.current, token, text, audioSrc, sentences: sentencesOf(text), index: 0, timer: null, mode: '', utterance: null, audio: null }
    setStatus(preferences.enabled && !voice && voicesLoaded ? 'Thiết bị chưa có giọng tiếng Việt; đang dùng phụ đề.' : '')
    if (audioSrc && preferences.enabled) {
      playRecording(token, audioSrc)
      return
    }
    saySentence(token, 0)
  }, [clearActive, playRecording, preferences.enabled, saySentence, voice, voicesLoaded])

  useEffect(() => {
    const audio = queue.current.audio
    if (audio) { audio.volume = preferences.volume; audio.playbackRate = preferences.rate }
  }, [preferences.rate, preferences.volume])

  const pause = useCallback(() => {
    const active = queue.current
    if (active.mode === 'speech' && synthSupported) window.speechSynthesis.pause()
    else if (active.mode === 'audio' && active.audio) active.audio.pause()
    else if (active.mode === 'caption' && active.timer) {
      clearTimeout(active.timer)
      active.remaining = Math.max(250, active.timerDuration - (performance.now() - active.timerAt))
      active.timer = null
    }
    if (active.mode) setIsPaused(true)
  }, [synthSupported])

  const resume = useCallback(() => {
    const active = queue.current
    if (!isPaused || !active.mode) return
    if (active.mode === 'speech' && synthSupported) window.speechSynthesis.resume()
    else if (active.mode === 'audio' && active.audio) active.audio.play().catch(() => setStatus('Không thể tiếp tục bản thu âm.'))
    else if (active.mode === 'caption') scheduleCaption(active.token, active.index, active.remaining || 2300)
    setIsPaused(false)
  }, [isPaused, scheduleCaption, synthSupported])

  const stop = useCallback(() => clearActive(), [clearActive])
  const clear = useCallback(() => { clearActive(); queue.current.text = ''; queue.current.audioSrc = '' }, [clearActive])
  const replay = useCallback(() => {
    const { text, audioSrc } = queue.current
    if (text) speak(text, audioSrc)
  }, [speak])
  const setEnabled = useCallback((enabled) => {
    setPreferences((current) => ({ ...current, enabled }))
    if (!enabled) clearActive()
    else setStatus(voice ? `Giọng đọc: ${voice.name}` : 'Bật lại lời dẫn rồi chọn phát lại để nghe.')
  }, [clearActive, voice])
  const setSubtitles = useCallback((subtitles) => setPreferences((current) => ({ ...current, subtitles })), [])
  const setVolume = useCallback((volume) => setPreferences((current) => ({ ...current, volume: Number(volume) })), [])
  const setRate = useCallback((rate) => setPreferences((current) => ({ ...current, rate: Number(rate) })), [])

  useEffect(() => () => {
    clearTimeout(queue.current.timer)
    queue.current.audio?.pause()
    if (synthSupported) window.speechSynthesis.cancel()
  }, [synthSupported])

  return {
    enabled: preferences.enabled, subtitlesEnabled: preferences.subtitles,
    volume: preferences.volume, rate: preferences.rate,
    currentText, isSpeaking, isPaused, status,
    voiceName: voice?.name || '', voiceAvailable: Boolean(voice), voicesLoaded, synthSupported,
    setEnabled, setSubtitles, setVolume, setRate, speak, pause, resume, stop, clear, replay,
  }
}
