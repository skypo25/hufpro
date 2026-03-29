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
  const port = config.port
  const secure = Boolean(config.secure)

  return nodemailer.createTransport({
    host: config.host,
    port,
    secure,
    auth: config.user && config.password
      ? { user: config.user, pass: config.password }
      : undefined,
    /**
     * STARTTLS (587, 2525): Verbindung zuerst Klartext, dann TLS-Upgrade.
     * Ohne requireTLS kann der Handshake je nach Anbieter fehlschlagen.
     * Nicht für Port 465 (implicit TLS / secure: true) setzen.
     */
    ...(!secure && (port === 587 || port === 2525)
      ? { requireTLS: true as const }
      : {}),
  })
}

export type SendMailOptions = {
  to: string
  subject: string
  text?: string
  html?: string
  replyTo?: string
  attachments?: Array<{
    filename: string
    content: Buffer | Uint8Array
    contentType?: string
  }>
}

export type SendMailResult = {
  messageId?: string
  accepted?: string[]
  rejected?: string[]
  response?: string
}

export async function sendMail(config: SmtpConfig, options: SendMailOptions): Promise<SendMailResult> {
  const transporter = createMailer(config)
  const from = config.fromName
    ? `"${config.fromName}" <${config.fromEmail || config.user}>`
    : (config.fromEmail || config.user)
  const info = await transporter.sendMail({
    from,
    to: options.to,
    subject: options.subject,
    text: options.text,
    html: options.html,
    replyTo: options.replyTo,
    attachments: options.attachments,
  })
  const anyInfo = info as unknown as {
    messageId?: string
    accepted?: string[]
    rejected?: string[]
    response?: string
  }
  return {
    messageId: anyInfo?.messageId,
    accepted: anyInfo?.accepted,
    rejected: anyInfo?.rejected,
    response: anyInfo?.response,
  }
}
