// Игровые константы
const GRID_SIZE = 40;
const GRID_COLS = 20;
const GRID_ROWS = 15;
const AUTO_WAVE_DELAY = 7000; // 7 секунд

// Стартовая и конечная точки
const START_POINT = { x: 0, y: 7 };
const END_POINT = { x: 19, y: 7 };

// Типы башен
const TOWER_TYPES = {
    basic: {
        name: 'Базовая',
        cost: 50,
        damage: 10,
        range: 120,
        fireRate: 1000,
        color: '#4CAF50',
        projectileSpeed: 5,
        upgradeBaseCost: 20
    },
    sniper: {
        name: 'Снайпер',
        cost: 100,
        damage: 50,
        range: 200,
        fireRate: 2000,
        color: '#2196F3',
        projectileSpeed: 8,
        upgradeBaseCost: 40
    },
    cannon: {
        name: 'Пушка',
        cost: 150,
        damage: 30,
        range: 100,
        fireRate: 1500,
        color: '#FF5722',
        projectileSpeed: 4,
        splashRadius: 40,
        upgradeBaseCost: 60
    },
    freeze: {
        name: 'Заморозка',
        cost: 120,
        damage: 5,
        range: 150,
        fireRate: 800,
        color: '#00BCD4',
        projectileSpeed: 6,
        slowEffect: 0.5,
        slowDuration: 2000,
        upgradeBaseCost: 50
    }
};

// Типы врагов
const ENEMY_TYPES = {
    basic: {
        name: 'Базовый',
        health: 50,
        speed: 1,
        reward: 10,
        color: '#E91E63'
    },
    fast: {
        name: 'Быстрый',
        health: 30,
        speed: 2,
        reward: 15,
        color: '#9C27B0'
    },
    tank: {
        name: 'Танк',
        health: 150,
        speed: 0.5,
        reward: 30,
        color: '#795548'
    },
    boss: {
        name: 'Босс',
        health: 500,
        speed: 0.3,
        reward: 100,
        color: '#F44336'
    }
};

// Конфигурация волн
const WAVES = [
    { enemies: [{ type: 'basic', count: 10 }] },
    { enemies: [{ type: 'basic', count: 15 }, { type: 'fast', count: 5 }] },
    { enemies: [{ type: 'basic', count: 10 }, { type: 'fast', count: 10 }] },
    { enemies: [{ type: 'fast', count: 15 }, { type: 'tank', count: 3 }] },
    { enemies: [{ type: 'basic', count: 20 }, { type: 'tank', count: 5 }] },
    { enemies: [{ type: 'fast', count: 20 }, { type: 'tank', count: 8 }] },
    { enemies: [{ type: 'tank', count: 15 }, { type: 'boss', count: 1 }] },
    { enemies: [{ type: 'basic', count: 30 }, { type: 'fast', count: 20 }, { type: 'tank', count: 10 }] },
    { enemies: [{ type: 'tank', count: 20 }, { type: 'boss', count: 2 }] },
    { enemies: [{ type: 'basic', count: 50 }, { type: 'fast', count: 30 }, { type: 'tank', count: 15 }, { type: 'boss', count: 3 }] }
];

// A* pathfinding
class PathFinder {
    constructor(gridCols, gridRows, towers) {
        this.gridCols = gridCols;
        this.gridRows = gridRows;
        this.towers = towers;
    }

    findPath(start, end) {
        const openSet = [];
        const closedSet = new Set();
        const cameFrom = new Map();
        const gScore = new Map();
        const fScore = new Map();

        const startKey = `${start.x},${start.y}`;
        const endKey = `${end.x},${end.y}`;

        openSet.push(start);
        gScore.set(startKey, 0);
        fScore.set(startKey, this.heuristic(start, end));

        while (openSet.length > 0) {
            // Находим узел с наименьшим fScore
            let current = openSet.reduce((min, node) => {
                const minKey = `${min.x},${min.y}`;
                const nodeKey = `${node.x},${node.y}`;
                return (fScore.get(nodeKey) || Infinity) < (fScore.get(minKey) || Infinity) ? node : min;
            });

            const currentKey = `${current.x},${current.y}`;

            if (currentKey === endKey) {
                return this.reconstructPath(cameFrom, current);
            }

            openSet.splice(openSet.indexOf(current), 1);
            closedSet.add(currentKey);

            const neighbors = this.getNeighbors(current);

            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;

                if (closedSet.has(neighborKey)) continue;

                const tentativeGScore = (gScore.get(currentKey) || Infinity) + 1;

                if (!openSet.some(n => `${n.x},${n.y}` === neighborKey)) {
                    openSet.push(neighbor);
                } else if (tentativeGScore >= (gScore.get(neighborKey) || Infinity)) {
                    continue;
                }

                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                fScore.set(neighborKey, tentativeGScore + this.heuristic(neighbor, end));
            }
        }

        return null; // Путь не найден
    }

    getNeighbors(node) {
        const neighbors = [];
        const directions = [
            { x: 0, y: -1 }, // вверх
            { x: 1, y: 0 },  // вправо
            { x: 0, y: 1 },  // вниз
            { x: -1, y: 0 }  // влево
        ];

        for (const dir of directions) {
            const newX = node.x + dir.x;
            const newY = node.y + dir.y;

            if (newX >= 0 && newX < this.gridCols && newY >= 0 && newY < this.gridRows) {
                // Проверяем, есть ли башня на этой клетке
                const hasTower = this.towers.some(t => t.gridX === newX && t.gridY === newY);

                if (!hasTower) {
                    neighbors.push({ x: newX, y: newY });
                }
            }
        }

        return neighbors;
    }

    heuristic(a, b) {
        // Манхэттенское расстояние
        return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    }

    reconstructPath(cameFrom, current) {
        const path = [current];
        let currentKey = `${current.x},${current.y}`;

        while (cameFrom.has(currentKey)) {
            current = cameFrom.get(currentKey);
            path.unshift(current);
            currentKey = `${current.x},${current.y}`;
        }

        return path;
    }
}

// Класс игры
class Game {
    constructor() {
        this.canvas = document.getElementById('gameCanvas');
        this.ctx = this.canvas.getContext('2d');

        this.money = 200;
        this.lives = 20;
        this.wave = 0;
        this.score = 0;
        this.gameSpeed = 1;

        this.towers = [];
        this.enemies = [];
        this.projectiles = [];

        this.selectedTowerType = null;
        this.selectedTower = null;
        this.isPaused = false;
        this.gameOver = false;
        this.waveInProgress = false;
        this.autoWaveTimer = null;
        this.currentPath = null;

        this.initEventListeners();
        this.gameLoop();
        this.scheduleNextWave();
    }

    scheduleNextWave() {
        if (this.gameOver || this.wave >= WAVES.length) return;

        this.autoWaveTimer = setTimeout(() => {
            if (!this.waveInProgress && !this.gameOver) {
                this.startWave();
            }
        }, AUTO_WAVE_DELAY);
    }

    initEventListeners() {
        // Башни
        document.querySelectorAll('.tower-card').forEach(card => {
            card.addEventListener('click', () => {
                const towerType = card.dataset.tower;
                this.selectTowerType(towerType);
            });
        });

        // Canvas клик
        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
            const y = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
            this.handleCanvasClick(x, y);
        });

        // Кнопки управления
        document.getElementById('startWaveBtn').addEventListener('click', () => {
            this.startWave();
        });

        document.getElementById('pauseBtn').addEventListener('click', () => {
            this.togglePause();
        });

        document.getElementById('speedBtn').addEventListener('click', (e) => {
            this.cycleSpeed(e.target);
        });

        document.getElementById('sellTowerBtn').addEventListener('click', () => {
            this.sellSelectedTower();
        });

        document.getElementById('upgradeTowerBtn').addEventListener('click', () => {
            this.showUpgradeMenu();
        });

        document.getElementById('restartBtn').addEventListener('click', () => {
            this.restart();
        });

        document.getElementById('backBtn').addEventListener('click', () => {
            window.location.href = 'index.html';
        });
    }

    selectTowerType(type) {
        if (this.money < TOWER_TYPES[type].cost) return;

        this.selectedTowerType = type;
        this.selectedTower = null;

        document.querySelectorAll('.tower-card').forEach(card => {
            card.classList.remove('selected');
            if (card.dataset.tower === type) {
                card.classList.add('selected');
            }
        });

        this.updateButtons();
    }

    handleCanvasClick(x, y) {
        const gridX = Math.floor(x / GRID_SIZE);
        const gridY = Math.floor(y / GRID_SIZE);

        // Проверяем, есть ли башня на этой клетке
        const clickedTower = this.towers.find(t =>
            t.gridX === gridX && t.gridY === gridY
        );

        if (clickedTower) {
            this.selectedTower = clickedTower;
            this.selectedTowerType = null;
            document.querySelectorAll('.tower-card').forEach(card => {
                card.classList.remove('selected');
            });
            this.updateButtons();
            return;
        }

        // Размещаем новую башню
        if (this.selectedTowerType) {
            this.placeTower(gridX, gridY);
        }
    }

    placeTower(gridX, gridY) {
        const type = TOWER_TYPES[this.selectedTowerType];

        // Проверки
        if (this.money < type.cost) return;
        if (gridX < 0 || gridX >= GRID_COLS || gridY < 0 || gridY >= GRID_ROWS) return;
        if (this.towers.some(t => t.gridX === gridX && t.gridY === gridY)) return;

        // Проверяем, что башня не на старте или финише
        if ((gridX === START_POINT.x && gridY === START_POINT.y) ||
            (gridX === END_POINT.x && gridY === END_POINT.y)) return;

        // Проверяем, что после установки башни останется путь
        const testTowers = [...this.towers, { gridX, gridY }];
        const pathFinder = new PathFinder(GRID_COLS, GRID_ROWS, testTowers);
        const testPath = pathFinder.findPath(START_POINT, END_POINT);

        if (!testPath) {
            alert('Нельзя заблокировать путь врагов!');
            return;
        }

        // Создаем башню
        this.towers.push({
            type: this.selectedTowerType,
            gridX,
            gridY,
            x: gridX * GRID_SIZE + GRID_SIZE / 2,
            y: gridY * GRID_SIZE + GRID_SIZE / 2,
            lastFire: 0,
            damageLevel: 1,
            rangeLevel: 1,
            speedLevel: 1
        });

        this.money -= type.cost;
        this.updateUI();

        this.selectedTowerType = null;
        document.querySelectorAll('.tower-card').forEach(card => {
            card.classList.remove('selected');
        });
    }

    sellSelectedTower() {
        if (!this.selectedTower) return;

        const type = TOWER_TYPES[this.selectedTower.type];
        const baseCost = type.cost;
        const upgradeCost = type.upgradeBaseCost;

        const totalUpgradeLevels = (this.selectedTower.damageLevel - 1) +
                                   (this.selectedTower.rangeLevel - 1) +
                                   (this.selectedTower.speedLevel - 1);

        let totalUpgradeCost = 0;
        for (let i = 1; i <= totalUpgradeLevels; i++) {
            totalUpgradeCost += upgradeCost * i;
        }

        const refund = Math.floor((baseCost + totalUpgradeCost) * 0.5);

        this.money += refund;
        this.towers = this.towers.filter(t => t !== this.selectedTower);
        this.selectedTower = null;

        this.updateUI();
        this.updateButtons();
    }

    showUpgradeMenu() {
        if (!this.selectedTower) return;

        const type = TOWER_TYPES[this.selectedTower.type];
        const baseCost = type.upgradeBaseCost;

        const damageCost = this.selectedTower.damageLevel < 7 ? baseCost * this.selectedTower.damageLevel : null;
        const rangeCost = this.selectedTower.rangeLevel < 7 ? baseCost * this.selectedTower.rangeLevel : null;
        const speedCost = this.selectedTower.speedLevel < 7 ? baseCost * this.selectedTower.speedLevel : null;

        let message = `Выберите улучшение для башни "${type.name}":\n\n`;

        if (damageCost !== null) {
            message += `1. Урон (Уровень ${this.selectedTower.damageLevel}/7) - ${damageCost} монет\n`;
        } else {
            message += `1. Урон - МАКС\n`;
        }

        if (rangeCost !== null) {
            message += `2. Дальность (Уровень ${this.selectedTower.rangeLevel}/7) - ${rangeCost} монет\n`;
        } else {
            message += `2. Дальность - МАКС\n`;
        }

        if (speedCost !== null) {
            message += `3. Скорость (Уровень ${this.selectedTower.speedLevel}/7) - ${speedCost} монет\n`;
        } else {
            message += `3. Скорость - МАКС\n`;
        }

        message += `\nДеньги: ${this.money}\nВведите 1, 2 или 3:`;

        const choice = prompt(message);

        if (choice === '1' && damageCost !== null && this.money >= damageCost) {
            this.money -= damageCost;
            this.selectedTower.damageLevel++;
        } else if (choice === '2' && rangeCost !== null && this.money >= rangeCost) {
            this.money -= rangeCost;
            this.selectedTower.rangeLevel++;
        } else if (choice === '3' && speedCost !== null && this.money >= speedCost) {
            this.money -= speedCost;
            this.selectedTower.speedLevel++;
        }

        this.updateUI();
        this.updateButtons();
    }

    updateButtons() {
        const sellBtn = document.getElementById('sellTowerBtn');
        const upgradeBtn = document.getElementById('upgradeTowerBtn');

        if (this.selectedTower) {
            sellBtn.disabled = false;

            const maxed = this.selectedTower.damageLevel >= 7 &&
                         this.selectedTower.rangeLevel >= 7 &&
                         this.selectedTower.speedLevel >= 7;

            upgradeBtn.disabled = maxed;
        } else {
            sellBtn.disabled = true;
            upgradeBtn.disabled = true;
        }
    }

    calculatePath() {
        const pathFinder = new PathFinder(GRID_COLS, GRID_ROWS, this.towers);
        this.currentPath = pathFinder.findPath(START_POINT, END_POINT);

        if (!this.currentPath) {
            console.error('Путь не найден!');
            this.currentPath = [START_POINT, END_POINT];
        }
    }

    startWave() {
        if (this.waveInProgress || this.gameOver) return;
        if (this.wave >= WAVES.length) return;

        if (this.autoWaveTimer) {
            clearTimeout(this.autoWaveTimer);
            this.autoWaveTimer = null;
        }

        this.waveInProgress = true;
        this.wave++;

        // Пересчитываем путь перед волной
        this.calculatePath();

        this.spawnWave();
        this.updateUI();
    }

    spawnWave() {
        const waveConfig = WAVES[this.wave - 1];
        let delay = 0;

        waveConfig.enemies.forEach(({ type, count }) => {
            for (let i = 0; i < count; i++) {
                setTimeout(() => {
                    if (!this.gameOver) {
                        this.spawnEnemy(type);
                    }
                }, delay * 1000 / this.gameSpeed);
                delay += 0.8;
            }
        });
    }

    spawnEnemy(type) {
        const enemyType = ENEMY_TYPES[type];

        this.enemies.push({
            type,
            health: enemyType.health,
            maxHealth: enemyType.health,
            speed: enemyType.speed,
            pathIndex: 0,
            path: this.currentPath,
            x: START_POINT.x * GRID_SIZE + GRID_SIZE / 2,
            y: START_POINT.y * GRID_SIZE + GRID_SIZE / 2,
            slowEffect: 1,
            slowUntil: 0
        });

        this.updateUI();
    }

    togglePause() {
        this.isPaused = !this.isPaused;
        document.getElementById('pauseBtn').textContent = this.isPaused ? '▶️ Продолжить' : '⏸️ Пауза';
    }

    cycleSpeed(btn) {
        const speeds = [1, 2, 3];
        const currentIndex = speeds.indexOf(this.gameSpeed);
        this.gameSpeed = speeds[(currentIndex + 1) % speeds.length];
        btn.textContent = `⏩ x${this.gameSpeed}`;
        btn.dataset.speed = this.gameSpeed;
    }

    update(deltaTime) {
        if (this.isPaused || this.gameOver) return;

        const adjustedDelta = deltaTime * this.gameSpeed;

        // Обновляем врагов
        this.updateEnemies(adjustedDelta);

        // Обновляем башни
        this.updateTowers(Date.now());

        // Обновляем снаряды
        this.updateProjectiles(adjustedDelta);

        // Проверяем окончание волны
        if (this.waveInProgress && this.enemies.length === 0) {
            this.waveInProgress = false;

            if (this.wave >= WAVES.length) {
                this.win();
            } else {
                this.scheduleNextWave();
            }
        }
    }

    updateEnemies(deltaTime) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const enemyType = ENEMY_TYPES[enemy.type];

            // Проверяем эффект замедления
            const now = Date.now();
            if (now < enemy.slowUntil) {
                enemy.slowEffect = 0.5;
            } else {
                enemy.slowEffect = 1;
            }

            // Движение по пути
            if (!enemy.path || enemy.pathIndex >= enemy.path.length - 1) {
                // Враг дошел до конца
                this.lives--;
                this.enemies.splice(i, 1);

                if (this.lives <= 0) {
                    this.gameOver = true;
                    this.showGameOver(false);
                }

                this.updateUI();
                continue;
            }

            const nextPoint = enemy.path[enemy.pathIndex + 1];
            const targetX = nextPoint.x * GRID_SIZE + GRID_SIZE / 2;
            const targetY = nextPoint.y * GRID_SIZE + GRID_SIZE / 2;

            const dx = targetX - enemy.x;
            const dy = targetY - enemy.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const moveSpeed = enemyType.speed * enemy.slowEffect * deltaTime * 0.03;

            if (distance < moveSpeed) {
                enemy.x = targetX;
                enemy.y = targetY;
                enemy.pathIndex++;
            } else {
                enemy.x += (dx / distance) * moveSpeed;
                enemy.y += (dy / distance) * moveSpeed;
            }

            // Проверяем смерть
            if (enemy.health <= 0) {
                this.money += enemyType.reward;
                this.score += enemyType.reward * 10;
                this.enemies.splice(i, 1);
                this.updateUI();
            }
        }
    }

    updateTowers(now) {
        this.towers.forEach(tower => {
            const type = TOWER_TYPES[tower.type];

            // Вычисляем параметры с учетом улучшений
            const fireRate = type.fireRate / (1 + (tower.speedLevel - 1) * 0.15);
            const adjustedFireRate = fireRate / this.gameSpeed;

            if (now - tower.lastFire < adjustedFireRate) return;

            // Вычисляем дальность с учетом улучшений
            const range = type.range * (1 + (tower.rangeLevel - 1) * 0.2);

            // Находим ближайшего врага в радиусе
            let target = null;
            let minDistance = range;

            this.enemies.forEach(enemy => {
                const dx = enemy.x - tower.x;
                const dy = enemy.y - tower.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < minDistance) {
                    minDistance = distance;
                    target = enemy;
                }
            });

            if (target) {
                this.fireProjectile(tower, target);
                tower.lastFire = now;
            }
        });
    }

    fireProjectile(tower, target) {
        const type = TOWER_TYPES[tower.type];

        // Вычисляем урон с учетом улучшений
        const damage = type.damage * (1 + (tower.damageLevel - 1) * 0.3);

        this.projectiles.push({
            x: tower.x,
            y: tower.y,
            targetX: target.x,
            targetY: target.y,
            target: target,
            speed: type.projectileSpeed,
            damage: damage,
            tower: tower,
            color: type.color
        });
    }

    updateProjectiles(deltaTime) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];

            // Если цель мертва, удаляем снаряд
            if (!this.enemies.includes(proj.target)) {
                this.projectiles.splice(i, 1);
                continue;
            }

            // Обновляем позицию цели
            proj.targetX = proj.target.x;
            proj.targetY = proj.target.y;

            const dx = proj.targetX - proj.x;
            const dy = proj.targetY - proj.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const moveDistance = proj.speed * deltaTime * 0.1;

            if (distance < moveDistance || distance < 5) {
                // Попадание
                this.hitTarget(proj);
                this.projectiles.splice(i, 1);
            } else {
                proj.x += (dx / distance) * moveDistance;
                proj.y += (dy / distance) * moveDistance;
            }
        }
    }

    hitTarget(proj) {
        const type = TOWER_TYPES[proj.tower.type];

        // Эффект пушки (AOE)
        if (type.splashRadius) {
            this.enemies.forEach(enemy => {
                const dx = enemy.x - proj.target.x;
                const dy = enemy.y - proj.target.y;
                const distance = Math.sqrt(dx * dx + dy * dy);

                if (distance < type.splashRadius) {
                    enemy.health -= proj.damage * 0.7;
                }
            });
        }

        // Эффект заморозки
        if (type.slowEffect) {
            proj.target.slowUntil = Date.now() + type.slowDuration;
        }

        // Основной урон
        proj.target.health -= proj.damage;
    }

    draw() {
        // Очищаем canvas
        this.ctx.fillStyle = '#2d5016';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        // Рисуем сетку
        this.drawGrid();

        // Рисуем путь
        this.drawPath();

        // Рисуем башни
        this.drawTowers();

        // Рисуем врагов
        this.drawEnemies();

        // Рисуем снаряды
        this.drawProjectiles();

        // Рисуем радиус выбранной башни
        if (this.selectedTower) {
            this.drawTowerRange(this.selectedTower);
        }
    }

    drawGrid() {
        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 1;

        for (let x = 0; x <= GRID_COLS; x++) {
            this.ctx.beginPath();
            this.ctx.moveTo(x * GRID_SIZE, 0);
            this.ctx.lineTo(x * GRID_SIZE, this.canvas.height);
            this.ctx.stroke();
        }

        for (let y = 0; y <= GRID_ROWS; y++) {
            this.ctx.beginPath();
            this.ctx.moveTo(0, y * GRID_SIZE);
            this.ctx.lineTo(this.canvas.width, y * GRID_SIZE);
            this.ctx.stroke();
        }
    }

    drawPath() {
        if (!this.currentPath || this.currentPath.length < 2) return;

        this.ctx.strokeStyle = '#8B4513';
        this.ctx.lineWidth = GRID_SIZE * 0.8;
        this.ctx.lineCap = 'round';
        this.ctx.lineJoin = 'round';

        this.ctx.beginPath();
        this.currentPath.forEach((point, index) => {
            const x = point.x * GRID_SIZE + GRID_SIZE / 2;
            const y = point.y * GRID_SIZE + GRID_SIZE / 2;

            if (index === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        });
        this.ctx.stroke();

        // Стартовая точка
        this.ctx.fillStyle = '#4CAF50';
        this.ctx.beginPath();
        this.ctx.arc(
            START_POINT.x * GRID_SIZE + GRID_SIZE / 2,
            START_POINT.y * GRID_SIZE + GRID_SIZE / 2,
            15,
            0,
            Math.PI * 2
        );
        this.ctx.fill();

        // Конечная точка
        this.ctx.fillStyle = '#F44336';
        this.ctx.beginPath();
        this.ctx.arc(
            END_POINT.x * GRID_SIZE + GRID_SIZE / 2,
            END_POINT.y * GRID_SIZE + GRID_SIZE / 2,
            15,
            0,
            Math.PI * 2
        );
        this.ctx.fill();
    }

    drawTowers() {
        this.towers.forEach(tower => {
            const type = TOWER_TYPES[tower.type];

            // Основа башни
            this.ctx.fillStyle = type.color;
            this.ctx.strokeStyle = this.selectedTower === tower ? '#FFD700' : '#333';
            this.ctx.lineWidth = this.selectedTower === tower ? 4 : 2;

            this.ctx.beginPath();
            this.ctx.arc(tower.x, tower.y, 15, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

            // Показываем уровни улучшений
            const totalLevel = tower.damageLevel + tower.rangeLevel + tower.speedLevel;
            if (totalLevel > 3) {
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 10px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText(totalLevel, tower.x, tower.y);
            }
        });
    }

    drawEnemies() {
        this.enemies.forEach(enemy => {
            const type = ENEMY_TYPES[enemy.type];

            // Тело врага
            this.ctx.fillStyle = type.color;
            this.ctx.beginPath();
            this.ctx.arc(enemy.x, enemy.y, 12, 0, Math.PI * 2);
            this.ctx.fill();

            // Полоска здоровья
            const healthBarWidth = 24;
            const healthBarHeight = 4;
            const healthPercent = enemy.health / enemy.maxHealth;

            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(
                enemy.x - healthBarWidth / 2,
                enemy.y - 20,
                healthBarWidth,
                healthBarHeight
            );

            this.ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.25 ? '#FFC107' : '#F44336';
            this.ctx.fillRect(
                enemy.x - healthBarWidth / 2,
                enemy.y - 20,
                healthBarWidth * healthPercent,
                healthBarHeight
            );

            // Эффект замедления
            if (Date.now() < enemy.slowUntil) {
                this.ctx.strokeStyle = '#00BCD4';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(enemy.x, enemy.y, 15, 0, Math.PI * 2);
                this.ctx.stroke();
            }
        });
    }

    drawProjectiles() {
        this.projectiles.forEach(proj => {
            this.ctx.fillStyle = proj.color;
            this.ctx.beginPath();
            this.ctx.arc(proj.x, proj.y, 4, 0, Math.PI * 2);
            this.ctx.fill();
        });
    }

    drawTowerRange(tower) {
        const type = TOWER_TYPES[tower.type];
        const range = type.range * (1 + (tower.rangeLevel - 1) * 0.2);

        this.ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        this.ctx.lineWidth = 2;

        this.ctx.beginPath();
        this.ctx.arc(tower.x, tower.y, range, 0, Math.PI * 2);
        this.ctx.fill();
        this.ctx.stroke();
    }

    updateUI() {
        document.getElementById('money').textContent = this.money;
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('wave').textContent = this.wave;
        document.getElementById('enemies').textContent = this.enemies.length;
        document.getElementById('score').textContent = this.score;

        // Обновляем доступность башен
        document.querySelectorAll('.tower-card').forEach(card => {
            const type = TOWER_TYPES[card.dataset.tower];
            if (this.money < type.cost) {
                card.style.opacity = '0.5';
                card.style.pointerEvents = 'none';
            } else {
                card.style.opacity = '1';
                card.style.pointerEvents = 'auto';
            }
        });
    }

    showGameOver(won) {
        const overlay = document.getElementById('gameOverlay');
        const title = document.getElementById('overlayTitle');
        const message = document.getElementById('overlayMessage');
        const scoreDisplay = document.getElementById('overlayScore');

        overlay.classList.remove('hidden');

        if (won) {
            title.textContent = '🎉 Победа!';
            message.textContent = 'Вы защитили базу от всех волн врагов!';
        } else {
            title.textContent = '💥 Поражение';
            message.textContent = 'Враги прорвались к вашей базе!';
        }

        scoreDisplay.textContent = `Счёт: ${this.score}`;
    }

    win() {
        this.gameOver = true;
        this.showGameOver(true);
    }

    restart() {
        window.location.reload();
    }

    gameLoop() {
        let lastTime = Date.now();

        const loop = () => {
            const now = Date.now();
            const deltaTime = now - lastTime;
            lastTime = now;

            this.update(deltaTime);
            this.draw();

            requestAnimationFrame(loop);
        };

        loop();
    }
}

// Запуск игры
window.addEventListener('load', () => {
    new Game();
});
