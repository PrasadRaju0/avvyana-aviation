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
  return (value || '').toUpperCase().replace(/[^A-Z0-9]/g, '')
}

function isValidSplNumber(value) {
  const clean = sanitizeSplNumber(value)
  return clean.length >= 3 && /[A-Z]/.test(clean) && /\d/.test(clean)
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

    const rawInput = studentId.trim()
    const cleanPassword = password.trim()

    if (!rawInput) {
      setError('Please enter your SPL Number or Email address.')
      return
    }

    if (!cleanPassword) {
      setError('Please enter your password.')
      return
    }

    const isEmail = rawInput.includes('@')
    const cleanSpl = sanitizeSplNumber(rawInput)

    let databaseAccount = null
    try {
      if (isEmail) {
        const { data, error: dbErr } = await supabase
          .from('student_accounts')
          .select('spl_number, full_name, batch_number, email, password')
          .ilike('email', rawInput.trim().toLowerCase())

        if (!dbErr && data && data.length > 0) {
          const matched = data.find((r) => {
            const dbPass = (r.password || '').toString().trim()
            return dbPass === cleanPassword || dbPass === password || (r.password || '').toString() === password
          })
          if (matched) databaseAccount = matched
        }
      } else {
        const { data, error: dbErr } = await supabase
          .from('student_accounts')
          .select('spl_number, full_name, batch_number, email, password')

        if (!dbErr && data && data.length > 0) {
          const matched = data.find((r) => {
            const rSpl = (r.spl_number || '').trim().toUpperCase()
            const rClean = sanitizeSplNumber(rSpl)
            const splMatches = rSpl === cleanSpl || rClean === cleanSpl || rSpl === rawInput.toUpperCase() || rClean === sanitizeSplNumber(rawInput)
            if (!splMatches) return false

            const dbPass = (r.password || '').toString().trim()
            return dbPass === cleanPassword || dbPass === password || (r.password || '').toString() === password
          })
          if (matched) databaseAccount = matched
        }
      }
    } catch {
      // Fall through to local account check
    }

    const accounts = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
    const localAccount = accounts.find((item) => {
      const itemEmail = (item.email || '').toString().trim().toLowerCase()
      const itemSpl = (item.splNumber || '').toString().trim().toUpperCase()
      const itemCleanSpl = sanitizeSplNumber(itemSpl)
      const matchesIdentifier = isEmail
        ? itemEmail === rawInput.toLowerCase()
        : (itemCleanSpl === cleanSpl || itemSpl === rawInput.toUpperCase() || itemCleanSpl === sanitizeSplNumber(rawInput))
      const itemPass = (item.password || '').toString().trim()
      const matchesPwd = itemPass === cleanPassword || (item.password || '').toString() === password
      return matchesIdentifier && matchesPwd
    })

    const account = databaseAccount
      ? {
        name: databaseAccount.full_name,
        batchNumber: databaseAccount.batch_number,
        mobileNumber: '',
        splNumber: databaseAccount.spl_number,
      }
      : localAccount

    const isDemoAccount = (
      cleanSpl === 'AVV0001' ||
      rawInput.toUpperCase() === 'AVV-0001' ||
      cleanSpl === 'DEMO' ||
      rawInput.toLowerCase() === 'student' ||
      rawInput.toLowerCase() === 'student@avyanna.com' ||
      rawInput.toLowerCase() === 'cadet'
    ) && (
      cleanPassword === '123456' ||
      cleanPassword === 'password' ||
      cleanPassword === 'admin@123' ||
      cleanPassword === '1'
    )

    if (isDemoAccount || account) {
      const effectiveSpl = account?.splNumber || (isDemoAccount ? 'AVV-0001' : cleanSpl)
      localStorage.setItem('studentLoggedIn', 'true')
      localStorage.setItem('studentId', effectiveSpl)
      localStorage.setItem('studentName', account?.name || 'Cadet Pilot')
      localStorage.setItem('studentBatchNumber', account?.batchNumber || '')
      localStorage.setItem('studentMobileNumber', account?.mobileNumber || '')
      localStorage.setItem('selectedFlightDate', flightDate)

      navigate('/dashboard')
      return
    }

    setError('Invalid SPL Number or Password. Please verify your credentials.')
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
              <label>SPL NUMBER OR EMAIL</label>
              <input
                type="text"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                placeholder="e.g. AAPLK180 or cadet@example.com"
                autoComplete="username"
                required
              />
              <small className="field-hint">Enter your SPL Number (e.g. AAPLK180) or registered Email.</small>
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
    const cleanSpl = sanitizeSplNumber(form.splNumber)
    const [{ data: splAccount, error: splLookupError }, { data: emailAccount, error: emailLookupError }] = await Promise.all([
      supabase.from('student_accounts').select('id').or(`spl_number.ilike."${normalizedSpl}",spl_number.ilike."${cleanSpl}"`).maybeSingle(),
      supabase.from('student_accounts').select('id').eq('email', normalizedEmail).maybeSingle(),
    ])

    const accounts = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
    const localDuplicate = accounts.find((item) => (
      sanitizeSplNumber(item.splNumber) === cleanSpl
      || item.email?.toLowerCase() === normalizedEmail
      || item.mobileNumber === normalizedMobile
    ))
    if (splAccount || emailAccount || localDuplicate) {
      const duplicateField = splAccount || sanitizeSplNumber(localDuplicate?.splNumber) === cleanSpl
        ? 'SPL Number'
        : emailAccount || localDuplicate?.email?.toLowerCase() === normalizedEmail
          ? 'email address'
          : 'mobile number'
      setError(`An account with this ${duplicateField} already exists.`)
      return
    }

    const account = {
      name: form.name.trim(),
      splNumber: cleanSpl,
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

    accounts.push(account)
    localStorage.setItem('studentAccounts', JSON.stringify(accounts))

    if (signupError) {
      if (!splLookupError && !emailLookupError) {
        setError(`Unable to create account: ${signupError.message}`)
        return
      }
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
    localStorage.setItem('studentMobileNumber', form.mobileNumber.trim())
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
    const cleanSpl = sanitizeSplNumber(normalizedSpl)
    const { data: databaseAccount, error: databaseError } = await supabase
      .from('student_accounts')
      .select('id, spl_number, email')
      .or(`spl_number.ilike."${normalizedSpl}",spl_number.ilike."${cleanSpl}"`)
      .eq('email', normalizedEmail)
      .maybeSingle()

    const accounts = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
    const localIndex = accounts.findIndex((item) => (
      (sanitizeSplNumber(item.splNumber) === cleanSpl || item.splNumber?.toLowerCase() === normalizedSpl.toLowerCase())
      && item.email?.toLowerCase() === normalizedEmail
    ))
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

  // Cadet Quick Search & Dossier States
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCadetSpl, setSelectedCadetSpl] = useState(null)
  const [allCadets, setAllCadets] = useState([])

  const getTodayDate = () => {
    const d = new Date()
    const year = d.getFullYear()
    const month = String(d.getMonth() + 1).padStart(2, '0')
    const day = String(d.getDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  const getLeaveDaysCount = (fromDate, toDate) => {
    if (!fromDate || !toDate) return 0
    const start = new Date(`${fromDate}T00:00:00`)
    const end = new Date(`${toDate}T00:00:00`)
    const diffTime = end.getTime() - start.getTime()
    if (Number.isNaN(diffTime) || diffTime < 0) return 0
    return Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1
  }

  const formatDateDisplay = (dateValue) => {
    if (!dateValue) return 'N/A'
    const date = new Date(dateValue.length === 10 ? `${dateValue}T00:00:00` : dateValue)
    if (Number.isNaN(date.getTime())) return dateValue
    return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
  }

  useEffect(() => {
    let isMounted = true

    const loadData = async () => {
      try {
        const [accountRes, submissionRes, leaveRes] = await Promise.all([
          supabase.from('student_accounts').select('*'),
          supabase.from('flight_submissions').select('*').order('submitted_at', { ascending: false }),
          supabase.from('leave_requests').select('*').order('created_at', { ascending: false }),
        ])

        const localAccounts = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
        const localSubs = JSON.parse(localStorage.getItem('flightSubmissions') || '[]')
        const localLeaves = JSON.parse(localStorage.getItem('leaveRequests') || '[]')
        const allCpl = JSON.parse(localStorage.getItem('all_cpl_experiences') || '{}')

        // Build unified accounts map
        const accountsMap = new Map()
        localAccounts.forEach((a) => {
          if (a.splNumber) {
            const spl = a.splNumber.trim().toUpperCase()
            accountsMap.set(spl, {
              splNumber: spl,
              name: a.name || a.fullName || spl,
              batchNumber: a.batchNumber || 'Batch 1',
              mobileNumber: a.mobileNumber || 'N/A',
              email: a.email || 'N/A',
            })
          }
        })
        if (accountRes?.data) {
          accountRes.data.forEach((a) => {
            if (a.spl_number) {
              const spl = a.spl_number.trim().toUpperCase()
              accountsMap.set(spl, {
                splNumber: spl,
                name: a.full_name || spl,
                batchNumber: a.batch_number || accountsMap.get(spl)?.batchNumber || 'Batch 1',
                mobileNumber: a.mobile_number || accountsMap.get(spl)?.mobileNumber || 'N/A',
                email: a.email || accountsMap.get(spl)?.email || 'N/A',
              })
            }
          })
        }

        // Submissions map
        const submissions = (submissionRes?.data && submissionRes.data.length > 0)
          ? submissionRes.data.map((item) => ({
              id: item.id,
              studentId: (item.student_id || '').trim().toUpperCase(),
              studentName: item.student_name,
              flightDate: item.flight_date,
              availability: item.availability,
              queueStatus: item.queue_status || 'pending',
              queueStartedAt: item.queue_started_at,
              aircraftType: item.aircraft_type,
              exercise: item.exercise,
              unavailabilityReason: item.unavailability_reason,
              totalFlyingHours: item.total_flying_hours,
              submittedAt: item.submitted_at,
            }))
          : localSubs.map((item) => ({
              ...item,
              studentId: (item.studentId || '').trim().toUpperCase(),
            }))

        // Leaves map
        const leaves = (leaveRes?.data && leaveRes.data.length > 0)
          ? leaveRes.data.map((item) => ({
              id: item.id,
              studentId: (item.student_id || '').trim().toUpperCase(),
              studentName: item.student_name,
              batchNumber: item.batch_number,
              mobileNumber: item.mobile_number,
              fromDate: item.from_date,
              toDate: item.to_date,
              actualReturnDate: item.actual_return_date,
              reason: item.reason,
              status: item.status,
              closureClosedAt: item.closure_closed_at,
              returnReportedAt: item.return_reported_at,
              reviewedBy: item.reviewed_by,
              rejectionReason: item.rejection_reason,
            }))
          : localLeaves.map((item) => ({
              ...item,
              studentId: (item.studentId || '').trim().toUpperCase(),
            }))

        // Collect distinct student SPL numbers
        const distinctSpls = Array.from(new Set([
          ...Array.from(accountsMap.keys()),
          ...submissions.map((s) => s.studentId),
          ...leaves.map((l) => l.studentId),
          ...Object.keys(allCpl).map((k) => k.trim().toUpperCase()),
        ])).filter(Boolean)

        const todayStr = getTodayDate()

        // Build comprehensive cadet dossier records
        const cadetsList = distinctSpls.map((spl) => {
          const acc = accountsMap.get(spl)
          const cadetSubs = submissions.filter((s) => s.studentId === spl)
            .sort((a, b) => new Date(b.flightDate || b.submittedAt || 0) - new Date(a.flightDate || a.submittedAt || 0))
          const cadetLeaves = leaves.filter((l) => l.studentId === spl)
            .sort((a, b) => new Date(b.fromDate || 0) - new Date(a.fromDate || 0))

          const studentName = acc?.name || cadetSubs[0]?.studentName || cadetLeaves[0]?.studentName || spl
          const batchNumber = acc?.batchNumber || cadetSubs[0]?.batchNumber || cadetLeaves[0]?.batchNumber || 'Batch 1'
          const mobileNumber = acc?.mobileNumber || cadetLeaves.find((l) => l.mobileNumber)?.mobileNumber || 'N/A'
          const email = acc?.email || 'N/A'

          // Today or latest flight submission
          const todaySub = cadetSubs.find((s) => (s.flightDate || s.submittedAt || '').startsWith(todayStr)) || cadetSubs[0]
          const notAvailableSubs = cadetSubs.filter((s) => s.availability === 'not-available' || s.availability === 'seventh-day')
          const notAvailableCount = notAvailableSubs.length
          const latestNotAvailable = notAvailableSubs[0]
          const unavailabilityReason = latestNotAvailable?.unavailabilityReason || (latestNotAvailable?.availability === 'seventh-day' ? '7th Day Mandatory Rest' : null)

          // Leaves analysis
          const approvedOrClosedLeaves = cadetLeaves.filter((l) => l.status === 'Approved' || l.status === 'Closed')
          const totalLeavesCount = approvedOrClosedLeaves.length
          const totalLeaveDays = approvedOrClosedLeaves.reduce((sum, req) => {
            const retDate = req.actualReturnDate || req.toDate
            return sum + getLeaveDaysCount(req.fromDate, retDate)
          }, 0)

          // Currently on active leave?
          const activeLeave = cadetLeaves.find((req) => {
            const isApproved = req.status === 'Approved'
            const isClosed = Boolean(req.closureClosedAt || req.returnReportedAt || req.status === 'Closed')
            if (isClosed || !isApproved) return false
            const retDate = req.actualReturnDate || req.toDate
            return todayStr >= req.fromDate && todayStr <= retDate
          })

          const currentlyOnLeave = Boolean(activeLeave)

          // Night currency
          const cadetCpl = allCpl[spl] || JSON.parse(localStorage.getItem(`cpl_experience_${spl}`) || 'null')
          const nightStatus = getNightCurrencyStatus(cadetCpl)

          // Flying hours & queue status
          const totalFlyingHours = cadetSubs.reduce((sum, s) => sum + Number(s.totalFlyingHours || 0), 0)
          const isQueued = todaySub?.queueStatus === 'queued'

          return {
            splNumber: spl,
            studentName,
            batchNumber,
            mobileNumber,
            email,
            todaySub,
            notAvailableCount,
            unavailabilityReason,
            totalLeavesCount,
            totalLeaveDays,
            currentlyOnLeave,
            activeLeave,
            cadetLeaves,
            nightStatus,
            totalFlyingHours,
            isQueued,
          }
        })

        if (!isMounted) return

        setAllCadets(cadetsList)

        const activeSubs = submissions.filter((s) => s.availability === 'available')
        const queued = submissions.filter((s) => s.queueStatus === 'queued')
        const pendingLv = leaves.filter((l) => l.status === 'Pending approval')
        const nightAlerts = cadetsList.filter((c) => c.nightStatus.isExpiringSoon || c.nightStatus.isExpired)

        setStats({
          activeSubmissions: activeSubs.length,
          queuedCount: queued.length,
          pendingLeaves: pendingLv.length,
          nightAlertCount: nightAlerts.length,
          totalCadets: distinctSpls.length,
        })
      } catch (err) {
        console.warn('AdminPortalHome load error:', err)
      }
    }

    loadData()
    return () => { isMounted = false }
  }, [])

  const handleLogout = () => {
    localStorage.removeItem('adminLoggedIn')
    localStorage.removeItem('adminRole')
    localStorage.removeItem('adminName')
    navigate('/')
  }

  // Filtered cadets based on search query
  const trimmedSearch = searchQuery.trim().toLowerCase()
  const matchingCadets = trimmedSearch
    ? allCadets.filter((c) =>
        c.splNumber.toLowerCase().includes(trimmedSearch) ||
        c.studentName.toLowerCase().includes(trimmedSearch)
      )
    : []

  const activeCadet = matchingCadets.find((c) => c.splNumber === selectedCadetSpl) || matchingCadets[0]

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

        {/* Interactive Workspace Modules Header + Quick Cadet Search */}
        <div className="admin-hub-workspaces-header">
          <div className="admin-hub-workspaces-title">
            <h2>Operations Command Center</h2>
            <p>Select a dedicated workspace module or search any cadet's operational dossier.</p>
          </div>

          {/* Integrated Search Bar in the Right Place */}
          <div className="admin-hub-search-box">
            <span className="hub-search-icon">🔍</span>
            <input
              type="search"
              className="admin-hub-search-input"
              placeholder="Search cadet by Name or SPL (e.g. AAPLK180)..."
              value={searchQuery}
              onChange={(e) => {
                setSearchQuery(e.target.value)
                if (!e.target.value.trim()) setSelectedCadetSpl(null)
              }}
            />
            {searchQuery && (
              <button
                type="button"
                className="hub-search-clear-btn"
                onClick={() => {
                  setSearchQuery('')
                  setSelectedCadetSpl(null)
                }}
                title="Clear search"
              >
                ✕
              </button>
            )}
          </div>
        </div>

        {/* Quick Matching Chips when multiple cadets match */}
        {trimmedSearch && matchingCadets.length > 1 && (
          <div className="hub-cadet-matching-chips">
            <span className="hub-matching-label">Matching Cadets ({matchingCadets.length}):</span>
            {matchingCadets.slice(0, 8).map((c) => (
              <button
                key={c.splNumber}
                type="button"
                className={`hub-cadet-chip ${activeCadet?.splNumber === c.splNumber ? 'active' : ''}`}
                onClick={() => setSelectedCadetSpl(c.splNumber)}
              >
                <strong>{c.splNumber}</strong> • {c.studentName}
              </button>
            ))}
          </div>
        )}

        {/* 360° Comprehensive Cadet Operational Dossier */}
        {trimmedSearch && (
          activeCadet ? (
            <div className="hub-cadet-dossier-card">
              {/* Dossier Header */}
              <div className="dossier-header">
                <div className="dossier-profile-left">
                  <div className="dossier-avatar">
                    {(activeCadet.studentName || 'C').charAt(0).toUpperCase()}
                  </div>
                  <div className="dossier-identity">
                    <div className="dossier-name-row">
                      <h3>{activeCadet.studentName}</h3>
                      <span className="dossier-badge-spl">SPL: {activeCadet.splNumber}</span>
                      <span className="dossier-badge-batch">🎖️ {activeCadet.batchNumber}</span>
                    </div>
                    <div className="dossier-contact-row">
                      <span>📱 {activeCadet.mobileNumber}</span>
                      <span>✉️ {activeCadet.email}</span>
                    </div>
                  </div>
                </div>

                <div className="dossier-status-right">
                  <span className={`dossier-campus-badge ${activeCadet.currentlyOnLeave ? 'campus-leave' : 'campus-present'}`}>
                    {activeCadet.currentlyOnLeave ? '✈ OUTSIDE CAMPUS (ON LEAVE)' : '🏫 ON CAMPUS'}
                  </span>
                  <button
                    type="button"
                    className="dossier-btn-clear"
                    onClick={() => {
                      setSearchQuery('')
                      setSelectedCadetSpl(null)
                    }}
                    title="Close Dossier"
                  >
                    ✕ Close
                  </button>
                </div>
              </div>

              {/* 4-Panel Detailed Diagnostic Grid */}
              <div className="dossier-grid">
                {/* Panel 1: Leaves & Campus Absence ("everything leavs") */}
                <div className="dossier-panel panel-leaves">
                  <div className="panel-header">
                    <span className="panel-icon">📋</span>
                    <h4>Leave Records &amp; Gatepass</h4>
                  </div>
                  <div className="panel-body">
                    <div className="panel-metric-row">
                      <div className="metric-box">
                        <span className="metric-num text-purple">{activeCadet.totalLeaveDays} d</span>
                        <span className="metric-lbl">Total Leaves Taken</span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-num">{activeCadet.totalLeavesCount}</span>
                        <span className="metric-lbl">Approved Requests</span>
                      </div>
                    </div>
                    <div className="panel-detail-list">
                      <div className="detail-item">
                        <span className="detail-label">Current Campus Status:</span>
                        <strong className={activeCadet.currentlyOnLeave ? 'text-amber' : 'text-emerald'}>
                          {activeCadet.currentlyOnLeave ? 'Active Leave in Progress' : 'On Campus (No Active Leave)'}
                        </strong>
                      </div>
                      {activeCadet.activeLeave ? (
                        <div className="detail-item highlight-item">
                          <span className="detail-label">Active Leave Schedule:</span>
                          <span>
                            {formatDateDisplay(activeCadet.activeLeave.fromDate)} &rarr; {formatDateDisplay(activeCadet.activeLeave.actualReturnDate || activeCadet.activeLeave.toDate)}
                            {' '}(<strong>{getLeaveDaysCount(activeCadet.activeLeave.fromDate, activeCadet.activeLeave.actualReturnDate || activeCadet.activeLeave.toDate)} days</strong>)
                          </span>
                        </div>
                      ) : activeCadet.cadetLeaves[0] ? (
                        <div className="detail-item">
                          <span className="detail-label">Last Closed Leave:</span>
                          <span>
                            {formatDateDisplay(activeCadet.cadetLeaves[0].fromDate)} &rarr; {formatDateDisplay(activeCadet.cadetLeaves[0].actualReturnDate || activeCadet.cadetLeaves[0].toDate)}
                          </span>
                        </div>
                      ) : null}
                      {activeCadet.cadetLeaves[0] && (
                        <div className="detail-item">
                          <span className="detail-label">Stated Purpose:</span>
                          <span>"{activeCadet.cadetLeaves[0].reason || 'N/A'}"</span>
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="panel-footer">
                    <a
                      href="/admin/leave-requests?section=student-details"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dossier-panel-link"
                    >
                      Open Leave Dossier &rarr;
                    </a>
                  </div>
                </div>

                {/* Panel 2: Daily Flight Availability & Unavailability ("and not avilanble") */}
                <div className="dossier-panel panel-availability">
                  <div className="panel-header">
                    <span className="panel-icon">✈</span>
                    <h4>Daily Availability &amp; Sorties</h4>
                  </div>
                  <div className="panel-body">
                    <div className="panel-metric-row">
                      <div className="metric-box">
                        <span className={`metric-status-tag ${activeCadet.todaySub?.availability || 'none'}`}>
                          {activeCadet.todaySub?.availability === 'available' ? '✓ Available'
                            : activeCadet.todaySub?.availability === 'not-available' ? '⛔ Not Available'
                            : activeCadet.todaySub?.availability === 'seventh-day' ? '🛌 7th Day Rest'
                            : '⚪ Not Submitted'}
                        </span>
                        <span className="metric-lbl">Today's Flight Status</span>
                      </div>
                      <div className="metric-box">
                        <span className="metric-num text-amber">{activeCadet.notAvailableCount} d</span>
                        <span className="metric-lbl">Not Available Days</span>
                      </div>
                    </div>
                    <div className="panel-detail-list">
                      <div className="detail-item">
                        <span className="detail-label">Unavailability Reason:</span>
                        <strong className={activeCadet.unavailabilityReason ? 'text-amber' : 'text-slate'}>
                          {activeCadet.unavailabilityReason ? `"${activeCadet.unavailabilityReason}"` : 'None reported'}
                        </strong>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Aircraft Preference:</span>
                        <span>{activeCadet.todaySub?.aircraftType || 'PA-28 Piper Archer'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Exercise Syllabus:</span>
                        <span>{activeCadet.todaySub?.exercise || 'CCTS / GF'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="panel-footer">
                    <a
                      href="/admin/cadets-availability"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dossier-panel-link"
                    >
                      Open Availability Roster &rarr;
                    </a>
                  </div>
                </div>

                {/* Panel 3: 30-Day Night Currency (DGCA) ("night expiry etc.") */}
                <div className="dossier-panel panel-night">
                  <div className="panel-header">
                    <span className="panel-icon">🌙</span>
                    <h4>DGCA Night Flying Currency</h4>
                  </div>
                  <div className="panel-body">
                    <div className="panel-metric-row">
                      <div className="metric-box">
                        <span className={`metric-status-tag night-${activeCadet.nightStatus.status}`}>
                          {activeCadet.nightStatus.status === 'valid' ? '✓ Night Current'
                            : activeCadet.nightStatus.status === 'expiring_soon' ? '⚠️ Expiring Soon'
                            : activeCadet.nightStatus.status === 'expired' ? '❌ Currency Expired'
                            : '⚪ Not Logged'}
                        </span>
                        <span className="metric-lbl">DGCA 6-Mo Rule Status</span>
                      </div>
                      <div className="metric-box">
                        <span className={`metric-num ${activeCadet.nightStatus.isExpired ? 'text-red' : activeCadet.nightStatus.isExpiringSoon ? 'text-amber' : 'text-emerald'}`}>
                          {activeCadet.nightStatus.daysRemaining !== null
                            ? `${activeCadet.nightStatus.daysRemaining > 0 ? activeCadet.nightStatus.daysRemaining : Math.abs(activeCadet.nightStatus.daysRemaining)}d`
                            : '-'}
                        </span>
                        <span className="metric-lbl">
                          {activeCadet.nightStatus.isExpired ? 'Days Expired' : 'Days Remaining'}
                        </span>
                      </div>
                    </div>
                    <div className="panel-detail-list">
                      <div className="detail-item">
                        <span className="detail-label">Currency Expiry Date:</span>
                        <strong className={activeCadet.nightStatus.isExpired ? 'text-red' : activeCadet.nightStatus.isExpiringSoon ? 'text-amber' : 'text-slate'}>
                          {formatDateDisplay(activeCadet.nightStatus.expiryDate) || 'Needs Night PIC flight'}
                        </strong>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Last Night Flight:</span>
                        <span>{formatDateDisplay(activeCadet.nightStatus.flightDate) || 'No flight recorded'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Night PIC Hours:</span>
                        <span>{activeCadet.nightStatus.hours} hrs logged</span>
                      </div>
                    </div>
                  </div>
                  <div className="panel-footer">
                    <span className="dgca-micro-rule">
                      Rule: Requires 1 PIC night takeoff/landing within preceding 6 months.
                    </span>
                  </div>
                </div>

                {/* Panel 4: Flight Training Hours & Sortie Queue */}
                <div className="dossier-panel panel-queue">
                  <div className="panel-header">
                    <span className="panel-icon">⏱</span>
                    <h4>Flying Hours &amp; Queue Position</h4>
                  </div>
                  <div className="panel-body">
                    <div className="panel-metric-row">
                      <div className="metric-box">
                        <span className="metric-num text-blue">{activeCadet.totalFlyingHours} hrs</span>
                        <span className="metric-lbl">Total Hours Logged</span>
                      </div>
                      <div className="metric-box">
                        <span className={`metric-status-tag ${activeCadet.isQueued ? 'tag-queued' : 'tag-idle'}`}>
                          {activeCadet.isQueued ? '⏱ Active in Queue' : 'Not in Queue'}
                        </span>
                        <span className="metric-lbl">Live Sortie Dispatch</span>
                      </div>
                    </div>
                    <div className="panel-detail-list">
                      <div className="detail-item">
                        <span className="detail-label">Queue Priority:</span>
                        <span>{activeCadet.isQueued ? 'FIFO Priority Dispatch' : 'Standing Roster'}</span>
                      </div>
                      <div className="detail-item">
                        <span className="detail-label">Training Progress:</span>
                        <span>{((activeCadet.totalFlyingHours / 200) * 100).toFixed(1)}% of 200 CPL Hours</span>
                      </div>
                    </div>
                  </div>
                  <div className="panel-footer">
                    <a
                      href="/admin/queue-members"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="dossier-panel-link"
                    >
                      Open Live Sortie Queue &rarr;
                    </a>
                  </div>
                </div>
              </div>
            </div>
          ) : (
            <div className="hub-search-no-results">
              <span className="no-res-icon">🔍</span>
              <p>No cadet records found matching "<strong>{searchQuery}</strong>". Try searching with SPL Number (e.g. <code>AAPLK180</code>) or cadet name.</p>
              <button
                type="button"
                className="btn-clear-search-pill"
                onClick={() => setSearchQuery('')}
              >
                Clear Search
              </button>
            </div>
          )
        )}

        <div className="admin-hub-modules-grid">
          {/* Pair 1: Flight Operations (Row 1) */}
          {/* Module 1: Cadets Availability & Sortie Management */}
          <a 
            href="/admin/cadets-availability"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-hub-module-card card-cadets-ops"
          >
            <div className="hub-module-top">
              <div className="hub-module-icon icon-flight-ops">✈</div>
              {stats.nightAlertCount > 0 ? (
                <span className="hub-module-badge badge-flight-alert">
                  ⚠️ {stats.nightAlertCount} Night Expiring
                </span>
              ) : (
                <span className="hub-module-badge badge-flight-live">Live Roster</span>
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
          </a>

          {/* Module 2: Live Exercise Queue */}
          <a 
            href="/admin/queue-members"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-hub-module-card card-queue-ops"
          >
            <div className="hub-module-top">
              <div className="hub-module-icon icon-queue-ops">⏱</div>
              <span className="hub-module-badge badge-flight-live">Live Slot Dispatch</span>
            </div>
            <div className="hub-module-body">
              <h3>Live Sortie Queue</h3>
              <p>Monitor priority queue positionings by exercise (CCTS, GF, IF, X-Country, Night) and auto-dispatch waiting cadets into active flying slots.</p>
              <div className="hub-module-indicators">
                <span className="hub-indicator"><strong>{stats.queuedCount}</strong> Waiting In Queue</span>
                <span className="hub-indicator"><strong>FIFO</strong> Queue Priority</span>
              </div>
            </div>
            <div className="hub-module-footer">
              <span>Open Sortie Queue</span>
              <span className="hub-arrow">→</span>
            </div>
          </a>

          {/* Pair 2: Leave & Gatepass Clearance (Row 2) */}
          {/* Module 3: Leave & Check-in Approvals */}
          <a 
            href="/admin/leave-requests"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-hub-module-card card-leaves-ops"
          >
            <div className="hub-module-top">
              <div className="hub-module-icon icon-leave-ops">📋</div>
              <div className="hub-module-badges-group">
                <span className="hub-module-badge badge-cfi-locked">🔒 CFI / DCFI ONLY</span>
                {stats.pendingLeaves > 0 ? (
                  <span className="hub-module-badge badge-leave-pending">
                    {stats.pendingLeaves} Awaiting Decision
                  </span>
                ) : (
                  <span className="hub-module-badge badge-leave-clear">All Clear</span>
                )}
              </div>
            </div>
            <div className="hub-module-body">
              <h3>Leave Approvals &amp; Returns</h3>
              <p>Process official leave applications, grant CFI / DCFI digital authorizations, enforce non-flying days, and track campus return reporting.</p>
              <div className="hub-module-indicators">
                <span className="hub-indicator"><strong>{stats.pendingLeaves}</strong> Pending Approvals</span>
                <span className="hub-indicator"><strong>Restricted:</strong> CFI / DCFI Only</span>
              </div>
            </div>
            <div className="hub-module-footer">
              <span>Open Leave Management (CFI / DCFI)</span>
              <span className="hub-arrow">→</span>
            </div>
          </a>

          {/* Module 4: Gatepass & Leave Closure Operations */}
          <a 
            href="/admin/leave-requests?section=gatepass"
            target="_blank"
            rel="noopener noreferrer"
            className="admin-hub-module-card card-gatepass-ops"
          >
            <div className="hub-module-top">
              <div className="hub-module-icon icon-gatepass-ops">🎫</div>
              <span className="hub-module-badge badge-leave-clear">OPS &amp; Security Desk</span>
            </div>
            <div className="hub-module-body">
              <h3>Gatepass &amp; Leave Closure</h3>
              <p>Issue authorized Academy Gate Passes, dispatch official WhatsApp clearances, track student absence status, and complete return closures.</p>
              <div className="hub-module-indicators">
                <span className="hub-indicator"><strong>Stage 3</strong> Gate Pass Issuance</span>
                <span className="hub-indicator"><strong>Stage 4</strong> Return Closure</span>
              </div>
            </div>
            <div className="hub-module-footer">
              <span>Open Gatepass / Closure Section (OPS Desk)</span>
              <span className="hub-arrow">→</span>
            </div>
          </a>
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

    const cleanUsername = username.trim().toLowerCase()
    const cleanPassword = password.trim()

    const accounts = JSON.parse(localStorage.getItem('adminAccounts') || '[]')
    const account = accounts.find(
      (item) => (item.username || '').trim().toLowerCase() === cleanUsername && (
        item.password === cleanPassword ||
        item.password?.trim() === cleanPassword ||
        (item.password || '').toLowerCase() === cleanPassword.toLowerCase()
      )
    )

    const isDemoAccount = (
      cleanUsername === 'admin-001' ||
      cleanUsername === 'admin001' ||
      cleanUsername === 'admin' ||
      cleanUsername === 'cfi' ||
      cleanUsername === 'dcfi'
    ) && (
      cleanPassword === 'Admin@123' ||
      cleanPassword === 'admin@123' ||
      cleanPassword === 'admin' ||
      cleanPassword === '123456' ||
      cleanPassword === '1'
    )

    if (account || isDemoAccount) {
      const accountName = account?.name || (cleanUsername === 'dcfi' ? 'Captain SM' : 'Captain Shariq Ali')
      const accountRole = account?.role || (
        /dcfi|captain sm/i.test(`${accountName} ${account?.username || ''} ${cleanUsername}`)
          ? 'DCFI'
          : 'CFI'
      )
      localStorage.setItem('adminLoggedIn', 'true')
      localStorage.setItem('adminRole', accountRole.toUpperCase())
      localStorage.setItem('adminName', accountName)
      sessionStorage.setItem('cfi_access_granted', 'true')
      localStorage.setItem('cfi_access_granted', 'true')
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