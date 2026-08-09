export const summerPastelPalettes = [
  ['#f8a68d', '#f6a1a6', '#f284b2', '#cc69a7', '#ec7079'],
  ['#8869a6', '#b88bbe', '#b2bee1', '#91c4e8', '#8095cc'],
  ['#d1a5cc', '#f6dd6e', '#e9bebc', '#75cbe8', '#a9dde4'],
  ['#80bfb0', '#b3ddd2', '#d2dde4', '#f5bd93', '#ef9d6a'],
  ['#fff7ee', '#ffe6c2', '#ead4e2', '#ecb4d0', '#c7a9d1'],
  ['#ef4a5f', '#f9b296', '#fbccc0', '#aed5d7', '#face88'],
  ['#f5cfc7', '#e89897', '#f9b184', '#fecc8b', '#c5bf9b'],
  ['#889f45', '#bcd6a6', '#f8ceb9', '#fcbb3c', '#e57b87'],
  ['#fac4c8', '#ef5585', '#fdd053', '#f9b15f', '#68c8e8'],
  ['#f492ac', '#9ac867', '#f9c7d5', '#fcd849', '#bb9ecb'],
  ['#f2bcd4', '#ffdf92', '#c1e3f8', '#d7b4dc', '#c4c4e1'],
  ['#7fcdc9', '#c3e5de', '#c6e5f1', '#7bccec', '#708aa3'],
  ['#708aa3', '#fbc88d', '#fae3ae', '#a9dddf', '#85cbcd'],
  ['#e35d44', '#f48259', '#f8c071', '#8bd1c8', '#adca63'],
  ['#d2a8b3', '#d2a8b3', '#dae6e4', '#eecf64', '#db9f27'],
] as const

export const colorPalette = {
  summerPastel: summerPastelPalettes,
  section: {
    today: '#68c8e8',
    energy: '#f6a1a6',
    drain: '#d2dde4',
    library: '#8373d8',
    data: '#bcd6a6',
  },
} as const

export type SummerPastelPalette = typeof summerPastelPalettes[number]
