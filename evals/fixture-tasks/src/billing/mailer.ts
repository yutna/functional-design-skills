export const mailer = {
  async send(to: string, text: string): Promise<void> {
    throw new Error(`needs a mail server to tell ${to}: ${text}`)
  },
}
