import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import './Dashboard.css'

const approverNames = {
  CFI: 'Captain Shariq',
  DCFI: 'Captain SM',
}

const allExercises = [
  'CCTS (Dual)',
  'CCTS (Solo)',
  'CCTS (PC)',
  'CCTS (FI Check)',
  'CCTS (AFI Check)',
  'Instrument Flying',
  'CCTS (Corrective)',
  'GF (Dual)',
  'GF (Solo)',
  'X-Country (Dual)',
  'X-Country (Solo)',
  'Night (Dual)',
  'Night (Solo)',
  'X-Country Check',
  'GF Check',
  '10Hrs Progress Check',
  'CPL Checks',
  'Multi Fam',
  'Multi GF',
  'Multi CCTS',
  'Multi IF',
  'Multi Night',
  'Multi Checks',
]

function Dashboard() {
  const navigate = useNavigate()
  const [searchSplNumber, setSearchSplNumber] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedExercise, setSelectedExercise] = useState('')
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all')
  const [showLeaveTable, setShowLeaveTable] = useState(false)
  const [databaseSubmissions, setDatabaseSubmissions] = useState(null)
  const [databaseAccounts, setDatabaseAccounts] = useState(null)
  const [databaseError, setDatabaseError] = useState('')
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
  const localStudentAccounts = JSON.parse(
    localStorage.getItem('studentAccounts') || '[]'
  )
  const submissions = savedSubmissions.length > 0
    ? savedSubmissions
    : legacySubmission
      ? [legacySubmission]
      : []

  useEffect(() => {
    let isMounted = true

    const loadSubmissions = async () => {
      const [submissionResult, accountResult] = await Promise.all([
        supabase
          .from('flight_submissions')
          .select('*')
          .order('submitted_at', { ascending: false }),
        supabase
          .from('student_accounts')
          .select('spl_number, full_name, email, batch_number'),
      ])
      const { data, error } = submissionResult

      if (!isMounted) return

      if (error) {
        setDatabaseError(`Unable to load flight submissions: ${error.message}`)
        return
      }

      setDatabaseError('')

      setDatabaseSubmissions(data.map((item) => ({
        id: item.id,
        studentId: item.student_id,
        studentName: item.student_name,
        flightDate: item.flight_date,
        availability: item.availability,
        aircraftType: item.aircraft_type,
        exercise: item.exercise,
        unavailabilityReason: item.unavailability_reason,
        totalFlyingHours: item.total_flying_hours,
        submittedAt: item.submitted_at,
      })))

      if (!accountResult.error) {
        setDatabaseAccounts(accountResult.data.map((item) => ({
          splNumber: item.spl_number,
          fullName: item.full_name,
          email: item.email,
          batchNumber: item.batch_number,
        })))
      }
    }

    loadSubmissions()
    return () => { isMounted = false }
  }, [])

  const displayedSubmissions = databaseSubmissions ?? submissions
  const studentAccounts = databaseAccounts ?? localStudentAccounts

  const exerciseOptions = Array.from(new Set([
    ...allExercises,
    ...displayedSubmissions.flatMap((submission) =>
      (submission.exercise || '')
        .split(',')
        .map((item) => item.trim())
        .filter((item) => item && !/not applicable/i.test(item))
    ),
  ])).sort((first, second) => first.localeCompare(second))

  // Delete a single submission
  const handleDeleteSubmission = async (submission) => {
    if (!window.confirm('Are you sure you want to delete this submission? This action cannot be undone.')) return

    if (submission.id) {
      const { error } = await supabase
        .from('flight_submissions')
        .delete()
        .eq('id', submission.id)

      if (error) {
        setDatabaseError(`Unable to delete submission: ${error.message}`)
        return
      }
    }

    const updatedSubmissions = savedSubmissions.filter((item) => item !== submission)
    localStorage.setItem('flightSubmissions', JSON.stringify(updatedSubmissions))
    setDatabaseSubmissions((current) => current
      ? current.filter((item) => item.id !== submission.id)
      : current)
    setSuccessMessage('Submission deleted successfully')
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  // Delete all data
  const handleDeleteAllData = async () => {
    if (window.confirm('WARNING: This will delete all student submissions, accounts, and leave requests. This cannot be undone. Are you sure?')) {
      if (window.confirm('Are you absolutely certain? This will erase all database data?')) {
        const results = await Promise.all([
          supabase.from('flight_submissions').delete().not('id', 'is', null),
          supabase.from('student_accounts').delete().not('id', 'is', null),
          supabase.from('leave_requests').delete().not('id', 'is', null),
        ])
        const databaseDeleteError = results.find((result) => result.error)?.error
        if (databaseDeleteError) {
          setDatabaseError(`Unable to delete all database data: ${databaseDeleteError.message}`)
          return
        }

        localStorage.removeItem('flightSubmissions')
        localStorage.removeItem('flightSubmission')
        localStorage.removeItem('studentAccounts')
        localStorage.removeItem('leaveRequests')
        localStorage.removeItem('lastSubmissionDate')
        setShowDeleteConfirm(false)
        setSuccessMessage('All database data has been cleared successfully')
        setTimeout(() => {
          window.location.reload()
        }, 2000)
      }
    }
  }

  // Clear all submissions only (keep student accounts)
  const handleClearSubmissions = async () => {
    if (window.confirm('Delete all flight submissions from the database? Student accounts will remain. This cannot be undone.')) {
      const { error } = await supabase
        .from('flight_submissions')
        .delete()
        .not('id', 'is', null)

      if (error) {
        setDatabaseError(`Unable to clear submissions: ${error.message}`)
        return
      }

      localStorage.removeItem('flightSubmissions')
      localStorage.removeItem('flightSubmission')
      localStorage.removeItem('lastSubmissionDate')
      setDatabaseSubmissions([])
      setSuccessMessage('All submissions have been cleared successfully')
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
    ? displayedSubmissions.filter((submission) => {
      const searchValue = searchSplNumber.trim().toLowerCase()
      return submission.studentId.toLowerCase().includes(searchValue) ||
        getStudentName(submission).toLowerCase().includes(searchValue)
    })
    : displayedSubmissions
  ).filter((submission) => {
    const matchesDate = !selectedDate || getSubmissionDateKey(
      submission.flightDate || submission.submittedAt
    ) === selectedDate

    const matchesExercise = !selectedExercise || (submission.exercise || '')
      .split(',')
      .map((item) => item.trim().toLowerCase())
      .includes(selectedExercise.toLowerCase())

    return matchesDate && matchesExercise
  }).sort((first, second) =>
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

  const getWaitingDuration = (dateValue) => {
    if (!dateValue) return '-'

    const date = new Date(
      dateValue.length === 10
        ? `${dateValue}T00:00:00`
        : dateValue
    )

    if (Number.isNaN(date.getTime())) return '-'

    const diffTime = Math.max(0, Date.now() - date.getTime())
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

    return diffDays === 0 ? 'Today' : `${diffDays} day${diffDays === 1 ? '' : 's'}`
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
    const notAvailableFlyingDays = displayedSubmissions.filter(
      (submission) => submission.studentId === studentId && submission.availability === 'not-available'
    ).length

    return leaveRequestDays + notAvailableFlyingDays
  }

  const searchedStudentSubmissions = searchSplNumber.trim()
    ? displayedSubmissions.filter((submission) => {
      const searchValue = searchSplNumber.trim().toLowerCase()
      return submission.studentId.toLowerCase().includes(searchValue) ||
        getStudentName(submission).toLowerCase().includes(searchValue)
    })
    : []

  const searchedStudentAccounts = searchSplNumber.trim()
    ? studentAccounts.filter((account) => {
      const searchValue = searchSplNumber.trim().toLowerCase()
      return account.splNumber.toLowerCase().includes(searchValue) ||
        (account.fullName || '').toLowerCase().includes(searchValue)
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

  const searchedStudent = searchedStudentSubmissions[0] ||
    filteredLeaveRequests[0] ||
    searchedStudentAccounts[0]
  const searchedLeaveDays = searchedStudent
    ? getTotalLeaveDays(searchedStudent.studentId)
    : 0
  const searchedFlyingHours = searchedStudentSubmissions.reduce(
    (total, submission) => total + Number(submission.totalFlyingHours || 0),
    0
  )
  const searchedDaysInProgram = getDaysInProgram(searchedStudentSubmissions)

  const availableSubmissions = filteredSubmissions
    .filter((submission) => submission.availability === 'available')
    .sort((first, second) => {
      const firstTime = new Date(first.flightDate || first.submittedAt || 0).getTime()
      const secondTime = new Date(second.flightDate || second.submittedAt || 0).getTime()
      return firstTime - secondTime
    })
  const leaveSubmissions = filteredSubmissions.filter(
    (submission) => ['seventh-day', 'not-available'].includes(submission.availability)
  )

  const leaveSummaryRows = [
    ...leaveSubmissions.map((submission) => ({
      id: `submission-${submission.studentId}-${submission.submittedAt}`,
      category: submission.availability === 'seventh-day' ? '7th day' : 'Not available',
      studentId: submission.studentId,
      studentName: getStudentName(submission) || submission.studentId,
      date: submission.flightDate || submission.submittedAt,
      reason: submission.unavailabilityReason || (submission.availability === 'seventh-day' ? '7th day' : '-'),
      status: submission.availability === 'seventh-day' ? '7th day' : 'Not available',
    })),
    ...filteredLeaveRequests.map((request, index) => ({
      id: `request-${request.studentId}-${request.requestedAt}-${index}`,
      category: 'Leave student',
      studentId: request.studentId,
      studentName: request.studentName || request.studentId,
      date: request.fromDate,
      reason: request.reason || '-',
      status: request.status,
      request,
    })),
  ]
    .filter((row) => leaveTypeFilter === 'all' || row.category === leaveTypeFilter)
    .map((row) => ({
      ...row,
      totalLeaveDays: getTotalLeaveDays(row.studentId),
      totalFlyingHours: displayedSubmissions
        .filter((submission) => submission.studentId === row.studentId)
        .reduce((total, submission) => total + Number(submission.totalFlyingHours || 0), 0),
    }))

  const handleDeleteStudentFromDatabase = async (studentIdToDelete) => {
    const normalizedId = (studentIdToDelete || '').trim()
    if (!normalizedId) return

    const confirmed = window.confirm(
      `Delete ${normalizedId} from the main database? This will remove the student account, flight records, and leave records.`
    )
    if (!confirmed) return

    const results = await Promise.all([
      supabase.from('leave_requests').delete().eq('student_id', normalizedId).select('id'),
      supabase.from('flight_submissions').delete().eq('student_id', normalizedId).select('id'),
      supabase.from('student_accounts').delete().eq('spl_number', normalizedId).select('id'),
    ])

    const databaseDeleteError = results.find((result) => result.error)?.error
    if (databaseDeleteError) {
      setDatabaseError(`Unable to delete student ${normalizedId}: ${databaseDeleteError.message}`)
      return
    }

    if (results[2].data?.length === 0) {
      setDatabaseError(
        `No account was deleted for ${normalizedId}. Check that the admin is connected to the correct Supabase project and that the student_accounts DELETE policy is enabled.`
      )
      return
    }

    const localSubmissions = JSON.parse(localStorage.getItem('flightSubmissions') || '[]')
    localStorage.setItem('flightSubmissions', JSON.stringify(
      localSubmissions.filter((item) => item.studentId?.trim() !== normalizedId)
    ))

    const localAccounts = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
    localStorage.setItem('studentAccounts', JSON.stringify(
      localAccounts.filter((item) => item.splNumber?.trim() !== normalizedId)
    ))

    const localLeaves = JSON.parse(localStorage.getItem('leaveRequests') || '[]')
    localStorage.setItem('leaveRequests', JSON.stringify(
      localLeaves.filter((item) => item.studentId?.trim() !== normalizedId)
    ))

    const legacySubmission = JSON.parse(localStorage.getItem('flightSubmission') || 'null')
    if (legacySubmission?.studentId?.trim() === normalizedId) {
      localStorage.removeItem('flightSubmission')
    }

    if (localStorage.getItem('studentId')?.trim() === normalizedId) {
      localStorage.removeItem('studentLoggedIn')
      localStorage.removeItem('studentId')
      localStorage.removeItem('studentName')
      localStorage.removeItem('studentBatchNumber')
      localStorage.removeItem('selectedFlightDate')
    }

    setDatabaseSubmissions((current) => current
      ? current.filter((item) => item.studentId !== normalizedId)
      : current)
    setDatabaseAccounts((current) => current
      ? current.filter((item) => item.splNumber !== normalizedId)
      : current)
    setLeaveRequests(localLeaves.filter((item) => item.studentId !== normalizedId))
    setSuccessMessage(`${normalizedId} deleted from the main database.`)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const searchResultRows = searchSplNumber.trim()
    ? (() => {
        const uniqueRows = new Map()
        const searchValue = searchSplNumber.trim().toLowerCase()

        Array.from(new Set([
          ...displayedSubmissions.map((submission) => submission.studentId),
          ...studentAccounts.map((account) => account.splNumber),
        ]))
          .filter((studentId) => studentId && studentId.toString().trim())
          .forEach((studentId) => {
            const studentAccount = studentAccounts.find((item) => item.splNumber === studentId)
            const studentName = studentAccount?.fullName || 'Unknown student'
            const normalizedKey = (studentId || '').trim().toLowerCase()

            if (!uniqueRows.has(normalizedKey)) {
              const notAvailableCount = displayedSubmissions.filter(
                (submission) => submission.studentId === studentId && submission.availability === 'not-available'
              ).length

              const leaveTaken = leaveRequests
                .filter((request) => request.studentId === studentId)
                .reduce((total, request) => {
                  const days = Number.parseInt(getLeaveDuration(request.fromDate, request.toDate), 10)
                  return total + (Number.isNaN(days) ? 0 : days)
                }, 0)

              uniqueRows.set(normalizedKey, {
                studentId,
                studentName,
                notAvailableCount,
                leaveTaken,
                totalLeaves: leaveTaken + notAvailableCount,
                totalFlyingHours: displayedSubmissions
                  .filter((submission) => submission.studentId === studentId)
                  .reduce((total, submission) => total + Number(submission.totalFlyingHours || 0), 0),
              })
            }
          })

        return Array.from(uniqueRows.values()).filter((row) => {
          const studentIdText = (row.studentId || '').toLowerCase()
          const studentNameText = (row.studentName || '').toLowerCase()
          return studentIdText.includes(searchValue) || studentNameText.includes(searchValue)
        })
      })()
    : []

  return (
    <main className="admin-dashboard">
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

      {databaseError && (
        <div className="error-banner">
          {databaseError}
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
            {(searchSplNumber || selectedDate || selectedExercise) && (
              <button
                type="button"
                className="dashboard-clear-button"
                onClick={() => {
                  setSearchSplNumber('')
                  setSelectedDate('')
                  setSelectedExercise('')
                }}
              >
                CLEAR
              </button>
            )}
          </div>
        </div>

        {searchSplNumber.trim() && searchResultRows.length > 0 && (
          <div className="search-result-table-wrapper">
            <table className="search-result-table">
              <thead>
                <tr>
                  <th>SPL Number</th>
                  <th>Name</th>
                  <th>Not available</th>
                  <th>Leave taken</th>
                  <th>Total leaves</th>
                  <th>Total hours</th>
                  <th>Delete</th>
                </tr>
              </thead>
              <tbody>
                {searchResultRows.map((row) => (
                  <tr key={row.studentId}>
                    <td><strong>{row.studentId}</strong></td>
                    <td>{row.studentName}</td>
                    <td>{row.notAvailableCount}</td>
                    <td>{row.leaveTaken}</td>
                    <td><strong>{row.totalLeaves}</strong></td>
                    <td>{row.totalFlyingHours} hrs</td>
                    <td>
                      <button
                        type="button"
                        className="btn-danger btn-delete-row"
                        onClick={() => handleDeleteStudentFromDatabase(row.studentId)}
                      >
                        Delete
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!searchSplNumber.trim() && showLeaveRequests && <section className="leave-section leave-requests-panel">
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
                            <th>Return status</th>
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
                                <td>{request.returnReportedAt ? 'Returned' : request.status === 'Approved' ? 'Awaiting return' : '-'}</td>
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
                            <tr><td colSpan="9" className="empty-submissions">No leave requests yet.</td></tr>
                          )}
                        </tbody>
                      </table>
                    </div>
                  </section>}

                  {!searchSplNumber.trim() && <section className="leave-section">
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
                        <label className="available-date-filter" htmlFor="admin-exercise-filter">
                          EXERCISE
                          <select
                            id="admin-exercise-filter"
                            className="dashboard-exercise-select"
                            value={selectedExercise}
                            onChange={(event) => setSelectedExercise(event.target.value)}
                          >
                            <option value="">ALL EXERCISES</option>
                            {exerciseOptions.map((exercise) => (
                              <option key={exercise} value={exercise}>
                                {exercise}
                              </option>
                            ))}
                          </select>
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
                  <th>Waiting for</th>
                  <th>Waiting days</th>
                  <th>Total hours</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {availableSubmissions.length > 0 ? (
                  availableSubmissions.map((submission, index) => (
                    <tr key={`${submission.studentId}-available-${submission.submittedAt}-${index}`}>
                      <td>{formatSubmissionDate(submission.flightDate || submission.submittedAt)}</td>
                      <td><strong>{getStudentDetails(submission)}</strong></td>
                      <td>{submission.exercise}</td>
                      <td>{getWaitingDuration(submission.flightDate || submission.submittedAt)}</td>
                      <td>{submission.totalFlyingHours} hrs</td>
                      <td><span className="availability-status available">Available</span></td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="empty-submissions">
                      {searchSplNumber.trim() || selectedDate
                        ? 'No available student found for these filters.'
                        : 'No available students yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>}

        {!searchSplNumber.trim() && <section className="leave-section">
          <div className="leave-section-heading">
            <div className="available-heading-content">
              <h2>Leave and Unavailable Students</h2>
              <div className="leave-table-controls">
                <label className="leave-type-filter" htmlFor="leave-type-table-filter">
                  FILTER
                  <select
                    id="leave-type-table-filter"
                    value={leaveTypeFilter}
                    onChange={(event) => setLeaveTypeFilter(event.target.value)}
                  >
                    <option value="all">ALL STUDENTS</option>
                    <option value="7th day">7TH DAY</option>
                    <option value="Not available">NOT AVAILABLE</option>
                    <option value="Leave student">LEAVE STUDENTS</option>
                  </select>
                </label>
                <button
                  type="button"
                  className="leave-table-toggle"
                  onClick={() => setShowLeaveTable((isVisible) => !isVisible)}
                >
                  {showLeaveTable ? 'HIDE TABLE' : 'SHOW TABLE'}
                </button>
              </div>
            </div>
            <strong>{leaveSummaryRows.length} RECORDS</strong>
          </div>

        {showLeaveTable && <div className="submission-table-wrapper">
          <table className="submission-table">
            <thead>
              <tr>
                <th>Date</th>
                <th>Name</th>
                <th>Waiting for</th>
                <th>Total hours</th>
                <th>7th Day</th>
                <th>Not Available</th>
                <th>Reason</th>
                <th>Total leaves</th>
              </tr>
            </thead>
            <tbody>
              {leaveSummaryRows.length > 0 ? (
                leaveSummaryRows.map((submission) => (
                  <tr key={submission.id}>
                    <td>{formatSubmissionDate(submission.date)}</td>
                    <td><strong>{submission.studentName}</strong></td>
                    <td>{submission.category}</td>
                    <td>{submission.totalFlyingHours} hrs</td>
                    <td>
                      {submission.category === '7th day' ? (
                        <span className="availability-status seventh-day">Yes</span>
                      ) : '-'}
                    </td>
                    <td>
                      {submission.category === 'Not available' ? (
                        <span className="availability-status not-available">Yes</span>
                      ) : '-'}
                    </td>
                    <td>{submission.reason}</td>
                    <td><strong>{submission.totalLeaveDays}</strong></td>
                  </tr>
                ))
              ) : (
                <tr>
                    <td colSpan="8" className="empty-submissions">
                    {searchSplNumber.trim() || selectedDate
                      ? 'No leave record found for these filters.'
                      : 'No leave records yet.'}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>}
        </section>}
      </section>
    </main>
  )
}

export default Dashboard