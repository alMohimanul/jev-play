export interface RawSseEvent {
  event: string
  data: string
}

export function parseSseBuffer(buffer: string): { events: RawSseEvent[]; remainder: string } {
  const parts = buffer.split('\n\n')
  const remainder = parts.pop() ?? ''
  const events: RawSseEvent[] = []

  for (const chunk of parts) {
    if (chunk.trim() === '') continue
    let event = 'message'
    let data = ''
    for (const line of chunk.split('\n')) {
      if (line.startsWith('event: ')) event = line.slice('event: '.length)
      else if (line.startsWith('data: ')) data = line.slice('data: '.length)
    }
    events.push({ event, data })
  }

  return { events, remainder }
}
