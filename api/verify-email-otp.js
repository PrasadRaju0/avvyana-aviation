import { verifyChallenge } from './_otp.js'

export default function verifyEmailOtp(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {})
  const email = String(body.email || '').trim().toLowerCase()
  const otp = String(body.otp || '').trim()
  const challenge = String(body.challenge || '')

  if (!email || !/^\d{6}$/.test(otp) || !challenge || !verifyChallenge(challenge, email, otp)) {
    return response.status(400).json({ error: 'Invalid or expired OTP. Request a new OTP and try again.' })
  }

  return response.status(200).json({ verified: true })
}
