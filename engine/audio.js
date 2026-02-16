let audioContext = null;
let analyser = null;
let stream = null;

export async function start() {
  stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  audioContext = new AudioContext();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 1024;

  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);

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
