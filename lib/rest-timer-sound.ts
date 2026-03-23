/**
 * Rest timer completion sound.
 * Uses expo-av to play a chime when the rest timer reaches 0.
 * Configured to:
 *  - Play over background music (duck, don't interrupt)
 *  - Play in silent mode on iOS
 *  - Stay active in background so sound fires even when locked
 *  - Play at full volume for audibility
 * NOTE: expo-av must be installed: npx expo install expo-av
 */
import { Audio, InterruptionModeIOS, InterruptionModeAndroid } from 'expo-av';
import * as Notifications from 'expo-notifications';

let soundObject: Audio.Sound | null = null;
let audioModeConfigured = false;

/**
 * Configure audio mode once — allows playback over other audio (music).
 */
async function ensureAudioMode() {
  if (audioModeConfigured) return;
  try {
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      staysActiveInBackground: true,
      interruptionModeIOS: InterruptionModeIOS.DuckOthers,
      interruptionModeAndroid: InterruptionModeAndroid.DuckOthers,
      shouldDuckAndroid: true,
    });
    audioModeConfigured = true;
  } catch {}
}

/**
 * Generates a loud, clear chime sound as a WAV data URI.
 * Two-tone bell (C5 + E5) with harmonics, played twice for emphasis.
 */
function generateChimeWav(): string {
  const sampleRate = 22050;
  const duration = 1.2; // longer for audibility
  const numSamples = Math.floor(sampleRate * duration);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true);
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  const freq1 = 523.25; // C5
  const freq2 = 659.25; // E5
  const halfPoint = numSamples / 2;

  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Two chime hits: first at 0s, second at ~0.6s
    const t1 = t;
    const t2 = Math.max(0, t - 0.6);
    const env1 = t < 0.6 ? Math.exp(-t1 * 5) : 0;
    const env2 = t >= 0.6 ? Math.exp(-t2 * 5) : 0;

    const chime = (time: number) =>
      Math.sin(2 * Math.PI * freq1 * time) * 0.5 +
      Math.sin(2 * Math.PI * freq2 * time) * 0.35 +
      Math.sin(2 * Math.PI * freq1 * 2 * time) * 0.15;

    const sample = chime(t1) * env1 + chime(t2) * env2;
    // Higher amplitude for audibility (0.85 instead of 0.4)
    const amplitude = Math.min(1, Math.max(-1, sample)) * 0.85;
    view.setInt16(headerSize + i * 2, Math.round(amplitude * 32767), true);
  }

  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

let chimeUri: string | null = null;

function getChimeUri(): string {
  if (!chimeUri) chimeUri = generateChimeWav();
  return chimeUri;
}

/**
 * Play the rest timer completion chime.
 * - Plays at full volume over background music
 * - Safe to call multiple times
 * - Falls back to notification sound when app is backgrounded
 */
export async function playRestTimerChime(): Promise<void> {
  try {
    if (soundObject) {
      try { await soundObject.unloadAsync(); } catch {}
      soundObject = null;
    }

    await ensureAudioMode();

    const { sound } = await Audio.Sound.createAsync(
      { uri: getChimeUri() },
      { shouldPlay: true, volume: 1.0 }
    );
    soundObject = sound;

    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (soundObject === sound) soundObject = null;
      }
    });
  } catch (err) {
    console.warn('Rest timer chime failed:', err);
  }
}

/**
 * Schedule a notification for when the rest timer completes.
 * This ensures the user hears a sound even when the phone is locked.
 */
export async function scheduleRestTimerNotification(seconds: number): Promise<string | null> {
  try {
    const id = await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Rest Complete',
        body: 'Time to start your next set!',
        sound: 'default',
      },
      trigger: {
        type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
        seconds: Math.max(1, seconds),
      },
    });
    return id;
  } catch {
    return null;
  }
}

/**
 * Cancel a previously scheduled rest timer notification.
 */
export async function cancelRestTimerNotification(id: string | null): Promise<void> {
  if (!id) return;
  try {
    await Notifications.cancelScheduledNotificationAsync(id);
  } catch {}
}
