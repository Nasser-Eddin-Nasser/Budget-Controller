// components/Charts.jsx
import React, { useEffect, useRef } from 'react'
import { Chart, ArcElement, Tooltip, Legend } from 'chart.js'
import { formatEuro } from '../utils'

Chart.register(ArcElement, Tooltip, Legend)

function percent(part, total) {
  if (!total || total <= 0) return 0
  return (part / total) * 100
}

export default function Charts({
  breakdownList,
  fixedMonthly,
  flexibleMonthly,
  categoriesOrder,
  monthlyExpenses,
}) {
  const overallRef = useRef(null)
  const fixedFlexRef = useRef(null)
  const fixedItemsRef = useRef(null)
  const flexItemsRef = useRef(null)

  const chartInstancesRef = useRef({})

  // ----- overall by category (unchanged) -----
  const overallData = (breakdownList || []).filter((x) => x.total > 0)
  const overallTotal = overallData.reduce((sum, x) => sum + (x.total || 0), 0)

  // ----- NEW: per-item fixed / flexible data -----
  const fixedItemData = []
  const flexItemData = []

  ;(categoriesOrder || []).forEach((cat) => {
    const rows = ((monthlyExpenses || {})[cat] || []) || []
    rows.forEach((r, idx) => {
      const amt = +r?.amount || 0
      if (!amt) return
      const baseName = (r.name || '').trim()
      const label = baseName ? `${baseName} (${cat})` : cat
      const key = `${cat}-${idx}`

      if (r.fixed) {
        fixedItemData.push({ key, label, total: amt })
      } else {
        flexItemData.push({ key, label, total: amt })
      }
    })
  })

  const fixedItemsTotal = fixedItemData.reduce((sum, x) => sum + x.total, 0)
  const flexItemsTotal = flexItemData.reduce((sum, x) => sum + x.total, 0)

  useEffect(() => {
    // destroy old charts
    Object.values(chartInstancesRef.current).forEach((c) => c && c.destroy())
    chartInstancesRef.current = {}

    const root = document.documentElement
    const getVar = (name, fb) =>
      getComputedStyle(root).getPropertyValue(name).trim() || fb

    const colors = [
      getVar('--pie1', '#2563eb'),
      getVar('--pie2', '#10b981'),
      getVar('--pie3', '#ef4444'),
      getVar('--pie4', '#f59e0b'),
      getVar('--pie5', '#8b5cf6'),
      getVar('--pie6', '#ec4899'),
    ]

    const baseOptions = (total) => ({
      responsive: true,
      maintainAspectRatio: false,
      layout: { padding: 0 },
      plugins: {
        legend: {
          position: 'bottom',
          labels: {
            color: 'inherit',
            boxWidth: 12,
            usePointStyle: true,
          },
        },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const v = ctx.parsed
              const pct = percent(v, total)
              return `${ctx.label}: ${formatEuro(v)} (${pct.toFixed(1)}%)`
            },
          },
        },
      },
    })

    // 1) Gesamte monatliche Ausgaben (by category)
    if (overallRef.current && overallData.length) {
      const total = overallTotal || 1
      chartInstancesRef.current.overall = new Chart(overallRef.current, {
        type: 'doughnut',
        data: {
          labels: overallData.map((x) => x.cat),
          datasets: [
            {
              data: overallData.map((x) => x.total),
              backgroundColor: overallData.map((_, i) => colors[i % colors.length]),
              borderWidth: 0,
              cutout: '60%',
            },
          ],
        },
        options: baseOptions(total),
      })
    }

    // 2) Fix vs flexibel
    if (fixedFlexRef.current && (fixedMonthly > 0 || flexibleMonthly > 0)) {
      const fixed = fixedMonthly || 0
      const flex = flexibleMonthly || 0
      const total = fixed + flex || 1
      chartInstancesRef.current.fixedFlex = new Chart(fixedFlexRef.current, {
        type: 'doughnut',
        data: {
          labels: ['Fix', 'Flexibel'],
          datasets: [
            {
              data: [fixed, flex],
              backgroundColor: [colors[0], colors[1]],
              borderWidth: 0,
              cutout: '60%',
            },
          ],
        },
        options: baseOptions(total),
      })
    }

    // 3) Fixkosten – per item
    if (fixedItemsRef.current && fixedItemData.length) {
      const total = fixedItemsTotal || 1
      chartInstancesRef.current.fixedItems = new Chart(fixedItemsRef.current, {
        type: 'doughnut',
        data: {
          labels: fixedItemData.map((x) => x.label),
          datasets: [
            {
              data: fixedItemData.map((x) => x.total),
              backgroundColor: fixedItemData.map((_, i) => colors[i % colors.length]),
              borderWidth: 0,
              cutout: '60%',
            },
          ],
        },
        options: baseOptions(total),
      })
    }

    // 4) Flexibel Kosten – per item
    if (flexItemsRef.current && flexItemData.length) {
      const total = flexItemsTotal || 1
      chartInstancesRef.current.flexItems = new Chart(flexItemsRef.current, {
        type: 'doughnut',
        data: {
          labels: flexItemData.map((x) => x.label),
          datasets: [
            {
              data: flexItemData.map((x) => x.total),
              backgroundColor: flexItemData.map((_, i) => colors[i % colors.length]),
              borderWidth: 0,
              cutout: '60%',
            },
          ],
        },
        options: baseOptions(total),
      })
    }

    return () => {
      Object.values(chartInstancesRef.current).forEach((c) => c && c.destroy())
      chartInstancesRef.current = {}
    }
  }, [
    breakdownList,
    fixedMonthly,
    flexibleMonthly,
    categoriesOrder,
    monthlyExpenses,
    overallTotal,
    fixedItemsTotal,
    flexItemsTotal,
    overallData.length,
    fixedItemData.length,
    flexItemData.length,
  ])

  return (
    <div className="charts-block">
      {/* Row 1: overall + fixed vs flex */}
      <div className="budget-pies-row">
        <div className="budget-pie">
          <h3>Gesamte monatliche Ausgaben</h3>
          <div className="budget-pie-chart">
            <canvas ref={overallRef} aria-label="Gesamte monatliche Ausgaben" role="img" />
          </div>
          <ul className="budget-pie-list">
            {overallData.map((item) => {
              const pct = percent(item.total, overallTotal)
              return (
                <li key={item.cat}>
                  <span>{item.cat}</span>
                  <span>
                    {formatEuro(item.total)} ({pct.toFixed(1)}%)
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="budget-pie">
          <h3>Fix vs. flexibel</h3>
          <div className="budget-pie-chart">
            <canvas ref={fixedFlexRef} aria-label="Fix vs flexibel" role="img" />
          </div>
          <ul className="budget-pie-list">
            {(() => {
              const fixed = fixedMonthly || 0
              const flex = flexibleMonthly || 0
              const total = fixed + flex || 1
              return (
                <>
                  <li>
                    <span>Fix</span>
                    <span>
                      {formatEuro(fixed)} ({percent(fixed, total).toFixed(1)}%)
                    </span>
                  </li>
                  <li>
                    <span>Flexibel</span>
                    <span>
                      {formatEuro(flex)} ({percent(flex, total).toFixed(1)}%)
                    </span>
                  </li>
                </>
              )
            })()}
          </ul>
        </div>
      </div>

      {/* Row 2: fixed / flexible per item */}
      <div className="budget-pies-row">
        <div className="budget-pie">
          <h3>Fixkosten</h3>
          <div className="budget-pie-chart">
            <canvas ref={fixedItemsRef} aria-label="Fixkosten" role="img" />
          </div>
          <ul className="budget-pie-list">
            {fixedItemData.map((item) => {
              const pct = percent(item.total, fixedItemsTotal)
              return (
                <li key={item.key}>
                  <span>{item.label}</span>
                  <span>
                    {formatEuro(item.total)} ({pct.toFixed(1)}%)
                  </span>
                </li>
              )
            })}
          </ul>
        </div>

        <div className="budget-pie">
          <h3>Flexible Kosten</h3>
          <div className="budget-pie-chart">
            <canvas ref={flexItemsRef} aria-label="Variable Kosten nach Kategorie" role="img" />
          </div>
          <ul className="budget-pie-list">
            {flexItemData.map((item) => {
              const pct = percent(item.total, flexItemsTotal)
              return (
                <li key={item.key}>
                  <span>{item.label}</span>
                  <span>
                    {formatEuro(item.total)} ({pct.toFixed(1)}%)
                  </span>
                </li>
              )
            })}
          </ul>
        </div>
      </div>
    </div>
  )
}
