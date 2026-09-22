import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from './lib/supabase'

import './FlightAvailability.css'

const approverNames = {
  CFI: 'Captain Shariq',
  DCFI: 'Captain SM',
}

const singleEngineExercises = [
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
]

const multiEngineExercises = [
  'Multi Fam',
  'Multi GF',
  'Multi CCTS',
  'Multi IF',
  'Multi Night',
  'Multi Checks',
]

function getLeaveProgress(request) {
  const closureCompleted = Boolean(request.returnReportedAt || request.closureClosedAt)

  if (request.status === 'Rejected') {
    return [
      { label: 'Leave raised', state: 'complete' },
      { label: 'Pending with CFI/DCFI', state: 'rejected' },
      { label: 'Leave closure', state: 'locked' },
    ]
  }

  if (request.status === 'Approved') {
    return [
      { label: 'Leave raised', state: 'complete' },
      { label: 'Pending with CFI/DCFI', state: 'complete' },
      { label: 'Leave closure', state: closureCompleted ? 'complete' : 'active' },
    ]
  }

  return [
    { label: 'Leave raised', state: 'complete' },
    { label: 'Pending with CFI/DCFI', state: 'active' },
    { label: 'Leave closure', state: 'upcoming' },
  ]
}

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

  const [aircraftType, setAircraftType] =
    useState('')

  const [unavailabilityReason, setUnavailabilityReason] =
    useState('')

  const [exercise, setExercise] =
    useState([])

  const [flyingHours, setFlyingHours] =
    useState('')

  const [error, setError] =
    useState('')

  const [centerNotice, setCenterNotice] =
    useState('')

  const [queuedExercises, setQueuedExercises] =
    useState([])

  useEffect(() => {
    if (!centerNotice) return undefined

    const timeoutId = window.setTimeout(() => {
      setCenterNotice('')
    }, 2000)

    return () => window.clearTimeout(timeoutId)
  }, [centerNotice])

  useEffect(() => {
    let isMounted = true

    const loadQueue = async () => {
      const queueResult = await supabase
        .from('flight_submissions')
        .select('student_id, exercise, submitted_at, queue_status, queue_started_at')
        .eq('queue_status', 'queued')

      if (queueResult.error) {
        // Older databases do not have the queue migration yet.
        setQueuedExercises([])
        return
      }

      const { data } = queueResult
      if (!isMounted || !data) return

      const queueRows = data
        .flatMap((submission) => (submission.exercise || '')
          .split(',')
          .map((exerciseName) => ({
            studentId: submission.student_id,
            exercise: exerciseName.trim(),
            queuedAt: submission.queue_started_at || submission.submitted_at,
          })))
        .filter((row) => row.exercise)
        .sort((first, second) => new Date(first.queuedAt || 0) - new Date(second.queuedAt || 0))

      setQueuedExercises(queueRows
        .filter((row) => row.studentId === studentId)
        .map((row) => ({
          exercise: row.exercise,
          position: queueRows.filter((candidate) => candidate.exercise === row.exercise
            && new Date(candidate.queuedAt || 0) <= new Date(row.queuedAt || 0)).length,
        })))
    }

    loadQueue()
    const queueRefresh = window.setInterval(loadQueue, 5000)
    window.addEventListener('focus', loadQueue)

    return () => {
      isMounted = false
      window.clearInterval(queueRefresh)
      window.removeEventListener('focus', loadQueue)
    }
  }, [studentId])

  const getQueueEntry = (exerciseName) => queuedExercises.find(
    (entry) => entry.exercise === exerciseName
  )

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

  const getStoredSubmissions = () => {
    const savedSubmissions = JSON.parse(
      localStorage.getItem('flightSubmissions') || '[]'
    )
    const legacySubmission = JSON.parse(
      localStorage.getItem('flightSubmission') || 'null'
    )

    return savedSubmissions.length > 0
      ? savedSubmissions
      : legacySubmission
        ? [legacySubmission]
        : []
  }

  const checkDateSubmissionLimit = (selectedExercises = []) => {
    if (!selectedFlightDate) return false

    return getStoredSubmissions().some((submission) => {
      const submissionDate = submission.flightDate ||
        (submission.submittedAt ? submission.submittedAt.slice(0, 10) : '')

      if (submission.studentId !== studentId || submissionDate !== selectedFlightDate) return false
      if (submission.availability !== 'available') return true

      const existingExercises = (submission.exercise || '')
        .split(',')
        .map((item) => item.trim())
        .filter(Boolean)
      return selectedExercises.some((item) => existingExercises.includes(item))
    })
  }

  // Check page load for existing submissions for the selected flight date
  useEffect(() => {
    if (checkDateSubmissionLimit()) {
      setError(
        '✓ You have already submitted your flight availability for this selected flight date. Choose another date to submit again.'
      )
    }
  }, [selectedFlightDate, studentId])

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

  const handleSubmit = async (e) => {
    e.preventDefault()

    setError('')

    if (availability === 'available' && exercise.some((item) => getQueueEntry(item))) {
      setError('A selected exercise is already in your queue. Wait until admin completes it before submitting it again.')
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
      !aircraftType
    ) {
      setError(
        'Please select whether you are flying Single-Engine (PA-28) or Multi Engine (DA42).'
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

    if (checkDateSubmissionLimit(availability === 'available' ? exercise : [])) {
      setError(
        availability === 'available'
          ? 'You already submitted one of these exercises for this date. Choose another exercise.'
          : 'You already submitted your availability for this date. Choose another date.'
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

      aircraftType:
        availability === 'available'
          ? aircraftType
          : 'Not Applicable',

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

    try {
      const { data: savedSubmission, error: submissionError } = await supabase
        .from('flight_submissions')
        .insert({
          student_id: submission.studentId,
          student_name: submission.studentName,
          flight_date: submission.flightDate,
          availability: submission.availability,
          aircraft_type: submission.aircraftType,
          exercise: submission.exercise,
          unavailability_reason: submission.unavailabilityReason,
          total_flying_hours: submission.totalFlyingHours,
          submitted_at: submission.submittedAt,
        })
        .select('id')
        .single()

      if (submissionError || !savedSubmission) {
        throw submissionError || new Error('Supabase did not return the saved submission.')
      }
    } catch (submissionError) {
      setError(`Unable to save flight availability: ${submissionError.message}`)
      return
    }

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

          <button type="button" className="academy-brand academy-brand-button" onClick={() => navigate('/')} aria-label="Go to home page">
            <div className="brand-small">
              Avyanna
            </div>

            <div className="brand-main">
              AVIATION ACADEMY
            </div>
          </button>

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

              {availability === 'available' && (
                <div className="summary-item">
                  <span>
                    AIRCRAFT TYPE
                  </span>

                  <strong>
                    {aircraftType === 'single-engine'
                      ? 'Single-Engine (PA-28)'
                      : 'Multi Engine (DA42)'}
                  </strong>
                </div>
              )}

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

            <div className="summary-actions-row" style={{ display: 'flex', gap: '12px', marginTop: '24px' }}>
              <button
                type="button"
                className="leave-premium-back-btn"
                onClick={() => navigate('/dashboard')}
                style={{ flex: 1, justifyContent: 'center', margin: 0 }}
              >
                ← RETURN TO DASHBOARD
              </button>
              <button
                className="logout-button"
                onClick={handleLogout}
                style={{ width: 'auto', padding: '0 24px' }}
              >
                LOG OUT
              </button>
            </div>

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

        <button type="button" className="academy-brand academy-brand-button" onClick={() => navigate('/')} aria-label="Go to home page">

          <div className="brand-small">
            Avyanna
          </div>

          <div className="brand-main">
            AVIATION ACADEMY
          </div>

        </button>

        <div className="student-badge">

          <span>STUDENT</span>

          <strong>
            {studentId}
          </strong>

        </div>

      </header>

      {/* MAIN CONTENT */}

      <section className="availability-wrapper">

        {centerNotice && (
          <div className="flight-center-notice">
            {centerNotice}
          </div>
        )}

        <div className="availability-card">
          <button type="button" className="leave-premium-back-btn" onClick={() => navigate('/dashboard')} style={{ marginBottom: '20px' }}>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2.5" style={{ width: '14px', height: '14px' }}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10 19l-7-7m0 0l7-7m-7 7h18" />
            </svg>
            <span>Back to Dashboard</span>
          </button>

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

            {queuedExercises.length > 0 && (
              <div className="queue-notification" role="status" aria-live="polite">
                <div className="queue-notification-heading">
                  <span className="queue-notification-dot" aria-hidden="true"></span>
                  <strong>ACTIVE QUEUE</strong>
                  <span className="queue-notification-live">LIVE</span>
                </div>
                <p>Your place updates automatically as students ahead complete training.</p>
                <div className="queue-notification-list">
                  {queuedExercises.map((queueEntry) => (
                    <div className="queue-notification-item" key={queueEntry.exercise}>
                      <span className="queue-notification-exercise">{queueEntry.exercise}</span>
                      <strong className="queue-notification-position">
                        {queueEntry.position === 1
                          ? 'Next up'
                          : `#${queueEntry.position}`}
                      </strong>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {leaveRequestStatus && (
              <>
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

              </>
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
                    <strong>😴 7th Day</strong>
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

            {/* AIRCRAFT TYPE */}

            {availability ===
              'available' && (
              <div className="form-section">

                <div className="form-section-title">
                  02
                  <span>
                    SELECT AIRCRAFT TYPE
                  </span>
                </div>

                <div className="availability-options">

                  <button
                    type="button"
                    className={`availability-option ${
                      aircraftType === 'single-engine'
                        ? 'selected available'
                        : ''
                    }`}
                    onClick={() => {
                      setAircraftType('single-engine')
                      setExercise([])
                      setCenterNotice('')
                      setError('')
                    }}
                  >
                    <span className="option-icon">
                      ✈
                    </span>

                    <span className="option-content">
                      <strong>
                        Single-Engine (PA-28)
                      </strong>
                      <small>
                        Choose this for PA-28 flying availability.
                      </small>
                    </span>

                    <span className="option-radio">
                      {aircraftType === 'single-engine' ? '●' : '○'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`availability-option ${
                      aircraftType === 'multi-engine'
                        ? 'selected available'
                        : ''
                    }`}
                    onClick={() => {
                      setAircraftType('multi-engine')
                      setExercise([])
                      setCenterNotice('Broooo Multiiii 😱')
                      setError('')
                    }}
                  >
                    <span className="option-icon">
                      ✈
                    </span>

                    <span className="option-content">
                      <strong>
                        Multi Engine (DA42)
                      </strong>
                      <small>
                        Choose this for DA42 flying availability.
                      </small>
                    </span>

                    <span className="option-radio">
                      {aircraftType === 'multi-engine' ? '●' : '○'}
                    </span>
                  </button>

                </div>

              </div>
            )}

            {/* EXERCISE */}

            {availability ===
              'available' && aircraftType && (
              <div className="form-section">

                <div className="form-section-title">
                  03
                  <span>
                    SELECT EXERCISE
                  </span>
                </div>

                <div className="exercise-grid">

                  {(aircraftType === 'multi-engine'
                    ? multiEngineExercises
                    : singleEngineExercises
                  ).map((item) => (
                      (() => {
                        const queueEntry = getQueueEntry(item)

                        return (
                      <button
                        type="button"
                        key={item}
                        disabled={Boolean(queueEntry)}
                        className={`exercise-option ${
                          exercise.includes(item) || queueEntry
                            ? 'selected'
                            : ''
                        }`}
                        onClick={() => {
                          if (queueEntry) return

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
                          {queueEntry && (
                            <small className="queue-position">
                              {queueEntry.position === 1
                                ? 'Next you..Be Ready!!!!'
                                : `Queue position: ${queueEntry.position}`}
                            </small>
                          )}
                        </span>

                      </button>
                        )
                      })()
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
                  ? '04'
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
          </form>

          <div className="availability-footer">
            <span>
              Avyanna Aviation Academy
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