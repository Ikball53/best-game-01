// main.js — Venom Rush game loop: states, input, scoring, win/lose, demo scenes.
(function () {
  'use strict';
  var canvas = document.getElementById('game');
  var ctx = canvas.getContext('2d');
  var ARENA = Arena.ARENA_SIZE;

  var PLAYER_SKINS = [
    { name: 'Neon Lime', colors: ['#7dff5e', '#2a8f2a'] },
    { name: 'Ocean', colors: ['#2de2ff', '#0a2a4d'] },
    { name: 'Sunset', colors: ['#ff7b3d', '#ff2e63'] },
    { name: 'Candy', colors: ['#ff5ea8', '#b678ff'] },
    { name: 'Gold', colors: ['#ffe14d', '#7a5c00'] },
    { name: 'Rainbow', colors: ['#ff5e5e', '#ffb13d', '#ffe14d', '#7dff5e', '#2de2ff', '#b678ff'] }
  ];

  var params = new URLSearchParams(window.location.search);
  var DEMO = params.get('demo') || '';

  var state = 'start'; // start | playing | won | lost
  var player = null;
  var bots = [];
  var boss = null;
  var orbs = [];
  var score = 0, combo = 0, comboTimer = 0, bestCombo = 0;
  var orbsEaten = 0, traps = 0, startTime = 0, playSeconds = 0;
  var magnetTimer = 0, shieldActive = false;
  var rainTimer = 0, rainSpot = null, rainSpotTimer = 0;
  var camX = 0, camY = 0;
  var mouse = { x: 0, y: 0, down: false, active: false };
  var keys = {};
  var playerName = 'eightbal';
  var skinIndex = 0;
  var bestScore = 0, bestLen = 0;
  var confetti = [];
  var lastTs = 0;
  var loseCause = '';
  var demoSnakesSeeded = false;
  var demoNoWin = false; // progress demo scene only: stage a busy mid-game without triggering the win screen

  try {
    bestScore = parseInt(window.localStorage.getItem('venomRushBest') || '0', 10) || 0;
    bestLen = parseInt(window.localStorage.getItem('venomRushBestLen') || '0', 10) || 0;
  } catch (e) { bestScore = 0; bestLen = 0; }

  function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
  }
  window.addEventListener('resize', resize);
  resize();

  function skinForPlayer() {
    var s = PLAYER_SKINS[skinIndex];
    return { name: s.name, colors: s.colors };
  }

  function makePlayer() {
    var skin = skinForPlayer();
    var p = Bots.makeSnake('player', playerName, skin, 'player', ARENA / 2, ARENA / 2, 12, 2.4, 11);
    p.score = 120;
    return p;
  }

  function resetWorld() {
    score = 0; combo = 0; comboTimer = 0; bestCombo = 0;
    orbsEaten = 0; traps = 0; magnetTimer = 0; shieldActive = false;
    rainTimer = 14000; rainSpot = null; rainSpotTimer = 0;
    confetti = [];
    player = makePlayer();
    bots = Bots.spawnBots(ARENA, 14);
    boss = Bots.makeBoss(ARENA);
    orbs = Arena.seedOrbs(ARENA, 340);
    startTime = Date.now();
    playSeconds = 0;
  }

  function allSnakes() {
    var list = [];
    if (player && player.alive) list.push(player);
    bots.forEach(function (b) { if (b.alive) list.push(b); });
    if (boss && boss.alive) list.push(boss);
    return list;
  }

  function leaderboardEntries() {
    var entries = allSnakes().map(function (s) {
      return { name: s.name, score: s.score, isBoss: !!s.isBoss, isPlayer: s.id === 'player' };
    });
    entries.sort(function (a, b) { return b.score - a.score; });
    return entries;
  }

  function playerRank() {
    var entries = leaderboardEntries();
    for (var i = 0; i < entries.length; i++) {
      if (entries[i].isPlayer) return i + 1;
    }
    return entries.length + 1;
  }

  function fmtTime(sec) {
    var m = Math.floor(sec / 60), s = Math.floor(sec % 60);
    return m + ':' + (s < 10 ? '0' : '') + s;
  }

  function statsRows(finalScore) {
    return [
      ['Final Score', finalScore.toLocaleString('en-US')],
      ['Final Length', String(player.pts.length)],
      ['Leaderboard Rank', '#' + playerRank()],
      ['Snakes Trapped', String(traps)],
      ['Orbs Eaten', String(orbsEaten)],
      ['Highest Combo', 'x' + Math.max(1, bestCombo)],
      ['Play Time', fmtTime(playSeconds)],
      ['Best Score', Math.max(bestScore, finalScore).toLocaleString('en-US')]
    ];
  }

  function saveBest() {
    var isRecord = score > bestScore;
    if (isRecord) bestScore = score;
    if (player.pts.length > bestLen) bestLen = player.pts.length;
    try {
      window.localStorage.setItem('venomRushBest', String(bestScore));
      window.localStorage.setItem('venomRushBestLen', String(bestLen));
    } catch (e) {}
    return isRecord;
  }

  function doWin() {
    if (state !== 'playing') return;
    state = 'won';
    playSeconds = (Date.now() - startTime) / 1000;
    var isRecord = saveBest();
    SoundBank.stopAmbient();
    SoundBank.win();
    document.getElementById('win-badge').classList.toggle('hidden', !isRecord);
    GameUI.fillStats(document.getElementById('win-stats'), statsRows(score));
    GameUI.showScreen('win-screen');
    spawnConfetti();
  }

  function doLose(cause) {
    if (state !== 'playing') return;
    state = 'lost';
    loseCause = cause;
    playSeconds = (Date.now() - startTime) / 1000;
    saveBest();
    SoundBank.stopAmbient();
    SoundBank.lose();
    document.getElementById('lose-cause').textContent = cause;
    GameUI.fillStats(document.getElementById('lose-stats'), statsRows(score));
    GameUI.showScreen('lose-screen');
  }

  function spawnConfetti() {
    confetti = [];
    var colors = ['#ffe14d', '#ff7b3d', '#2de2ff', '#7dff5e', '#ff5ea8', '#b678ff'];
    for (var i = 0; i < 160; i++) {
      confetti.push({
        x: Math.random() * canvas.width, y: -20 - Math.random() * 200,
        vx: (Math.random() - 0.5) * 2, vy: 2 + Math.random() * 3,
        color: colors[i % colors.length], size: 5 + Math.random() * 7,
        rot: Math.random() * Math.PI, vr: (Math.random() - 0.5) * 0.2
      });
    }
  }

  function killSnake(snake, killerName) {
    if (!snake.alive) return;
    snake.alive = false;
    Arena.dropOrbsFromSnake(orbs, snake, ARENA);
    if (snake.id === 'player') return;
    if (snake.isBoss) {
      GameUI.pushKillFeed('👑 BOSS GARGANTUA trapped! Orb explosion!', '#ff2e63');
      Arena.spawnOrbRain(orbs, ARENA, 90);
      SoundBank.orbRain();
      score += 500;
      traps++;
    } else {
      var msg = killerName ? (snake.name + ' crashed into ' + killerName + '!') : (snake.name + ' died!');
      GameUI.pushKillFeed('💥 ' + msg, '#ffe14d');
      SoundBank.kill();
      if (killerName === playerName) { score += 150; traps++; }
    }
  }

  function applyEat(snake, eaten, isPlayer) {
    eaten.forEach(function (o) {
      var mult = Math.max(1, combo);
      var pts = o.value * mult;
      if (isPlayer) {
        score += pts;
        orbsEaten++;
        combo++;
        comboTimer = 2200;
        if (combo > bestCombo) bestCombo = combo;
        if (combo > 0 && combo % 5 === 0) SoundBank.comboChime(combo);
        GameUI.addFloater(o.x, o.y, '+' + pts, o.kind === 'gold' ? '#ffe14d' : '#fff');
        if (o.kind === 'gold') SoundBank.goldEat();
        else if (o.kind === 'magnet') { magnetTimer = 6000; SoundBank.shield(); }
        else if (o.kind === 'shield') { shieldActive = true; SoundBank.shield(); }
        else SoundBank.eat(combo);
        Arena.growSnake(snake, o.kind === 'gold' ? 3 : 1);
        snake.score = score;
      } else {
        snake.score += o.value;
        Arena.growSnake(snake, 1);
      }
    });
  }

  function updatePlaying(dt, now) {
    // input -> player target angle
    var head = player.pts[0];
    if (mouse.joyOn) {
      player.targetAngle = mouse.joyAngle;
    } else if (mouse.active) {
      player.targetAngle = Math.atan2(mouse.y - canvas.height / 2, mouse.x - canvas.width / 2);
    } else if (keys['ArrowLeft'] || keys['a']) {
      player.targetAngle = player.angle - 0.09 * dt;
      player.angle = player.targetAngle;
    } else if (keys['ArrowRight'] || keys['d']) {
      player.targetAngle = player.angle + 0.09 * dt;
      player.angle = player.targetAngle;
    } else if (keys['ArrowUp'] || keys['w']) {
      player.targetAngle = -Math.PI / 2;
    } else if (keys['ArrowDown'] || keys['s']) {
      player.targetAngle = Math.PI / 2;
    }
    var wantBoost = mouse.down || keys[' '] || keys['Shift'];
    if (wantBoost && player.pts.length > 12) {
      player.boost = true;
      if (Math.random() < 0.08) {
        player.pts.pop();
        player.targetLen = Math.max(12, player.targetLen - 1);
        var tail = player.pts[player.pts.length - 1];
        orbs.push({ x: tail.x + (Math.random() - 0.5) * 20, y: tail.y + (Math.random() - 0.5) * 20, kind: 'normal', color: Bots.skinColorAt(player.skin, 0), r: 5, pulse: 0, value: 5 });
      }
    } else player.boost = false;

    // combo decay
    if (comboTimer > 0) {
      comboTimer -= dt * 16.7;
      if (comboTimer <= 0) combo = 0;
    }
    if (magnetTimer > 0) magnetTimer -= dt * 16.7;

    // magnet pulls nearby orbs
    if (magnetTimer > 0) {
      orbs.forEach(function (o) {
        var dx = head.x - o.x, dy = head.y - o.y;
        var d = Math.sqrt(dx * dx + dy * dy);
        if (d < 320 && d > 1) { o.x += dx / d * 6; o.y += dy / d * 6; }
      });
    }

    // orb rain event
    rainTimer -= dt * 16.7;
    if (rainTimer <= 0) {
      rainSpot = Arena.spawnOrbRain(orbs, ARENA, 70);
      rainSpotTimer = 6000;
      rainTimer = 22000 + Math.random() * 8000;
      var banner = document.getElementById('event-banner');
      banner.textContent = '🌧 ORB RAIN! Everyone rushes to the feast!';
      banner.classList.remove('hidden');
      SoundBank.orbRain();
      setTimeout(function () { banner.classList.add('hidden'); }, 4000);
    }
    if (rainSpotTimer > 0) rainSpotTimer -= dt * 16.7;

    // move everyone
    Bots.moveSnake(player, dt);
    bots.forEach(function (b) {
      if (!b.alive) return;
      Bots.botSteer(b, orbs, player, ARENA, now);
      b.boost = Math.random() < 0.02;
      Bots.moveSnake(b, dt);
    });
    if (boss.alive) {
      Bots.botSteer(boss, orbs, player, ARENA, now);
      Bots.moveSnake(boss, dt);
    }

    // eating
    allSnakes().forEach(function (sn) {
      var eaten = Arena.eatNearbyOrbs(sn, orbs);
      if (eaten.length) applyEat(sn, eaten, sn.id === 'player');
    });

    // keep orb count topped up
    while (orbs.length < 300) orbs.push(Arena.randomOrb(ARENA));

    // collisions: player vs others
    var snakes = allSnakes();
    for (var i = 0; i < snakes.length; i++) {
      var sn = snakes[i];
      if (!sn.alive) continue;
      if (Arena.headHitsWall(sn, ARENA)) {
        if (sn.id === 'player') {
          if (shieldActive) { shieldActive = false; sn.pts[0].x = ARENA / 2; sn.pts[0].y = ARENA / 2; GameUI.pushKillFeed('🛡 Shield saved you from the wall!', '#2de2ff'); }
          else { Arena.dropOrbsFromSnake(orbs, sn, ARENA); doLose('You hit the arena wall!'); return; }
        } else killSnake(sn, null);
        continue;
      }
      for (var j = 0; j < snakes.length; j++) {
        var other = snakes[j];
        if (!other.alive) continue;
        if (Arena.headHitsBody(sn, other)) {
          if (sn.id === 'player') {
            if (shieldActive) {
              shieldActive = false;
              GameUI.pushKillFeed('🛡 Shield saved you from ' + other.name + '!', '#2de2ff');
              SoundBank.shield();
              sn.pts[0].x += Math.cos(sn.angle) * -60;
              sn.pts[0].y += Math.sin(sn.angle) * -60;
            } else {
              Arena.dropOrbsFromSnake(orbs, sn, ARENA);
              doLose('You crashed into ' + other.name + '!');
              return;
            }
          } else {
            var killer = (other.id === 'player') ? playerName : other.name;
            killSnake(sn, killer);
          }
          break;
        }
      }
    }

    // bot respawn to keep the arena busy
    bots.forEach(function (b, idx) {
      if (!b.alive && Math.random() < 0.004) {
        var fresh = Bots.spawnBots(ARENA, 1)[0];
        fresh.id = b.id;
        fresh.name = b.name;
        bots[idx] = fresh;
      }
    });
    if (!boss.alive && Math.random() < 0.001) boss = Bots.makeBoss(ARENA);

    // win check: Top 3 with 2,500+ score after 60s of play
    if (!demoNoWin && playerRank() <= 3 && score >= 2500 && (Date.now() - startTime) / 1000 >= 60) { doWin(); return; }

    // camera follows player
    var wantCamX = head.x - canvas.width / 2, wantCamY = head.y - canvas.height / 2;
    if (Math.abs(wantCamX - camX) > 400 || Math.abs(wantCamY - camY) > 400) { camX = wantCamX; camY = wantCamY; }
    else { camX += (wantCamX - camX) * 0.35; camY += (wantCamY - camY) * 0.35; }

    // HUD
    document.getElementById('hud-score').textContent = score.toLocaleString('en-US');
    document.getElementById('hud-len').textContent = String(player.pts.length);
    document.getElementById('hud-combo').textContent = 'x' + Math.max(1, combo);
    document.getElementById('hud-rank').textContent = '#' + playerRank();
    document.getElementById('hud-power').textContent =
      (shieldActive ? '🛡 Shield ready  ' : '') + (magnetTimer > 0 ? '🧲 Magnet ' + Math.ceil(magnetTimer / 1000) + 's' : '');
    GameUI.renderLeaderboard(document.getElementById('lb-list'), leaderboardEntries(), playerName);
    GameUI.drawMinimap(document.getElementById('minimap'), player, allSnakes(), ARENA);
  }

  function draw(now, dt) {
    var snakes = allSnakes();
    if (state === 'start') {
      // ambient background: bots drift behind the start panel
      if (!demoSnakesSeeded) {
        bots = Bots.spawnBots(ARENA, 14);
        boss = Bots.makeBoss(ARENA);
        orbs = Arena.seedOrbs(ARENA, 200);
        demoSnakesSeeded = true;
      }
      bots.forEach(function (b) {
        if (!b.alive) return;
        Bots.botSteer(b, orbs, null, ARENA, now);
        Bots.moveSnake(b, dt);
      });
      if (boss && boss.alive) { Bots.botSteer(boss, orbs, null, ARENA, now); Bots.moveSnake(boss, dt); }
      camX = ARENA / 2 - canvas.width / 2 + Math.sin(now / 9000) * 500;
      camY = ARENA / 2 - canvas.height / 2 + Math.cos(now / 11000) * 400;
      GameUI.drawArenaBackground(ctx, camX, camY, canvas.width, canvas.height, ARENA);
      orbs.forEach(function (o) { GameUI.drawOrb(ctx, o, camX, camY, now); });
      snakes.forEach(function (s) { GameUI.drawSnake(ctx, s, camX, camY); });
      GameUI.renderLeaderboard(document.getElementById('start-lb'), leaderboardEntries(), playerName);
      return;
    }
    if (state === 'playing') {
      GameUI.drawArenaBackground(ctx, camX, camY, canvas.width, canvas.height, ARENA);
      orbs.forEach(function (o) { GameUI.drawOrb(ctx, o, camX, camY, now); });
      if (rainSpot && rainSpotTimer > 0) {
        ctx.beginPath();
        ctx.strokeStyle = 'rgba(255,225,77,0.8)';
        ctx.lineWidth = 3;
        ctx.arc(rainSpot.x - camX, rainSpot.y - camY, 60 + Math.sin(now / 200) * 12, 0, Math.PI * 2);
        ctx.stroke();
      }
      snakes.forEach(function (s) { GameUI.drawSnake(ctx, s, camX, camY); });
      GameUI.drawFloaters(ctx, camX, camY, dt);
      return;
    }
    // won / lost: keep the frozen arena behind the panel, draw confetti on win
    GameUI.drawArenaBackground(ctx, camX, camY, canvas.width, canvas.height, ARENA);
    orbs.forEach(function (o) { GameUI.drawOrb(ctx, o, camX, camY, now); });
    snakes.forEach(function (s) { GameUI.drawSnake(ctx, s, camX, camY); });
    if (state === 'won') {
      confetti.forEach(function (c) {
        c.y += c.vy; c.x += c.vx; c.rot += c.vr;
        if (c.y > canvas.height + 20) { c.y = -20; c.x = Math.random() * canvas.width; }
        ctx.save();
        ctx.translate(c.x, c.y);
        ctx.rotate(c.rot);
        ctx.fillStyle = c.color;
        ctx.fillRect(-c.size / 2, -c.size / 4, c.size, c.size / 2);
        ctx.restore();
      });
    }
  }

  function loop(ts) {
    var dt = 1;
    if (lastTs) dt = Math.min(3, (ts - lastTs) / 16.7);
    lastTs = ts;
    if (state === 'playing') updatePlaying(dt, ts);
    draw(ts, dt);
    requestAnimationFrame(loop);
  }

  // ---- input ----
  window.addEventListener('keydown', function (e) {
    keys[e.key] = true;
    if (e.key === ' ') e.preventDefault();
    if (e.key === 'm' || e.key === 'M') toggleMute();
  });
  window.addEventListener('keyup', function (e) { keys[e.key] = false; });
  canvas.addEventListener('mousemove', function (e) { mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; });
  canvas.addEventListener('mousedown', function (e) { mouse.down = true; mouse.x = e.clientX; mouse.y = e.clientY; mouse.active = true; });
  window.addEventListener('mouseup', function () { mouse.down = false; });
  var joyOX = 0, joyOY = 0, joyActive = false;
  canvas.addEventListener('touchstart', function (e) {
    var t = e.touches[0];
    joyOX = t.clientX; joyOY = t.clientY; joyActive = true;
    mouse.active = false; mouse.joyOn = false; mouse.down = false;
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchmove', function (e) {
    var t = e.touches[0];
    if (!joyActive) return;
    var dx = t.clientX - joyOX, dy = t.clientY - joyOY;
    if (dx * dx + dy * dy > 10 * 10) {
      mouse.joyAngle = Math.atan2(dy, dx);
      mouse.joyOn = true;
    }
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', function () { joyActive = false; mouse.joyOn = false; mouse.active = false; mouse.down = false; });
  var boostBtn = document.getElementById('boost-btn');
  if (boostBtn) {
    boostBtn.addEventListener('touchstart', function (e) { mouse.down = true; e.preventDefault(); }, { passive: false });
    boostBtn.addEventListener('touchend', function () { mouse.down = false; });
    boostBtn.addEventListener('mousedown', function () { mouse.down = true; });
    boostBtn.addEventListener('mouseup', function () { mouse.down = false; });
  }

  function toggleMute() {
    var m = SoundBank.toggleMute();
    document.getElementById('mute-btn').textContent = m ? '🔇' : '🔊';
    document.getElementById('start-mute').textContent = m ? '🔇 Sound: OFF' : '🔊 Sound: ON';
  }
  document.getElementById('mute-btn').addEventListener('click', toggleMute);
  document.getElementById('start-mute').addEventListener('click', toggleMute);

  // ---- skin picker ----
  var picker = document.getElementById('skin-picker');
  PLAYER_SKINS.forEach(function (s, i) {
    var div = document.createElement('div');
    div.className = 'skin-opt' + (i === skinIndex ? ' sel' : '');
    div.style.background = 'linear-gradient(135deg,' + s.colors.join(',') + ')';
    div.title = s.name;
    var label = document.createElement('span');
    label.textContent = s.name.slice(0, 4);
    div.appendChild(label);
    div.addEventListener('click', function () {
      skinIndex = i;
      SoundBank.click();
      picker.querySelectorAll('.skin-opt').forEach(function (el, j) { el.classList.toggle('sel', j === i); });
    });
    picker.appendChild(div);
  });

  function startGame() {
    SoundBank.unlock();
    SoundBank.click();
    SoundBank.stopAmbient();
    playerName = (document.getElementById('player-name').value || 'eightbal').trim().slice(0, 12) || 'eightbal';
    resetWorld();
    state = 'playing';
    GameUI.showScreen(null);
    document.getElementById('best-score').textContent = bestScore.toLocaleString('en-US');
    document.getElementById('best-len').textContent = String(bestLen);
  }
  document.getElementById('play-btn').addEventListener('click', startGame);
  document.getElementById('win-again').addEventListener('click', function () { SoundBank.click(); resetWorld(); state = 'playing'; GameUI.showScreen(null); });
  document.getElementById('win-skin').addEventListener('click', function () { SoundBank.click(); state = 'start'; demoSnakesSeeded = false; GameUI.showScreen('start-screen'); SoundBank.startAmbient(); });
  document.getElementById('lose-again').addEventListener('click', function () { SoundBank.click(); resetWorld(); state = 'playing'; GameUI.showScreen(null); });
  document.getElementById('lose-menu').addEventListener('click', function () { SoundBank.click(); state = 'start'; demoSnakesSeeded = false; GameUI.showScreen('start-screen'); SoundBank.startAmbient(); });

  document.getElementById('best-score').textContent = bestScore.toLocaleString('en-US');
  document.getElementById('best-len').textContent = String(bestLen);
  GameUI.showScreen('start-screen');
  SoundBank.startAmbient();

  // ---- demo scenes for screenshots (query param ?demo=...) ----
  function applyDemo() {
    if (DEMO === 'game' || DEMO === 'progress' || DEMO === 'win' || DEMO === 'lose') {
      playerName = 'eightbal';
      resetWorld();
      // seed a busy scene: extra orbs around the player and bots nearby
      var hp = player.pts[0];
      for (var i = 0; i < 90; i++) orbs.push(Arena.randomOrb(ARENA, hp.x, hp.y, 900));
      bots.forEach(function (b, idx) {
        b.pts[0].x = hp.x + (Math.random() - 0.5) * 900;
        b.pts[0].y = hp.y + (Math.random() - 0.5) * 700;
        for (var j = 1; j < b.pts.length; j++) { b.pts[j].x = b.pts[0].x - j * 9; b.pts[j].y = b.pts[0].y; }
      });
      state = 'playing';
      GameUI.showScreen(null);
      if (DEMO === 'progress') {
        demoNoWin = true;
        score = 600; // keep below Top 3 so the demo stays in gameplay, not the win screen
        combo = 9; bestCombo = 12;
        orbsEaten = 214; traps = 4;
        Arena.growSnake(player, 90);
        player.score = score;
        rainSpot = { x: hp.x + 250, y: hp.y - 150 };
        rainSpotTimer = 99999;
        for (var k = 0; k < 60; k++) orbs.push(Arena.randomOrb(ARENA, rainSpot.x, rainSpot.y, 500));
        GameUI.pushKillFeed('💥 Zara crashed into eightbal!', '#ffe14d');
        GameUI.pushKillFeed('👑 BOSS GARGANTUA is near!', '#ff2e63');
      }
      if (DEMO === 'win') {
        score = 9200;
        orbsEaten = 342; traps = 7; bestCombo = 15;
        Arena.growSnake(player, 120);
        player.score = score;
        startTime = Date.now() - 187000;
        doWin();
      }
      if (DEMO === 'lose') {
        score = 1240;
        orbsEaten = 96; traps = 2; bestCombo = 6;
        Arena.growSnake(player, 40);
        player.score = score;
        startTime = Date.now() - 94000;
        doLose('You crashed into Vex!');
      }
    }
  }
  applyDemo();

  requestAnimationFrame(loop);
})();
