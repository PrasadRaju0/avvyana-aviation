import { useEffect, useState } from 'react'
import './SplashScreen.css'

export default function SplashScreen({ isFirstVisit, onFinish }) {
  const [isExiting, setIsExiting] = useState(false)

  useEffect(() => {
    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    const reducedMotion = mediaQuery.matches

    if (reducedMotion) {
      onFinish?.()
      return undefined
    }

    const exitTimer = window.setTimeout(() => {
      setIsExiting(true)
    }, 3200)

    const finishTimer = window.setTimeout(() => {
      onFinish?.()
    }, 4200)

    return () => {
      window.clearTimeout(exitTimer)
      window.clearTimeout(finishTimer)
    }
  }, [onFinish])

  if (!isFirstVisit) {
    return (
      <div className={`splash-screen reload-splash ${isExiting ? 'is-exiting' : ''}`} aria-live="polite">
        <div className="reload-wrapper">
          <div className="reload-glow-ring" />
          <div className="reload-loader" aria-label="Loading">
            <div className="reload-logo-backdrop" />
            <img src="/avyanna-mark.svg" alt="AAA Logo" className="reload-logo-center" />
            <div className="reload-aircraft-orbit" aria-hidden="true">
              <span className="reload-aircraft-char">✈</span>
              <svg className="reload-tail-dots-svg" viewBox="0 0 100 100">
                {/* Radius is 38.5, center is (50, 50). Aircraft sits around angle 80°-90° (top). Tail center is at ~68°. Dots trail backwards around circle with radiant aviation blue gradient */}
                <circle cx="36.5" cy="14.2" r="2.3" fill="#0284c7" opacity="0.95" />
                <circle cx="33.0" cy="15.8" r="2.2" fill="#0ea5e9" opacity="0.90" />
                <circle cx="29.6" cy="17.9" r="2.1" fill="#38bdf8" opacity="0.85" />
                <circle cx="26.3" cy="20.3" r="2.0" fill="#0284c7" opacity="0.80" />
                <circle cx="23.3" cy="23.1" r="1.9" fill="#0369a1" opacity="0.75" />
                <circle cx="20.5" cy="26.3" r="1.8" fill="#0284c7" opacity="0.70" />
                <circle cx="18.0" cy="29.8" r="1.7" fill="#0ea5e9" opacity="0.65" />
                <circle cx="15.9" cy="33.6" r="1.6" fill="#38bdf8" opacity="0.60" />
                <circle cx="14.1" cy="37.6" r="1.5" fill="#0284c7" opacity="0.55" />
                <circle cx="12.7" cy="41.9" r="1.4" fill="#0369a1" opacity="0.50" />
                <circle cx="11.8" cy="46.3" r="1.3" fill="#075985" opacity="0.45" />
                <circle cx="11.5" cy="50.8" r="1.2" fill="#0c4a6e" opacity="0.40" />
                <circle cx="11.6" cy="55.3" r="1.1" fill="#172554" opacity="0.35" />
                <circle cx="12.3" cy="59.8" r="1.1" fill="#172554" opacity="0.30" />
                <circle cx="13.4" cy="64.2" r="1.0" fill="#172554" opacity="0.25" />
                <circle cx="15.0" cy="68.4" r="1.0" fill="#172554" opacity="0.20" />
                <circle cx="17.1" cy="72.4" r="0.9" fill="#172554" opacity="0.16" />
                <circle cx="19.6" cy="76.1" r="0.9" fill="#172554" opacity="0.12" />
                <circle cx="22.5" cy="79.4" r="0.8" fill="#172554" opacity="0.08" />
                <circle cx="25.8" cy="82.3" r="0.8" fill="#172554" opacity="0.05" />
              </svg>
            </div>
          </div>
          <div className="reload-status-text">
            <span>INITIALIZING FLIGHT SYSTEMS</span>
            <div className="reload-progress-bar">
              <div className="reload-progress-fill" />
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={`splash-screen ${isFirstVisit ? 'first-visit' : 'returning-visit'} ${isExiting ? 'is-exiting' : ''}`} aria-live="polite">
      <div className="splash-vignette" aria-hidden="true" />
      <div className="splash-glow glow-one" aria-hidden="true" />
      <div className="splash-glow glow-two" aria-hidden="true" />

      <div className="splash-content">
        <div className="aaa-logo" aria-hidden="true">
          <div className={`aaa-piece ${isFirstVisit ? 'aaa-left' : 'aaa-piece-left'}`}>
            <img src="/avyanna-mark.svg" alt="" />
          </div>
          <div className={`aaa-piece ${isFirstVisit ? 'aaa-center' : 'aaa-piece-middle'}`}>
            <img src="/avyanna-mark.svg" alt="" />
          </div>
          <div className={`aaa-piece ${isFirstVisit ? 'aaa-right' : 'aaa-piece-right'}`}>
            <img src="/avyanna-mark.svg" alt="" />
          </div>
        </div>

        <div className="academy-title">
          <h1>AVYANNA</h1>
          <div className="title-line" />
          <h2>AVIATION ACADEMY</h2>
          <p>TRAIN • FLY • EXCEL</p>
        </div>

        <div className="flight-path" aria-hidden="true">
          <span className="flight-plane">✈</span>
        </div>
      </div>
    </div>
  )
}
