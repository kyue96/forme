/**
 * Rest timer completion sound.
 * Uses expo-av to play a gentle chime when the rest timer reaches 0.
 * NOTE: expo-av must be installed: npx expo install expo-av
 */
import { Audio } from 'expo-av';

let soundObject: Audio.Sound | null = null;

/**
 * Generates a short, gentle chime sound as a WAV data URI.
 * This avoids needing an external sound file asset.
 */
function generateChimeWav(): string {
  const sampleRate = 22050;
  const duration = 0.6; // seconds
  const numSamples = Math.floor(sampleRate * duration);
  const numChannels = 1;
  const bitsPerSample = 16;
  const byteRate = sampleRate * numChannels * (bitsPerSample / 8);
  const blockAlign = numChannels * (bitsPerSample / 8);
  const dataSize = numSamples * blockAlign;
  const headerSize = 44;
  const buffer = new ArrayBuffer(headerSize + dataSize);
  const view = new DataView(buffer);

  // WAV header
  const writeString = (offset: number, str: string) => {
    for (let i = 0; i < str.length; i++) view.setUint8(offset + i, str.charCodeAt(i));
  };
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true); // PCM
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Generate a gentle two-tone chime (C5 + E5 with quick decay)
  const freq1 = 523.25; // C5
  const freq2 = 659.25; // E5
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    // Exponential decay envelope
    const envelope = Math.exp(-t * 6);
    // Mix two sine waves for a pleasant bell-like tone
    const sample =
      Math.sin(2 * Math.PI * freq1 * t) * 0.5 +
      Math.sin(2 * Math.PI * freq2 * t) * 0.3 +
      Math.sin(2 * Math.PI * freq1 * 2 * t) * 0.1; // harmonic
    const amplitude = Math.min(1, Math.max(-1, sample * envelope)) * 0.4; // Keep it gentle
    const intSample = Math.round(amplitude * 32767);
    view.setInt16(headerSize + i * 2, intSample, true);
  }

  // Convert to base64
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return 'data:audio/wav;base64,' + btoa(binary);
}

let chimeUri: string | null = null;

function getChimeUri(): string {
  if (!chimeUri) {
    chimeUri = generateChimeWav();
  }
  return chimeUri;
}

/**
 * Play the rest timer completion chime.
 * Safe to call multiple times — unloads the previous sound first.
 */
export async function playRestTimerChime(): Promise<void> {
  try {
    // Unload previous sound if still loaded
    if (soundObject) {
      try { await soundObject.unloadAsync(); } catch {}
      soundObject = null;
    }

    // Configure audio session for playback (works even in silent mode on iOS)
    await Audio.setAudioModeAsync({
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
    });

    const { sound } = await Audio.Sound.createAsync(
      { uri: getChimeUri() },
      { shouldPlay: true, volume: 0.7 }
    );
    soundObject = sound;

    // Auto-cleanup after playback
    sound.setOnPlaybackStatusUpdate((status) => {
      if ('didJustFinish' in status && status.didJustFinish) {
        sound.unloadAsync().catch(() => {});
        if (soundObject === sound) soundObject = null;
      }
    });
  } catch (err) {
    // Silently fail — sound is a nice-to-have, not critical
    console.warn('Rest timer chime failed:', err);
  }
}
