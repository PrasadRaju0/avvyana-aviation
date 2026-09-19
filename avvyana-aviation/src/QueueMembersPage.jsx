import { useEffect, useMemo, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'

const formatDate = (value) => {
  if (!value) return '—'
  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) return value
  return parsed.toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

const getQueueWaitingDuration = (submission) => {
  const startedAt = submission.queueStartedAt || submission.queue_started_at || submission.submittedAt || submission.flightDate
  if (!startedAt) return '—'

  const started = new Date(startedAt).getTime()
  const now = Date.now()
  const diffMs = Math.max(0, now - started)
  const totalHours = Math.floor(diffMs / (1000 * 60 * 60))
  const days = Math.floor(totalHours / 24)
  const hours = totalHours % 24
  return days > 0 ? `${days}d ${hours}h` : `${hours}h`
}

const getStudentName = (submission, studentAccounts = []) => {
  const account = studentAccounts.find((item) => item.splNumber === submission.studentId)
  if (account?.fullName) return account.fullName
  return submission.studentName || submission.studentId || 'Unknown student'
}

const getStudentBatch = (submission, studentAccounts = []) => {
  const account = studentAccounts.find((item) => item.splNumber === submission.studentId)
  if (account?.batchNumber) return account.batchNumber
  return submission.batchNumber || submission.studentBatchNumber || '—'
}

function QueueMembersPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const [studentAccounts, setStudentAccounts] = useState([])
  const [queueRows, setQueueRows] = useState(() => {
    const sessionQueue = sessionStorage.getItem('queueMembersData')
    if (sessionQueue) {
      try {
        return JSON.parse(sessionQueue)
      } catch {
        return []
      }
    }
    return location.state?.queueSubmissions || []
  })
  const [selectedExercise, setSelectedExercise] = useState('all')
  const [selectedBatch, setSelectedBatch] = useState('all')
  const [selectedIds, setSelectedIds] = useState([])

  useEffect(() => {
    const loadAccounts = async () => {
      const localAccounts = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
      setStudentAccounts(localAccounts)

      const { data, error } = await supabase.from('student_accounts').select('spl_number, full_name, batch_number')
      if (!error && data) {
        setStudentAccounts((current) => {
          const merged = [...current]
          data.forEach((row) => {
            const isAlreadyPresent = merged.some((item) => item.splNumber === row.spl_number)
            if (!isAlreadyPresent) {
              merged.push({
                splNumber: row.spl_number,
                fullName: row.full_name,
                batchNumber: row.batch_number,
              })
            }
          })
          return merged
        })
      }
    }

    loadAccounts()
  }, [])

  useEffect(() => {
    const loadQueueRows = async () => {
      const cachedSessionQueue = sessionStorage.getItem('queueMembersData')
      if (cachedSessionQueue) {
        try {
          const parsedRows = JSON.parse(cachedSessionQueue)
          if (parsedRows?.length) {
            setQueueRows(parsedRows)
            return
          }
        } catch {
          // ignore invalid cached data and continue below
        }
      }

      if (location.state?.queueSubmissions?.length) {
        setQueueRows(location.state.queueSubmissions)
        return
      }

      const localRows = JSON.parse(localStorage.getItem('flightSubmissions') || '[]')
      const localQueue = localRows.filter((item) => item.availability === 'available' && item.queueStatus === 'queued')
      setQueueRows(localQueue)

      const { data, error } = await supabase
        .from('flight_submissions')
        .select('*')
        .eq('availability', 'available')
        .eq('queue_status', 'queued')
        .order('queue_started_at', { ascending: true })

      if (!error && data?.length) {
        const databaseQueue = data.map((item) => ({
          id: item.id,
          studentId: item.student_id,
          studentName: item.student_name,
          flightDate: item.flight_date,
          exercise: item.exercise,
          totalFlyingHours: item.total_flying_hours,
          availability: item.availability,
          queueStatus: item.queue_status || 'queued',
          queueStartedAt: item.queue_started_at,
          submittedAt: item.submitted_at,
          batchNumber: item.batch_number,
        }))

        setQueueRows((current) => {
          if (current.length > 0) return current
          return databaseQueue
        })
      }
    }

    loadQueueRows()
  }, [location.state])

  const queueEntries = useMemo(() => queueRows.map((row) => ({
    ...row,
    rowKey: row.id || `${row.studentId}-${row.flightDate || row.submittedAt || row.queueStartedAt}`,
    studentName: getStudentName(row, studentAccounts),
    batchNumber: getStudentBatch(row, studentAccounts),
  })), [queueRows, studentAccounts])

  const filteredRows = useMemo(() => queueEntries.filter((row) => {
    const matchesExercise = selectedExercise === 'all' || row.exercise === selectedExercise
    const matchesBatch = selectedBatch === 'all' || row.batchNumber === selectedBatch
    return matchesExercise && matchesBatch
  }), [queueEntries, selectedExercise, selectedBatch])

  const exerciseOptions = ['all', ...new Set(queueEntries.map((row) => row.exercise).filter(Boolean))]
  const batchOptions = ['all', ...new Set(queueEntries.map((row) => row.batchNumber).filter((value) => value && value !== '—'))]

  const toggleSelection = (rowKey) => {
    setSelectedIds((current) => (current.includes(rowKey)
      ? current.filter((item) => item !== rowKey)
      : [...current, rowKey]))
  }

  const completeQueueEntry = async (row) => {
    const rowKey = row.rowKey
    const nextQueueRows = queueRows.filter((entry) => (entry.id || `${entry.studentId}-${entry.flightDate || entry.submittedAt || entry.queueStartedAt}`) !== rowKey)
    setQueueRows(nextQueueRows)
    setSelectedIds((current) => current.filter((item) => item !== rowKey))

    const recordId = row.id
    if (recordId) {
      const { error } = await supabase
        .from('flight_submissions')
        .update({
          queue_status: 'completed',
          queue_completed_at: new Date().toISOString(),
        })
        .eq('id', recordId)

      if (error) {
        setQueueRows((current) => [...current, row])
        window.alert(`Unable to complete this queue item: ${error.message}`)
      }
    }
  }

  const completeSelectedRows = async () => {
    if (selectedIds.length === 0) return

    const rowsToComplete = filteredRows.filter((row) => selectedIds.includes(row.rowKey))

    for (const row of rowsToComplete) {
      await completeQueueEntry(row)
    }
  }

  const deselectAll = () => setSelectedIds([])
  const selectAllVisible = () => {
    const visibleKeys = filteredRows.map((row) => row.rowKey)
    setSelectedIds((current) => {
      const next = new Set(current)
      visibleKeys.forEach((key) => next.add(key))
      return [...next]
    })
  }

  return (
    <main className="queue-members-page">
      <div className="queue-page-shell">
        <div className="queue-page-header">
          <div>
            <span className="dashboard-label">FIRST COME, FIRST SERVED</span>
            <h1>Queue members</h1>
            <p>Review the active queue, filter by exercise or batch, and complete selected entries.</p>
          </div>
          <button type="button" className="btn-back-to-dashboard" onClick={() => navigate('/admin/cadets-availability')}>
            Back to dashboard
          </button>
        </div>

        <div className="queue-page-toolbar">
          <div className="queue-filter-row">
            <label className="queue-filter-field">
              <span>Exercise</span>
              <select value={selectedExercise} onChange={(event) => setSelectedExercise(event.target.value)}>
                {exerciseOptions.map((exercise) => (
                  <option key={exercise} value={exercise}>
                    {exercise === 'all' ? 'ALL EXERCISES' : exercise}
                  </option>
                ))}
              </select>
            </label>

            <label className="queue-filter-field">
              <span>Batch</span>
              <select value={selectedBatch} onChange={(event) => setSelectedBatch(event.target.value)}>
                {batchOptions.map((batch) => (
                  <option key={batch} value={batch}>
                    {batch === 'all' ? 'ALL BATCHES' : `Batch ${batch}`}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <div className="queue-selection-actions">
            <button type="button" className="btn-secondary" onClick={selectAllVisible}>
              Select visible
            </button>
            <button type="button" className="btn-secondary" onClick={deselectAll}>
              Clear selection
            </button>
            <button
              type="button"
              className="btn-primary"
              onClick={completeSelectedRows}
              disabled={selectedIds.length === 0}
            >
              Complete selected ({selectedIds.length})
            </button>
          </div>
        </div>

        <div className="queue-members-table-wrapper">
          <table className="queue-members-table">
            <thead>
              <tr>
                <th>
                  <input
                    type="checkbox"
                    checked={filteredRows.length > 0 && filteredRows.every((row) => selectedIds.includes(row.rowKey))}
                    onChange={() => {
                      const visibleKeys = filteredRows.map((row) => row.rowKey)
                      const allSelected = visibleKeys.every((key) => selectedIds.includes(key))
                      setSelectedIds((current) => {
                        if (allSelected) {
                          return current.filter((key) => !visibleKeys.includes(key))
                        }
                        return [...new Set([...current, ...visibleKeys])]
                      })
                    }}
                    aria-label="Select all visible queue members"
                  />
                </th>
                <th>Name</th>
                <th>SPL</th>
                <th>Batch</th>
                <th>Exercise</th>
                <th>Waiting</th>
                <th>Hours</th>
                <th>Date</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRows.length > 0 ? (
                filteredRows.map((row) => (
                  <tr key={row.rowKey}>
                    <td>
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(row.rowKey)}
                        onChange={() => toggleSelection(row.rowKey)}
                        aria-label={`Select ${row.studentName}`}
                      />
                    </td>
                    <td><strong>{row.studentName}</strong></td>
                    <td>{row.studentId}</td>
                    <td>{row.batchNumber}</td>
                    <td>{row.exercise}</td>
                    <td>{getQueueWaitingDuration(row)}</td>
                    <td>{row.totalFlyingHours || 0} hrs</td>
                    <td>{formatDate(row.flightDate || row.submittedAt)}</td>
                    <td>
                      <button type="button" className="btn-primary btn-small" onClick={() => completeQueueEntry(row)}>
                        Complete
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="empty-submissions">
                    No queue members match the current filters.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </main>
  )
}

export default QueueMembersPage
