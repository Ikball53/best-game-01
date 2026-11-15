// audio.js — every sound is synthesized live with WebAudio. No audio files, no network.
(function () {
  var ctx = null;
  var muted = false;
  var ambientTimer = null;
  var ambientOn = false;

  function ensureCtx() {
    if (!ctx) {
      var AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return null;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function tone(freq, dur, type, vol, slideTo, delay) {
    if (muted) return;
    var c = ensureCtx();
    if (!c) return;
    var t0 = c.currentTime + (delay || 0);
    var osc = c.createOscillator();
    var gain = c.createGain();
    osc.type = type || 'sine';
    osc.frequency.setValueAtTime(freq, t0);
    if (slideTo) osc.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t0 + dur);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(vol || 0.18, t0 + 0.012);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    osc.connect(gain);
    gain.connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + dur + 0.05);
  }

  function noiseBurst(dur, vol) {
    if (muted) return;
    var c = ensureCtx();
    if (!c) return;
    var len = Math.floor(c.sampleRate * dur);
    var buf = c.createBuffer(1, len, c.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = c.createBufferSource();
    src.buffer = buf;
    var gain = c.createGain();
    gain.gain.value = vol || 0.2;
    var filt = c.createBiquadFilter();
    filt.type = 'lowpass';
    filt.frequency.value = 1200;
    src.connect(filt); filt.connect(gain); gain.connect(c.destination);
    src.start();
  }

  var SoundBank = {
    isMuted: function () { return muted; },
    toggleMute: function () {
      muted = !muted;
      if (muted) this.stopAmbient();
      return muted;
    },
    unlock: function () { ensureCtx(); },
    click: function () { tone(700, 0.07, 'square', 0.10); },
    eat: function (combo) {
      var base = 520 + Math.min(combo || 0, 12) * 28;
      tone(base, 0.09, 'sine', 0.16, base * 1.6);
    },
    goldEat: function () { tone(880, 0.12, 'triangle', 0.2, 1760); tone(1320, 0.14, 'sine', 0.12, 0, 0.06); },
    comboChime: function (level) {
      tone(660 + level * 40, 0.1, 'triangle', 0.14);
      tone(990 + level * 40, 0.12, 'triangle', 0.12, 0, 0.07);
    },
    kill: function () {
      noiseBurst(0.25, 0.28);
      tone(220, 0.3, 'sawtooth', 0.14, 880);
    },
    boost: function () { noiseBurst(0.18, 0.10); tone(300, 0.18, 'sine', 0.08, 900); },
    orbRain: function () { tone(1046, 0.15, 'sine', 0.14); tone(1318, 0.15, 'sine', 0.14, 0, 0.1); tone(1568, 0.2, 'sine', 0.14, 0, 0.2); },
    shield: function () { tone(440, 0.15, 'triangle', 0.16, 660); tone(660, 0.2, 'triangle', 0.12, 0, 0.1); },
    win: function () {
      var notes = [523, 659, 784, 1046, 1318, 1568];
      for (var i = 0; i < notes.length; i++) tone(notes[i], 0.28, 'triangle', 0.18, 0, i * 0.13);
      tone(2093, 0.5, 'sine', 0.12, 0, 0.85);
    },
    lose: function () {
      var notes = [392, 330, 262, 196];
      for (var i = 0; i < notes.length; i++) tone(notes[i], 0.35, 'sawtooth', 0.12, 0, i * 0.18);
    },
    startAmbient: function () {
      if (ambientOn || muted) return;
      ambientOn = true;
      ensureCtx();
      var notes = [262, 330, 392, 494, 392, 330];
      var idx = 0;
      var self = this;
      function step() {
        if (!ambientOn) return;
        if (!muted) tone(notes[idx % notes.length], 1.6, 'sine', 0.035);
        idx++;
        ambientTimer = setTimeout(step, 900);
      }
      step();
    },
    stopAmbient: function () {
      ambientOn = false;
      if (ambientTimer) { clearTimeout(ambientTimer); ambientTimer = null; }
    }
  };

  window.SoundBank = SoundBank;
})();
