import { STORAGE_KEY } from './utils'

export const creditDefaults = {
  betrag: 150000,
  zins: 4.03,
  rate: 1003,
  hausgeld: 250,
  maxyears: 20,
  bind: 10,
  sonder: `[
  { "month": 12, "amount": 5000 }
]`,
  wechsel: `[
  { "month": 121, "amount": 1003,75 }
]`,
}

export const simpleData = {
  earnings: [{ name: 'Gehalt', amount: 5000 }],
  yearlyBonuses: [],
  monthlyExpenses: {
    Wohnung: [
      { name: 'Miete', amount: 950, fixed: true },
      { name: 'Strom', amount: 70, fixed: true },
    ],
    Leben: [
      { name: 'Lebensmittel', amount: 300, fixed: false },
      { name: 'Mobilfunk', amount: 20, fixed: true },
    ],
  },
  yearlyCosts: [{ name: 'Hausrat', amount: 120 }],
  categoriesOrder: ['Wohnung', 'Leben'],
}

export const sampleData = {
  earnings: [{ name: 'Gehalt', amount: 5000 }],
  yearlyBonuses: [{ name: 'Bonus', amount: 5000 }],
  monthlyExpenses: {
    Wohnung: [
      { name: 'Hausgeld', amount: 250, fixed: true },
      { name: 'Kredit', amount: 900, fixed: true },
      { name: 'Strom', amount: 80, fixed: true },
      { name: 'Lebensmittel', amount: 400, fixed: false },
      { name: 'Internet', amount: 35, fixed: true },
    ],
    Transport: [
      { name: 'KFZ', amount: 50, fixed: true },
      { name: 'Benzin', amount: 160, fixed: false },
      { name: 'Deutschlandticket', amount: 49, fixed: true },
    ],
    Freizeit: [
      { name: 'Reisen', amount: 100, fixed: false },
      { name: 'Entertainment', amount: 40, fixed: false },
    ],
    Abos: [
      { name: 'Netflix', amount: 13.99, fixed: true },
      { name: 'Disney+', amount: 8.99, fixed: true },
      { name: 'Spotify', amount: 10.99, fixed: true },
      { name: 'Kleidung', amount: 60, fixed: false },
    ],
    Investments: [
      { name: 'Krypto', amount: 100, fixed: false },
      { name: 'Aktien', amount: 150, fixed: false },
    ],
    Sparen: [{ name: 'Dauerauftrag Sparen', amount: 300, fixed: true }],
  },
  yearlyCosts: [
    { name: 'Versicherungen', amount: 600 },
    { name: 'Steuern (pauschal)', amount: 300 },
    { name: 'Kfz-Steuer', amount: 150 },
  ],
  categoriesOrder: ['Wohnung', 'Transport', 'Freizeit', 'Abos', 'Investments', 'Sparen'],
}

export function initEmpty() {
  return {
    earnings: [],
    yearlyBonuses: [],
    monthlyExpenses: {},
    yearlyCosts: [],
    categoriesOrder: [],
  }
}

export function loadInitialState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) {
      // default to simple data on first load
      return JSON.parse(JSON.stringify(simpleData))
    }
    const parsed = JSON.parse(raw)

    if (!Array.isArray(parsed.categoriesOrder)) {
      parsed.categoriesOrder = Object.keys(parsed.monthlyExpenses || {})
    }

    Object.keys(parsed.monthlyExpenses || {}).forEach((k) => {
      parsed.monthlyExpenses[k] = (parsed.monthlyExpenses[k] || []).map((r) => ({
        ...r,
        fixed: !!r.fixed,
      }))
    })

    return parsed
  } catch {
    return JSON.parse(JSON.stringify(simpleData))
  }
}
