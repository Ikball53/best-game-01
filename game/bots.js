// bots.js — rival snakes: colours, patterns, sizes and personalities.
(function () {
  var BOT_NAMES = ['Vex', 'Luna', 'Turbo', 'Milo', 'Zara', 'Pip', 'Rex', 'Nova', 'Kiko', 'Bella', 'Onyx', 'Salsa', 'Frost', 'Ember'];
  var BOT_SKINS = [
    { name: 'rainbow', colors: ['#ff5e5e', '#ffb13d', '#ffe14d', '#7dff5e', '#2de2ff', '#b678ff'] },
    { name: 'stripe', colors: ['#ff7b3d', '#1a1a2e'] },
    { name: 'spots', colors: ['#7dff5e', '#0a5c2e'] },
    { name: 'stripe', colors: ['#2de2ff', '#0a2a4d'] },
    { name: 'solid', colors: ['#ff5ea8'] },
    { name: 'rainbow', colors: ['#ffe14d', '#ff7b3d', '#ff5e5e', '#b678ff', '#2de2ff', '#7dff5e'] },
    { name: 'stripe', colors: ['#b678ff', '#2a0a4d'] },
    { name: 'spots', colors: ['#ffe14d', '#7a5c00'] },
    { name: 'solid', colors: ['#2de2ff'] },
    { name: 'stripe', colors: ['#ff5e5e', '#fff'] },
    { name: 'spots', colors: ['#9fd8ff', '#0a2a4d'] },
    { name: 'solid', colors: ['#ff8c42'] },
    { name: 'rainbow', colors: ['#7dff5e', '#2de2ff', '#b678ff', '#ff5ea8', '#ffe14d'] },
    { name: 'stripe', colors: ['#7dff5e', '#0a2a1a'] }
  ];
  // behaviour: 'chaser' hunts orbs aggressively, 'roamer' wanders, 'hunter' chases the player, 'coward' flees big snakes
  var BOT_BEHAVIOURS = ['chaser', 'roamer', 'chaser', 'hunter', 'roamer', 'chaser', 'coward', 'roamer', 'hunter', 'chaser', 'roamer', 'coward', 'chaser', 'roamer'];

  function skinColorAt(skin, index) {
    if (skin.name === 'rainbow') return skin.colors[index % skin.colors.length];
    if (skin.name === 'stripe') return skin.colors[Math.floor(index / 3) % skin.colors.length];
    if (skin.name === 'spots') return (index % 5 === 0) ? skin.colors[1] : skin.colors[0];
    return skin.colors[0];
  }

  function makeSnake(id, name, skin, behaviour, x, y, len, speed, radius) {
    var pts = [];
    for (var i = 0; i < len; i++) pts.push({ x: x - i * 10, y: y });
    return {
      id: id, name: name, skin: skin, behaviour: behaviour,
      pts: pts, angle: 0, speed: speed, baseSpeed: speed,
      radius: radius, score: len * 10, alive: true, targetLen: len, turnRate: id === 'player' ? 0.2 : 0.12,
      targetAngle: Math.random() * Math.PI * 2,
      retargetIn: 0, boost: false, shield: false
    };
  }

  function spawnBots(arenaSize, count) {
    var bots = [];
    for (var i = 0; i < count; i++) {
      var big = (i % 5 === 0);
      var small = (i % 4 === 1);
      var len = big ? 55 + Math.floor(Math.random() * 25) : (small ? 10 + Math.floor(Math.random() * 6) : 22 + Math.floor(Math.random() * 18));
      var speed = small ? 2.6 + Math.random() * 0.5 : (big ? 1.3 : 1.9 + Math.random() * 0.4);
      var radius = big ? 15 : (small ? 7 : 10);
      var x = 300 + Math.random() * (arenaSize - 600);
      var y = 300 + Math.random() * (arenaSize - 600);
      var dx0 = x - arenaSize / 2, dy0 = y - arenaSize / 2;
      while (dx0 * dx0 + dy0 * dy0 < 700 * 700) {
        x = 300 + Math.random() * (arenaSize - 600);
        y = 300 + Math.random() * (arenaSize - 600);
        dx0 = x - arenaSize / 2; dy0 = y - arenaSize / 2;
      }
      var bot = makeSnake('bot' + i, BOT_NAMES[i % BOT_NAMES.length], BOT_SKINS[i % BOT_SKINS.length], BOT_BEHAVIOURS[i % BOT_BEHAVIOURS.length], x, y, len, speed, radius);
      bot.score = len * 10 + Math.floor(Math.random() * 900);
      bots.push(bot);
    }
    return bots;
  }

  function makeBoss(arenaSize) {
    var boss = makeSnake('boss', 'GARGANTUA', { name: 'stripe', colors: ['#ff2e63', '#1a0a1a'] }, 'roamer',
      300, arenaSize - 300, 130, 1.0, 26);
    boss.score = 5200;
    boss.isBoss = true;
    return boss;
  }

  // Pick a steering target for a bot: nearest orb, the player, or a wander point.
  function botSteer(bot, orbs, player, arenaSize, now) {
    bot.retargetIn -= 1;
    if (bot.retargetIn > 0) return bot.targetAngle;
    bot.retargetIn = 25 + Math.floor(Math.random() * 40);
    var head = bot.pts[0];
    var tx, ty;
    if (bot.behaviour === 'hunter' && player && player.alive) {
      tx = player.pts[0].x; ty = player.pts[0].y;
      if (Math.random() < 0.3) { tx += (Math.random() - 0.5) * 500; ty += (Math.random() - 0.5) * 500; }
    } else if (bot.behaviour === 'coward' && player && player.alive && player.pts.length > bot.pts.length + 20) {
      tx = head.x + (head.x - player.pts[0].x);
      ty = head.y + (head.y - player.pts[0].y);
    } else {
      var best = null, bestD = 1e12;
      for (var i = 0; i < orbs.length; i++) {
        var o = orbs[i];
        var dx = o.x - head.x, dy = o.y - head.y;
        var d = dx * dx + dy * dy;
        var w = o.kind === 'gold' ? 0.25 : 1;
        if (d * w < bestD) { bestD = d * w; best = o; }
      }
      if (best) { tx = best.x; ty = best.y; }
      else { tx = head.x + (Math.random() - 0.5) * 800; ty = head.y + (Math.random() - 0.5) * 800; }
    }
    // stay inside the arena
    if (tx < 120 || tx > arenaSize - 120 || ty < 120 || ty > arenaSize - 120) {
      tx = arenaSize / 2 + (Math.random() - 0.5) * 600;
      ty = arenaSize / 2 + (Math.random() - 0.5) * 600;
    }
    bot.targetAngle = Math.atan2(ty - head.y, tx - head.x);
    return bot.targetAngle;
  }

  function moveSnake(snake, dt) {
    var head = snake.pts[0];
    var turn = (snake.turnRate || 0.12) * dt;
    var diff = snake.targetAngle - snake.angle;
    while (diff > Math.PI) diff -= Math.PI * 2;
    while (diff < -Math.PI) diff += Math.PI * 2;
    if (diff > turn) snake.angle += turn;
    else if (diff < -turn) snake.angle -= turn;
    else snake.angle = snake.targetAngle;
    var sp = snake.speed * (snake.boost ? 1.9 : 1) * dt;
    var nx = head.x + Math.cos(snake.angle) * sp;
    var ny = head.y + Math.sin(snake.angle) * sp;
    snake.pts.unshift({ x: nx, y: ny });
    // keep segment spacing roughly constant
    var spacing = snake.radius * 0.9;
    for (var i = 1; i < snake.pts.length; i++) {
      var p = snake.pts[i - 1], q = snake.pts[i];
      var dx = q.x - p.x, dy = q.y - p.y;
      var d = Math.sqrt(dx * dx + dy * dy) || 1;
      var want = spacing;
      q.x = p.x + dx / d * want;
      q.y = p.y + dy / d * want;
    }
    // moving adds a head point; drop tail points so the snake only grows by eating
    while (snake.pts.length > snake.targetLen) snake.pts.pop();
    if (snake.pts.length > 400) snake.pts.length = 400;
  }

  window.Bots = {
    BOT_NAMES: BOT_NAMES, BOT_SKINS: BOT_SKINS,
    skinColorAt: skinColorAt, spawnBots: spawnBots, makeBoss: makeBoss,
    botSteer: botSteer, moveSnake: moveSnake, makeSnake: makeSnake
  };
})();
