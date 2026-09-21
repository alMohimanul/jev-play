import { describe, it, expect } from 'vitest'
import { formatSseEvent } from './sse'
import { parseSseBuffer } from './parseSse'

describe('SSE wire protocol', () => {
  it('round-trips a single event through format and parse', () => {
    const wire = formatSseEvent('verdict', { engine: 'jev', flagged: true })
    const { events, remainder } = parseSseBuffer(wire)
    expect(events).toEqual([{ event: 'verdict', data: JSON.stringify({ engine: 'jev', flagged: true }) }])
    expect(remainder).toBe('')
  })

  it('parses multiple events written back to back', () => {
    const wire = formatSseEvent('init', { engines: [] }) + formatSseEvent('done', {})
    const { events } = parseSseBuffer(wire)
    expect(events.map((e) => e.event)).toEqual(['init', 'done'])
  })

  it('holds back an incomplete trailing event as remainder', () => {
    const wire = formatSseEvent('delta', { text: 'hi' }) + 'event: verdict\ndata: {"eng'
    const { events, remainder } = parseSseBuffer(wire)
    expect(events).toHaveLength(1)
    expect(remainder).toBe('event: verdict\ndata: {"eng')
  })
})
