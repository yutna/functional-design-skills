// The message broker other services subscribe to.
export const queue = {
  async publish(topic: string, payload: unknown): Promise<void> {
    throw new Error(`needs a broker to publish ${topic}: ${String(payload)}`)
  },
}
