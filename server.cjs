require('dotenv').config()
const http = require('http')
const twilio = require('twilio')
const nodemailer = require('nodemailer')

const port = 8787
const pendingOtps = new Map()
const requiredTwilioVariables = [
  'TWILIO_ACCOUNT_SID',
  'TWILIO_AUTH_TOKEN',
  'TWILIO_PHONE_NUMBER',
]

const missingTwilioVariables = () => requiredTwilioVariables.filter(
  (variable) => !process.env[variable]
)

const requiredSmtpVariables = [
  'SMTP_HOST',
  'SMTP_PORT',
  'SMTP_USER',
  'SMTP_PASSWORD',
  'SMTP_FROM',
]

const missingSmtpVariables = () => requiredSmtpVariables.filter(
  (variable) => !process.env[variable]
)

const sendJson = (response, status, body) => {
  response.writeHead(status, { 'Content-Type': 'application/json' })
  response.end(JSON.stringify(body))
}

const readBody = (request) => new Promise((resolve, reject) => {
  let body = ''
  request.on('data', (chunk) => { body += chunk })
  request.on('end', () => {
    try {
      resolve(JSON.parse(body || '{}'))
    } catch {
      reject(new Error('Invalid JSON'))
    }
  })
  request.on('error', reject)
})

const server = http.createServer(async (request, response) => {
  if (request.method !== 'POST' || !['/api/send-otp', '/api/verify-otp', '/api/send-email-otp', '/api/verify-email-otp'].includes(request.url)) {
    return sendJson(response, 404, { error: 'Not found' })
  }

  try {
    const body = await readBody(request)
    const mobileNumber = String(body.mobileNumber || '').trim()
    const email = String(body.email || '').trim().toLowerCase()

    if (!mobileNumber && !email) {
      return sendJson(response, 400, { error: 'Mobile number is required.' })
    }

    if (request.url === '/api/send-email-otp') {
      const missingVariables = missingSmtpVariables()
      if (!email) return sendJson(response, 400, { error: 'Email is required.' })
      if (missingVariables.length > 0) {
        return sendJson(response, 503, { error: `Email OTP is not configured. Add ${missingVariables.join(', ')} to .env and restart the server.` })
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000))
      pendingOtps.set(`email:${email}`, { otp, expiresAt: Date.now() + 5 * 60 * 1000 })
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: Number(process.env.SMTP_PORT),
        secure: process.env.SMTP_SECURE === 'true',
        auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASSWORD },
      })
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Avyanna Aviation Academy password reset OTP',
        text: `Your password reset OTP is ${otp}. It expires in 5 minutes.`,
      })
      return sendJson(response, 200, { message: 'OTP sent to your email address.' })
    }

    if (request.url === '/api/verify-email-otp') {
      const pendingOtp = pendingOtps.get(`email:${email}`)
      const valid = pendingOtp && pendingOtp.expiresAt > Date.now() && pendingOtp.otp === String(body.otp || '')
      if (!valid) return sendJson(response, 400, { error: 'Invalid or expired OTP.' })
      pendingOtps.delete(`email:${email}`)
      return sendJson(response, 200, { verified: true })
    }

    if (request.url === '/api/send-otp') {
      const missingVariables = missingTwilioVariables()
      if (missingVariables.length > 0) {
        return sendJson(response, 503, {
          error: `Twilio SMS is not configured. Add ${missingVariables.join(', ')} to .env and restart the server.`,
        })
      }

      const otp = String(Math.floor(100000 + Math.random() * 900000))
      pendingOtps.set(mobileNumber, { otp, expiresAt: Date.now() + 5 * 60 * 1000 })

      const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN)
      await client.messages.create({
        body: `Your Avyanna Aviation Academy OTP is ${otp}. It expires in 5 minutes.`,
        from: process.env.TWILIO_PHONE_NUMBER,
        to: mobileNumber,
      })

      return sendJson(response, 200, { message: 'OTP sent to your mobile number.' })
    }

    const pendingOtp = pendingOtps.get(mobileNumber)
    const valid = pendingOtp && pendingOtp.expiresAt > Date.now() && pendingOtp.otp === String(body.otp || '')

    if (!valid) {
      return sendJson(response, 400, { error: 'Invalid or expired OTP.' })
    }

    pendingOtps.delete(mobileNumber)
    return sendJson(response, 200, { verified: true })
  } catch (error) {
    return sendJson(response, 500, { error: error.message || 'Unable to send OTP.' })
  }
})

server.listen(port, () => {
  console.log(`OTP server listening on http://localhost:${port}`)
  const missingVariables = missingTwilioVariables()
  if (missingVariables.length > 0) {
    console.warn(`Twilio SMS is disabled. Missing: ${missingVariables.join(', ')}`)
  }
})