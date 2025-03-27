const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');
const minimapCanvas = document.getElementById('minimap');
const minimapCtx = minimapCanvas.getContext('2d');

function resizeCanvas() {
    const isMobile = window.innerWidth <= 768;
    canvas.width = isMobile ? window.innerWidth - 20 : Math.min(window.innerWidth - 440, 1200);
    canvas.height = isMobile ? window.innerHeight - 20 : Math.min(window.innerHeight - 20, 800);
    minimapCanvas.width = minimapCanvas.offsetWidth;
    minimapCanvas.height = minimapCanvas.offsetHeight;
}
resizeCanvas();
window.addEventListener('resize', resizeCanvas);

const WORLD_WIDTH = 4000;
const WORLD_HEIGHT = 4000;
const GRID_SIZE = 50;

const player = {
    x: WORLD_WIDTH / 2,
    y: WORLD_HEIGHT / 2,
    size: 25,
    speed: 6,
    weaponLevel: 1,
    weaponCooldown: 0,
    resources: { wood: 150, stone: 150, gold: 75 },
    score: 0,
    mana: 100,
    maxMana: 100
};

const camera = {
    x: player.x - canvas.width / 2,
    y: player.y - canvas.height / 2,
    follow: function(target) {
        this.x = Math.max(0, Math.min(WORLD_WIDTH - canvas.width, target.x - canvas.width / 2));
        this.y = Math.max(0, Math.min(WORLD_HEIGHT - canvas.height, target.y - canvas.height / 2));
    }
};

const structures = [];
const projectiles = [];
const zombies = [];
const helpers = [];
const resourceNodes = [];
const effects = [];
const zombieNests = [];

let isGameOver = false;

function isOverlapping(x, y, size, existingObjects) {
    return existingObjects.some(obj => Math.hypot(x - obj.x, y - obj.y) < (size + obj.size) / 2 + 20);
}

function placeObject(size, existingObjects, maxAttempts = 100) {
    let attempts = 0;
    let x, y;
    do {
        x = Math.random() * (WORLD_WIDTH - size) + size / 2;
        y = Math.random() * (WORLD_HEIGHT - size) + size / 2;
        attempts++;
        if (attempts >= maxAttempts) return null;
    } while (isOverlapping(x, y, size, existingObjects));
    return { x, y, size };
}

const biomes = [
    { type: 'wood', count: 20 },
    { type: 'stone', count: 15 },
    { type: 'gold', count: 10 }
];

function initializeWorld() {
    resourceNodes.length = 0;
    zombieNests.length = 0;
    biomes.forEach(biome => {
        for (let i = 0; i < biome.count; i++) {
            const pos = placeObject(80, resourceNodes);
            if (pos) {
                resourceNodes.push({
                    type: biome.type,
                    x: pos.x,
                    y: pos.y,
                    size: pos.size,
                    hp: 200,
                    maxHp: 200
                });
            }
        }
    });
    for (let i = 0; i < 5; i++) {
        const pos = placeObject(100, zombieNests.concat(structures, resourceNodes));
        if (pos) zombieNests.push({ x: pos.x, y: pos.y, size: 100 });
    }
}

let wave = 1;
let isDay = true;
let cycleTime = 0;
const cycleDuration = 30;
let wallLevel = 1;
let towerLevel = 1;

const resourcesDisplay = document.getElementById('resources');
const scoreDisplay = document.getElementById('score');
const waveDisplay = document.getElementById('wave');
const dayNightDisplay = document.getElementById('dayNight');
const cycleTimeDisplay = document.getElementById('cycleTime');
const helperCountDisplay = document.getElementById('helperCount');
const manaDisplay = document.getElementById('mana');
const shopButton = document.getElementById('shopButton');
const shopModal = document.getElementById('shopModal');
const closeShop = document.getElementById('closeShop');

shopButton.addEventListener('click', () => {
    shopModal.style.display = 'block';
});

closeShop.addEventListener('click', () => {
    shopModal.style.display = 'none';
});

const joystick = document.getElementById('joystick');
const joystickKnob = document.getElementById('joystickKnob');
let joystickActive = false;
let joystickOrigin = { x: 0, y: 0 };
let joystickVector = { x: 0, y: 0 };

joystick.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    joystickOrigin = { x: touch.clientX, y: touch.clientY };
    joystickActive = true;
});

joystick.addEventListener('touchmove', (e) => {
    e.preventDefault();
    if (joystickActive) {
        const touch = e.touches[0];
        const dx = touch.clientX - joystickOrigin.x;
        const dy = touch.clientY - joystickOrigin.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const maxDistance = 60;
        const angle = Math.atan2(dy, dx);
        joystickVector.x = Math.cos(angle) * Math.min(distance, maxDistance);
        joystickVector.y = Math.sin(angle) * Math.min(distance, maxDistance);
        joystickKnob.style.left = `${60 + joystickVector.x - 25}px`;
        joystickKnob.style.top = `${60 + joystickVector.y - 25}px`;
    }
});

joystick.addEventListener('touchend', () => {
    joystickActive = false;
    joystickVector = { x: 0, y: 0 };
    joystickKnob.style.left = '35px';
    joystickKnob.style.top = '35px';
});

function snapToGrid(position) {
    return Math.round(position / GRID_SIZE) * GRID_SIZE;
}

function addEffect(type, x, y, duration) {
    effects.push({ type, x, y, duration, start: Date.now() });
}

function checkCollision(x, y, size, excludeSelf = null, isPlayer = false) {
    if (isPlayer) return false;
    return zombies.some(zombie => 
        zombie !== excludeSelf && 
        Math.hypot(x - zombie.x, y - zombie.y) < (size + zombie.size) / 2
    );
}

function resetGame() {
    player.x = WORLD_WIDTH / 2;
    player.y = WORLD_HEIGHT / 2;
    player.resources = { wood: 150, stone: 150, gold: 75 };
    player.score = 0;
    player.mana = 100;
    player.weaponLevel = 1;
    player.weaponCooldown = 0;

    structures.length = 0;
    projectiles.length = 0;
    zombies.length = 0;
    helpers.length = 0;
    effects.length = 0;

    initializeWorld();

    wave = 1;
    isDay = true;
    cycleTime = 0;
    wallLevel = 1;
    towerLevel = 1;
    isGameOver = false;

    requestAnimationFrame(gameLoop);
}

function gameLoop(timestamp) {
    if (isGameOver) return;

    camera.follow(player);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = isDay ? '#A9D18E' : '#2F4F4F';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    resourceNodes.forEach(node => {
        const screenX = node.x - camera.x;
        const screenY = node.y - camera.y;
        if (screenX > -node.size && screenX < canvas.width + node.size && screenY > -node.size && screenY < canvas.height + node.size) {
            if (node.type === 'wood') {
                ctx.fillStyle = '#8B4513';
                ctx.fillRect(screenX - 15, screenY - 30, 30, 60);
                ctx.fillStyle = '#228B22';
                ctx.beginPath();
                ctx.arc(screenX, screenY - 40, 35, 0, Math.PI * 2);
                ctx.fill();
            } else if (node.type === 'stone') {
                ctx.fillStyle = '#696969';
                ctx.beginPath();
                ctx.moveTo(screenX - 25, screenY + 15);
                ctx.lineTo(screenX + 25, screenY + 15);
                ctx.lineTo(screenX + 20, screenY - 15);
                ctx.lineTo(screenX - 20, screenY - 15);
                ctx.fill();
            } else if (node.type === 'gold') {
                ctx.fillStyle = '#FFD700';
                ctx.beginPath();
                ctx.arc(screenX, screenY, 20, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#DAA520';
                ctx.beginPath();
                ctx.arc(screenX + 5, screenY - 5, 15, 0, Math.PI * 2);
                ctx.fill();
            }
            ctx.fillStyle = '#b4e4b4';
            ctx.fillRect(screenX - 25, screenY - 45, 50 * (node.hp / node.maxHp), 5);
        }
    });

    structures.forEach(struct => {
        const screenX = struct.x - camera.x;
        const screenY = struct.y - camera.y;
        if (screenX > -struct.size && screenX < canvas.width + struct.size && screenY > -struct.size && screenY < canvas.height + struct.size) {
            if (struct.type === 'wall') {
                ctx.fillStyle = '#808080';
                ctx.fillRect(screenX - struct.size / 2, screenY - struct.size / 2, struct.size, struct.size);
            } else if (struct.type === 'tower') {
                ctx.fillStyle = '#808080';
                ctx.fillRect(screenX - 25, screenY - 50, 50, 60);
                ctx.fillStyle = '#606060';
                ctx.fillRect(screenX - 25, screenY - 55, 10, 5);
                ctx.fillRect(screenX - 10, screenY - 55, 10, 5);
                ctx.fillRect(screenX + 5, screenY - 55, 10, 5);
                ctx.fillRect(screenX + 20, screenY - 55, 10, 5);
                ctx.fillStyle = '#404040';
                ctx.fillRect(screenX - 10, screenY - 20, 10, 5);
                ctx.fillRect(screenX + 5, screenY - 20, 10, 5);
            } else if (struct.type === 'trap') {
                ctx.fillStyle = '#555555';
                ctx.beginPath();
                ctx.arc(screenX, screenY, 15, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#FF4500';
                ctx.beginPath();
                ctx.moveTo(screenX - 10, screenY - 10);
                ctx.lineTo(screenX + 10, screenY + 10);
                ctx.lineTo(screenX + 10, screenY - 10);
                ctx.lineTo(screenX - 10, screenY + 10);
                ctx.fill();
            }
            const healthRatio = struct.hp / struct.maxHp;
            ctx.fillStyle = '#b4e4b4';
            ctx.fillRect(screenX - 25, screenY - 65, 50 * healthRatio, 7);
        }
    });

    zombieNests.forEach(nest => {
        const screenX = nest.x - camera.x;
        const screenY = nest.y - camera.y;
        if (screenX > -nest.size && screenX < canvas.width + nest.size && screenY > -nest.size && screenY < canvas.height + nest.size) {
            ctx.fillStyle = '#8B0000';
            ctx.beginPath();
            ctx.arc(screenX, screenY, nest.size / 2, 0, Math.PI * 2);
            ctx.fill();
        }
    });

    helpers.forEach((helper, index) => {
        const screenX = helper.x - camera.x;
        const screenY = helper.y - camera.y;
        if (screenX > -helper.size && screenX < canvas.width + helper.size && screenY > -helper.size && screenY < canvas.height + helper.size) {
            ctx.fillStyle = '#32CD32';
            ctx.beginPath();
            ctx.arc(screenX, screenY, helper.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#b4e4b4';
            ctx.fillRect(screenX - 25, screenY - 35, 50 * (helper.hp / helper.maxHp), 5);
        }
        const nearestNode = resourceNodes.reduce((closest, node) => {
            const dist = Math.hypot(helper.x - node.x, helper.y - node.y);
            return (!closest || dist < Math.hypot(helper.x - closest.x, helper.y - closest.y)) ? node : closest;
        }, null);
        const nearestZombie = zombies.find(z => Math.hypot(helper.x - z.x, helper.y - z.y) < 100);
        let target = nearestZombie || nearestNode;
        if (target) {
            const angle = Math.atan2(target.y - helper.y, target.x - helper.x);
            const newX = helper.x + Math.cos(angle) * helper.speed;
            const newY = helper.y + Math.sin(angle) * helper.speed;
            if (!checkCollision(newX, newY, helper.size)) {
                helper.x = newX;
                helper.y = newY;
            }
            if (target === nearestNode && Math.hypot(helper.x - target.x, helper.y - target.y) < helper.size / 2 + target.size / 2) {
                target.hp -= 3;
                player.resources[target.type] += 2;
                addEffect('resource', target.x, target.y, 500);
                if (target.hp <= 0) {
                    target.hp = target.maxHp;
                    const pos = placeObject(target.size, resourceNodes);
                    if (pos) {
                        target.x = pos.x;
                        target.y = pos.y;
                    }
                }
            } else if (target === nearestZombie && Math.hypot(helper.x - target.x, helper.y - target.y) < helper.size / 2 + target.size / 2) {
                target.hp -= 10;
                if (target.hp <= 0) zombies.splice(zombies.indexOf(target), 1);
            }
        }
    });

    projectiles.forEach((proj, index) => {
        proj.x += Math.cos(proj.angle) * proj.speed;
        proj.y += Math.sin(proj.angle) * proj.speed;
        const screenX = proj.x - camera.x;
        const screenY = proj.y - camera.y;
        if (screenX > -10 && screenX < canvas.width + 10 && screenY > -10 && screenY < canvas.height + 10) {
            ctx.fillStyle = proj.from === 'tower' ? '#808080' : proj.from === 'spell' ? '#FF4500' : '#00CED1';
            ctx.beginPath();
            ctx.arc(screenX, screenY, proj.size || 5, 0, Math.PI * 2);
            ctx.fill();
        }

        zombies.forEach((zombie, zIndex) => {
            if (Math.hypot(proj.x - zombie.x, proj.y - zombie.y) < zombie.size / 2 + (proj.size || 5)) {
                zombie.hp -= proj.damage;
                addEffect(proj.from === 'spell' ? 'explosion' : 'hit', proj.x, proj.y, 300);
                projectiles.splice(index, 1);
                if (zombie.hp <= 0) {
                    zombies.splice(zIndex, 1);
                    player.score += 15 * wave;
                    player.resources.gold += Math.floor(wave);
                }
                return;
            }
        });

        if (proj.x < 0 || proj.x > WORLD_WIDTH || proj.y < 0 || proj.y > WORLD_HEIGHT) {
            projectiles.splice(index, 1);
        }
    });

    zombies.forEach((zombie, zIndex) => {
        const targets = [
            { type: 'player', x: player.x, y: player.y, size: player.size },
            ...structures.filter(s => s.type === 'wall' || s.type === 'tower')
        ];
        const nearestTarget = targets.reduce((closest, target) => {
            const dist = Math.hypot(zombie.x - target.x, zombie.y - target.y);
            return (!closest || dist < Math.hypot(zombie.x - closest.x, zombie.y - closest.y)) ? target : closest;
        }, null);

        if (nearestTarget) {
            const angle = Math.atan2(nearestTarget.y - zombie.y, nearestTarget.x - zombie.x);
            const newX = zombie.x + Math.cos(angle) * zombie.speed;
            const newY = zombie.y + Math.sin(angle) * zombie.speed;
            if (!checkCollision(newX, newY, zombie.size, zombie)) {
                zombie.x = newX;
                zombie.y = newY;
            }

            const distance = Math.hypot(zombie.x - nearestTarget.x, zombie.y - nearestTarget.y);
            if (distance < zombie.size / 2 + nearestTarget.size / 2) {
                if (nearestTarget.type === 'player' && !isGameOver) {
                    isGameOver = true;
                    alert(`Game Over! Score: ${player.score}`);
                    resetGame();
                    return;
                } else if (nearestTarget.type === 'wall' || nearestTarget.type === 'tower') {
                    if (!zombie.lastDamage || Date.now() - zombie.lastDamage > 1000) {
                        nearestTarget.hp -= zombie.damage;
                        addEffect('hit', nearestTarget.x, nearestTarget.y, 200);
                        zombie.lastDamage = Date.now();
                        if (nearestTarget.hp <= 0) {
                            const structIndex = structures.indexOf(nearestTarget);
                            if (structIndex > -1) {
                                addEffect('explosion', nearestTarget.x, nearestTarget.y, 500);
                                structures.splice(structIndex, 1);
                            }
                        }
                    }
                }
            }
        }

        const screenX = zombie.x - camera.x;
        const screenY = zombie.y - camera.y;
        if (screenX > -zombie.size && screenX < canvas.width + zombie.size && screenY > -zombie.size && screenY < canvas.height + zombie.size) {
            ctx.fillStyle = zombie.type === 'boss' ? '#8B0000' : '#FF0000';
            ctx.beginPath();
            ctx.arc(screenX, screenY, zombie.size / 2, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#b4e4b4';
            ctx.fillRect(screenX - 25, screenY - 35, 50 * (zombie.hp / zombie.maxHp), 5);
        }
    });

    const playerScreenX = player.x - camera.x;
    const playerScreenY = player.y - camera.y;
    ctx.fillStyle = '#4682B4';
    ctx.beginPath();
    ctx.arc(playerScreenX, playerScreenY, player.size / 2, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#b4e4b4';
    ctx.lineWidth = 2;
    ctx.stroke();

    effects.forEach((effect, index) => {
        const screenX = effect.x - camera.x;
        const screenY = effect.y - camera.y;
        const elapsed = Date.now() - effect.start;
        if (elapsed > effect.duration) {
            effects.splice(index, 1);
            return;
        }
        const alpha = 1 - elapsed / effect.duration;
        if (effect.type === 'hit') {
            ctx.fillStyle = `rgba(255, 0, 0, ${alpha})`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 10 * alpha, 0, Math.PI * 2);
            ctx.fill();
        } else if (effect.type === 'explosion') {
            ctx.fillStyle = `rgba(255, 69, 0, ${alpha})`;
            ctx.beginPath();
            ctx.arc(screenX, screenY, 20 * alpha, 0, Math.PI * 2);
            ctx.fill();
        } else if (effect.type === 'resource') {
            ctx.fillStyle = `rgba(180, 228, 180, ${alpha})`;
            ctx.fillRect(screenX - 5, screenY - 5 - 20 * alpha, 10, 10);
        }
    });

    minimapCtx.fillStyle = '#1a3c1a';
    minimapCtx.fillRect(0, 0, minimapCanvas.width, minimapCanvas.height);
    const scaleX = minimapCanvas.width / WORLD_WIDTH;
    const scaleY = minimapCanvas.height / WORLD_HEIGHT;
    resourceNodes.forEach(node => {
        minimapCtx.fillStyle = node.type === 'wood' ? '#228B22' : node.type === 'stone' ? '#696969' : '#FFD700';
        minimapCtx.beginPath();
        minimapCtx.arc(node.x * scaleX, node.y * scaleY, 2, 0, Math.PI * 2);
        minimapCtx.fill();
    });
    minimapCtx.fillStyle = '#4682B4';
    minimapCtx.fillRect(player.x * scaleX - 2, player.y * scaleY - 2, 4, 4);
    zombies.forEach(z => {
        minimapCtx.fillStyle = '#f00';
        minimapCtx.fillRect(z.x * scaleX - 1, z.y * scaleY - 1, 2, 2);
    });
    zombieNests.forEach(n => {
        minimapCtx.fillStyle = '#8B0000';
        minimapCtx.beginPath();
        minimapCtx.arc(n.x * scaleX, n.y * scaleY, 3, 0, Math.PI * 2);
        minimapCtx.fill();
    });

    resourcesDisplay.textContent = `Holz: ${player.resources.wood} | Stein: ${player.resources.stone} | Gold: ${player.resources.gold}`;
    scoreDisplay.textContent = player.score;
    waveDisplay.textContent = wave;
    dayNightDisplay.textContent = isDay ? 'Tag' : 'Nacht';
    cycleTimeDisplay.textContent = Math.floor(cycleTime);
    helperCountDisplay.textContent = helpers.length;
    manaDisplay.textContent = Math.floor(player.mana);

    if (player.weaponCooldown > 0) player.weaponCooldown -= 16;
    if (player.mana < player.maxMana) player.mana += 0.1;

    requestAnimationFrame(gameLoop);
}

const keys = {};
document.addEventListener('keydown', (e) => { keys[e.key.toLowerCase()] = true; });
document.addEventListener('keyup', (e) => { keys[e.key.toLowerCase()] = false; });

function movePlayer() {
    let moveX = 0, moveY = 0;
    if (keys['w'] || keys['arrowup']) moveY -= player.speed;
    if (keys['s'] || keys['arrowdown']) moveY += player.speed;
    if (keys['a'] || keys['arrowleft']) moveX -= player.speed;
    if (keys['d'] || keys['arrowright']) moveX += player.speed;

    if (joystickActive) {
        const magnitude = Math.sqrt(joystickVector.x * joystickVector.x + joystickVector.y * joystickVector.y);
        if (magnitude > 0) {
            moveX = (joystickVector.x / magnitude) * player.speed;
            moveY = (joystickVector.y / magnitude) * player.speed;
        }
    }

    if (moveX !== 0 && moveY !== 0) {
        const magnitude = Math.sqrt(moveX * moveX + moveY * moveY);
        moveX = (moveX / magnitude) * player.speed;
        moveY = (moveY / magnitude) * player.speed;
    }

    const newX = Math.max(0, Math.min(WORLD_WIDTH, player.x + moveX));
    const newY = Math.max(0, Math.min(WORLD_HEIGHT, player.y + moveY));
    player.x = newX;
    player.y = newY;
}

function harvestResources() {
    resourceNodes.forEach(node => {
        if (Math.hypot(player.x - node.x, player.y - node.y) < player.size / 2 + node.size / 2) {
            node.hp -= player.weaponLevel * 3;
            player.resources[node.type] += player.weaponLevel * 2;
            addEffect('resource', node.x, node.y, 500);
            if (node.hp <= 0) {
                node.hp = node.maxHp;
                const pos = placeObject(node.size, resourceNodes);
                if (pos) {
                    node.x = pos.x;
                    node.y = pos.y;
                }
            }
        }
    });
}

function canBuild(cost) {
    return player.resources.wood >= (cost.wood || 0) && player.resources.stone >= (cost.stone || 0) && player.resources.gold >= (cost.gold || 0);
}

function closeShopModal() {
    shopModal.style.display = 'none';
}

document.getElementById('buildWall').addEventListener('click', () => {
    const cost = { wood: 10, stone: 10 };
    if (canBuild(cost)) {
        player.resources.wood -= cost.wood;
        player.resources.stone -= cost.stone;
        const gridX = snapToGrid(player.x);
        const gridY = snapToGrid(player.y);
        if (!structures.some(s => s.x === gridX && s.y === gridY)) {
            structures.push({ type: 'wall', x: gridX, y: gridY, size: 50, hp: 50 + 50 * wallLevel, maxHp: 50 + 50 * wallLevel });
        }
    }
});

document.getElementById('buildTower').addEventListener('click', () => {
    const cost = { wood: 20, stone: 20, gold: 10 };
    if (canBuild(cost)) {
        player.resources.wood -= cost.wood;
        player.resources.stone -= cost.stone;
        player.resources.gold -= cost.gold;
        const gridX = snapToGrid(player.x);
        const gridY = snapToGrid(player.y);
        if (!structures.some(s => s.x === gridX && s.y === gridY)) {
            structures.push({ type: 'tower', x: gridX, y: gridY, size: 50, hp: 75 + 50 * towerLevel, maxHp: 75 + 50 * towerLevel, lastShot: 0 });
        }
    }
});

document.getElementById('buildTrap').addEventListener('click', () => {
    const cost = { wood: 15, gold: 5 };
    if (canBuild(cost)) {
        player.resources.wood -= cost.wood;
        player.resources.gold -= cost.gold;
        const gridX = snapToGrid(player.x);
        const gridY = snapToGrid(player.y);
        if (!structures.some(s => s.x === gridX && s.y === gridY)) {
            structures.push({ type: 'trap', x: gridX, y: gridY, size: 40, hp: 150, maxHp: 150 });
        }
    }
});

document.getElementById('hireHelper').addEventListener('click', () => {
    if (player.resources.gold >= 100) {
        player.resources.gold -= 100;
        helpers.push({
            x: player.x + Math.random() * 50 - 25,
            y: player.y + Math.random() * 50 - 25,
            size: 20,
            speed: 1,
            hp: 300,
            maxHp: 300
        });
    }
});

document.getElementById('upgradeWeapon').addEventListener('click', () => {
    if (player.resources.gold >= 50 && player.weaponLevel < 5) {
        player.resources.gold -= 50;
        player.weaponLevel += 1;
    }
});

document.getElementById('upgradeWall').addEventListener('click', () => {
    if (player.resources.gold >= 20 && wallLevel < 5) {
        player.resources.gold -= 20;
        wallLevel += 1;
        structures.filter(s => s.type === 'wall').forEach(wall => {
            wall.maxHp = 50 + 50 * wallLevel;
            wall.hp = Math.min(wall.hp + 50, wall.maxHp);
        });
    }
});

document.getElementById('upgradeTower').addEventListener('click', () => {
    if (player.resources.gold >= 30 && towerLevel < 5) {
        player.resources.gold -= 30;
        towerLevel += 1;
        structures.filter(s => s.type === 'tower').forEach(tower => {
            tower.maxHp = 75 + 50 * towerLevel;
            tower.hp = Math.min(tower.hp + 50, tower.maxHp);
        });
    }
});

document.getElementById('castSpell').addEventListener('click', () => {
    if (player.mana >= 20) {
        player.mana -= 20;
        const visibleZombies = zombies.filter(z => {
            const screenX = z.x - camera.x;
            const screenY = z.y - camera.y;
            return screenX > -z.size && screenX < canvas.width + z.size && screenY > -z.size && screenY < canvas.height + z.size;
        });
        const nearestZombie = visibleZombies.reduce((closest, z) => {
            const dist = Math.hypot(player.x - z.x, player.y - z.y);
            return (!closest || dist < Math.hypot(player.x - closest.x, player.y - closest.y)) ? z : closest;
        }, null);
        if (nearestZombie) {
            const angle = Math.atan2(nearestZombie.y - player.y, nearestZombie.x - player.x);
            projectiles.push({ x: player.x, y: player.y, angle, speed: 12, damage: 50, from: 'spell', size: 10 });
        }
    }
});

document.getElementById('buildWallMobile').addEventListener('click', () => {
    const cost = { wood: 10, stone: 10 };
    if (canBuild(cost)) {
        player.resources.wood -= cost.wood;
        player.resources.stone -= cost.stone;
        const gridX = snapToGrid(player.x);
        const gridY = snapToGrid(player.y);
        if (!structures.some(s => s.x === gridX && s.y === gridY)) {
            structures.push({ type: 'wall', x: gridX, y: gridY, size: 50, hp: 50 + 50 * wallLevel, maxHp: 50 + 50 * wallLevel });
            closeShopModal();
        }
    }
});

document.getElementById('buildTowerMobile').addEventListener('click', () => {
    const cost = { wood: 20, stone: 20, gold: 10 };
    if (canBuild(cost)) {
        player.resources.wood -= cost.wood;
        player.resources.stone -= cost.stone;
        player.resources.gold -= cost.gold;
        const gridX = snapToGrid(player.x);
        const gridY = snapToGrid(player.y);
        if (!structures.some(s => s.x === gridX && s.y === gridY)) {
            structures.push({ type: 'tower', x: gridX, y: gridY, size: 50, hp: 75 + 50 * towerLevel, maxHp: 75 + 50 * towerLevel, lastShot: 0 });
            closeShopModal();
        }
    }
});

document.getElementById('buildTrapMobile').addEventListener('click', () => {
    const cost = { wood: 15, gold: 5 };
    if (canBuild(cost)) {
        player.resources.wood -= cost.wood;
        player.resources.gold -= cost.gold;
        const gridX = snapToGrid(player.x);
        const gridY = snapToGrid(player.y);
        if (!structures.some(s => s.x === gridX && s.y === gridY)) {
            structures.push({ type: 'trap', x: gridX, y: gridY, size: 40, hp: 150, maxHp: 150 });
            closeShopModal();
        }
    }
});

document.getElementById('hireHelperMobile').addEventListener('click', () => {
    if (player.resources.gold >= 100) {
        player.resources.gold -= 100;
        helpers.push({
            x: player.x + Math.random() * 50 - 25,
            y: player.y + Math.random() * 50 - 25,
            size: 20,
            speed: 1,
            hp: 300,
            maxHp: 300
        });
        closeShopModal();
    }
});

document.getElementById('upgradeWeaponMobile').addEventListener('click', () => {
    if (player.resources.gold >= 50 && player.weaponLevel < 5) {
        player.resources.gold -= 50;
        player.weaponLevel += 1;
        closeShopModal();
    }
});

document.getElementById('upgradeWallMobile').addEventListener('click', () => {
    if (player.resources.gold >= 20 && wallLevel < 5) {
        player.resources.gold -= 20;
        wallLevel += 1;
        structures.filter(s => s.type === 'wall').forEach(wall => {
            wall.maxHp = 50 + 50 * wallLevel;
            wall.hp = Math.min(wall.hp + 50, wall.maxHp);
        });
        closeShopModal();
    }
});

document.getElementById('upgradeTowerMobile').addEventListener('click', () => {
    if (player.resources.gold >= 30 && towerLevel < 5) {
        player.resources.gold -= 30;
        towerLevel += 1;
        structures.filter(s => s.type === 'tower').forEach(tower => {
            tower.maxHp = 75 + 50 * towerLevel;
            tower.hp = Math.min(tower.hp + 50, tower.maxHp);
        });
        closeShopModal();
    }
});

document.getElementById('castSpellMobile').addEventListener('click', () => {
    if (player.mana >= 20) {
        player.mana -= 20;
        const visibleZombies = zombies.filter(z => {
            const screenX = z.x - camera.x;
            const screenY = z.y - camera.y;
            return screenX > -z.size && screenX < canvas.width + z.size && screenY > -z.size && screenY < canvas.height + z.size;
        });
        const nearestZombie = visibleZombies.reduce((closest, z) => {
            const dist = Math.hypot(player.x - z.x, player.y - z.y);
            return (!closest || dist < Math.hypot(player.x - closest.x, player.y - closest.y)) ? z : closest;
        }, null);
        if (nearestZombie) {
            const angle = Math.atan2(nearestZombie.y - player.y, nearestZombie.x - player.x);
            projectiles.push({ x: player.x, y: player.y, angle, speed: 12, damage: 50, from: 'spell', size: 10 });
            closeShopModal();
        }
    }
});

function shoot(targetX, targetY) {
    if (player.weaponCooldown <= 0) {
        const angle = Math.atan2(targetY - player.y, targetX - player.x);
        projectiles.push({ x: player.x, y: player.y, angle, speed: 12, damage: player.weaponLevel * 15, from: 'player' });
        player.weaponCooldown = 400 / player.weaponLevel;
    }
}

canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const targetX = e.clientX - rect.left + camera.x;
    const targetY = e.clientY - rect.top + camera.y;
    shoot(targetX, targetY);
});

canvas.addEventListener('touchstart', (e) => {
    e.preventDefault();
    const touch = e.touches[0];
    const rect = canvas.getBoundingClientRect();
    const touchX = touch.clientX - rect.left;
    const touchY = touch.clientY - rect.top;
    if (touchX > joystick.offsetWidth + 30 || touchY < canvas.height - joystick.offsetHeight - 30) {
        const targetX = touchX + camera.x;
        const targetY = touchY + camera.y;
        shoot(targetX, targetY);
    }
});

setInterval(() => {
    structures.forEach(struct => {
        if (struct.type === 'tower') {
            const now = Date.now();
            if (now - struct.lastShot > 800 / towerLevel) {
                const nearestZombie = zombies.reduce((closest, z) => {
                    const dist = Math.hypot(struct.x - z.x, struct.y - z.y);
                    return (!closest || dist < Math.hypot(struct.x - closest.x, struct.y - closest.y)) ? z : closest;
                }, null);
                if (nearestZombie && Math.hypot(struct.x - nearestZombie.x, struct.y - nearestZombie.y) < 200 + towerLevel * 30) {
                    const angle = Math.atan2(nearestZombie.y - struct.y, nearestZombie.x - struct.x);
                    projectiles.push({ x: struct.x, y: struct.y, angle, speed: 10, damage: 30 * towerLevel, from: 'tower' });
                    struct.lastShot = now;
                }
            }
        } else if (struct.type === 'trap') {
            zombies.forEach(zombie => {
                if (Math.hypot(struct.x - zombie.x, struct.y - zombie.y) < struct.size / 2 + zombie.size / 2) {
                    zombie.hp -= 50;
                    struct.hp -= 150;
                    addEffect('explosion', zombie.x, zombie.y, 300);
                    if (struct.hp <= 0) structures.splice(structures.indexOf(struct), 1);
                }
            });
        }
    });
}, 100);

function spawnZombiesFromNests() {
    zombieNests.forEach(nest => {
        const spawnChance = isDay ? 0.05 : 0.1;
        if (Math.random() < spawnChance) {
            const angle = Math.random() * Math.PI * 2;
            const x = nest.x + Math.cos(angle) * (nest.size / 2 - 10);
            const y = nest.y + Math.sin(angle) * (nest.size / 2 - 10);
            const baseSpeed = 0.9;
            const waveBonus = Math.min(wave * 0.025, 0.8);
            zombies.push({
                x, y, size: 25,
                hp: 60 + wave * 10,
                maxHp: 60 + wave * 10,
                speed: baseSpeed + waveBonus,
                damage: 15 + wave * 2,
                lastDamage: 0
            });
        }
    });
}

function spawnWaveZombies() {
    if (!isDay) {
        const count = Math.min(Math.floor(wave * 2), 30);
        for (let i = 0; i < count; i++) {
            const angle = Math.random() * Math.PI * 2;
            const distance = Math.max(WORLD_WIDTH, WORLD_HEIGHT) / 2 + 100;
            const x = player.x + Math.cos(angle) * distance;
            const y = player.y + Math.sin(angle) * distance;
            const baseSpeed = 0.9;
            const waveBonus = Math.min(wave * 0.025, 0.8);
            zombies.push({
                x, y, size: 25,
                hp: 60 + wave * 10,
                maxHp: 60 + wave * 10,
                speed: baseSpeed + waveBonus,
                damage: 15 + wave * 2,
                lastDamage: 0
            });
        }
        if (wave % 5 === 0) {
            zombies.push({
                x: player.x + Math.cos(Math.random() * Math.PI * 2) * distance,
                y: player.y + Math.sin(Math.random() * Math.PI * 2) * distance,
                size: 40,
                hp: 500 + wave * 50,
                maxHp: 500 + wave * 50,
                speed: 0.7,
                damage: 20 + wave * 2,
                type: 'boss',
                lastDamage: 0
            });
        }
    }
}

setInterval(() => {
    if (!isGameOver) {
        cycleTime += 1;
        if (cycleTime >= cycleDuration) {
            isDay = !isDay;
            cycleTime = 0;
            if (!isDay) {
                spawnWaveZombies();
                wave += 1;
            }
        }
        spawnZombiesFromNests();
    }
}, 1000);

setInterval(() => {
    if (!isGameOver) {
        movePlayer();
        harvestResources();
    }
}, 16);

initializeWorld();
console.log('Spiel gestartet');
gameLoop();