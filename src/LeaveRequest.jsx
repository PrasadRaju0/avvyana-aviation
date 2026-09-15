import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'

import './FlightAvailability.css'

const approverNames = {
  CFI: 'Captain Shariq',
  DCFI: 'Captain SM',
}

function getLeaveDuration(fromDate, toDate) {
  if (!fromDate || !toDate) return '-'

  const start = new Date(`${fromDate}T00:00:00`)
  const end = new Date(`${toDate}T00:00:00`)
  const difference = end - start

  if (Number.isNaN(difference) || difference < 0) return '-'

  return `${Math.floor(difference / (1000 * 60 * 60 * 24)) + 1} days`
}

function getTodayDate() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function generateTrackingId() {
  return `AVV-${Math.random().toString(36).slice(2, 8).toUpperCase()}`
}

function getStoredLeaveRequests() {
  try {
    const storedRequests = localStorage.getItem('leaveRequests')
    if (!storedRequests) return []

    const parsedRequests = JSON.parse(storedRequests)
    return Array.isArray(parsedRequests) ? parsedRequests : []
  } catch {
    return []
  }
}

function formatStudentDate(dateValue) {
  if (!dateValue) return '-'
  const date = new Date(`${dateValue}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
}

function getLeaveProgress(request) {
  const closureCompleted = Boolean(request.returnReportedAt || request.closureClosedAt)

  if (request.status === 'Rejected') {
    return [
      { label: 'Leave raised', state: 'complete' },
      { label: 'Pending with CFI/DCFI', state: 'rejected' },
      { label: 'Leave closure', state: 'locked' },
    ]
  }

  if (request.status === 'Approved') {
    return [
      { label: 'Leave raised', state: 'complete' },
      { label: 'Pending with CFI/DCFI', state: 'complete' },
      { label: 'Leave closure', state: closureCompleted ? 'complete' : 'active' },
    ]
  }

  return [
    { label: 'Leave raised', state: 'complete' },
    { label: 'Pending with CFI/DCFI', state: 'active' },
    { label: 'Leave closure', state: 'upcoming' },
  ]
}

function getRequestStatusLabel(request) {
  if (!request) {
    return 'No requests yet'
  }

  if (request.status === 'Pending approval') {
    return request.returnReportedAt || request.closureClosedAt ? 'Leave closed' : 'Pending with CFI/DCFI'
  }

  if (request.status === 'Approved') {
    return request.returnReportedAt || request.closureClosedAt ? 'Leave closed' : 'Approved'
  }

  return request.status
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
  const [requests, setRequests] = useState([])
  const [databaseRequests, setDatabaseRequests] = useState(null)
  const [isCreating, setIsCreating] = useState(false)
  const [requestView, setRequestView] = useState('all')

  const shouldShowForm = requests.length === 0 || isCreating
  const latestRequest = requests[0] || null

  const findLocalStudentRequests = () => {
    const requests = getStoredLeaveRequests()
    return requests
      .filter((request) => request.studentId === studentId)
      .sort((first, second) => new Date(second.requestedAt) - new Date(first.requestedAt))
  }

  useEffect(() => {
    let isMounted = true

    const updateStatus = async () => {
      if (isCreating) return

      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      if (!isMounted) return

      if (!error) {
        const mappedRequests = data.map((item) => ({
          id: item.id,
          studentId: item.student_id,
          studentName: item.student_name,
          fromDate: item.from_date,
          toDate: item.to_date,
          reason: item.reason,
          status: item.status,
          rejectionReason: item.rejection_reason,
          reviewedBy: item.reviewed_by,
          reviewedRole: item.reviewed_role,
          reviewedAt: item.reviewed_at,
          requestedAt: item.created_at,
          trackingId: `AVV-${item.id}`,
        }))
        setDatabaseRequests(mappedRequests)
        setRequests(mappedRequests)
        return
      }

      const localRequests = findLocalStudentRequests()
      setRequests(localRequests)
    }

    updateStatus()
    window.addEventListener('storage', updateStatus)
    window.addEventListener('focus', updateStatus)
    const refresh = window.setInterval(updateStatus, 1000)

    return () => {
      isMounted = false
      window.removeEventListener('storage', updateStatus)
      window.removeEventListener('focus', updateStatus)
      window.clearInterval(refresh)
    }
  }, [studentId, isCreating])

  const handleSubmit = async (event) => {
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
      trackingId: generateTrackingId(),
    }
    const { error: requestError } = await supabase
      .from('leave_requests')
      .insert({
        student_id: request.studentId,
        student_name: request.studentName,
        from_date: request.fromDate,
        to_date: request.toDate,
        reason: request.reason,
        status: request.status,
      })

    if (requestError) {
      setError(`Unable to save leave request: ${requestError.message}`)
      return
    }

    setDatabaseRequests(null)
    setRequests([request, ...(databaseRequests || requests)])
    setIsCreating(false)
  }

  const startNewRequest = () => {
    setIsCreating(true)
    setFromDate('')
    setToDate('')
    setReason('')
    setError('')
  }

  const markReturned = (request) => {
    if (!window.confirm('Confirm that you have returned to the academy?')) return

    const updatedRequests = getStoredLeaveRequests().map((item) => (
      item.requestedAt === request.requestedAt
        ? {
            ...item,
            returnReportedAt: new Date().toISOString(),
            closureClosedAt: new Date().toISOString(),
          }
        : item
    ))
    localStorage.setItem('leaveRequests', JSON.stringify(updatedRequests))
    setRequests(updatedRequests.filter((item) => item.studentId === studentId).sort(
      (first, second) => new Date(second.requestedAt) - new Date(first.requestedAt)
    ))
  }

  return (
    <main className="flight-page">
      <div className="flight-background"></div>
      <div className="flight-overlay"></div>

      <header className="flight-header">
        <button type="button" className="academy-brand academy-brand-button" onClick={() => navigate('/')} aria-label="Go to home page">
          <div className="brand-small">Avyanna</div>
          <div className="brand-main">AVIATION ACADEMY</div>
        </button>
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
          </div>

          {!isCreating && latestRequest && (
            <div className="leave-progress leave-progress-summary" aria-label="Leave request progress">
              <div className="leave-progress-header">Leave Progress</div>
              {getLeaveProgress(latestRequest).map((step, stepIndex) => {
                const marker = step.state === 'complete' ? '✓' : step.state === 'rejected' ? '!' : '•'

                return (
                  <div className={`leave-progress-step ${step.state}`} key={`${step.label}-${stepIndex}`}>
                    <span className="leave-progress-marker">{marker}</span>
                    <div className="leave-progress-copy">
                      <span className="leave-progress-title">{step.label}</span>
                    </div>
                  </div>
                )
              })}
            </div>
          )}

          {!isCreating && (
            <div className="leave-summary-card" aria-label="Leave request summary">
              <div className="leave-summary-label">APPROVED LEAVES TAKEN</div>
              <div className="leave-summary-value">{requests.filter((request) => request.status === 'Approved').length}</div>
              <div className="leave-summary-caption">
                {requests.filter((request) => request.status === 'Approved').length === 0
                  ? 'No approved leaves yet.'
                  : requests.filter((request) => request.status === 'Approved').length === 1
                    ? '1 approved leave taken so far.'
                    : `${requests.filter((request) => request.status === 'Approved').length} approved leaves taken so far.`}
              </div>
            </div>
          )}

          {!isCreating && (
            <div className="leave-request-history">
              <div className="leave-history-intro">
                <div className="leave-history-copy">
                  <strong>Leave request history</strong>
                  <span>Track every leave request, approval decision, and closure from one place.</span>
                </div>
                <div className="leave-history-actions">
                  <button
                    type="button"
                    className={`leave-history-tab ${requestView === 'all' ? 'active' : ''}`}
                    onClick={() => setRequestView('all')}
                  >
                    All requests
                  </button>
                  <button
                    type="button"
                    className={`leave-history-tab ${requestView === 'approved' ? 'active' : ''}`}
                    onClick={() => setRequestView('approved')}
                  >
                    Approved leaves
                  </button>
                  <button type="button" className="new-leave-request-button" onClick={startNewRequest}>
                    RAISE NEW REQUEST
                  </button>
                </div>
              </div>

              {(() => {
                const visibleRequests = requestView === 'approved'
                  ? requests.filter((request) => request.status === 'Approved')
                  : requests

                return (
                  <section className="leave-request-group all-requests">
                    <div className="leave-request-group-heading">
                      <strong>{requestView === 'approved' ? 'Approved leaves' : 'Request history'}</strong>
                      <span>{visibleRequests.length}</span>
                    </div>
                    {visibleRequests.length > 0 ? visibleRequests.map((request, index) => {
                const statusClass = request.status.toLowerCase().replace(' ', '-')
                const reviewedBy = request.reviewedBy || approverNames[request.reviewedRole] || 'the admin'

                return (
                  <article className={`leave-request-record ${statusClass}`} key={`${request.requestedAt}-${index}`}>
                    <div className="leave-request-meta">
                      <span className="leave-request-meta-label">Tracking ID</span>
                      <strong>{request.trackingId || 'AVV-TRACK'}</strong>
                      <small>{new Date(request.requestedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })}</small>
                    </div>
                    <div className="leave-status-banner">
                      <strong>
                        {request.status === 'Approved'
                          ? (request.returnReportedAt || request.closureClosedAt ? '✓ LEAVE CLOSED' : '✓ APPROVED')
                          : request.status === 'Rejected'
                            ? '× REJECTED'
                            : '◷ PENDING WITH CFI/DCFI'}
                      </strong>
                      <span>
                        {request.status === 'Approved'
                          ? (request.returnReportedAt || request.closureClosedAt
                            ? `Leave closed successfully. Approved by ${reviewedBy}.`
                            : `Approved by ${reviewedBy}.`)
                          : request.status === 'Rejected'
                            ? `Rejected by ${reviewedBy}. Reason: ${request.rejectionReason || 'Please contact the academy.'}`
                            : 'Your leave request has been raised and is pending review by CFI/DCFI.'}
                      </span>
                      {request.status === 'Approved' && (request.returnReportedAt
                        ? <small className="return-confirmed">✓ Return reported to academy</small>
                        : getTodayDate() >= request.toDate && (
                          <button type="button" className="return-report-button" onClick={() => markReturned(request)}>
                            CONFIRM RETURN TO ACADEMY
                          </button>
                        ))}
                    </div>
                    <div className={`leave-request-pending ${statusClass}`}>
                      <span className="pending-icon">{request.status === 'Approved' ? '✓' : request.status === 'Rejected' ? '!' : '◷'}</span>
                      <span className="leave-request-details">
                        <strong>
                          {request.status === 'Approved'
                            ? (request.returnReportedAt || request.closureClosedAt ? 'Leave closed' : 'Approved')
                            : request.status === 'Rejected'
                              ? 'Request rejected'
                              : 'Pending with CFI/DCFI'}
                        </strong>
                        <small>{formatStudentDate(request.fromDate)} to {formatStudentDate(request.toDate)} · {getLeaveDuration(request.fromDate, request.toDate)}</small>
                      </span>
                    </div>
                  </article>
                )
                    }) : <div className="leave-empty-view">No leave requests yet. Raise your first request below.</div>}
                  </section>
                )
              })}
            </div>
          )}

          {shouldShowForm && (
            <form className="leave-request-box" onSubmit={handleSubmit}>
              <div className="leave-form-intro">
                <strong>Plan your time away</strong>
                <span>Choose your dates and tell the academy why you need leave.</span>
              </div>

              <div className="leave-date-grid">
                <label>
                  START DATE
                  <input type="date" value={fromDate} onChange={(event) => setFromDate(event.target.value)} required />
                </label>
                <label>
                  RETURN DATE
                  <input type="date" value={toDate} onChange={(event) => setToDate(event.target.value)} required />
                </label>
              </div>

              <label className="leave-reason-field">
                REASON FOR LEAVE <span>*</span>
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
