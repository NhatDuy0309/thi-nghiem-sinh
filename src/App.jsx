import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { EVENT_NARRATION, MOLECULE_NARRATION, OBSERVATION_NARRATION, STAGE_NARRATION } from './narrationContent.js'
import { MOLECULE_AUDIO, OBSERVATION_AUDIO, STAGE_AUDIO } from './narrationAudio.js'
import { useNarration } from './useNarration.js'

const SAVE_KEY = 'banana-dna-lab-v1'
const EMPTY = { stage: 1, step: 'gloves', done: [], inventory: [], reagents: [] }

const OBJECTS = {
  gloves: { name: 'Găng tay nitrile', kind: 'Găng tay', detail: 'Đeo găng trước khi thao tác. Chỉ sử dụng dụng cụ trong phòng thí nghiệm ảo; không nếm hóa chất hoặc mẫu.' },
  banana: { name: 'Mẫu chuối', kind: 'Chuối', detail: 'Nghiền mẫu giúp phá vỡ mô và làm tăng diện tích tiếp xúc. Chuối có nhiều tế bào, nên cung cấp đủ vật liệu di truyền để quan sát.' },
  mortar: { name: 'Cối sứ và chày', kind: 'Cối nghiền', detail: 'Nghiền cơ học làm vỡ mô thực vật. Bước này hỗ trợ dung dịch tách chiết tiếp xúc với tế bào; nó chưa tách riêng DNA.' },
  detergent: { name: 'Nước rửa chén pha loãng', kind: 'Chất tẩy rửa', detail: 'Phân tử chất tẩy rửa tương tác với lipid, giúp phá vỡ màng tế bào và màng nhân để giải phóng các thành phần bên trong.' },
  salt: { name: 'Dung dịch muối', kind: 'Muối', detail: 'Ion trong muối giúp che chắn một phần điện tích âm trên khung phosphate của DNA và hỗ trợ DNA kết tụ khi thêm ethanol.' },
  water: { name: 'Nước cất', kind: 'Nước', detail: 'Nước là dung môi để pha dung dịch tách chiết và giúp các thành phần tiếp xúc đều với mẫu.' },
  beaker: { name: 'Cốc thủy tinh', kind: 'Cốc thủy tinh', detail: 'Cốc dùng để phối trộn mẫu với dung dịch tách chiết. Sau khi khuấy, hỗn hợp có màu đục do mô chuối và các chất trong tế bào.' },
  rod: { name: 'Đũa thủy tinh', kind: 'Đũa khuấy', detail: 'Khuấy nhẹ để trộn mẫu với dung dịch. Tránh tạo quá nhiều bọt hoặc làm vỡ các phân tử DNA thành những mảnh ngắn hơn.' },
  funnel: { name: 'Phễu lọc', kind: 'Phễu', detail: 'Phễu giữ giấy lọc phía trên cốc hứng, giúp rót hỗn hợp qua mà không làm giấy bị xê dịch.' },
  paper: { name: 'Giấy lọc', kind: 'Giấy lọc', detail: 'Lọc giữ lại phần lớn bã mô và các mảnh rắn. DNA cùng nhiều phân tử hòa tan vẫn đi qua trong dịch lọc.' },
  pitcher: { name: 'Cốc hứng dịch lọc', kind: 'Dịch lọc', detail: 'Dịch lọc chứa DNA cùng nhiều chất hòa tan khác. Đây chưa phải DNA tinh khiết.' },
  ethanol: { name: 'Ethanol lạnh', kind: 'Ethanol', detail: 'DNA ít tan trong ethanol lạnh, nhất là khi có ion muối. DNA kết tụ và hiện ra ở ranh giới giữa hai lớp chất lỏng.' },
  tube: { name: 'Ống quan sát', kind: 'Mẫu DNA', detail: 'Phần trắng đục, dạng sợi là vật liệu giàu DNA đã kết tủa cùng một số protein và thành phần tế bào khác; mẫu không phải DNA tinh khiết.' },
  waste: { name: 'Khay chất thải', kind: 'Chất thải', detail: 'Bỏ giấy lọc và bã mẫu vào đúng khay. Trong thực hành thật, xử lý vật liệu theo hướng dẫn của giáo viên và quy định phòng thí nghiệm.' },
}

const TARGETS = {
  '1-gloves': 'gloves', '1-banana': 'banana', '1-mash': 'mortar',
  '2-detergent': 'detergent', '2-salt': 'salt', '2-water': 'water',
  '3-combine': 'beaker', '3-stir': 'rod',
  '4-funnel': 'funnel', '4-paper': 'paper', '4-filter': 'pitcher',
  '5-ethanol': 'ethanol', '6-inspect': 'tube',
}

const STAGES = [
  ['01', 'Chuẩn bị mẫu', 'Đeo găng, lấy một phần chuối và nghiền mẫu trong cối.'],
  ['02', 'Pha dung dịch', 'Lần lượt thêm chất tẩy rửa, muối và nước vào cốc.'],
  ['03', 'Phá vỡ tế bào', 'Trộn mẫu chuối với dung dịch rồi khuấy nhẹ.'],
  ['04', 'Lọc hỗn hợp', 'Đặt phễu, lót giấy lọc và rót hỗn hợp qua phễu.'],
  ['05', 'Kết tủa DNA', 'Rót ethanol lạnh chậm dọc thành cốc.'],
  ['06', 'Quan sát', 'Đưa ống mẫu lại gần và quan sát kết tủa.'],
]

const QUIZ = [
  { q: 'Chất tẩy rửa giúp giải phóng DNA bằng cách nào?', a: ['Phá vỡ các màng giàu lipid', 'Làm DNA phát sáng', 'Biến tinh bột thành DNA'], correct: 0, why: 'Màng tế bào và màng nhân chứa lipid; chất tẩy rửa giúp phá vỡ các màng này.' },
  { q: 'Vì sao DNA kết tủa khi thêm ethanol lạnh?', a: ['DNA ít tan trong ethanol lạnh và có muối', 'Ethanol tạo ra DNA mới', 'DNA tan nhanh hơn trong ethanol'], correct: 0, why: 'Trong ethanol lạnh, DNA giảm độ tan và các phân tử kết tụ thành vật liệu có thể nhìn thấy.' },
  { q: 'Phần trắng đục, dạng sợi quan sát được là gì?', a: ['Vật liệu chứa DNA, chưa tinh khiết', 'DNA tinh khiết tuyệt đối', 'Chỉ là giấy lọc tan ra'], correct: 0, why: 'Kết tủa chứa DNA cùng protein và một số thành phần tế bào khác, nên chưa phải DNA tinh khiết.' },
]

function readSave() {
  try {
    const parsed = JSON.parse(localStorage.getItem(SAVE_KEY) || 'null')
    const steps = { 1: ['gloves', 'banana', 'mash'], 2: ['detergent', 'salt', 'water'], 3: ['combine', 'stir'], 4: ['funnel', 'paper', 'filter'], 5: ['ethanol'], 6: ['inspect'] }
    if (parsed && Number.isInteger(parsed.stage) && steps[parsed.stage]?.includes(parsed.step) && Array.isArray(parsed.done) && parsed.done.every((id) => Object.hasOwn(OBJECTS, id)) && Array.isArray(parsed.inventory) && parsed.inventory.every((item) => typeof item === 'string') && Array.isArray(parsed.reagents) && parsed.reagents.every((id) => ['detergent', 'salt', 'water'].includes(id))) {
      return { ...EMPTY, ...parsed }
    }
  } catch { /* A damaged save starts a clean run. */ }
  return null
}

function nextProgress(progress, id) {
  const next = { ...progress, done: [...new Set([...progress.done, id])], inventory: [...progress.inventory] }
  const add = (item) => { if (!next.inventory.includes(item)) next.inventory.push(item) }
  if (progress.stage === 1) {
    if (progress.step === 'gloves') { add('Găng tay'); next.step = 'banana' }
    else if (progress.step === 'banana') { add('Mẫu chuối'); next.step = 'mash' }
    else { add('Mẫu nghiền'); next.stage = 2; next.step = 'detergent' }
  } else if (progress.stage === 2) {
    next.reagents = [...progress.reagents, id]
    if (id === 'water') { add('Dung dịch tách chiết'); next.stage = 3; next.step = 'combine' }
    else next.step = id === 'detergent' ? 'salt' : 'water'
  } else if (progress.stage === 3) {
    if (progress.step === 'combine') { add('Hỗn hợp chuối'); next.step = 'stir' }
    else { add('Dịch đã trộn'); next.stage = 4; next.step = 'funnel' }
  } else if (progress.stage === 4) {
    if (progress.step === 'funnel') next.step = 'paper'
    else if (progress.step === 'paper') next.step = 'filter'
    else { add('Dịch lọc'); next.stage = 5; next.step = 'ethanol' }
  } else if (progress.stage === 5) {
    add('Ethanol lạnh'); next.stage = 6; next.step = 'inspect'
  }
  return next
}

function modelFor(id, progress, busyId, stirAmount = 0) {
  const done = progress.done.includes(id)
  if (id === 'banana') return <div className={`model banana-art ${done ? 'banana-used' : ''}`}><svg viewBox="0 0 100 62" aria-hidden="true"><defs><linearGradient id="bananaSkin" x1="0" x2=".8" y1="0" y2="1"><stop stopColor="#f9dc76"/><stop offset=".48" stopColor="#e8b846"/><stop offset="1" stopColor="#a56e28"/></linearGradient></defs><path d="M9 10c12 5 19 24 39 30 17 5 30-3 41-22l5 3c-9 31-34 42-56 33C18 46 11 25 4 16z" fill="url(#bananaSkin)" stroke="#8c632d" strokeWidth="2"/><path d="M9 10l-4 6 7 3 4-5m77 4 6 2-2 7-7-3" fill="#48382a"/><path d="M22 22c7 10 13 17 24 20" stroke="#fff1ad" strokeWidth="3" opacity=".6" fill="none"/></svg><i className="banana-slice"/></div>
  if (id === 'gloves') return <div className="model gloves-art"><i/><i/><span className="cuff"/><span className="cuff second"/></div>
  if (id === 'mortar') return <div className={`model mortar-art ${done ? 'mortar-ready' : ''} ${busyId === id ? 'mashing' : ''}`}><i className="pestle"/><i className="bowl"/><i className="mash"/></div>
  if (id === 'detergent') return <div className="model bottle-art detergent-art"><i className="cap"/><i className="bottle-neck"/><i className="bottle-body"><b>LAB</b><small>DET.</small></i><i className="bottle-liquid"/></div>
  if (id === 'salt') return <div className="model salt-art"><i className="cap"/><i className="salt-jar"><b>NaCl</b><small>MUỐI</small></i></div>
  if (id === 'water') return <div className="model bottle-art water-art"><i className="cap"/><i className="bottle-neck"/><i className="bottle-body"><b>H₂O</b><small>NƯỚC CẤT</small></i><i className="water-level"/></div>
  if (id === 'beaker' || id === 'pitcher') {
    const filtrate = progress.done.includes('pitcher') || progress.stage >= 5
    const ethanol = progress.done.includes('ethanol') || progress.stage >= 6
    const mixed = progress.done.includes('beaker') || progress.done.includes('rod') || progress.stage >= 4 || busyId === 'beaker'
    const reagents = (progress.reagents?.length || 0) + (['detergent', 'salt', 'water'].includes(busyId) ? 1 : 0)
    const precipitated = id === 'pitcher' && (progress.done.includes('ethanol') || progress.stage >= 6)
    return <div className={`model beaker-art ${id === 'pitcher' ? 'receiving-beaker' : ''} ${busyId === 'pitcher' ? 'pouring' : ''} ${busyId === 'ethanol' && id === 'pitcher' ? 'adding-ethanol' : ''} ${id === 'beaker' && stirAmount > 0 ? 'being-stirred' : ''} ${id === 'beaker' && ['detergent','salt','water'].includes(busyId) ? 'reagent-pour' : ''} ${id === 'beaker' && busyId === 'beaker' ? 'mix-transfer' : ''}`} style={{ '--stir': `${Math.min(stirAmount / 4, 100)}%` }}><i className="rim"/><i className="glass-wall"/><i className={`liquid ${id === 'pitcher' && filtrate ? 'filtrate' : mixed ? 'pulp' : reagents ? 'solution' : ''}`} style={{ '--fill': `${Math.min(22 + reagents * 8 + (mixed ? 24 : 0), 68)}%` }}/>{ethanol && id === 'pitcher' && <><i className="ethanol-layer"/>{precipitated && <i className="bench-precipitate"><b/><b/><b/><b/></i>}</>}{id === 'pitcher' && progress.done.includes('funnel') && <i className="assembled-funnel"><b className={`${progress.done.includes('paper') ? 'paper-in-funnel' : ''} ${busyId === 'pitcher' ? 'retained-pulp' : ''}`}/></i>}<i className="ticks"><b/><b/><b/><b/></i></div>
  }
  if (id === 'rod') return <div className={`model rod-art ${busyId === id || stirAmount > 0 ? 'stirring' : ''}`}><i/></div>
  if (id === 'funnel') return <div className={`model funnel-art ${progress.done.includes('funnel') ? 'funnel-placed' : ''}`}><i className="funnel-top"/><i className="funnel-neck"/><i className="funnel-glint"/></div>
  if (id === 'paper') return <div className="model paper-art"><i className="paper-cone"/><i className="paper-fold"/></div>
  if (id === 'ethanol') return <div className={`model bottle-art ethanol-art ${busyId === id ? 'pouring-bottle' : ''}`}><i className="cap"/><i className="bottle-neck"/><i className="bottle-body"><b>ETOH</b><small>−4 °C</small></i><i className="frost"/></div>
  if (id === 'tube') return <div className={`model tube-art ${progress.done.includes('ethanol') || progress.stage >= 6 ? 'has-dna' : ''}`}><i className="tube-rim"/><i className="tube-glass"/><i className="tube-liquid"/><i className="dna-thread one"/><i className="dna-thread two"/><i className="tube-glint"/></div>
  if (id === 'waste') return <div className="model waste-art"><i className="waste-lid"/><i className="waste-bin"><b>BIO</b><small>CHẤT THẢI</small></i></div>
  return null
}

const POSITIONS = {
  gloves: ['6%', '47%'], banana: ['18%', '48%'], mortar: ['33%', '43%'], detergent: ['45%', '36%'],
  salt: ['58%', '45%'], water: ['71%', '38%'], beaker: ['42%', '60%'], rod: ['42%', '58%'],
  funnel: ['68%', '33%'], paper: ['76%', '56%'], pitcher: ['68%', '60%'], ethanol: ['84%', '38%'],
  tube: ['87%', '62%'], waste: ['10%', '64%'],
}
const MOBILE_POSITIONS = {
  gloves: ['10%', '26%'], banana: ['30%', '26%'], mortar: ['50%', '26%'], detergent: ['70%', '26%'], salt: ['90%', '26%'],
  water: ['10%', '50%'], beaker: ['30%', '50%'], rod: ['30%', '48%'], funnel: ['70%', '50%'], paper: ['90%', '50%'],
  pitcher: ['10%', '70%'], ethanol: ['30%', '70%'], tube: ['50%', '70%'], waste: ['70%', '70%'],
}

function LabProp({ id, progress, busyId, target, position, onMove, onUse, onFocus, onStir, stirAmount }) {
  const drag = useRef(null)
  const stirring = useRef({ angle: null, sweep: 0 })
  const suppressClick = useRef(false)
  const [dragging, setDragging] = useState(false)
  const done = progress.done.includes(id)
  useEffect(() => { if (target !== 'rod') stirring.current = { angle: null, sweep: 0 } }, [target])
  const startDrag = (event) => {
    if (event.button !== 0 && event.pointerType !== 'touch') return
    const surface = event.currentTarget.closest('.bench-top')?.getBoundingClientRect()
    if (!surface) return
    suppressClick.current = false
    const mobile = window.matchMedia('(max-width: 640px)').matches
    drag.current = { pointerId: event.pointerId, x: event.clientX, y: event.clientY, centerX: surface.left + surface.width * (mobile ? .3 : .42), centerY: surface.top + surface.height * (mobile ? .5 : .6), width: surface.width, height: surface.height, position }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const moveDrag = (event) => {
    const start = drag.current
    if (!start) return
    const dx = event.clientX - start.x
    const dy = event.clientY - start.y
    if (id === 'rod' && target === id) {
      const dx = event.clientX - start.centerX
      const dy = event.clientY - start.centerY
      if (Math.hypot(dx, dy) > 12) {
        const angle = Math.atan2(dy, dx)
        if (stirring.current.angle !== null) {
          let turn = angle - stirring.current.angle
          if (turn > Math.PI) turn -= Math.PI * 2
          if (turn < -Math.PI) turn += Math.PI * 2
          stirring.current.sweep += Math.abs(turn)
          onStir(Math.min(100, stirring.current.sweep / (Math.PI * 4) * 100))
        }
        stirring.current.angle = angle
      }
      if (stirring.current.sweep >= Math.PI * 4 && !start.completed) { start.completed = true; stirring.current = { angle: null, sweep: 0 }; onUse(id) }
      return
    }
    if (Math.hypot(dx, dy) > 5) { start.moved = true; setDragging(true) }
    if (start.moved) onMove(id, {
      x: Math.max(3, Math.min(97, start.position.x + dx / start.width * 100)),
      y: Math.max(12, Math.min(94, start.position.y + dy / start.height * 100)),
      mx: Math.max(3, Math.min(97, start.position.mx + dx / start.width * 100)),
      my: Math.max(12, Math.min(94, start.position.my + dy / start.height * 100)),
    })
  }
  const endDrag = () => {
    suppressClick.current = Boolean(drag.current?.moved)
    drag.current = null
    setDragging(false)
  }
  return <button
    type="button"
    className={`prop prop-${id} ${target === id ? 'is-target' : ''} ${done ? 'is-done' : ''} ${busyId ? 'is-busy' : ''} ${dragging ? 'is-dragging' : ''} ${id === 'rod' && target === id ? 'stir-ready' : ''}`}
    style={{ '--px': `${position.x}%`, '--py': `${position.y}%`, '--mx': `${position.mx}%`, '--my': `${position.my}%` }}
    aria-label={`${OBJECTS[id].name}${target === id ? ', nhấn để thao tác' : ', nhấn để xem'}, có thể kéo để di chuyển`}
    onPointerEnter={() => onFocus(id)}
    onFocus={() => onFocus(id)}
    onPointerDown={startDrag}
    onPointerMove={moveDrag}
    onPointerUp={endDrag}
    onPointerCancel={endDrag}
    onClick={() => { if (suppressClick.current) { suppressClick.current = false; return } onUse(id) }}
  >
    <span className="prop-shadow"/>
    {modelFor(id, progress, busyId, stirAmount)}
    <span className="prop-name">{OBJECTS[id].name}</span>
    {target === id && <span className="target-cue">TƯƠNG TÁC</span>}
  </button>
}

function App() {
  const saved = useRef(readSave())
  const [progress, setProgress] = useState(saved.current || EMPTY)
  const [view, setView] = useState('intro')
  const [hasSaved, setHasSaved] = useState(Boolean(saved.current))
  const [focused, setFocused] = useState(null)
  const [infoId, setInfoId] = useState(null)
  const [busyId, setBusyId] = useState(null)
  const [hands, setHands] = useState(false)
  const [feedback, setFeedback] = useState('')
  const [inventoryOpen, setInventoryOpen] = useState(false)
  const [positions, setPositions] = useState({})
  const [stirAmount, setStirAmount] = useState(0)
  const [audioPanelOpen, setAudioPanelOpen] = useState(false)
  const [moleculeView, setMoleculeView] = useState(false)
  const [camera, setCamera] = useState({ x: 0, y: 0 })
  const [quizIndex, setQuizIndex] = useState(0)
  const [quizChoice, setQuizChoice] = useState(null)
  const [quizRight, setQuizRight] = useState(false)
  const timer = useRef(null)
  const feedbackTimer = useRef(null)
  const narratedStage = useRef(null)
  const narration = useNarration()

  const target = TARGETS[`${progress.stage}-${progress.step}`]
  const currentStage = STAGES[progress.stage - 1]
  const objectInfo = infoId ? OBJECTS[infoId] : null
  const stageHint = useMemo(() => {
    const hints = {
      gloves: 'Bắt đầu bằng việc đeo găng tay nitrile.', banana: 'Chọn một phần chuối chín để chuẩn bị mẫu.', mash: 'Dùng chày nghiền mẫu chuối trong cối.',
      detergent: 'Thêm chất tẩy rửa pha loãng vào cốc.', salt: 'Thêm dung dịch muối vào cùng cốc.', water: 'Thêm nước cất để hoàn tất dung dịch.',
      combine: 'Cho mẫu chuối nghiền vào dung dịch tách chiết.', stir: 'Dùng đũa khuấy nhẹ hỗn hợp.',
      funnel: 'Đặt phễu lên miệng cốc hứng.', paper: 'Lót giấy lọc vào trong phễu.', filter: 'Rót hỗn hợp qua giấy lọc.',
      ethanol: 'Rót ethanol lạnh thật chậm dọc thành cốc.', inspect: 'Chọn ống mẫu để quan sát kết tủa.',
    }
    return hints[progress.step] || ''
  }, [progress.step])

  useEffect(() => {
    if (view !== 'lab') return
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(progress)); setHasSaved(true) } catch { /* Continue if storage is unavailable. */ }
  }, [progress, view])

  const startLab = useCallback(() => {
    narratedStage.current = progress.stage
    narration.speak(STAGE_NARRATION[progress.stage], STAGE_AUDIO[progress.stage])
    setView('lab')
  }, [narration.speak, progress.stage])

  useEffect(() => {
    if (view !== 'lab' || narratedStage.current === progress.stage) return
    narratedStage.current = progress.stage
    narration.speak(STAGE_NARRATION[progress.stage], STAGE_AUDIO[progress.stage])
  }, [narration.speak, progress.stage, view])

  useEffect(() => {
    if (view === 'pause') narration.pause()
    else if (view === 'lab' && narration.isPaused) narration.resume()
    else if (['intro', 'safety', 'assessment', 'complete'].includes(view)) narration.stop()
  }, [narration.isPaused, narration.pause, narration.resume, narration.stop, view])

  useEffect(() => () => { clearTimeout(timer.current); clearTimeout(feedbackTimer.current); narration.clear() }, [narration.clear])

  const useObject = useCallback((id) => {
    setFocused(id)
    if (busyId) return
    if (id === target) {
      if (id === 'rod' && stirAmount < 100) { setFeedback('Giữ và rê đũa theo vòng tròn trong cốc để khuấy đều hỗn hợp.'); return }
      setInfoId(null)
      if (id === 'tube') { narration.speak(OBSERVATION_NARRATION, OBSERVATION_AUDIO); setMoleculeView(false); setView('observation'); return }
      if (EVENT_NARRATION[id]) narration.speak(EVENT_NARRATION[id])
      const durations = { gloves: 650, banana: 850, mortar: 1800, detergent: 1100, salt: 950, water: 1200, beaker: 1350, rod: 2200, funnel: 850, paper: 1100, pitcher: 2300, ethanol: 2600 }
      setBusyId(id)
      setHands(true)
      setFeedback(({ gloves: 'Đang đeo găng…', banana: 'Đang lấy mẫu…', mortar: 'Đang nghiền chuối…', detergent: 'Đang rót dung dịch…', salt: 'Đang thêm muối…', water: 'Đang thêm nước…', beaker: 'Đang chuyển mẫu…', rod: 'Đang khuấy nhẹ…', funnel: 'Đang đặt phễu…', paper: 'Đang lót giấy lọc…', pitcher: 'Đang lọc hỗn hợp…', ethanol: 'Đang rót ethanol lạnh…' })[id])
      timer.current = setTimeout(() => {
        setProgress((prev) => nextProgress(prev, id))
        if (id === 'rod') setStirAmount(0)
        setBusyId(null)
        setHands(false)
        const messages = {
          gloves: 'Găng tay đã sẵn sàng. Hãy giữ bàn thao tác gọn sạch.', banana: 'Đã lấy mẫu chuối. Nghiền giúp giải phóng mô và tăng diện tích tiếp xúc.',
          mortar: 'Mẫu đã được nghiền. Các bước tiếp theo sẽ làm giải phóng DNA khỏi tế bào.',
          detergent: 'Chất tẩy rửa giúp phá vỡ màng tế bào và màng nhân.', salt: 'Muối hỗ trợ DNA kết tụ khi thêm ethanol.', water: 'Dung dịch tách chiết đã sẵn sàng.',
          beaker: 'Mẫu nghiền đã được cho vào dung dịch.', rod: 'Hỗn hợp đã được khuấy đều; thao tác nhẹ giúp hạn chế làm đứt các sợi DNA.',
          funnel: 'Phễu đã đặt vững trên cốc hứng.', paper: 'Giấy lọc đã nằm trong phễu.', pitcher: 'Dịch lọc đã tách khỏi phần lớn bã mô.', ethanol: 'Hai lớp chất lỏng hình thành; vật liệu chứa DNA kết tụ tại ranh giới.',
        }
        setFeedback(messages[id])
        feedbackTimer.current = setTimeout(() => setFeedback(''), 4200)
      }, durations[id] || 1000)
    } else {
      setInfoId(id)
      setFeedback(OBJECTS[id].detail)
    }
  }, [busyId, narration.speak, progress.stage, progress.step, stirAmount, target])

  useEffect(() => {
    const onKeyDown = (event) => {
      if (['INPUT', 'TEXTAREA'].includes(event.target?.tagName)) return
      const key = event.key.toLowerCase()
      if (key === 'escape') {
        if (view === 'lab') setView('pause')
        else if (view === 'pause') setView('lab')
        else if (view === 'observation') setView('lab')
      }
      if (key === 'e' && view === 'lab') useObject(focused || target)
      if (key === 'i' && view === 'lab') setInfoId((prev) => prev ? null : (focused || target))
      if (view === 'lab' && ['w', 'a', 's', 'd'].includes(key)) {
        event.preventDefault()
        setCamera((p) => ({ x: Math.max(-18, Math.min(18, p.x + (key === 'a' ? 11 : key === 'd' ? -11 : 0))), y: Math.max(-13, Math.min(13, p.y + (key === 'w' ? 8 : key === 's' ? -8 : 0))) }))
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [focused, target, useObject, view])

  const reset = () => {
    clearTimeout(timer.current)
    narration.clear(); narratedStage.current = null
    setProgress(EMPTY); setHasSaved(false); setPositions({}); setStirAmount(0); setMoleculeView(false); setAudioPanelOpen(false); setView('intro'); setFeedback(''); setInfoId(null); setBusyId(null); setHands(false); setQuizIndex(0); setQuizChoice(null); setQuizRight(false)
    try { localStorage.removeItem(SAVE_KEY) } catch { /* Restart still works in memory. */ }
  }

  const move = (dx, dy) => setCamera((p) => ({ x: Math.max(-18, Math.min(18, p.x + dx)), y: Math.max(-13, Math.min(13, p.y + dy)) }))
  return <main className="experience" onMouseMove={(event) => {
    if (view !== 'lab' || event.pointerType === 'touch') return
    const rect = event.currentTarget.getBoundingClientRect()
    const dx = ((event.clientX - rect.left) / rect.width - .5) * -10
    const dy = ((event.clientY - rect.top) / rect.height - .5) * -7
    setCamera((p) => ({ ...p, lookX: dx, lookY: dy }))
  }}>
    <div className="room" aria-label="Phòng thí nghiệm sinh học">
      <div className="world" style={{ transform: `translate3d(${camera.x + (camera.lookX || 0)}px, ${camera.y + (camera.lookY || 0)}px, 0) scale(1.035)` }}>
        <div className="ceiling"><div className="ceiling-light"/><div className="ceiling-light second"/></div>
        <div className="back-wall">
          <div className="wall-panel panel-left"><span>PHÒNG THÍ NGHIỆM</span><b>SINH HỌC</b><i>THỰC HÀNH • 02</i></div>
          <div className="window"><div className="window-glow"/><i className="window-frame v"/><i className="window-frame h"/><span>ÁNH SÁNG TỰ NHIÊN</span></div>
          <div className="cabinet"><i/><i/><i/><i/></div>
          <div className="wall-shelf"><span/><span/><span/><span/><span/><small>DỤNG CỤ THỦY TINH</small></div>
          <div className="sink"><i/><b/><span/></div>
          <div className="back-counter"><i className="counter-edge"/><div className="counter-bottle bottle-one"/><div className="counter-bottle bottle-two"/><div className="counter-stack"/></div>
          <div className="tile-grid"/>
        </div>
        <div className="floor"><div className="floor-grid"/><div className="floor-reflection"/></div>
        <div className="bench">
          <div className="bench-back"/>
          <div className="bench-top"><div className="bench-gloss"/>
            {Object.keys(OBJECTS).map((id) => {
              const [x, y] = POSITIONS[id]
              const [mx, my] = MOBILE_POSITIONS[id]
              return <LabProp key={id} id={id} progress={progress} busyId={busyId} target={target} stirAmount={stirAmount} onStir={setStirAmount} position={positions[id] || { x: Number.parseFloat(x), y: Number.parseFloat(y), mx: Number.parseFloat(mx), my: Number.parseFloat(my) }} onMove={(key, position) => setPositions((prev) => ({ ...prev, [key]: position }))} onUse={useObject} onFocus={setFocused}/>
            })}
          </div>
          <div className="bench-face"><div className="drawer d1"/><div className="drawer d2"/><div className="drawer d3"/><div className="drawer d4"/><div className="drawer-handle h1"/><div className="drawer-handle h2"/><div className="bench-leg left"/><div className="bench-leg right"/></div>
        </div>
      </div>
      <div className="room-grain"/>
      <div className="vignette"/>
      <div className="crosshair" aria-hidden="true"><i/><b/></div>

      {(view === 'intro' || view === 'safety') && <div className="entry-overlay">
        <div className="entry-kicker"><span className="status-dot"/> MÔ PHỎNG THỰC HÀNH • SINH HỌC PHÂN TỬ</div>
        {view === 'intro' ? <><div className="entry-content"><p className="entry-index">BÀI THỰC HÀNH&nbsp; / &nbsp;01</p><h1>Tách chiết<br/><em>DNA từ chuối</em></h1><p className="entry-copy">Tự tay thực hiện từng công đoạn trong phòng thí nghiệm. Quan sát cách vật liệu di truyền được giải phóng và kết tủa.</p><div className="entry-meta"><span><b>06</b> công đoạn</span><span/><span><b>~12</b> phút</span><span/><span>GÓC NHÌN THỨ NHẤT</span></div><button className="primary-action" onClick={() => hasSaved ? startLab() : setView('safety')}>{hasSaved ? 'Tiếp tục thí nghiệm' : 'Vào phòng thí nghiệm'} <span>→</span></button>{hasSaved && <button className="text-action" onClick={reset}>Bắt đầu lượt mới</button>}<p className="control-note">W A S D di chuyển <i/> CHUỘT nhìn quanh <i/> E thao tác</p></div><aside className="project-credits"><small>THÔNG TIN NHÓM</small><h2>THPT Nguyễn Đình Chiểu</h2><p>Vĩnh Long (Bến Tre cũ) · Lớp 12/2</p><ul><li>Lữ Nhật Duy</li><li>Nguyễn Thanh Ngọc</li><li>Nguyễn Thị Thúy Kiều</li><li>Nguyễn Tăng Thanh Vy</li><li>Đinh Hồng Vy</li></ul><div className="tool-credits"><small>CÔNG CỤ HỖ TRỢ XÂY DỰNG</small><p>Codex · Claude · ChatGPT · các GPT</p></div></aside></> : <div className="safety-card"><p className="entry-index">TRƯỚC KHI BẮT ĐẦU</p><h2>An toàn trước.<br/><em>Quan sát kỹ.</em></h2><ul><li><b>01</b><span>Đeo găng tay và giữ khu vực thao tác gọn gàng.</span></li><li><b>02</b><span>Ethanol mô phỏng là chất dễ cháy; tránh xa ngọn lửa.</span></li><li><b>03</b><span>Không nếm mẫu hay hóa chất. Thu gom bã vào khay chất thải.</span></li><li><b>04</b><span>Trong phòng thí nghiệm thật, luôn làm theo hướng dẫn của giáo viên.</span></li></ul><label className="narration-start"><input type="checkbox" checked={narration.enabled} onChange={(event) => narration.setEnabled(event.target.checked)}/> Bật thuyết minh tiếng Việt</label><button className="primary-action" onClick={startLab}>Đã hiểu · Bắt đầu <span>→</span></button><button className="text-action" onClick={() => setView('intro')}>Quay lại</button></div>}
        <div className="entry-footer"><span>VIRTUAL BIOLOGY LAB</span><span>HỌC TỪ THỰC HÀNH</span></div>
      </div>}

      {(view === 'lab' || view === 'pause') && <>
        <header className="hud-top">
          <div className="lab-mark"><span className="mark">B<span>·</span></span><div><b>LAB / 02</b><small>THỰC HÀNH SINH HỌC</small></div></div>
          <div className="stage-strip" aria-label={`Giai đoạn ${progress.stage} trên 6`}>{STAGES.map((s, i) => <span key={s[0]} className={`${progress.stage === i + 1 ? 'current' : ''} ${progress.stage > i + 1 ? 'past' : ''}`}><i/>{i === 0 && <small>MẪU</small>}</span>)}</div>
          <button type="button" className="narration-toggle" aria-expanded={audioPanelOpen} onClick={() => setAudioPanelOpen((open) => !open)}><span>♫</span><b>LỜI DẪN</b>{narration.isSpeaking && <i/>}</button>
          <button type="button" className="pause-button" onClick={() => setView(view === 'pause' ? 'lab' : 'pause')}><i/><span>{view === 'pause' ? 'Tiếp tục' : 'Tạm dừng'}</span></button>
        </header>
        {audioPanelOpen && <aside className="audio-panel" aria-label="Cài đặt thuyết minh">
          <p>THUYẾT MINH · TIẾNG VIỆT</p>
          <label><input type="checkbox" checked={narration.enabled} onChange={(event) => narration.setEnabled(event.target.checked)}/> Bật giọng đọc</label>
          <label><input type="checkbox" checked={narration.subtitlesEnabled} onChange={(event) => narration.setSubtitles(event.target.checked)}/> Hiện phụ đề</label>
          <label className="audio-slider">Âm lượng <input aria-label="Âm lượng giọng đọc" type="range" min="0" max="1" step="0.05" value={narration.volume} onChange={(event) => narration.setVolume(event.target.value)}/></label>
          <label className="audio-slider">Tốc độ <input aria-label="Tốc độ giọng đọc" type="range" min="0.75" max="1.25" step="0.05" value={narration.rate} onChange={(event) => narration.setRate(event.target.value)}/></label>
          <div className="audio-actions"><button type="button" disabled={!narration.currentText} onClick={narration.isPaused ? narration.resume : narration.pause}>{narration.isPaused ? 'Tiếp tục' : 'Tạm dừng'}</button><button type="button" disabled={!narration.currentText} onClick={narration.replay}>Phát lại</button></div>
          <small role="status">{narration.status || (narration.voiceAvailable ? `Sẵn sàng · ${narration.voiceName}` : narration.voicesLoaded ? 'Chưa có giọng tiếng Việt trên thiết bị.' : 'Đang tìm giọng tiếng Việt…')}</small>
        </aside>}
        <div className="stage-card"><span className="stage-number">{currentStage[0]}</span><div><small>GIAI ĐOẠN {currentStage[0]} / 06</small><b>{currentStage[1]}</b></div><div className="stage-progress"><i style={{ width: `${(progress.done.length / 12) * 100}%` }}/></div></div>
        <button className={`inventory-toggle ${inventoryOpen ? 'opened' : ''}`} onClick={() => setInventoryOpen(!inventoryOpen)}><span className="inventory-icon">▤</span><span>DỤNG CỤ <b>{progress.inventory.length.toString().padStart(2, '0')}</b></span><i>{inventoryOpen ? '−' : '+'}</i></button>
        {inventoryOpen && <div className="inventory-panel"><small>ĐÃ THU THẬP</small>{progress.inventory.length ? progress.inventory.map((item) => <span key={item}><i/> {item}</span>) : <p>Dụng cụ sẽ xuất hiện tại đây khi bạn thao tác.</p>}</div>}
        <div className="objective"><span className="objective-mark">{busyId ? <i className="spinner"/> : <i/>}</span><div><small>{busyId ? 'ĐANG THAO TÁC' : 'NHIỆM VỤ HIỆN TẠI'}</small><p>{feedback || stageHint}{target === 'rod' && stirAmount > 0 && !busyId ? ` · Vòng khuấy ${Math.round(stirAmount)}%` : ''}</p></div><span className="objective-key">{busyId ? '···' : 'E'}</span></div>
        {narration.subtitlesEnabled && narration.currentText && (view === 'lab') && <div key={narration.currentText} className="narration-subtitle" role="status" aria-live="polite"><small>THUYẾT MINH</small><p>{narration.currentText}</p></div>}
        {focused && view === 'lab' && <div className="focus-readout"><span className="focus-dot"/><span>{OBJECTS[focused].name}</span><small>{focused === target ? 'E  ·  DÙNG' : 'I  ·  TÌM HIỂU'}</small></div>}
        {objectInfo && infoId && <aside className="science-card"><button aria-label="Đóng thông tin" onClick={() => setInfoId(null)}>×</button><small>GHI CHÚ KHOA HỌC · {objectInfo.kind.toUpperCase()}</small><h3>{objectInfo.name}</h3><p>{objectInfo.detail}</p></aside>}
        {hands && <div className={`hands hands-${busyId}`} aria-hidden="true"><i className="forearm left-arm"/><i className="hand left-hand"/><i className="forearm right-arm"/><i className="hand right-hand"/><i className="hand-thumb"/></div>}
        <div className="bottom-instructions"><span><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> DI CHUYỂN</span><i/><span>CHUỘT · NHÌN / CHỌN</span><i/><span><kbd>E</kbd> TƯƠNG TÁC</span><i/><span>KÉO · DI CHUYỂN DỤNG CỤ</span></div>
        <div className="touch-controls"><div className="dpad"><button onClick={() => move(0, 8)}>↑</button><button onClick={() => move(10, 0)}>←</button><button onClick={() => move(0, -8)}>↓</button><button onClick={() => move(-10, 0)}>→</button></div><button className="touch-use" onClick={() => useObject(focused || target)}>{busyId ? '···' : 'E'}<small>TƯƠNG TÁC</small></button></div>
        {view === 'pause' && <div className="modal-shade"><div className="pause-card"><p className="entry-index">TẠM DỪNG · TIẾN ĐỘ ĐÃ LƯU</p><h2>Phòng thí nghiệm<br/><em>đang chờ bạn.</em></h2><p>Tiến độ hiện tại được lưu trên thiết bị này.</p><button className="primary-action" onClick={() => setView('lab')}>Tiếp tục thao tác <span>→</span></button><button className="text-action" onClick={reset}>Bắt đầu lại thí nghiệm</button></div></div>}
      </>}

      {view === 'observation' && <div className="observation-overlay">
        {moleculeView ? <div className="molecule-view"><small>MINH HỌA KHÁI NIỆM · KHÔNG PHẢI ẢNH THỰC</small><svg viewBox="0 0 220 360" role="img" aria-label="Minh họa khái niệm xoắn kép DNA"><path d="M55 18 C175 58 45 98 165 138 S45 218 165 258 S45 318 165 348"/><path d="M165 18 C45 58 175 98 55 138 S175 218 55 258 S175 318 55 348"/>{Array.from({ length: 11 }, (_, i) => <line key={i} x1={72 + (i % 2) * 18} y1={35 + i * 29} x2={148 - (i % 2) * 18} y2={35 + i * 29}/>)}</svg><p>Cấu trúc này được phóng đại để minh họa. Mắt thường không thể phân giải từng xoắn kép trong mẫu.</p></div> : <div className="zoom-scene"><div className="zoom-rim"/><div className="zoom-liquid"><i className="dna-fiber f1"/><i className="dna-fiber f2"/><i className="dna-fiber f3"/><i className="dna-fiber f4"/><i className="dna-fiber f5"/></div><div className="zoom-glass-glint"/></div>}
        <div className="observation-copy"><small>QUAN SÁT CUỐI · 06 / 06</small><h2>{moleculeView ? <>Minh họa<br/><em>xoắn kép DNA.</em></> : <>Một lớp trắng<br/><em>đục, dạng sợi.</em></>}</h2><p>{moleculeView ? 'Đây là mô hình khái niệm ở cấp độ phân tử, không phải thứ nhìn thấy trực tiếp trong ống nghiệm.' : 'Đây là vật liệu chứa DNA kết tủa tại ranh giới hai lớp. Các sợi trắng hình thành khi nhiều phân tử và thành phần tế bào kết tụ.'}</p><p className="science-caution">Mẫu không nhất thiết tinh khiết; từng phân tử DNA không thể nhìn thấy bằng mắt thường.</p><button type="button" className="concept-toggle" onClick={() => { const next = !moleculeView; setMoleculeView(next); narration.speak(next ? MOLECULE_NARRATION : OBSERVATION_NARRATION, next ? MOLECULE_AUDIO : OBSERVATION_AUDIO) }}>{moleculeView ? 'Trở lại quan sát mẫu' : 'Xem minh họa phân tử'}</button><div className="observation-audio"><button type="button" onClick={narration.isPaused ? narration.resume : narration.pause}>{narration.isPaused ? 'Tiếp tục lời dẫn' : 'Tạm dừng lời dẫn'}</button><button type="button" onClick={narration.replay}>Phát lại</button></div><button className="primary-action" onClick={() => { setQuizIndex(0); setQuizChoice(null); setQuizRight(false); setView('assessment') }}>Tiếp tục · Kiểm tra kiến thức <span>→</span></button></div>
        {narration.subtitlesEnabled && narration.currentText && <div key={narration.currentText} className="narration-subtitle observation-subtitle" role="status" aria-live="polite"><small>THUYẾT MINH</small><p>{narration.currentText}</p></div>}
        <button className="close-observation" onClick={() => setView('lab')}>× <span>Quay lại bàn thao tác</span></button></div>}

      {view === 'assessment' && <div className="modal-shade"><div className="quiz-card"><p className="entry-index">KIỂM TRA NHANH · {String(quizIndex + 1).padStart(2, '0')} / 03</p><div className="quiz-progress"><i style={{ width: `${((quizIndex + (quizRight ? 1 : 0)) / QUIZ.length) * 100}%` }}/></div><h2>{QUIZ[quizIndex].q}</h2><div className="quiz-options">{QUIZ[quizIndex].a.map((answer, i) => <button key={answer} className={`${quizChoice === i ? 'chosen' : ''} ${quizRight && i === QUIZ[quizIndex].correct ? 'correct' : ''}`} onClick={() => { setQuizChoice(i); setQuizRight(i === QUIZ[quizIndex].correct) }}><span>{String.fromCharCode(65 + i)}</span>{answer}{quizChoice === i && <b>{quizRight ? '✓' : '↺'}</b>}</button>)}</div>{quizChoice !== null && <p className={`quiz-feedback ${quizRight ? 'right' : ''}`}>{quizRight ? QUIZ[quizIndex].why : 'Chưa đúng. Hãy thử lại và liên hệ vai trò của từng chất với bước tách chiết.'}</p>}<button className="primary-action" disabled={!quizRight} onClick={() => { if (quizIndex === QUIZ.length - 1) setView('complete'); else { setQuizIndex(quizIndex + 1); setQuizChoice(null); setQuizRight(false) } }}>{quizIndex === QUIZ.length - 1 ? 'Hoàn thành thí nghiệm' : 'Câu tiếp theo'} <span>→</span></button></div></div>}

      {view === 'complete' && <div className="modal-shade completion-shade"><div className="completion-card"><span className="complete-seal"><i/></span><p className="entry-index">HOÀN TẤT · THỰC HÀNH 01</p><h2>Bạn đã tách chiết<br/><em>vật liệu chứa DNA.</em></h2><p>Bạn đã nghiền mẫu, phá vỡ tế bào, lọc hỗn hợp và quan sát DNA kết tủa bằng ethanol lạnh.</p><div className="completion-facts"><span><b>06</b> công đoạn</span><span><b>03/03</b> câu đúng</span><span><b>1</b> mẫu quan sát</span></div><button className="primary-action" onClick={reset}>Thực hiện lại <span>↻</span></button><button className="text-action" onClick={() => setView('lab')}>Quay lại phòng thí nghiệm</button></div></div>}
    </div>
  </main>
}

export default App
