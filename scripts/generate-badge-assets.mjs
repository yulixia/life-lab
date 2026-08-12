import { mkdirSync, writeFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { join } from 'node:path'

const outDir = fileURLToPath(new URL('../public/badges/', import.meta.url))
mkdirSync(outDir, { recursive: true })

const tracks = {
  'ideal-self': {
    label: '理想自我',
    primary: '#5b68c7',
    highlight: '#9fc9ff',
    pale: '#e9efff',
    ink: '#29355b',
    icon: 'ideal',
  },
  'side-hustle': {
    label: '副业探索',
    primary: '#167c70',
    highlight: '#7bd6b2',
    pale: '#e1f6ea',
    ink: '#174d48',
    icon: 'hustle',
  },
}

const levels = {
  l1: { label: '实验印记', shape: 'circle', filename: 'experiment-mark' },
  l3: { label: '持续验证章', shape: 'hex', filename: 'continuous-validation' },
  l9: { label: '深度发现章', shape: 'octagon', filename: 'deep-discovery' },
}

function point(cx, cy, radius, degrees) {
  const radians = ((degrees - 90) * Math.PI) / 180
  return [cx + radius * Math.cos(radians), cy + radius * Math.sin(radians)]
}

function polygon(sides, radius, rotation) {
  return Array.from({ length: sides }, (_, index) => {
    const [x, y] = point(128, 128, radius, rotation + index * (360 / sides))
    return `${index ? 'L' : 'M'} ${x.toFixed(2)} ${y.toFixed(2)}`
  }).join(' ') + ' Z'
}

function shape(shape, radius) {
  if (shape === 'circle') return `<circle cx="128" cy="128" r="${radius}" />`
  if (shape === 'hex') return `<path d="${polygon(6, radius, 30)}" />`
  return `<path d="${polygon(8, radius, 22.5)}" />`
}

function capsuleMarks(litCount, muted) {
  return Array.from({ length: 7 }, (_, index) => {
    const angle = index * (360 / 7)
    const fill = muted ? '#aeb5bd' : index < litCount ? 'url(#accent)' : '#c5ccd3'
    const opacity = muted ? (index < litCount ? 0.7 : 0.38) : index < litCount ? 1 : 0.58
    return `<g transform="rotate(${angle} 128 128)">
        <rect x="124" y="33" width="8" height="14" rx="4" fill="${fill}" opacity="${opacity}" />
        <path d="M126 36 H130" stroke="#ffffff" stroke-width="1.3" stroke-linecap="round" opacity="${index < litCount && !muted ? 0.72 : 0.32}" />
      </g>`
  }).join('\n      ')
}

function idealIcon(active) {
  const opacity = active ? 1 : 0.35
  return `<g opacity="${opacity}" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <g stroke="url(#accent)" stroke-width="4">
        <path d="M128 75 V64" />
        <path d="M105 84 L96 75" />
        <path d="M151 84 L160 75" />
        <path d="M96 106 H84" />
        <path d="M160 106 H172" />
      </g>
      <circle cx="128" cy="96" r="12" fill="url(#accent)" stroke="none" />
      <circle cx="113" cy="126" r="9" fill="${active ? '#ffffff' : '#c7cdd3'}" stroke="${active ? '#ffffff' : '#c7cdd3'}" />
      <path d="M98 166 C101 143 106 135 115 135 C124 135 130 143 133 155 L143 130 L154 134" stroke="${active ? '#ffffff' : '#c7cdd3'}" stroke-width="9" />
      <path d="M101 166 H154" stroke="${active ? '#ffffff' : '#c7cdd3'}" stroke-width="8" />
      <path d="M145 132 L154 134 L151 143" stroke="${active ? '#ffffff' : '#c7cdd3'}" stroke-width="4" />
    </g>`
}

function hustleIcon(active) {
  const opacity = active ? 1 : 0.35
  const light = active ? '#ffffff' : '#c7cdd3'
  return `<g opacity="${opacity}" stroke-linecap="round" stroke-linejoin="round">
      <path d="M80 167 L111 115 L130 144 L147 119 L177 167 Z" fill="url(#mountain)" />
      <path d="M111 115 L118 128 L104 128 Z" fill="${light}" opacity="0.94" />
      <path d="M147 119 L154 132 L140 132 Z" fill="${light}" opacity="0.94" />
      <path d="M96 168 C110 153 118 158 125 150 C134 140 134 129 146 121" fill="none" stroke="${light}" stroke-width="6" />
      <path d="M147 120 V92" fill="none" stroke="${light}" stroke-width="5" />
      <path d="M149 94 L169 101 L149 109 Z" fill="url(#accent)" />
    </g>`
}

function icon(track, active) {
  return track.icon === 'ideal' ? idealIcon(active) : hustleIcon(active)
}

function longTermRing(paused) {
  const stroke = paused ? '#99a1aa' : 'url(#orbit)'
  return `<g fill="none" stroke="${stroke}" stroke-linecap="round" opacity="${paused ? 0.72 : 1}">
      <circle cx="128" cy="128" r="122" stroke-width="5" stroke-dasharray="76 14 23 14" transform="rotate(-34 128 128)" />
      <path d="M96 207 C110 217 146 217 160 207" stroke-width="4" />
      <path d="M122 211 C125 205 131 205 134 211 C137 217 143 217 147 211" stroke-width="3" />
    </g>`
}

function medalSvg({ track, level, litCount = 7, active = true, muted = false, longTerm = false, paused = false, title }) {
  const outer = shape(level.shape, 112)
  const rim = shape(level.shape, 103)
  const well = shape(level.shape, 77)
  const ariaTitle = `${track.label}${title}`
  const stateInk = muted ? '#6f7882' : track.ink

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" role="img" aria-labelledby="title desc">
  <title id="title">${ariaTitle}</title>
  <desc id="desc">人生实验室事项勋章。七枚外圈刻度表示七天验证进度，外形表示解锁等级。</desc>
  <defs>
    <linearGradient id="metal" x1="44" y1="31" x2="211" y2="222" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" />
      <stop offset="0.18" stop-color="#b7c0ca" />
      <stop offset="0.43" stop-color="#f8fafb" />
      <stop offset="0.7" stop-color="#788491" />
      <stop offset="1" stop-color="#edf2f5" />
    </linearGradient>
    <linearGradient id="metalEdge" x1="58" y1="42" x2="196" y2="214" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#71808c" />
      <stop offset="0.4" stop-color="#ffffff" />
      <stop offset="0.72" stop-color="#7b8792" />
      <stop offset="1" stop-color="#f9fbfc" />
    </linearGradient>
    <radialGradient id="enamel" cx="34%" cy="24%" r="90%">
      <stop offset="0" stop-color="#ffffff" />
      <stop offset="0.24" stop-color="${muted ? '#e4e7ea' : track.pale}" />
      <stop offset="1" stop-color="${muted ? '#9ea7b0' : track.primary}" />
    </radialGradient>
    <linearGradient id="accent" x1="99" y1="59" x2="157" y2="190" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${muted ? '#c5cbd1' : track.highlight}" />
      <stop offset="1" stop-color="${muted ? '#747d87' : track.primary}" />
    </linearGradient>
    <linearGradient id="mountain" x1="92" y1="106" x2="165" y2="174" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="${muted ? '#d5d9de' : track.highlight}" />
      <stop offset="1" stop-color="${stateInk}" />
    </linearGradient>
    <linearGradient id="orbit" x1="50" y1="40" x2="206" y2="216" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#ffffff" />
      <stop offset="0.45" stop-color="${track.highlight}" />
      <stop offset="1" stop-color="${track.primary}" />
    </linearGradient>
    <filter id="shadow" x="-24%" y="-24%" width="148%" height="148%">
      <feDropShadow dx="0" dy="8" stdDeviation="7" flood-color="#27323d" flood-opacity="0.22" />
    </filter>
  </defs>
  <g filter="url(#shadow)">
    ${longTerm ? longTermRing(paused) : ''}
    ${outer.replace('/>', 'fill="url(#metal)" />')}
    ${outer.replace('/>', 'fill="none" stroke="#56636f" stroke-width="3" opacity="0.72" />')}
    ${rim.replace('/>', 'fill="none" stroke="url(#metalEdge)" stroke-width="9" />')}
    ${rim.replace('/>', 'fill="none" stroke="#53606c" stroke-width="1.25" opacity="0.5" />')}
    ${capsuleMarks(litCount, muted)}
    ${well.replace('/>', 'fill="url(#enamel)" stroke="#ffffff" stroke-width="2.5" />')}
    ${well.replace('/>', 'fill="none" stroke="#54616e" stroke-width="2" opacity="0.42" />')}
    <path d="M91 93 C112 77 145 76 166 91" fill="none" stroke="#ffffff" stroke-width="5" stroke-linecap="round" opacity="${muted ? 0.25 : 0.48}" />
    ${icon(track, active && !muted)}
    <path d="M72 185 C96 207 159 211 187 182" fill="none" stroke="#4c5965" stroke-width="2" opacity="0.22" />
  </g>
</svg>\n`
}

function write(name, contents) {
  writeFileSync(join(outDir, name), contents, 'utf8')
}

for (const [trackKey, track] of Object.entries(tracks)) {
  for (let day = 1; day <= 7; day += 1) {
    write(`${trackKey}-progress-day-${day}.svg`, medalSvg({
      track, level: levels.l1, litCount: day, active: false, title: `第${day}天解锁态`,
    }))
  }

  write(`${trackKey}-pending-review.svg`, medalSvg({
    track, level: levels.l1, litCount: 7, active: false, title: '待复盘预览',
  }))

  for (const level of Object.values(levels)) {
    write(`${trackKey}-${level.filename}.svg`, medalSvg({
      track, level, litCount: 7, title: level.label,
    }))
  }

  write(`${trackKey}-long-term-active.svg`, medalSvg({
    track, level: levels.l9, litCount: 7, longTerm: true, title: '长期同行',
  }))
  write(`${trackKey}-long-term-paused.svg`, medalSvg({
    track, level: levels.l9, litCount: 7, longTerm: true, paused: true, muted: true, title: '长期同行暂停',
  }))
}

write('terminated-experiment-trail.svg', medalSvg({
  track: { ...tracks['ideal-self'], label: '已终止事项' },
  level: levels.l1,
  litCount: 3,
  active: false,
  muted: true,
  title: '实验轨迹',
}))

const manifest = {
  version: 2,
  generatedAt: '2026-08-11',
  basePath: '/badges/',
  tracks: Object.fromEntries(Object.keys(tracks).map((trackKey) => [trackKey, {
    progress: Object.fromEntries(Array.from({ length: 7 }, (_, index) => [index + 1, `${trackKey}-progress-day-${index + 1}.svg`])),
    pendingReview: `${trackKey}-pending-review.svg`,
    levels: {
      experimentMark: `${trackKey}-experiment-mark.svg`,
      continuousValidation: `${trackKey}-continuous-validation.svg`,
      deepDiscovery: `${trackKey}-deep-discovery.svg`,
    },
    longTerm: {
      active: `${trackKey}-long-term-active.svg`,
      paused: `${trackKey}-long-term-paused.svg`,
    },
  }])),
  terminatedTrail: 'terminated-experiment-trail.svg',
}

write('manifest.json', `${JSON.stringify(manifest, null, 2)}\n`)
