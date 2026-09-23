import { useEffect, useMemo, useState } from 'react'
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

function getLeaveDaysCount(fromDate, toDate) {
  if (!fromDate || !toDate) return 0
  const start = new Date(`${fromDate}T00:00:00`)
  const end = new Date(`${toDate}T00:00:00`)
  const difference = end - start
  if (Number.isNaN(difference) || difference < 0) return 0
  return Math.floor(difference / (1000 * 60 * 60 * 24)) + 1
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

function formatGatePassMessage({
  studentName,
  batchNumber,
  leaveDates,
  mobileNumber,
  splNumber,
  duration,
  authorizedBy,
  status = 'APPROVED',
  passId,
}) {
  return [
    '✈️ *AVYANNA AVIATION ACADEMY*',
    '📋 *GATE PASS AUTHORIZATION*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    `👤 *Student Name*  : ${studentName || 'Cadet Pilot'}`,
    splNumber ? `🎫 *SPL Number*    : ${splNumber}` : '',
    `🎖️ *Batch*         : ${batchNumber || 'N/A'}`,
    `📅 *Leave Dates*   : ${leaveDates}${duration && duration !== '-' ? ` (${duration})` : ''}`,
    `📱 *Mobile Number* : ${mobileNumber || 'N/A'}`,
    `🛡️ *Authorized By* : ${authorizedBy}`,
    `✅ *Status*        : ${status}`,
    '',
    '👉 *Please issue the gate pass*',
    '━━━━━━━━━━━━━━━━━━━━━━━━━━━━',
    passId ? `🔖 *Pass Ref*      : AVV-GP-${passId}` : '',
  ].filter(Boolean).join('\n')
}

function AdminLeaveRequests() {
  const navigate = useNavigate()
  const [password, setPassword] = useState('')
  const [accessGranted, setAccessGranted] = useState(() => {
    const adminLoggedIn = localStorage.getItem('adminLoggedIn') === 'true'
    const cfiGrantedSession = sessionStorage.getItem('cfi_access_granted') === 'true'
    const cfiGrantedLocal = localStorage.getItem('cfi_access_granted') === 'true'
    return adminLoggedIn || cfiGrantedSession || cfiGrantedLocal
  })
  const [accessError, setAccessError] = useState('')
  const [selectedDate, setSelectedDate] = useState('')
  const [statusFilter, setStatusFilter] = useState('All')
  const [selectedRequestKeys, setSelectedRequestKeys] = useState([])
  const [successMessage, setSuccessMessage] = useState('')
  const [studentAccountsMap, setStudentAccountsMap] = useState({})
  const [leaveRequests, setLeaveRequests] = useState(() => JSON.parse(
    localStorage.getItem('leaveRequests') || '[]'
  ))
  const [activeTab, setActiveTab] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const section = params.get('section')
    if (section === 'gatepass') return 'gatepass-closure'
    if (section === 'student-details') return 'student-details'
    return 'approvals'
  })
  const [gatePassFilter, setGatePassFilter] = useState('active')
  const [gatePassSearch, setGatePassSearch] = useState('')
  const [studentDetailsSearch, setStudentDetailsSearch] = useState('')
  const [selectedStudentForDossier, setSelectedStudentForDossier] = useState(null)

  // Leave Closure Modal State
  const [closingRequest, setClosingRequest] = useState(null)
  const [closureReturnDate, setClosureReturnDate] = useState('')
  const [closureError, setClosureError] = useState('')
  const [isSubmittingClosure, setIsSubmittingClosure] = useState(false)

  const handleTabChange = (newTab) => {
    setActiveTab(newTab)
    const url = new URL(window.location.href)
    if (newTab === 'gatepass-closure') {
      url.searchParams.set('section', 'gatepass')
    } else if (newTab === 'student-details') {
      url.searchParams.set('section', 'student-details')
    } else {
      url.searchParams.delete('section')
    }
    window.history.replaceState({}, '', url.toString())
  }

  useEffect(() => {
    let isMounted = true

    const loadStudentData = async () => {
      try {
        const { data: accounts } = await supabase
          .from('student_accounts')
          .select('spl_number, full_name, batch_number')

        const map = {}
        if (accounts) {
          accounts.forEach((acc) => {
            if (acc.spl_number) {
              map[acc.spl_number] = {
                name: acc.full_name,
                batchNumber: acc.batch_number,
                mobileNumber: acc.mobile_number || '',
              }
            }
          })
        }

        try {
          const localAccs = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
          localAccs.forEach((acc) => {
            if (acc.splNumber && !map[acc.splNumber]) {
              map[acc.splNumber] = {
                name: acc.name,
                batchNumber: acc.batchNumber,
                mobileNumber: acc.mobileNumber,
              }
            }
          })
        } catch {
          // ignore localstorage json error
        }

        if (isMounted) {
          setStudentAccountsMap(map)
        }
      } catch (err) {
        console.warn('Could not load student accounts map:', err)
      }
    }

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
        returnReportedAt: item.return_reported_at || item.returnReportedAt || null,
        actualReturnDate: item.actual_return_date || item.actualReturnDate || null,
        closureClosedAt: item.closure_closed_at || item.closureClosedAt || null,
        originalToDate: item.original_to_date || item.originalToDate || item.to_date,
        gatePassIssuedAt: item.gate_pass_issued_at || (item.rejection_reason && item.rejection_reason.startsWith('GATE_PASS_ISSUED:')
          ? item.rejection_reason.replace('GATE_PASS_ISSUED:', '')
          : null),
      })))
    }

    loadStudentData()
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
    const cleanPass = (password || '').trim()
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
      setAccessError('Enter the correct password.')
      return
    }

    setAccessError('')
    setAccessGranted(true)
    sessionStorage.setItem('cfi_access_granted', 'true')
    localStorage.setItem('cfi_access_granted', 'true')
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

  const isRequestGatePassIssued = (request) => {
    if (!request) return false
    if (request.gatePassIssuedAt) return true
    if (request.status === 'Gate pass issued') return true
    if (request.rejectionReason && request.rejectionReason.startsWith('GATE_PASS_ISSUED:')) return true
    try {
      const issuedMap = JSON.parse(localStorage.getItem('issuedGatePasses') || '{}')
      if (request.id && issuedMap[request.id]) return true
      if (request.requestedAt && issuedMap[request.requestedAt]) return true
    } catch {}
    return false
  }

  const handleIssueGatePass = async (request, shouldOpenWhatsApp = false) => {
    const studentName = request.studentName || request.studentId || 'this cadet'
    const nowIso = new Date().toISOString()

    if (request.id) {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          rejection_reason: `GATE_PASS_ISSUED:${nowIso}`,
        })
        .eq('id', request.id)

      if (error) {
        setSuccessMessage(`Unable to issue gate pass: ${error.message}`)
        return
      }
    }

    try {
      const currentMap = JSON.parse(localStorage.getItem('issuedGatePasses') || '{}')
      if (request.id) currentMap[request.id] = nowIso
      if (request.requestedAt) currentMap[request.requestedAt] = nowIso
      localStorage.setItem('issuedGatePasses', JSON.stringify(currentMap))
    } catch {}

    const updatedRequests = leaveRequests.map((item) => (
      (item.id && item.id === request.id) || item.requestedAt === request.requestedAt
        ? {
            ...item,
            gatePassIssuedAt: nowIso,
            rejectionReason: `GATE_PASS_ISSUED:${nowIso}`,
          }
        : item
    ))
    localStorage.setItem('leaveRequests', JSON.stringify(updatedRequests))
    setLeaveRequests(updatedRequests)

    if (shouldOpenWhatsApp) {
      sendWhatsAppGatePass(request)
    }

    setSuccessMessage(`✓ Official Gate Pass issued for ${studentName}! Stage 3 is now verified.`)
    window.setTimeout(() => setSuccessMessage(''), 4000)
  }

  const sendWhatsAppGatePass = (request, approverInfo) => {
    if (!isRequestGatePassIssued(request)) {
      handleIssueGatePass(request, false)
    }

    const studentInfo = studentAccountsMap[request.studentId] || {}
    const studentName = request.studentName || studentInfo.name || request.studentId || 'Cadet Pilot'
    const batchNumber = request.batchNumber || studentInfo.batchNumber || 'Batch 1'
    const mobileNumber = request.mobileNumber || studentInfo.mobileNumber || 'N/A'
    const fromFormatted = formatDate(request.fromDate)
    const toFormatted = formatDate(request.toDate)
    const leaveDates = `${fromFormatted} to ${toFormatted}`
    const duration = getLeaveDuration(request.fromDate, request.toDate)

    const authorizedBy = approverInfo?.name
      ? `${approverInfo.name} (${approverInfo.role})`
      : request.reviewedBy
        ? `${request.reviewedBy}${request.reviewedRole ? ` (${request.reviewedRole})` : ''}`
        : approverNames[request.reviewedRole] || 'CFI / DCFI Flight Command'

    const message = formatGatePassMessage({
      studentName,
      batchNumber,
      leaveDates,
      mobileNumber,
      splNumber: request.studentId,
      duration,
      authorizedBy,
      status: 'APPROVED',
      passId: request.id,
    })

    const whatsappUrl = `https://api.whatsapp.com/send?text=${encodeURIComponent(message)}`
    window.open(whatsappUrl, '_blank', 'noopener,noreferrer')
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
    if (status === 'Approved') {
      setSuccessMessage(`✓ Leave approved by ${decisionApprover.name} (${decisionApprover.role}). You can now issue the Gate Pass.`)
    } else {
      setSuccessMessage(`Leave request ${status.toLowerCase()}.`)
    }
    window.setTimeout(() => setSuccessMessage(''), 4000)
  }

  const handleOpenCloseModal = (request) => {
    setClosingRequest(request)
    setClosureReturnDate(getTodayDate())
    setClosureError('')
  }

  const handleConfirmCloseLeave = async (e) => {
    if (e) e.preventDefault()
    if (!closingRequest || !closureReturnDate) return

    if (closureReturnDate < closingRequest.fromDate) {
      setClosureError(`Return date cannot be earlier than departure date (${formatDate(closingRequest.fromDate)}).`)
      return
    }

    setIsSubmittingClosure(true)
    setClosureError('')

    const studentInfo = studentAccountsMap[closingRequest.studentId] || {}
    const studentName = closingRequest.studentName || studentInfo.name || closingRequest.studentId || 'Cadet Pilot'
    const nowIso = new Date().toISOString()
    const originalToDate = closingRequest.originalToDate || closingRequest.toDate
    const adjustedDays = getLeaveDaysCount(closingRequest.fromDate, closureReturnDate)

    if (closingRequest.id) {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          to_date: closureReturnDate,
          actual_return_date: closureReturnDate,
          return_reported_at: nowIso,
          closure_closed_at: nowIso,
          status: 'Closed',
        })
        .eq('id', closingRequest.id)

      if (error) {
        setIsSubmittingClosure(false)
        setClosureError(`Unable to close leave: ${error.message}`)
        return
      }
    }

    const updatedRequests = leaveRequests.map((item) => (
      (item.id && item.id === closingRequest.id) || item.requestedAt === closingRequest.requestedAt
        ? {
            ...item,
            toDate: closureReturnDate,
            actualReturnDate: closureReturnDate,
            returnReportedAt: nowIso,
            closureClosedAt: nowIso,
            status: 'Closed',
            originalToDate: originalToDate,
          }
        : item
    ))

    localStorage.setItem('leaveRequests', JSON.stringify(updatedRequests))
    setLeaveRequests(updatedRequests)
    setIsSubmittingClosure(false)
    setClosingRequest(null)

    setSuccessMessage(`✓ Leave closed for ${studentName} (${closingRequest.studentId}). Return date recorded as ${formatDate(closureReturnDate)} (${adjustedDays} days adjusted). Record saved to Student Details.`)
    window.setTimeout(() => setSuccessMessage(''), 5000)
  }

  const getRequestKey = (request) => request.requestedAt || `${request.studentId}-${request.fromDate}-${request.toDate}`

  const filteredRequests = leaveRequests.filter((request) => {
    const matchesStatus = statusFilter === 'All' || request.status === statusFilter
    const matchesDate = !selectedDate || (
      request.fromDate <= selectedDate && request.toDate >= selectedDate
    )
    return matchesStatus && matchesDate
  })

  const approvedLeaves = useMemo(() => {
    return leaveRequests.filter((r) => r.status === 'Approved' || r.status === 'Closed')
  }, [leaveRequests])

  const gatePassPendingCount = useMemo(() => {
    return approvedLeaves.filter((r) => !isRequestGatePassIssued(r) && !r.closureClosedAt && !r.returnReportedAt && r.status !== 'Closed').length
  }, [approvedLeaves])

  const onLeaveActiveCount = useMemo(() => {
    return approvedLeaves.filter((r) => isRequestGatePassIssued(r) && !r.closureClosedAt && !r.returnReportedAt && r.status !== 'Closed').length
  }, [approvedLeaves])

  const closedLeavesCount = useMemo(() => {
    return approvedLeaves.filter((r) => Boolean(r.closureClosedAt || r.returnReportedAt || r.status === 'Closed')).length
  }, [approvedLeaves])

  const activeQueueCount = gatePassPendingCount + onLeaveActiveCount

  const filteredGatePassRequests = useMemo(() => {
    return approvedLeaves.filter((req) => {
      const studentInfo = studentAccountsMap[req.studentId] || {}
      const studentName = req.studentName || studentInfo.name || req.studentId || ''
      const splNumber = req.studentId || ''
      const reason = req.reason || ''
      const mobile = req.mobileNumber || studentInfo.mobileNumber || ''
      const searchTarget = `${studentName} ${splNumber} ${reason} ${mobile}`.toLowerCase()
      const matchesSearch = !gatePassSearch.trim() || searchTarget.includes(gatePassSearch.toLowerCase().trim())

      const isIssued = isRequestGatePassIssued(req)
      const isClosed = Boolean(req.closureClosedAt || req.returnReportedAt || req.status === 'Closed')

      let matchesSubFilter = true
      if (gatePassFilter === 'active') {
        matchesSubFilter = !isClosed
      } else if (gatePassFilter === 'pending-gatepass') {
        matchesSubFilter = !isIssued && !isClosed
      } else if (gatePassFilter === 'on-leave') {
        matchesSubFilter = isIssued && !isClosed
      } else if (gatePassFilter === 'closed') {
        matchesSubFilter = isClosed
      } else if (gatePassFilter === 'all') {
        matchesSubFilter = true
      }

      return matchesSearch && matchesSubFilter
    })
  }, [approvedLeaves, gatePassSearch, gatePassFilter, studentAccountsMap])

  const studentLeaveSummaries = useMemo(() => {
    const splSet = new Set([
      ...Object.keys(studentAccountsMap),
      ...leaveRequests.map((r) => r.studentId).filter(Boolean),
    ])

    return Array.from(splSet).map((spl) => {
      const studentInfo = studentAccountsMap[spl] || {}
      const cadetRequests = leaveRequests.filter((r) => r.studentId === spl)
      const approvedOrClosed = cadetRequests.filter((r) => r.status === 'Approved' || r.status === 'Closed')
      const closedLeaves = approvedOrClosed.filter((r) => Boolean(r.closureClosedAt || r.returnReportedAt || r.status === 'Closed'))

      const totalLeavesTaken = approvedOrClosed.length
      const totalAdjustedDays = approvedOrClosed.reduce((sum, r) => {
        const effectiveReturn = r.actualReturnDate || r.toDate
        return sum + getLeaveDaysCount(r.fromDate, effectiveReturn)
      }, 0)

      const currentlyOnLeave = approvedOrClosed.some(
        (r) => isRequestGatePassIssued(r) && !r.closureClosedAt && !r.returnReportedAt && r.status !== 'Closed'
      )

      const studentName = studentInfo.name || cadetRequests[0]?.studentName || spl

      return {
        studentId: spl,
        studentName,
        batchNumber: studentInfo.batchNumber || cadetRequests[0]?.batchNumber || 'Batch 1',
        mobileNumber: studentInfo.mobileNumber || cadetRequests[0]?.mobileNumber || 'N/A',
        totalLeavesTaken,
        totalAdjustedDays,
        currentlyOnLeave,
        closedLeavesCount: closedLeaves.length,
        records: cadetRequests,
      }
    }).sort((a, b) => {
      if (a.currentlyOnLeave && !b.currentlyOnLeave) return -1
      if (!a.currentlyOnLeave && b.currentlyOnLeave) return 1
      return b.totalAdjustedDays - a.totalAdjustedDays || a.studentId.localeCompare(b.studentId)
    })
  }, [studentAccountsMap, leaveRequests])

  const filteredStudentSummaries = useMemo(() => {
    if (!studentDetailsSearch.trim()) return studentLeaveSummaries
    const q = studentDetailsSearch.trim().toLowerCase()
    return studentLeaveSummaries.filter((s) => (
      s.studentId.toLowerCase().includes(q) ||
      s.studentName.toLowerCase().includes(q) ||
      s.batchNumber.toLowerCase().includes(q) ||
      s.mobileNumber.toLowerCase().includes(q)
    ))
  }, [studentLeaveSummaries, studentDetailsSearch])

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
    if (status === 'Approved' && selectedRequests.length > 0) {
      setSuccessMessage(`${selectedRequests.length} leave request${selectedRequests.length === 1 ? '' : 's'} approved by ${decisionApprover.name}. You can now issue Gate Passes.`)
    } else {
      setSuccessMessage(`${selectedRequests.length} leave request${selectedRequests.length === 1 ? '' : 's'} ${status.toLowerCase()}.`)
    }
    window.setTimeout(() => setSuccessMessage(''), 4000)
  }

  if (!accessGranted && activeTab === 'approvals') {
    return (
      <main className="admin-page admin-hub-page">
        <div className="admin-hub-glow" />
        <div className="admin-card leave-auth-card">
          <div className="auth-confidential-tag">
            <span className="live-pulsing-dot" style={{ background: '#38bdf8', boxShadow: '0 0 8px #38bdf8' }} />
            <span>CONFIDENTIAL CFI / DCFI AUTHORIZATION</span>
          </div>

          <h1>Leave Approvals Portal</h1>
          <p style={{ color: '#475569', fontSize: '13px', margin: '-2px 0 16px', lineHeight: '1.5' }}>
            Only authorized Flight Operations Executives (<strong>CFI &amp; DCFI</strong>) have permission to review, approve, or reject cadet leave requests.
          </p>

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
              <span>UNLOCK CFI / DCFI APPROVALS</span>
              <span className="unlock-arrow">→</span>
            </button>
          </form>

          <button
            type="button"
            className="btn-switch-to-gatepass"
            onClick={() => handleTabChange('gatepass-closure')}
            style={{
              marginTop: '16px',
              width: '100%',
              padding: '10px 14px',
              borderRadius: '8px',
              background: 'rgba(56, 189, 248, 0.08)',
              border: '1px dashed rgba(56, 189, 248, 0.45)',
              color: '#38bdf8',
              fontSize: '11.5px',
              fontWeight: '700',
              cursor: 'pointer'
            }}
          >
            Switch to Gatepass &amp; Leave Closure (OPS Desk) →
          </button>
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
              className={`btn-admin-nav-item ${activeTab === 'approvals' ? 'active' : ''}`}
              onClick={() => handleTabChange('approvals')}
            >
              📋 Leave Approvals
            </button>
            <button
              type="button"
              className={`btn-admin-nav-item ${activeTab === 'gatepass-closure' ? 'active' : ''}`}
              onClick={() => handleTabChange('gatepass-closure')}
            >
              🎫 Gatepass / Leave Closure
            </button>
            <button
              type="button"
              className={`btn-admin-nav-item ${activeTab === 'student-details' ? 'active' : ''}`}
              onClick={() => handleTabChange('student-details')}
            >
              👨‍✈️ Student Details
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

      {activeTab === 'gatepass-closure' ? (
        <section className="dashboard-content admin-gatepass-section">
          {/* Heading */}
          <div className="gatepass-section-header">
            <div className="gatepass-header-info">
              <div className="section-pill-tag">
                <span className="live-pulsing-dot" style={{ background: '#0284c7', boxShadow: '0 0 8px #0284c7' }} />
                <span>OPERATIONS &amp; SECURITY COMMAND</span>
              </div>
              <h1>Gatepass / Leave Closure Section</h1>
              <p>
                Issue official Academy Gate Passes (Stage 3), dispatch WhatsApp authorization passes to cadets and security, verify student returns to campus, and execute official leave closures (Stage 4).
              </p>
            </div>
            <div className="gatepass-header-stats-badge">
              <strong>{approvedLeaves.length}</strong>
              <span>Approved Records</span>
            </div>
          </div>

          {/* KPI Stat Cards */}
          <div className="gatepass-metrics-grid">
            <div 
              className={`gatepass-stat-card card-total ${gatePassFilter === 'active' ? 'active-filter' : ''}`}
              onClick={() => setGatePassFilter('active')}
              role="button"
              tabIndex={0}
              title="Click to view active operational queue (pending gate pass or currently on leave)"
            >
              <div className="stat-card-icon icon-purple">⚡</div>
              <div className="stat-card-content">
                <span className="stat-number">{activeQueueCount}</span>
                <span className="stat-label">Active Operations Queue</span>
                <span className="stat-hint">Pending Pass or On Leave &rarr;</span>
              </div>
            </div>

            <div 
              className={`gatepass-stat-card card-pending ${gatePassFilter === 'pending-gatepass' ? 'active-filter' : ''}`}
              onClick={() => setGatePassFilter(gatePassFilter === 'pending-gatepass' ? 'active' : 'pending-gatepass')}
              role="button"
              tabIndex={0}
              title="Click to filter pending gate passes"
            >
              <div className="stat-card-icon icon-amber">🎫</div>
              <div className="stat-card-content">
                <span className="stat-number text-amber">{gatePassPendingCount}</span>
                <span className="stat-label">Pending Gate Pass</span>
                <span className="stat-hint">Approved by CFI • Ready to issue &rarr;</span>
              </div>
            </div>

            <div 
              className={`gatepass-stat-card card-onleave ${gatePassFilter === 'on-leave' ? 'active-filter' : ''}`}
              onClick={() => setGatePassFilter(gatePassFilter === 'on-leave' ? 'active' : 'on-leave')}
              role="button"
              tabIndex={0}
              title="Click to filter cadets currently on leave"
            >
              <div className="stat-card-icon icon-cyan">✈</div>
              <div className="stat-card-content">
                <span className="stat-number text-cyan">{onLeaveActiveCount}</span>
                <span className="stat-label">Cadets On Leave</span>
                <span className="stat-hint">Gate Pass Issued • Outside campus &rarr;</span>
              </div>
            </div>

            <div 
              className={`gatepass-stat-card card-closed ${gatePassFilter === 'closed' ? 'active-filter' : ''}`}
              onClick={() => setGatePassFilter(gatePassFilter === 'closed' ? 'active' : 'closed')}
              role="button"
              tabIndex={0}
              title="Click to filter closed leaves (saved in Student Details)"
            >
              <div className="stat-card-icon icon-emerald">✓</div>
              <div className="stat-card-content">
                <span className="stat-number text-emerald">{closedLeavesCount}</span>
                <span className="stat-label">Completed Closures</span>
                <span className="stat-hint">Saved in Student Details &rarr;</span>
              </div>
            </div>
          </div>

          {/* Search & Filter Toolbar */}
          <div className="gatepass-toolbar">
            <div className="gatepass-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by Cadet Name, SPL (e.g. AAPLK180), Mobile, or Reason..."
                value={gatePassSearch}
                onChange={(e) => setGatePassSearch(e.target.value)}
              />
              {gatePassSearch && (
                <button type="button" className="btn-clear-search" onClick={() => setGatePassSearch('')}>✕</button>
              )}
            </div>

            <div className="gatepass-filter-pills">
              <button
                type="button"
                className={`gp-pill ${gatePassFilter === 'active' ? 'active' : ''}`}
                onClick={() => setGatePassFilter('active')}
              >
                ⚡ Active Queue ({activeQueueCount})
              </button>
              <button
                type="button"
                className={`gp-pill pill-amber ${gatePassFilter === 'pending-gatepass' ? 'active' : ''}`}
                onClick={() => setGatePassFilter('pending-gatepass')}
              >
                ⚠️ Pending Gate Pass ({gatePassPendingCount})
              </button>
              <button
                type="button"
                className={`gp-pill pill-cyan ${gatePassFilter === 'on-leave' ? 'active' : ''}`}
                onClick={() => setGatePassFilter('on-leave')}
              >
                ✈ On Leave ({onLeaveActiveCount})
              </button>
              <button
                type="button"
                className={`gp-pill pill-green ${gatePassFilter === 'closed' ? 'active' : ''}`}
                onClick={() => setGatePassFilter('closed')}
              >
                ✓ Completed Closures ({closedLeavesCount})
              </button>
              <button
                type="button"
                className={`gp-pill ${gatePassFilter === 'all' ? 'active' : ''}`}
                onClick={() => setGatePassFilter('all')}
              >
                All Records ({approvedLeaves.length})
              </button>
            </div>
          </div>

          {/* Gate Pass & Leave Closure Table */}
          <div className="submission-table-wrapper gatepass-table-wrapper">
            <table className="submission-table gatepass-operations-table">
              <thead>
                <tr>
                  <th>Cadet Pilot Details</th>
                  <th>Leave Timeframe</th>
                  <th>Reason</th>
                  <th>CFI / DCFI Approval</th>
                  <th>Stage 3: Gate Pass</th>
                  <th>Stage 4: Leave Closure</th>
                </tr>
              </thead>
              <tbody>
                {filteredGatePassRequests.length > 0 ? (
                  filteredGatePassRequests.map((request) => {
                    const studentInfo = studentAccountsMap[request.studentId] || {}
                    const studentName = request.studentName || studentInfo.name || request.studentId || 'Cadet Pilot'
                    const batch = request.batchNumber || studentInfo.batchNumber || 'Batch 1'
                    const mobile = request.mobileNumber || studentInfo.mobileNumber || 'N/A'
                    const isIssued = isRequestGatePassIssued(request)
                    const isClosed = Boolean(request.closureClosedAt || request.returnReportedAt)
                    const reviewer = request.reviewedBy || approverNames[request.reviewedRole] || 'CFI / DCFI'
                    const duration = getLeaveDuration(request.fromDate, request.toDate)

                    return (
                      <tr key={request.id || request.requestedAt} className={isClosed ? 'row-closed' : isIssued ? 'row-onleave' : 'row-pending-gatepass'}>
                        {/* Cadet Details */}
                        <td>
                          <div className="cadet-name-block">
                            <strong className="cadet-full-name">{studentName}</strong>
                            <span className="cadet-spl-tag">{request.studentId}</span>
                            <span className="cadet-sub-meta">🎖️ {batch} • 📱 {mobile}</span>
                          </div>
                        </td>

                        {/* Leave Timeframe */}
                        <td>
                          <div className="leave-dates-block">
                            <span className="dates-range">
                              {formatDate(request.fromDate)} &rarr; {formatDate(request.toDate)}
                            </span>
                            <span className="duration-badge">{duration}</span>
                          </div>
                        </td>

                        {/* Reason */}
                        <td>
                          <span className="leave-reason-text" title={request.reason}>{request.reason}</span>
                        </td>

                        {/* CFI / DCFI Approval */}
                        <td>
                          <div className="commander-approval-pill">
                            <span className="approval-shield">🛡️</span>
                            <div>
                              <strong>{reviewer}</strong>
                              {request.reviewedAt && (
                                <small className="approval-time">{formatDate(request.reviewedAt.split('T')[0])}</small>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Stage 3: Gate Pass */}
                        <td>
                          <div className="gatepass-action-cell">
                            {isIssued ? (
                              <div className="issued-state-wrap">
                                <span className="badge-gatepass-issued">
                                  ✓ Gate Pass Issued
                                </span>
                                <button
                                  type="button"
                                  className="btn-whatsapp-gatepass-sm"
                                  onClick={() => sendWhatsAppGatePass(request)}
                                  title="Re-send Gate Pass via WhatsApp"
                                >
                                  📲 WhatsApp Pass
                                </button>
                              </div>
                            ) : (
                              <div className="unissued-state-wrap">
                                <span className="badge-gatepass-awaiting">
                                  ⚠️ Awaiting Gate Pass
                                </span>
                                <div className="gp-action-buttons-group">
                                  <button
                                    type="button"
                                    className="btn-issue-gatepass-primary"
                                    onClick={() => handleIssueGatePass(request, false)}
                                    title="Officially issue Gate Pass for this student"
                                  >
                                    🎫 Issue Gate Pass
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-whatsapp-gatepass-primary"
                                    onClick={() => {
                                      handleIssueGatePass(request, false)
                                      sendWhatsAppGatePass(request)
                                    }}
                                    title="Issue Gate Pass and dispatch via WhatsApp immediately"
                                  >
                                    📲 Issue &amp; WhatsApp
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Stage 4: Leave Closure */}
                        <td>
                          <div className="closure-action-cell">
                            {isClosed ? (
                              <div className="closure-closed-wrap">
                                <span className="badge-closure-closed">
                                  ✓ Leave Closed
                                </span>
                                <span className="closure-date-note">
                                  Returned: <strong>{formatDate(request.actualReturnDate || request.toDate)}</strong>
                                </span>
                                <span className="closure-storage-note" style={{ fontSize: '10.5px', color: '#64748b' }}>
                                  💾 Saved in Student Details
                                </span>
                              </div>
                            ) : (
                              <div className="closure-pending-wrap">
                                <span className="badge-closure-pending">
                                  {isIssued ? '🚶 Cadet Outside Campus' : '◷ Pending Departure'}
                                </span>
                                <button
                                  type="button"
                                  className="btn-close-leave-primary"
                                  onClick={() => handleOpenCloseModal(request)}
                                  title="Select actual return date, adjust leave days, and execute official Leave Closure"
                                >
                                  ✓ Close Leave (Select Return Date)
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )
                  })
                ) : (
                  <tr>
                    <td colSpan="6" className="empty-submissions">
                      No approved leave records found matching this filter or search.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : activeTab === 'student-details' ? (
        <section className="dashboard-content admin-student-details-section">
          {/* Section Header */}
          <div className="gatepass-section-header">
            <div className="gatepass-header-info">
              <div className="section-pill-tag">
                <span className="live-pulsing-dot" style={{ background: '#7c3aed', boxShadow: '0 0 8px #7c3aed' }} />
                <span>CADET RECORDS &amp; LEAVE ATTENDANCE</span>
              </div>
              <h1>Student Details &amp; Leave Archive</h1>
              <p>
                Comprehensive student pilot roster with lifetime authorized leaves, verified return check-ins, adjusted leave days, and permanent audit dossiers.
              </p>
            </div>
            <div className="gatepass-header-stats-badge">
              <strong>{studentLeaveSummaries.length}</strong>
              <span>Cadets on File</span>
            </div>
          </div>

          {/* Metric Cards for Student Details */}
          <div className="gatepass-metrics-grid">
            <div className="gatepass-stat-card card-total">
              <div className="stat-card-icon icon-purple">👨‍✈️</div>
              <div className="stat-card-content">
                <span className="stat-number">{studentLeaveSummaries.length}</span>
                <span className="stat-label">Enrolled Cadets</span>
                <span className="stat-hint">Active Student Accounts</span>
              </div>
            </div>

            <div className="gatepass-stat-card card-onleave">
              <div className="stat-card-icon icon-cyan">✈</div>
              <div className="stat-card-content">
                <span className="stat-number text-cyan">{studentLeaveSummaries.filter((s) => s.currentlyOnLeave).length}</span>
                <span className="stat-label">Currently On Leave</span>
                <span className="stat-hint">Outside Campus Premises</span>
              </div>
            </div>

            <div className="gatepass-stat-card card-closed">
              <div className="stat-card-icon icon-emerald">✓</div>
              <div className="stat-card-content">
                <span className="stat-number text-emerald">{closedLeavesCount}</span>
                <span className="stat-label">Verified Closures</span>
                <span className="stat-hint">Completed &amp; Stored Leaves</span>
              </div>
            </div>

            <div className="gatepass-stat-card card-pending">
              <div className="stat-card-icon icon-amber">📅</div>
              <div className="stat-card-content">
                <span className="stat-number text-amber">
                  {studentLeaveSummaries.reduce((sum, s) => sum + s.totalAdjustedDays, 0)}
                </span>
                <span className="stat-label">Total Adjusted Leave Days</span>
                <span className="stat-hint">Actual Days Off Campus</span>
              </div>
            </div>
          </div>

          {/* Search toolbar */}
          <div className="gatepass-toolbar">
            <div className="gatepass-search-box">
              <span className="search-icon">🔍</span>
              <input
                type="text"
                placeholder="Search by Cadet Name, SPL (e.g. AAPLK180), Batch, or Mobile..."
                value={studentDetailsSearch}
                onChange={(e) => setStudentDetailsSearch(e.target.value)}
              />
              {studentDetailsSearch && (
                <button type="button" className="btn-clear-search" onClick={() => setStudentDetailsSearch('')}>✕</button>
              )}
            </div>
            <div style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>
              Showing <strong>{filteredStudentSummaries.length}</strong> cadet pilot{filteredStudentSummaries.length === 1 ? '' : 's'}
            </div>
          </div>

          {/* Student Dossier Table */}
          <div className="submission-table-wrapper gatepass-table-wrapper">
            <table className="submission-table gatepass-operations-table">
              <thead>
                <tr>
                  <th>Cadet Pilot Details</th>
                  <th>Contact</th>
                  <th>Current Campus Status</th>
                  <th>Leaves Authorized</th>
                  <th>Adjusted Leave Days</th>
                  <th>Completed Closures</th>
                  <th>Cadet Leave Dossier</th>
                </tr>
              </thead>
              <tbody>
                {filteredStudentSummaries.length > 0 ? (
                  filteredStudentSummaries.map((cadet) => (
                    <tr key={cadet.studentId}>
                      <td>
                        <div className="cadet-name-block">
                          <strong className="cadet-full-name">{cadet.studentName}</strong>
                          <span className="cadet-spl-tag">{cadet.studentId}</span>
                          <span className="cadet-sub-meta">🎖️ {cadet.batchNumber}</span>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontSize: '12px', fontWeight: 500 }}>📱 {cadet.mobileNumber}</span>
                      </td>
                      <td>
                        {cadet.currentlyOnLeave ? (
                          <span className="badge-gatepass-awaiting" style={{ background: '#e0f2fe', color: '#0369a1', borderColor: '#bae6fd' }}>
                            ✈ Outside Campus (On Leave)
                          </span>
                        ) : (
                          <span className="badge-gatepass-issued">
                            🏫 On Campus (Active)
                          </span>
                        )}
                      </td>
                      <td>
                        <span className="count-pill pill-subtle">
                          {cadet.totalLeavesTaken} {cadet.totalLeavesTaken === 1 ? 'leave' : 'leaves'}
                        </span>
                      </td>
                      <td>
                        <span className="count-pill pill-leaves">
                          {cadet.totalAdjustedDays} days
                        </span>
                      </td>
                      <td>
                        <span className="count-pill pill-emerald" style={{ background: '#dcfce7', color: '#15803d' }}>
                          ✓ {cadet.closedLeavesCount} closed
                        </span>
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn-close-leave-primary"
                          style={{ background: '#7c3aed', borderColor: '#7c3aed' }}
                          onClick={() => setSelectedStudentForDossier(cadet)}
                          title={`View complete leave history and records for ${cadet.studentName}`}
                        >
                          📜 View History ({cadet.records.length})
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="7" className="empty-submissions">
                      No cadet records found matching "{studentDetailsSearch}".
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </section>
      ) : (
        <section className="dashboard-content">
          <div className="approvals-to-gatepass-banner">
            <div className="banner-text">
              <span className="banner-icon">🎫</span>
              <div>
                <strong>Gatepass &amp; Leave Closure Command Desk</strong>
                <span>
                  {gatePassPendingCount > 0
                    ? `${gatePassPendingCount} approved cadet${gatePassPendingCount === 1 ? '' : 's'} awaiting Gate Pass issuance.`
                    : 'Manage issued gate passes, WhatsApp dispatches, and campus return closures.'}
                </span>
              </div>
            </div>
            <button
              type="button"
              className="btn-switch-gatepass"
              onClick={() => handleTabChange('gatepass-closure')}
            >
              Open Gatepass / Leave Closure Section &rarr;
            </button>
          </div>

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
                    />
                  </th>
                  <th>Student</th>
                  <th>From Date</th>
                  <th>To Date</th>
                  <th>Duration</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Rejection Reason</th>
                  <th>Return Status</th>
                  <th>Actions</th>
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
                      <td>{request.status === 'Rejected' && request.rejectionReason && !request.rejectionReason.startsWith('GATE_PASS_ISSUED:') ? request.rejectionReason : '-'}</td>
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
                        ) : (
                          <div className="leave-reviewed-cell">
                            <span className="reviewed-by">{request.status} by {request.reviewedBy || approverNames[request.reviewedRole] || '-'}</span>
                            {request.status === 'Approved' && (
                              <div className="admin-approved-actions-row">
                                {!isRequestGatePassIssued(request) ? (
                                  <button
                                    type="button"
                                    className="btn-issue-gatepass"
                                    onClick={() => handleIssueGatePass(request, false)}
                                    title="Officially issue Gate Pass for this student (Stage 3)"
                                  >
                                    🎫 Issue Gate Pass
                                  </button>
                                ) : (
                                  <span className="admin-gatepass-issued-badge" title="Gate pass has been officially issued">
                                    ✓ Gate Pass Issued
                                  </span>
                                )}

                                <button
                                  type="button"
                                  className="btn-whatsapp-gatepass"
                                  onClick={() => sendWhatsAppGatePass(request)}
                                  title="Open or Re-send Official Gate Pass on WhatsApp"
                                >
                                  📲 WhatsApp Gate Pass
                                </button>

                                {!request.closureClosedAt && !request.returnReportedAt && request.status !== 'Closed' ? (
                                  <button
                                    type="button"
                                    className="btn-admin-close-leave"
                                    onClick={() => handleOpenCloseModal(request)}
                                    title="Select actual return date, adjust leave days, and officially close leave (Stage 4)"
                                  >
                                    ✓ Close Leave
                                  </button>
                                ) : (
                                  <span className="admin-leave-closed-badge">
                                    ✓ Leave Closed ({formatDate(request.actualReturnDate || request.toDate)})
                                  </span>
                                )}
                              </div>
                            )}
                          </div>
                        )}
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
      )}

      {/* =========================================================================
          STAGE 4: LEAVE CLOSURE & RETURN DATE SELECTION MODAL
          ========================================================================= */}
      {closingRequest && (
        <div className="leave-closure-modal-overlay" onClick={() => !isSubmittingClosure && setClosingRequest(null)}>
          <div className="leave-closure-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="closure-modal-header">
              <div className="modal-header-badge">
                <span className="live-pulsing-dot" style={{ background: '#059669', boxShadow: '0 0 8px #059669' }} />
                <span>STAGE 4: OFFICIAL LEAVE CLOSURE</span>
              </div>
              <h2>Campus Return &amp; Leave Days Adjustment</h2>
              <p>Verify cadet return to academy premises and select the actual return date to adjust official leave days.</p>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => !isSubmittingClosure && setClosingRequest(null)}
                title="Close dialog"
              >
                ✕
              </button>
            </div>

            <div className="closure-modal-body">
              {/* Cadet Profile Preview */}
              <div className="closure-cadet-summary">
                <div className="closure-cadet-avatar">
                  {(closingRequest.studentName || closingRequest.studentId || 'C').charAt(0).toUpperCase()}
                </div>
                <div className="closure-cadet-info">
                  <h3 className="closure-cadet-name">
                    {closingRequest.studentName || studentAccountsMap[closingRequest.studentId]?.name || closingRequest.studentId}
                  </h3>
                  <div className="closure-cadet-tags">
                    <span className="cadet-spl-badge">SPL: {closingRequest.studentId}</span>
                    <span className="cadet-batch-badge">🎖️ {closingRequest.batchNumber || studentAccountsMap[closingRequest.studentId]?.batchNumber || 'Batch 1'}</span>
                    <span className="cadet-mobile-badge">📱 {closingRequest.mobileNumber || studentAccountsMap[closingRequest.studentId]?.mobileNumber || 'N/A'}</span>
                  </div>
                  <div className="closure-reason-preview">
                    <strong>Purpose:</strong> "{closingRequest.reason || 'N/A'}"
                  </div>
                </div>
              </div>

              {/* Schedule comparison row */}
              <div className="closure-schedule-grid">
                <div className="schedule-box box-original">
                  <span className="schedule-label">APPROVED SCHEDULE</span>
                  <div className="schedule-dates">
                    <span>{formatDate(closingRequest.fromDate)} &rarr; {formatDate(closingRequest.toDate)}</span>
                  </div>
                  <span className="schedule-duration-tag">
                    Originally Approved: <strong>{getLeaveDaysCount(closingRequest.fromDate, closingRequest.toDate)} Days</strong>
                  </span>
                </div>

                <div className="schedule-box box-actual">
                  <label className="schedule-label" htmlFor="actual-return-date-input">
                    SELECT ACTUAL RETURN DATE <span className="req-star">*</span>
                  </label>
                  <input
                    id="actual-return-date-input"
                    type="date"
                    className="closure-date-input"
                    value={closureReturnDate}
                    min={closingRequest.fromDate}
                    onChange={(e) => {
                      setClosureReturnDate(e.target.value)
                      setClosureError('')
                    }}
                    required
                  />
                  <div className="closure-quick-dates">
                    <button
                      type="button"
                      className="btn-quick-date"
                      onClick={() => setClosureReturnDate(getTodayDate())}
                    >
                      Today ({formatDate(getTodayDate())})
                    </button>
                    <button
                      type="button"
                      className="btn-quick-date"
                      onClick={() => setClosureReturnDate(closingRequest.toDate)}
                    >
                      Scheduled End ({formatDate(closingRequest.toDate)})
                    </button>
                  </div>
                </div>
              </div>

              {/* Dynamic calculation result */}
              {(() => {
                const origDays = getLeaveDaysCount(closingRequest.fromDate, closingRequest.toDate)
                const adjDays = getLeaveDaysCount(closingRequest.fromDate, closureReturnDate)
                const isEarly = closureReturnDate < closingRequest.toDate && closureReturnDate >= closingRequest.fromDate
                const isOnTime = closureReturnDate === closingRequest.toDate
                const isLate = closureReturnDate > closingRequest.toDate
                const isInvalid = closureReturnDate < closingRequest.fromDate

                return (
                  <div className={`closure-adjustment-preview ${isInvalid ? 'invalid' : isEarly ? 'early' : isLate ? 'extended' : 'on-time'}`}>
                    <div className="adj-header">
                      <span className="adj-icon">{isInvalid ? '⚠️' : isEarly ? '📉' : isLate ? '📈' : '✓'}</span>
                      <strong>Adjusted Leave Days Calculation</strong>
                    </div>
                    {isInvalid ? (
                      <div className="adj-error-text">
                        Return date cannot be earlier than departure date ({formatDate(closingRequest.fromDate)}).
                      </div>
                    ) : (
                      <div className="adj-details">
                        <div className="adj-main-metric">
                          <span className="adj-metric-num">{adjDays}</span>
                          <span className="adj-metric-unit">Days Total Leave</span>
                          <span className="adj-badge-status">
                            {isEarly && `Early Return (-${origDays - adjDays} days)`}
                            {isOnTime && 'On-Schedule Return (0 days variance)'}
                            {isLate && `Extended Leave (+${adjDays - origDays} days)`}
                          </span>
                        </div>
                        <p className="adj-explanation">
                          {isEarly && `Cadet returned ${origDays - adjDays} day(s) earlier than scheduled. Official leave will adjust from ${origDays} days to ${adjDays} days.`}
                          {isOnTime && `Cadet returned exactly on the scheduled end date. Total leave confirmed as ${adjDays} days.`}
                          {isLate && `Cadet returned ${adjDays - origDays} day(s) later than scheduled. Official leave will adjust from ${origDays} days to ${adjDays} days.`}
                        </p>
                        <div className="adj-store-notice">
                          <span>💾 Upon closing, this request will <strong>disappear from active queue</strong> and be saved to the <strong>Student Details section</strong>.</span>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })()}

              {closureError && (
                <div className="closure-error-banner">
                  ⚠️ {closureError}
                </div>
              )}
            </div>

            <div className="closure-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setClosingRequest(null)}
                disabled={isSubmittingClosure}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn-modal-confirm-closure"
                onClick={handleConfirmCloseLeave}
                disabled={isSubmittingClosure || closureReturnDate < closingRequest.fromDate}
              >
                {isSubmittingClosure ? 'Closing Leave...' : '✓ Confirm Return & Close Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          CADET LEAVE DOSSIER MODAL (FULL STUDENT HISTORY)
          ========================================================================= */}
      {selectedStudentForDossier && (
        <div className="leave-closure-modal-overlay" onClick={() => setSelectedStudentForDossier(null)}>
          <div className="leave-closure-modal-card dossier-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="closure-modal-header">
              <div className="modal-header-badge">
                <span className="live-pulsing-dot" style={{ background: '#7c3aed', boxShadow: '0 0 8px #7c3aed' }} />
                <span>OFFICIAL CADET LEAVE DOSSIER</span>
              </div>
              <h2>{selectedStudentForDossier.studentName}</h2>
              <p>SPL: {selectedStudentForDossier.studentId} • Batch: {selectedStudentForDossier.batchNumber} • Mobile: {selectedStudentForDossier.mobileNumber}</p>
              <button 
                type="button" 
                className="modal-close-btn" 
                onClick={() => setSelectedStudentForDossier(null)}
                title="Close dossier"
              >
                ✕
              </button>
            </div>

            <div className="closure-modal-body">
              <div className="dossier-stats-summary">
                <div className="dossier-stat">
                  <span>Total Leaves:</span>
                  <strong>{selectedStudentForDossier.totalLeavesTaken}</strong>
                </div>
                <div className="dossier-stat">
                  <span>Total Days Adjusted:</span>
                  <strong>{selectedStudentForDossier.totalAdjustedDays} days</strong>
                </div>
                <div className="dossier-stat">
                  <span>Completed Closures:</span>
                  <strong>{selectedStudentForDossier.closedLeavesCount}</strong>
                </div>
                <div className="dossier-stat">
                  <span>Current Status:</span>
                  <strong className={selectedStudentForDossier.currentlyOnLeave ? 'text-amber' : 'text-emerald'}>
                    {selectedStudentForDossier.currentlyOnLeave ? '✈ Outside Campus (On Leave)' : '🏫 On Campus'}
                  </strong>
                </div>
              </div>

              <div className="submission-table-wrapper" style={{ maxHeight: '350px', overflowY: 'auto', marginTop: '16px' }}>
                <table className="submission-table">
                  <thead>
                    <tr>
                      <th>Leave Timeframe</th>
                      <th>Adjusted Duration</th>
                      <th>Reason</th>
                      <th>CFI / DCFI Authorization</th>
                      <th>Status / Verification</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedStudentForDossier.records.length > 0 ? (
                      selectedStudentForDossier.records.map((r, rIdx) => {
                        const isClosed = Boolean(r.closureClosedAt || r.returnReportedAt || r.status === 'Closed')
                        const effectiveReturn = r.actualReturnDate || r.toDate
                        const adjDuration = `${getLeaveDaysCount(r.fromDate, effectiveReturn)} days`

                        return (
                          <tr key={r.id || r.requestedAt || rIdx}>
                            <td>
                              <div style={{ fontWeight: 600, fontSize: '12px' }}>
                                {formatDate(r.fromDate)} &rarr; {formatDate(effectiveReturn)}
                              </div>
                              {r.actualReturnDate && r.originalToDate && r.actualReturnDate !== r.originalToDate && (
                                <small style={{ color: '#0284c7' }}>Originally scheduled to {formatDate(r.originalToDate)}</small>
                              )}
                            </td>
                            <td>
                              <span className="duration-badge">{adjDuration}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: '12px' }}>{r.reason}</span>
                            </td>
                            <td>
                              <span style={{ fontSize: '11px', fontWeight: 600 }}>{r.reviewedBy || 'CFI / DCFI'}</span>
                            </td>
                            <td>
                              {isClosed ? (
                                <span className="badge-closure-closed" style={{ fontSize: '11px' }}>
                                  ✓ Closed &amp; Returned ({formatDate(effectiveReturn)})
                                </span>
                              ) : (
                                <span className="badge-closure-pending" style={{ fontSize: '11px' }}>
                                  ◷ Active / Pending Closure
                                </span>
                              )}
                            </td>
                          </tr>
                        )
                      })
                    ) : (
                      <tr>
                        <td colSpan="5" className="empty-submissions">No leave records on file.</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="closure-modal-footer">
              <button
                type="button"
                className="btn-modal-cancel"
                onClick={() => setSelectedStudentForDossier(null)}
              >
                Close Dossier
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}

export default AdminLeaveRequests
