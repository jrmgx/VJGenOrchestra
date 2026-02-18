let dataArray;
let lastBass = 0;
let kickFrame = 0;

export function createAudio(analyser) {
  return {
    analyser,
    getByteFrequencyData: (arr) => analyser.getByteFrequencyData(arr),
    kick: 0,
    bass: 0,
    mid: 0,
    high: 0,
  };
}

export function updateAudio(audio, options = {}) {
  const threshold = options.kickThreshold ?? 0.2;
  const diff = options.kickDiff ?? 0.15;
  const frames = options.kickFrames ?? 5;

  if (!dataArray) dataArray = new Uint8Array(audio.analyser.frequencyBinCount);
  audio.analyser.getByteFrequencyData(dataArray);

  const bassRaw = (dataArray[0] + dataArray[1] + dataArray[2] + dataArray[3] + dataArray[4]) / (5 * 255);
  audio.bass = bassRaw;
  audio.mid = dataArray[20] / 255;
  audio.high = dataArray[60] / 255;

  const triggered = bassRaw - lastBass > diff && bassRaw > threshold;
  lastBass = bassRaw;

  if (triggered) {
    audio.kick = 1;
    kickFrame = 0;
  } else {
    kickFrame++;
    if (kickFrame >= frames) audio.kick = 0;
  }
}
