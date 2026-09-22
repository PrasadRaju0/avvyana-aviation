import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'

import './FlightAvailability.css'
import './LeaveRequest.css'

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

  const days = Math.floor(difference / (1000 * 60 * 60 * 24)) + 1
  return `${days} ${days === 1 ? 'day' : 'days'}`
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
    : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
}

function getLeaveProgress(request) {
  const closureCompleted = Boolean(request.returnReportedAt || request.closureClosedAt)

  if (request.status === 'Rejected') {
    return [
      { label: 'Leave raised', subtitle: 'Request submitted successfully', state: 'complete' },
      { label: 'Review by CFI/DCFI', subtitle: `Rejected: ${request.rejectionReason || 'Contact Admin'}`, state: 'rejected' },
      { label: 'Leave closure', subtitle: 'Process stopped', state: 'upcoming' },
    ]
  }

  if (request.status === 'Approved') {
    return [
      { label: 'Leave raised', subtitle: 'Request submitted successfully', state: 'complete' },
      { label: 'Approved by CFI/DCFI', subtitle: request.reviewedBy ? `Approved by ${request.reviewedBy}` : 'Approved', state: 'complete' },
      { label: 'Leave closure', subtitle: closureCompleted ? 'Returned to Academy' : 'Pending return confirmation', state: closureCompleted ? 'complete' : 'active' },
    ]
  }

  return [
    { label: 'Leave raised', subtitle: 'Request submitted successfully', state: 'complete' },
    { label: 'Pending with CFI/DCFI', subtitle: 'Under academy flight command review', state: 'active' },
    { label: 'Leave closure', subtitle: 'Awaiting leave approval', state: 'upcoming' },
  ]
}

function LeaveRequest() {
  const navigate = useNavigate()
  const studentId = localStorage.getItem('studentId') || 'AVV-0001'
  const studentName = localStorage.getItem('studentName') || 'Cadet Pilot'
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

  const approvedLeavesCount = requests.filter((r) => r.status === 'Approved').length
  const pendingLeavesCount = requests.filter((r) => r.status === 'Pending approval').length

  const findLocalStudentRequests = () => {
    const stored = getStoredLeaveRequests()
    return stored
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
      setError('Please select both leave dates and provide a detailed reason.')
      return
    }

    if (toDate < fromDate) {
      setError('Return date cannot be earlier than start date.')
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
      setError(`Unable to submit leave request: ${requestError.message}`)
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
    if (!window.confirm('Confirm that you have returned to the academy campus?')) return

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

  const visibleRequests = requestView === 'approved'
    ? requests.filter((r) => r.status === 'Approved')
    : requestView === 'pending'
      ? requests.filter((r) => r.status === 'Pending approval')
      : requests

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
        <div className="leave-request-container">
          <div className="leave-request-card-premium">
            <button type="button" className="leave-premium-back-btn" onClick={() => navigate('/dashboard')}>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              <span>Back to Dashboard</span>
            </button>

            <div className="leave-premium-header">
              <div className="leave-premium-header-copy">
                <span className="leave-premium-tag">Student Portal</span>
                <h1 className="leave-premium-title">Leave Management</h1>
                <p className="leave-premium-subtitle">
                  Apply for scheduled leaves, monitor CFI/DCFI approvals, and log campus check-ins.
                </p>
              </div>

              {!shouldShowForm && (
                <button type="button" className="leave-header-action-btn" onClick={startNewRequest}>
                  <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                  </svg>
                  <span>Apply for Leave</span>
                </button>
              )}
            </div>

            {!isCreating && latestRequest && (
              <div className="leave-premium-top-grid">
                {/* Stepper Card */}
                <div className="leave-stepper-card">
                  <div className="leave-stepper-head">
                    <span>Active Request Timeline</span>
                    <div className="leave-stepper-tracking">{latestRequest.trackingId || 'AVV-TRACK'}</div>
                  </div>

                  <div className="leave-stepper-steps">
                    {getLeaveProgress(latestRequest).map((step, stepIndex) => {
                      const marker = step.state === 'complete' ? '✓' : step.state === 'rejected' ? '!' : stepIndex + 1
                      return (
                        <div className={`leave-step-item ${step.state}`} key={`${step.label}-${stepIndex}`}>
                          {stepIndex < 2 && <div className="leave-step-line" />}
                          <div className="leave-step-icon">{marker}</div>
                          <div className="leave-step-text">
                            <strong>{step.label}</strong>
                            <small>{step.subtitle}</small>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                </div>

                {/* Metrics */}
                <div className="leave-metrics-card">
                  <div className="leave-hero-stat">
                    <div className="leave-hero-stat-top">
                      <span>Approved Leaves Taken</span>
                      <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </div>
                    <div className="leave-hero-stat-value">{approvedLeavesCount}</div>
                    <div className="leave-hero-stat-caption">
                      {approvedLeavesCount === 0 ? 'No approved leaves logged yet' : `${approvedLeavesCount} authorized leave records`}
                    </div>
                  </div>

                  <div className="leave-secondary-stat">
                    <span>Pending Command Review</span>
                    <strong>{pendingLeavesCount}</strong>
                  </div>
                </div>
              </div>
            )}

            {/* Leave Application Form */}
            {shouldShowForm && (
              <form className="leave-form-card-premium" onSubmit={handleSubmit}>
                <div className="leave-form-header">
                  <div className="leave-form-header-text">
                    <h3>Submit New Leave Application</h3>
                    <p>Specify your absence timeframe and reason for Academy flight scheduling.</p>
                  </div>
                  {requests.length > 0 && (
                    <button type="button" className="leave-form-cancel-btn" onClick={() => setIsCreating(false)}>
                      Cancel
                    </button>
                  )}
                </div>

                <div className="leave-grid-fields">
                  <div className="leave-field-group">
                    <label>
                      <span>From Date</span>
                      <span className="required">*</span>
                    </label>
                    <input
                      type="date"
                      className="leave-input-premium"
                      value={fromDate}
                      min={getTodayDate()}
                      onChange={(e) => setFromDate(e.target.value)}
                      required
                    />
                  </div>

                  <div className="leave-field-group">
                    <label>
                      <span>To Date</span>
                      <span className="required">*</span>
                    </label>
                    <input
                      type="date"
                      className="leave-input-premium"
                      value={toDate}
                      min={fromDate || getTodayDate()}
                      onChange={(e) => setToDate(e.target.value)}
                      required
                    />
                  </div>
                </div>

                <div className="leave-field-group">
                  <label>
                    <span>Reason for Leave</span>
                    <span className="required">*</span>
                  </label>
                  <textarea
                    className="leave-textarea-premium"
                    placeholder="Provide detailed explanation for your leave request (e.g. personal, medical, exam)..."
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    rows="4"
                    required
                  />
                </div>

                {error && <div className="flight-error" style={{ marginTop: '16px' }}>{error}</div>}

                <div className="leave-form-footer">
                  {requests.length > 0 && (
                    <button type="button" className="leave-form-cancel-btn" onClick={() => setIsCreating(false)}>
                      Discard
                    </button>
                  )}
                  <button type="submit" className="leave-submit-btn-premium">
                    <span>Submit Application</span>
                    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ width: '16px', height: '16px' }}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
                    </svg>
                  </button>
                </div>
              </form>
            )}

            {/* Leave History List */}
            {!isCreating && requests.length > 0 && (
              <div className="leave-history-section">
                <div className="leave-history-nav">
                  <div className="leave-tabs-pill">
                    <button
                      type="button"
                      className={`leave-tab-pill-btn ${requestView === 'all' ? 'active' : ''}`}
                      onClick={() => setRequestView('all')}
                    >
                      <span>All Requests</span>
                      <span className="leave-tab-count">{requests.length}</span>
                    </button>
                    <button
                      type="button"
                      className={`leave-tab-pill-btn ${requestView === 'approved' ? 'active' : ''}`}
                      onClick={() => setRequestView('approved')}
                    >
                      <span>Approved</span>
                      <span className="leave-tab-count">{approvedLeavesCount}</span>
                    </button>
                    <button
                      type="button"
                      className={`leave-tab-pill-btn ${requestView === 'pending' ? 'active' : ''}`}
                      onClick={() => setRequestView('pending')}
                    >
                      <span>Pending</span>
                      <span className="leave-tab-count">{pendingLeavesCount}</span>
                    </button>
                  </div>
                </div>

                <div className="leave-history-list">
                  {visibleRequests.length > 0 ? (
                    visibleRequests.map((req, idx) => {
                      const isClosed = Boolean(req.returnReportedAt || req.closureClosedAt)
                      const isApproved = req.status === 'Approved'
                      const isRejected = req.status === 'Rejected'
                      const reviewer = req.reviewedBy || approverNames[req.reviewedRole] || 'CFI / DCFI'
                      const statusClass = isClosed ? 'closed' : isApproved ? 'approved' : isRejected ? 'rejected' : 'pending'

                      return (
                        <article className="leave-record-card-premium" key={`${req.requestedAt}-${idx}`}>
                          <div className="leave-record-top">
                            <div className="leave-record-tracking">
                              <span className="leave-record-tracking-id">{req.trackingId || 'AVV-TRACK'}</span>
                              <span className="leave-record-date-created">Applied on {formatStudentDate(req.requestedAt ? req.requestedAt.split('T')[0] : '')}</span>
                            </div>

                            <span className={`leave-badge-status ${statusClass}`}>
                              {isClosed ? '✓ Closed & Returned' : isApproved ? '✓ Approved' : isRejected ? '✕ Rejected' : '◷ Pending Approval'}
                            </span>
                          </div>

                          <div className="leave-record-body">
                            <div className="leave-record-dates">
                              <span className="leave-record-dates-label">Leave Timeframe</span>
                              <div className="leave-record-dates-val">
                                {formatStudentDate(req.fromDate)} – {formatStudentDate(req.toDate)}
                              </div>
                              <span className="leave-record-duration">Duration: {getLeaveDuration(req.fromDate, req.toDate)}</span>
                            </div>

                            <div className="leave-record-reason">
                              <span className="leave-record-reason-label">Reason Stated</span>
                              <div className="leave-record-reason-text">{req.reason}</div>
                            </div>
                          </div>

                          <div className="leave-record-footer">
                            <div className="leave-review-info">
                              {isApproved ? (
                                <span>Authorized by <strong>{reviewer}</strong></span>
                              ) : isRejected ? (
                                <span style={{ color: '#dc2626' }}>Rejected by <strong>{reviewer}</strong> {req.rejectionReason ? `(${req.rejectionReason})` : ''}</span>
                              ) : (
                                <span>Awaiting CFI / DCFI commanding officer decision</span>
                              )}
                            </div>

                            {isApproved && (
                              req.returnReportedAt ? (
                                <span className="leave-return-confirmed-tag">✓ Return Logged to Campus</span>
                              ) : getTodayDate() >= req.toDate && (
                                <button type="button" className="leave-confirm-return-btn" onClick={() => markReturned(req)}>
                                  Confirm Campus Return
                                </button>
                              )
                            )}
                          </div>
                        </article>
                      )
                    })
                  ) : (
                    <div className="leave-empty-state-premium">
                      <div className="leave-empty-state-icon">
                        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2" style={{ width: '24px', height: '24px' }}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      </div>
                      <h4>No requests found</h4>
                      <p>There are no leave records matching the current tab filter.</p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </main>
  )
}

export default LeaveRequest

