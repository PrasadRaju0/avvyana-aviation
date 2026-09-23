import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'
import './StudentDashboard.css'

export default function StudentDashboard() {
  const navigate = useNavigate()
  const studentId = localStorage.getItem('studentId') || 'AVV-0001'
  const studentName = localStorage.getItem('studentName') || 'Student Pilot'
  const studentBatchNumber = localStorage.getItem('studentBatchNumber') || ''
  const selectedFlightDate = localStorage.getItem('selectedFlightDate') || new Date().toISOString().split('T')[0]

  const [flightSubmissions, setFlightSubmissions] = useState([])
  const [leaveRequests, setLeaveRequests] = useState([])
  const [queuedItems, setQueuedItems] = useState([])
  const [cplExperience, setCplExperience] = useState({})
  const [greeting, setGreeting] = useState('Welcome')

  // Calculate greeting by hour
  useEffect(() => {
    const hour = new Date().getHours()
    if (hour < 12) setGreeting('Good Morning')
    else if (hour < 17) setGreeting('Good Afternoon')
    else setGreeting('Good Evening')
  }, [])

  // Load data
  useEffect(() => {
    let isMounted = true

    // Load CPL Experience from storage
    try {
      const savedCPL = localStorage.getItem(`cpl_experience_${studentId}`)
      if (savedCPL) setCplExperience(JSON.parse(savedCPL))
    } catch {}

    const loadData = async () => {
      // 1. Load submissions
      const { data: subData } = await supabase
        .from('flight_submissions')
        .select('*')
        .eq('student_id', studentId)
        .order('submitted_at', { ascending: false })

      if (isMounted && subData) {
        setFlightSubmissions(subData)
      }

      // 2. Load leaves
      const { data: leaveData } = await supabase
        .from('leave_requests')
        .select('*')
        .eq('student_id', studentId)
        .order('created_at', { ascending: false })

      if (isMounted && leaveData) {
        setLeaveRequests(leaveData)
      }

      // 3. Load live queue
      const { data: queueData } = await supabase
        .from('flight_submissions')
        .select('student_id, exercise, submitted_at, queue_status, queue_started_at')
        .eq('queue_status', 'queued')

      if (isMounted && queueData) {
        const queueRows = queueData
          .flatMap((sub) => (sub.exercise || '')
            .split(',')
            .map((ex) => ({
              studentId: sub.student_id,
              exercise: ex.trim(),
              queuedAt: sub.queue_started_at || sub.submitted_at,
            })))
          .filter((row) => row.exercise)
          .sort((a, b) => new Date(a.queuedAt || 0) - new Date(b.queuedAt || 0))

        const studentQueue = queueRows
          .filter((row) => row.studentId === studentId)
          .map((row) => ({
            exercise: row.exercise,
            position: queueRows.filter(
              (candidate) => candidate.exercise === row.exercise &&
                new Date(candidate.queuedAt || 0) <= new Date(row.queuedAt || 0)
            ).length,
          }))

        setQueuedItems(studentQueue)
      }
    }

    loadData()
    const interval = setInterval(loadData, 3000)
    return () => {
      isMounted = false
      clearInterval(interval)
    }
  }, [studentId])

  const handleLogout = () => {
    localStorage.removeItem('studentLoggedIn')
    localStorage.removeItem('studentId')
    localStorage.removeItem('studentName')
    localStorage.removeItem('studentBatchNumber')
    localStorage.removeItem('selectedFlightDate')
    navigate('/')
  }

  // Calculate CPL hours progress
  const totalFlightHours = Number(cplExperience['total-flight-time']?.hours) || 
    (flightSubmissions.length > 0 ? Number(flightSubmissions[0]?.total_flying_hours) || 0 : 0)
  const picHours = Number(cplExperience['pic-time']?.hours) || 0
  const cplTarget = 200
  const cplProgressPercent = Math.min(100, Math.round((totalFlightHours / cplTarget) * 100))

  const latestLeave = leaveRequests[0] || null
  const approvedLeavesCount = leaveRequests.filter((l) => l.status === 'Approved' || l.status === 'Closed').length
  const pendingLeavesCount = leaveRequests.filter((l) => l.status === 'Pending approval').length

  const getLeaveDaysCount = (fromDate, toDate) => {
    if (!fromDate || !toDate) return 0
    const start = new Date(`${fromDate}T00:00:00`)
    const end = new Date(`${toDate}T00:00:00`)
    const diff = end - start
    if (Number.isNaN(diff) || diff < 0) return 0
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1
  }

  const totalLeaveDaysTaken = leaveRequests
    .filter((l) => l.status === 'Approved' || l.status === 'Closed')
    .reduce((sum, l) => {
      const returnDate = l.actual_return_date || l.actualReturnDate || l.to_date || l.toDate
      const fromDate = l.from_date || l.fromDate
      return sum + getLeaveDaysCount(fromDate, returnDate)
    }, 0)

  const todaySubmission = flightSubmissions.find(
    (sub) => sub.flight_date === selectedFlightDate || sub.flight_date === new Date().toISOString().split('T')[0]
  )

  return (
    <main className="student-dashboard-page">
      <div className="dashboard-ambient-glow" />

      {/* Top Navigation Bar */}
      <header className="student-dash-nav">
        <div className="dash-nav-brand">
          <img src="/avyanna-mark.svg" alt="Avyanna Mark" className="dash-nav-logo" />
          <div className="dash-nav-brand-text">
            <span className="dash-nav-name">AVYANNA</span>
            <span className="dash-nav-sub">AVIATION ACADEMY</span>
          </div>
        </div>

        <div className="dash-nav-profile">
          <div className="dash-student-chip">
            <div className="dash-avatar-circle">
              {studentName.charAt(0).toUpperCase()}
            </div>
            <div className="dash-student-info">
              <strong>{studentName}</strong>
              <span>SPL: {studentId} {studentBatchNumber ? `• Batch ${studentBatchNumber}` : ''}</span>
            </div>
          </div>

          <button type="button" className="dash-logout-btn" onClick={handleLogout} title="Sign Out">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.2">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            <span>Sign Out</span>
          </button>
        </div>
      </header>

      {/* Main Content Dashboard */}
      <div className="student-dash-container">
        
        {/* Hero Welcome Banner */}
        <section className="dash-welcome-banner">
          <div className="dash-welcome-content">
            <div className="dash-flight-tag">
              <span className="live-pulsing-dot" />
              <span>FLIGHT OPERATIONS CENTER • {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric', year: 'numeric' })}</span>
            </div>
            <h1 className="dash-welcome-title">{greeting}, {studentName}</h1>
          </div>

          <div className="dash-banner-metrics">
            <div className="dash-mini-stat">
              <span className="dash-mini-stat-label">Total Logged Hours</span>
              <div className="dash-mini-stat-val">
                <strong>{totalFlightHours.toFixed(1)}</strong>
                <small>/ 200 hrs</small>
              </div>
              <div className="dash-mini-progress">
                <div className="dash-mini-progress-bar" style={{ width: `${cplProgressPercent}%` }} />
              </div>
            </div>

            <div className="dash-mini-stat">
              <span className="dash-mini-stat-label">Active Queue</span>
              <div className="dash-mini-stat-val">
                <strong>{queuedItems.length > 0 ? `#${queuedItems[0].position}` : 'Idle'}</strong>
                <small>{queuedItems.length > 0 ? queuedItems[0].exercise : 'No active queue'}</small>
              </div>
              <span className="dash-mini-subtext">
                {queuedItems.length > 0 ? 'Live slot assigned' : 'Submit slot to queue'}
              </span>
            </div>
          </div>
        </section>

        {/* Section Title */}
        <div className="dash-section-header">
          <h2>Flight Operations Portals</h2>
          <p>Direct access to your flight training services and administrative requests</p>
        </div>

        {/* 3 Core Interactive Hub Cards */}
        <section className="dash-modules-grid">
          
          {/* Card 1: Flight Availability */}
          <a 
            href="/flight-availability" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="dash-module-card card-availability"
          >
            <div className="module-card-glow" />
            <div className="module-card-top">
              <div className="module-icon-box icon-flight">
                ✈
              </div>
              <span className="module-badge badge-active">
                {todaySubmission ? 'Status Logged' : 'Daily Slot Ready'}
              </span>
            </div>

            <div className="module-card-body">
              <h3 className="module-title">Flight Availability</h3>
              <p className="module-description">
                Schedule your daily flying slots, select aircraft types (Single-Engine PA-28 / Multi-Engine DA42), and join live training queues.
              </p>

              <div className="module-live-meta">
                {todaySubmission ? (
                  <div className="module-status-chip chip-success">
                    <span>✓ Submitted for {todaySubmission.flight_date} ({todaySubmission.availability})</span>
                  </div>
                ) : (
                  <div className="module-status-chip chip-pending">
                    <span>◷ Ready to submit for today</span>
                  </div>
                )}
              </div>
            </div>

            <div className="module-card-footer">
              <span className="module-action-link">
                <span>Enter Flight Availability</span>
                <span className="dash-arrow">→</span>
              </span>
            </div>
          </a>

          {/* Card 2: CPL Flight Experience */}
          <a 
            href="/student/cpl-flight-experience" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="dash-module-card card-cpl"
          >
            <div className="module-card-glow" />
            <div className="module-card-top">
              <div className="module-icon-box icon-cpl">
                📊
              </div>
              <span className="module-badge badge-cpl">
                {cplProgressPercent}% Completed
              </span>
            </div>

            <div className="module-card-body">
              <h3 className="module-title">CPL Flight Experience</h3>
              <p className="module-description">
                Track DGCA Commercial Pilot License syllabus milestones: PIC time, cross-country 300NM distance, instrument hours, and night sorties.
              </p>

              <div className="module-cpl-progress-block">
                <div className="cpl-bar-labels">
                  <span>CPL Target</span>
                  <strong>{totalFlightHours.toFixed(1)} / 200.0 hrs</strong>
                </div>
                <div className="cpl-progress-track">
                  <div className="cpl-progress-fill" style={{ width: `${cplProgressPercent}%` }} />
                </div>
              </div>
            </div>

            <div className="module-card-footer">
              <span className="module-action-link">
                <span>View Flight Experience Log</span>
                <span className="dash-arrow">→</span>
              </span>
            </div>
          </a>

          {/* Card 3: Leave Request */}
          <a 
            href="/leave-request" 
            target="_blank" 
            rel="noopener noreferrer" 
            className="dash-module-card card-leave"
          >
            <div className="module-card-glow" />
            <div className="module-card-top">
              <div className="module-icon-box icon-leave">
                📝
              </div>
              <span className="module-badge badge-leave">
                {pendingLeavesCount > 0 ? `${pendingLeavesCount} Pending` : `${totalLeaveDaysTaken} Leaves Taken`}
              </span>
            </div>

            <div className="module-card-body">
              <h3 className="module-title">Leave Request</h3>
              <p className="module-description">
                Apply for scheduled time off, track CFI/DCFI approval decision workflows, and log official campus check-ins upon return.
              </p>

              <div className="module-live-meta">
                {latestLeave ? (
                  <div className={`module-status-chip ${latestLeave.status === 'Approved' || latestLeave.status === 'Closed' ? 'chip-success' : latestLeave.status === 'Rejected' ? 'chip-danger' : 'chip-warning'}`}>
                    <span>{latestLeave.status === 'Closed' ? '✓ Closed' : latestLeave.status}: {latestLeave.from_date || latestLeave.fromDate} to {latestLeave.actual_return_date || latestLeave.actualReturnDate || latestLeave.to_date || latestLeave.toDate}</span>
                  </div>
                ) : (
                  <div className="module-status-chip chip-neutral">
                    <span>No active leave requests</span>
                  </div>
                )}
              </div>
            </div>

            <div className="module-card-footer">
              <span className="module-action-link">
                <span>Manage Leave Requests</span>
                <span className="dash-arrow">→</span>
              </span>
            </div>
          </a>

        </section>

        {/* Footer info banner */}
        <footer className="student-dash-footer">
          <div className="dash-footer-left">
            <span className="dash-footer-brand">Avyanna Aviation Academy</span>
            <span className="dash-footer-dot">•</span>
            <span>Directorate General of Civil Aviation (DGCA) Approved Flight Training</span>
          </div>
          <div className="dash-footer-right">
            <span>Official Student Portal v2.4</span>
          </div>
        </footer>

      </div>
    </main>
  )
}

