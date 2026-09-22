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
  const [accessGranted, setAccessGranted] = useState(false)
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
    return params.get('section') === 'gatepass' ? 'gatepass-closure' : 'approvals'
  })
  const [gatePassFilter, setGatePassFilter] = useState('all')
  const [gatePassSearch, setGatePassSearch] = useState('')

  const handleTabChange = (newTab) => {
    setActiveTab(newTab)
    const url = new URL(window.location.href)
    if (newTab === 'gatepass-closure') {
      url.searchParams.set('section', 'gatepass')
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
          .select('spl_number, full_name, batch_number, mobile_number')

        const map = {}
        if (accounts) {
          accounts.forEach((acc) => {
            if (acc.spl_number) {
              map[acc.spl_number] = {
                name: acc.full_name,
                batchNumber: acc.batch_number,
                mobileNumber: acc.mobile_number,
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

  const handleAdminCloseLeave = async (request) => {
    const studentName = request.studentName || request.studentId || 'this cadet'
    if (!window.confirm(`Confirm that ${studentName} has returned to the academy premises and officially close this leave (Stage 4 Closure)?`)) {
      return
    }

    const nowIso = new Date().toISOString()
    const today = getTodayDate()

    if (request.id) {
      const { error } = await supabase
        .from('leave_requests')
        .update({
          return_reported_at: nowIso,
          closure_closed_at: nowIso,
          actual_return_date: today,
        })
        .eq('id', request.id)

      if (error) {
        setSuccessMessage(`Unable to close leave: ${error.message}`)
        return
      }
    }

    const updatedRequests = leaveRequests.map((item) => (
      (item.id && item.id === request.id) || item.requestedAt === request.requestedAt
        ? {
            ...item,
            returnReportedAt: nowIso,
            closureClosedAt: nowIso,
            actualReturnDate: today,
          }
        : item
    ))

    localStorage.setItem('leaveRequests', JSON.stringify(updatedRequests))
    setLeaveRequests(updatedRequests)
    setSuccessMessage(`✓ Stage 4 Leave Closure completed for ${studentName}. Campus return verified.`)
    window.setTimeout(() => setSuccessMessage(''), 4000)
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
    return leaveRequests.filter((r) => r.status === 'Approved')
  }, [leaveRequests])

  const gatePassPendingCount = useMemo(() => {
    return approvedLeaves.filter((r) => !isRequestGatePassIssued(r)).length
  }, [approvedLeaves])

  const onLeaveActiveCount = useMemo(() => {
    return approvedLeaves.filter((r) => isRequestGatePassIssued(r) && !r.closureClosedAt && !r.returnReportedAt).length
  }, [approvedLeaves])

  const closedLeavesCount = useMemo(() => {
    return approvedLeaves.filter((r) => Boolean(r.closureClosedAt || r.returnReportedAt)).length
  }, [approvedLeaves])

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
      const isClosed = Boolean(req.closureClosedAt || req.returnReportedAt)

      let matchesSubFilter = true
      if (gatePassFilter === 'pending-gatepass') {
        matchesSubFilter = !isIssued
      } else if (gatePassFilter === 'on-leave') {
        matchesSubFilter = isIssued && !isClosed
      } else if (gatePassFilter === 'closed') {
        matchesSubFilter = isClosed
      }

      return matchesSearch && matchesSubFilter
    })
  }, [approvedLeaves, gatePassSearch, gatePassFilter, studentAccountsMap])

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

      <div className="admin-portal-tabs-container">
        <button
          type="button"
          className={`admin-portal-tab ${activeTab === 'approvals' ? 'active' : ''}`}
          onClick={() => handleTabChange('approvals')}
        >
          <span className="portal-tab-icon">📋</span>
          <div className="portal-tab-text">
            <span className="portal-tab-title">CFI / DCFI Leave Approvals</span>
            <span className="portal-tab-desc">Stage 2: Review applications &amp; grant flight clearances</span>
          </div>
          {pendingFilteredRequests.length > 0 && (
            <span className="portal-tab-count amber">{pendingFilteredRequests.length} pending</span>
          )}
        </button>

        <button
          type="button"
          className={`admin-portal-tab ${activeTab === 'gatepass-closure' ? 'active' : ''}`}
          onClick={() => handleTabChange('gatepass-closure')}
        >
          <span className="portal-tab-icon">🎫</span>
          <div className="portal-tab-text">
            <span className="portal-tab-title">Gatepass / Leave Closure Section</span>
            <span className="portal-tab-desc">Stages 3 &amp; 4: Issue gate passes &amp; execute campus closures</span>
          </div>
          {gatePassPendingCount > 0 ? (
            <span className="portal-tab-count cyan">{gatePassPendingCount} to issue</span>
          ) : (
            <span className="portal-tab-count green">{approvedLeaves.length} records</span>
          )}
        </button>
      </div>

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
              className={`gatepass-stat-card card-pending ${gatePassFilter === 'pending-gatepass' ? 'active-filter' : ''}`}
              onClick={() => setGatePassFilter(gatePassFilter === 'pending-gatepass' ? 'all' : 'pending-gatepass')}
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
              onClick={() => setGatePassFilter(gatePassFilter === 'on-leave' ? 'all' : 'on-leave')}
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
              onClick={() => setGatePassFilter(gatePassFilter === 'closed' ? 'all' : 'closed')}
              role="button"
              tabIndex={0}
              title="Click to filter closed leaves"
            >
              <div className="stat-card-icon icon-emerald">✓</div>
              <div className="stat-card-content">
                <span className="stat-number text-emerald">{closedLeavesCount}</span>
                <span className="stat-label">Completed Closures</span>
                <span className="stat-hint">Stage 4 Verified &amp; Closed &rarr;</span>
              </div>
            </div>

            <div 
              className={`gatepass-stat-card card-total ${gatePassFilter === 'all' ? 'active-filter' : ''}`}
              onClick={() => setGatePassFilter('all')}
              role="button"
              tabIndex={0}
              title="Click to view all approved leaves"
            >
              <div className="stat-card-icon icon-purple">📋</div>
              <div className="stat-card-content">
                <span className="stat-number">{approvedLeaves.length}</span>
                <span className="stat-label">Total Authorizations</span>
                <span className="stat-hint">All Approved Cadets &rarr;</span>
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
                className={`gp-pill ${gatePassFilter === 'all' ? 'active' : ''}`}
                onClick={() => setGatePassFilter('all')}
              >
                All ({approvedLeaves.length})
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
                ✓ Closed ({closedLeavesCount})
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
                                  Campus return verified
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
                                  onClick={() => handleAdminCloseLeave(request)}
                                  title="Confirm cadet has returned to academy and execute official Leave Closure"
                                >
                                  ✓ Close Leave (Campus Return)
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

                                {!request.closureClosedAt && !request.returnReportedAt ? (
                                  <button
                                    type="button"
                                    className="btn-admin-close-leave"
                                    onClick={() => handleAdminCloseLeave(request)}
                                    title="Mark student returned to campus and officially close leave (Stage 4)"
                                  >
                                    ✓ Close Leave
                                  </button>
                                ) : (
                                  <span className="admin-leave-closed-badge">
                                    ✓ Leave Closed
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
    </main>
  )
}

export default AdminLeaveRequests
