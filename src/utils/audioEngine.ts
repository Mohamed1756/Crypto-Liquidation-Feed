let audioCtx: AudioContext | null = null;
let masterGain: GainNode | null = null;
let reverbNode: ConvolverNode | null = null;

export const initAudio = () => {
  if (audioCtx) return;
  // Initialize context
  audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
  
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0.5; // Master volume
  masterGain.connect(audioCtx.destination);

  // Procedural Reverb Impulse Response
  const sampleRate = audioCtx.sampleRate;
  const length = sampleRate * 2.5; // 2.5 second reverb tail
  const impulse = audioCtx.createBuffer(2, length, sampleRate);
  
  for (let c = 0; c < 2; c++) {
    const channelData = impulse.getChannelData(c);
    for (let i = 0; i < length; i++) {
      // Exponential decay white noise creates a realistic acoustic room impulse
      channelData[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, 4);
    }
  }
  
  reverbNode = audioCtx.createConvolver();
  reverbNode.buffer = impulse;
  reverbNode.connect(masterGain);
};

export const playLiquidationSound = (price: number, value: number, side: 'BUY' | 'SELL') => {
  try {
    if (!audioCtx) initAudio();
    if (!audioCtx || !masterGain || !reverbNode) return;

    if (audioCtx.state === 'suspended') {
      audioCtx.resume();
    }

    // 1. Map Value to Amplitude & Sustain
    // 0 to 1 intensity scale where 1 is a >= $1M liquidation
    const intensity = Math.min(value / 1000000, 1);
    
    // Base amplitude (very quiet for small liqs, booming for whales)
    const baseAmp = 0.05 + (intensity * 0.4); 

    // 2. Map Price to Pitch (Logarithmic curve)
    // BTC ($60k) will be high pitch, SHIB will be low sub-bass
    const minPrice = 0.001;
    const maxPrice = 100000;
    const clampedPrice = Math.max(minPrice, Math.min(price, maxPrice));
    
    const logPrice = Math.log(clampedPrice) - Math.log(minPrice);
    const logMax = Math.log(maxPrice) - Math.log(minPrice);
    const pitchRatio = logPrice / logMax;
    
    // Frequency range: 80Hz (deep rumble) to 1800Hz (crystal ping)
    const freq = 80 + (pitchRatio * 1720);

    // Context time
    const t = audioCtx.currentTime;

    // oscillators
    const osc = audioCtx.createOscillator();
    const env = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    // Sound Character: Massive liquidations get a grittier sawtooth wave, small ones are smooth sines
    osc.type = intensity > 0.4 ? (intensity > 0.8 ? 'square' : 'sawtooth') : 'sine';
    osc.frequency.setValueAtTime(freq, t);

    // Sweep filter to give it a "strike" sound
    filter.type = 'lowpass';
    const filterStart = side === 'BUY' ? 2000 : 1200; // Buy liquidations (Short squeeze) are slightly brighter
    filter.frequency.setValueAtTime(filterStart + (intensity * 2000), t);
    filter.frequency.exponentialRampToValueAtTime(200, t + 0.3 + intensity);

    // Main Envelope (ADSR)
    env.gain.setValueAtTime(0, t);
    // Fast attack
    env.gain.linearRampToValueAtTime(baseAmp, t + 0.02);
    // Decay based on weight: huge orders ring out for up to 1.5s, small ones are instantaneous <0.2s blips
    env.gain.exponentialRampToValueAtTime(0.001, t + (0.1 + intensity * 1.4));

    // Connect fundamental
    osc.connect(env);
    env.connect(filter);

    // Deep Sub-oscillator for literal "weight" on big orders
    const subOsc = audioCtx.createOscillator();
    const subEnv = audioCtx.createGain();
    
    if (intensity > 0.1) {
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(freq / 2, t);
      
      subEnv.gain.setValueAtTime(0, t);
      subEnv.gain.linearRampToValueAtTime(baseAmp * 0.8, t + 0.05);
      subEnv.gain.exponentialRampToValueAtTime(0.001, t + (0.3 + intensity * 1.5));
      
      subOsc.connect(subEnv);
      subEnv.connect(filter);
      subOsc.start(t);
      subOsc.stop(t + 2);
    }

    // Dry / Wet Reverb mix
    const dryGain = audioCtx.createGain();
    const wetGain = audioCtx.createGain();
    
    // Heavy liquidations are soaked in reverb ("ambient radar")
    dryGain.gain.value = 1.0 - (intensity * 0.4); 
    wetGain.gain.value = intensity * 1.2; // Massive wash

    filter.connect(dryGain);
    filter.connect(wetGain);
    
    dryGain.connect(masterGain);
    wetGain.connect(reverbNode);

    // Start / Stop
    osc.start(t);
    osc.stop(t + 2);

  } catch (err) {
    console.error("Audio Engine Error:", err);
  }
};
