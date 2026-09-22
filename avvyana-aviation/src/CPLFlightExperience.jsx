import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './CPLFlightExperience.css'

const cplRequirementRows = [
  { id: 'total-flight-time', label: 'Total Flight Time as Pilot of Aeroplane for CPL(A)', requiredValue: 200, type: 'hours', requiresDate: false },
  { id: 'pic-time', label: 'Flight time as PIC', requiredValue: 100, type: 'hours', requiresDate: false },
  { id: 'pic-recent', label: 'Flight time as PIC immediate preceding 6 months from date of application', requiredValue: 15, type: 'hours', requiresDate: false },
  { id: 'cross-country-pic', label: 'Cross country flight time as PIC', requiredValue: 20, type: 'hours', requiresDate: false },
  { id: 'cross-country-distance', label: 'Cross country flight distance (300NM) within two full stop landings at two different aerodrome', requiredValue: 300, type: 'distance', requiresDate: false },
  { id: 'instrument-time', label: 'Instrument Time', requiredValue: 10, type: 'hours', requiresDate: false },
  { id: 'instrument-aircraft', label: 'Instrument Time on Aircraft', requiredValue: 5, type: 'hours', requiresDate: false },
  { id: 'night-pic', label: 'Flight Time by Night as PIC immediately preceding 6 months from date of application', requiredValue: 5, type: 'hours', requiresDate: true },
]

const manualEntryRows = [
  { id: 'total-flight-time', label: 'Total Flight Time as Pilot of Aeroplane for CPL(A)', requiredValue: 200, type: 'hours' },
  { id: 'pic-time', label: 'Flight time as PIC', requiredValue: 100, type: 'hours' },
  { id: 'pic-recent', label: 'Flight time as PIC (Last 6 Months)', requiredValue: 15, type: 'hours' },
  { id: 'cross-country-pic', label: 'Cross country flight time as PIC', requiredValue: 20, type: 'hours' },
  { id: 'cross-country-distance', label: 'Cross country flight distance (300NM)', requiredValue: 300, type: 'distance' },
  { id: 'instrument-time', label: 'Instrument Time', requiredValue: 10, type: 'hours' },
  { id: 'instrument-aircraft', label: 'Instrument Time on Aircraft', requiredValue: 5, type: 'hours' },
]

export function parseHoursToNumber(value) {
  if (value === '' || value === null || value === undefined) return 0
  if (typeof value === 'number') return Number.isFinite(value) ? value : 0
  const str = String(value).trim()
  if (str.includes(':')) {
    const parts = str.split(':').map((p) => Number(p) || 0)
    return (parts[0] || 0) + (parts[1] || 0) / 60
  }
  const num = Number(str)
  return Number.isNaN(num) ? 0 : num
}

export function formatHoursValue(value) {
  if (value === '' || value === null || value === undefined) return '0:00'
  if (typeof value === 'string' && /^\d+:\d{2}$/.test(value.trim())) {
    return value.trim()
  }
  const numericValue = parseHoursToNumber(value)
  const totalMinutes = Math.round(numericValue * 60)
  const hours = Math.floor(totalMinutes / 60)
  const minutes = totalMinutes % 60
  return `${hours}:${String(minutes).padStart(2, '0')}`
}

function formatRequiredValue(row, value) {
  if (row.type === 'hours') {
    return formatHoursValue(value)
  }
  return `${value}`
}

function addMonths(dateString, months) {
  if (!dateString) return '—'
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return '—'
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
}

function CPLFlightExperience() {
  const navigate = useNavigate()
  const studentId = localStorage.getItem('studentId') || 'AVV-0001'

  // Single source of truth for committed flight experience
  const [experience, setExperience] = useState(() => {
    try {
      const saved = localStorage.getItem(`cpl_experience_${studentId}`)
      if (saved) {
        const parsed = JSON.parse(saved)
        // Ensure all rows exist
        const result = {}
        cplRequirementRows.forEach((row) => {
          result[row.id] = parsed[row.id] || { hours: '', date: '', submitted: false }
        })
        return result
      }
    } catch {
      // fallback
    }
    return Object.fromEntries(
      cplRequirementRows.map((row) => [
        row.id,
        {
          hours: '',
          date: '',
          submitted: false,
        },
      ])
    )
  })

  // Draft inputs for modal forms
  const [draftHours, setDraftHours] = useState(() =>
    Object.fromEntries(
      cplRequirementRows.map((row) => [
        row.id,
        experience[row.id]?.hours || '',
      ])
    )
  )

  const [draftDate, setDraftDate] = useState(() => ({
    'night-pic': experience['night-pic']?.date || '',
  }))

  const [editingRows, setEditingRows] = useState({})
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [showNightDetails, setShowNightDetails] = useState(() =>
    Boolean(experience['night-pic']?.date || experience['night-pic']?.hours)
  )

  // Persist committed experience to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(`cpl_experience_${studentId}`, JSON.stringify(experience))
    } catch {}
  }, [experience, studentId])

  // Sync draft inputs whenever modal opens or experience changes
  useEffect(() => {
    setDraftHours(
      Object.fromEntries(
        cplRequirementRows.map((row) => [
          row.id,
          experience[row.id]?.hours || '',
        ])
      )
    )
    setDraftDate({
      'night-pic': experience['night-pic']?.date || '',
    })
  }, [experience, isModalOpen])

  // Close modal on Escape key
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        setIsModalOpen(false)
      }
    }
    if (isModalOpen) {
      window.addEventListener('keydown', handleKeyDown)
    }
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isModalOpen])

  const tableRows = useMemo(
    () =>
      cplRequirementRows.map((row) => {
        const rawHours = experience[row.id]?.hours || ''
        const numericValue = parseHoursToNumber(rawHours)
        const flightDate = experience[row.id]?.date || ''
        const expiryDate = addMonths(flightDate, 6)
        const qualified = numericValue >= row.requiredValue
        const isSubmitted = Boolean(experience[row.id]?.submitted && rawHours !== '')

        return {
          ...row,
          rawHours,
          actualValue: numericValue,
          flightDate,
          expiryDate,
          qualified,
          isSubmitted,
        }
      }),
    [experience]
  )

  const handleDraftChange = (rowId, rawValue) => {
    setDraftHours((prev) => ({
      ...prev,
      [rowId]: rawValue,
    }))
  }

  const handleDraftDateChange = (rowId, dateValue) => {
    setDraftDate((prev) => ({
      ...prev,
      [rowId]: dateValue,
    }))
  }

  const handleManualDetailSubmit = (event, rowId) => {
    event.preventDefault()
    const value = draftHours[rowId] ?? ''

    setExperience((current) => ({
      ...current,
      [rowId]: {
        ...current[rowId],
        hours: value,
        submitted: true,
      },
    }))

    setEditingRows((prev) => ({
      ...prev,
      [rowId]: false,
    }))
  }

  const handleNightSubmit = (event) => {
    event.preventDefault()
    const hours = draftHours['night-pic'] ?? ''
    const date = draftDate['night-pic'] ?? ''

    setExperience((current) => ({
      ...current,
      'night-pic': {
        hours,
        date,
        submitted: true,
      },
    }))

    setEditingRows((prev) => ({
      ...prev,
      'night-pic': false,
    }))
  }

  const handleEditClick = (rowId) => {
    setDraftHours((prev) => ({
      ...prev,
      [rowId]: experience[rowId]?.hours || '',
    }))
    if (rowId === 'night-pic') {
      setDraftDate({
        'night-pic': experience['night-pic']?.date || '',
      })
      setShowNightDetails(true)
    }
    setEditingRows((prev) => ({
      ...prev,
      [rowId]: true,
    }))
  }

  const handleCancelEdit = (rowId) => {
    setDraftHours((prev) => ({
      ...prev,
      [rowId]: experience[rowId]?.hours || '',
    }))
    setEditingRows((prev) => ({
      ...prev,
      [rowId]: false,
    }))
  }

  const openModalForRow = (rowId) => {
    if (rowId === 'night-pic') {
      setShowNightDetails(true)
    }
    handleEditClick(rowId)
    setIsModalOpen(true)
  }

  const allQualified = tableRows.every((row) => row.qualified)
  const completedCount = tableRows.filter((row) => row.qualified).length
  const completionPercent = Math.round((completedCount / tableRows.length) * 100)
  const nightDateExists = Boolean(experience['night-pic']?.date)

  return (
    <main className="cpl-page-shell">
      <div className="cpl-flying-panel">
        <header className="cpl-header-block">
          <button type="button" className="student-back-link" onClick={() => navigate('/dashboard')}>
            ← Cadet Dashboard
          </button>

          <div className="cpl-header-content">
            <div>
              <p className="cpl-header-kicker">CPL tracking</p>
              <h1 className="cpl-flying-title">Flying experience</h1>
            </div>

            <div className="cpl-header-summary">
              <button
                type="button"
                className="cpl-header-log-btn"
                onClick={() => setIsModalOpen(true)}
              >
                <span className="cpl-btn-icon">✈️</span>
                <span>Log Flight Hours</span>
              </button>
              <div className="cpl-mini-stat">
                <span>Progress</span>
                <strong>{completionPercent}%</strong>
              </div>
              <div className="cpl-mini-stat">
                <span>Completed</span>
                <strong>{completedCount}/{tableRows.length}</strong>
              </div>
            </div>
          </div>
        </header>

        <section className="cpl-overview-strip">
          <div className="cpl-metric-card success">
            <span className="cpl-metric-label">Status</span>
            <strong>{allQualified ? 'All qualified' : 'In progress'}</strong>
          </div>
          <div className="cpl-metric-card">
            <span className="cpl-metric-label">Latest review</span>
            <strong>{new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</strong>
          </div>
          <div className="cpl-metric-card">
            <span className="cpl-metric-label">6-month window</span>
            <strong>Active</strong>
          </div>
        </section>

        <div className="cpl-flying-table-wrap">
          <div className="cpl-table-toolbar">
            <div className="cpl-table-toolbar-info">
              <span className="cpl-table-toolbar-kicker">DGCA CPL REQUIREMENTS</span>
              <h2 className="cpl-table-toolbar-title">Qualification Criteria Breakdown</h2>
            </div>
            <button
              type="button"
              className="cpl-table-action-btn"
              onClick={() => setIsModalOpen(true)}
            >
              <span>✏️ Log / Update Flight Hours</span>
            </button>
          </div>

          <table className="cpl-reference-table">
            <thead>
              <tr>
                <th>Parameter Name</th>
                <th>Required Value</th>
                <th>Flight Hours</th>
                <th>Status</th>
                <th className="cpl-action-col">Action</th>
              </tr>
            </thead>
            <tbody>
              {tableRows.map((row, index) => (
                <tr key={row.id}>
                  <td>
                    <div className="cpl-parameter-cell">
                      <span>{index + 1}) {row.label}</span>
                      {row.id === 'night-pic' && nightDateExists && (
                        <small className="cpl-inline-note">Note: Must Include 10 Takeoff &amp; 10 Landings</small>
                      )}
                    </div>
                  </td>
                  <td>{formatRequiredValue(row, row.requiredValue)}</td>
                  <td className="cpl-hours-cell">
                    <div className="cpl-table-hours-wrap">
                      <strong className="cpl-table-hours-val">
                        {row.type === 'distance'
                          ? `${row.actualValue} NM`
                          : formatHoursValue(row.actualValue)}
                      </strong>
                      {row.type === 'hours' && (
                        <span className="cpl-table-hours-unit">hrs</span>
                      )}
                      {row.isSubmitted && (
                        <span className="cpl-table-submitted-tag" title="Submitted">✓</span>
                      )}
                    </div>
                  </td>
                  <td className={`cpl-status-cell ${row.qualified ? 'qualified' : 'disqualified'}`}>
                    <div className="cpl-status-stack">
                      <span>{row.qualified ? 'Qualified' : 'Dis-qualified'}</span>
                      {row.id === 'night-pic' && nightDateExists && row.expiryDate !== '—' && (
                        <small className="cpl-row-expiry">Expiry: {row.expiryDate}</small>
                      )}
                    </div>
                  </td>
                  <td className="cpl-action-col">
                    <button
                      type="button"
                      className="cpl-row-action-btn"
                      onClick={() => openModalForRow(row.id)}
                      title="Edit this requirement"
                    >
                      ✏️ Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="cpl-footer-strip">
          <span>{allQualified ? 'All requirements are fulfilled.' : 'Student experience is in progress.'}</span>
        </div>
      </div>

      {isModalOpen && (
        <div className="cpl-modal-backdrop" onClick={() => setIsModalOpen(false)}>
          <div className="cpl-modal-container" onClick={(e) => e.stopPropagation()}>
            <header className="cpl-modal-header">
              <div>
                <span className="cpl-modal-kicker">Flight Training Log</span>
                <h2 className="cpl-modal-title">Flight Experience &amp; Night Requirements</h2>
                <p className="cpl-modal-subtitle">
                  Enter or update your flight hours below. Your CPL progress updates automatically.
                </p>
              </div>
              <button
                type="button"
                className="cpl-modal-close-btn"
                onClick={() => setIsModalOpen(false)}
                aria-label="Close modal"
              >
                ✕
              </button>
            </header>

            <div className="cpl-modal-content">
              <div className="cpl-manual-grid">
                {manualEntryRows.map((row) => {
                  const isSubmitted = Boolean(experience[row.id]?.submitted && experience[row.id]?.hours !== '')
                  const isEditing = Boolean(editingRows[row.id])

                  return (
                    <div key={row.id} className="cpl-manual-card">
                      <div className="cpl-manual-card-head">
                        <span>{row.label}</span>
                        <small>Required: {formatRequiredValue(row, row.requiredValue)}</small>
                      </div>

                      {isSubmitted && !isEditing ? (
                        <div className="cpl-manual-submitted-view">
                          <div className="cpl-submitted-badge">
                            <span className="cpl-submitted-icon">✓</span>
                            <div className="cpl-submitted-info">
                              <span className="cpl-submitted-label">Submitted</span>
                              <strong className="cpl-submitted-value">
                                {row.type === 'distance'
                                  ? `${experience[row.id]?.hours || 0} NM`
                                  : `${formatHoursValue(experience[row.id]?.hours || 0)} hrs`}
                              </strong>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="cpl-edit-btn"
                            onClick={() => handleEditClick(row.id)}
                          >
                            ✏️ Edit Hours
                          </button>
                        </div>
                      ) : (
                        <form onSubmit={(event) => handleManualDetailSubmit(event, row.id)} className="cpl-manual-form-inner">
                          <label className="cpl-manual-field">
                            <span>{row.type === 'distance' ? 'Distance (NM)' : 'Flight Hours'}</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*[.:]?[0-9]*"
                              value={draftHours[row.id] ?? ''}
                              onChange={(event) => handleDraftChange(row.id, event.target.value)}
                              className="cpl-actual-input"
                              placeholder="0"
                              required
                            />
                          </label>

                          <div className="cpl-form-actions-row">
                            <button
                              type="submit"
                              className="cpl-night-submit-btn cpl-manual-submit-btn"
                            >
                              Submit
                            </button>
                            {isSubmitted && (
                              <button
                                type="button"
                                className="cpl-cancel-btn"
                                onClick={() => handleCancelEdit(row.id)}
                              >
                                Cancel
                              </button>
                            )}
                          </div>
                        </form>
                      )}
                    </div>
                  )
                })}

                {!showNightDetails ? (
                  <div className="cpl-night-trigger-card">
                    <div className="cpl-night-trigger-copy">
                      <span>Night requirement</span>
                      <p>Add night flight details when you are ready.</p>
                    </div>
                    <button type="button" className="cpl-night-trigger-btn" onClick={() => setShowNightDetails(true)}>
                      Add Night Details
                    </button>
                  </div>
                ) : (() => {
                  const isNightSubmitted = Boolean(experience['night-pic']?.submitted && experience['night-pic']?.hours !== '')
                  const isNightEditing = Boolean(editingRows['night-pic'])

                  if (isNightSubmitted && !isNightEditing) {
                    return (
                      <div className="cpl-manual-card cpl-night-inline-card">
                        <div className="cpl-night-input-card cpl-night-main-card">
                          <div className="cpl-night-card-header">
                            <span>Night Flight Time as PIC</span>
                          </div>
                          <div className="cpl-submitted-badge">
                            <span className="cpl-submitted-icon">✓</span>
                            <div className="cpl-submitted-info">
                              <span className="cpl-submitted-label">Submitted</span>
                              <strong className="cpl-submitted-value">
                                {formatHoursValue(experience['night-pic']?.hours || 0)} hrs
                              </strong>
                              {experience['night-pic']?.date && (
                                <span className="cpl-submitted-date">
                                  Date: {experience['night-pic']?.date} · Expiry: {addMonths(experience['night-pic']?.date, 6)}
                                </span>
                              )}
                            </div>
                          </div>
                          <button
                            type="button"
                            className="cpl-edit-btn"
                            onClick={() => handleEditClick('night-pic')}
                          >
                            ✏️ Edit Hours
                          </button>
                        </div>
                      </div>
                    )
                  }

                  return (
                    <form onSubmit={handleNightSubmit} className="cpl-manual-card cpl-night-inline-card">
                      <div className="cpl-night-inline-stack">
                        <div className="cpl-night-input-card cpl-night-main-card">
                          <div className="cpl-night-card-header">
                            <span>Night Flight Time as PIC</span>
                          </div>

                          <label className="cpl-manual-field">
                            <span>Flight Hours</span>
                            <input
                              type="text"
                              inputMode="decimal"
                              pattern="[0-9]*[.:]?[0-9]*"
                              value={draftHours['night-pic'] ?? ''}
                              onChange={(event) => handleDraftChange('night-pic', event.target.value)}
                              className="cpl-actual-input"
                              placeholder="0"
                              required
                            />
                          </label>

                          <label className="cpl-manual-field">
                            <span>Flight Date</span>
                            <input
                              type="date"
                              value={draftDate['night-pic'] ?? ''}
                              onChange={(event) => handleDraftDateChange('night-pic', event.target.value)}
                              className="cpl-date-input"
                              required
                            />
                          </label>

                          {draftDate['night-pic'] && (
                            <div className="cpl-expiry-inline">
                              <span>Expiry Date</span>
                              <strong className="cpl-expiry-alert">{addMonths(draftDate['night-pic'], 6)}</strong>
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="cpl-form-actions-row">
                        <button
                          type="submit"
                          className="cpl-night-submit-btn cpl-manual-submit-btn"
                        >
                          Submit night details
                        </button>
                        {isNightSubmitted && (
                          <button
                            type="button"
                            className="cpl-cancel-btn"
                            onClick={() => handleCancelEdit('night-pic')}
                          >
                            Cancel
                          </button>
                        )}
                      </div>
                    </form>
                  )
                })()}
              </div>
            </div>

            <footer className="cpl-modal-footer">
              <button
                type="button"
                className="cpl-modal-done-btn"
                onClick={() => setIsModalOpen(false)}
              >
                ✓ Done &amp; Return to Overview
              </button>
            </footer>
          </div>
        </div>
      )}
    </main>
  )
}

export default CPLFlightExperience
