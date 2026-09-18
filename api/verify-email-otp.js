const { verifyChallenge } = require('./_otp')

module.exports = (request, response) => {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const email = String(request.body?.email || '').trim().toLowerCase()
  const otp = String(request.body?.otp || '').trim()
  const challenge = String(request.body?.challenge || '')

  if (!email || !/^\d{6}$/.test(otp) || !challenge || !verifyChallenge(challenge, email, otp)) {
    return response.status(400).json({ error: 'Invalid or expired OTP. Request a new OTP and try again.' })
  }

  return response.status(200).json({ verified: true })
}
