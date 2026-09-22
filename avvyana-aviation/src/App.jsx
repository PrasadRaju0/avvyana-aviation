import { useEffect, useState } from 'react'
import { Route, Routes, useLocation, useNavigate } from 'react-router-dom'
import FlightAvailability from './FlightAvailability'
import LeaveRequest from './LeaveRequest'
import Dashboard, { getNightCurrencyStatus } from './Dashboard'
import AdminLeaveRequests from './AdminLeaveRequests'
import QueueMembersPage from './QueueMembersPage'
import SplashScreen from './SplashScreen'
import CPLFlightExperience from './CPLFlightExperience'
import StudentDashboard from './StudentDashboard'
import { supabase } from './lib/supabase'
import './App.css'
import './SignupDashboard.css'

function sanitizeSplNumber(value) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function isValidSplNumber(value) {
  return /^[A-Z0-9]+$/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)
}

function sanitizeMobileNumber(value) {
  return value.replace(/\D/g, '').slice(0, 10)
}

function sanitizeBatchNumber(value) {
  return value.replace(/\D/g, '')
}

function isValidEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim().toLowerCase())
}

function isValidFullName(value) {
  return /^[A-Za-z]+(?:[ '][A-Za-z]+)*$/.test(value.trim())
}

// ============================
// STUDENT PORTAL PAGES
// ============================

function LoginPage() {
  const navigate = useNavigate()

  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [flightDate, setFlightDate] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })
  const [error, setError] = useState('')

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')

    const normalizedSpl = studentId.trim()
    if (!isValidSplNumber(normalizedSpl)) {
      setError('SPL Number must contain both letters and numbers.')
      return
    }
    const { data: databaseAccount, error: databaseError } = await supabase
      .from('student_accounts')
      .select('spl_number, full_name, batch_number, password')
      .eq('spl_number', normalizedSpl)
      .eq('password', password)
      .maybeSingle()

    const accounts = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
    const localAccount = accounts.find(
      (item) => item.splNumber === normalizedSpl && item.password === password
    )
    const account = databaseAccount
      ? {
        name: databaseAccount.full_name,
        batchNumber: databaseAccount.batch_number,
      }
      : databaseError
        ? localAccount
        : null

    if ((normalizedSpl === 'AVV-0001' && password === '123456') || account) {
      localStorage.setItem('studentLoggedIn', 'true')
      localStorage.setItem('studentId', normalizedSpl)
      localStorage.setItem('studentName', account?.name || 'Cadet Pilot')
      localStorage.setItem('studentBatchNumber', account?.batchNumber || '')
      localStorage.setItem('selectedFlightDate', flightDate)

      navigate('/dashboard')
      return
    }

    setError('Invalid SPL Number or Password')
  }

  return (
    <div className="login-page">
      <marquee className="login-marquee" behavior="scroll" direction="left" scrollamount="7">
        <span className="marquee-aircraft" aria-hidden="true">✈</span>{' '}
        <span className="marquee-saffron">INDIA&apos;S ONLY</span>{' '}
        <span className="marquee-white">A-RATED</span>{' '}
        <span className="marquee-green">FLYING TRAINING ACADEMY</span>{' '}
        <span className="marquee-aircraft" aria-hidden="true">✈</span>
      </marquee>

      <div className="login-panel">
        <div className="login-box">

          <div className="welcome">
            <h2>Welcome back.</h2>
            <p>Sign in to access your flight training dashboard.</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>SPL NUMBER</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(sanitizeSplNumber(e.target.value))}
                pattern="[A-Z0-9]+"
                title="SPL Number must contain both letters and numbers, for example AAPLK000."
                autoComplete="username"
              />
              <small className="field-hint">Use letters and numbers, for example AAPLK000.</small>
            </div>

            <div className="form-group">
              <label>PASSWORD</label>
              <input
                type="password"
                minLength={6}
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
              />
            </div>

            <div className="form-group calendar-form-group">
              <label>FLIGHT DATE</label>
              <input
                type="date"
                value={flightDate}
                onChange={(e) => setFlightDate(e.target.value)}
              />
            </div>

            {error && <div className="login-error">{error}</div>}

            <button type="submit" className="sign-in-button">
              SIGN IN
              <span>→</span>
            </button>
          </form>

          <button
            type="button"
            className="admin-button"
            onClick={() => navigate('/admin')}
          >
            ADMIN PORTAL
            <span>→</span>
          </button>

          <div className="login-links">
            <button type="button" className="login-link" onClick={() => navigate('/signup')}>
              SIGN UP
            </button>
            <button type="button" className="login-link" onClick={() => navigate('/forgot-password')}>
              FORGOT PASSWORD?
            </button>
          </div>

          <div className="support">
            <span>Need assistance?</span>
            <a href="mailto:support@avyanna.com">Contact Academy Support</a>
          </div>
        </div>
      </div>
    </div>
  )
}

function SignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', splNumber: '', batchNumber: '', mobileNumber: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [isSubmitted, setIsSubmitted] = useState(false)

  const handleSignup = async (e) => {
    e.preventDefault()
    const normalizedSpl = form.splNumber.trim()
    const normalizedMobile = sanitizeMobileNumber(form.mobileNumber)
    const normalizedBatch = sanitizeBatchNumber(form.batchNumber)
    if (!isValidSplNumber(normalizedSpl)) {
      setError('SPL Number must contain both letters and numbers.')
      return
    }
    if (!isValidFullName(form.name)) {
      setError('Enter your full name using letters and spaces only.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (!isValidEmail(form.email)) {
      setError('Enter a valid email address, for example student@gmail.com.')
      return
    }
    if (!/^\d{10}$/.test(normalizedMobile)) {
      setError('Mobile number must contain exactly 10 digits.')
      return
    }
    if (!normalizedBatch) {
      setError('Batch number must contain numbers only.')
      return
    }

    const normalizedEmail = form.email.trim().toLowerCase()
    const [{ data: splAccount, error: splLookupError }, { data: emailAccount, error: emailLookupError }] = await Promise.all([
      supabase.from('student_accounts').select('id').eq('spl_number', normalizedSpl).maybeSingle(),
      supabase.from('student_accounts').select('id').eq('email', normalizedEmail).maybeSingle(),
    ])

    const accounts = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
    const localDuplicate = accounts.find((item) => (
      item.splNumber === normalizedSpl
      || item.email?.toLowerCase() === normalizedEmail
      || item.mobileNumber === normalizedMobile
    ))
    if (splAccount || emailAccount || localDuplicate) {
      const duplicateField = splAccount || localDuplicate?.splNumber === normalizedSpl
        ? 'SPL Number'
        : emailAccount || localDuplicate?.email?.toLowerCase() === normalizedEmail
          ? 'email address'
          : 'mobile number'
      setError(`An account with this ${duplicateField} already exists.`)
      return
    }

    const account = {
      name: form.name.trim(),
      splNumber: normalizedSpl,
      batchNumber: normalizedBatch,
      mobileNumber: normalizedMobile,
      email: normalizedEmail,
      password: form.password,
    }
    const { error: signupError } = await supabase
      .from('student_accounts')
      .insert({
        spl_number: account.splNumber,
        full_name: account.name,
        email: account.email,
        password: account.password,
        batch_number: account.batchNumber,
      })

    if (signupError) {
      if (!splLookupError && !emailLookupError) {
        setError(`Unable to create account: ${signupError.message}`)
        return
      }
      accounts.push(account)
      localStorage.setItem('studentAccounts', JSON.stringify(accounts))
    }
    setIsSubmitted(true)
  }

  const enterPortalDirectly = () => {
    const today = new Date()
    const flightDate = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
    localStorage.setItem('studentLoggedIn', 'true')
    localStorage.setItem('studentId', form.splNumber.trim())
    localStorage.setItem('studentName', form.name.trim())
    localStorage.setItem('studentBatchNumber', form.batchNumber.trim())
    localStorage.setItem('selectedFlightDate', flightDate)
    navigate('/dashboard')
  }

  // Thank you confirmation / Welcome Cadet Dashboard
  if (isSubmitted) {
    return (
      <main className="signup-success-page">
        <div className="signup-success-container-premium">
          <div className="signup-success-header-badge">
            <span className="signup-success-header-badge-dot" />
            <span>Registration Approved & Verified</span>
          </div>

          <h1 className="signup-success-title">Welcome to the Academy</h1>
          <p className="signup-success-subtitle">
            Your cadet profile has been successfully initialized in the Avyanna Flight Training System.
          </p>

          {/* Student Flight Card */}
          <div className="signup-cadet-id-card">
            <div className="cadet-card-top">
              <div className="cadet-card-brand">
                <span className="cadet-card-brand-name">Avyanna Aviation</span>
                <span className="cadet-card-brand-sub">Student Flight Identification</span>
              </div>
              <span className="cadet-card-rank-tag">Student Pilot</span>
            </div>

            <div className="cadet-card-grid">
              <div className="cadet-card-item">
                <span className="cadet-card-item-label">SPL Number</span>
                <span className="cadet-card-item-value">{form.splNumber.trim()}</span>
              </div>
              <div className="cadet-card-item">
                <span className="cadet-card-item-label">Student Name</span>
                <span className="cadet-card-item-value">{form.name.trim()}</span>
              </div>
              <div className="cadet-card-item">
                <span className="cadet-card-item-label">Batch Group</span>
                <span className="cadet-card-item-value">{form.batchNumber ? `Batch ${form.batchNumber}` : 'Standard'}</span>
              </div>
            </div>
          </div>

          {/* Quick Access Training Features */}
          <div className="signup-next-steps">
            <div className="signup-next-steps-title">
              <span>Included Pilot Privileges</span>
            </div>
            <div className="signup-features-grid">
              <div className="signup-feature-box">
                <span className="signup-feature-box-icon">✈</span>
                <strong>Flight Availability</strong>
                <span>Submit daily slots & live training queues.</span>
              </div>
              <div className="signup-feature-box">
                <span className="signup-feature-box-icon">📊</span>
                <strong>CPL Experience</strong>
                <span>Track multi/single-engine flight requirements.</span>
              </div>
              <div className="signup-feature-box">
                <span className="signup-feature-box-icon">📝</span>
                <strong>Leave Management</strong>
                <span>Apply for leaves and track CFI authorization.</span>
              </div>
            </div>
          </div>

          {/* Action CTAs */}
          <div className="signup-actions-bar">
            <button type="button" className="btn-enter-dashboard" onClick={enterPortalDirectly}>
              <span>Enter Flight Dashboard</span>
              <span style={{ fontSize: '18px' }}>→</span>
            </button>
            <button type="button" className="btn-return-login" onClick={() => navigate('/')}>
              Sign In Screen
            </button>
          </div>
        </div>
      </main>
    )
  }

  return <StudentAccountForm title="Create student account" submitLabel="SIGN UP" form={form} setForm={setForm} error={error} onSubmit={handleSignup} onBack={() => navigate('/')} />
}

function ForgotPasswordPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ splNumber: '', email: '', otp: '', password: '', confirmPassword: '' })
  const [error, setError] = useState('')
  const [otpSent, setOtpSent] = useState(false)
  const [otpVerified, setOtpVerified] = useState(false)
  const [otpChallenge, setOtpChallenge] = useState('')

  const findAccount = async () => {
    const normalizedSpl = form.splNumber.trim()
    const normalizedEmail = form.email.trim().toLowerCase()
    if (!isValidSplNumber(normalizedSpl)) {
      setError('SPL Number must contain both letters and numbers.')
      return null
    }
    if (!isValidEmail(normalizedEmail)) {
      setError('Enter a valid email address, for example student@gmail.com.')
      return null
    }
    const { data: databaseAccount, error: databaseError } = await supabase
      .from('student_accounts')
      .select('id, spl_number, email')
      .eq('spl_number', normalizedSpl)
      .eq('email', normalizedEmail)
      .maybeSingle()

    const accounts = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
    const localIndex = accounts.findIndex((item) => item.splNumber === normalizedSpl && item.email?.toLowerCase() === normalizedEmail)
    if (!databaseAccount && (!databaseError || localIndex === -1)) {
      setError('No student account matches that SPL Number and email.')
      return null
    }
    return { databaseAccount, accounts, localIndex, normalizedEmail }
  }

  const handleSendOtp = async (e) => {
    e.preventDefault()
    setError('')
    if (!await findAccount()) return
    try {
      const response = await fetch('/api/send-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email.trim().toLowerCase() }),
      })
      const responseText = await response.text()
      let result
      try {
        result = JSON.parse(responseText)
      } catch {
        result = { error: responseText || `Email OTP API returned HTTP ${response.status}.` }
      }
      if (!response.ok) return setError(result.error || `Email OTP API returned HTTP ${response.status}.`)
      if (!result.challenge) return setError('Email OTP API did not return a valid challenge. Redeploy the latest version.')
      setOtpChallenge(result.challenge || '')
      setOtpSent(true)
      setError('OTP sent to your email address. Enter it below.')
    } catch (error) {
      return setError(`Unable to contact the email OTP server: ${error.message || 'network request failed'}.`)
    }
  }

  const handleVerifyOtp = async (e) => {
    e.preventDefault()
    setError('')
    if (!/^\d{6}$/.test(form.otp.trim())) return setError('Enter the 6-digit OTP from your email.')
    try {
      const verifyResponse = await fetch('/api/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: form.email.trim().toLowerCase(),
          otp: form.otp.trim(),
          challenge: otpChallenge,
        }),
      })
      const verifyResult = await verifyResponse.json()
      if (!verifyResponse.ok) return setError(verifyResult.error || 'Invalid or expired OTP. Request a new OTP and try again.')
      setOtpVerified(true)
      setError('OTP verified. Enter and confirm your new password.')
    } catch {
      setError('Unable to contact the email OTP server. Please start it with npm run server.')
    }
  }

  const handleUpdatePassword = async (e) => {
    e.preventDefault()
    setError('')
    if (!otpVerified) return setError('Verify the OTP before updating your password.')
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters.')
    }
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.')
    const account = await findAccount()
    if (!account) return
    const { databaseAccount, accounts, localIndex, normalizedEmail } = account
    if (databaseAccount) {
      const { error: updateError } = await supabase
        .from('student_accounts')
        .update({ password: form.password })
        .eq('id', databaseAccount.id)

      if (updateError) return setError(`Unable to update password: ${updateError.message}`)
    } else {
      accounts[localIndex].password = form.password
      localStorage.setItem('studentAccounts', JSON.stringify(accounts))
    }
    navigate('/', { state: { message: 'Password updated. Sign in with your new password.' } })
  }

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  return (
    <main className="admin-page"><div className="admin-card">
      <div className="admin-portal-badge-pill student-badge-pill">
        <span className="live-pulsing-dot" style={{ background: '#0284c7', boxShadow: '0 0 8px #0284c7' }} />
        <span>STUDENT SERVICES</span>
      </div>
      <h1>Reset student password</h1>
      <p>Verify your SPL Number and email, then enter the OTP sent by email.</p>
      <form onSubmit={otpVerified ? handleUpdatePassword : otpSent ? handleVerifyOtp : handleSendOtp}>
        <div className="admin-form-group"><label>SPL NUMBER *</label><input value={form.splNumber} onChange={(event) => setForm({ ...form, splNumber: sanitizeSplNumber(event.target.value) })} pattern="[A-Z0-9]+" title="SPL Number must contain both letters and numbers, for example AAPLK000." required /><small className="field-hint">Use letters and numbers, for example AAPLK000.</small></div>
        <div className="admin-form-group"><label>EMAIL *</label><input type="email" value={form.email} onChange={update('email')} pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}" title="Enter a valid email address, for example student@gmail.com." required /><small className="field-hint">Use a valid email address, for example student@gmail.com.</small></div>
        {otpSent && <div className="otp-notice">OTP sent to your email address. Enter OTP to continue.</div>}
        {otpSent && !otpVerified && <div className="admin-form-group"><label>ENTER OTP *</label><input inputMode="numeric" pattern="[0-9]{6}" maxLength="6" value={form.otp} onChange={update('otp')} required /></div>}
        {otpVerified && <>
          <div className="admin-form-group"><label>NEW PASSWORD *</label><input type="password" value={form.password} onChange={update('password')} required /></div>
          <div className="admin-form-group"><label>CONFIRM PASSWORD *</label><input type="password" minLength={6} value={form.confirmPassword} onChange={update('confirmPassword')} required /></div>
        </>}
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="admin-back-button">
          {otpVerified ? 'UPDATE PASSWORD' : otpSent ? 'ENTER OTP' : 'SEND OTP'}
        </button>
      </form>
      <button type="button" className="admin-return-button" onClick={() => navigate('/')}>BACK TO LOGIN</button>
    </div></main>
  )
}

// ============================
// SHARED STUDENT FORM
// ============================

function StudentAccountForm({ title, submitLabel, form, setForm, error, onSubmit, onBack, reset = false }) {
  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })
  const updateSplNumber = (e) => setForm({ ...form, splNumber: sanitizeSplNumber(e.target.value) })
  const updateMobileNumber = (e) => setForm({ ...form, mobileNumber: sanitizeMobileNumber(e.target.value) })
  return (
    <main className="admin-page"><div className="admin-card">
      <div className="admin-portal-badge-pill student-badge-pill">
        <span className="live-pulsing-dot" style={{ background: '#0284c7', boxShadow: '0 0 8px #0284c7' }} />
        <span>STUDENT SERVICES</span>
      </div>
      <h1>{title}</h1>
      <form onSubmit={onSubmit}>
        {!reset && <div className="admin-form-group"><label>FULL NAME *</label><input value={form.name} onChange={update('name')} pattern="[A-Za-z]+(?:[ '][A-Za-z]+)*" title="Enter your full name using letters and spaces only." required /></div>}
        <div className="admin-form-group"><label>SPL NUMBER *</label><input value={form.splNumber} onChange={updateSplNumber} pattern="[A-Z0-9]+" title="SPL Number must contain both letters and numbers, for example AAPLK000." required /><small className="field-hint">Use letters and numbers, for example AAPLK000.</small></div>
        {!reset && <div className="admin-form-group"><label>BATCH NUMBER *</label><input inputMode="numeric" value={form.batchNumber} onChange={(event) => setForm({ ...form, batchNumber: sanitizeBatchNumber(event.target.value) })} pattern="[0-9]+" title="Batch number must contain numbers only." required /><small className="field-hint">Numbers only.</small></div>}
        <div className="admin-form-group"><label>MOBILE NUMBER *</label><input type="tel" inputMode="numeric" value={form.mobileNumber} onChange={updateMobileNumber} pattern="[0-9]{10}" maxLength="10" title="Mobile number must contain exactly 10 digits." required /><small className="field-hint">Enter exactly 10 digits.</small></div>
        {!reset && <div className="admin-form-group"><label>EMAIL *</label><input type="email" value={form.email} onChange={update('email')} pattern="[^\s@]+@[^\s@]+\.[^\s@]{2,}" title="Enter a valid email address, for example student@gmail.com." required /><small className="field-hint">Use a valid email address, for example student@gmail.com.</small></div>}
          <div className="admin-form-group"><label>{reset ? 'NEW PASSWORD *' : 'PASSWORD *'}</label><input type="password" minLength={6} value={form.password} onChange={update('password')} required /></div>
        {reset && <div className="admin-form-group"><label>CONFIRM PASSWORD *</label><input type="password" value={form.confirmPassword} onChange={update('confirmPassword')} required /></div>}
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="admin-back-button">{submitLabel}</button>
      </form>
      <button type="button" className="admin-return-button" onClick={onBack}>BACK TO LOGIN</button>
    </div></main>
  )
}

// ============================
// ADMIN PORTAL PAGES
// ============================

function AdminPortalHome() {
  const navigate = useNavigate()
  const storedAdminName = localStorage.getItem('adminName') || 'Administrator'
  const storedAdminRole = localStorage.getItem('adminRole') || 'CFI'

  // Live overview metrics for Admin Hub
  const [stats, setStats] = useState({
    activeSubmissions: 0,
    queuedCount: 0,
    pendingLeaves: 0,
    nightAlertCount: 0,
    totalCadets: 0,
  })

  useEffect(() => {
    try {
      const allCpl = JSON.parse(localStorage.getItem('all_cpl_experiences') || '{}')
      const submissions = JSON.parse(localStorage.getItem('flightSubmissions') || '[]')
      const accounts = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
      const leaves = JSON.parse(localStorage.getItem('leaveRequests') || '[]')

      const allStudentIds = Array.from(new Set([
        ...submissions.map((s) => s.studentId),
        ...accounts.map((a) => a.splNumber),
        ...Object.keys(allCpl),
      ])).filter(Boolean)

      const expiringOrExpired = allStudentIds.filter((splId) => {
        const studentCpl = allCpl[splId] || JSON.parse(localStorage.getItem(`cpl_experience_${splId}`) || 'null')
        const status = getNightCurrencyStatus(studentCpl)
        return status.isExpiringSoon || status.isExpired
      })

      const activeSubs = submissions.filter((s) => s.availability === 'available')
      const queued = submissions.filter((s) => s.queue_status === 'queued' || s.queueStatus === 'queued')
      const pendingLv = leaves.filter((l) => l.status === 'Pending approval')

      setStats({
        activeSubmissions: activeSubs.length,
        queuedCount: queued.length,
        pendingLeaves: pendingLv.length,
        nightAlertCount: expiringOrExpired.length,
        totalCadets: allStudentIds.length,
      })
    } catch {}
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('adminLoggedIn')
    localStorage.removeItem('adminRole')
    localStorage.removeItem('adminName')
    navigate('/')
  }

  return (
    <main className="admin-page admin-hub-page">
      <div className="admin-hub-glow" />
      
      <div className="admin-hub-container">
        {/* Top Executive Header */}
        <header className="admin-hub-header">
          <div className="admin-hub-brand-block">
            <div className="admin-hub-logo-circle">
              <span className="hub-plane-icon">✈</span>
            </div>
            <div>
              <div className="admin-hub-brand-title">AVYANNA AVIATION ACADEMY</div>
              <div className="admin-hub-brand-badge">FLIGHT OPERATIONS COMMAND • {storedAdminRole} PORTAL</div>
            </div>
          </div>

          <div className="admin-hub-profile-chip">
            <div className="admin-hub-avatar">{storedAdminRole}</div>
            <div className="admin-hub-user-meta">
              <strong>{storedAdminName}</strong>
              <small>Authorized Flight Operations Officer</small>
            </div>
            <button type="button" className="btn-admin-hub-logout" onClick={handleLogout} title="Sign out of Admin Portal">
              LOG OUT
            </button>
          </div>
        </header>

        {/* Live Metrics Ribbon */}
        <section className="admin-hub-stats-ribbon">
          <div className="hub-stat-card">
            <div className="hub-stat-num">{stats.activeSubmissions}</div>
            <div className="hub-stat-label">Available Pilots Today</div>
          </div>
          <div className="hub-stat-card">
            <div className="hub-stat-num stat-queued">{stats.queuedCount}</div>
            <div className="hub-stat-label">Cadets In Active Queue</div>
          </div>
          <div className="hub-stat-card">
            <div className="hub-stat-num stat-leaves">{stats.pendingLeaves}</div>
            <div className="hub-stat-label">Pending Leave Requests</div>
          </div>
          <div className="hub-stat-card">
            <div className="hub-stat-num stat-night">{stats.nightAlertCount}</div>
            <div className="hub-stat-label">Night Currency Alerts</div>
          </div>
        </section>

        {/* Interactive Workspace Modules */}
        <div className="admin-hub-workspaces-title">
          <h2>Operations Command Center</h2>
          <p>Select a dedicated workspace module to manage sorties, clearances, and training records.</p>
        </div>

        <div className="admin-hub-modules-grid">
          {/* Module 1: Cadets Availability & Sortie Management */}
          <article 
            className="admin-hub-module-card card-cadets-ops"
            onClick={() => navigate('/admin/cadets-availability')}
            role="button"
            tabIndex={0}
          >
            <div className="hub-module-top">
              <div className="hub-module-icon icon-flight-ops">✈</div>
              {stats.nightAlertCount > 0 ? (
                <span className="hub-module-badge badge-warning">
                  ⚠️ {stats.nightAlertCount} Night Expiring
                </span>
              ) : (
                <span className="hub-module-badge badge-live">Live Roster</span>
              )}
            </div>
            <div className="hub-module-body">
              <h3>Cadets Availability &amp; Sorties</h3>
              <p>Review student daily availability, aircraft type selections (PA-28 / DA42), real-time queue assignments, and 30-day Night Flying currency compliance.</p>
              <div className="hub-module-indicators">
                <span className="hub-indicator"><strong>{stats.activeSubmissions}</strong> Available for Flight</span>
                <span className="hub-indicator"><strong>{stats.queuedCount}</strong> Queued Sorties</span>
              </div>
            </div>
            <div className="hub-module-footer">
              <span>Open Cadets Availability</span>
              <span className="hub-arrow">→</span>
            </div>
          </article>

          {/* Module 2: Leave & Check-in Approvals */}
          <article 
            className="admin-hub-module-card card-leaves-ops"
            onClick={() => navigate('/admin/leave-requests')}
            role="button"
            tabIndex={0}
          >
            <div className="hub-module-top">
              <div className="hub-module-icon icon-leave-ops">📋</div>
              {stats.pendingLeaves > 0 ? (
                <span className="hub-module-badge badge-danger">
                  {stats.pendingLeaves} Awaiting Decision
                </span>
              ) : (
                <span className="hub-module-badge badge-clean">All Clear</span>
              )}
            </div>
            <div className="hub-module-body">
              <h3>Leave Approvals &amp; Returns</h3>
              <p>Process official leave applications, grant CFI / DCFI digital authorizations, enforce non-flying days, and track campus return reporting.</p>
              <div className="hub-module-indicators">
                <span className="hub-indicator"><strong>{stats.pendingLeaves}</strong> Pending Approvals</span>
                <span className="hub-indicator"><strong>CFI / DCFI</strong> Direct Authorization</span>
              </div>
            </div>
            <div className="hub-module-footer">
              <span>Open Leave Management</span>
              <span className="hub-arrow">→</span>
            </div>
          </article>

          {/* Module 3: Live Exercise Queue */}
          <article 
            className="admin-hub-module-card card-queue-ops"
            onClick={() => navigate('/admin/queue-members')}
            role="button"
            tabIndex={0}
          >
            <div className="hub-module-top">
              <div className="hub-module-icon icon-queue-ops">⏱</div>
              <span className="hub-module-badge badge-neutral">First-Come, First-Served</span>
            </div>
            <div className="hub-module-body">
              <h3>Live Sortie Queue</h3>
              <p>Monitor priority queue positionings by exercise (CCTS, GF, IF, X-Country, Night) and auto-dispatch waiting cadets into active flying slots.</p>
              <div className="hub-module-indicators">
                <span className="hub-indicator"><strong>{stats.queuedCount}</strong> Waiting In Queue</span>
                <span className="hub-indicator"><strong>Live</strong> Slot Dispatch</span>
              </div>
            </div>
            <div className="hub-module-footer">
              <span>Open Sortie Queue</span>
              <span className="hub-arrow">→</span>
            </div>
          </article>
        </div>

        {/* Quick Return */}
        <div className="admin-hub-bottom-actions">
          <button type="button" className="btn-hub-student-return" onClick={() => navigate('/')}>
            ← Switch to Cadet Portal Login
          </button>
        </div>
      </div>
    </main>
  )
}

function AdminPage() {
  const navigate = useNavigate()
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isAuthenticated, setIsAuthenticated] = useState(
    localStorage.getItem('adminLoggedIn') === 'true'
  )

  const handleLogin = (e) => {
    e.preventDefault()
    setError('')

    const accounts = JSON.parse(localStorage.getItem('adminAccounts') || '[]')
    const account = accounts.find(
      (item) => item.username === username.trim() && item.password === password
    )
    const isDemoAccount = username === 'ADMIN-001' && password === 'Admin@123'

    if (account || isDemoAccount) {
      const accountName = account?.name || 'Administrator'
      const accountRole = account?.role || (
        /dcfi|captain sm/i.test(`${accountName} ${account?.username || ''}`)
          ? 'DCFI'
          : 'CFI'
      )
      localStorage.setItem('adminLoggedIn', 'true')
      localStorage.setItem('adminRole', accountRole.toUpperCase())
      localStorage.setItem('adminName', accountName)
      setIsAuthenticated(true)
      return
    }

    setError('Invalid Admin username or password')
  }

  if (isAuthenticated) {
    return <AdminPortalHome />
  }

  return (
    <main className="admin-page">
      <div className="admin-card">
        <div className="admin-portal-badge-pill">
          <span className="live-pulsing-dot" style={{ background: '#0284c7', boxShadow: '0 0 8px #0284c7' }} />
          <span>ADMIN PORTAL</span>
        </div>
        <h1>Administrator sign in</h1>
        <p>Sign in with your separate Admin account.</p>

        <form onSubmit={handleLogin}>
          <div className="admin-form-group">
            <label htmlFor="admin-username">USERNAME</label>
            <input id="admin-username" value={username} onChange={(e) => setUsername(e.target.value)} required />
          </div>
          <div className="admin-form-group">
            <label htmlFor="admin-password">PASSWORD</label>
            <input id="admin-password" type="password" value={password} onChange={(e) => setPassword(e.target.value)} required />
          </div>
          {error && <div className="login-error">{error}</div>}
          <button type="submit" className="admin-back-button">ADMIN SIGN IN</button>
        </form>

        <div className="admin-auth-links">
          <button type="button" onClick={() => navigate('/admin/signup')}>ADMIN SIGN UP</button>
          <button type="button" onClick={() => navigate('/admin/forgot-password')}>FORGOT PASSWORD?</button>
        </div>
        <button type="button" className="admin-return-button" onClick={() => navigate('/')}>BACK TO STUDENT LOGIN</button>
      </div>
    </main>
  )
}

function AdminSignupPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ name: '', username: '', email: '', password: '', role: 'CFI' })
  const [error, setError] = useState('')

  const handleSignup = (e) => {
    e.preventDefault()
    const accounts = JSON.parse(localStorage.getItem('adminAccounts') || '[]')
    if (!isValidFullName(form.name)) {
      setError('Enter the full name using letters and spaces only.')
      return
    }
    if (form.password.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }
    if (accounts.some((item) => item.username === form.username.trim())) {
      setError('That Admin username already exists.')
      return
    }
    accounts.push({ ...form, name: form.name.trim(), username: form.username.trim(), email: form.email.trim() })
    localStorage.setItem('adminAccounts', JSON.stringify(accounts))
    navigate('/admin', { state: { message: 'Admin account created. Sign in to continue.' } })
  }

  return <AdminAccountForm title="Create Admin account" submitLabel="CREATE ADMIN ACCOUNT" form={form} setForm={setForm} error={error} onSubmit={handleSignup} onBack={() => navigate('/admin')} />
}

function AdminForgotPasswordPage() {
  const navigate = useNavigate()
  const [form, setForm] = useState({ username: '', email: '', password: '', confirmPassword: '', role: 'CFI' })
  const [error, setError] = useState('')

  const handleReset = (e) => {
    e.preventDefault()
    const accounts = JSON.parse(localStorage.getItem('adminAccounts') || '[]')
    const index = accounts.findIndex((item) => item.username === form.username.trim() && item.email.toLowerCase() === form.email.trim().toLowerCase())
    if (index === -1) return setError('No Admin account matches that username and email.')
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.')
    accounts[index].password = form.password
    localStorage.setItem('adminAccounts', JSON.stringify(accounts))
    navigate('/admin', { state: { message: 'Admin password updated. Sign in with your new password.' } })
  }

  return <AdminAccountForm title="Reset Admin password" submitLabel="UPDATE PASSWORD" form={form} setForm={setForm} error={error} onSubmit={handleReset} onBack={() => navigate('/admin')} reset />
}

function AdminAccountForm({ title, submitLabel, form, setForm, error, onSubmit, onBack, reset = false }) {
  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })
  return (
    <main className="admin-page"><div className="admin-card">
      <div className="admin-portal-badge-pill">
        <span className="live-pulsing-dot" style={{ background: '#0284c7', boxShadow: '0 0 8px #0284c7' }} />
        <span>ADMIN PORTAL</span>
      </div>
      <h1>{title}</h1>
      <form onSubmit={onSubmit}>
        {!reset && <div className="admin-form-group"><label>FULL NAME</label><input value={form.name} onChange={update('name')} pattern="[A-Za-z]+(?:[ '][A-Za-z]+)*" title="Enter your full name using letters and spaces only." required /></div>}
        <div className="admin-form-group"><label>USERNAME</label><input value={form.username} onChange={update('username')} required /></div>
        <div className="admin-form-group"><label>EMAIL</label><input type="email" value={form.email} onChange={update('email')} required /></div>
        {!reset && <div className="admin-form-group"><label>ROLE</label><select value={form.role} onChange={update('role')} required><option value="CFI">CFI</option><option value="DCFI">DCFI</option></select></div>}
        <div className="admin-form-group"><label>{reset ? 'NEW PASSWORD' : 'PASSWORD'}</label><input type="password" minLength={6} value={form.password} onChange={update('password')} required /></div>
        {reset && <div className="admin-form-group"><label>CONFIRM PASSWORD</label><input type="password" minLength={6} value={form.confirmPassword} onChange={update('confirmPassword')} required /></div>}
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="admin-back-button">{submitLabel}</button>
      </form>
      <button type="button" className="admin-return-button" onClick={onBack}>BACK TO ADMIN SIGN IN</button>
    </div></main>
  )
}

// ============================
// APP ROUTING
// ============================

function App() {
  const [showSplash, setShowSplash] = useState(true)
  const location = useLocation()

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reducedMotion = mediaQuery.matches
    if (reducedMotion) {
      setShowSplash(false)
      return
    }

    const timer = window.setTimeout(() => {
      setShowSplash(false)
    }, 4200)

    return () => window.clearTimeout(timer)
  }, [])

  return showSplash ? (
    <SplashScreen isFirstVisit={location.pathname === '/'} onFinish={() => setShowSplash(false)} />
  ) : (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/dashboard" element={<StudentDashboard />} />
      <Route path="/student/dashboard" element={<StudentDashboard />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/cadets-availability" element={<Dashboard />} />
      <Route path="/admin/queue-members" element={<QueueMembersPage />} />
      <Route path="/admin/leave-requests" element={<AdminLeaveRequests />} />
      <Route path="/admin/signup" element={<AdminSignupPage />} />
      <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />
      <Route path="/student/cpl-flight-experience" element={<CPLFlightExperience />} />
      <Route path="/flight-availability" element={<FlightAvailability />} />
      <Route path="/leave-request" element={<LeaveRequest />} />
    </Routes>
  )
}

export default App