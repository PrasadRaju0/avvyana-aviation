import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import './Dashboard.css'

const approverNames = {
  CFI: 'Captain Shariq',
  DCFI: 'Captain SM',
}

function Dashboard() {
  const navigate = useNavigate()
  const [searchSplNumber, setSearchSplNumber] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showLeaveRequests, setShowLeaveRequests] = useState(false)
  const [showLeaveAccessPrompt, setShowLeaveAccessPrompt] = useState(false)
  const [leavePassword, setLeavePassword] = useState('')
  const [leaveAccessError, setLeaveAccessError] = useState('')
  const [leaveRequests, setLeaveRequests] = useState(() => JSON.parse(
    localStorage.getItem('leaveRequests') || '[]'
  ))
  const storedAdminName = localStorage.getItem('adminName') || ''
  const storedAdminRole = localStorage.getItem('adminRole') || ''
  const adminRole = (/dcfi|captain sm/i.test(storedAdminName)
    ? 'DCFI'
    : storedAdminRole || 'CFI'
  ).toUpperCase()
  const approverName = approverNames[adminRole] || localStorage.getItem('adminName') || adminRole
  
  const savedSubmissions = JSON.parse(
    localStorage.getItem('flightSubmissions') || '[]'
  )
  const legacySubmission = JSON.parse(
    localStorage.getItem('flightSubmission') || 'null'
  )
  const studentAccounts = JSON.parse(
    localStorage.getItem('studentAccounts') || '[]'
  )
  const submissions = savedSubmissions.length > 0
    ? savedSubmissions
    : legacySubmission
      ? [legacySubmission]
      : []

  // Delete a single submission
  const handleDeleteSubmission = (indexToDelete) => {
    if (window.confirm('Are you sure you want to delete this submission? This action cannot be undone.')) {
      const updatedSubmissions = savedSubmissions.filter((_, index) => index !== indexToDelete)
      localStorage.setItem('flightSubmissions', JSON.stringify(updatedSubmissions))
      setSuccessMessage('✓ Submission deleted successfully')
      setTimeout(() => setSuccessMessage(''), 3000)
      window.location.reload()
    }
  }

  // Delete all data
  const handleDeleteAllData = () => {
    if (window.confirm('⚠️ WARNING: This will delete ALL student submissions and accounts. This cannot be undone. Are you sure?')) {
      if (window.confirm('Are you absolutely certain? This will erase all data.')) {
        localStorage.removeItem('flightSubmissions')
        localStorage.removeItem('flightSubmission')
        localStorage.removeItem('studentAccounts')
        localStorage.removeItem('leaveRequests')
        localStorage.removeItem('lastSubmissionDate')
        setShowDeleteConfirm(false)
        setSuccessMessage('✓ All data has been cleared successfully')
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    }
  }

  // Clear all submissions only (keep student accounts)
  const handleClearSubmissions = () => {
    if (window.confirm('Delete all flight submissions? Student accounts will remain. This cannot be undone.')) {
      localStorage.removeItem('flightSubmissions')
      localStorage.removeItem('flightSubmission')
      localStorage.removeItem('lastSubmissionDate')
      setSuccessMessage('✓ All submissions have been cleared successfully')
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    }
  }

  const askApproverIdentity = () => {
    const selectedApprover = window.prompt(
      'Who is taking this action? Enter 1 for Captain Shariq (CFI) or 2 for Captain SM (DCFI).'
    )

    if (selectedApprover === '1') {
      return { name: 'Captain Shariq', role: 'CFI' }
    }

    if (selectedApprover === '2') {
      return { name: 'Captain SM', role: 'DCFI' }
    }

    window.alert('Please select 1 for Captain Shariq (CFI) or 2 for Captain SM (DCFI).')
    return null
  }

  const handleLeaveDecision = (requestIndex, status, rejectionReason = '', decisionApprover = null) => {
    const approver = decisionApprover || { name: approverName, role: adminRole }
    const updatedRequests = leaveRequests.map((request, index) =>
      index === requestIndex
        ? {
          ...request,
          status,
          rejectionReason: status === 'Rejected' ? rejectionReason : '',
          reviewedBy: approver.name,
          reviewedRole: approver.role,
          reviewedAt: new Date().toISOString(),
        }
        : request
    )

    localStorage.setItem('leaveRequests', JSON.stringify(updatedRequests))
    setLeaveRequests(updatedRequests)
    setSuccessMessage(`Leave request ${status.toLowerCase()}.`)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleLeaveAccess = (event) => {
    event.preventDefault()
    if (leavePassword !== '1') {
      setLeaveAccessError('Enter the correct password.')
      return
    }

    setLeaveAccessError('')
    setLeavePassword('')
    setShowLeaveAccessPrompt(false)
    setShowLeaveRequests(true)
  }

  const getStudentDetails = (submission) => {
    const account = studentAccounts.find(
      (item) => item.splNumber === submission.studentId
    )

    const name = submission.studentName || account?.fullName || 'Unknown student'
    const batchNumber =
      submission.studentBatchNumber || account?.batchNumber || ''

    return batchNumber ? `${name} (${batchNumber})` : name
  }

  const getStudentName = (submission) => {
    const account = studentAccounts.find(
      (item) => item.splNumber === submission.studentId
    )

    return submission.studentName || account?.fullName || ''
  }

  const getSubmissionDateKey = (dateValue) => {
    if (!dateValue) return ''

    const date = new Date(
      dateValue.length === 10
        ? `${dateValue}T00:00:00`
        : dateValue
    )
    if (Number.isNaN(date.getTime())) return ''

    const year = date.getFullYear()
    const month = String(date.getMonth() + 1).padStart(2, '0')
    const day = String(date.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const filteredSubmissions = (searchSplNumber.trim()
    ? submissions.filter((submission) => {
      const searchValue = searchSplNumber.trim().toLowerCase()
      return submission.studentId.toLowerCase().includes(searchValue) ||
        getStudentName(submission).toLowerCase().includes(searchValue)
    })
    : submissions
  ).filter((submission) =>
    !selectedDate || getSubmissionDateKey(
      submission.flightDate || submission.submittedAt
    ) === selectedDate
  ).sort((first, second) =>
    new Date(second.flightDate || second.submittedAt || 0) -
    new Date(first.flightDate || first.submittedAt || 0)
  )

  const formatSubmissionDate = (dateValue) => {
    if (!dateValue) return '-'

    const date = new Date(
      dateValue.length === 10
        ? `${dateValue}T00:00:00`
        : dateValue
    )
    return Number.isNaN(date.getTime())
      ? '-'
      : date.toLocaleDateString()
  }

  const getLeaveDuration = (fromDate, toDate) => {
    if (!fromDate || !toDate) return '-'

    const start = new Date(`${fromDate}T00:00:00`)
    const end = new Date(`${toDate}T00:00:00`)
    const difference = end - start

    if (Number.isNaN(difference) || difference < 0) return '-'

    return `${Math.floor(difference / (1000 * 60 * 60 * 24)) + 1} days`
  }

  const getLeaveRequestDays = (studentId) => leaveRequests
    .filter((request) => request.studentId === studentId)
    .reduce((total, request) => {
      const duration = getLeaveDuration(request.fromDate, request.toDate)
      const days = Number.parseInt(duration, 10)
      return total + (Number.isNaN(days) ? 0 : days)
    }, 0)

  const getTotalLeaveDays = (studentId) => {
    const leaveRequestDays = getLeaveRequestDays(studentId)
    const notAvailableFlyingDays = submissions.filter(
      (submission) => submission.studentId === studentId && submission.availability === 'not-available'
    ).length

    return leaveRequestDays + notAvailableFlyingDays
  }

  const searchedStudentSubmissions = searchSplNumber.trim()
    ? submissions.filter((submission) => {
      const searchValue = searchSplNumber.trim().toLowerCase()
      return submission.studentId.toLowerCase().includes(searchValue) ||
        getStudentName(submission).toLowerCase().includes(searchValue)
    })
    : []

  const filteredLeaveRequests = searchSplNumber.trim()
    ? leaveRequests.filter((request) => {
      const searchValue = searchSplNumber.trim().toLowerCase()
      return request.studentId.toLowerCase().includes(searchValue) ||
        (request.studentName || '').toLowerCase().includes(searchValue)
    })
    : leaveRequests

  // Calculate days in program from first submission
  const getDaysInProgram = (studentSubmissions) => {
    if (studentSubmissions.length === 0) return 0
    
    // Find the earliest submission date
    const firstSubmission = studentSubmissions.reduce((earliest, current) => {
      const currentDate = new Date(current.flightDate || current.submittedAt)
      const earliestDate = new Date(earliest.flightDate || earliest.submittedAt)
      return currentDate < earliestDate ? current : earliest
    })
    
    const firstDate = new Date(firstSubmission.flightDate || firstSubmission.submittedAt)
    const today = new Date()
    
    // Calculate difference in days
    const diffTime = Math.abs(today - firstDate)
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    
    return diffDays
  }

  const searchedStudent = searchedStudentSubmissions[0] || filteredLeaveRequests[0]
  const searchedLeaveDays = searchedStudent
    ? getTotalLeaveDays(searchedStudent.studentId)
    : 0
  const searchedFlyingHours = searchedStudentSubmissions.reduce(
    (total, submission) => total + Number(submission.totalFlyingHours || 0),
    0
  )
  const searchedDaysInProgram = getDaysInProgram(searchedStudentSubmissions)

  const availableSubmissions = filteredSubmissions.filter(
    (submission) => submission.availability === 'available'
  )
  const leaveSubmissions = filteredSubmissions.filter(
    (submission) => ['seventh-day', 'not-available'].includes(submission.availability)
  )

  return (
    <main className="admin-dashboard">
      <header className="dashboard-header">
        <div>
          <div className="dashboard-brand">AVVYANA</div>
          <div className="dashboard-subtitle">AVIATION ACADEMY</div>
        </div>

        <div className="dashboard-header-actions">
          <span>{adminRole} PORTAL</span>
          <button
            type="button"
            onClick={() => {
              localStorage.removeItem('adminLoggedIn')
              localStorage.removeItem('adminRole')
              localStorage.removeItem('adminName')
              navigate('/')
            }}
          >
            LOG OUT
          </button>
        </div>
      </header>

      {successMessage && (
        <div className="success-banner">
          {successMessage}
        </div>
      )}

      <section className="dashboard-content">
        <div className="dashboard-heading">
          <div>
            <span className="dashboard-label">FLIGHT OPERATIONS</span>
            <h1>Student availability</h1>
            <p>Review submitted flying availability and training details.</p>
          </div>
          <strong>{filteredSubmissions.length} SUBMISSIONS</strong>
        </div>

        <div className="dashboard-actions-bar">
          <button 
            className="btn-clear-submissions"
            onClick={handleClearSubmissions}
            title="Delete all flight submissions (keeps student accounts)"
          >
            🗑️ Clear All Submissions
          </button>
          <button 
            className="btn-danger"
            onClick={handleDeleteAllData}
            title="Delete all data including student accounts"
          >
            ⚠️ Delete All Data
          </button>
        </div>

        {showLeaveAccessPrompt && (
          <div className="leave-access-panel">
            <div className="leave-access-heading">
              <div>
                <span className="dashboard-label">CONFIDENTIAL ACCESS</span>
                <h2>Verify Leave Requests</h2>
                <p>Enter the password to view leave requests.</p>
              </div>
              <button
                type="button"
                className="leave-access-close"
                onClick={() => {
                  setShowLeaveAccessPrompt(false)
                  setLeaveAccessError('')
                }}
                aria-label="Close confidential access form"
              >
                ×
              </button>
            </div>

            <form className="leave-access-form" onSubmit={handleLeaveAccess}>
              <label className="leave-password-field">
                PASSWORD
                <input
                  type="password"
                  value={leavePassword}
                  onChange={(event) => setLeavePassword(event.target.value)}
                  placeholder="Enter password"
                  required
                />
              </label>
              {leaveAccessError && <div className="login-error">{leaveAccessError}</div>}
              <button type="submit" className="btn-leave-access">VIEW LEAVE REQUESTS</button>
            </form>
          </div>
        )}

        <div className="dashboard-search">
          <label htmlFor="admin-spl-search">SEARCH BY SPL NUMBER OR NAME</label>
          <div className="dashboard-filter-row">
            <div className="dashboard-filter-field">
              <input
                id="admin-spl-search"
                type="search"
                placeholder="Enter SPL Number or student name"
                value={searchSplNumber}
                onChange={(e) => setSearchSplNumber(e.target.value)}
              />
            </div>
            {(searchSplNumber || selectedDate) && (
              <button
                type="button"
                className="dashboard-clear-button"
                onClick={() => {
                  setSearchSplNumber('')
                  setSelectedDate('')
                }}
              >
                CLEAR
              </button>
            )}
          </div>
        </div>

        {searchSplNumber.trim() && searchedStudent && (
          <div className="student-summary">
            <div>
              <span>STUDENT</span>
              <strong>{getStudentDetails(searchedStudent)}</strong>
            </div>
            <div>
              <span>DAYS IN PROGRAM</span>
              <strong>{searchedDaysInProgram} days</strong>
            </div>
            <div>
              <span>LEAVE DAYS</span>
              <strong>{searchedLeaveDays}</strong>
            </div>
            <div>
              <span>TOTAL FLYING HOURS</span>
              <strong>{searchedFlyingHours} hrs</strong>
            </div>
          </div>
        )}

        {showLeaveRequests && <section className="leave-section leave-requests-panel">
                    <div className="leave-section-heading">
                      <div>
                        <h2>Leave Requests</h2>
                      </div>
                      <strong>{filteredLeaveRequests.filter((request) => request.status === 'Pending approval').length} PENDING</strong>
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
                            <th>Rejection reason</th>
                            <th>Action</th>
                          </tr>
                        </thead>
                        <tbody>
                          {filteredLeaveRequests.length > 0 ? (
                            filteredLeaveRequests.map((request, index) => (
                              <tr key={`${request.studentId}-${request.requestedAt}-${index}`}>
                                <td><strong>{request.studentName || request.studentId}</strong><br />{request.studentId}</td>
                                <td>{formatSubmissionDate(request.fromDate)}</td>
                                <td>{formatSubmissionDate(request.toDate)}</td>
                                <td><strong>{getLeaveDuration(request.fromDate, request.toDate)}</strong></td>
                                <td>{request.reason}</td>
                                <td>
                                  <span className={`availability-status ${request.status === 'Approved' ? 'available' : request.status === 'Rejected' ? 'not-available' : 'pending'}`}>{request.status}</span>
                                </td>
                                <td>{request.rejectionReason || '-'}</td>
                                <td>
                                  {request.status === 'Pending approval' ? (
                                    <div className="leave-decision-actions">
                                      <button
                                        type="button"
                                        className="btn-approve"
                                        onClick={() => {
                                          const selectedApprover = askApproverIdentity()
                                          if (!selectedApprover) return

                                          const confirmed = window.confirm(
                                            `Are you approving this leave request as ${selectedApprover.name} (${selectedApprover.role})?`
                                          )
                                          if (confirmed) {
                                            handleLeaveDecision(index, 'Approved', '', selectedApprover)
                                          }
                                        }}
                                      >
                                        Approve
                                      </button>
                                      <button
                                        type="button"
                                        className="btn-reject"
                                        onClick={() => {
                                          const selectedApprover = askApproverIdentity()
                                          if (!selectedApprover) return

                                          const confirmed = window.confirm(
                                            `Are you rejecting this leave request as ${selectedApprover.name} (${selectedApprover.role})?`
                                          )
                                          if (!confirmed) return

                                          const rejectionReason = window.prompt('Enter the reason for rejecting this leave request:')
                                          if (rejectionReason?.trim()) {
                                            handleLeaveDecision(index, 'Rejected', rejectionReason.trim(), selectedApprover)
                                          }
                                        }}
                                      >
                                        Reject
                                      </button>
                                    </div>
                                  ) : (
                                    <span className="reviewed-by">{request.status} by {request.reviewedBy || approverNames[request.reviewedRole] || request.reviewedRole || adminRole}</span>
                                  )}
                                </td>
                              </tr>
                            ))
                          ) : (
                            <tr><td colSpan="8" className="empty-submissions">No leave requests yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>}

                  <section className="leave-section">
          <div className="leave-section-heading">
                      <div className="available-heading-content">
                        <h2>Available for Flying Students</h2>
                        <label className="available-date-filter" htmlFor="admin-date-search">
                          DATE
                          <input
                            id="admin-date-search"
                            type="date"
                            aria-label="Filter by submission date"
                            value={selectedDate}
                            onChange={(e) => setSelectedDate(e.target.value)}
                          />
                        </label>
                      </div>
                      <strong>{availableSubmissions.length} STUDENTS</strong>
          </div>

          <div className="submission-table-wrapper">
            <table className="submission-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Type of exercise</th>
                  <th>Total hours</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {availableSubmissions.length > 0 ? (
                  availableSubmissions.map((submission, index) => (
                    <tr key={`${submission.studentId}-available-${submission.submittedAt}-${index}`}>
                      <td>{formatSubmissionDate(submission.flightDate || submission.submittedAt)}</td>
                      <td><strong>{getStudentDetails(submission)}</strong></td>
                      <td>{submission.exercise}</td>
                      <td>{submission.totalFlyingHours} hrs</td>
                      <td><span className="availability-status available">Available</span></td>
                      <td>
                        <button 
                          className="btn-delete-row"
                          onClick={() => handleDeleteSubmission(savedSubmissions.findIndex(s => s === submission))}
                          title="Delete this submission"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="empty-submissions">
                      {searchSplNumber.trim() || selectedDate
                        ? 'No available student found for these filters.'
                        : 'No available students yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="leave-section">
          <div className="leave-section-heading">
            <h2>7th Day and Not Available Students</h2>
            <strong>{leaveSubmissions.length} RECORDS</strong>
          </div>

        <div className="submission-table-wrapper">
          <table className="submission-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Type of exercise</th>
                <th>Total hours</th>
                <th>7th Day</th>
                <th>Not Available</th>
                <th>Reason</th>
                <th>Action</th>
                        <th>Total leaves</th>
              </tr>
            </thead>
            <tbody>
              {leaveSubmissions.length > 0 ? (
                leaveSubmissions.map((submission, index) => (
                  <tr key={`${submission.studentId}-${submission.submittedAt}-${index}`}>
                    <td>{formatSubmissionDate(submission.flightDate || submission.submittedAt)}</td>
                    <td><strong>{getStudentDetails(submission)}</strong></td>
                    <td>{submission.exercise}</td>
                    <td>{submission.totalFlyingHours} hrs</td>
                    <td>
                      {submission.availability === 'seventh-day' ? (
                        <span className="availability-status seventh-day">Yes</span>
                      ) : '-'}
                    </td>
                    <td>
                      {submission.availability === 'not-available' ? (
                        <span className="availability-status not-available">Yes</span>
                      ) : '-'}
                    </td>
                    <td>{submission.unavailabilityReason || (submission.availability === 'seventh-day' ? '7th day' : '-')}</td>
                    <td>
                      <button 
                        className="btn-delete-row"
                        onClick={() => handleDeleteSubmission(savedSubmissions.findIndex(s => s === submission))}
                        title="Delete this submission"
                      >
                        Delete
                      </button>
                    </td>
                    <td><strong>{getTotalLeaveDays(submission.studentId)}</strong></td>
                  </tr>
                ))
              ) : (
                <tr>
                    <td colSpan="9" className="empty-submissions">
                    {searchSplNumber.trim() || selectedDate
                      ? 'No leave record found for these filters.'
                      : 'No leave records yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        </section>
      </section>
    </main>
  )
}

export default Dashboard