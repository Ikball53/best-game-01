// arena.js — the arena: orbs, orb-rain events, collisions and death drops.
(function () {
  var ARENA_SIZE = 4200;
  var ORB_COLORS = ['#7dff5e', '#2de2ff', '#ff5ea8', '#ffe14d', '#b678ff', '#ff8c42'];
  var ORB_KINDS = ['normal', 'normal', 'normal', 'normal', 'normal', 'normal', 'gold', 'magnet', 'shield'];

  function randomOrb(arenaSize, cx, cy, spread) {
    var x, y;
    if (cx !== undefined) {
      x = cx + (Math.random() - 0.5) * spread;
      y = cy + (Math.random() - 0.5) * spread;
    } else {
      x = 80 + Math.random() * (arenaSize - 160);
      y = 80 + Math.random() * (arenaSize - 160);
    }
    var roll = Math.random();
    var kind = 'normal';
    if (roll < 0.05) kind = 'gold';
    else if (roll < 0.09) kind = 'magnet';
    else if (roll < 0.13) kind = 'shield';
    return {
      x: Math.max(40, Math.min(arenaSize - 40, x)),
      y: Math.max(40, Math.min(arenaSize - 40, y)),
      kind: kind,
      color: kind === 'gold' ? '#ffe14d' : (kind === 'magnet' ? '#ff5ea8' : (kind === 'shield' ? '#2de2ff' : ORB_COLORS[Math.floor(Math.random() * ORB_COLORS.length)])),
      r: kind === 'gold' ? 9 : 6,
      pulse: Math.random() * Math.PI * 2,
      value: kind === 'gold' ? 50 : 10
    };
  }

  function seedOrbs(arenaSize, count) {
    var orbs = [];
    for (var i = 0; i < count; i++) orbs.push(randomOrb(arenaSize));
    return orbs;
  }

  function spawnOrbRain(orbs, arenaSize, count) {
    var cx = 400 + Math.random() * (arenaSize - 800);
    var cy = 400 + Math.random() * (arenaSize - 800);
    for (var i = 0; i < count; i++) orbs.push(randomOrb(arenaSize, cx, cy, 700));
    return { x: cx, y: cy };
  }

  // A dead snake bursts into a trail of orbs along its body.
  function dropOrbsFromSnake(orbs, snake, arenaSize) {
    var step = snake.isBoss ? 1 : 2;
    for (var i = 0; i < snake.pts.length; i += step) {
      var p = snake.pts[i];
      orbs.push({
        x: p.x + (Math.random() - 0.5) * 30,
        y: p.y + (Math.random() - 0.5) * 30,
        kind: (i % 17 === 0) ? 'gold' : 'normal',
        color: Bots.skinColorAt(snake.skin, i),
        r: 7, pulse: Math.random() * 6, value: 10
      });
    }
    if (orbs.length > 1400) orbs.splice(0, orbs.length - 1400);
  }

  function dist2(ax, ay, bx, by) {
    var dx = ax - bx, dy = ay - by;
    return dx * dx + dy * dy;
  }

  // Head of snake A vs body segments of snake B. Returns true on crash.
  function headHitsBody(headSnake, bodySnake) {
    var h = headSnake.pts[0];
    var start = (headSnake === bodySnake) ? 12 : 2;
    var pts = bodySnake.pts;
    var rr = bodySnake.radius + headSnake.radius * 0.6;
    for (var i = start; i < pts.length; i += 2) {
      if (dist2(h.x, h.y, pts[i].x, pts[i].y) < rr * rr) return true;
    }
    return false;
  }

  function headHitsWall(snake, arenaSize) {
    var h = snake.pts[0];
    return h.x < 30 || h.y < 30 || h.x > arenaSize - 30 || h.y > arenaSize - 30;
  }

  // Eat orbs near a snake head. Returns list of eaten orbs.
  function eatNearbyOrbs(snake, orbs) {
    var h = snake.pts[0];
    var eaten = [];
    var reach = snake.radius + 14;
    for (var i = orbs.length - 1; i >= 0; i--) {
      var o = orbs[i];
      if (dist2(h.x, h.y, o.x, o.y) < reach * reach) {
        eaten.push(o);
        orbs.splice(i, 1);
      }
    }
    return eaten;
  }

  function growSnake(snake, amount) {
    snake.targetLen = (snake.targetLen || snake.pts.length) + amount;
    for (var i = 0; i < amount; i++) {
      var tail = snake.pts[snake.pts.length - 1];
      snake.pts.push({ x: tail.x, y: tail.y });
    }
  }

  window.Arena = {
    ARENA_SIZE: ARENA_SIZE, ORB_KINDS: ORB_KINDS,
    randomOrb: randomOrb, seedOrbs: seedOrbs, spawnOrbRain: spawnOrbRain,
    dropOrbsFromSnake: dropOrbsFromSnake, headHitsBody: headHitsBody,
    headHitsWall: headHitsWall, eatNearbyOrbs: eatNearbyOrbs, growSnake: growSnake,
    dist2: dist2
  };
})();
