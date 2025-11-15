export const STR = {
  subtotal: 'Subtotal',
  name: 'Name',
  amount: 'Betrag (€)',
  addLine: '+ Zeile',
  fixed: 'Fix',
}

export const THEME_KEY = 'budget-theme'
export const STORAGE_KEY = 'budget-controller-state-v3'

const nfEUR = new Intl.NumberFormat('de-DE', {
  style: 'currency',
  currency: 'EUR',
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export const nfPlain = new Intl.NumberFormat('de-DE', {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})

export function formatEuro(n) {
  const value = Number.isFinite(n) ? n : 0
  return nfEUR.format(value)
}

export function parseEuro(raw) {
  if (raw == null) return { ok: false, value: 0 }
  let s = String(raw).trim()
  if (!s) return { ok: false, value: 0 }

  s = s.replace(/[€\s]/g, '')

  if (/,/.test(s) && /\./.test(s)) {
    const lc = s.lastIndexOf(',')
    const ld = s.lastIndexOf('.')
    if (lc > ld) {
      s = s.replace(/\./g, '').replace(',', '.')
    } else {
      s = s.replace(/,/g, '')
    }
  } else if (/,/.test(s)) {
    s = s.replace(/\./g, '').replace(',', '.')
  }

  const val = Number(s)
  return { ok: Number.isFinite(val) && val >= 0, value: val >= 0 ? val : 0 }
}

export function cssId(s) {
  return s.replace(/\s+/g, '-').replace(/[^\w-]/g, '').toLowerCase()
}

export function sum(arr) {
  return arr.reduce((a, b) => a + (Number.isFinite(b) ? b : 0), 0)
}
