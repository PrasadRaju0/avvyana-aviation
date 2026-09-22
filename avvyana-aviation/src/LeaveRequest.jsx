import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import './LeaveRequest.css'

const approverNames = {
  CFI: 'Captain Shariq Ali (CFI)',
  DCFI: 'Captain SM (DCFI)',
}

function getLeaveDuration(fromDate, toDate) {
  if (!fromDate || !toDate) return '-'
  const start = new Date(`${fromDate}T00:00:00`)
  const end = new Date(`${toDate}T00:00:00`)
  const difference = end - start
  if (Number.isNaN(difference) || difference < 0) return '-'
  const days = Math.floor(difference / (1000 * 60 * 60 * 24)) + 1
  return `${days} ${days === 1 ? 'Day' : 'Days'}`
}

function getLeaveDaysCount(fromDate, toDate) {
  if (!fromDate || !toDate) return 0
  const start = new Date(`${fromDate}T00:00:00`)
  const end = new Date(`${toDate}T00:00:00`)
  const diff = end - start
  if (Number.isNaN(diff) || diff < 0) return 0
  return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
}

function getTodayDate() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function formatStudentDate(dateValue) {
  if (!dateValue) return '-'
  const date = new Date(`${dateValue}T00:00:00`)
  return Number.isNaN(date.getTime())
    ? '-'
    : date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' })
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

function getLeaveStages(request) {
  const isApproved = request.status === 'Approved'
  const isRejected = request.status === 'Rejected'
  const isClosed = Boolean(request.returnReportedAt || request.closureClosedAt)
  const reviewer = request.reviewedBy || approverNames[request.reviewedRole] || 'CFI / DCFI'

  return [
    {
      step: 1,
      name: 'Application Submitted',
      detail: request.requestedAt
        ? `Logged on ${formatStudentDate(request.requestedAt.split('T')[0])}`
        : 'Request filed by Cadet Pilot',
      state: 'complete',
    },
    {
      step: 2,
      name: isApproved ? 'CFI / DCFI Approved' : isRejected ? 'CFI / DCFI Rejected' : 'CFI / DCFI Review',
      detail: isApproved
        ? `Approved by ${reviewer}`
        : isRejected
          ? `Rejected by ${reviewer}`
          : 'Under review by Capt. Shariq Ali & Capt. SM',
      state: isApproved || isRejected ? 'complete' : 'active',
    },
    {
      step: 3,
      name: 'Gate Pass',
      detail: isApproved
        ? `Authorized by ${reviewer}`
        : isRejected
          ? (request.rejectionReason ? `Reason: ${request.rejectionReason}` : 'Gate Pass Not Issued')
          : 'Awaiting CFI / DCFI Approval',
      state: isApproved ? 'complete' : isRejected ? 'rejected' : 'upcoming',
    },
    {
      step: 4,
      name: 'Leave Closure',
      detail: isClosed
        ? 'Campus return logged & leave closed'
        : isApproved
          ? 'Please visit OPS Department'
          : isRejected
            ? 'Process terminated'
            : 'Awaiting leave approval',
      state: isClosed ? 'complete' : isApproved ? 'active' : 'upcoming',
    },
  ]
}

export default function LeaveRequest() {
  const navigate = useNavigate()
  const studentId = localStorage.getItem('studentId') || 'AVV-0001'
  const studentName = localStorage.getItem('studentName') || 'Cadet Pilot'
  const studentBatchNumber = localStorage.getItem('studentBatchNumber') || ''
  const studentMobileNumber = localStorage.getItem('studentMobileNumber') || ''

  const [fromDate, setFromDate] = useState('')
  const [toDate, setToDate] = useState('')
  const [reason, setReason] = useState('')
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [requests, setRequests] = useState([])
  const [isCreating, setIsCreating] = useState(false)
  const [requestView, setRequestView] = useState('all')
  const [showHistory, setShowHistory] = useState(false) // Hidden by default as requested!

  const approvedLeavesCount = requests.filter((r) => r.status === 'Approved').length
  const pendingLeavesCount = requests.filter((r) => r.status === 'Pending approval').length
  const totalDaysApproved = requests
    .filter((r) => r.status === 'Approved')
    .reduce((total, r) => total + getLeaveDaysCount(r.fromDate, r.toDate), 0)

  // Only consider as active if leave is still ongoing (not yet closed and not rejected)
  const activeRequest = requests.find((r) => !r.returnReportedAt && !r.closureClosedAt && r.status !== 'Rejected') || null

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

      const { data, error: fetchErr } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      if (!isMounted) return

      if (!fetchErr && data) {
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
          returnReportedAt: item.return_reported_at,
          closureClosedAt: item.closure_closed_at,
          actualReturnDate: item.actual_return_date,
          trackingId: `AVV-${item.id}`,
        }))
        setRequests(mappedRequests)
        return
      }

      const localRequests = findLocalStudentRequests()
      setRequests(localRequests)
    }

    updateStatus()
    window.addEventListener('storage', updateStatus)
    window.addEventListener('focus', updateStatus)
    const refresh = window.setInterval(updateStatus, 1500)

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
      setError('Please select both departure & return dates and state your reason.')
      return
    }

    if (toDate < fromDate) {
      setError('Return date cannot be earlier than departure date.')
      return
    }

    setSubmitting(true)

    const newReq = {
      student_id: studentId,
      student_name: studentName,
      from_date: fromDate,
      to_date: toDate,
      reason: reason.trim(),
      status: 'Pending approval',
    }

    const { data: inserted, error: insertError } = await supabase
      .from('leave_requests')
      .insert(newReq)
      .select()

    if (insertError) {
      const localReq = {
        id: Math.floor(Math.random() * 9000) + 1000,
        studentId,
        studentName,
        studentBatchNumber,
        studentMobileNumber,
        fromDate,
        toDate,
        reason: reason.trim(),
        status: 'Pending approval',
        requestedAt: new Date().toISOString(),
        trackingId: `AVV-${Math.floor(Math.random() * 9000) + 1000}`,
      }
      const existing = getStoredLeaveRequests()
      localStorage.setItem('leaveRequests', JSON.stringify([localReq, ...existing]))
      setRequests([localReq, ...requests])
    } else if (inserted && inserted[0]) {
      const item = inserted[0]
      const mapped = {
        id: item.id,
        studentId: item.student_id,
        studentName: item.student_name,
        studentBatchNumber,
        studentMobileNumber,
        fromDate: item.from_date,
        toDate: item.to_date,
        reason: item.reason,
        status: item.status,
        requestedAt: item.created_at,
        trackingId: `AVV-${item.id}`,
      }
      setRequests([mapped, ...requests])
    }

    setSubmitting(false)
    setIsCreating(false)
    setFromDate('')
    setToDate('')
    setReason('')
  }

  const startNewRequest = () => {
    setIsCreating(true)
    setFromDate('')
    setToDate('')
    setReason('')
    setError('')
  }

  const openHistoryWithFilter = (filter = 'all') => {
    setRequestView(filter)
    setShowHistory(true)
  }

  const visibleRequests = requestView === 'approved'
    ? requests.filter((r) => r.status === 'Approved')
    : requestView === 'pending'
      ? requests.filter((r) => r.status === 'Pending approval')
      : requests

  const durationPreview = fromDate && toDate ? getLeaveDuration(fromDate, toDate) : null

  return (
    <main className="leave-portal-shell">
      <div className="leave-ambient-glow" />

      {/* Top Navigation Bar */}
      <header className="leave-portal-nav">
        <div className="leave-nav-brand">
          <img src="/avyanna-mark.svg" alt="Avyanna Mark" className="leave-nav-logo" />
          <div className="leave-nav-brand-text">
            <span className="leave-nav-name">AVYANNA</span>
            <span className="leave-nav-sub">AVIATION ACADEMY</span>
          </div>
        </div>

        <div className="leave-nav-actions">
          <div className="leave-student-chip">
            <div className="leave-avatar-circle">
              {studentName.charAt(0).toUpperCase()}
            </div>
            <div className="leave-student-info">
              <strong>{studentName}</strong>
              <span>SPL: {studentId} {studentBatchNumber ? `• Batch ${studentBatchNumber}` : ''}</span>
            </div>
          </div>

          <button
            type="button"
            className="leave-back-dashboard-btn"
            onClick={() => navigate('/dashboard')}
          >
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5">
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Dashboard</span>
          </button>
        </div>
      </header>

      {/* Main Content Container */}
      <div className="leave-portal-container">
        
        {/* Hero Header Banner */}
        <section className="leave-portal-hero">
          <div className="leave-hero-left">
            <div className="leave-hero-tag">
              <span className="live-pulse-cyan" />
              <span>FLIGHT CADET LEAVE SERVICES</span>
            </div>
            <h1 className="leave-hero-title">Leave Management</h1>
            <p className="leave-hero-subtitle">
              Apply for planned leave and track live 4-stage approvals by Captain Shariq Ali (CFI) &amp; Captain SM (DCFI) through official Leave Closure.
            </p>
          </div>

          {!isCreating && (
            <div className="leave-hero-action-buttons">
              <button
                type="button"
                className={`leave-history-toggle-btn ${showHistory ? 'active' : ''}`}
                onClick={() => setShowHistory((prev) => !prev)}
                title="View previous leave records and approvals"
              >
                <span className="history-btn-icon">📜</span>
                <span>{showHistory ? 'Hide History' : 'History'}</span>
                {requests.length > 0 && (
                  <span className="history-badge-count">{requests.length}</span>
                )}
              </button>

              <button
                type="button"
                className="leave-primary-cta-btn"
                onClick={startNewRequest}
              >
                <span className="cta-plus-icon">+</span>
                <span>Apply for Leave</span>
              </button>
            </div>
          )}
        </section>

        {/* 3 Executive Summary Stat Cards (Interactive: Clicking opens corresponding history!) */}
        <section className="leave-stats-row">
          <div
            className="leave-stat-card card-stat-approved interactive"
            onClick={() => openHistoryWithFilter('approved')}
            title="Click to view previous approved leaves in History"
            role="button"
            tabIndex={0}
          >
            <div className="stat-card-icon-box icon-emerald">
              ✓
            </div>
            <div className="stat-card-data">
              <span className="stat-card-label">Approved Leaves</span>
              <div className="stat-card-number">{approvedLeavesCount}</div>
              <span className="stat-card-hint">Click to view in History &rarr;</span>
            </div>
          </div>

          <div
            className="leave-stat-card card-stat-pending interactive"
            onClick={() => openHistoryWithFilter('pending')}
            title="Click to view pending requests in History"
            role="button"
            tabIndex={0}
          >
            <div className="stat-card-icon-box icon-amber">
              ◷
            </div>
            <div className="stat-card-data">
              <span className="stat-card-label">Pending Review</span>
              <div className="stat-card-number">{pendingLeavesCount}</div>
              <span className="stat-card-hint">Under Command Review &rarr;</span>
            </div>
          </div>

          <div
            className="leave-stat-card card-stat-days interactive"
            onClick={() => openHistoryWithFilter('all')}
            title="Click to view all leave records"
            role="button"
            tabIndex={0}
          >
            <div className="stat-card-icon-box icon-cyan">
              📅
            </div>
            <div className="stat-card-data">
              <span className="stat-card-label">Approved Absence</span>
              <div className="stat-card-number">{totalDaysApproved} <small>Days</small></div>
              <span className="stat-card-hint">Total Authorized Off &rarr;</span>
            </div>
          </div>
        </section>

        {/* ==========================================================================
            ACTIVE REQUEST 4-STAGE TRACKER (VISIBLE ONLY WHILE LEAVE IS ONGOING)
            Disappears automatically once completed/closed!
            ========================================================================== */}
        {!isCreating && activeRequest && (
          <section className="leave-stages-section">
            <div className="leave-stages-card">
              
              <div className="leave-stages-header">
                <div className="stages-header-left">
                  <span className="stages-badge-title">Active Request 4-Stage Approval Pipeline</span>
                  <span className="stages-tracking-pill">{activeRequest.trackingId || 'AVV-ACTIVE'}</span>
                </div>

                <div className="stages-header-right">
                  <span className={`stages-status-pill status-${activeRequest.status === 'Approved' ? (activeRequest.returnReportedAt || activeRequest.closureClosedAt ? 'closed' : 'approved') : activeRequest.status === 'Rejected' ? 'rejected' : 'pending'}`}>
                    {activeRequest.status === 'Approved'
                      ? (activeRequest.returnReportedAt || activeRequest.closureClosedAt ? '✓ Stage 4: Leave Closed' : '✓ Stage 3: Gate Pass')
                      : activeRequest.status === 'Rejected'
                        ? '✕ Stage 3: Rejected'
                        : '◷ Stage 2: Under Review'}
                  </span>
                </div>
              </div>

              {/* 4-STAGES HORIZONTAL PROGRESS TRACK */}
              <div className="stages-flow-track four-stages">
                {getLeaveStages(activeRequest).map((stage, sIdx) => {
                  const isLast = sIdx === 3
                  const marker = stage.state === 'complete' ? '✓' : stage.state === 'rejected' ? '✕' : stage.step
                  const isLineFilled = stage.state === 'complete'

                  return (
                    <div className="stage-step-wrapper" key={`stage-${stage.step}`}>
                      <div className={`stage-step-node ${stage.state}`}>
                        <div className="stage-step-circle">
                          {marker}
                        </div>
                        <div className="stage-step-info">
                          <span className="stage-step-num">STAGE {stage.step}</span>
                          <strong className="stage-step-name">{stage.name}</strong>
                          <span className="stage-step-detail">{stage.detail}</span>
                        </div>
                      </div>

                      {!isLast && (
                        <div className={`stage-connector-line ${isLineFilled ? 'filled' : ''}`} />
                      )}
                    </div>
                  )
                })}
              </div>

              {/* Note: Please Visit OPS Department for Stage 4: Leave Closure */}
              {activeRequest.status === 'Approved' && !activeRequest.returnReportedAt && !activeRequest.closureClosedAt && (
                <div className="stage-closure-notice-banner">
                  <div className="closure-notice-icon">📌</div>
                  <div className="closure-banner-text">
                    <strong>Note: Please Visit OPS Department for Stage 4: Leave Closure</strong>
                    <span>Upon returning to campus, please visit the Operations (OPS) Department to verify your return and complete your official leave closure.</span>
                  </div>
                </div>
              )}

              {/* Active Leave Quick Metadata Bar */}
              <div className="stages-card-footer">
                <div className="stages-footer-item">
                  <span className="footer-label">TIMEFRAME</span>
                  <strong className="footer-val">
                    {formatStudentDate(activeRequest.fromDate)} &rarr; {formatStudentDate(activeRequest.toDate)} ({getLeaveDuration(activeRequest.fromDate, activeRequest.toDate)})
                  </strong>
                </div>

                <div className="stages-footer-item">
                  <span className="footer-label">REASON</span>
                  <strong className="footer-val reason-quote">"{activeRequest.reason}"</strong>
                </div>

                <div className="stages-footer-item">
                  <span className="footer-label">COMMANDER CLEARANCE</span>
                  <strong className="footer-val">
                    {activeRequest.status === 'Approved' ? (
                      <span className="text-emerald">✓ Authorized by {activeRequest.reviewedBy || 'Captain SM (DCFI)'}</span>
                    ) : activeRequest.status === 'Rejected' ? (
                      <span className="text-red">✕ Rejected by {activeRequest.reviewedBy || 'Flight Command'}</span>
                    ) : (
                      <span className="text-amber">◷ Pending CFI / DCFI Review</span>
                    )}
                  </strong>
                </div>
              </div>

            </div>
          </section>
        )}

        {/* APPLICATION FORM (Visible when creating) */}
        {isCreating && (
          <section className="leave-form-container">
            <form className="leave-application-card" onSubmit={handleSubmit}>
              <div className="leave-form-top">
                <div>
                  <h2 className="leave-form-heading">New Leave Application</h2>
                  <p className="leave-form-subheading">Select your departure and return dates for flight training adjustment.</p>
                </div>
                <button
                  type="button"
                  className="leave-form-close-btn"
                  onClick={() => setIsCreating(false)}
                >
                  ✕ Discard
                </button>
              </div>

              <div className="leave-form-grid">
                <div className="leave-input-group">
                  <label htmlFor="leave-from-date">
                    <span>From Date (Departure)</span>
                    <span className="required-star">*</span>
                  </label>
                  <input
                    id="leave-from-date"
                    type="date"
                    className="leave-field-input"
                    value={fromDate}
                    min={getTodayDate()}
                    onChange={(e) => setFromDate(e.target.value)}
                    required
                  />
                </div>

                <div className="leave-input-group">
                  <label htmlFor="leave-to-date">
                    <span>To Date (Return)</span>
                    <span className="required-star">*</span>
                  </label>
                  <input
                    id="leave-to-date"
                    type="date"
                    className="leave-field-input"
                    value={toDate}
                    min={fromDate || getTodayDate()}
                    onChange={(e) => setToDate(e.target.value)}
                    required
                  />
                </div>
              </div>

              {durationPreview && durationPreview !== '-' && (
                <div className="leave-duration-preview-banner">
                  <span className="duration-icon">⏱</span>
                  <span>Calculated Duration: <strong>{durationPreview}</strong></span>
                </div>
              )}

              <div className="leave-input-group full-width">
                <label htmlFor="leave-reason">
                  <span>Reason for Leave</span>
                  <span className="required-star">*</span>
                </label>
                <textarea
                  id="leave-reason"
                  className="leave-field-textarea"
                  placeholder="State the purpose of your leave (e.g. DGCA CPL Theory Exams, Medical Appointment, Family Emergency)..."
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  rows={4}
                  required
                />
              </div>

              {error && <div className="leave-error-box">⚠️ {error}</div>}

              <div className="leave-form-bottom-actions">
                <button
                  type="button"
                  className="btn-leave-cancel"
                  onClick={() => setIsCreating(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-leave-submit-primary"
                  disabled={submitting}
                >
                  <span>{submitting ? 'Submitting...' : 'Submit Application'}</span>
                  <span className="btn-submit-arrow">&rarr;</span>
                </button>
              </div>
            </form>
          </section>
        )}

        {/* DEFAULT OVERVIEW CARD: Shown when not creating, no active ongoing request, and history is not open */}
        {!isCreating && !activeRequest && !showHistory && (
          <section className="leave-ready-overview-card">
            <div className="ready-card-icon-box">
              ✈
            </div>
            <div className="ready-card-content">
              <h3>Flight Training Schedule Clear</h3>
              <p>You have no active pending leaves. Click <strong>History</strong> to review your previous approvals and records, or click <strong>Apply for Leave</strong> to schedule a new absence.</p>
            </div>
            <div className="ready-card-actions">
              <button
                type="button"
                className="ready-btn-history"
                onClick={() => openHistoryWithFilter('approved')}
              >
                <span>📜 View Previous Approvals ({approvedLeavesCount})</span>
              </button>
              <button
                type="button"
                className="ready-btn-apply"
                onClick={startNewRequest}
              >
                <span>+ Apply for Leave</span>
              </button>
            </div>
          </section>
        )}

        {/* ==========================================================================
            LEAVE HISTORY RECORDS (ONLY SHOWN IF USER CLICKS "HISTORY"!)
            Otherwise hidden as explicitly requested by user!
            ========================================================================== */}
        {!isCreating && showHistory && (
          <section className="leave-records-panel">
            <div className="leave-panel-header">
              <div className="leave-panel-title-wrap">
                <div className="history-heading-row">
                  <h2>Previous Approvals &amp; Leave History</h2>
                  <button
                    type="button"
                    className="leave-close-history-btn"
                    onClick={() => setShowHistory(false)}
                    title="Hide History"
                  >
                    ✕ Close History
                  </button>
                </div>
                <p>Complete historical archive of your leaves with 4-stage tracking</p>
              </div>

              <div className="leave-filter-tabs">
                <button
                  type="button"
                  className={`leave-tab-btn ${requestView === 'all' ? 'active' : ''}`}
                  onClick={() => setRequestView('all')}
                >
                  <span>All Records</span>
                  <span className="tab-pill-count">{requests.length}</span>
                </button>

                <button
                  type="button"
                  className={`leave-tab-btn ${requestView === 'approved' ? 'active' : ''}`}
                  onClick={() => setRequestView('approved')}
                >
                  <span>Previous Approvals</span>
                  <span className="tab-pill-count count-emerald">{approvedLeavesCount}</span>
                </button>

                <button
                  type="button"
                  className={`leave-tab-btn ${requestView === 'pending' ? 'active' : ''}`}
                  onClick={() => setRequestView('pending')}
                >
                  <span>Pending</span>
                  <span className="tab-pill-count count-amber">{pendingLeavesCount}</span>
                </button>
              </div>
            </div>

            <div className="leave-cards-stack">
              {visibleRequests.length > 0 ? (
                visibleRequests.map((req, idx) => {
                  const isApproved = req.status === 'Approved'
                  const isRejected = req.status === 'Rejected'
                  const isPending = !isApproved && !isRejected
                  const isClosed = Boolean(req.returnReportedAt || req.closureClosedAt)
                  const duration = getLeaveDuration(req.fromDate, req.toDate)
                  const reviewer = req.reviewedBy || approverNames[req.reviewedRole] || 'CFI / DCFI'
                  const stages = getLeaveStages(req)

                  return (
                    <article
                      className={`leave-item-card ${isApproved ? (isClosed ? 'status-closed' : 'status-approved') : isRejected ? 'status-rejected' : 'status-pending'}`}
                      key={`${req.requestedAt}-${idx}`}
                    >
                      {/* Top Header of Card */}
                      <div className="leave-item-top">
                        <div className="leave-item-meta">
                          <span className="leave-item-tag">{req.trackingId || `AVV-${idx + 1}`}</span>
                          <span className="leave-item-applied-date">
                            Applied on {formatStudentDate(req.requestedAt ? req.requestedAt.split('T')[0] : '')}
                          </span>
                        </div>

                        <div className="leave-item-badge">
                          {isClosed && (
                            <span className="badge-chip chip-closed">
                              <span className="badge-dot dot-cyan" />
                              <span>Stage 4: Leave Closed</span>
                            </span>
                          )}
                          {!isClosed && isApproved && (
                            <span className="badge-chip chip-approved">
                              <span className="badge-dot dot-emerald" />
                              <span>Stage 3: Approved</span>
                            </span>
                          )}
                          {isPending && (
                            <span className="badge-chip chip-pending">
                              <span className="badge-dot dot-amber" />
                              <span>Stage 2: In Review</span>
                            </span>
                          )}
                          {isRejected && (
                            <span className="badge-chip chip-rejected">
                              <span className="badge-dot dot-red" />
                              <span>Stage 3: Rejected</span>
                            </span>
                          )}
                        </div>
                      </div>

                      {/* 4 Mini Stages Bar inside each card */}
                      <div className="card-mini-stages">
                        {stages.map((stg, sIdx) => {
                          const icon = stg.state === 'complete' ? '✓' : stg.state === 'rejected' ? '✕' : stg.step
                          return (
                            <div className={`mini-stage-item ${stg.state}`} key={`card-${idx}-stage-${sIdx}`}>
                              <span className="mini-stage-circle">{icon}</span>
                              <span className="mini-stage-title">Stage {stg.step}: {stg.name}</span>
                            </div>
                          )
                        })}
                      </div>

                      {/* Main Details Grid */}
                      <div className="leave-item-grid">
                        <div className="leave-detail-block">
                          <span className="detail-label">LEAVE TIMEFRAME</span>
                          <div className="detail-dates-row">
                            <span className="detail-calendar-icon">🗓</span>
                            <span className="detail-dates-text">
                              {formatStudentDate(req.fromDate)} &rarr; {formatStudentDate(req.toDate)}
                            </span>
                            <span className="detail-duration-pill">{duration}</span>
                          </div>
                        </div>

                        <div className="leave-detail-block">
                          <span className="detail-label">REASON STATED</span>
                          <div className="detail-reason-quote">
                            "{req.reason}"
                          </div>
                        </div>
                      </div>

                      {/* Footer Authorization / Note & Return Action */}
                      <div className="leave-item-footer">
                        <div className="leave-footer-info-row">
                          {isApproved && (
                            <div className="auth-stamp stamp-approved">
                              <span className="stamp-icon">🛡️</span>
                              <span>Authorized by <strong>{reviewer}</strong></span>
                            </div>
                          )}
                          {isApproved && (
                            <button
                              type="button"
                              className="btn-whatsapp-pass-inline"
                              onClick={() => openWhatsAppGatePass(req)}
                              title="Share Gate Pass on WhatsApp"
                            >
                              <span>📲 WhatsApp Gate Pass</span>
                            </button>
                          )}
                          {isPending && (
                            <div className="auth-stamp stamp-pending">
                              <span className="stamp-icon">⏳</span>
                              <span>Awaiting decision from <strong>Captain Shariq Ali (CFI)</strong> or <strong>Captain SM (DCFI)</strong></span>
                            </div>
                          )}
                          {isRejected && (
                            <div className="auth-stamp stamp-rejected">
                              <span className="stamp-icon">✕</span>
                              <span>Rejected by <strong>{reviewer}</strong> {req.rejectionReason ? `— "${req.rejectionReason}"` : ''}</span>
                            </div>
                          )}

                          {isApproved && !isClosed && (
                            <span className="card-pending-closure-pill">
                              ◷ Stage 4: Awaiting Admin Closure
                            </span>
                          )}

                          {isClosed && (
                            <span className="card-closed-pill">
                              ✓ Stage 4 Complete: Leave Closed &amp; Returned
                            </span>
                          )}
                        </div>
                      </div>
                    </article>
                  )
                })
              ) : (
                <div className="leave-empty-state">
                  <div className="empty-state-icon-circle">📝</div>
                  <h3>No leave records found</h3>
                  <p>You have no leave requests under this category filter.</p>
                  {requests.length === 0 && (
                    <button
                      type="button"
                      className="empty-cta-btn"
                      onClick={startNewRequest}
                    >
                      + Create First Leave Request
                    </button>
                  )}
                </div>
              )}
            </div>
          </section>
        )}

      </div>
    </main>
  )
}
