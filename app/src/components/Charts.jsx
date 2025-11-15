import React, { useEffect, useRef } from 'react'
import {
  Chart,
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
} from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import { formatEuro } from '../utils'

Chart.register(
  BarController,
  BarElement,
  CategoryScale,
  LinearScale,
  DoughnutController,
  ArcElement,
  Tooltip,
  Legend,
  annotationPlugin,
)

function palette(n) {
  const cs = getComputedStyle(document.documentElement)
  const base = ['--pie1', '--pie2', '--pie3', '--pie4', '--pie5', '--pie6']
  const arr = []
  for (let i = 0; i < n; i++) {
    const v = cs.getPropertyValue(base[i % base.length]).trim()
    arr.push(v || `hsl(${(i * 57) % 360} 70% 50%)`)
  }
  return arr
}

export default function Charts({ breakdownList, fixedMonthly, flexibleMonthly }) {
  const barRef = useRef(null)
  const pieRef = useRef(null)
  const fixedRef = useRef(null)

  useEffect(() => {
    const gridColor =
      getComputedStyle(document.documentElement).getPropertyValue('--grid').trim() || '#e5e7eb'

    const labels = breakdownList.map((x) => x.cat)
    const data = breakdownList.map((x) => x.total)
    const colors = palette(breakdownList.length)

    let barChart
    let pieChart
    let fixedChart

    if (barRef.current) {
      barChart = new Chart(barRef.current.getContext('2d'), {
        type: 'bar',
        data: {
          labels,
          datasets: [
            {
              label: 'Monatlicher Betrag',
              data,
              backgroundColor: colors,
              borderWidth: 0,
              borderRadius: 6,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: (c) => `${formatEuro(c.parsed.y)}`,
              },
            },
          },
          scales: {
            x: { grid: { display: false } },
            y: {
              beginAtZero: true,
              grid: { color: gridColor },
              ticks: {
                callback: (v) => formatEuro(v),
              },
            },
          },
        },
      })
    }

    const total = data.reduce((a, b) => a + b, 0) || 1
    if (pieRef.current) {
      pieChart = new Chart(pieRef.current.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels,
          datasets: [
            {
              data,
              backgroundColor: colors,
              borderWidth: 0,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: (c) =>
                  `${c.label}: ${formatEuro(c.parsed)} (${((c.parsed / total) * 100).toFixed(1)}%)`,
              },
            },
          },
        },
      })
    }

    if (fixedRef.current) {
      const cols = palette(2)
      const sumFF = (fixedMonthly + flexibleMonthly) || 1
      fixedChart = new Chart(fixedRef.current.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Fix', 'Flexibel'],
          datasets: [
            {
              data: [fixedMonthly, flexibleMonthly],
              backgroundColor: [cols[0], cols[1]],
              borderWidth: 0,
            },
          ],
        },
        options: {
          maintainAspectRatio: false,
          cutout: '62%',
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: (c) =>
                  `${c.label}: ${formatEuro(c.parsed)} (${((c.parsed / sumFF) * 100).toFixed(1)}%)`,
              },
            },
          },
        },
      })
    }

    return () => {
      barChart && barChart.destroy()
      pieChart && pieChart.destroy()
      fixedChart && fixedChart.destroy()
    }
  }, [breakdownList, fixedMonthly, flexibleMonthly])

  return (
    <div className="stack">
      <div className="chart-wrap">
        <canvas ref={barRef} />
      </div>
      <div className="chart-wrap">
        <canvas ref={pieRef} />
      </div>
      <div className="chart-wrap short">
        <canvas ref={fixedRef} />
      </div>
    </div>
  )
}
