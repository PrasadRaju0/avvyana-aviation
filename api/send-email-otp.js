import { missingVariables, sendOtp } from './_otp.js'

export default async function sendEmailOtp(request, response) {
  if (request.method !== 'POST') {
    return response.status(405).json({ error: 'Method not allowed.' })
  }

  const body = typeof request.body === 'string' ? JSON.parse(request.body || '{}') : (request.body || {})
  const email = String(body.email || '').trim().toLowerCase()
  if (!email) return response.status(400).json({ error: 'Email is required.' })

  const missing = missingVariables()
  if (missing.length > 0) {
    return response.status(503).json({
      error: `Email OTP is not configured on the deployed server. Add these Vercel environment variables: ${missing.join(', ')}.`,
    })
  }

  try {
    const challenge = await sendOtp(email)
    return response.status(200).json({ message: 'OTP sent to your email address.', challenge })
  } catch (error) {
    return response.status(500).json({ error: error.message || 'Unable to send OTP.' })
  }
}
