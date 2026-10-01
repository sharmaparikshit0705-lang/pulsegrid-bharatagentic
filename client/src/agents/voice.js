/**
 * Browser speech synthesis helper — reads a driver alert aloud, in the driver's
 * own language. Uses the Web Speech API, which is built into modern browsers;
 * no external service and no API key.
 *
 * If the browser has no voice for a language, the utterance is still spoken with
 * whatever the default engine offers, so the demo degrades rather than breaks.
 */
export function speechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function';
}

export function speak(text, lang = 'en-IN', { rate = 0.95, pitch = 1 } = {}) {
  if (!speechSupported() || !text) return false;
  try {
    const synth = window.speechSynthesis;
    synth.cancel(); // one alert at a time
    const u = new window.SpeechSynthesisUtterance(text);
    u.lang = lang;
    u.rate = rate;
    u.pitch = pitch;
    const voices = (synth.getVoices && synth.getVoices()) || [];
    const exact = voices.find((v) => v.lang === lang);
    const base = String(lang).split('-')[0];
    const partial = voices.find((v) => (v.lang || '').toLowerCase().startsWith(base));
    if (exact || partial) u.voice = exact || partial;
    synth.speak(u);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  if (!speechSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* no-op */
  }
}
