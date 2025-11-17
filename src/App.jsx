import React, { useEffect, useMemo, useState } from 'react'
import Row from './components/Row.jsx'
import Charts from './components/Charts.jsx'
import { STR, STORAGE_KEY, THEME_KEY, cssId, formatEuro, sum } from './utils'
import { initEmpty, loadInitialState, simpleData, sampleData } from './data'
import CreditController from './components/CreditController.jsx'

function Kpi({ label, value, good, bad }) {
  const cls = ['kpi']
  if (good) cls.push('good')
  if (bad) cls.push('bad')
  return (
    <div className={cls.join(' ')} aria-live="polite">
      <div className="label">{label}</div>
      <div className="value">{value}</div>
    </div>
  )
}

export default function App() {
  const [state, setState] = useState(loadInitialState)
  const [theme, setTheme] = useState('light')
  const [activeView, setActiveView] = useState('budget') // 'budget' | 'credit'

  // Theme init
  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY)
      const next = saved === 'dark' ? 'dark' : 'light'
      setTheme(next)
      document.body.setAttribute('data-theme', next)
    } catch {
      document.body.setAttribute('data-theme', 'light')
    }
  }, [])

  // Persist state
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
    } catch {
      // ignore
    }
  }, [state])

  const toggleTheme = () => {
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    document.body.setAttribute('data-theme', next)
    try {
      localStorage.setItem(THEME_KEY, next)
    } catch {
      // ignore
    }
  }

  // ---- Derived values & sums ----
  const {
    earnBase,
    earnBonusMonthly,
    earnTotalMonthly,
    monthlyYearlyPortion,
    expensesTotal,
    fixedMonthly,
    flexibleMonthly,
    net,
    savingsRate,
    breakdownList,
  } = useMemo(() => {
    const sumEarningsBase = () => sum((state.earnings || []).map((x) => x.amount || 0))
    const sumBonusesMonthly = () =>
      sum((state.yearlyBonuses || []).map((x) => (x.amount || 0) / 12))

    const sumCategoryInner = (cat) =>
      sum((state.monthlyExpenses[cat] || []).map((r) => r.amount || 0))

    const sumYearlyMonthlyPortion = () =>
      sum((state.yearlyCosts || []).map((x) => (x.amount || 0) / 12))

    const sumFixedMonthlyPortion = () => {
      const fixedMo = sum(
        state.categoriesOrder.map((cat) =>
          sum(
            (state.monthlyExpenses[cat] || [])
              .filter((r) => r.fixed)
              .map((r) => r.amount || 0),
          ),
        ),
      )
      return fixedMo + sumYearlyMonthlyPortion() // yearly = fixed
    }

    const earnBaseVal = sumEarningsBase()
    const earnBonusMoVal = sumBonusesMonthly()
    const earnTotalMoVal = earnBaseVal + earnBonusMoVal

    const monthlyYearly = sumYearlyMonthlyPortion()
    const monthlyOnlyVal = sum(state.categoriesOrder.map((cat) => sumCategoryInner(cat)))
    const expVal = monthlyOnlyVal + monthlyYearly

    const fixedMo = sumFixedMonthlyPortion()
    const flexibleMo = Math.max(0, expVal - fixedMo)

    const netVal = earnTotalMoVal - expVal
    const sr = earnTotalMoVal > 0 ? (netVal / earnTotalMoVal) * 100 : 0

    const breakdown = state.categoriesOrder
      .map((cat) => ({ cat, total: sumCategoryInner(cat) }))
      .sort((a, b) => b.total - a.total)

    return {
      earnBase: earnBaseVal,
      earnBonusMonthly: earnBonusMoVal,
      earnTotalMonthly: earnTotalMoVal,
      monthlyYearlyPortion: monthlyYearly,
      expensesTotal: expVal,
      fixedMonthly: fixedMo,
      flexibleMonthly: flexibleMo,
      net: netVal,
      savingsRate: sr,
      breakdownList: breakdown,
    }
  }, [state])

  const sumCategory = (cat) => {
    return sum((state.monthlyExpenses[cat] || []).map((r) => r.amount || 0))
  }

  // ---- Actions ----
  const addEarning = () => {
    setState((prev) => ({
      ...prev,
      earnings: [...prev.earnings, { name: '', amount: 0 }],
    }))
  }

  const addBonus = () => {
    setState((prev) => ({
      ...prev,
      yearlyBonuses: [...prev.yearlyBonuses, { name: '', amount: 0 }],
    }))
  }

  const addYearly = () => {
    setState((prev) => ({
      ...prev,
      yearlyCosts: [...prev.yearlyCosts, { name: '', amount: 0 }],
    }))
  }

  const addCategoryAt = (index) => {
    const name = window.prompt('Neue Kategorie:')
    if (!name) return
    if (state.monthlyExpenses[name]) {
      window.alert('Kategorie existiert bereits.')
      return
    }
    setState((prev) => {
      const categoriesOrder = [...prev.categoriesOrder]
      const idx = Math.max(0, Math.min(categoriesOrder.length, index ?? categoriesOrder.length))
      categoriesOrder.splice(idx, 0, name)
      return {
        ...prev,
        monthlyExpenses: { ...prev.monthlyExpenses, [name]: [] },
        categoriesOrder,
      }
    })
  }

  const moveCategory = (i, delta) => {
    setState((prev) => {
      const j = i + delta
      if (j < 0 || j >= prev.categoriesOrder.length) return prev
      const categoriesOrder = [...prev.categoriesOrder]
      const [x] = categoriesOrder.splice(i, 1)
      categoriesOrder.splice(j, 0, x)
      return { ...prev, categoriesOrder }
    })
  }

  const renameCategory = (oldName) => {
    const next = window.prompt('Kategorie umbenennen:', oldName)
    if (!next || next === oldName) return
    if (state.monthlyExpenses[next]) {
      window.alert('Kategorie existiert bereits.')
      return
    }
    setState((prev) => {
      const monthlyExpenses = { ...prev.monthlyExpenses }
      monthlyExpenses[next] = monthlyExpenses[oldName]
      delete monthlyExpenses[oldName]
      const categoriesOrder = prev.categoriesOrder.map((c) => (c === oldName ? next : c))
      return { ...prev, monthlyExpenses, categoriesOrder }
    })
  }

  const deleteCategory = (cat) => {
    if (!window.confirm(`Kategorie "${cat}" löschen?`)) return
    setState((prev) => {
      const monthlyExpenses = { ...prev.monthlyExpenses }
      delete monthlyExpenses[cat]
      const categoriesOrder = prev.categoriesOrder.filter((c) => c !== cat)
      return { ...prev, monthlyExpenses, categoriesOrder }
    })
  }

  const addExpenseLine = (cat) => {
    setState((prev) => ({
      ...prev,
      monthlyExpenses: {
        ...prev.monthlyExpenses,
        [cat]: [...(prev.monthlyExpenses[cat] || []), { name: '', amount: 0, fixed: false }],
      },
    }))
  }

  const setSimpleData = () => {
    if (!window.confirm('Simple Data laden und Ihre Daten ersetzen?')) return
    setState(JSON.parse(JSON.stringify(simpleData)))
  }

  const setSampleData = () => {
    if (!window.confirm('Beispieldaten laden und Ihre Daten ersetzen?')) return
    setState(JSON.parse(JSON.stringify(sampleData)))
  }

  const resetAll = () => {
    if (!window.confirm('Alle Daten löschen?')) return
    setState(initEmpty())
  }

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'budget-data.json'
    a.click()
    setTimeout(() => URL.revokeObjectURL(url), 0)
  }

  const importJson = async (event) => {
    const file = event.target.files?.[0]
    if (!file) return
    try {
      const text = await file.text()
      const data = JSON.parse(text)
      const base = initEmpty()
      base.earnings = Array.isArray(data.earnings)
        ? data.earnings.map((r) => ({ name: String(r?.name || ''), amount: +r?.amount || 0 }))
        : []
      base.yearlyBonuses = Array.isArray(data.yearlyBonuses)
        ? data.yearlyBonuses.map((r) => ({ name: String(r?.name || ''), amount: +r?.amount || 0 }))
        : []
      base.monthlyExpenses =
        typeof data.monthlyExpenses === 'object' && data.monthlyExpenses ? data.monthlyExpenses : {}
      Object.keys(base.monthlyExpenses).forEach((k) => {
        base.monthlyExpenses[k] = (base.monthlyExpenses[k] || []).map((r) => ({
          name: String(r?.name || ''),
          amount: +r?.amount || 0,
          fixed: !!r?.fixed,
        }))
      })
      base.yearlyCosts = Array.isArray(data.yearlyCosts)
        ? data.yearlyCosts.map((r) => ({ name: String(r?.name || ''), amount: +r?.amount || 0 }))
        : []
      base.categoriesOrder = Array.isArray(data.categoriesOrder)
        ? data.categoriesOrder.slice()
        : Object.keys(base.monthlyExpenses)
      setState(base)
    } catch {
      window.alert('Ungültiges JSON.')
    } finally {
      event.target.value = ''
    }
  }

  const handleCollapseAll = () => {
    document.querySelectorAll('details.cat').forEach((d) => {
      d.open = false
    })
  }

  const handleExpandAll = () => {
    document.querySelectorAll('details.cat').forEach((d) => {
      d.open = true
    })
  }

  // ---- Projection rows ----
  const projectionRows = [
    ['Einnahmen ges.', formatEuro(earnTotalMonthly * 12)],
    ['Ausgaben ges.', formatEuro(expensesTotal * 12)],
    ['Netto', formatEuro(net * 12)],
  ]

  return (
    <>
      {/* Top navigation menu */}
      <nav className="app-nav">
        <div className="nav-left">
          <button
            type="button"
            className={activeView === 'budget' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveView('budget')}
          >
            💰 MBC
          </button>
          <button
            type="button"
            className={activeView === 'credit' ? 'nav-item active' : 'nav-item'}
            onClick={() => setActiveView('credit')}
          >
            📉 CC
          </button>
        </div>

        <div className="nav-right">
          <button
            type="button"
            className="nav-theme-btn"
            title="Licht/Dunkel"
            onClick={toggleTheme}
          >
            🌙/☀️
          </button>
        </div>
      </nav>

      {activeView === 'budget' ? (
        <div className="credit-root">
          <header className="credit-header">
            <div className="header-inner">
              <div className="title">
                <h1>Monatliches Budget – Rechner &amp; Visualisierung</h1>
              </div>
            </div>
            <div className="summary-inner">
              <div className="kpis" role="region" aria-label="KPIs">
                <Kpi label="Einnahmen (inkl. Boni)" value={formatEuro(earnTotalMonthly)} />
                <Kpi label="Ausgaben" value={formatEuro(expensesTotal)} />
                <Kpi
                  label="Netto"
                  value={formatEuro(net)}
                  good={net >= 0}
                  bad={net < 0}
                />
                <Kpi
                  label="Sparrate"
                  value={`${savingsRate.toFixed(1)}%`}
                  good={savingsRate >= 20}
                  bad={savingsRate < 0}
                />
              </div>

              <div className="tools">
                {/* Data dropdown */}
                <div className="dropdown">
                  <button
                    type="button"
                    className="dropdown-toggle"
                  >
                    Data ▾
                  </button>

                  <div className="dropdown-menu">
                    <button
                      id="btn-simple"
                      type="button"
                      onClick={setSimpleData}
                    >
                      Simple Data
                    </button>
                    <button
                      id="btn-sample"
                      type="button"
                      onClick={setSampleData}
                      title="Beispieldaten laden"
                    >
                      Beispiel (groß)
                    </button>
                    <button
                      id="btn-reset"
                      className="danger"
                      type="button"
                      onClick={resetAll}
                      title="Alle Daten löschen"
                    >
                      Reset
                    </button>
                  </div>
                </div>

                {/* Export / Import stays like before */}
                <div className="btn-row" style={{ margin: 0 }}>
                  <button id="btn-export-json" type="button" onClick={exportJson}>
                    Export JSON
                  </button>
                  <label
                    htmlFor="file-import"
                    className="chip"
                    style={{ cursor: 'pointer' }}
                    title="Import JSON"
                  >
                    <span>Import JSON</span>
                    <input
                      id="file-import"
                      className="sr-only"
                      type="file"
                      accept="application/json"
                      onChange={importJson}
                    />
                  </label>
                </div>
              </div>
            </div>
          </header>

          <main id="app" role="main">
            {/* Einnahmen */}
            <section className="card" aria-labelledby="sec-earnings">
              <div className="head">
                <div className="title" id="sec-earnings">
                  Monatliche Einnahmen
                </div>
                <span className="chip" id="earnings-chips">
                  <span id="chip-earn-base">Basis: {formatEuro(earnBase)}</span> |{' '}
                  <span id="chip-earn-bonus">+ Boni /mo: {formatEuro(earnBonusMonthly)}</span> |{' '}
                  <b id="chip-earn-total">Gesamt: {formatEuro(earnTotalMonthly)}</b>
                </span>
              </div>
              <div className="body">
                <div id="earnings-rows" className="rows">
                  {state.earnings.map((row, idx) => (
                    <Row
                      key={idx}
                      id={`earn-${idx}`}
                      name={row.name}
                      amount={row.amount}
                      onName={(v) =>
                        setState((prev) => {
                          const earnings = [...prev.earnings]
                          earnings[idx] = { ...earnings[idx], name: v }
                          return { ...prev, earnings }
                        })
                      }
                      onAmount={(v) =>
                        setState((prev) => {
                          const earnings = [...prev.earnings]
                          earnings[idx] = { ...earnings[idx], amount: v }
                          return { ...prev, earnings }
                        })
                      }
                      onDelete={() =>
                        setState((prev) => {
                          const earnings = prev.earnings.filter((_, i) => i !== idx)
                          return { ...prev, earnings }
                        })
                      }
                    />
                  ))}
                </div>
                <div className="btn-row">
                  <button id="add-earning" type="button" onClick={addEarning}>
                    + Einnahme
                  </button>
                </div>
              </div>
            </section>

            {/* Boni */}
            <section className="card" aria-labelledby="sec-bonuses">
              <div className="head">
                <div className="title" id="sec-bonuses">
                  Jährliche Boni (auto /12)
                </div>
                <span className="chip" id="bonuses-subtotal">
                  {formatEuro(earnBonusMonthly)} / Monat
                </span>
              </div>
              <div className="body">
                <div id="bonus-rows" className="rows">
                  {state.yearlyBonuses.map((row, idx) => (
                    <Row
                      key={idx}
                      id={`bonus-${idx}`}
                      name={row.name}
                      amount={row.amount}
                      hintRight={`→ ${formatEuro((row.amount || 0) / 12)} / mo`}
                      onName={(v) =>
                        setState((prev) => {
                          const yearlyBonuses = [...prev.yearlyBonuses]
                          yearlyBonuses[idx] = { ...yearlyBonuses[idx], name: v }
                          return { ...prev, yearlyBonuses }
                        })
                      }
                      onAmount={(v) =>
                        setState((prev) => {
                          const yearlyBonuses = [...prev.yearlyBonuses]
                          yearlyBonuses[idx] = { ...yearlyBonuses[idx], amount: v }
                          return { ...prev, yearlyBonuses }
                        })
                      }
                      onDelete={() =>
                        setState((prev) => {
                          const yearlyBonuses = prev.yearlyBonuses.filter((_, i) => i !== idx)
                          return { ...prev, yearlyBonuses }
                        })
                      }
                    />
                  ))}
                </div>
                <div className="btn-row">
                  <button id="add-bonus" type="button" onClick={addBonus}>
                    + Bonus
                  </button>
                </div>
              </div>
            </section>

            {/* Ausgaben */}
            <section className="card" aria-labelledby="sec-expenses">
              <div className="head">
                <div className="title">Monatliche Ausgaben</div>
                <span className="chip" id="expenses-subtotal">
                  {formatEuro(expensesTotal)}
                </span>
              </div>
              <div className="body" id="expenses-body">
                {state.categoriesOrder.map((catName, i) => {
                  const total = sumCategory(catName)
                  return (
                    <details className="cat" key={catName} data-cat={catName} open>
                      <summary className="cat-summary">
                        <div className="cat-title">
                          <h4>{catName}</h4>
                          <span className="chip">
                            Subtotal:{' '}
                            <b id={`sub-${cssId(catName)}`}>{formatEuro(total)}</b>
                          </span>
                        </div>
                        <div className="cat-actions">
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => renameCategory(catName)}
                          >
                            Umbenennen
                          </button>
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => addExpenseLine(catName)}
                          >
                            Zeile
                          </button>
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => addCategoryAt(i)}
                          >
                            Kat. oben
                          </button>
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => addCategoryAt(i + 1)}
                          >
                            Kat. unten
                          </button>
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => moveCategory(i, -1)}
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            className="linklike"
                            onClick={() => moveCategory(i, 1)}
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            className="linklike danger"
                            onClick={() => deleteCategory(catName)}
                          >
                            Löschen
                          </button>
                        </div>
                      </summary>
                      <div className="cat-content">
                        <div className="rows">
                          {(state.monthlyExpenses[catName] || []).map((row, idx) => (
                            <Row
                              key={idx}
                              id={`exp-${cssId(catName)}-${idx}`}
                              name={row.name}
                              amount={row.amount}
                              showFixed
                              fixed={!!row.fixed}
                              onName={(v) =>
                                setState((prev) => {
                                  const monthlyExpenses = { ...prev.monthlyExpenses }
                                  const rows = [...(monthlyExpenses[catName] || [])]
                                  rows[idx] = { ...rows[idx], name: v }
                                  monthlyExpenses[catName] = rows
                                  return { ...prev, monthlyExpenses }
                                })
                              }
                              onAmount={(v) =>
                                setState((prev) => {
                                  const monthlyExpenses = { ...prev.monthlyExpenses }
                                  const rows = [...(monthlyExpenses[catName] || [])]
                                  rows[idx] = { ...rows[idx], amount: v }
                                  monthlyExpenses[catName] = rows
                                  return { ...prev, monthlyExpenses }
                                })
                              }
                              onFixed={(val) =>
                                setState((prev) => {
                                  const monthlyExpenses = { ...prev.monthlyExpenses }
                                  const rows = [...(monthlyExpenses[catName] || [])]
                                  rows[idx] = { ...rows[idx], fixed: !!val }
                                  monthlyExpenses[catName] = rows
                                  return { ...prev, monthlyExpenses }
                                })
                              }
                              onDelete={() =>
                                setState((prev) => {
                                  const monthlyExpenses = { ...prev.monthlyExpenses }
                                  const rows = (monthlyExpenses[catName] || []).filter(
                                    (_, i2) => i2 !== idx,
                                  )
                                  monthlyExpenses[catName] = rows
                                  return { ...prev, monthlyExpenses }
                                })
                              }
                            />
                          ))}
                        </div>
                        <div className="btn-row">
                          <button type="button" onClick={() => addExpenseLine(catName)}>
                            {STR.addLine}
                          </button>
                        </div>
                      </div>
                    </details>
                  )
                })}
                <div className="btn-row">
                  <button
                    id="add-category-bottom"
                    type="button"
                    onClick={() => addCategoryAt(state.categoriesOrder.length)}
                  >
                    + Kategorie
                  </button>
                </div>
              </div>
            </section>

            {/* Jährliche Kosten */}
            <section className="card" aria-labelledby="sec-yearly">
              <div className="head">
                <div className="title" id="sec-yearly">
                  Jährliche Kosten (auto /12)
                </div>
                <span className="chip" id="yearly-subtotal">
                  {formatEuro(monthlyYearlyPortion)} / Monat
                </span>
              </div>
              <div className="body">
                <div id="yearly-rows" className="rows">
                  {state.yearlyCosts.map((row, idx) => (
                    <Row
                      key={idx}
                      id={`yearly-${idx}`}
                      name={row.name}
                      amount={row.amount}
                      hintRight={`→ ${formatEuro((row.amount || 0) / 12)} / mo`}
                      onName={(v) =>
                        setState((prev) => {
                          const yearlyCosts = [...prev.yearlyCosts]
                          yearlyCosts[idx] = { ...yearlyCosts[idx], name: v }
                          return { ...prev, yearlyCosts }
                        })
                      }
                      onAmount={(v) =>
                        setState((prev) => {
                          const yearlyCosts = [...prev.yearlyCosts]
                          yearlyCosts[idx] = { ...yearlyCosts[idx], amount: v }
                          return { ...prev, yearlyCosts }
                        })
                      }
                      onDelete={() =>
                        setState((prev) => {
                          const yearlyCosts = prev.yearlyCosts.filter((_, i) => i !== idx)
                          return { ...prev, yearlyCosts }
                        })
                      }
                    />
                  ))}
                </div>
                <div className="btn-row">
                  <button id="add-yearly" type="button" onClick={addYearly}>
                    + Jährlicher Posten
                  </button>
                </div>
              </div>
            </section>

            {/* Projektion & Charts */}
            <section className="card" aria-labelledby="sec-projection">
              <div className="head">
                <div className="title" id="sec-projection">
                  Jahresprojektion
                </div>
              </div>
              <div className="body two-col">
                <div>
                  <table aria-describedby="sec-projection">
                    <thead>
                      <tr>
                        <th>Metrik</th>
                        <th>Summe (12×)</th>
                      </tr>
                    </thead>
                    <tbody id="projection-rows">
                      {projectionRows.map(([k, v]) => (
                        <tr key={k}>
                          <td>{k}</td>
                          <td>
                            <b>{v}</b>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="btn-row">
                    <span className="chip" id="fixed-flex-chip">
                      Fix: {formatEuro(fixedMonthly)} | Flexibel: {formatEuro(flexibleMonthly)}
                    </span>
                  </div>
                </div>
                <div style={{ gridColumn: '1 / -1' }}>
                  <Charts
                    breakdownList={breakdownList}
                    fixedMonthly={fixedMonthly}
                    flexibleMonthly={flexibleMonthly}
                  />
                </div>
              </div>
            </section>

            {/* Breakdown */}
            <section className="card" aria-labelledby="sec-breakdown">
              <div className="head">
                <div className="title" id="sec-breakdown">
                  Aufschlüsselung nach Kategorie (monatlich)
                </div>
                <span className="chip">Sortiert: größte zuerst</span>
              </div>
              <div className="body">
                <table>
                  <thead>
                    <tr>
                      <th>Kategorie</th>
                      <th>Subtotal (€/mo)</th>
                    </tr>
                  </thead>
                  <tbody id="breakdown-body">
                    {breakdownList.map((it) => (
                      <tr key={it.cat}>
                        <td>{it.cat}</td>
                        <td>
                          <b>{formatEuro(it.total)}</b>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </main>

          <div className="footer-bar">
            <button
              className="linklike"
              id="btn-collapse-all"
              type="button"
              onClick={handleCollapseAll}
            >
              Alle einklappen
            </button>
            <button
              className="linklike"
              id="btn-expand-all"
              type="button"
              onClick={handleExpandAll}
            >
              Alle ausklappen
            </button>
          </div>
        </div>
      ) : (
        <main id="app" role="main">
          <CreditController />
        </main>
      )}
    </>
  )
}
