import { expect } from '@playwright/test'

const MAILPIT_API = process.env.MAILPIT_API_URL || 'http://127.0.0.1:8025/api/v1'

type MessageSummary = { ID: string; Subject: string }

/** Waits for an email to `to` whose subject contains `subject`; returns its subject and plain text. */
export async function waitForEmail(to: string, subject: string): Promise<{ subject: string; text: string }> {
  let message: MessageSummary | undefined
  const query = `to:${to} subject:"${subject.replaceAll('"', '')}"`
  await expect
    .poll(
      async () => {
        const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(query)}`)
        const { messages } = (await response.json()) as { messages: MessageSummary[] }
        message = messages[0]
        return Boolean(message)
      },
      { timeout: 20_000 },
    )
    .toBe(true)

  const response = await fetch(`${MAILPIT_API}/message/${message!.ID}`)
  const { Text } = (await response.json()) as { Text: string }
  return { subject: message!.Subject, text: Text }
}

/** Waits for the newest email to `to` and returns its subject and the first link matching `linkPattern`. */
export async function waitForEmailLink(
  to: string,
  linkPattern: RegExp,
): Promise<{ link: string; subject: string }> {
  let message: MessageSummary | undefined
  await expect
    .poll(
      async () => {
        const response = await fetch(`${MAILPIT_API}/search?query=${encodeURIComponent(`to:${to}`)}`)
        const { messages } = (await response.json()) as { messages: MessageSummary[] }
        message = messages[0]
        return Boolean(message)
      },
      { timeout: 20_000 },
    )
    .toBe(true)

  const response = await fetch(`${MAILPIT_API}/message/${message!.ID}`)
  const { Text } = (await response.json()) as { Text: string }
  const link = Text.match(linkPattern)?.[0]
  if (!link) throw new Error(`No link matching ${linkPattern} in email to ${to}`)
  return { link, subject: message!.Subject }
}
