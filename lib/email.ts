import nodemailer from 'nodemailer'

export type SmtpConfig = {
  host: string
  port: number
  secure: boolean
  user: string
  password: string
  fromEmail?: string
  fromName?: string
}

export function createMailer(config: SmtpConfig) {
  return nodemailer.createTransport({
    host: config.host,
    port: config.port,
    secure: config.secure,
    auth: config.user && config.password
      ? { user: config.user, pass: config.password }
      : undefined,
  })
}

export type SendMailOptions = {
  to: string
  subject: string
  text?: string
  html?: string
  replyTo?: string
}

export async function sendMail(config: SmtpConfig, options: SendMailOptions): Promise<void> {
  const transporter = createMailer(config)
  const from = config.fromName
    ? `"${config.fromName}" <${config.fromEmail || config.user}>`
    : (config.fromEmail || config.user)
  await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    replyTo: options.replyTo,
  })
}
