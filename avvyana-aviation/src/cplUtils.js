export function formatFlightTime(minutes) {
  const safeMinutes = Number.isFinite(minutes) ? Math.max(0, Math.round(minutes)) : 0
  const hours = Math.floor(safeMinutes / 60)
  const mins = safeMinutes % 60
  return `${hours}:${String(mins).padStart(2, '0')}`
}

export function calculateRemaining(requiredValue, actualValue) {
  return Math.max(Number(requiredValue || 0) - Number(actualValue || 0), 0)
}

export function calculateRequirementProgress(requiredValue, actualValue) {
  const required = Number(requiredValue || 0)
  if (!required) return 0
  const actual = Number(actualValue || 0)
  return Math.min((actual / required) * 100, 100)
}

export function calculateValidity(requirement, actualValue, referenceDate = new Date()) {
  const hasLookback = requirement?.lookbackPeriod && requirement.lookbackPeriod > 0
  if (!hasLookback) {
    return {
      status: actualValue >= requirement.requiredValue ? 'Current' : 'Pending',
      validUntil: null,
      daysRemaining: null,
      expired: false,
      periodLabel: null,
    }
  }

  const reference = new Date(referenceDate)
  const startDate = new Date(reference)
  const endDate = new Date(reference)
  endDate.setMonth(endDate.getMonth() + Number(requirement.lookbackPeriod || 6))

  const threshold = Number(requirement.warningDays || 30)
  const daysRemaining = Math.max(Math.ceil((endDate - reference) / (1000 * 60 * 60 * 24)), 0)
  let status = 'Current'

  if (daysRemaining <= threshold) status = 'Expiring Soon'
  if (daysRemaining <= 0) status = 'Expired'

  return {
    status,
    validUntil: endDate,
    daysRemaining,
    expired: daysRemaining <= 0,
    periodLabel: `${requirement.lookbackPeriod} months`,
  }
}

export function getRequirementStatus({ requiredValue, actualValue, lookbackPeriod, expired = false }) {
  const required = Number(requiredValue || 0)
  const actual = Number(actualValue || 0)

  if (expired || (lookbackPeriod && actual < required && actual > 0 && actual < required)) {
    return 'Attention'
  }

  if (actual >= required) return 'Qualified'
  return 'Pending'
}

export function calculateFlightTotals(flights = []) {
  return flights.reduce((totals, flight) => {
    const duration = Number(flight.durationMinutes || 0)
    const picValue = Number(flight.picMinutes || 0)
    const crossCountryPicValue = Number(flight.crossCountryPicMinutes || (flight.crossCountry && flight.role === 'PIC' ? picValue : 0))
    const nightValue = Number(flight.nightMinutes || 0)
    const instrumentValue = Number(flight.instrumentMinutes || 0)
    const instrumentAircraftValue = Number(flight.instrumentAircraftMinutes || 0)
    const distanceValue = Number(flight.crossCountryDistanceNm || 0)

    totals.total += duration
    totals.pic += picValue
    totals.xcPic += crossCountryPicValue
    totals.night += flight.night && flight.role === 'PIC' ? nightValue : 0
    totals.nightTakeoffs += Number(flight.nightTakeoffs || 0)
    totals.nightLandings += Number(flight.nightLandings || 0)
    totals.instrument += instrumentValue
    totals.instrumentAircraft += instrumentAircraftValue
    totals.xcDistance += distanceValue
    totals.flights += 1

    return totals
  }, {
    total: 0,
    pic: 0,
    xcPic: 0,
    night: 0,
    nightTakeoffs: 0,
    nightLandings: 0,
    instrument: 0,
    instrumentAircraft: 0,
    xcDistance: 0,
    flights: 0,
  })
}

export function calculateRecentExperience(flights = [], months = 6, referenceDate = new Date()) {
  const cutoff = new Date(referenceDate)
  cutoff.setMonth(cutoff.getMonth() - months)

  const recentFlights = flights.filter((flight) => {
    const flightDate = new Date(flight.date)
    return flightDate >= cutoff && flightDate <= new Date(referenceDate)
  })

  return recentFlights.reduce((total, flight) => total + Number(flight.picMinutes || 0), 0)
}
