// Web Audio API Synthesizer Engine for Webtoon-to-Video Storyboard Previews
// Completely self-contained, lightweight, and zero-latency synthesis of sound effects and ambient tracks.

let audioCtx: AudioContext | null = null;
let masterGainNode: GainNode | null = null;
let bgMusicInterval: NodeJS.Timeout | null = null;
let activeSynthNodes: AudioNode[] = [];
let currentTheme: string = "";

// Lazy-initialization of standard AudioContext to bypass browser autoplay blocks
function getAudioContext(): AudioContext {
  if (!audioCtx) {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    audioCtx = new AudioContextClass();
    
    // Set up master gain node for clean volume management
    masterGainNode = audioCtx.createGain();
    masterGainNode.connect(audioCtx.destination);
  }
  return audioCtx;
}

// Noise buffer generation for whoosh, sweeping winds, and thunder impact SFX
let absoluteNoiseBuffer: AudioBuffer | null = null;
function getNoiseBuffer(ctx: AudioContext): AudioBuffer {
  if (absoluteNoiseBuffer) return absoluteNoiseBuffer;
  
  const bufferSize = ctx.sampleRate * 3; // 3 seconds of white noise
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  
  for (let i = 0; i < bufferSize; i++) {
    data[i] = Math.random() * 2 - 1;
  }
  
  absoluteNoiseBuffer = buffer;
  return absoluteNoiseBuffer;
}

/**
 * Configure or update master playback volume
 * @param volume percentage from 0 to 100
 * @param isMuted silent toggle
 */
export function setEngineVolume(volume: number, isMuted: boolean = false) {
  try {
    const ctx = getAudioContext();
    if (masterGainNode) {
      const targetGain = isMuted ? 0 : (volume / 100) * 0.35; // keep master max safe at 35% synth pressure
      masterGainNode.gain.setTargetAtTime(targetGain, ctx.currentTime, 0.08);
    }
  } catch (err) {
    console.warn("[Audio Engine] Master volume adjustment bypassed:", err);
  }
}

/**
 * Stop active background ambience synthesizer loops cleanly
 */
export function stopAmbientBackgroundMusic() {
  if (bgMusicInterval) {
    clearInterval(bgMusicInterval);
    bgMusicInterval = null;
  }

  // Fade out and disconnect active synthesis oscillators/filters
  activeSynthNodes.forEach(node => {
    try {
      if ('stop' in node) {
        (node as any).stop();
      }
      node.disconnect();
    } catch {
      // Ignored
    }
  });
  activeSynthNodes = [];
  currentTheme = "";
  console.log("[Audio Engine] Stopped ambient background soundtrack.");
}

/**
 * Start play loop of background ambient synthesizer matching selecting storyboard tracker theme
 * @param theme Music tracker theme label
 * @param volume current master volume percent
 * @param isMuted silent toggle
 */
export function startAmbientBackgroundMusic(theme: string, volume: number, isMuted: boolean = false) {
  try {
    const ctx = getAudioContext();
    
    // Ensure context is resumed (browser safety trigger)
    if (ctx.state === "suspended") {
      ctx.resume();
    }

    // Stop any existing background soundtrack first
    stopAmbientBackgroundMusic();
    setEngineVolume(volume, isMuted);
    
    currentTheme = theme;
    
    if (theme.toLowerCase().includes("no music")) {
      return;
    }

    console.log(`[Audio Engine] Starting background synthesizer for theme: "${theme}"`);
    let beatCount = 0;

    // Fast-timer sequencer based on selected cinematic tone
    const scheduleIntervalMs = theme.includes("Battle") ? 320 : 600;

    bgMusicInterval = setInterval(() => {
      if (ctx.state === "suspended") return;
      const now = ctx.currentTime;

      if (theme.toLowerCase().includes("battle")) {
        // --- ORCHESTRAL BATTLE THEME ---
        // low cinematic timpani drum beat + brassy sawtooth swells
        
        // Dynamic Timpani Beat (on beats 0, 2, 3, 4)
        if (beatCount % 4 !== 1) {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const filter = ctx.createBiquadFilter();

          osc.type = "sine";
          // Beat accent frequency sweep
          const startFreq = beatCount % 4 === 0 ? 95 : 75;
          osc.frequency.setValueAtTime(startFreq, now);
          osc.frequency.exponentialRampToValueAtTime(32, now + 0.25);

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(140, now);

          gain.gain.setValueAtTime(0.7, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

          osc.connect(filter);
          filter.connect(gain);
          gain.connect(masterGainNode!);

          osc.start(now);
          osc.stop(now + 0.4);
          activeSynthNodes.push(osc);
        }

        // Orchestral Major/Minor string chords periodic swells
        if (beatCount % 8 === 0) {
          const chords = [
            [146.83, 174.61, 220.00], // D minor chord string triad
            [130.81, 164.81, 196.00], // C major chord string triad
            [116.54, 146.83, 174.61], // Bb major chord string triad
            [110.00, 138.59, 164.81]  // A major brassy sweep
          ];
          const activeChord = chords[(beatCount / 8) % chords.length];

          activeChord.forEach((freq, idx) => {
            const osc = ctx.createOscillator();
            const gain = ctx.createGain();
            const filter = ctx.createBiquadFilter();

            osc.type = "sawtooth";
            osc.frequency.setValueAtTime(freq, now);
            // subtle detuned string texture
            osc.frequency.linearRampToValueAtTime(freq + (idx * 0.4), now + 2);

            filter.type = "lowpass";
            filter.frequency.setValueAtTime(250, now);
            filter.frequency.exponentialRampToValueAtTime(450, now + 1.2);

            gain.gain.setValueAtTime(0, now);
            gain.gain.linearRampToValueAtTime(0.08, now + 0.8);
            gain.gain.exponentialRampToValueAtTime(0.001, now + 2.3);

            osc.connect(filter);
            filter.connect(gain);
            gain.connect(masterGainNode!);

            osc.start(now);
            osc.stop(now + 2.5);
            activeSynthNodes.push(osc);
          });
        }

      } else if (theme.toLowerCase().includes("mysterious")) {
        // --- MYSTERIOUS AMBIENCE ---
        // deep minor key synthesizer drone + high spooky resonance sweep
        
        // Continuous organic heavy drone sweep every 4 ticks
        if (beatCount % 6 === 0) {
          const osc1 = ctx.createOscillator();
          const osc2 = ctx.createOscillator();
          const filter = ctx.createBiquadFilter();
          const gain = ctx.createGain();

          osc1.type = "sawtooth";
          osc1.frequency.setValueAtTime(65.41, now); // C2 frequency
          osc2.type = "triangle";
          osc2.frequency.setValueAtTime(65.91, now); // Slightly detuned

          filter.type = "lowpass";
          filter.frequency.setValueAtTime(110, now);
          filter.Q.setValueAtTime(6, now);
          filter.frequency.linearRampToValueAtTime(240, now + 2.5);
          filter.frequency.linearRampToValueAtTime(110, now + 4.5);

          gain.gain.setValueAtTime(0, now);
          gain.gain.linearRampToValueAtTime(0.2, now + 1.5);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 4.5);

          osc1.connect(filter);
          osc2.connect(filter);
          filter.connect(gain);
          gain.connect(masterGainNode!);

          osc1.start(now);
          osc2.start(now);
          osc1.stop(now + 4.6);
          osc2.stop(now + 4.6);

          activeSynthNodes.push(osc1, osc2);
        }

        // Random crystalline mysterious high chimes on eighth beats
        if (beatCount % 3 === 1) {
          const bellFreqs = [523.25, 587.33, 622.25, 783.99, 880.00, 932.33]; // spooky scale
          const freq = bellFreqs[Math.floor(Math.random() * bellFreqs.length)];

          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          const delayNode = ctx.createDelay();
          const delayGain = ctx.createGain();

          osc.type = "sine";
          osc.frequency.setValueAtTime(freq, now);

          gain.gain.setValueAtTime(0.04, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

          // Feed crystal chime to delay loop
          delayNode.delayTime.setValueAtTime(0.28, now);
          delayGain.gain.setValueAtTime(0.4, now);

          osc.connect(gain);
          gain.connect(masterGainNode!);

          // Feedback loop for eerie echo
          gain.connect(delayNode);
          delayNode.connect(delayGain);
          delayGain.connect(masterGainNode!);
          delayGain.connect(delayNode); // feedback loop

          osc.start(now);
          osc.stop(now + 1.5);
          activeSynthNodes.push(osc);
        }

      } else if (theme.toLowerCase().includes("synth wave") || theme.toLowerCase().includes("cyber")) {
        // --- SCI-FI SYNTH WAVE ---
        // energetic arpeggiated bass sequence + analog filter sweep
        
        // 8-note rapid sequencer pattern
        const notes = [110.00, 110.00, 130.81, 110.00, 146.83, 146.83, 164.81, 130.81]; // Foursome A4 minor drive
        const targetPitch = notes[beatCount % notes.length];

        const osc = ctx.createOscillator();
        const subOsc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(targetPitch, now);
        
        subOsc.type = "triangle";
        subOsc.frequency.setValueAtTime(targetPitch / 2, now); // exact sub octave

        filter.type = "lowpass";
        const sweepFreq = 220 + (Math.sin(beatCount * 0.4) * 160);
        filter.frequency.setValueAtTime(sweepFreq, now);
        filter.Q.setValueAtTime(4, now);

        gain.gain.setValueAtTime(0.09, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.28);

        osc.connect(filter);
        subOsc.connect(filter);
        filter.connect(gain);
        gain.connect(masterGainNode!);

        osc.start(now);
        subOsc.start(now);
        osc.stop(now + 0.3);
        subOsc.stop(now + 0.3);

        activeSynthNodes.push(osc);

        // Heavy kick pulse beat on 0 and 4
        if (beatCount % 4 === 0) {
          const kickOsc = ctx.createOscillator();
          const kickGain = ctx.createGain();
          
          kickOsc.type = "sine";
          kickOsc.frequency.setValueAtTime(125, now);
          kickOsc.frequency.exponentialRampToValueAtTime(36, now + 0.15);

          kickGain.gain.setValueAtTime(0.65, now);
          kickGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

          kickOsc.connect(kickGain);
          kickGain.connect(masterGainNode!);

          kickOsc.start(now);
          kickOsc.stop(now + 0.25);
          activeSynthNodes.push(kickOsc);
        }

      } else if (theme.toLowerCase().includes("melancholy") || theme.toLowerCase().includes("acoustic")) {
        // --- CALM ACOUSTIC MELANCHOLY ---
        // soothing sweet arpeggiating music chimes (acoustic guitar simulation)

        const minorSaga = [
          [220.00, 261.63, 329.63, 440.00], // Am chords
          [196.00, 246.94, 293.66, 392.00], // G chords
          [174.61, 220.00, 261.63, 349.23], // F chords
          [164.81, 207.65, 246.94, 329.63]  // E chords
        ];
        const activeScale = minorSaga[Math.floor(beatCount / 4) % minorSaga.length];
        const activeNote = activeScale[beatCount % activeScale.length];

        const pluckOsc = ctx.createOscillator();
        const sineHarmonic = ctx.createOscillator();
        const gain = ctx.createGain();
        const delayUnit = ctx.createDelay();
        const delayGainUnit = ctx.createGain();

        pluckOsc.type = "triangle";
        pluckOsc.frequency.setValueAtTime(activeNote, now);

        sineHarmonic.type = "sine";
        sineHarmonic.frequency.setValueAtTime(activeNote * 2, now); // bright 2nd octave warm harmonic

        gain.gain.setValueAtTime(0.08, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.95);

        // Acoustic reverb/echo loop
        delayUnit.delayTime.setValueAtTime(0.38, now);
        delayGainUnit.gain.setValueAtTime(0.38, now);

        pluckOsc.connect(gain);
        sineHarmonic.connect(gain);
        gain.connect(masterGainNode!);

        gain.connect(delayUnit);
        delayUnit.connect(delayGainUnit);
        delayGainUnit.connect(masterGainNode!);
        delayGainUnit.connect(delayUnit); // loop feedback

        pluckOsc.start(now);
        sineHarmonic.start(now);
        pluckOsc.stop(now + 1.1);
        sineHarmonic.stop(now + 1.1);

        activeSynthNodes.push(pluckOsc);
      }

      beatCount++;
    }, scheduleIntervalMs);

  } catch (err) {
    console.error("[Audio Engine] Background music generator failed start:", err);
  }
}

/**
 * High-quality dynamic comic book sfx sound generator
 * @param sfxText Sound text labels like "[Drums Rumble]" or "[Soft Whoosh]"
 */
export function playComicSoundEffect(sfxText: string) {
  if (!sfxText || sfxText.toLowerCase() === "none") return;
  
  try {
    const ctx = getAudioContext();
    if (ctx.state === "suspended") {
      ctx.resume();
    }
    
    const now = ctx.currentTime;
    const label = sfxText.toLowerCase();

    console.log(`[Audio Engine SFX] Triggering dynamic synthesis of: "${sfxText}"`);

    if (label.includes("chime") || label.includes("shimmer") || label.includes("sparkl") || label.includes("mystic")) {
      // SPOOKY / SPARKLING CHIME (multiple rapid overlapping chime cascades)
      const freqs = [587.33, 739.99, 880.00, 1174.66, 1318.51, 1567.98];
      
      freqs.forEach((freq, index) => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        const scheduledTime = now + (index * 0.06);

        osc.type = "sine";
        osc.frequency.setValueAtTime(freq, scheduledTime);

        gain.gain.setValueAtTime(0.12, scheduledTime);
        gain.gain.exponentialRampToValueAtTime(0.001, scheduledTime + 1.1);

        osc.connect(gain);
        gain.connect(masterGainNode!);

        osc.start(scheduledTime);
        osc.stop(scheduledTime + 1.25);
      });

    } else if (label.includes("strike") || label.includes("blast") || label.includes("impact") || label.includes("boom")) {
      // BOOM / REVERBERATING STRIKE (Heavy dramatic impact with subsonic rumble)
      const subOsc = ctx.createOscillator();
      const waveOsc = ctx.createOscillator();
      const noiseNode = ctx.createBufferSource();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      subOsc.type = "sine";
      subOsc.frequency.setValueAtTime(95, now);
      subOsc.frequency.exponentialRampToValueAtTime(25, now + 0.6);

      waveOsc.type = "triangle";
      waveOsc.frequency.setValueAtTime(140, now);
      waveOsc.frequency.exponentialRampToValueAtTime(45, now + 0.45);

      noiseNode.buffer = getNoiseBuffer(ctx);
      
      filter.type = "lowpass";
      filter.frequency.setValueAtTime(280, now);
      filter.frequency.exponentialRampToValueAtTime(40, now + 0.6);

      gain.gain.setValueAtTime(0.85, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.3);

      subOsc.connect(gain);
      waveOsc.connect(gain);
      noiseNode.connect(filter);
      filter.connect(gain);
      gain.connect(masterGainNode!);

      subOsc.start(now);
      waveOsc.start(now);
      noiseNode.start(now);

      subOsc.stop(now + 1.4);
      waveOsc.stop(now + 1.4);
      noiseNode.stop(now + 1.4);

    } else if (label.includes("whoosh") || label.includes("swipe") || label.includes("wind") || label.includes("slash")) {
      // SWIPE / WHOOSH (Friction noise with rapid frequency filter sweep)
      const noiseSource = ctx.createBufferSource();
      const sweepFilter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      noiseSource.buffer = getNoiseBuffer(ctx);
      
      sweepFilter.type = "bandpass";
      sweepFilter.Q.setValueAtTime(4.5, now);
      sweepFilter.frequency.setValueAtTime(260, now);
      sweepFilter.frequency.exponentialRampToValueAtTime(1850, now + 0.15);
      sweepFilter.frequency.exponentialRampToValueAtTime(120, now + 0.45);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.55, now + 0.08);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);

      noiseSource.connect(sweepFilter);
      sweepFilter.connect(gain);
      gain.connect(masterGainNode!);

      noiseSource.start(now);
      noiseSource.stop(now + 0.52);

    } else if (label.includes("rumble") || label.includes("thunder") || label.includes("footstep") || label.includes("durm")) {
      // LOW DRUMS RUMBLE
      for (let i = 0; i < 6; i++) {
        const sched = now + (i * 0.18);
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = "sine";
        osc.frequency.setValueAtTime(78 - (i * 4), sched);
        osc.frequency.exponentialRampToValueAtTime(28, sched + 0.22);

        gain.gain.setValueAtTime(0.5, sched);
        gain.gain.exponentialRampToValueAtTime(0.001, sched + 0.25);

        osc.connect(gain);
        gain.connect(masterGainNode!);

        osc.start(sched);
        osc.stop(sched + 0.28);
      }

    } else if (label.includes("surge") || label.includes("flare") || label.includes("energy") || label.includes("beam")) {
      // ENERGY FLARE / HYPER SWELL (Detuned sawtooth lasers rising in high scale)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const lpFilter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc1.type = "sawtooth";
      osc1.frequency.setValueAtTime(220, now);
      osc1.frequency.linearRampToValueAtTime(680, now + 0.85);

      osc2.type = "sawtooth";
      osc2.frequency.setValueAtTime(224, now); // slightly detuned chord
      osc2.frequency.linearRampToValueAtTime(686, now + 0.85);

      lpFilter.type = "lowpass";
      lpFilter.frequency.setValueAtTime(1100, now);
      lpFilter.Q.setValueAtTime(5, now);

      gain.gain.setValueAtTime(0, now);
      gain.gain.linearRampToValueAtTime(0.22, now + 0.2);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc1.connect(lpFilter);
      osc2.connect(lpFilter);
      lpFilter.connect(gain);
      gain.connect(masterGainNode!);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 0.95);
      osc2.stop(now + 0.95);

    } else if (label.includes("resonance") || label.includes("growl") || label.includes("low") || label.includes("drone")) {
      // RESONATING DEEP SHOWER DRONE
      const osc = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      osc.type = "sawtooth";
      osc.frequency.setValueAtTime(55.0, now); // very low sub note

      filter.type = "lowpass";
      filter.frequency.setValueAtTime(110, now);
      filter.Q.setValueAtTime(9, now);
      filter.frequency.exponentialRampToValueAtTime(320, now + 0.6);
      filter.frequency.exponentialRampToValueAtTime(90, now + 1.25);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 1.45);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(masterGainNode!);

      osc.start(now);
      osc.stop(now + 1.5);

    } else {
      // DEFAULT FALLBACK SFX (A simple futuristic synthesizer confirmation pop)
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = "sine";
      osc.frequency.setValueAtTime(440, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);

      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

      osc.connect(gain);
      gain.connect(masterGainNode!);

      osc.start(now);
      osc.stop(now + 0.25);
    }
  } catch (err) {
    console.warn("[Audio Engine] Sound effect play trigger bypassed:", err);
  }
}
