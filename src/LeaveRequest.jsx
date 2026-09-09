import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'

import './FlightAvailability.css'

const approverNames = {
  CFI: 'Captain Shariq',
  DCFI: 'Captain SM',
}

function LeaveRequest() {
  const navigate = useNavigate()
  const studentId = localStorage.getItem('studentId') || 'AVV-0001'
  const studentName = localStorage.getItem('studentName') || 'Demo Student'
  const studentBatchNumber = localStorage.getItem('studentBatchNumber') || ''
  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [requestStatus, setRequestStatus] = useState(null)
  const [isCreating, setIsCreating] = useState(false)

  const findLatestRequest = () => {
    const requests = JSON.parse(localStorage.getItem('leaveRequests') || '[]')
    return requests
      .filter((request) => request.studentId === studentId)
      .sort((first, second) => new Date(second.requestedAt) - new Date(first.requestedAt))[0] || null
  }

  useEffect(() => {
    const updateStatus = () => {
      if (isCreating) return
      const request = findLatestRequest()
      if (!request) return
      setRequestStatus(request)
      setFromDate(request.fromDate || '')
      setToDate(request.toDate || '')
      setReason(request.reason || '')
    }

    updateStatus()
    window.addEventListener('storage', updateStatus)
    window.addEventListener('focus', updateStatus)
    const refresh = window.setInterval(updateStatus, 1000)

    return () => {
      window.removeEventListener('storage', updateStatus)
      window.removeEventListener('focus', updateStatus)
      window.clearInterval(refresh)
    }
  }, [studentId, isCreating])

  const handleSubmit = (event) => {
    event.preventDefault()
    setError('')

    if (!fromDate || !toDate || !reason.trim()) {
      setError('Please select both leave dates and enter a reason.')
      return
    }

    if (toDate < fromDate) {
      setError('Leave end date cannot be before the leave start date.')
      return
    }

    const request = {
      studentId,
      studentName,
      studentBatchNumber,
      fromDate,
      toDate,
      reason: reason.trim(),
      status: 'Pending approval',
      requestedAt: new Date().toISOString(),
    }
    const previousRequests = JSON.parse(localStorage.getItem('leaveRequests') || '[]')
    localStorage.setItem('leaveRequests', JSON.stringify([...previousRequests, request]))
    setRequestStatus(request)
    setIsCreating(false)
  }

  const startNewRequest = () => {
    setIsCreating(true)
    setRequestStatus(null)
    setFromDate('')
    setToDate('')
    setReason('')
    setError('')
  }

  const statusClass = requestStatus?.status.toLowerCase().replace(' ', '-') || 'pending-approval'
  const reviewedBy = requestStatus?.reviewedBy || approverNames[requestStatus?.reviewedRole] || 'the admin'

  return (
    <main className="flight-page">
      <div className="flight-background"></div>
      <div className="flight-overlay"></div>

      <header className="flight-header">
        <div className="academy-brand">
          <div className="brand-small">AVVYANA</div>
          <div className="brand-main">AVIATION ACADEMY</div>
        </div>
        <div className="student-badge">
          <span>STUDENT</span>
          <strong>{studentId}</strong>
        </div>
      </header>

      <section className="availability-wrapper">
        <div className="availability-card leave-request-page-card">
          <button type="button" className="leave-page-back" onClick={() => navigate('/flight-availability')}>
            BACK TO FLIGHT AVAILABILITY
          </button>

          <div className="availability-heading">
            <div className="section-label">STUDENT SERVICES</div>
            <h1>Leave Request</h1>
            <p>Submit a leave request for admin review and track its approval status here.</p>
          </div>

          {requestStatus && !isCreating && (
            <div className={`leave-status-banner ${statusClass}`}>
              <strong>LEAVE REQUEST: {requestStatus.status.toUpperCase()}</strong>
              <span>
                {requestStatus.status === 'Approved'
                  ? `Approved by ${reviewedBy}.`
                  : requestStatus.status === 'Rejected'
                    ? `Rejected by ${reviewedBy}. Reason: ${requestStatus.rejectionReason || 'Please contact the academy.'}`
                    : 'Your leave request is waiting for admin approval.'}
              </span>
            </div>
          )}

          {requestStatus && !isCreating ? (
            <div className={`leave-request-pending ${statusClass}`}>
              <span className="pending-icon">✓</span>
              <span>
                <strong>{requestStatus.status === 'Approved' ? 'Request approved' : requestStatus.status === 'Rejected' ? 'Request rejected' : 'Request raised'}</strong>
                <small>{requestStatus.fromDate} to {requestStatus.toDate}</small>
              </span>
              <button type="button" className="new-leave-request-button" onClick={startNewRequest}>
                RAISE ANOTHER REQUEST
              </button>
            </div>
          ) : (
            <form className="leave-request-box" onSubmit={handleSubmit}>
              <div className="leave-date-grid">
                <label>
                  FROM DATE
                  <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} required />
                </label>
                <label>
                  TO DATE
                  <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} required />
                </label>
              </div>

              <label className="leave-reason-field">
                REASON <span>*</span>
                <textarea
                  placeholder="Enter the reason for your leave request"
                  value={reason}
                  onChange={(event) => setReason(event.target.value)}
                  rows="5"
                  required
                />
              </label>

              {error && <div className="flight-error">{error}</div>}

              <button type="submit" className="leave-request-submit">
                <span>RAISE LEAVE REQUEST</span>
                <span className="submit-arrow">→</span>
              </button>
            </form>
          )}
        </div>
      </section>
    </main>
  )
}

export default LeaveRequest
