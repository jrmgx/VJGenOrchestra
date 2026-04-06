let audioContext = null;
let analyser = null;
let stream = null;

export async function start() {
  stream = null;
  audioContext = new AudioContext();
  if (audioContext.state === "suspended") {
    await audioContext.resume();
  }
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;

  try {
    if (navigator.mediaDevices?.getUserMedia) {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
    }
  } catch (_) {
    // No mic input: analyser stays disconnected (zeros).
  }

  return { audioContext, analyser, stream };
}

export function stop() {
  if (stream) {
    stream.getTracks().forEach((t) => t.stop());
    stream = null;
  }
  if (audioContext) {
    audioContext.close();
    audioContext = null;
  }
  analyser = null;
}
