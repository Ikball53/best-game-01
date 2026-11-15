// ui.js — rendering the arena, HUD, leaderboard, minimap, kill feed and screens.
(function () {
  var floaters = [];

  function addFloater(x, y, text, color) {
    floaters.push({ x: x, y: y, text: text, color: color || '#fff', life: 1 });
    if (floaters.length > 40) floaters.shift();
  }

  function drawSnake(ctx, snake, camX, camY) {
    var pts = snake.pts;
    for (var i = pts.length - 1; i >= 1; i--) {
      var p = pts[i];
      var r = snake.radius * (1 - i / (pts.length + 30) * 0.35);
      ctx.beginPath();
      ctx.fillStyle = Bots.skinColorAt(snake.skin, i);
      ctx.arc(p.x - camX, p.y - camY, Math.max(3, r), 0, Math.PI * 2);
      ctx.fill();
    }
    var h = pts[0];
    ctx.beginPath();
    ctx.fillStyle = Bots.skinColorAt(snake.skin, 0);
    ctx.arc(h.x - camX, h.y - camY, snake.radius + 2, 0, Math.PI * 2);
    ctx.fill();
    // eyes
    var ex = Math.cos(snake.angle), ey = Math.sin(snake.angle);
    var px = -ey, py = ex;
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(h.x - camX + ex * snake.radius * 0.5 + px * snake.radius * 0.45, h.y - camY + ey * snake.radius * 0.5 + py * snake.radius * 0.45, snake.radius * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(h.x - camX + ex * snake.radius * 0.5 - px * snake.radius * 0.45, h.y - camY + ey * snake.radius * 0.5 - py * snake.radius * 0.45, snake.radius * 0.28, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#111';
    ctx.beginPath(); ctx.arc(h.x - camX + ex * snake.radius * 0.7 + px * snake.radius * 0.45, h.y - camY + ey * snake.radius * 0.7 + py * snake.radius * 0.45, snake.radius * 0.14, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(h.x - camX + ex * snake.radius * 0.7 - px * snake.radius * 0.45, h.y - camY + ey * snake.radius * 0.7 - py * snake.radius * 0.45, snake.radius * 0.14, 0, Math.PI * 2); ctx.fill();
    // name tag
    ctx.font = 'bold 13px Verdana, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.fillText(snake.name, h.x - camX, h.y - camY - snake.radius - 8);
    if (snake.isBoss) {
      ctx.font = 'bold 15px Verdana, sans-serif';
      ctx.fillStyle = '#ff2e63';
      ctx.fillText('👑 BOSS', h.x - camX, h.y - camY - snake.radius - 26);
    }
  }

  function drawOrb(ctx, o, camX, camY, now) {
    var pulse = 1 + Math.sin(now / 300 + o.pulse) * 0.18;
    var r = o.r * pulse;
    ctx.beginPath();
    ctx.fillStyle = o.color;
    ctx.globalAlpha = 0.35;
    ctx.arc(o.x - camX, o.y - camY, r * 2.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
    ctx.beginPath();
    ctx.arc(o.x - camX, o.y - camY, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.beginPath();
    ctx.arc(o.x - camX - r * 0.3, o.y - camY - r * 0.3, r * 0.35, 0, Math.PI * 2);
    ctx.fill();
    if (o.kind === 'gold') {
      ctx.font = 'bold 10px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#7a5c00';
      ctx.fillText('★', o.x - camX, o.y - camY + 3.5);
    } else if (o.kind === 'magnet') {
      ctx.font = 'bold 10px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText('🧲', o.x - camX, o.y - camY + 3.5);
    } else if (o.kind === 'shield') {
      ctx.font = 'bold 10px Verdana, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillStyle = '#fff';
      ctx.fillText('🛡', o.x - camX, o.y - camY + 3.5);
    }
  }

  function drawArenaBackground(ctx, camX, camY, w, h, arenaSize) {
    ctx.fillStyle = '#0d1530';
    ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = 'rgba(45,226,255,0.10)';
    ctx.lineWidth = 1;
    var grid = 120;
    var startX = -((camX % grid) + grid) % grid;
    var startY = -((camY % grid) + grid) % grid;
    ctx.beginPath();
    for (var x = startX; x < w; x += grid) { ctx.moveTo(x, 0); ctx.lineTo(x, h); }
    for (var y = startY; y < h; y += grid) { ctx.moveTo(0, y); ctx.lineTo(w, y); }
    ctx.stroke();
    // arena border
    ctx.strokeStyle = '#ff2e63';
    ctx.lineWidth = 6;
    ctx.strokeRect(-camX, -camY, arenaSize, arenaSize);
  }

  function drawFloaters(ctx, camX, camY, dt) {
    ctx.font = 'bold 16px Verdana, sans-serif';
    ctx.textAlign = 'center';
    for (var i = floaters.length - 1; i >= 0; i--) {
      var f = floaters[i];
      f.life -= dt * 0.012;
      f.y -= dt * 0.05;
      if (f.life <= 0) { floaters.splice(i, 1); continue; }
      ctx.globalAlpha = Math.min(1, f.life);
      ctx.fillStyle = f.color;
      ctx.fillText(f.text, f.x - camX, f.y - camY);
    }
    ctx.globalAlpha = 1;
  }

  function drawMinimap(canvas, player, snakes, arenaSize) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width, h = canvas.height;
    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = 'rgba(13,21,48,0.9)';
    ctx.fillRect(0, 0, w, h);
    var s = w / arenaSize;
    snakes.forEach(function (sn) {
      if (!sn.alive) return;
      var head = sn.pts[0];
      ctx.fillStyle = sn.isBoss ? '#ff2e63' : Bots.skinColorAt(sn.skin, 0);
      ctx.beginPath();
      ctx.arc(head.x * s, head.y * s, sn.isBoss ? 6 : 3.5, 0, Math.PI * 2);
      ctx.fill();
    });
    if (player && player.alive) {
      var hp = player.pts[0];
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(hp.x * s, hp.y * s, 7, 0, Math.PI * 2);
      ctx.stroke();
    }
  }

  function renderLeaderboard(el, entries, meName) {
    if (!el) return;
    el.innerHTML = '';
    entries.slice(0, 10).forEach(function (e, i) {
      var li = document.createElement('li');
      if (e.name === meName) li.className = 'me';
      var rank = document.createElement('span');
      rank.textContent = (i + 1) + '. ' + e.name + (e.isBoss ? ' 👑' : '');
      var sc = document.createElement('span');
      sc.textContent = e.score.toLocaleString('en-US');
      li.appendChild(rank);
      li.appendChild(sc);
      el.appendChild(li);
    });
  }

  function pushKillFeed(text, color) {
    var feed = document.getElementById('killfeed');
    if (!feed) return;
    var div = document.createElement('div');
    div.textContent = text;
    div.style.color = color || '#ffe14d';
    feed.appendChild(div);
    while (feed.children.length > 4) feed.removeChild(feed.firstChild);
    setTimeout(function () { if (div.parentNode) div.parentNode.removeChild(div); }, 4500);
  }

  function showScreen(id) {
    ['start-screen', 'win-screen', 'lose-screen'].forEach(function (s) {
      document.getElementById(s).classList.toggle('hidden', s !== id);
    });
    document.getElementById('hud').classList.toggle('hidden', id !== null);
  }

  function fillStats(el, stats) {
    if (!el) return;
    el.innerHTML = '';
    stats.forEach(function (row) {
      var div = document.createElement('div');
      var span = document.createElement('span');
      span.textContent = row[0];
      var b = document.createElement('b');
      b.textContent = row[1];
      div.appendChild(span);
      div.appendChild(b);
      el.appendChild(div);
    });
  }

  window.GameUI = {
    addFloater: addFloater, drawSnake: drawSnake, drawOrb: drawOrb,
    drawArenaBackground: drawArenaBackground, drawFloaters: drawFloaters,
    drawMinimap: drawMinimap, renderLeaderboard: renderLeaderboard,
    pushKillFeed: pushKillFeed, showScreen: showScreen, fillStats: fillStats
  };
})();
