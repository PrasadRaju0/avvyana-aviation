import { useState } from 'react'
import { Route, Routes, useNavigate } from 'react-router-dom'
import FlightAvailability from './FlightAvailability'
import LeaveRequest from './LeaveRequest'
import Dashboard from './Dashboard'
import AdminLeaveRequests from './AdminLeaveRequests'
import './App.css'

function LoginPage() {
  const navigate = useNavigate()

  const [studentId, setStudentId] = useState('')
  const [password, setPassword] = useState('')
  const [flightDate, setFlightDate] = useState(() => {
    const today = new Date()
    return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
  })
  const [error, setError] = useState('')

  const handleLogin = (e) => {
    e.preventDefault()
    setError('')

    const accounts = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
    const account = accounts.find(
      (item) => item.splNumber === studentId.trim() && item.password === password
    )

    if ((studentId === 'AVV-0001' && password === '123456') || account) {
      localStorage.setItem('studentLoggedIn', 'true')
      localStorage.setItem('studentId', studentId)
      localStorage.setItem('studentName', account?.name || 'Demo Student')
      localStorage.setItem('studentBatchNumber', account?.batchNumber || '')
      localStorage.setItem('selectedFlightDate', flightDate)

      navigate('/flight-availability')
      return
    }

    setError('Invalid SPL Number or Password')
  }

  return (
    <div className="login-page">
      <marquee className="login-marquee" behavior="scroll" direction="left" scrollamount="8">
        <span className="marquee-saffron">India's only</span>{' '}
        <span className="marquee-white">A-Rated</span>{' '}
        <span className="marquee-green">Flying Training Academy</span>
      </marquee>
      <div className="login-hero">
        <div className="hero-overlay"></div>

        <div className="hero-content">
          <div className="brand-mark">AVVYANA</div>
          <div className="brand-subtitle">AVIATION ACADEMY</div>
          <div className="hero-line"></div>

          <h1 className="hero-title">
            <span>Flight Training</span>
            <span>Starts Here</span>
          </h1>

          <p className="hero-description">
            Professional flight training for the next generation of exceptional pilots.
          </p>

        </div>

        <div className="hero-footer">© 2026 Avvyana Aviation Academy</div>
      </div>

      <div className="login-panel">
        <div className="login-box">
          <div className="mobile-logo">AVVYANA</div>

          <div className="welcome">
            <span>STUDENT PORTAL</span>
            <h2>Welcome back.</h2>
            <p>Sign in to access your flight training dashboard.</p>
          </div>

          <form onSubmit={handleLogin}>
            <div className="form-group">
              <label>SPL NUMBER</label>
              <input
                type="text"
                placeholder="Enter your SPL Number"
                value={studentId}
                onChange={(e) => setStudentId(e.target.value)}
                autoComplete="username"
              />
            </div>

            <div className="form-group">
              <label>PASSWORD</label>
              <input
                type="password"
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

          {/* <div className="demo-info">
            <div>
              <span>Demo SPL Number</span>
              <strong>AVV-0001</strong>
            </div>

            <div>
              <span>Demo Password</span>
              <strong>123456</strong>
            </div>
          </div> */}

          <div className="support">
            <span>Need assistance?</span>
            <a href="mailto:support@avvyana.com">Contact Academy Support</a>
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

  const handleSignup = (e) => {
    e.preventDefault()
    const accounts = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
    const normalizedSpl = form.splNumber.trim()
    if (accounts.some((item) => item.splNumber === normalizedSpl)) {
      setError('An account with this SPL Number already exists.')
      return
    }
    accounts.push({ ...form, name: form.name.trim(), splNumber: normalizedSpl, batchNumber: form.batchNumber.trim(), mobileNumber: form.mobileNumber.trim(), email: form.email.trim().toLowerCase() })
    localStorage.setItem('studentAccounts', JSON.stringify(accounts))
    setIsSubmitted(true)
    
    // Auto-redirect after 5 seconds
    setTimeout(() => {
      navigate('/')
    }, 5000)
  }

  // Thank you confirmation page
  if (isSubmitted) {
    return (
      <main className="signup-success-page">
        <div className="signup-success-container">
          <div className="success-icon">✓</div>
          <h1>Account Created Successfully!</h1>
          <p className="success-message">Thank you for joining AVVYANA Aviation Academy!</p>
          
          <div className="account-details">
            <div className="detail-row">
              <span>SPL NUMBER</span>
              <strong>{form.splNumber}</strong>
            </div>
            <div className="detail-row">
              <span>NAME</span>
              <strong>{form.name}</strong>
            </div>
            <div className="detail-row">
              <span>BATCH NUMBER</span>
              <strong>{form.batchNumber || '-'}</strong>
            </div>
          </div>

          <p className="redirect-message">Redirecting to login page in 5 seconds...</p>

          <button 
            className="btn-login-now"
            onClick={() => navigate('/')}
          >
            GO TO LOGIN
          </button>
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

  const handleReset = async (e) => {
    e.preventDefault()
    const accounts = JSON.parse(localStorage.getItem('studentAccounts') || '[]')
    const index = accounts.findIndex((item) => item.splNumber === form.splNumber.trim() && item.email?.toLowerCase() === form.email.trim().toLowerCase())
    if (index === -1) return setError('No student account matches that SPL Number and email.')

    try {
      if (!otpSent) {
        const response = await fetch('/api/send-email-otp', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email }),
        })
        const result = await response.json()
        if (!response.ok) return setError(result.error || 'Unable to send OTP.')
        setOtpSent(true)
        setError('OTP sent to your email address. Enter it below.')
        return
      }

      const verifyResponse = await fetch('/api/verify-email-otp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: form.email, otp: form.otp }),
      })
      const verifyResult = await verifyResponse.json()
      if (!verifyResponse.ok) return setError(verifyResult.error || 'Invalid OTP.')
    } catch {
      return setError('Unable to contact the SMS service. Please start the OTP server.')
    }
    if (form.password.length < 6) return setError('Password must be at least 6 characters.')
    if (form.password !== form.confirmPassword) return setError('Passwords do not match.')
    accounts[index].password = form.password
    localStorage.setItem('studentAccounts', JSON.stringify(accounts))
    navigate('/', { state: { message: 'Password updated. Sign in with your new password.' } })
  }

  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })

  return (
    <main className="admin-page"><div className="admin-card">
      <div className="brand-mark">AVVYANA</div><div className="brand-subtitle">AVIATION ACADEMY</div>
      <span className="admin-label">STUDENT PORTAL</span><h1>Reset student password</h1>
      <p>Verify your SPL Number and email, then enter the OTP sent by email.</p>
      <form onSubmit={handleReset}>
        <div className="admin-form-group"><label>SPL NUMBER *</label><input value={form.splNumber} onChange={update('splNumber')} required /></div>
        <div className="admin-form-group"><label>EMAIL *</label><input type="email" value={form.email} onChange={update('email')} required /></div>
        {otpSent && <div className="otp-notice">OTP sent to your email address. Enter OTP to continue.</div>}
        {otpSent && <div className="admin-form-group"><label>ENTER OTP *</label><input inputMode="numeric" maxLength="6" value={form.otp} onChange={update('otp')} required /></div>}
        <div className="admin-form-group"><label>NEW PASSWORD *</label><input type="password" value={form.password} onChange={update('password')} required={otpSent} /></div>
        <div className="admin-form-group"><label>CONFIRM PASSWORD *</label><input type="password" value={form.confirmPassword} onChange={update('confirmPassword')} required={otpSent} /></div>
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="admin-back-button">{otpSent ? 'UPDATE PASSWORD' : 'SEND OTP'}</button>
      </form>
      <button type="button" className="admin-return-button" onClick={() => navigate('/')}>BACK TO LOGIN</button>
    </div></main>
  )
}

function StudentAccountForm({ title, submitLabel, form, setForm, error, onSubmit, onBack, reset = false }) {
  const update = (field) => (e) => setForm({ ...form, [field]: e.target.value })
  return (
    <main className="admin-page"><div className="admin-card">
      <div className="brand-mark">AVVYANA</div><div className="brand-subtitle">AVIATION ACADEMY</div>
      <span className="admin-label">STUDENT PORTAL</span><h1>{title}</h1>
      <form onSubmit={onSubmit}>
        {!reset && <div className="admin-form-group"><label>NAME *</label><input value={form.name} onChange={update('name')} required /></div>}
        <div className="admin-form-group"><label>SPL NUMBER *</label><input value={form.splNumber} onChange={update('splNumber')} required /></div>
        {!reset && <div className="admin-form-group"><label>BATCH NUMBER *</label><input value={form.batchNumber} onChange={update('batchNumber')} required /></div>}
        <div className="admin-form-group"><label>MOBILE NUMBER *</label><input type="tel" inputMode="tel" value={form.mobileNumber} onChange={update('mobileNumber')} required /></div>
        {!reset && <div className="admin-form-group"><label>EMAIL *</label><input type="email" value={form.email} onChange={update('email')} required /></div>}
        <div className="admin-form-group"><label>{reset ? 'NEW PASSWORD *' : 'PASSWORD *'}</label><input type="password" value={form.password} onChange={update('password')} required /></div>
        {reset && <div className="admin-form-group"><label>CONFIRM PASSWORD *</label><input type="password" value={form.confirmPassword} onChange={update('confirmPassword')} required /></div>}
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="admin-back-button">{submitLabel}</button>
      </form>
      <button type="button" className="admin-return-button" onClick={onBack}>BACK TO LOGIN</button>
    </div></main>
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
    return <Dashboard />
  }

  return (
    <main className="admin-page">
      <div className="admin-card">
        <div className="brand-mark">AVVYANA</div>
        <div className="brand-subtitle">AVIATION ACADEMY</div>
        <span className="admin-label">ADMIN PORTAL</span>
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
      <div className="brand-mark">AVVYANA</div><div className="brand-subtitle">AVIATION ACADEMY</div>
      <span className="admin-label">ADMIN PORTAL</span><h1>{title}</h1>
      <form onSubmit={onSubmit}>
        {!reset && <div className="admin-form-group"><label>FULL NAME</label><input value={form.name} onChange={update('name')} required /></div>}
        <div className="admin-form-group"><label>USERNAME</label><input value={form.username} onChange={update('username')} required /></div>
        <div className="admin-form-group"><label>EMAIL</label><input type="email" value={form.email} onChange={update('email')} required /></div>
        {!reset && <div className="admin-form-group"><label>ROLE</label><select value={form.role} onChange={update('role')} required><option value="CFI">CFI</option><option value="DCFI">DCFI</option></select></div>}
        <div className="admin-form-group"><label>{reset ? 'NEW PASSWORD' : 'PASSWORD'}</label><input type="password" value={form.password} onChange={update('password')} required /></div>
        {reset && <div className="admin-form-group"><label>CONFIRM PASSWORD</label><input type="password" value={form.confirmPassword} onChange={update('confirmPassword')} required /></div>}
        {error && <div className="login-error">{error}</div>}
        <button type="submit" className="admin-back-button">{submitLabel}</button>
      </form>
      <button type="button" className="admin-return-button" onClick={onBack}>BACK TO ADMIN SIGN IN</button>
    </div></main>
  )
}

function App() {
  return (
    <Routes>
      <Route path="/" element={<LoginPage />} />
      <Route path="/signup" element={<SignupPage />} />
      <Route path="/forgot-password" element={<ForgotPasswordPage />} />
      <Route path="/admin" element={<AdminPage />} />
      <Route path="/admin/leave-requests" element={<AdminLeaveRequests />} />
      <Route path="/admin/signup" element={<AdminSignupPage />} />
      <Route path="/admin/forgot-password" element={<AdminForgotPasswordPage />} />
      <Route path="/flight-availability" element={<FlightAvailability />} />
      <Route path="/leave-request" element={<LeaveRequest />} />
    </Routes>
  )
}

export default App