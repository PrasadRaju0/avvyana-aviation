import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

import './FlightAvailability.css'

const approverNames = {
  CFI: 'Captain Shariq',
  DCFI: 'Captain SM',
}

const exercises = [
  'CCTS (Dual)',
  'CCTS (Solo)',
  'GF (Dual)',
  'GF (Solo)',
  'X-Country (Dual)',
  'X-Country (Solo)',
  'CPL Checks',
]

function FlightAvailability() {
  const navigate = useNavigate()

  const studentId =
    localStorage.getItem('studentId') || 'AVV-0001'

  const studentName =
    localStorage.getItem('studentName') || 'Demo Student'

  const studentBatchNumber =
    localStorage.getItem('studentBatchNumber') || ''

  const selectedFlightDate =
    localStorage.getItem('selectedFlightDate') || ''

  const [availability, setAvailability] =
    useState('')

  const [unavailabilityReason, setUnavailabilityReason] =
    useState('')

  const [exercise, setExercise] =
    useState([])

  const [flyingHours, setFlyingHours] =
    useState('')

  const [error, setError] =
    useState('')

  const [submitted, setSubmitted] =
    useState(false)

  const [leaveRequestOpen, setLeaveRequestOpen] =
    useState(false)

  const [leaveFromDate, setLeaveFromDate] =
    useState('')

  const [leaveToDate, setLeaveToDate] =
    useState('')

  const [leaveReason, setLeaveReason] =
    useState('')

  const [leaveRequestRaised, setLeaveRequestRaised] =
    useState(false)

  const [isCreatingLeaveRequest, setIsCreatingLeaveRequest] =
    useState(false)

  const [leaveRequestStatus, setLeaveRequestStatus] =
    useState(null)

  const findLatestLeaveRequest = () => {
    const requests = JSON.parse(
      localStorage.getItem('leaveRequests') || '[]'
    )

    return requests
      .filter((request) => request.studentId === studentId)
      .sort((first, second) => new Date(second.requestedAt) - new Date(first.requestedAt))[0] || null
  }

  // Check if student already submitted today
  const checkDailySubmissionLimit = () => {
    const today = new Date().toISOString().split('T')[0]
    const lastSubmissionData = localStorage.getItem('lastSubmissionDate')
    
    if (lastSubmissionData) {
      const { date: lastSubmitDate, studentId: lastStudentId } = JSON.parse(lastSubmissionData)
      
      // Check if same student and same date
      if (lastStudentId === studentId && lastSubmitDate === today) {
        return true // Already submitted today
      }
    }
    return false
  }

  // Check page load for existing submissions
  useEffect(() => {
    if (checkDailySubmissionLimit()) {
      setError(
        '✓ You have already submitted your flight availability today. Submission is limited to once per day.'
      )
    }
  }, [studentId])

  useEffect(() => {
    const updateLeaveStatus = () => {
      if (isCreatingLeaveRequest) return

      const request = findLatestLeaveRequest()
      if (!request) return

      setLeaveRequestStatus(request)
      setLeaveRequestOpen(true)
      setLeaveRequestRaised(true)
      setLeaveFromDate(request.fromDate || '')
      setLeaveToDate(request.toDate || '')
      setLeaveReason(request.reason || '')
    }

    updateLeaveStatus()
    window.addEventListener('storage', updateLeaveStatus)
    window.addEventListener('focus', updateLeaveStatus)
    const statusRefresh = window.setInterval(updateLeaveStatus, 1000)

    return () => {
      window.removeEventListener('storage', updateLeaveStatus)
      window.removeEventListener('focus', updateLeaveStatus)
      window.clearInterval(statusRefresh)
    }
  }, [studentId, isCreatingLeaveRequest])

  const handleSubmit = (e) => {
    e.preventDefault()

    setError('')

    // Check daily submission limit
    if (checkDailySubmissionLimit()) {
      setError(
        '⚠️ You have already submitted your flight availability today. You can submit again tomorrow.'
      )
      return
    }

    if (!availability) {
      setError(
        'Please select your flying availability.'
      )
      return
    }

    if (
      availability === 'available' &&
      exercise.length === 0
    ) {
      setError(
        'Please select an exercise.'
      )
      return
    }

    if (
      availability === 'not-available' &&
      !unavailabilityReason.trim()
    ) {
      setError(
        'Please enter a reason for your unavailability.'
      )
      return
    }

    if (flyingHours === '') {
      setError(
        'Please enter your total flying hours.'
      )
      return
    }

    if (Number(flyingHours) < 0) {
      setError(
        'Flying hours cannot be negative.'
      )
      return
    }

    const submission = {
      studentId,

      studentName,

      studentBatchNumber,

      flightDate: selectedFlightDate,

      availability,

      exercise:
        availability === 'available'
          ? exercise.join(', ')
          : 'Not Applicable',

      unavailabilityReason:
        availability === 'not-available'
          ? unavailabilityReason.trim()
          : '',

      totalFlyingHours:
        Number(flyingHours),

      submittedAt:
        new Date().toISOString(),
    }

    const previousSubmissions = JSON.parse(
      localStorage.getItem('flightSubmissions') || '[]'
    )

    localStorage.setItem(
      'flightSubmissions',
      JSON.stringify([...previousSubmissions, submission])
    )

    localStorage.setItem(
      'flightSubmission',
      JSON.stringify(submission)
    )

    // Store the submission date and student ID for daily limit check
    const today = new Date().toISOString().split('T')[0]
    localStorage.setItem(
      'lastSubmissionDate',
      JSON.stringify({
        date: today,
        studentId: studentId,
        submittedAt: new Date().toISOString(),
      })
    )

    setSubmitted(true)
  }

  const handleLeaveRequest = () => {
    if (!leaveFromDate || !leaveToDate || !leaveReason.trim()) {
      setError('Please select both leave dates and enter a reason for your leave request.')
      return
    }

    if (leaveToDate < leaveFromDate) {
      setError('Leave end date cannot be before the leave start date.')
      return
    }

    const leaveRequest = {
      studentId,
      studentName,
      studentBatchNumber,
      fromDate: leaveFromDate,
      toDate: leaveToDate,
      reason: leaveReason.trim(),
      status: 'Pending approval',
      requestedAt: new Date().toISOString(),
    }

    const previousRequests = JSON.parse(
      localStorage.getItem('leaveRequests') || '[]'
    )

    localStorage.setItem(
      'leaveRequests',
      JSON.stringify([...previousRequests, leaveRequest])
    )

    setError('')
    setLeaveRequestStatus(leaveRequest)
    setIsCreatingLeaveRequest(false)
    setLeaveRequestRaised(true)
  }

  const handleLogout = () => {
    localStorage.removeItem(
      'studentLoggedIn'
    )

    localStorage.removeItem(
      'studentId'
    )

    navigate('/')
  }

  if (submitted) {
    return (
      <main className="flight-page">

        <div className="flight-background"></div>
        <div className="flight-overlay"></div>

        <header className="flight-header">

          <div className="academy-brand">
            <div className="brand-small">
              AVVYANA
            </div>

            <div className="brand-main">
              AVIATION ACADEMY
            </div>
          </div>

          <div className="student-badge">
            <span>STUDENT</span>
            <strong>{studentId}</strong>
          </div>

        </header>

        <section className="success-wrapper">

          <div className="success-card">

            <div className="success-icon">
              ✓
            </div>

            <div className="success-label">
              SUBMISSION CONFIRMED
            </div>

            <h1>
              Availability submitted.
            </h1>

            <p>
              Your flying availability has
              been successfully recorded.
            </p>

            <div className="submission-summary">

              <div className="summary-item">
                <span>
                  STUDENT ID
                </span>

                <strong>
                  {studentId}
                </strong>
              </div>

              <div className="summary-item">
                <span>
                  FLYING STATUS
                </span>

                <strong>
                  {availability === 'available'
                    ? '😊 Available for Flying'
                    : availability === 'seventh-day'
                      ? '7️⃣ 7th Day'
                    : '😢 Not Available'}
                </strong>
              </div>

              {availability ===
                'available' && (
                <div className="summary-item">
                  <span>
                    EXERCISE
                  </span>

                  <strong>
                    {exercise.join(', ')}
                  </strong>
                </div>
              )}

              {availability === 'not-available' && (
                <div className="summary-item">
                  <span>REASON</span>
                  <strong>{unavailabilityReason}</strong>
                </div>
              )}

              <div className="summary-item">
                <span>
                  TOTAL FLYING HOURS
                </span>

                <strong>
                  {flyingHours} hrs
                </strong>
              </div>

            </div>

            <button
              className="logout-button"
              onClick={handleLogout}
            >
              LOG OUT
            </button>

          </div>

        </section>

      </main>
    )
  }

  return (
    <main className="flight-page">

      <div className="flight-background"></div>
      <div className="flight-overlay"></div>

      {/* HEADER */}

      <header className="flight-header">

        <div className="academy-brand">

          <div className="brand-small">
            AVVYANA
          </div>

          <div className="brand-main">
            AVIATION ACADEMY
          </div>

        </div>

        <div className="student-badge">

          <span>STUDENT</span>

          <strong>
            {studentId}
          </strong>

        </div>

      </header>

      {/* MAIN CONTENT */}

      <section className="availability-wrapper">

        <div className="availability-card">

          {/* TITLE */}

          <div className="availability-heading">

            <div className="section-label">
              FLIGHT OPERATIONS
            </div>

            <h1>
              Flight Availability
            </h1>

            <p>
              Please submit your availability
              and training requirement for the
              upcoming flying schedule.
            </p>

            {selectedFlightDate && (
              <div className="selected-flight-date">
                FLIGHT DATE: {new Date(`${selectedFlightDate}T00:00:00`).toLocaleDateString()}
              </div>
            )}

            {leaveRequestStatus && (
              <div className={`leave-status-banner ${leaveRequestStatus.status.toLowerCase().replace(' ', '-')}`}>
                <strong>LEAVE REQUEST: {leaveRequestStatus.status.toUpperCase()}</strong>
                <span>
                  {leaveRequestStatus.status === 'Approved'
                    ? `Approved by ${leaveRequestStatus.reviewedBy || approverNames[leaveRequestStatus.reviewedRole] || 'the admin'}.`
                    : leaveRequestStatus.status === 'Rejected'
                      ? `Rejected by ${leaveRequestStatus.reviewedBy || approverNames[leaveRequestStatus.reviewedRole] || 'the admin'}.${leaveRequestStatus.rejectionReason ? ` Reason: ${leaveRequestStatus.rejectionReason}` : ''}`
                      : 'Your leave request is waiting for admin approval.'}
                </span>
              </div>
            )}

          </div>

          <form
            onSubmit={handleSubmit}
            className="availability-form"
          >

            {/* AVAILABILITY */}

            <div className="form-section">

              <div className="form-section-title">
                01
                <span>
                  YOUR AVAILABILITY
                </span>
              </div>

              <div className="availability-options">

                <button
                  type="button"
                  className={`availability-option ${
                    availability ===
                    'available'
                      ? 'selected available'
                      : ''
                  }`}
                  onClick={() => {
                    setAvailability(
                      'available'
                    )
                    setUnavailabilityReason('')
                    setError('')
                  }}
                >
                  <span className="option-icon">
                    😊
                  </span>

                  <span className="option-content">

                    <strong>
                      Available for Flying
                    </strong>

                    <small>
                      I am available for
                      flight training.
                    </small>

                  </span>

                  <span className="option-radio">
                    {availability ===
                    'available'
                      ? '●'
                      : '○'}
                  </span>

                </button>

                <button
                  type="button"
                  className={`availability-option ${
                    availability ===
                    'not-available'
                      ? 'selected unavailable'
                      : ''
                  }`}
                  onClick={() => {
                    setAvailability(
                      'not-available'
                    )

                    setExercise([])

                    setError('')
                  }}
                >
                  <span className="option-icon">
                    😢
                  </span>

                  <span className="option-content">

                    <strong>
                      Not Available
                    </strong>

                    <small>
                      I am not available for
                      flight training.
                    </small>

                  </span>

                  <span className="option-radio">
                    {availability ===
                    'not-available'
                      ? '●'
                      : '○'}
                  </span>

                </button>

                <button
                  type="button"
                  className={`availability-option ${
                    availability === 'seventh-day'
                      ? 'selected seventh-day'
                      : ''
                  }`}
                  onClick={() => {
                    setAvailability('seventh-day')
                    setExercise([])
                    setUnavailabilityReason('')
                    setError('')
                  }}
                >
                  <span className="option-icon">7</span>

                  <span className="option-content">
                    <strong>7th Day</strong>
                    <small>Due to 7th day, I am not available.</small>
                  </span>

                  <span className="option-radio">
                    {availability === 'seventh-day' ? '●' : '○'}
                  </span>
                </button>

              </div>

            </div>

            {availability === 'not-available' && (
              <div className="form-section">
                <div className="form-section-title">
                  02
                  <span>REASON FOR UNAVAILABILITY</span>
                </div>

                <div className="reason-box">
                  <textarea
                    placeholder="Enter the reason you are unavailable for flying"
                    value={unavailabilityReason}
                    onChange={(e) => {
                      setUnavailabilityReason(e.target.value)
                      setError('')
                    }}
                    rows="4"
                  />
                </div>
              </div>
            )}

            {/* EXERCISE */}

            {availability ===
              'available' && (
              <div className="form-section">

                <div className="form-section-title">
                  02
                  <span>
                    SELECT EXERCISE
                  </span>
                </div>

                <div className="exercise-grid">

                  {exercises.map(
                    (item) => (
                      <button
                        type="button"
                        key={item}
                        className={`exercise-option ${
                          exercise.includes(item)
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() => {
                          setExercise((selectedExercises) =>
                            selectedExercises.includes(item)
                              ? selectedExercises.filter(
                                (selectedItem) => selectedItem !== item
                              )
                              : [...selectedExercises, item]
                          )
                          setError('')
                        }}
                      >
                        <span className="exercise-check">
                          {exercise.includes(item)
                            ? '✓'
                            : ''}
                        </span>

                        <span>
                          {item}
                        </span>

                      </button>
                    )
                  )}

                </div>

              </div>
            )}

            {/* TOTAL FLYING HOURS */}

            <div className="form-section">

              <div className="form-section-title">
                {availability ===
                'available'
                  ? '03'
                  : availability === 'not-available'
                    ? '03'
                    : '02'}

                <span>
                  TOTAL FLYING HOURS
                </span>
              </div>

              <div className="hours-box">

                <div className="hours-input-wrapper">

                  <input
                    type="number"
                    min="0"
                    step="0.1"
                    placeholder="Enter total flying hours"
                    value={flyingHours}
                    onChange={(e) => {
                      setFlyingHours(
                        e.target.value
                      )
                      setError('')
                    }}
                  />

                  <span>
                    HOURS
                  </span>

                </div>

                <p>
                  Enter your current total
                  flying hours. Example:
                  125.5
                </p>

              </div>

            </div>

            {/* ERROR */}

            {error && (
              <div className="flight-error">
                {error}
              </div>
            )}

            {/* SUBMIT */}

            <button
              type="submit"
              className="availability-submit"
            >
              <span>
                SUBMIT AVAILABILITY
              </span>

              <span className="submit-arrow">
                →
              </span>
            </button>

            <div className="form-section leave-request-section">

              <div className="form-section-title">
                04
                <span>LEAVE REQUEST</span>
              </div>

              <button
                type="button"
                className="leave-request-trigger"
                onClick={() => navigate('/leave-request')}
              >
                <span>
                  <strong>Open leave request page</strong>
                  <small>Submit leave dates and reason, then track admin approval.</small>
                </span>
                <span className="submit-arrow">→</span>
              </button>

            </div>

          </form>

          <div className="availability-footer">
            <span>
              Avvyana Aviation Academy
            </span>

            <span>
              •
            </span>

            <span>
              Flight Training Portal
            </span>
          </div>

        </div>

      </section>

    </main>
  )
}

export default FlightAvailability