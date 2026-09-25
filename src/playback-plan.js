// Preserve every still-audible voice when seeking, including overlapping uses
// of the same sample. Event time and buffer offsets are seconds, not beats.
export function playbackPlan(events, offset, resolveBuffer) {
  return events.flatMap(event => {
    const buffer = resolveBuffer(event);
    const elapsed = Math.max(0, offset - event.time);
    if (event.time < offset && (!buffer || elapsed >= buffer.duration)) return [];
    return [{ event, buffer, at: Math.max(0, event.time - offset), offset: elapsed }];
  });
}

export function voiceStart(voice, start, now) {
  const target = start + voice.at;
  const when = Math.max(now, target);
  const offset = voice.offset + Math.max(0, now - target);
  return offset >= voice.buffer.duration ? null : {
    when, offset, end: when + voice.buffer.duration - offset,
  };
}
