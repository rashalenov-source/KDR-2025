// Игровые константы
const GAME_VERSION = "8.8-FULL-GAMEPLAY";
const GRID_SIZE = 40;
const GRID_COLS = 20;
const GRID_ROWS = 15;
const AUTO_WAVE_DELAY = 7000; // 7 секунд
const PATH_RECALC_INTERVAL = 100; // Пересчет пути каждые 100мс

// Конечная точка (финиш)
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
        speed: 1.2,
        reward: 10,
        color: '#E91E63',
        shape: 'circle',
        size: 12
    },
    fast: {
        name: 'Быстрый',
        health: 30,
        speed: 2.5,
        reward: 15,
        color: '#9C27B0',
        shape: 'circle',
        size: 10
    },
    tank: {
        name: 'Танк',
        health: 200,
        speed: 0.6,
        reward: 30,
        color: '#795548',
        shape: 'square',
        size: 16,
        hasShield: true
    },
    boss: {
        name: 'Босс',
        health: 500,
        speed: 0.4,
        reward: 100,
        color: '#F44336',
        shape: 'square',
        size: 20,
        hasShield: true
    },
    scout: {
        name: 'Разведчик',
        health: 20,
        speed: 3.0,
        reward: 8,
        color: '#00E676',
        shape: 'triangle',
        size: 10,
        isScout: true
    }
};

// Волны врагов - полноценный геймплей
const WAVES = [];
for (let i = 0; i < 15; i++) {
    const enemyCount = 7 + i * 3;
    const wave = { enemies: [] };

    if (i === 0) {
        wave.enemies.push({ type: 'basic', count: enemyCount });
    } else if (i < 3) {
        wave.enemies.push(
            { type: 'basic', count: Math.floor(enemyCount * 0.7) },
            { type: 'fast', count: Math.floor(enemyCount * 0.3) }
        );
    } else if (i < 6) {
        wave.enemies.push(
            { type: 'basic', count: Math.floor(enemyCount * 0.5) },
            { type: 'fast', count: Math.floor(enemyCount * 0.3) },
            { type: 'tank', count: Math.floor(enemyCount * 0.2) }
        );
    } else if (i < 10) {
        wave.enemies.push(
            { type: 'basic', count: Math.floor(enemyCount * 0.4) },
            { type: 'fast', count: Math.floor(enemyCount * 0.3) },
            { type: 'tank', count: Math.floor(enemyCount * 0.3) }
        );
    } else {
        wave.enemies.push(
            { type: 'basic', count: Math.floor(enemyCount * 0.3) },
            { type: 'fast', count: Math.floor(enemyCount * 0.3) },
            { type: 'tank', count: Math.floor(enemyCount * 0.3) },
            { type: 'boss', count: Math.max(1, Math.floor(enemyCount * 0.1)) }
        );
    }

    // Добавляем 4 разведчика в середину волны
    wave.scoutCount = 4;

    WAVES.push(wave);
}

// A* pathfinding с агрессивным избеганием башен
class PathFinder {
    constructor(gridCols, gridRows, towers) {
        this.gridCols = gridCols;
        this.gridRows = gridRows;
        this.towers = towers;
        this.dangerMap = this.buildDangerMap();
    }

    buildDangerMap() {
        const map = {};

        this.towers.forEach((tower, i) => {
            const type = TOWER_TYPES[tower.type];
            const range = type.range * (1 + (tower.rangeLevel - 1) * 0.2);
            const damage = type.damage * (1 + (tower.damageLevel - 1) * 0.3);
            const fireRate = type.fireRate / (1 + (tower.speedLevel - 1) * 0.15);

            // DPS башни
            const dps = damage / (fireRate / 1000);

            // ИСПРАВЛЕНИЕ: используем ТОЛЬКО реальный радиус атаки, без раздувания!
            const rangeInCells = Math.ceil(range / GRID_SIZE);
            const effectiveRange = range; // Реальный радиус, без +60!

            for (let dx = -rangeInCells; dx <= rangeInCells; dx++) {
                for (let dy = -rangeInCells; dy <= rangeInCells; dy++) {
                    const x = tower.gridX + dx;
                    const y = tower.gridY + dy;

                    if (x >= 0 && x < this.gridCols && y >= 0 && y < this.gridRows) {
                        const dist = Math.sqrt(dx * dx + dy * dy) * GRID_SIZE;

                        if (dist <= effectiveRange) {
                            const key = `${x},${y}`;

                            // Нормализованное расстояние (0 = в центре, 1 = на краю)
                            const normalizedDist = dist / effectiveRange;

                            // ЭКСТРЕМАЛЬНАЯ опасность: чем ближе к башне, тем опаснее
                            // Степень 5 для резкого роста ближе к центру
                            const distanceFactor = Math.pow(1 - normalizedDist, 5);

                            // Базовая опасность зависит от DPS
                            // РАДИКАЛЬНО УВЕЛИЧЕНО: x100 для реального обхода башен!
                            const baseDanger = dps * 2000000;

                            // Итоговая опасность
                            const dangerFromTower = distanceFactor * baseDanger;

                            map[key] = (map[key] || 0) + dangerFromTower;
                        }
                    }
                }
            }
        });

        // ОТЛАДКА: проверяем dangerMap
        const dangerCount = Object.keys(map).length;
        const maxDanger = Math.max(...Object.values(map), 0);
        console.log(`🗺️ DangerMap: ${dangerCount} опасных клеток, макс. опасность=${maxDanger.toFixed(0)}`);

        return map;
    }

    findPath(start, end, isScout = false, debugLog = false) {
        // Разведчики идут случайным путем
        if (isScout) {
            return this.findRandomPath(start, end);
        }

        // Ищем путь БЕЗ блокировки, но с огромными штрафами за опасные клетки
        // Штраф +10000 за каждую опасную клетку заставит A* обходить башни
        let path = this.findPathWithDangerBlocking(start, end, false, debugLog);

        return path;
    }

    findPathWithDangerBlocking(start, end, blockDangerous, debugLog = false) {
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

        // ОТЛАДКА: счетчики для анализа
        let penalizedSteps = 0;
        let totalPenaltyApplied = 0;
        let safeCells = 0;
        let iterations = 0;

        if (debugLog) {
            console.log(`\n🔍 ДЕТАЛЬНЫЙ РАСЧЕТ ПУТИ: [${start.x},${start.y}] → [${end.x},${end.y}]`);
            console.log(`📊 Башен на карте: ${this.towers.length}`);
            console.log(`🗺️ Опасных клеток в dangerMap: ${Object.keys(this.dangerMap).length}`);
        }

        while (openSet.length > 0) {
            iterations++;

            let current = openSet.reduce((min, node) => {
                const minKey = `${min.x},${min.y}`;
                const nodeKey = `${node.x},${node.y}`;
                return (fScore.get(nodeKey) || Infinity) < (fScore.get(minKey) || Infinity) ? node : min;
            });

            const currentKey = `${current.x},${current.y}`;

            if (currentKey === endKey) {
                const path = this.reconstructPath(cameFrom, current);

                // ОТЛАДКА: анализируем найденный путь
                let dangerousCells = 0;
                let totalDanger = 0;
                path.forEach(point => {
                    const key = `${point.x},${point.y}`;
                    const danger = this.dangerMap[key] || 0;
                    if (danger > 1) {
                        dangerousCells++;
                        totalDanger += danger;
                    }
                });

                console.log(`📊 Путь: длина=${path.length}, опасных=${dangerousCells}, итераций=${iterations}`);
                console.log(`   В процессе: штрафовано=${penalizedSteps} шагов, безопасных=${safeCells}, общий штраф=${totalPenaltyApplied.toFixed(0)}`);

                if (debugLog) {
                    console.log(`\n✅ ПУТЬ НАЙДЕН! Детали:`);
                    path.forEach((p, i) => {
                        const key = `${p.x},${p.y}`;
                        const danger = this.dangerMap[key] || 0;
                        console.log(`   ${i}. [${p.x},${p.y}] danger=${danger.toFixed(1)}`);
                    });
                }

                return path;
            }

            // ОТЛАДКА: детальное логирование первых 15 итераций
            if (debugLog && iterations <= 15) {
                console.log(`\n--- Итерация ${iterations} ---`);
                console.log(`🎯 Текущая клетка: [${current.x},${current.y}], gScore=${gScore.get(currentKey).toFixed(2)}`);
            }

            openSet.splice(openSet.indexOf(current), 1);
            closedSet.add(currentKey);

            const neighbors = this.getNeighbors(current, blockDangerous);

            if (debugLog && iterations <= 15) {
                console.log(`   Соседей найдено: ${neighbors.length}`);
            }

            if (debugLog && iterations <= 3) {
                console.log(`   📋 openSet ДО обработки: ${openSet.length} узлов`);
            }

            for (const neighbor of neighbors) {
                const neighborKey = `${neighbor.x},${neighbor.y}`;

                if (closedSet.has(neighborKey)) continue;

                // ПРОПОРЦИОНАЛЬНЫЙ штраф: чем опаснее клетка, тем больше штраф
                const danger = this.dangerMap[neighborKey] || 0;
                const baseCost = (neighbor.x !== current.x && neighbor.y !== current.y) ? 1.414 : 1;

                // Штраф пропорционален опасности
                // РАДИКАЛЬНО УВЕЛИЧЕНО: x100 для РЕАЛЬНОГО обхода башен!
                // Теперь даже слабая башня создает огромный штраф
                const dangerPenalty = danger * 50000;
                const moveCost = baseCost + dangerPenalty;

                // ОТЛАДКА: детальное логирование соседей
                if (debugLog && iterations <= 15) {
                    console.log(`     → [${neighbor.x},${neighbor.y}]: base=${baseCost.toFixed(2)}, danger=${danger.toFixed(1)}, penalty=${dangerPenalty.toFixed(0)}, total=${moveCost.toFixed(0)}`);
                }

                // ОТЛАДКА: считаем статистику
                if (danger > 1) {
                    penalizedSteps++;
                    totalPenaltyApplied += dangerPenalty;
                } else {
                    safeCells++;
                }

                const currentGScore = gScore.get(currentKey);
                if (currentGScore === undefined && debugLog && iterations <= 3) {
                    console.error(`⚠️⚠️⚠️ КРИТИЧНО: gScore для current [${current.x},${current.y}] = undefined!`);
                }

                const tentativeGScore = (currentGScore ?? Infinity) + moveCost;
                const existingGScore = gScore.get(neighborKey);
                const inOpenSet = openSet.some(n => `${n.x},${n.y}` === neighborKey);

                if (debugLog && iterations <= 3) {
                    console.log(`       ПРОВЕРКА: inOpenSet=${inOpenSet}, existingG=${existingGScore?.toFixed(0) || 'undefined'}, tentativeG=${tentativeGScore.toFixed(0)}`);
                }

                if (!inOpenSet) {
                    openSet.push(neighbor);
                    if (debugLog && iterations <= 3) {
                        console.log(`       ✅ ДОБАВЛЕН в openSet`);
                    }
                } else if (tentativeGScore >= (existingGScore ?? Infinity)) {
                    if (debugLog && iterations <= 3) {
                        console.log(`       ❌ ПРОПУЩЕН (не лучший путь)`);
                    }
                    continue;
                } else {
                    if (debugLog && iterations <= 3) {
                        console.log(`       ♻️ ОБНОВЛЕН (лучший путь найден)`);
                    }
                }

                cameFrom.set(neighborKey, current);
                gScore.set(neighborKey, tentativeGScore);
                const newFScore = tentativeGScore + this.heuristic(neighbor, end);
                fScore.set(neighborKey, newFScore);

                if (debugLog && iterations <= 3) {
                    console.log(`       📝 УСТАНОВЛЕНО: gScore=${tentativeGScore.toFixed(0)}, fScore=${newFScore.toFixed(4)}`);
                }
            }

            // ОТЛАДКА: показываем состояние openSet после обработки всех соседей
            if (debugLog && iterations <= 3) {
                console.log(`\n   📋 openSet ПОСЛЕ обработки (${openSet.length} узлов):`);
                openSet.forEach(node => {
                    const key = `${node.x},${node.y}`;
                    const g = gScore.get(key);
                    const f = fScore.get(key);
                    console.log(`      [${node.x},${node.y}]: gScore=${g?.toFixed(0) || 'undefined'}, fScore=${f?.toFixed(4) || 'undefined'}`);
                });
            }
        }

        return null;
    }

    findRandomPath(start, end) {
        // Случайный путь для разведчиков
        const path = [start];
        let current = { ...start };
        const visited = new Set();
        visited.add(`${start.x},${start.y}`);

        while (current.x !== end.x || current.y !== end.y) {
            const neighbors = this.getNeighbors(current).filter(n => {
                const key = `${n.x},${n.y}`;
                return !visited.has(key);
            });

            if (neighbors.length === 0) {
                // Тупик - идем к цели напрямую
                const allNeighbors = this.getNeighbors(current);
                if (allNeighbors.length === 0) break;

                // Выбираем ближайшего к цели
                current = allNeighbors.reduce((closest, n) => {
                    const distN = Math.abs(n.x - end.x) + Math.abs(n.y - end.y);
                    const distClosest = Math.abs(closest.x - end.x) + Math.abs(closest.y - end.y);
                    return distN < distClosest ? n : closest;
                });
            } else {
                // Случайный сосед с сильным bias к цели
                if (Math.random() < 0.75) {
                    // 75% шанс идти к цели - разведчики должны продвигаться вперед!
                    current = neighbors.reduce((closest, n) => {
                        const distN = Math.abs(n.x - end.x) + Math.abs(n.y - end.y);
                        const distClosest = Math.abs(closest.x - end.x) + Math.abs(closest.y - end.y);
                        return distN < distClosest ? n : closest;
                    });
                } else {
                    // 25% шанс случайное направление для разведки
                    current = neighbors[Math.floor(Math.random() * neighbors.length)];
                }
            }

            visited.add(`${current.x},${current.y}`);
            path.push({ ...current });

            // Защита от бесконечного цикла
            if (path.length > this.gridCols * this.gridRows) {
                break;
            }
        }

        return path;
    }

    getNeighbors(node, blockDangerous = false) {
        const neighbors = [];
        const directions = [
            { x: 0, y: -1 },
            { x: 1, y: 0 },
            { x: 0, y: 1 },
            { x: -1, y: 0 },
            { x: 1, y: -1 },
            { x: 1, y: 1 },
            { x: -1, y: 1 },
            { x: -1, y: -1 }
        ];

        for (const dir of directions) {
            const newX = node.x + dir.x;
            const newY = node.y + dir.y;

            if (newX >= 0 && newX < this.gridCols && newY >= 0 && newY < this.gridRows) {
                const hasTower = this.towers.some(t => t.gridX === newX && t.gridY === newY);

                // ИСПРАВЛЕНО: радиус урона башни НЕ блокирует путь!
                // Только сама башня является препятствием.
                // Система штрафов (dangerMap) уже заставляет врагов избегать опасных зон.

                if (!hasTower) {
                    neighbors.push({ x: newX, y: newY });
                }
            }
        }

        return neighbors;
    }

    heuristic(a, b) {
        // КРИТИЧНО: эвристика умножена на 0.00001 чтобы не влиять на выбор пути!
        // Теперь алгоритм ищет БЕЗОПАСНЫЙ путь, а не КОРОТКИЙ.
        // Штрафы за башни (миллионы) >> расстояние (десятки)
        return (Math.abs(a.x - b.x) + Math.abs(a.y - b.y)) * 0.00001;
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

        this.upgradeButtons = [];
        this.lastPathRecalc = 0;

        // Система порталов
        this.portals = [];
        this.portalAnimation = 0; // Для анимации
        this.createPortal(0, 6); // Первый портал в левой трети карты

        this.initEventListeners();
        this.gameLoop();
        this.scheduleNextWave();
    }

    createPortal(minX, maxX) {
        // Создаем портал в случайной позиции
        const x = Math.floor(Math.random() * (maxX - minX + 1)) + minX;
        const y = Math.floor(Math.random() * GRID_ROWS);

        const portal = {
            gridX: x,
            gridY: y,
            x: x * GRID_SIZE + GRID_SIZE / 2,
            y: y * GRID_SIZE + GRID_SIZE / 2,
            active: true
        };

        this.portals.push(portal);
        console.log(`🌀 Портал открыт в позиции [${x}, ${y}]`);
        return portal;
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
        document.querySelectorAll('.tower-card').forEach(card => {
            card.addEventListener('click', () => {
                const towerType = card.dataset.tower;
                this.selectTowerType(towerType);
            });
        });

        this.canvas.addEventListener('click', (e) => {
            const rect = this.canvas.getBoundingClientRect();
            const x = ((e.clientX - rect.left) / rect.width) * this.canvas.width;
            const y = ((e.clientY - rect.top) / rect.height) * this.canvas.height;
            this.handleCanvasClick(x, y);
        });

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
            // Не используем
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
        // Проверяем клик по кнопкам апгрейда
        if (this.selectedTower && this.upgradeButtons.length > 0) {
            for (const btn of this.upgradeButtons) {
                const dx = x - btn.x;
                const dy = y - btn.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                if (dist < btn.radius) {
                    this.upgradeSelectedTower(btn.type);
                    return;
                }
            }
        }

        const gridX = Math.floor(x / GRID_SIZE);
        const gridY = Math.floor(y / GRID_SIZE);

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
            this.updateUpgradeButtons();
            return;
        }

        if (this.selectedTowerType) {
            this.placeTower(gridX, gridY);
        } else {
            this.selectedTower = null;
            this.upgradeButtons = [];
            this.updateButtons();
        }
    }

    updateUpgradeButtons() {
        this.upgradeButtons = [];

        if (!this.selectedTower) return;

        const tower = this.selectedTower;
        const type = TOWER_TYPES[tower.type];
        const baseCost = type.upgradeBaseCost;

        const buttonRadius = 20;
        const offset = 45;

        // Кнопка урона
        if (tower.damageLevel < 7) {
            this.upgradeButtons.push({
                type: 'damage',
                x: tower.x - offset,
                y: tower.y - offset,
                radius: buttonRadius,
                level: tower.damageLevel,
                cost: baseCost * tower.damageLevel,
                icon: '⚔️',
                color: '#FF5722'
            });
        }

        // Кнопка дальности
        if (tower.rangeLevel < 7) {
            this.upgradeButtons.push({
                type: 'range',
                x: tower.x,
                y: tower.y - offset - 10,
                radius: buttonRadius,
                level: tower.rangeLevel,
                cost: baseCost * tower.rangeLevel,
                icon: '🎯',
                color: '#2196F3'
            });
        }

        // Кнопка скорости
        if (tower.speedLevel < 7) {
            this.upgradeButtons.push({
                type: 'speed',
                x: tower.x + offset,
                y: tower.y - offset,
                radius: buttonRadius,
                level: tower.speedLevel,
                cost: baseCost * tower.speedLevel,
                icon: '⚡',
                color: '#FFC107'
            });
        }
    }

    placeTower(gridX, gridY) {
        const type = TOWER_TYPES[this.selectedTowerType];

        if (this.money < type.cost) return;
        if (gridX < 0 || gridX >= GRID_COLS || gridY < 0 || gridY >= GRID_ROWS) return;
        if (this.towers.some(t => t.gridX === gridX && t.gridY === gridY)) return;

        // Нельзя строить на финише или на порталах
        if (gridX === END_POINT.x && gridY === END_POINT.y) return;
        if (this.portals.some(p => p.gridX === gridX && p.gridY === gridY)) {
            alert('Нельзя строить на портале!');
            return;
        }

        // Проверяем что от КАЖДОГО портала до финиша существует путь
        const testTowers = [...this.towers, { gridX, gridY, type: this.selectedTowerType, rangeLevel: 1, damageLevel: 1, speedLevel: 1 }];
        const pathFinder = new PathFinder(GRID_COLS, GRID_ROWS, testTowers);

        for (const portal of this.portals) {
            const testPath = pathFinder.findPath({ x: portal.gridX, y: portal.gridY }, END_POINT);
            if (!testPath) {
                alert('Нельзя полностью заблокировать путь от портала!');
                return;
            }
        }

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

        // КРИТИЧНО: пересчитываем пути врагов сразу после установки башни!
        console.log(`🗼 Башня установлена! Пересчитываем пути для ${this.enemies.length} врагов`);
        this.recalculateEnemyPaths();

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
        this.upgradeButtons = [];

        // КРИТИЧНО: пересчитываем пути врагов сразу после продажи башни!
        this.recalculateEnemyPaths();

        this.updateUI();
        this.updateButtons();
    }

    upgradeSelectedTower(upgradeType) {
        if (!this.selectedTower) return;

        const type = TOWER_TYPES[this.selectedTower.type];
        const baseCost = type.upgradeBaseCost;

        let cost = 0;
        let canUpgrade = false;

        if (upgradeType === 'damage' && this.selectedTower.damageLevel < 7) {
            cost = baseCost * this.selectedTower.damageLevel;
            canUpgrade = true;
        } else if (upgradeType === 'range' && this.selectedTower.rangeLevel < 7) {
            cost = baseCost * this.selectedTower.rangeLevel;
            canUpgrade = true;
        } else if (upgradeType === 'speed' && this.selectedTower.speedLevel < 7) {
            cost = baseCost * this.selectedTower.speedLevel;
            canUpgrade = true;
        }

        if (canUpgrade && this.money >= cost) {
            this.money -= cost;

            if (upgradeType === 'damage') {
                this.selectedTower.damageLevel++;
            } else if (upgradeType === 'range') {
                this.selectedTower.rangeLevel++;
            } else if (upgradeType === 'speed') {
                this.selectedTower.speedLevel++;
            }

            // КРИТИЧНО: пересчитываем пути врагов сразу после апгрейда башни!
            console.log(`⬆️ Апгрейд башни (${upgradeType})! Пересчитываем пути для ${this.enemies.length} врагов`);
            this.recalculateEnemyPaths();

            this.updateUI();
            this.updateButtons();
            this.updateUpgradeButtons();
        }
    }

    updateButtons() {
        const sellBtn = document.getElementById('sellTowerBtn');
        const upgradeBtn = document.getElementById('upgradeTowerBtn');

        if (this.selectedTower) {
            sellBtn.disabled = false;
            upgradeBtn.style.display = 'none';
        } else {
            sellBtn.disabled = true;
            upgradeBtn.style.display = 'none';
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

        // Открываем второй портал после 20 волны
        if (this.wave === 20 && this.portals.length === 1) {
            this.createPortal(7, 13); // Второй портал во второй трети карты
        }

        this.spawnWave();
        this.updateUI();
    }

    spawnWave() {
        const waveConfig = WAVES[this.wave - 1];
        let delay = 0;

        // Спавним разведчиков ПЕРВЫМИ - они летят впереди волны!
        for (let i = 0; i < waveConfig.scoutCount; i++) {
            setTimeout(() => {
                if (!this.gameOver) {
                    this.spawnEnemy('scout');
                }
            }, (i * 0.3) * 1000 / this.gameSpeed); // Быстро один за другим
        }

        // Задержка перед основной волной
        delay = 1.5;

        // Спавним обычных врагов
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
        const isScout = enemyType.isScout;

        // Выбираем случайный активный портал
        const activePortals = this.portals.filter(p => p.active);
        if (activePortals.length === 0) {
            console.warn(`⚠️ Нет активных порталов для спавна врага ${type}!`);
            return;
        }

        const portal = activePortals[Math.floor(Math.random() * activePortals.length)];
        let startX = portal.gridX;
        let startY = portal.gridY;

        // Разведчики с небольшим смещением от портала
        if (isScout) {
            const offset = Math.floor(Math.random() * 3) - 1; // -1, 0, +1
            startY = Math.max(0, Math.min(GRID_ROWS - 1, startY + offset));
        }

        const startPoint = { x: startX, y: startY };
        const pathFinder = new PathFinder(GRID_COLS, GRID_ROWS, this.towers);

        // ОТЛАДКА: включаем детальное логирование для первого монстра в волне
        const debugLog = this.enemies.length === 0;
        if (debugLog) {
            console.log(`\n🔬 ===== ОТЛАДКА ПЕРВОГО МОНСТРА ${type.toUpperCase()} =====`);
        }

        // Вычисляем путь от портала до финиша
        let enemyPath = pathFinder.findPath(startPoint, END_POINT, isScout, debugLog);

        // Если путь не найден - не спавним врага
        if (!enemyPath || enemyPath.length === 0) {
            console.warn(`⚠️ Не могу заспавнить врага ${type}: путь от портала [${startX},${startY}] не найден!`);
            return;
        }

        this.enemies.push({
            type,
            health: enemyType.health,
            maxHealth: enemyType.health,
            speed: enemyType.speed,
            pathIndex: 0,
            path: enemyPath,
            x: startX * GRID_SIZE + GRID_SIZE / 2,
            y: startY * GRID_SIZE + GRID_SIZE / 2,
            slowEffect: 1,
            slowUntil: 0,
            gridX: startX,
            gridY: startY,
            lastPathUpdate: Date.now(),
            isScout: isScout,
            portalId: this.portals.indexOf(portal) // Запоминаем из какого портала вышел
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

        // Пересчитываем пути каждые 100мс
        const now = Date.now();
        if (now - this.lastPathRecalc > PATH_RECALC_INTERVAL) {
            this.recalculateEnemyPaths();
            this.lastPathRecalc = now;
        }

        this.updateEnemies(adjustedDelta);
        this.updateTowers(now);
        this.updateProjectiles(adjustedDelta);

        if (this.waveInProgress && this.enemies.length === 0) {
            this.waveInProgress = false;

            if (this.wave >= WAVES.length) {
                this.win();
            } else {
                this.scheduleNextWave();
            }
        }
    }

    recalculateEnemyPaths() {
        // Пересчитываем пути для всех врагов
        this.enemies.forEach((enemy, index) => {
            if (enemy.isScout) {
                // Разведчики не пересчитывают путь
                return;
            }

            const currentGrid = {
                x: Math.floor(enemy.x / GRID_SIZE),
                y: Math.floor(enemy.y / GRID_SIZE)
            };

            // ОТЛАДКА: логируем пересчет для первого врага
            const debugLog = index === 0;
            if (debugLog) {
                console.log(`\n🔄 ===== ПЕРЕСЧЕТ ПУТИ (${enemy.type.toUpperCase()}) =====`);
            }

            const pathFinder = new PathFinder(GRID_COLS, GRID_ROWS, this.towers);
            const newPath = pathFinder.findPath(currentGrid, END_POINT, false, debugLog);

            if (newPath && newPath.length > 1) {
                enemy.path = newPath;
                enemy.pathIndex = 0;
            }
        });
    }

    updateEnemies(deltaTime) {
        for (let i = this.enemies.length - 1; i >= 0; i--) {
            const enemy = this.enemies[i];
            const enemyType = ENEMY_TYPES[enemy.type];

            const now = Date.now();
            if (now < enemy.slowUntil) {
                enemy.slowEffect = 0.5;
            } else {
                enemy.slowEffect = 1;
            }

            if (!enemy.path || enemy.pathIndex >= enemy.path.length - 1) {
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
            let targetX = nextPoint.x * GRID_SIZE + GRID_SIZE / 2;
            let targetY = nextPoint.y * GRID_SIZE + GRID_SIZE / 2;

            // Проверка на застревание у башен
            let repelForceX = 0;
            let repelForceY = 0;

            for (const tower of this.towers) {
                const dx = enemy.x - tower.x;
                const dy = enemy.y - tower.y;
                const dist = Math.sqrt(dx * dx + dy * dy);

                // Отталкивание от самой башни
                if (dist < 30) {
                    const force = (30 - dist) / 30;
                    repelForceX += (dx / dist) * force * 5;
                    repelForceY += (dy / dist) * force * 5;
                }
            }

            const dx = targetX - enemy.x + repelForceX;
            const dy = targetY - enemy.y + repelForceY;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const moveSpeed = enemyType.speed * enemy.slowEffect * deltaTime * 0.03;

            if (distance < moveSpeed && repelForceX === 0 && repelForceY === 0) {
                enemy.x = nextPoint.x * GRID_SIZE + GRID_SIZE / 2;
                enemy.y = nextPoint.y * GRID_SIZE + GRID_SIZE / 2;
                enemy.pathIndex++;
                enemy.gridX = nextPoint.x;
                enemy.gridY = nextPoint.y;
            } else {
                if (distance > 0) {
                    enemy.x += (dx / distance) * moveSpeed;
                    enemy.y += (dy / distance) * moveSpeed;
                }
                enemy.gridX = Math.floor(enemy.x / GRID_SIZE);
                enemy.gridY = Math.floor(enemy.y / GRID_SIZE);
            }

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

            const fireRate = type.fireRate / (1 + (tower.speedLevel - 1) * 0.15);
            const adjustedFireRate = fireRate / this.gameSpeed;

            if (now - tower.lastFire < adjustedFireRate) return;

            const range = type.range * (1 + (tower.rangeLevel - 1) * 0.2);

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

            if (!this.enemies.includes(proj.target)) {
                this.projectiles.splice(i, 1);
                continue;
            }

            proj.targetX = proj.target.x;
            proj.targetY = proj.target.y;

            const dx = proj.targetX - proj.x;
            const dy = proj.targetY - proj.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            const moveDistance = proj.speed * deltaTime * 0.1;

            if (distance < moveDistance || distance < 5) {
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

        if (type.slowEffect) {
            proj.target.slowUntil = Date.now() + type.slowDuration;
        }

        proj.target.health -= proj.damage;
    }

    draw() {
        this.ctx.fillStyle = '#2d5016';
        this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);

        this.drawGrid();
        // this.drawDangerMap(); // ОТКЛЮЧЕНО: тормозит игру (50-75ms на кадр)
        this.drawEnemyPaths(); // ОТЛАДКА: визуализация путей врагов
        this.drawPortals(); // Рисуем порталы
        this.drawPath();
        this.drawTowers();
        this.drawEnemies();
        this.drawProjectiles();

        if (this.selectedTower) {
            this.drawTowerRange(this.selectedTower);
            this.drawUpgradeButtons();
        }

        // Отображение версии в левом нижнем углу
        this.drawVersion();
    }

    drawEnemyPaths() {
        // ОТЛАДКА: рисуем пути всех врагов
        this.enemies.forEach((enemy, index) => {
            if (!enemy.path) return;

            // Разные цвета для разных врагов
            const colors = ['rgba(255, 255, 0, 0.5)', 'rgba(0, 255, 255, 0.5)', 'rgba(255, 0, 255, 0.5)', 'rgba(255, 128, 0, 0.5)'];
            this.ctx.strokeStyle = colors[index % colors.length];
            this.ctx.lineWidth = 2;

            this.ctx.beginPath();
            for (let i = 0; i < enemy.path.length; i++) {
                const point = enemy.path[i];
                const x = point.x * GRID_SIZE + GRID_SIZE / 2;
                const y = point.y * GRID_SIZE + GRID_SIZE / 2;

                if (i === 0) {
                    this.ctx.moveTo(x, y);
                } else {
                    this.ctx.lineTo(x, y);
                }
            }
            this.ctx.stroke();

            // Рисуем точки на пути
            enemy.path.forEach((point, i) => {
                const x = point.x * GRID_SIZE + GRID_SIZE / 2;
                const y = point.y * GRID_SIZE + GRID_SIZE / 2;

                this.ctx.fillStyle = i === enemy.pathIndex ? 'lime' : 'yellow';
                this.ctx.beginPath();
                this.ctx.arc(x, y, 3, 0, Math.PI * 2);
                this.ctx.fill();
            });
        });
    }

    drawPortals() {
        this.portalAnimation += 0.05;

        this.portals.forEach((portal, index) => {
            if (!portal.active) return;

            const centerX = portal.x;
            const centerY = portal.y;

            // Анимированное свечение
            const pulse = Math.sin(this.portalAnimation + index) * 0.3 + 0.7; // 0.4 - 1.0

            // Внешнее кольцо
            const outerRadius = 25 * pulse;
            const gradient1 = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, outerRadius);
            gradient1.addColorStop(0, 'rgba(255, 0, 0, 0.8)');
            gradient1.addColorStop(0.5, 'rgba(200, 0, 0, 0.5)');
            gradient1.addColorStop(1, 'rgba(150, 0, 0, 0)');

            this.ctx.fillStyle = gradient1;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, outerRadius, 0, Math.PI * 2);
            this.ctx.fill();

            // Внутреннее ядро
            const coreRadius = 12;
            const gradient2 = this.ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, coreRadius);
            gradient2.addColorStop(0, 'rgba(255, 100, 100, 1)');
            gradient2.addColorStop(0.6, 'rgba(255, 0, 0, 0.9)');
            gradient2.addColorStop(1, 'rgba(150, 0, 0, 0.5)');

            this.ctx.fillStyle = gradient2;
            this.ctx.beginPath();
            this.ctx.arc(centerX, centerY, coreRadius, 0, Math.PI * 2);
            this.ctx.fill();

            // Вращающиеся частицы
            const particleCount = 8;
            for (let i = 0; i < particleCount; i++) {
                const angle = (this.portalAnimation * 2 + i * (Math.PI * 2 / particleCount));
                const distance = 18;
                const px = centerX + Math.cos(angle) * distance;
                const py = centerY + Math.sin(angle) * distance;

                this.ctx.fillStyle = 'rgba(255, 50, 50, 0.8)';
                this.ctx.beginPath();
                this.ctx.arc(px, py, 3, 0, Math.PI * 2);
                this.ctx.fill();
            }

            // Номер портала (если больше одного)
            if (this.portals.length > 1) {
                this.ctx.fillStyle = 'white';
                this.ctx.font = 'bold 16px Arial';
                this.ctx.textAlign = 'center';
                this.ctx.textBaseline = 'middle';
                this.ctx.fillText((index + 1).toString(), centerX, centerY);
            }
        });
    }

    drawVersion() {
        this.ctx.fillStyle = 'rgba(255, 255, 255, 0.7)';
        this.ctx.font = 'bold 14px monospace';
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'bottom';
        this.ctx.fillText(`v${GAME_VERSION}`, 10, this.canvas.height - 10);
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

    drawDangerMap() {
        // ОТЛАДКА: визуализация карты опасности
        if (this.towers.length === 0) return;

        const pathFinder = new PathFinder(GRID_COLS, GRID_ROWS, this.towers);
        const dangerMap = pathFinder.dangerMap;

        // Найдем максимальное значение опасности для нормализации
        let maxDanger = 0;
        Object.values(dangerMap).forEach(danger => {
            if (danger > maxDanger) maxDanger = danger;
        });

        if (maxDanger === 0) return;

        // Рисуем опасные клетки
        for (let y = 0; y < GRID_ROWS; y++) {
            for (let x = 0; x < GRID_COLS; x++) {
                const key = `${x},${y}`;
                const danger = dangerMap[key] || 0;

                if (danger > 0) {
                    // Нормализуем от 0 до 1
                    const normalized = Math.min(danger / maxDanger, 1);

                    // Красный цвет с прозрачностью
                    this.ctx.fillStyle = `rgba(255, 0, 0, ${normalized * 0.5})`;
                    this.ctx.fillRect(x * GRID_SIZE, y * GRID_SIZE, GRID_SIZE, GRID_SIZE);

                    // Показываем значение опасности на клетке
                    if (danger > maxDanger * 0.3) {
                        this.ctx.fillStyle = 'white';
                        this.ctx.font = '10px Arial';
                        this.ctx.fillText(Math.round(danger), x * GRID_SIZE + 2, y * GRID_SIZE + 12);
                    }
                }
            }
        }
    }

    drawPath() {
        // Рисуем только финиш (красная точка)
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

        // Рамка финиша
        this.ctx.strokeStyle = 'white';
        this.ctx.lineWidth = 2;
        this.ctx.stroke();
    }

    drawTowers() {
        this.towers.forEach(tower => {
            const type = TOWER_TYPES[tower.type];

            this.ctx.fillStyle = type.color;
            this.ctx.strokeStyle = this.selectedTower === tower ? '#FFD700' : '#333';
            this.ctx.lineWidth = this.selectedTower === tower ? 4 : 2;

            this.ctx.beginPath();
            this.ctx.arc(tower.x, tower.y, 15, 0, Math.PI * 2);
            this.ctx.fill();
            this.ctx.stroke();

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

            this.ctx.fillStyle = type.color;

            if (type.shape === 'triangle') {
                // Треугольник для разведчиков
                const size = type.size;
                this.ctx.beginPath();
                this.ctx.moveTo(enemy.x, enemy.y - size);
                this.ctx.lineTo(enemy.x - size, enemy.y + size);
                this.ctx.lineTo(enemy.x + size, enemy.y + size);
                this.ctx.closePath();
                this.ctx.fill();
            } else if (type.shape === 'square') {
                const size = type.size;
                this.ctx.fillRect(enemy.x - size/2, enemy.y - size/2, size, size);

                if (type.hasShield) {
                    this.ctx.strokeStyle = '#FFD700';
                    this.ctx.lineWidth = 3;
                    this.ctx.strokeRect(enemy.x - size/2 - 2, enemy.y - size/2 - 2, size + 4, size + 4);
                }
            } else {
                this.ctx.beginPath();
                this.ctx.arc(enemy.x, enemy.y, type.size, 0, Math.PI * 2);
                this.ctx.fill();
            }

            const healthBarWidth = 24;
            const healthBarHeight = 4;
            const healthPercent = enemy.health / enemy.maxHealth;

            this.ctx.fillStyle = '#333';
            this.ctx.fillRect(
                enemy.x - healthBarWidth / 2,
                enemy.y - type.size - 8,
                healthBarWidth,
                healthBarHeight
            );

            this.ctx.fillStyle = healthPercent > 0.5 ? '#4CAF50' : healthPercent > 0.25 ? '#FFC107' : '#F44336';
            this.ctx.fillRect(
                enemy.x - healthBarWidth / 2,
                enemy.y - type.size - 8,
                healthBarWidth * healthPercent,
                healthBarHeight
            );

            if (Date.now() < enemy.slowUntil) {
                this.ctx.strokeStyle = '#00BCD4';
                this.ctx.lineWidth = 2;
                this.ctx.beginPath();
                this.ctx.arc(enemy.x, enemy.y, type.size + 3, 0, Math.PI * 2);
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

    drawUpgradeButtons() {
        this.upgradeButtons.forEach(btn => {
            this.ctx.shadowColor = 'rgba(0, 0, 0, 0.3)';
            this.ctx.shadowBlur = 10;
            this.ctx.shadowOffsetX = 2;
            this.ctx.shadowOffsetY = 2;

            this.ctx.fillStyle = btn.color;
            this.ctx.beginPath();
            this.ctx.arc(btn.x, btn.y, btn.radius, 0, Math.PI * 2);
            this.ctx.fill();

            this.ctx.shadowColor = 'transparent';
            this.ctx.shadowBlur = 0;

            const canAfford = this.money >= btn.cost;
            this.ctx.strokeStyle = canAfford ? '#fff' : '#999';
            this.ctx.lineWidth = 3;
            this.ctx.stroke();

            this.ctx.font = '16px Arial';
            this.ctx.textAlign = 'center';
            this.ctx.textBaseline = 'middle';
            this.ctx.fillText(btn.icon, btn.x, btn.y - 2);

            this.ctx.fillStyle = 'white';
            this.ctx.font = 'bold 10px Arial';
            this.ctx.fillText(btn.level, btn.x + btn.radius - 6, btn.y - btn.radius + 6);

            this.ctx.fillStyle = canAfford ? '#4CAF50' : '#F44336';
            this.ctx.font = 'bold 11px Arial';
            this.ctx.fillText(btn.cost, btn.x, btn.y + btn.radius + 12);
        });
    }

    updateUI() {
        document.getElementById('money').textContent = this.money;
        document.getElementById('lives').textContent = this.lives;
        document.getElementById('wave').textContent = this.wave;
        document.getElementById('enemies').textContent = this.enemies.length;
        document.getElementById('score').textContent = this.score;

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

window.addEventListener('load', () => {
    new Game();
});
