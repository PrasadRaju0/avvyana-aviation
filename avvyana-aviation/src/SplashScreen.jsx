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
