import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
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

function AdminLeaveRequests() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [accessGranted, setAccessGranted] = useState(false)
  const [accessError, setAccessError] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [successMessage, setSuccessMessage] = useState('')
  const [leaveRequests, setLeaveRequests] = useState(() => JSON.parse(
    localStorage.getItem('leaveRequests') || '[]'
  ))

  const storedAdminName = localStorage.getItem('adminName') || ''
  const storedAdminRole = localStorage.getItem('adminRole') || 'CFI'
  const adminRole = (/dcfi|captain sm/i.test(storedAdminName)
    ? 'DCFI'
    : storedAdminRole
  ).toUpperCase()
  const approverName = approverNames[adminRole] || localStorage.getItem('adminName') || adminRole

  const handleAccess = (event) => {
    event.preventDefault()
    if (password !== '1') {
      setAccessError('Enter the correct password.')
      return
    }

    setAccessError('')
    setAccessGranted(true)
  }

  const handleDecision = (requestIndex, status) => {
    let rejectionReason = ''
    if (status === 'Rejected') {
      rejectionReason = window.prompt('Enter the rejection reason:')?.trim() || ''
      if (!rejectionReason) return
    }

    const updatedRequests = leaveRequests.map((request, index) => index === requestIndex
      ? {
        ...request,
        status,
        rejectionReason,
        reviewedBy: approverName,
        reviewedRole: adminRole,
        reviewedAt: new Date().toISOString(),
      }
      : request
    )

    localStorage.setItem('leaveRequests', JSON.stringify(updatedRequests))
    setLeaveRequests(updatedRequests)
    setSuccessMessage(`Leave request ${status.toLowerCase()}.`)
    window.setTimeout(() => setSuccessMessage(''), 3000)
  }

  const filteredRequests = leaveRequests.filter((request) => {
    const matchesStatus = statusFilter === 'All' || request.status === statusFilter
    const matchesDate = !selectedDate || (
      request.fromDate <= selectedDate && request.toDate >= selectedDate
    )
    return matchesStatus && matchesDate
  })

  if (!accessGranted) {
    return (
      <main className="admin-dashboard leave-requests-page leave-access-screen">
        <section className="leave-access-panel leave-access-page-card">
          <div className="leave-access-heading">
            <div>
              <span className="dashboard-label">CONFIDENTIAL ACCESS</span>
              <h1>Leave Requests</h1>
              <p>Enter the password to manage student leave requests.</p>
              <p className="leave-approval-note">Note: Leaves can be approved by CFI/DCFI.</p>
            </div>
          </div>
          <form className="leave-access-form" onSubmit={handleAccess}>
            <label className="leave-password-field">
              PASSWORD
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Enter password"
                autoFocus
                required
              />
            </label>
            {accessError && <div className="login-error">{accessError}</div>}
            <button type="submit" className="btn-leave-access">VIEW LEAVE REQUESTS</button>
            <button type="button" className="leave-page-back" onClick={() => navigate('/admin')}>
              BACK TO ADMIN PORTAL
            </button>
          </form>
        </section>
      </main>
    )
  }

  return (
    <main className="admin-dashboard leave-requests-page">
      <header className="dashboard-header">
        <div>
          <div className="dashboard-brand">AVVYANA</div>
          <div className="dashboard-subtitle">AVIATION ACADEMY</div>
        </div>
        <div className="dashboard-header-actions">
          <span>{adminRole} PORTAL</span>
          <button type="button" onClick={() => navigate('/admin')}>BACK TO DASHBOARD</button>
        </div>
      </header>

      {successMessage && <div className="success-banner">{successMessage}</div>}

      <section className="dashboard-content">
        <div className="dashboard-heading">
          <div>
            <span className="dashboard-label">STUDENT SERVICES</span>
            <h1>Leave Requests</h1>
            <p>Review, filter, approve, and reject student leave requests.</p>
          </div>
          <strong>{filteredRequests.length} REQUESTS</strong>
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
        </div>

        <div className="submission-table-wrapper">
          <table className="submission-table leave-request-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>From</th>
                <th>To</th>
                <th>Total leave days</th>
                <th>Reason</th>
                <th>Status</th>
                <th>Admin response</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredRequests.length > 0 ? filteredRequests.map((request, index) => {
                const originalIndex = leaveRequests.indexOf(request)
                return (
                  <tr key={`${request.studentId}-${request.requestedAt}-${index}`}>
                    <td><strong>{request.studentName || request.studentId}</strong><br />{request.studentId}</td>
                    <td>{formatDate(request.fromDate)}</td>
                    <td>{formatDate(request.toDate)}</td>
                    <td><strong>{getLeaveDuration(request.fromDate, request.toDate)}</strong></td>
                    <td>{request.reason}</td>
                    <td>
                      <span className={`availability-status ${request.status === 'Approved' ? 'available' : request.status === 'Rejected' ? 'not-available' : 'pending'}`}>
                        {request.status}
                      </span>
                    </td>
                    <td>{request.rejectionReason || (request.reviewedBy ? `${request.status} by ${request.reviewedBy}` : '-')}</td>
                    <td>
                      {request.status === 'Pending approval' ? (
                        <div className="leave-decision-actions">
                          <button type="button" className="btn-approve" onClick={() => handleDecision(originalIndex, 'Approved')}>APPROVE</button>
                          <button type="button" className="btn-reject" onClick={() => handleDecision(originalIndex, 'Rejected')}>REJECT</button>
                        </div>
                      ) : <span className="reviewed-by">{request.status} by {request.reviewedBy || approverNames[request.reviewedRole] || '-'}</span>}
                    </td>
                  </tr>
                )
              }) : (
                <tr><td colSpan="8" className="empty-submissions">No leave requests match these filters.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}

export default AdminLeaveRequests
