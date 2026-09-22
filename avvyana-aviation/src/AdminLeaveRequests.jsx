import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import './Dashboard.css'

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

function formatDate(dateValue) {
  if (!dateValue) return '-'

  const date = new Date(`${dateValue}T00:00:00`)
  return Number.isNaN(date.getTime()) ? '-' : date.toLocaleDateString()
}

function getTodayDate() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function getReturnStatus(request) {
  if (request.status !== 'Approved') return { label: '-', className: '' }
  if (request.closureClosedAt) return { label: 'Closed', className: 'available' }
  if (request.returnReportedAt) return { label: 'Returned', className: 'available' }

  const today = getTodayDate()
  if (today > request.toDate) return { label: 'Overdue', className: 'not-available' }
  if (today === request.toDate) return { label: 'Due today', className: 'pending' }
  return { label: `Due ${formatDate(request.toDate)}`, className: 'pending' }
}

function AdminLeaveRequests() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [accessGranted, setAccessGranted] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedRequestKeys, setSelectedRequestKeys] = useState([])
  const [successMessage, setSuccessMessage] = useState('')
  const [leaveRequests, setLeaveRequests] = useState(() => JSON.parse(
    localStorage.getItem('leaveRequests') || '[]'
  ))

  useEffect(() => {
    let isMounted = true

    const loadLeaveRequests = async () => {
      const { data, error } = await supabase
        .from('leave_requests')
        .select('*')
        .order('created_at', { ascending: false })

      if (!isMounted || error) return

      setLeaveRequests(data.map((item) => ({
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
        returnReportedAt: item.return_reported_at || item.returnReportedAt || null,
        actualReturnDate: item.actual_return_date || item.actualReturnDate || null,
        closureClosedAt: item.closure_closed_at || item.closureClosedAt || null,
      })))
    }

    loadLeaveRequests()
    return () => { isMounted = false }
  }, [])

  const storedAdminName = localStorage.getItem('adminName') || ''
  const storedAdminRole = localStorage.getItem('adminRole') || 'CFI'
  const adminRole = (/dcfi|captain sm/i.test(storedAdminName)
    ? 'DCFI'
    : storedAdminRole
  ).toUpperCase()

  const handleAccess = (event) => {
    event.preventDefault()
    if (password !== '1') {
      setAccessError('Enter the correct password.')
      return
    }

    setAccessError('')
    setAccessGranted(true)
  }

  const askApproverIdentity = () => {
    const selectedApprover = window.prompt(
      'Who is taking this action? Enter 1 for Captain Shariq Ali (CFI) or 2 for Captain SM (DCFI).'
    )

    if (selectedApprover === '1') {
      return { name: 'Captain Shariq Ali', role: 'CFI' }
    }

    if (selectedApprover === '2') {
      return { name: 'Captain SM', role: 'DCFI' }
    }

    window.alert('Please select 1 for Captain Shariq Ali (CFI) or 2 for Captain SM (DCFI).')
    return null
  }

  const handleDecision = async (requestIndex, status, decisionApprover) => {
    const request = leaveRequests[requestIndex]
    const studentName = request?.studentName || request?.studentId || 'this student'

    if (!window.confirm(`Are you sure you want to ${status.toLowerCase()} ${studentName}'s leave request?`)) {
      return
    }

    let rejectionReason = ''
    if (status === 'Rejected') {
      rejectionReason = window.prompt('Enter the rejection reason:')?.trim() || ''
      if (!rejectionReason) {
        window.alert('A rejection reason is required.')
        return
      }
    }

    const updatedRequests = leaveRequests.map((request, index) => index === requestIndex
      ? {
        ...request,
        status,
        rejectionReason,
        reviewedBy: decisionApprover.name,
        reviewedRole: decisionApprover.role,
        reviewedAt: new Date().toISOString(),
      }
      : request
    )

    if (request.id) {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          status,
          rejection_reason: rejectionReason,
          reviewed_by: decisionApprover.name,
          reviewed_role: decisionApprover.role,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', request.id)

      if (error) {
        setSuccessMessage(`Unable to update leave request: ${error.message}`)
        return
      }
    } else {
      localStorage.setItem('leaveRequests', JSON.stringify(updatedRequests))
    }

    setLeaveRequests(updatedRequests)
    setSuccessMessage(`Leave request ${status.toLowerCase()}.`)
    window.setTimeout(() => setSuccessMessage(''), 3000)
  }

  const getRequestKey = (request) => request.requestedAt || `${request.studentId}-${request.fromDate}-${request.toDate}`

  const filteredRequests = leaveRequests.filter((request) => {
    const matchesStatus = statusFilter === 'All' || request.status === statusFilter
    const matchesDate = !selectedDate || (
      request.fromDate <= selectedDate && request.toDate >= selectedDate
    )
    return matchesStatus && matchesDate
  })

  const pendingFilteredRequests = filteredRequests.filter(
    (request) => request.status === 'Pending approval'
  )
  const allPendingSelected = pendingFilteredRequests.length > 0 && pendingFilteredRequests.every(
    (request) => selectedRequestKeys.includes(getRequestKey(request))
  )

  const toggleRequestSelection = (request) => {
    const requestKey = getRequestKey(request)
    setSelectedRequestKeys((currentKeys) => currentKeys.includes(requestKey)
      ? currentKeys.filter((key) => key !== requestKey)
      : [...currentKeys, requestKey]
    )
  }

  const toggleSelectAllPending = () => {
    const pendingKeys = pendingFilteredRequests.map(getRequestKey)
    setSelectedRequestKeys((currentKeys) => allPendingSelected
      ? currentKeys.filter((key) => !pendingKeys.includes(key))
      : Array.from(new Set([...currentKeys, ...pendingKeys]))
    )
  }

  const handleBulkDecision = async (status) => {
    const selectedRequests = leaveRequests.filter((request) =>
      selectedRequestKeys.includes(getRequestKey(request)) && request.status === 'Pending approval'
    )
    if (selectedRequests.length === 0) return

    const decisionApprover = askApproverIdentity()
    if (!decisionApprover) return

    let rejectionReason = ''
    if (status === 'Rejected') {
      rejectionReason = window.prompt('Enter the rejection reason for the selected leave requests:')?.trim() || ''
      if (!rejectionReason) {
        window.alert('A rejection reason is required.')
        return
      }
    }

    if (!window.confirm(`Are you sure you want to ${status.toLowerCase()} ${selectedRequests.length} leave request${selectedRequests.length === 1 ? '' : 's'}?`)) {
      return
    }

    const selectedKeys = new Set(selectedRequests.map(getRequestKey))
    const updatedRequests = leaveRequests.map((request) => selectedKeys.has(getRequestKey(request))
      ? {
        ...request,
        status,
        rejectionReason,
        reviewedBy: decisionApprover.name,
        reviewedRole: decisionApprover.role,
        reviewedAt: new Date().toISOString(),
      }
      : request
    )

    const databaseRequests = selectedRequests.filter((request) => request.id)
    const databaseUpdates = await Promise.all(databaseRequests.map((request) => supabase
      .from('leave_requests')
      .update({
        status,
        rejection_reason: rejectionReason,
        reviewed_by: decisionApprover.name,
        reviewed_role: decisionApprover.role,
        reviewed_at: new Date().toISOString(),
      })
      .eq('id', request.id)
    ))

    const failedUpdate = databaseUpdates.find(({ error }) => error)
    if (failedUpdate) {
      setSuccessMessage(`Unable to update leave requests: ${failedUpdate.error.message}`)
      return
    }

    const localRequests = selectedRequests.filter((request) => !request.id)
    if (localRequests.length > 0) {
      localStorage.setItem('leaveRequests', JSON.stringify(updatedRequests))
    }

    setLeaveRequests(updatedRequests)
    setSelectedRequestKeys([])
    setSuccessMessage(`${selectedRequests.length} leave request${selectedRequests.length === 1 ? '' : 's'} ${status.toLowerCase()}.`)
    window.setTimeout(() => setSuccessMessage(''), 3000)
  }

  if (!accessGranted) {
    return (
      <main className="admin-page admin-hub-page">
        <div className="admin-hub-glow" />
        <div className="admin-card leave-auth-card">
          <div className="auth-confidential-tag">
            <span className="live-pulsing-dot" style={{ background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
            <span>CONFIDENTIAL CFI / DCFI AUTHORIZATION</span>
          </div>

          <h1>Leave Approvals Portal</h1>

          <form className="admin-form" onSubmit={handleAccess}>
            <div className="admin-form-group">
              <label htmlFor="leave-pass">CFI / DCFI ACCESS PASSWORD</label>
              <input
                id="leave-pass"
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="••••••••"
                autoFocus
                required
              />
              <div className="leave-restriction-highlight">
                <span className="restriction-shield-icon">🛡️</span>
                <span>Restricted to <strong>Captain Shariq Ali (CFI)</strong> &amp; <strong>Captain SM (DCFI)</strong>.</span>
              </div>
            </div>

            {accessError && <div className="login-error">{accessError}</div>}

            <button type="submit" className="btn-leave-unlock-submit">
              <span className="unlock-icon">🔓</span>
              <span>UNLOCK APPROVALS</span>
              <span className="unlock-arrow">→</span>
            </button>
          </form>
        </div>
      </main>
    )
  }

  return (
    <main className="admin-dashboard leave-requests-page">
      <header className="dashboard-header">
        <div>
          <button
            type="button"
            className="dashboard-brand-button"
            onClick={() => navigate('/')}
            aria-label="Go to home page"
          >
            <span className="dashboard-brand">Avyanna</span>
          </button>
          <div className="dashboard-subtitle">AVIATION ACADEMY</div>
        </div>
        <div className="dashboard-header-actions">
          <div className="admin-nav-links">
            <button
              type="button"
              className="btn-admin-nav-item"
              onClick={() => navigate('/admin/cadets-availability')}
            >
              ✈ Cadets Availability
            </button>
            <button
              type="button"
              className="btn-admin-nav-item active"
              onClick={() => navigate('/admin/leave-requests')}
            >
              📋 Leave Approvals
            </button>
            <button
              type="button"
              className="btn-admin-nav-item"
              onClick={() => navigate('/admin/queue-members')}
            >
              ⏱ Sortie Queue
            </button>
            <button
              type="button"
              className="btn-admin-nav-item"
              onClick={() => navigate('/admin')}
            >
              ▦ Hub
            </button>
          </div>
          <span className="admin-role-tag">{adminRole} PORTAL</span>
          <button type="button" className="btn-admin-logout" onClick={() => navigate('/admin')}>EXIT TO HUB</button>
        </div>
      </header>

      {successMessage && <div className="success-banner">{successMessage}</div>}

      <section className="dashboard-content">
        <div className="dashboard-heading">
          <div>
            <span className="dashboard-label">STUDENT SERVICES</span>
            <h1>Leave Approval</h1>
            <p>Review, filter, approve, and reject student leave requests.</p>
          </div>
          <strong>{filteredRequests.length} RECORDS</strong>
        </div>

        <div className="leave-request-filters">
          <label>
            SELECT DATE
            <input type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} />
          </label>
          <div className="leave-status-tabs" role="tablist" aria-label="Leave request status">
            {['All', 'Pending approval', 'Approved', 'Rejected'].map((status) => (
              <button
                type="button"
                className={statusFilter === status ? 'active' : ''}
                onClick={() => setStatusFilter(status)}
                key={status}
              >
                {status === 'Pending approval' ? 'Pending' : status}
              </button>
            ))}
          </div>
          <div className="leave-bulk-actions" aria-label="Bulk leave actions">
            <span className="leave-bulk-count">
              {pendingFilteredRequests.length} pending
              {selectedRequestKeys.length > 0 ? ` | ${selectedRequestKeys.length} selected` : ''}
            </span>
            <button type="button" className="btn-select-all" onClick={toggleSelectAllPending} disabled={pendingFilteredRequests.length === 0}>
              {allPendingSelected ? 'CLEAR SELECTION' : 'SELECT ALL PENDING'}
            </button>
            <button type="button" className="btn-approve" onClick={() => handleBulkDecision('Approved')} disabled={selectedRequestKeys.length === 0}>
              APPROVE SELECTED ({selectedRequestKeys.length})
            </button>
            <button type="button" className="btn-reject" onClick={() => handleBulkDecision('Rejected')} disabled={selectedRequestKeys.length === 0}>
              REJECT SELECTED ({selectedRequestKeys.length})
            </button>
          </div>
        </div>

        <div className="submission-table-wrapper">
          <table className="submission-table leave-request-table">
            <thead>
              <tr>
                <th className="leave-select-column">
                  <input
                    type="checkbox"
                    aria-label="Select all pending leave requests"
                    checked={allPendingSelected}
                    onChange={toggleSelectAllPending}
                    disabled={pendingFilteredRequests.length === 0}
                  />
                </th>
                <th>Student</th>
                <th>From</th>
                <th>To</th>
                <th>Total leave days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Rejection reason</th>
                <th>Return status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length > 0 ? filteredRequests.map((request) => {
                const originalIndex = leaveRequests.findIndex((item) => item.requestedAt === request.requestedAt)
                const requestKey = getRequestKey(request)
                const isSelected = selectedRequestKeys.includes(requestKey)
                const isPending = request.status === 'Pending approval'
                const returnStatus = getReturnStatus(request)

                return (
                  <tr key={requestKey}>
                    <td className="leave-select-column">
                      <input
                        type="checkbox"
                        aria-label={`Select leave request for ${request.studentName || request.studentId}`}
                        checked={isSelected}
                        onChange={() => toggleRequestSelection(request)}
                        disabled={!isPending}
                      />
                    </td>
                    <td><strong>{request.studentName || request.studentId}</strong><br />{request.studentId}</td>
                    <td>{formatDate(request.fromDate)}</td>
                    <td>{formatDate(request.toDate)}</td>
                    <td><strong>{getLeaveDuration(request.fromDate, request.toDate)}</strong></td>
                    <td>{request.reason}</td>
                    <td><span className={`availability-status ${request.status.toLowerCase().replace(' ', '-')}`}>{request.status === 'Pending approval' ? 'Pending' : request.status}</span></td>
                    <td>{request.rejectionReason || '-'}</td>
                    <td><span className={`availability-status ${returnStatus.className}`}>{returnStatus.label}</span></td>
                    <td>
                      {request.status === 'Pending approval' ? (
                        <div className="leave-decision-actions">
                          <button
                            type="button"
                            className="btn-approve"
                            onClick={() => {
                              const decisionApprover = askApproverIdentity()
                              if (decisionApprover) handleDecision(originalIndex, 'Approved', decisionApprover)
                            }}
                          >
                            APPROVE
                          </button>
                          <button
                            type="button"
                            className="btn-reject"
                            onClick={() => {
                              const decisionApprover = askApproverIdentity()
                              if (decisionApprover) handleDecision(originalIndex, 'Rejected', decisionApprover)
                            }}
                          >
                            REJECT
                          </button>
                        </div>
                      ) : <span className="reviewed-by">{request.status} by {request.reviewedBy || approverNames[request.reviewedRole] || '-'}</span>}
                    </td>
                  </tr>
                )
              }) : (
                <tr><td colSpan="10" className="empty-submissions">No leave requests match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default AdminLeaveRequests
