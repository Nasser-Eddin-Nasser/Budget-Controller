import React, { useEffect, useRef } from 'react'
import { Chart, registerables } from 'chart.js'
import annotationPlugin from 'chartjs-plugin-annotation'
import { creditDefaults } from '../data'

Chart.register(...registerables, annotationPlugin)

// ----- Pure helpers (no DOM) -----
const fmtEUR = (v) =>
    new Intl.NumberFormat('de-DE', {
        style: 'currency',
        currency: 'EUR',
        maximumFractionDigits: 0,
    }).format(v)

const monthsToText = (m) => {
    const y = Math.floor(m / 12)
    const r = m % 12
    if (y === 0) return r === 1 ? '1 Monat' : `${r} Monate`
    if (r === 0) return y === 1 ? '1 Jahr' : `${y} Jahre`
    return `${y === 1 ? '1 Jahr' : `${y} Jahr`} und ${r === 1 ? '1 Monate' : `${r} Monate`
        }`
}

const mToYM = (m) => {
    const y = Math.floor((m - 1) / 12) + 1
    const mm = ((m - 1) % 12) + 1
    return `${y}J ${mm}M`
}

const parseSafe = (t, fb = []) => {
    try {
        const v = JSON.parse(t)
        return Array.isArray(v) ? v : fb
    } catch {
        return fb
    }
}

function simulate({
    principal,
    annualRatePct,
    monthlyPayment,
    extraPayments,
    paymentChanges,
    maxMonths,
}) {
    const r = (annualRatePct / 100) / 12
    let bal = principal
    let pay = monthlyPayment
    const extra = new Map(extraPayments.map((e) => [+e.month, +e.amount]))
    const changes = new Map(paymentChanges.map((e) => [+e.month, +e.amount]))

    const labels = []
    const labelsYM = []
    const rest = []
    const dropBars = []
    const dropMarkers = []
    const mZins = []
    const mTilg = []
    const cumZins = []
    const cumTilg = []
    let totInt = 0
    let totPrin = 0
    let m = 0

    while (m < maxMonths && bal > 0.005) {
        m++
        if (changes.has(m)) pay = changes.get(m)

        const interest = bal * r
        let principalPart = Math.min(pay - interest, bal)
        if (principalPart < 0) throw new Error('Rate zu niedrig.')
        bal -= principalPart

        let extraPay = 0
        if (extra.has(m) && bal > 0) {
            extraPay = Math.min(extra.get(m), bal)
            bal -= extraPay
        }

        const monthTilg = principalPart + extraPay

        totInt += interest
        totPrin += monthTilg

        labels.push(m)
        labelsYM.push(mToYM(m))
        rest.push(bal)
        mZins.push(interest)
        mTilg.push(monthTilg)

        cumZins.push(totInt)
        cumTilg.push(totPrin)

        dropBars.push(extraPay > 0 ? -extraPay : null)
        dropMarkers.push(extraPay > 0 ? bal : null)
    }

    return {
        labels,
        labelsYM,
        rest,
        dropBars,
        dropMarkers,
        mZins,
        mTilg,
        cumZins,
        cumTilg,
        totInt,
        totPrin,
        months: labels.length,
        principal,
    }
}

export default function CreditController() {
    const rootRef = useRef(null)

    useEffect(() => {
        const root = rootRef.current
        if (!root) return

        const byId = (id) => root.querySelector(`#${id}`)
        const q = (sel) => root.querySelector(sel)
        const getVar = (v) =>
            getComputedStyle(root).getPropertyValue(v).trim() ||
            getComputedStyle(document.documentElement).getPropertyValue(v).trim()

        let restChart
        let partsChart
        let pieMonthly
        let pieTilgProg
        let pieZinsProg
        let simDataGlobal

        const ensurePies = () => {
            if (pieMonthly) pieMonthly.destroy()
            if (pieTilgProg) pieTilgProg.destroy()
            if (pieZinsProg) pieZinsProg.destroy()
            const pm = byId('pieMonthly').getContext('2d')
            const pt = byId('pieTilgProg').getContext('2d')
            const pz = byId('pieZinsProg').getContext('2d')
            return { pm, pt, pz }
        }

        const updateDetails = (index) => {
            const d = simDataGlobal
            if (!d) return
            if (index < 0 || index >= d.labels.length) return

            const hausgeld = +byId('hausgeld').value || 0

            const monthLabel = d.labelsYM[index]
            const restVal = d.rest[index]
            const zMon = d.mZins[index]
            const tMon = d.mTilg[index]

            const cumZ = d.cumZins[index]
            const cumT = d.cumTilg[index]

            const principalTotal = d.principal || 0.00001
            const paidPct = Math.min(100, Math.max(0, (cumT / principalTotal) * 100))
            const totalInterest = d.totInt || 0.00001
            const zinsProgPct = Math.min(100, Math.max(0, (cumZ / totalInterest) * 100))

            byId('selMonth').textContent = monthLabel
            byId('dRest').textContent = fmtEUR(restVal)
            byId('dZins').textContent = fmtEUR(zMon)
            byId('dTilg').textContent = fmtEUR(tMon)
            byId('dHausgeld').textContent = fmtEUR(hausgeld)
            byId('dGesamt').textContent = fmtEUR(zMon + tMon + hausgeld)
            byId('dCumZins').textContent =
                `${fmtEUR(cumZ)} (${zinsProgPct.toFixed(1)}% der Gesamtzinsen)`
            byId('dCumTilg').textContent =
                `${fmtEUR(cumT)} (${paidPct.toFixed(1)}% der Kreditsumme)`
            byId('paidPct').textContent = `Kredit getilgt: ${paidPct.toFixed(1)}%`

            const { pm, pt, pz } = ensurePies()

            const totalMon = zMon + tMon + hausgeld || 1
            pieMonthly = new Chart(pm, {
                type: 'doughnut',
                data: {
                    labels: ['Zinsen', 'Tilgung', 'Hausgeld'],
                    datasets: [
                        {
                            data: [zMon, tMon, hausgeld],
                            backgroundColor: [
                                getVar('--zins') || '#ef4444',
                                getVar('--tilg') || '#10b981',
                                getVar('--haus') || '#8b5cf6',
                            ],
                            borderWidth: 0,
                        },
                    ],
                },
                options: {
                    plugins: {
                        legend: { position: 'bottom', labels: { color: 'inherit' } },
                        tooltip: {
                            callbacks: {
                                label: (c) =>
                                    `${c.label}: ${fmtEUR(c.parsed)} (${(
                                        (c.parsed / totalMon) *
                                        100
                                    ).toFixed(1)}%)`,
                            },
                        },
                    },
                    cutout: '65%',
                },
            })

            const tilgRemain = Math.max(0, principalTotal - cumT)
            pieTilgProg = new Chart(pt, {
                type: 'doughnut',
                data: {
                    labels: ['Getilgt', 'Rest-Tilgungsvolumen'],
                    datasets: [
                        {
                            data: [cumT, tilgRemain],
                            backgroundColor: [getVar('--tilg') || '#10b981', '#e5e7eb'],
                            borderWidth: 0,
                        },
                    ],
                },
                options: {
                    plugins: {
                        legend: { position: 'bottom', labels: { color: 'inherit' } },
                        tooltip: {
                            callbacks: {
                                label: (c) =>
                                    `${c.label}: ${fmtEUR(c.parsed)} (${(
                                        (c.parsed / (cumT + tilgRemain || 1)) *
                                        100
                                    ).toFixed(1)}%)`,
                            },
                        },
                    },
                    cutout: '65%',
                },
            })

            const zinsRemain = Math.max(0, d.totInt - cumZ)
            pieZinsProg = new Chart(pz, {
                type: 'doughnut',
                data: {
                    labels: ['Gezahlte Zinsen', 'Noch ausstehende Zinsen'],
                    datasets: [
                        {
                            data: [cumZ, zinsRemain],
                            backgroundColor: [getVar('--zins') || '#ef4444', '#e5e7eb'],
                            borderWidth: 0,
                        },
                    ],
                },
                options: {
                    plugins: {
                        legend: { position: 'bottom', labels: { color: 'inherit' } },
                        tooltip: {
                            callbacks: {
                                label: (c) =>
                                    `${c.label}: ${fmtEUR(c.parsed)} (${(
                                        (c.parsed / (cumZ + zinsRemain || 1)) *
                                        100
                                    ).toFixed(1)}%)`,
                            },
                        },
                    },
                    cutout: '65%',
                },
            })

            byId('details').style.display = 'block'
        }

        const drawCharts = (data, fixMonth) => {
            simDataGlobal = data
            const { labelsYM, rest, dropBars, dropMarkers, mZins, mTilg } = data

            const common = {
                maintainAspectRatio: false,
                interaction: { mode: 'index', intersect: false },
                scales: {
                    x: {
                        title: { display: true, text: 'Monat (Jahre/Monate)' },
                        grid: { color: 'rgba(0,0,0,0)' },
                        ticks: {
                            callback: (v, i) => labelsYM[i],
                        },
                    },
                    y: {
                        title: { display: true, text: 'Betrag (€)' },
                        grid: { color: getVar('--grid') || 'rgba(148,163,184,.18)' },
                        ticks: {
                            callback: (v) => fmtEUR(v),
                        },
                    },
                },
                plugins: {
                    legend: { position: 'top', labels: { color: 'inherit' } },
                },
            }

            const c1 = byId('restChart').getContext('2d')
            const c2 = byId('partsChart').getContext('2d')

            if (restChart) restChart.destroy()
            if (partsChart) partsChart.destroy()

            const maxDrop = Math.max(0, ...dropBars.map((v) => (v ? -v : 0)))
            const suggestedMin = maxDrop > 0 ? -Math.ceil(maxDrop * 1.15) : undefined

            restChart = new Chart(c1, {
                type: 'line',
                data: {
                    labels: labelsYM,
                    datasets: [
                        {
                            label: 'Restschuld',
                            data: rest,
                            borderColor: getVar('--line') || '#60a5fa',
                            backgroundColor: getVar('--fill') || 'rgba(96,165,250,.15)',
                            fill: 'origin',
                            borderWidth: 2.2,
                            tension: 0.18,
                            pointRadius: 0,
                            yAxisID: 'y',
                        },
                        {
                            type: 'bar',
                            label: 'Sondertilgung (Drop)',
                            data: dropBars,
                            borderColor: getVar('--drop') || '#22c55e',
                            backgroundColor: getVar('--drop') || '#22c55e',
                            borderRadius: 4,
                            barPercentage: 0.7,
                            categoryPercentage: 0.98,
                            order: 0,
                            yAxisID: 'y',
                        },
                        {
                            type: 'scatter',
                            label: 'Sondertilgung-Marker',
                            data: dropMarkers.map((y, i) =>
                                y == null ? null : { x: labelsYM[i], y },
                            ),
                            pointRadius: 4,
                            showLine: false,
                            borderColor: getVar('--drop') || '#22c55e',
                            backgroundColor: '#fff',
                            yAxisID: 'y',
                        },
                    ],
                },
                options: {
                    ...common,
                    plugins: {
                        ...common.plugins,
                        tooltip: {
                            callbacks: {
                                beforeBody: (it) => {
                                    const i = it[0].dataIndex
                                    return [
                                        `Zinsen: ${fmtEUR(mZins[i])}`,
                                        `Tilgung: ${fmtEUR(mTilg[i])}`,
                                    ]
                                },
                                label: (ctx) => {
                                    if (
                                        ctx.dataset.label.startsWith('Sonder') &&
                                        ctx.parsed.y != null
                                    ) {
                                        return `Sondertilgung: ${fmtEUR(Math.abs(ctx.parsed.y))}`
                                    }
                                    if (ctx.dataset.label === 'Restschuld') {
                                        return `Restschuld: ${fmtEUR(ctx.parsed.y)}`
                                    }
                                    return undefined
                                },
                            },
                        },
                        annotation:
                            fixMonth && labelsYM[fixMonth - 1]
                                ? {
                                    annotations: {
                                        fixline: {
                                            type: 'line',
                                            xMin: labelsYM[fixMonth - 1],
                                            xMax: labelsYM[fixMonth - 1],
                                            borderColor: getVar('--accent') || '#f59e0b',
                                            borderWidth: 2,
                                            borderDash: [6, 6],
                                            label: {
                                                display: true,
                                                content: [
                                                    'Ende Sollzinsbindung',
                                                    `${Math.floor(fixMonth / 12)} Jahre`,
                                                ],
                                                position: 'start',
                                                backgroundColor: 'rgba(255,255,255,.9)',
                                                color: '#111',
                                                padding: 6,
                                            },
                                        },
                                    },
                                }
                                : undefined,
                    },
                    scales: {
                        ...common.scales,
                        y: {
                            ...common.scales.y,
                            suggestedMin,
                        },
                    },
                },
            })

            partsChart = new Chart(c2, {
                type: 'line',
                data: {
                    labels: labelsYM,
                    datasets: [
                        {
                            label: 'Zinsanteil',
                            data: mZins,
                            borderColor: getVar('--zins') || '#ef4444',
                            borderWidth: 1.8,
                            tension: 0.2,
                            pointRadius: 0,
                        },
                        {
                            label: 'Tilgungsanteil',
                            data: mTilg,
                            borderColor: getVar('--tilg') || '#10b981',
                            borderWidth: 1.8,
                            tension: 0.2,
                            pointRadius: 0,
                        },
                    ],
                },
                options: {
                    ...common,
                },
            })

            const sync = (src, dst, evtType, evt) => {
                if (!dst) return
                if (evtType === 'leave') {
                    src.setActiveElements([])
                    dst.setActiveElements([])
                    src.update('none')
                    dst.update('none')
                    return
                }
                const pts = src.getElementsAtEventForMode(
                    evt,
                    'index',
                    { intersect: false },
                    false,
                )
                if (!pts.length) return
                const { datasetIndex, index } = pts[0]
                src.setActiveElements([{ datasetIndex, index }])
                dst.setActiveElements([{ datasetIndex: 0, index }])
                src.tooltip.setActiveElements([{ datasetIndex, index }], { x: 0, y: 0 })
                dst.tooltip.setActiveElements([{ datasetIndex: 0, index }], {
                    x: 0,
                    y: 0,
                })
                src.update('none')
                dst.update('none')
            }

            restChart.canvas.addEventListener('mousemove', (e) =>
                sync(restChart, partsChart, 'move', e),
            )
            partsChart.canvas.addEventListener('mousemove', (e) =>
                sync(partsChart, restChart, 'move', e),
            )
            restChart.canvas.addEventListener('mouseleave', () =>
                sync(restChart, partsChart, 'leave'),
            )
            partsChart.canvas.addEventListener('mouseleave', () =>
                sync(partsChart, restChart, 'leave'),
            )

            const clickAt = (chart, evt) => {
                const pts = chart.getElementsAtEventForMode(
                    evt,
                    'index',
                    { intersect: false },
                    false,
                )
                if (!pts.length) return
                const idx = pts[0].index
                updateDetails(idx)
            }
            restChart.canvas.addEventListener('click', (e) => clickAt(restChart, e))
            partsChart.canvas.addEventListener('click', (e) => clickAt(partsChart, e))

            const stackEl = q('.stack')
            if (stackEl && 'ResizeObserver' in window) {
                const ro = new ResizeObserver(() => {
                    restChart?.resize()
                    partsChart?.resize()
                })
                ro.observe(stackEl)
            }
        }

        const collectInputs = () => ({
            betrag: +byId('betrag').value,
            zins: +byId('zins').value,
            rate: +byId('rate').value,
            hausgeld: +byId('hausgeld').value,
            maxyears: +byId('maxyears').value,
            bind: +byId('bind').value,
            sonder: byId('sonder').value,
            wechsel: byId('wechsel').value,
        })

        const applyInputs = (obj) => {
            if (!obj) return
            byId('betrag').value = obj.betrag ?? 0
            byId('zins').value = obj.zins ?? 0
            byId('rate').value = obj.rate ?? 0
            byId('hausgeld').value = obj.hausgeld ?? 0
            byId('maxyears').value = obj.maxyears ?? 0
            byId('bind').value = obj.bind ?? 0
            byId('sonder').value = obj.sonder ?? '[]'
            byId('wechsel').value = obj.wechsel ?? '[]'
        }

        const onCalc = (statusTargetId = 'status') => {
            const p = +byId('betrag').value
            const r = +byId('zins').value
            const m = +byId('rate').value
            const hg = +byId('hausgeld').value || 0
            const y = +byId('maxyears').value
            const b = +byId('bind').value || 0

            const sonder = parseSafe(byId('sonder').value, [])
            const wechsel = parseSafe(byId('wechsel').value, [])
            let res
            try {
                res = simulate({
                    principal: p,
                    annualRatePct: r,
                    monthlyPayment: m,
                    extraPayments: sonder,
                    paymentChanges: wechsel,
                    maxMonths: Math.round(y * 12),
                })
            } catch (e) {
                byId(statusTargetId).textContent = e.message
                const statusMobile = byId('status_mobile')
                if (statusTargetId === 'status_mobile' && statusMobile) {
                    statusMobile.style.display = 'inline'
                }
                return
            }

            drawCharts(res, b > 0 ? b * 12 : null)
            byId('sumInterest').textContent = fmtEUR(res.totInt)
            byId('sumPrincipal').textContent = fmtEUR(res.totPrin)
            byId('totalMonths').textContent = monthsToText(res.months)

            const fixM = b * 12
            if (fixM > 0 && fixM <= res.labels.length) {
                byId('restAtFix').textContent = fmtEUR(res.rest[fixM - 1])
            } else {
                byId('restAtFix').textContent = '–'
            }

            byId('fullMonthly').textContent = fmtEUR(m + hg)

            byId(statusTargetId).textContent = 'Berechnung abgeschlossen.'
            const statusMobile = byId('status_mobile')
            if (statusTargetId === 'status_mobile' && statusMobile) {
                statusMobile.style.display = 'inline'
            }
            byId('details').style.display = 'none'
        }

        // Buttons
        byId('calc').addEventListener('click', () => onCalc('status'))
        const calcMobile = byId('calc_mobile')
        if (calcMobile) {
            calcMobile.addEventListener('click', () => onCalc('status_mobile'))
        }

        byId('exportBtn').addEventListener('click', () => {
            const json = JSON.stringify(collectInputs(), null, 2)
            byId('ioArea').value = json
            byId('status').textContent = 'JSON exportiert.'
            const statusMobile = byId('status_mobile')
            if (statusMobile) statusMobile.textContent = 'JSON exportiert.'
        })

        byId('importBtn').addEventListener('click', () => {
            const text = byId('ioArea').value.trim()
            if (!text) {
                window.alert('Bitte JSON einfügen.')
                return
            }
            try {
                const obj = JSON.parse(text)
                applyInputs(obj)
                byId('status').textContent =
                    'JSON importiert. Jetzt "Berechnen" klicken.'
                const statusMobile = byId('status_mobile')
                if (statusMobile) {
                    statusMobile.textContent =
                        'JSON importiert. Jetzt "Berechnen" klicken.'
                }
            } catch (e) {
                window.alert('Ungültiges JSON.')
            }
        })

        // initial calc
        onCalc()

        return () => {
            restChart?.destroy()
            partsChart?.destroy()
            pieMonthly?.destroy()
            pieTilgProg?.destroy()
            pieZinsProg?.destroy()
        }
    }, [])

    return (
        <div ref={rootRef} className="credit-root">
            <header className="credit-header">
                <div className="header-inner">
                    <div className="title">
                        <h1>Immobilienkredit – Rechner &amp; Visualisierung</h1>
                    </div>
                </div>

                <div className="summary-inner">
                    <div className="kpis" role="region" aria-label="Kredit-KPIs">
                        <div className="kpi">
                            <div className="label">Gesamtzins</div>
                            <div className="value" id="sumInterest">–</div>
                        </div>
                        <div className="kpi">
                            <div className="label">Gesamttilgung</div>
                            <div className="value" id="sumPrincipal">–</div>
                        </div>
                        <div className="kpi">
                            <div className="label">Gesamtlaufzeit</div>
                            <div className="value" id="totalMonths">–</div>
                        </div>
                        <div className="kpi bad">
                            <div className="label">Restschuld Ende Bindung</div>
                            <div className="value" id="restAtFix">–</div>
                        </div>
                        <div className="kpi">
                            <div className="label">Monatsrate gesamt</div>
                            <div className="value" id="fullMonthly">–</div>
                        </div>
                    </div>
                </div>
            </header>
            <div className="card">
                <div className="btn-row" >
                    <button id="exportBtn" type="button">
                        Exportiere JSON
                    </button>
                    <button id="importBtn" type="button">
                        Importiere JSON
                    </button>

                </div>
                <details className="json-box">
                    <summary>JSON Box</summary>
                    <textarea
                        id="ioArea"
                        className="io-area"
                        placeholder="Hier erscheint oder wird eingefügt das JSON..."
                    />
                </details>
            </div>

            <div className="container">
                <div className="grid">
                    <div className="card">
                        <label htmlFor="betrag">Finanzierungsbetrag (€)</label>
                        <input
                            id="betrag"
                            type="number"
                            step="0.01"
                            defaultValue={creditDefaults.betrag}
                            inputMode="decimal"
                        />

                        <label htmlFor="zins">Jahreszinssatz (% p.a.)</label>
                        <input
                            id="zins"
                            type="number"
                            step="0.001"
                            defaultValue={creditDefaults.zins}
                            inputMode="decimal"
                        />

                        <label htmlFor="rate">Kreditrate (monatlich, €)</label>
                        <input
                            id="rate"
                            type="number"
                            step="0.01"
                            defaultValue={creditDefaults.rate}
                            inputMode="decimal"
                        />

                        <label htmlFor="hausgeld">Hausgeld (monatlich, €)</label>
                        <input
                            id="hausgeld"
                            type="number"
                            step="0.01"
                            defaultValue={creditDefaults.hausgeld}
                            inputMode="decimal"
                        />

                        <div className="row">
                            <div>
                                <label htmlFor="maxyears">
                                    Maximale Laufzeit (Jahre, Stopp)
                                </label>
                                <input
                                    id="maxyears"
                                    type="number"
                                    defaultValue={creditDefaults.maxyears}
                                    inputMode="numeric"
                                />
                            </div>
                            <div>
                                <label htmlFor="bind">
                                    Sollzinsbindung (Jahre, optional)
                                </label>
                                <input
                                    id="bind"
                                    type="number"
                                    defaultValue={creditDefaults.bind}
                                    inputMode="numeric"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="card">
                        <label htmlFor="sonder">Sondertilgungen (JSON)</label>
                        <textarea
                            id="sonder"
                            defaultValue={creditDefaults.sonder}
                        />

                        <label htmlFor="wechsel" style={{ marginTop: 10 }}>
                            Tilgungswechsel / Ratenänderungen (JSON)
                        </label>
                        <textarea
                            id="wechsel"
                            defaultValue={creditDefaults.wechsel}
                        />
                    </div>
                    <div
                        className="calc-inline"
                        style={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 8,
                            flexWrap: 'wrap',
                        }}
                    >
                        <button id="calc" className="btn btn-primary" type="button">
                            Berechnen &amp; Zeichnen
                        </button>
                        <span id="status" className="muted" />
                    </div>
                </div>

                <div className="card">
                    <div className="stack">
                        <div className="chart-wrap">
                            <canvas
                                id="restChart"
                                aria-label="Restschuld Diagramm"
                                role="img"
                            />
                        </div>
                        <div className="chart-wrap short">
                            <canvas
                                id="partsChart"
                                aria-label="Zins- und Tilgungsanteil Diagramm"
                                role="img"
                            />
                        </div>
                    </div>

                    {/* Details section now only for drilldown; KPIs moved to header */}
                    <div id="details" className="details" aria-live="polite">
                        <div className="details-header">
                            <div id="selMonth" className="badge">
                                –
                            </div>
                            <div id="paidPct" className="badge">
                                Kredit getilgt: –
                            </div>
                        </div>
                        <div className="kv">
                            <div className="box">
                                <b>Restschuld</b>
                                <span id="dRest">–</span>
                            </div>
                            <div className="box">
                                <b>Zinsen (Monat)</b>
                                <span id="dZins">–</span>
                            </div>
                            <div className="box">
                                <b>Tilgung (Monat)</b>
                                <span id="dTilg">–</span>
                            </div>
                            <div className="box">
                                <b>Hausgeld (Monat)</b>
                                <span id="dHausgeld">–</span>
                            </div>
                            <div className="box">
                                <b>Monatliche Gesamtzahlung</b>
                                <span id="dGesamt">–</span>
                            </div>
                            <div className="box">
                                <b>Kumulierte Zinsen bis hier</b>
                                <span id="dCumZins">–</span>
                            </div>
                            <div className="box">
                                <b>Kumulierte Tilgung bis hier</b>
                                <span id="dCumTilg">–</span>
                            </div>
                        </div>

                        <div className="pies">
                            <div className="pie-wrap">
                                <h3>Monatlicher Anteil: Zins vs. Tilgung vs. Hausgeld</h3>
                                <canvas id="pieMonthly" height="200" />
                            </div>
                            <div className="pie-wrap">
                                <h3>Fortschritt Tilgung (bis hier)</h3>
                                <canvas id="pieTilgProg" height="200" />
                            </div>
                            <div className="pie-wrap">
                                <h3>Fortschritt Zinsen (bis hier)</h3>
                                <canvas id="pieZinsProg" height="200" />
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            <div className="action-bar" role="region" aria-label="Aktionen">
                <button id="calc_mobile" className="btn btn-primary" type="button">
                    Berechnen &amp; Zeichnen
                </button>
                <span id="status_mobile" className="muted" style={{ display: 'none' }} />
            </div>
        </div>
    )
}
