const crypto = require('crypto')
const nodemailer = require('nodemailer')

const requiredVariables = ['SMTP_HOST', 'SMTP_PORT', 'SMTP_USER', 'SMTP_PASSWORD', 'SMTP_FROM']

function signingSecret() {
  return process.env.OTP_SECRET || process.env.SMTP_PASSWORD
}

function missingVariables() {
  return requiredVariables.filter((name) => !process.env[name])
}

function createChallenge(email, otp) {
  const expiresAt = Date.now() + 5 * 60 * 1000
  const payload = `${email}|${otp}|${expiresAt}`
  const signature = crypto.createHmac('sha256', signingSecret()).update(payload).digest('hex')
  return Buffer.from(`${payload}|${signature}`).toString('base64url')
}

function verifyChallenge(challenge, email, otp) {
  try {
    const [challengeEmail, challengeOtp, expiresAt, signature] = Buffer.from(challenge, 'base64url').toString().split('|')
    const payload = `${challengeEmail}|${challengeOtp}|${expiresAt}`
    const expectedSignature = crypto.createHmac('sha256', signingSecret()).update(payload).digest('hex')
    return challengeEmail === email
      && challengeOtp === otp
      && Number(expiresAt) > Date.now()
      && crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expectedSignature))
  } catch {
    return false
  }
}

async function sendOtp(email) {
  const otp = String(Math.floor(100000 + Math.random() * 900000))
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

  return createChallenge(email, otp)
}

module.exports = { missingVariables, sendOtp, verifyChallenge }
