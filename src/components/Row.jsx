import React, { useEffect, useState } from 'react'
import { STR, nfPlain, parseEuro } from '../utils'

export default function Row({
  id,
  name = '',
  amount = 0,
  onName,
  onAmount,
  onDelete,
  hintRight,
  showFixed = false,
  fixed = false,
  onFixed,
}) {
  const [amountInput, setAmountInput] = useState('')
  const [invalid, setInvalid] = useState(false)

  useEffect(() => {
    if (amount != null && amount !== '') {
      setAmountInput(nfPlain.format(amount))
    } else {
      setAmountInput('')
    }
  }, [amount])

  const handleAmountChange = (e) => {
    const value = e.target.value
    setAmountInput(value)
    const { ok, value: parsed } = parseEuro(value)
    if (!ok && value.trim() !== '') {
      setInvalid(true)
    } else {
      setInvalid(false)
      if (ok && onAmount) onAmount(parsed)
    }
  }

  const handleAmountBlur = (e) => {
    const value = e.target.value
    const { ok, value: parsed } = parseEuro(value)
    if (ok) {
      const formatted = nfPlain.format(parsed)
      setAmountInput(formatted)
      onAmount && onAmount(parsed)
      setInvalid(false)
    } else if (value.trim() === '') {
      onAmount && onAmount(0)
      setInvalid(false)
    } else {
      setInvalid(true)
    }
  }

  return (
    <div className="row">
      <div>
        <label className="sr-only" htmlFor={`${id}-name`}>
          {STR.name}
        </label>
        <input
          id={`${id}-name`}
          type="text"
          placeholder={STR.name}
          value={name}
          onChange={(e) => onName && onName(e.target.value)}
        />
      </div>
      <div>
        <label className="sr-only" htmlFor={`${id}-amount`}>
          {STR.amount}
        </label>
        <input
          id={`${id}-amount`}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          placeholder={STR.amount}
          value={amountInput}
          onChange={handleAmountChange}
          onBlur={handleAmountBlur}
          className={invalid ? 'invalid' : ''}
        />
      </div>
      <div className="row-actions">
        {showFixed && (
          <label className="checkbox chip" title="Als Fixkosten markieren">
            <input
              id={`${id}-fixed`}
              type="checkbox"
              checked={!!fixed}
              onChange={(e) => onFixed && onFixed(!!e.target.checked)}
            />{' '}
            {STR.fixed}
          </label>
        )}
        {hintRight && (
          <span className="chip" aria-hidden="true">
            {hintRight}
          </span>
        )}
        <button type="button" className="danger" title="Zeile löschen" onClick={() => onDelete && onDelete()}>
          ✕
        </button>
      </div>
    </div>
  )
}
