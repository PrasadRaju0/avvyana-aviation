import { useEffect, useRef, useState } from 'react'
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

function addMonths(dateString, months) {
  if (!dateString) return null
  const date = new Date(dateString)
  if (Number.isNaN(date.getTime())) return null
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
}

export function getNightCurrencyStatus(cplData) {
  const nightRecord = cplData?.['night-pic']
  const flightDate = nightRecord?.date
  const hours = nightRecord?.hours

  if (!flightDate && !hours) {
    return {
      status: 'not_logged',
      label: 'Not Logged',
      daysRemaining: null,
      expiryDate: null,
      flightDate: null,
      hours: 0,
      isExpiringSoon: false,
      isExpired: false,
    }
  }

  if (!flightDate) {
    return {
      status: 'no_date',
      label: 'Date Missing',
      daysRemaining: null,
      expiryDate: null,
      flightDate: null,
      hours: Number(hours) || 0,
      isExpiringSoon: false,
      isExpired: false,
    }
  }

  const expiryDate = addMonths(flightDate, 6)
  if (!expiryDate) {
    return {
      status: 'invalid',
      label: 'Invalid Date',
      daysRemaining: null,
      expiryDate: null,
      flightDate,
      hours: Number(hours) || 0,
      isExpiringSoon: false,
      isExpired: false,
    }
  }

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(`${expiryDate}T00:00:00`)
  const diffDays = Math.ceil((exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24))

  if (diffDays <= 0) {
    return {
      status: 'expired',
      label: `Expired (${Math.abs(diffDays)}d ago)`,
      shortLabel: 'Expired',
      daysRemaining: diffDays,
      expiryDate,
      flightDate,
      hours: Number(hours) || 0,
      isExpiringSoon: false,
      isExpired: true,
    }
  }

  if (diffDays <= 30) {
    return {
      status: 'expiring_soon',
      label: `Expires in ${diffDays}d (${expiryDate})`,
      shortLabel: `${diffDays}d left`,
      daysRemaining: diffDays,
      expiryDate,
      flightDate,
      hours: Number(hours) || 0,
      isExpiringSoon: true,
      isExpired: false,
    }
  }

  return {
    status: 'valid',
    label: `Valid (${diffDays}d left - ${expiryDate})`,
    shortLabel: 'Valid',
    daysRemaining: diffDays,
    expiryDate,
    flightDate,
    hours: Number(hours) || 0,
    isExpiringSoon: false,
    isExpired: false,
  }
}

function Dashboard() {
  const navigate = useNavigate()
  const [searchSplNumber, setSearchSplNumber] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [selectedExercise, setSelectedExercise] = useState('')
  const [nightExpiryFilter, setNightExpiryFilter] = useState(false)
  const [showNightExpiryModal, setShowNightExpiryModal] = useState(false)
  const [leaveTypeFilter, setLeaveTypeFilter] = useState('all')
  const [showLeaveTable, setShowLeaveTable] = useState(false)
  const [databaseSubmissions, setDatabaseSubmissions] = useState(null)
  const [databaseAccounts, setDatabaseAccounts] = useState(null)
  const [databaseError, setDatabaseError] = useState('')
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [successMessage, setSuccessMessage] = useState('')
  const [showLeaveRequests, setShowLeaveRequests] = useState(() => (
    sessionStorage.getItem('cfi_access_granted') === 'true' ||
    localStorage.getItem('cfi_access_granted') === 'true' ||
    localStorage.getItem('adminLoggedIn') === 'true'
  ))
  const [showLeaveAccessPrompt, setShowLeaveAccessPrompt] = useState(false)
  const [leavePassword, setLeavePassword] = useState('')
  const [leaveAccessError, setLeaveAccessError] = useState('')
  const [queueClock, setQueueClock] = useState(() => Date.now())
  const [queueActionId, setQueueActionId] = useState(null)
  const [showQueueMembers, setShowQueueMembers] = useState(false)
  const [showLeaveSummarySection, setShowLeaveSummarySection] = useState(false)
  const queueSectionRef = useRef(null)
  const leaveSummarySectionRef = useRef(null)
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
    const timer = window.setInterval(() => setQueueClock(Date.now()), 60000)
    return () => window.clearInterval(timer)
  }, [])

  useEffect(() => {
    let isMounted = true

    const loadSubmissions = async () => {
      const [submissionResult, accountResult, leaveResult] = await Promise.all([
        supabase
          .from('flight_submissions')
          .select('*')
          .order('submitted_at', { ascending: false }),
        supabase
          .from('student_accounts')
          .select('spl_number, full_name, email, batch_number'),
        supabase
          .from('leave_requests')
          .select('*')
          .order('created_at', { ascending: false }),
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
        queueStatus: item.queue_status || 'pending',
        queueStartedAt: item.queue_started_at,
        queueCompletedAt: item.queue_completed_at,
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

      if (leaveResult && !leaveResult.error && leaveResult.data) {
        const mappedLeaves = leaveResult.data.map((item) => ({
          id: item.id,
          studentId: item.student_id,
          studentName: item.student_name,
          batchNumber: item.batch_number,
          mobileNumber: item.mobile_number,
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
          actualReturnDate: item.actual_return_date,
          closureClosedAt: item.closure_closed_at,
          originalToDate: item.original_to_date || item.to_date,
        }))
        setLeaveRequests(mappedLeaves)
        localStorage.setItem('leaveRequests', JSON.stringify(mappedLeaves))
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

  const handleQueueSubmission = async (submission) => {
    if (!submission.id) {
      setDatabaseError('This submission is local only and cannot be placed in the queue.')
      return
    }

    if (queueActionId) return

    const queueStartedAt = new Date().toISOString()
    setQueueActionId(submission.id)
    setDatabaseError('')
    setDatabaseSubmissions((current) => current
      ? current.map((item) => item.id === submission.id
        ? { ...item, queueStatus: 'queued', queueStartedAt, queueCompletedAt: null }
        : item)
      : current)

    const { error } = await supabase
      .from('flight_submissions')
      .update({
        queue_status: 'queued',
        queue_started_at: queueStartedAt,
        queue_completed_at: null,
      })
      .eq('id', submission.id)

    if (error) {
      setDatabaseSubmissions((current) => current
        ? current.map((item) => item.id === submission.id
          ? { ...item, queueStatus: 'pending', queueStartedAt: null, queueCompletedAt: null }
          : item)
        : current)
      const missingQueueColumn = /queue_status|queue_started_at|queue_completed_at|schema cache/i.test(error.message)
      setDatabaseError(missingQueueColumn
        ? 'Queue is not enabled in Supabase. Run supabase-policies.sql, then refresh this page.'
        : `Unable to put ${submission.studentId} in the queue: ${error.message}`)
      setQueueActionId(null)
      return
    }

    setQueueActionId(null)
    setSuccessMessage(`${submission.studentId} added to the exercise queue.`)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  const handleCompleteQueueSubmission = async (submission) => {
    if (!submission.id) return

    const completedAt = new Date().toISOString()
    const { error } = await supabase
      .from('flight_submissions')
      .update({ queue_status: 'completed', queue_completed_at: completedAt })
      .eq('id', submission.id)

    if (error) {
      setDatabaseError(`Unable to complete ${submission.studentId}'s exercise: ${error.message}`)
      return
    }

    setDatabaseSubmissions((current) => current
      ? current.map((item) => item.id === submission.id
        ? { ...item, queueStatus: 'completed', queueCompletedAt: completedAt }
        : item)
      : current)
    setSuccessMessage(`${submission.studentId}'s exercise was completed. They can submit it again.`)
    setTimeout(() => setSuccessMessage(''), 3000)
  }

  // Delete all database data only
  const handleDeleteAllData = async () => {
    if (window.confirm('WARNING: This will delete all rows from the database tables for flight submissions, student accounts, and leave requests. This cannot be undone. Are you sure?')) {
      if (window.confirm('Are you absolutely certain? This will erase all database data only.')) {
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
    const cleanPass = (leavePassword || '').trim()
    const validPasswords = ['1', 'Admin@123', 'admin@123', 'admin', '123456', 'cfi', 'dcfi', 'password']
    try {
      const storedAdmins = JSON.parse(localStorage.getItem('adminAccounts') || '[]')
      storedAdmins.forEach((acc) => {
        if (acc.password) validPasswords.push(acc.password.trim())
      })
    } catch {
      // ignore
    }

    const isMatch = validPasswords.some(
      (p) => p.toLowerCase() === cleanPass.toLowerCase() || p === cleanPass
    )

    if (!isMatch) {
      setLeaveAccessError('Enter the correct password.')
      return
    }

    setLeaveAccessError('')
    setLeavePassword('')
    sessionStorage.setItem('cfi_access_granted', 'true')
    localStorage.setItem('cfi_access_granted', 'true')
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

  const getQueueWaitingDuration = (submission) => {
    if (submission.queueStatus === 'completed') return 'Completed'
    if (submission.queueStatus !== 'queued' || !submission.queueStartedAt) return '-'

    const startedAt = new Date(submission.queueStartedAt).getTime()
    if (Number.isNaN(startedAt)) return '-'

    const waitingDays = Math.max(
      1,
      Math.ceil(Math.max(0, queueClock - startedAt) / (1000 * 60 * 60 * 24))
    )
    return `${waitingDays} day${waitingDays === 1 ? '' : 's'}`
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
    .filter((request) => request.studentId === studentId && (request.status === 'Approved' || request.status === 'Closed'))
    .reduce((total, request) => {
      const effectiveToDate = request.actualReturnDate || request.toDate
      const duration = getLeaveDuration(request.fromDate, effectiveToDate)
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

  const sortQueueByExerciseAndAge = (first, second) => {
      const firstExercise = (first.exercise || '').split(',')[0].trim().toLowerCase()
      const secondExercise = (second.exercise || '').split(',')[0].trim().toLowerCase()
      const exerciseOrder = firstExercise.localeCompare(secondExercise)
      if (exerciseOrder !== 0) return exerciseOrder

      const firstSubmittedTime = new Date(first.submittedAt || first.flightDate || 0).getTime()
      const secondSubmittedTime = new Date(second.submittedAt || second.flightDate || 0).getTime()
      return firstSubmittedTime - secondSubmittedTime
  }

  // Night Flying Currency Calculation for All Cadets
  const allCplExperiences = JSON.parse(localStorage.getItem('all_cpl_experiences') || '{}')
  
  const getStudentNightCurrency = (studentId) => {
    const studentCpl = allCplExperiences[studentId] || 
      JSON.parse(localStorage.getItem(`cpl_experience_${studentId}`) || 'null')
    return getNightCurrencyStatus(studentCpl)
  }

  // Find all distinct cadets across submissions and accounts to evaluate night currency alerts
  const allDistinctStudentIds = Array.from(new Set([
    ...displayedSubmissions.map((s) => s.studentId),
    ...studentAccounts.map((a) => a.splNumber),
    ...Object.keys(allCplExperiences),
  ])).filter(Boolean)

  const cadetNightAlertList = allDistinctStudentIds.map((splId) => {
    const account = studentAccounts.find((a) => a.splNumber === splId)
    const name = account?.fullName || displayedSubmissions.find((s) => s.studentId === splId)?.studentName || splId
    const nightStatus = getStudentNightCurrency(splId)
    return {
      studentId: splId,
      studentName: name,
      ...nightStatus,
    }
  }).filter((cadet) => cadet.isExpiringSoon || cadet.isExpired)

  const nightExpiringSoonCount = cadetNightAlertList.filter((cadet) => cadet.isExpiringSoon).length
  const nightExpiredCount = cadetNightAlertList.filter((cadet) => cadet.isExpired).length

  const queuedSubmissions = filteredSubmissions
    .filter((submission) => submission.availability === 'available' && submission.queueStatus === 'queued')
    .sort(sortQueueByExerciseAndAge)

  const availableSubmissions = filteredSubmissions
    .filter((submission) => {
      const isBaseAvailable = submission.availability === 'available' && !['queued', 'completed'].includes(submission.queueStatus)
      if (!isBaseAvailable) return false
      if (nightExpiryFilter) {
        const nightStatus = getStudentNightCurrency(submission.studentId)
        return nightStatus.isExpiringSoon || nightStatus.isExpired
      }
      return true
    })
    .sort(sortQueueByExerciseAndAge)
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
              const cadetSubmissions = displayedSubmissions.filter(
                (submission) => submission.studentId === studentId
              )
              const notAvailableSubs = cadetSubmissions.filter(
                (submission) => submission.availability === 'not-available' || submission.availability === 'seventh-day'
              )
              const notAvailableCount = notAvailableSubs.length
              const latestNotAvailable = notAvailableSubs[0]
              const unavailabilityReason = latestNotAvailable?.unavailabilityReason ||
                (latestNotAvailable?.availability === 'seventh-day' ? '7th Day Rest' : null)

              const cadetLeaves = leaveRequests.filter(
                (request) => request.studentId === studentId && (request.status === 'Approved' || request.status === 'Closed')
              )
              const leaveTaken = cadetLeaves.reduce((total, request) => {
                const effectiveToDate = request.actualReturnDate || request.toDate
                const days = Number.parseInt(getLeaveDuration(request.fromDate, effectiveToDate), 10)
                return total + (Number.isNaN(days) ? 0 : days)
              }, 0)

              const todayStr = new Date().toISOString().slice(0, 10)
              const currentlyOnLeave = leaveRequests.some((req) => {
                if (req.studentId !== studentId || req.status !== 'Approved') return false
                if (req.closureClosedAt || req.returnReportedAt || req.status === 'Closed') return false
                const retDate = req.actualReturnDate || req.toDate
                return todayStr >= req.fromDate && todayStr <= retDate
              })

              uniqueRows.set(normalizedKey, {
                studentId,
                studentName,
                notAvailableCount,
                unavailabilityReason,
                leaveTaken,
                currentlyOnLeave,
                totalLeaves: leaveTaken + notAvailableCount,
                totalFlyingHours: cadetSubmissions
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
          <div className="admin-nav-links">
            <button
              type="button"
              className="btn-admin-nav-item active"
              onClick={() => navigate('/admin/cadets-availability')}
            >
              ✈ Cadets Availability
            </button>
            <button
              type="button"
              className="btn-admin-nav-item"
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
          <button
            type="button"
            className="btn-admin-logout"
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
        {/* Executive Stats Overview Ribbon */}
        <div className="admin-quick-stats-grid">
          <div className="admin-stat-card">
            <div className="stat-card-icon stat-icon-blue">✈</div>
            <div className="stat-card-content">
              <span className="stat-card-number">{availableSubmissions.length}</span>
              <span className="stat-card-label">Available for Flying</span>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-card-icon stat-icon-amber">⏱</div>
            <div className="stat-card-content">
              <span className="stat-card-number">{queuedSubmissions.length}</span>
              <span className="stat-card-label">Active in Queue</span>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className="stat-card-icon stat-icon-purple">📋</div>
            <div className="stat-card-content">
              <span className="stat-card-number">{leaveSummaryRows.length}</span>
              <span className="stat-card-label">Leaves &amp; 7th Days</span>
            </div>
          </div>
          <div className="admin-stat-card">
            <div className={`stat-card-icon ${nightExpiringSoonCount > 0 || nightExpiredCount > 0 ? 'stat-icon-red' : 'stat-icon-green'}`}>🌙</div>
            <div className="stat-card-content">
              <span className="stat-card-number">{cadetNightAlertList.length}</span>
              <span className="stat-card-label">Night Currency Alerts</span>
            </div>
          </div>
        </div>

        <div className="dashboard-heading">
          <div>
            <span className="dashboard-label">FLIGHT OPERATIONS MANAGEMENT</span>
            <h1>Cadets Flight Availability</h1>
            <p>Monitor daily pilot availability, live exercise queue slots, and DGCA currency compliance.</p>
          </div>
          <strong>{filteredSubmissions.length} TOTAL SUBMISSIONS</strong>
        </div>

        {/* Premium Action Control Toolbar with Right-Aligned Search */}
        <div className="dashboard-control-toolbar">
          <div className="toolbar-left-group">
            <button
              type="button"
              className="btn-toolbar-action btn-toolbar-queue"
              onClick={() => {
                const queueState = JSON.stringify(queuedSubmissions)
                sessionStorage.setItem('queueMembersData', queueState)
                const newWindow = window.open('/admin/queue-members', '_blank', 'noopener,noreferrer')
                if (newWindow) {
                  newWindow.sessionStorage.setItem('queueMembersData', queueState)
                }
              }}
              title="Open Sortie Queue Management"
            >
              <span className="toolbar-btn-icon">⏱</span>
              <span>Queue Members</span>
              {queuedSubmissions.length > 0 && (
                <span className="toolbar-badge-count">{queuedSubmissions.length}</span>
              )}
            </button>

            <button
              type="button"
              className={`btn-toolbar-action btn-toolbar-leave ${showLeaveSummarySection ? 'is-active' : ''}`}
              onClick={() => {
                setShowLeaveSummarySection((isVisible) => {
                  const nextVisibility = !isVisible
                  if (nextVisibility) {
                    window.setTimeout(() => leaveSummarySectionRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    }), 0)
                  }
                  return nextVisibility
                })
              }}
              title="Toggle leave and unavailable cadets section"
            >
              <span className="toolbar-btn-icon">📋</span>
              <span>{showLeaveSummarySection ? 'Hide Leave Summary' : 'Leave & Unavailable'}</span>
            </button>

            {cadetNightAlertList.length > 0 && (
              <button
                type="button"
                className={`btn-toolbar-action btn-toolbar-night blinking-night-btn ${showNightExpiryModal ? 'is-active' : ''}`}
                onClick={() => setShowNightExpiryModal(true)}
                title="Inspect Night Flying Currency Expiry Details"
              >
                <span className="blinking-dot"></span>
                <span className="toolbar-btn-icon">🌙</span>
                <span>Night Expiring</span>
                <span className="toolbar-badge-warning">{cadetNightAlertList.length}</span>
              </button>
            )}
          </div>

          <div className="toolbar-right-group">
            {/* Right-Aligned Integrated Search Field */}
            <div className="toolbar-search-box">
              <span className="toolbar-search-icon">🔍</span>
              <input
                id="admin-spl-search"
                type="search"
                className="toolbar-search-input"
                placeholder="Search SPL or Cadet Name..."
                value={searchSplNumber}
                onChange={(e) => setSearchSplNumber(e.target.value)}
              />
              {searchSplNumber && (
                <button
                  type="button"
                  className="toolbar-search-clear"
                  onClick={() => setSearchSplNumber('')}
                  title="Clear search"
                >
                  ✕
                </button>
              )}
            </div>

            <button 
              type="button"
              className="btn-toolbar-subtle btn-clear-sub"
              onClick={handleClearSubmissions}
              title="Clear today's flight submissions (student accounts remain safe)"
            >
              Clear Submissions
            </button>
            <button 
              type="button"
              className="btn-toolbar-danger btn-reset-db"
              onClick={handleDeleteAllData}
              title="Delete all records from the database"
            >
              Reset Database
            </button>
          </div>
        </div>

        {/* Night Currency Expiry Details Modal */}
        {showNightExpiryModal && (
          <div className="night-modal-overlay" onClick={() => setShowNightExpiryModal(false)}>
            <div className="night-modal-content" onClick={(e) => e.stopPropagation()}>
              <div className="night-modal-header">
                <div className="night-modal-title-wrap">
                  <span className="night-modal-icon">🌙</span>
                  <div>
                    <h3>DGCA Night Currency Expiry Alert</h3>
                    <p>Cadets whose 6-month night flying validity is expiring within 30 days or has expired</p>
                  </div>
                </div>
                <button 
                  type="button" 
                  className="night-modal-close"
                  onClick={() => setShowNightExpiryModal(false)}
                >
                  ✕
                </button>
              </div>

              <div className="night-modal-stats">
                <div className="night-modal-stat-pill stat-expiring">
                  <span className="stat-num">{nightExpiringSoonCount}</span>
                  <span className="stat-lbl">Expiring Soon (&le; 30 Days)</span>
                </div>
                <div className="night-modal-stat-pill stat-expired">
                  <span className="stat-num">{nightExpiredCount}</span>
                  <span className="stat-lbl">Expired Validity</span>
                </div>
                <div className="night-modal-stat-pill stat-total">
                  <span className="stat-num">{cadetNightAlertList.length}</span>
                  <span className="stat-lbl">Total Cadets Requiring Night Flight</span>
                </div>
              </div>

              <div className="night-modal-body">
                <table className="night-details-table">
                  <thead>
                    <tr>
                      <th>SPL NUMBER</th>
                      <th>CADET NAME</th>
                      <th>LAST NIGHT FLIGHT</th>
                      <th>EXPIRY DATE (6 MOS)</th>
                      <th>REMAINING TIME</th>
                      <th>CURRENCY STATUS</th>
                      <th>ACTION</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cadetNightAlertList.map((cadet) => (
                      <tr key={cadet.studentId} className={cadet.isExpired ? 'row-expired' : 'row-warning'}>
                        <td className="cadet-spl-col">
                          <strong>{cadet.studentId}</strong>
                        </td>
                        <td className="cadet-name-col">
                          {cadet.studentName}
                        </td>
                        <td>
                          {cadet.lastNightFlightDate ? (
                            <span className="night-date-badge">
                              {new Date(cadet.lastNightFlightDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </span>
                          ) : (
                            <span className="no-record-tag">No flight logged</span>
                          )}
                        </td>
                        <td>
                          {cadet.expiryDate ? (
                            <strong className={cadet.isExpired ? 'date-expired' : 'date-expiring'}>
                              {new Date(cadet.expiryDate).toLocaleDateString('en-GB', {
                                day: '2-digit',
                                month: 'short',
                                year: 'numeric'
                              })}
                            </strong>
                          ) : (
                            <span className="no-record-tag">Needs Night PIC</span>
                          )}
                        </td>
                        <td>
                          {cadet.isExpired ? (
                            <span className="days-expired-text">Expired ({Math.abs(cadet.daysRemaining)}d ago)</span>
                          ) : cadet.daysRemaining !== null ? (
                            <span className="days-remaining-text">
                              <strong>{cadet.daysRemaining}</strong> days left
                            </span>
                          ) : (
                            <span className="days-none-text">-</span>
                          )}
                        </td>
                        <td>
                          <span className={`badge-night-currency ${cadet.isExpired ? 'badge-night-expired' : 'badge-night-warning'}`}>
                            {cadet.isExpired ? '❌' : '⚠️'} {cadet.label}
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn-quick-filter-cadet"
                            onClick={() => {
                              setSearchSplNumber(cadet.studentId)
                              setShowNightExpiryModal(false)
                            }}
                            title="Filter dashboard for this student"
                          >
                            Inspect Cadet
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="night-modal-footer">
                <div className="night-dgca-rule-note">
                  ℹ️ <strong>DGCA Rule Requirement:</strong> Night currency requires at least 1 PIC night takeoff & landing within preceding 6 months.
                </div>
                <div className="night-modal-footer-actions">
                  <button
                    type="button"
                    className={`btn-toggle-filter-table ${nightExpiryFilter ? 'active' : ''}`}
                    onClick={() => {
                      setNightExpiryFilter((prev) => !prev)
                      setShowNightExpiryModal(false)
                    }}
                  >
                    {nightExpiryFilter ? 'Show All Available Cadets' : 'Filter Table for Expiring Cadets'}
                  </button>
                  <button
                    type="button"
                    className="btn-close-modal"
                    onClick={() => setShowNightExpiryModal(false)}
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

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

        {/* Search Results Table (Shown when searching) */}

        {searchSplNumber.trim() && searchResultRows.length > 0 && (
          <div className="search-result-table-wrapper">
            <div className="search-result-table-header">
              <h3>Direct Cadet Search Results ({searchResultRows.length})</h3>
            </div>
            <table className="search-result-table">
              <thead>
                <tr>
                  <th>SPL NUMBER</th>
                  <th>CADET NAME</th>
                  <th>NOT AVAILABLE</th>
                  <th>LEAVES TAKEN</th>
                  <th>TOTAL LEAVES</th>
                  <th>TOTAL FLYING</th>
                  <th>NIGHT CURRENCY</th>
                  <th>CADET ACTION</th>
                </tr>
              </thead>
              <tbody>
                {searchResultRows.map((row) => {
                  const nightStatus = getStudentNightCurrency(row.studentId)
                  return (
                  <tr key={row.studentId}>
                    <td className="search-spl-cell">
                      <strong>{row.studentId}</strong>
                      <div style={{ marginTop: '3px' }}>
                        <span style={{
                          fontSize: '10px',
                          fontWeight: 700,
                          padding: '2px 6px',
                          borderRadius: '12px',
                          background: row.currentlyOnLeave ? '#fef3c7' : '#dcfce7',
                          color: row.currentlyOnLeave ? '#b45309' : '#15803d',
                          border: `1px solid ${row.currentlyOnLeave ? '#fcd34d' : '#86efac'}`,
                          display: 'inline-block',
                          textTransform: 'uppercase'
                        }}>
                          {row.currentlyOnLeave ? '✈ On Leave' : '🏫 On Campus'}
                        </span>
                      </div>
                    </td>
                    <td className="search-name-cell">
                      <span>{row.studentName}</span>
                    </td>
                    <td>
                      <span className="count-pill pill-subtle">{row.notAvailableCount} days</span>
                      {row.unavailabilityReason && (
                        <div style={{ fontSize: '11px', color: '#b45309', marginTop: '4px', maxWidth: '160px', lineHeight: '1.3' }}>
                          "{row.unavailabilityReason}"
                        </div>
                      )}
                    </td>
                    <td>
                      <span className="count-pill pill-subtle">{row.leaveTaken}</span>
                    </td>
                    <td>
                      <span className="count-pill pill-leaves">{row.totalLeaves} days</span>
                    </td>
                    <td>
                      <span className="flying-hours-badge">
                        ✈ {row.totalFlyingHours} hrs
                      </span>
                    </td>
                    <td>
                      {nightStatus.status === 'expiring_soon' && (
                        <span className="badge-night-currency badge-night-warning">
                          ⚠️ {nightStatus.shortLabel}
                        </span>
                      )}
                      {nightStatus.status === 'expired' && (
                        <span className="badge-night-currency badge-night-expired">
                          ❌ Expired
                        </span>
                      )}
                      {nightStatus.status === 'valid' && (
                        <span className="badge-night-currency badge-night-valid">
                          ✓ Valid ({nightStatus.daysRemaining}d)
                        </span>
                      )}
                      {['not_logged', 'no_date', 'invalid'].includes(nightStatus.status) && (
                        <span className="badge-night-currency badge-night-na">
                          — No Night PIC
                        </span>
                      )}
                      {nightStatus.expiryDate && (
                        <div style={{ fontSize: '10.5px', color: '#64748b', marginTop: '3px' }}>
                          Exp: {new Date(nightStatus.expiryDate).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                        </div>
                      )}
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn-delete-cadet-modern"
                        onClick={() => handleDeleteStudentFromDatabase(row.studentId)}
                        title={`Delete ${row.studentName} from database`}
                      >
                        🗑 Delete Cadet
                      </button>
                    </td>
                  </tr>
                  )
                })}
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

                  {!searchSplNumber.trim() && queuedSubmissions.length > 0 && showQueueMembers && <section ref={queueSectionRef} className="leave-section queue-section">
          <div className="leave-section-heading">
            <div>
              <span className="dashboard-label">FIRST COME, FIRST SERVED</span>
              <h2>Active Queue</h2>
            </div>
            <strong>{queuedSubmissions.length} WAITING</strong>
                  <button
                    type="button"
                    className="queue-members-toggle"
                    onClick={() => setShowQueueMembers((isVisible) => !isVisible)}
                    aria-expanded={showQueueMembers}
                  >
                    {showQueueMembers ? 'Hide queue members' : 'View queue members'}
                  </button>
          </div>

          {showQueueMembers && <div className="queue-card-list">
            {queuedSubmissions.map((submission, index) => (
              <article className="queue-student-card" key={`${submission.studentId}-queue-${submission.submittedAt}-${index}`}>
                <div className="queue-student-identity">
                  <span className="queue-rank">#{index + 1}</span>
                  <div>
                    <strong>{getStudentDetails(submission)}</strong>
                    <small>{submission.studentId}</small>
                  </div>
                </div>
                <div className="queue-card-detail">
                  <span>WAITING FOR</span>
                  <strong>{submission.exercise}</strong>
                </div>
                <div className="queue-card-detail queue-card-waiting">
                  <span>WAITING DAYS</span>
                  <strong>{getQueueWaitingDuration(submission)}</strong>
                </div>
                <div className="queue-card-detail queue-card-hours">
                  <span>FLYING HOURS</span>
                  <strong>{submission.totalFlyingHours} hrs</strong>
                </div>
                <button
                  type="button"
                  className="btn-approve queue-complete-button"
                  onClick={() => handleCompleteQueueSubmission(submission)}
                >
                  Complete
                </button>
              </article>
            ))}
          </div>}
        </section>}

                  {!searchSplNumber.trim() && <section className="leave-section available-section">
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

          <div className={`submission-table-wrapper ${availableSubmissions.length === 0 ? 'is-empty' : ''}`}>
            <table className="submission-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Name</th>
                  <th>Waiting for</th>
                  <th>Waiting days</th>
                  <th>Total hours</th>
                  <th>Night Currency</th>
                  <th>Queue action</th>
                </tr>
              </thead>
              <tbody>
                {availableSubmissions.length > 0 ? (
                  availableSubmissions.map((submission, index) => {
                    const nightStatus = getStudentNightCurrency(submission.studentId)
                    return (
                    <tr
                      key={`${submission.studentId}-available-${submission.submittedAt}-${index}`}
                      className={`${submission.queueStatus === 'queued' ? 'queue-row-active' : ''} ${nightStatus.isExpiringSoon ? 'row-night-warning' : nightStatus.isExpired ? 'row-night-expired' : ''}`}
                    >
                      <td>{formatSubmissionDate(submission.flightDate || submission.submittedAt)}</td>
                      <td><strong>{getStudentDetails(submission)}</strong></td>
                      <td>{submission.exercise}</td>
                      <td>
                        <strong className={submission.queueStatus === 'queued' ? 'waiting-days-active' : ''}>
                          {getQueueWaitingDuration(submission)}
                        </strong>
                      </td>
                      <td>{submission.totalFlyingHours} hrs</td>
                      <td>
                        {nightStatus.status === 'expiring_soon' && (
                          <span className="badge-night-currency badge-night-warning" title={`Night Flying Date: ${nightStatus.flightDate} | Expires: ${nightStatus.expiryDate} (under 30 days left)`}>
                            ⚠️ {nightStatus.shortLabel}
                          </span>
                        )}
                        {nightStatus.status === 'expired' && (
                          <span className="badge-night-currency badge-night-expired" title={`Night Flying Date: ${nightStatus.flightDate} | Expired: ${nightStatus.expiryDate}`}>
                            ❌ Expired
                          </span>
                        )}
                        {nightStatus.status === 'valid' && (
                          <span className="badge-night-currency badge-night-valid" title={`Night Flying Date: ${nightStatus.flightDate} | Expires: ${nightStatus.expiryDate}`}>
                            ✓ Valid ({nightStatus.daysRemaining}d)
                          </span>
                        )}
                        {['not_logged', 'no_date', 'invalid'].includes(nightStatus.status) && (
                          <span className="badge-night-currency badge-night-na" title="No Night PIC flight date recorded in CPL Flight Experience">
                            —
                          </span>
                        )}
                      </td>
                      <td>
                        {submission.queueStatus === 'queued' ? (
                          <div className="queue-action-cell">
                            <span className="availability-status pending">Queued</span>
                            <button
                              type="button"
                              className="btn-approve"
                              onClick={() => handleCompleteQueueSubmission(submission)}
                            >
                              Complete
                            </button>
                          </div>
                        ) : submission.queueStatus === 'completed' ? (
                          <span className="availability-status available">Completed</span>
                        ) : (
                          <button
                            type="button"
                            className="btn-approve"
                            disabled={queueActionId === submission.id}
                            onClick={() => handleQueueSubmission(submission)}
                          >
                            {queueActionId === submission.id ? 'Adding...' : 'Put in queue'}
                          </button>
                        )}
                      </td>
                    </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan="7" className="empty-submissions">
                      {searchSplNumber.trim() || selectedDate || nightExpiryFilter
                        ? 'No available student found for these filters.'
                        : 'No available students yet.'}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>}

        {!searchSplNumber.trim() && showLeaveSummarySection && <section ref={leaveSummarySectionRef} className="leave-section">
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