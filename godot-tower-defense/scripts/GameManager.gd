extends Node

# Игровая версия
const GAME_VERSION = "1.0-GODOT"

# Константы сетки
const GRID_SIZE = 40
const GRID_COLS = 20
const GRID_ROWS = 15

# Таймеры
const AUTO_WAVE_DELAY = 7.0  # секунды
const PATH_RECALC_INTERVAL = 0.1  # секунды

# Конечная точка (финиш)
const END_POINT = Vector2(19, 7)

# Типы башен
const TOWER_TYPES = {
	"basic": {
		"name": "Базовая",
		"cost": 50,
		"damage": 10,
		"range": 120,
		"fire_rate": 1.0,  # секунды
		"color": Color("#4CAF50"),
		"projectile_speed": 200,  # пиксели/сек
		"upgrade_base_cost": 20
	},
	"sniper": {
		"name": "Снайпер",
		"cost": 100,
		"damage": 50,
		"range": 140,
		"fire_rate": 2.0,
		"color": Color("#2196F3"),
		"projectile_speed": 320,
		"upgrade_base_cost": 40
	},
	"cannon": {
		"name": "Пушка",
		"cost": 150,
		"damage": 30,
		"range": 100,
		"fire_rate": 1.5,
		"color": Color("#FF5722"),
		"projectile_speed": 160,
		"splash_radius": 40,
		"upgrade_base_cost": 60
	},
	"freeze": {
		"name": "Заморозка",
		"cost": 120,
		"damage": 5,
		"range": 150,
		"fire_rate": 0.8,
		"color": Color("#00BCD4"),
		"projectile_speed": 240,
		"slow_effect": 0.5,  # замедление на 50%
		"slow_duration": 2.0,  # секунды
		"upgrade_base_cost": 50
	}
}

# Типы врагов
const ENEMY_TYPES = {
	"basic": {
		"name": "Базовый",
		"health": 50,
		"speed": 48,  # пикселей/сек (1.2 * 40)
		"reward": 10,
		"color": Color("#E91E63"),
		"shape": "circle",
		"size": 12
	},
	"fast": {
		"name": "Быстрый",
		"health": 30,
		"speed": 100,  # 2.5 * 40
		"reward": 15,
		"color": Color("#9C27B0"),
		"shape": "circle",
		"size": 10
	},
	"tank": {
		"name": "Танк",
		"health": 200,
		"speed": 24,  # 0.6 * 40
		"reward": 30,
		"color": Color("#795548"),
		"shape": "square",
		"size": 16,
		"has_shield": true
	},
	"boss": {
		"name": "Босс",
		"health": 500,
		"speed": 16,  # 0.4 * 40
		"reward": 100,
		"color": Color("#F44336"),
		"shape": "square",
		"size": 20,
		"has_shield": true
	},
	"scout": {
		"name": "Разведчик",
		"health": 20,
		"speed": 120,  # 3.0 * 40
		"reward": 8,
		"color": Color("#00E676"),
		"shape": "triangle",
		"size": 10,
		"is_scout": true
	}
}

# Игровое состояние
var money = 200
var lives = 20
var wave = 0
var score = 0
var game_speed = 1
var game_over = false
var wave_in_progress = false

# Волны врагов (генерируются при запуске)
var waves = []

func _ready():
	_generate_waves()
	print("GameManager loaded. Version: ", GAME_VERSION)

# Генерация 15 волн
func _generate_waves():
	for i in range(15):
		var enemy_count = 7 + i * 3
		var wave_data = {"enemies": [], "scout_count": 4}

		if i == 0:
			wave_data.enemies.append({"type": "basic", "count": enemy_count})
		elif i < 3:
			wave_data.enemies.append({"type": "basic", "count": floor(enemy_count * 0.7)})
			wave_data.enemies.append({"type": "fast", "count": floor(enemy_count * 0.3)})
		elif i < 6:
			wave_data.enemies.append({"type": "basic", "count": floor(enemy_count * 0.5)})
			wave_data.enemies.append({"type": "fast", "count": floor(enemy_count * 0.3)})
			wave_data.enemies.append({"type": "tank", "count": floor(enemy_count * 0.2)})
		elif i < 10:
			wave_data.enemies.append({"type": "basic", "count": floor(enemy_count * 0.4)})
			wave_data.enemies.append({"type": "fast", "count": floor(enemy_count * 0.3)})
			wave_data.enemies.append({"type": "tank", "count": floor(enemy_count * 0.3)})
		else:
			wave_data.enemies.append({"type": "basic", "count": floor(enemy_count * 0.3)})
			wave_data.enemies.append({"type": "fast", "count": floor(enemy_count * 0.3)})
			wave_data.enemies.append({"type": "tank", "count": floor(enemy_count * 0.3)})
			wave_data.enemies.append({"type": "boss", "count": max(1, floor(enemy_count * 0.1))})

		waves.append(wave_data)

	print("Generated ", waves.size(), " waves")

# Утилита: конвертировать grid координаты в world координаты
func grid_to_world(grid_pos: Vector2) -> Vector2:
	return Vector2(
		grid_pos.x * GRID_SIZE + GRID_SIZE / 2.0,
		grid_pos.y * GRID_SIZE + GRID_SIZE / 2.0
	)

# Утилита: конвертировать world координаты в grid координаты
func world_to_grid(world_pos: Vector2) -> Vector2:
	return Vector2(
		floor(world_pos.x / GRID_SIZE),
		floor(world_pos.y / GRID_SIZE)
	)

# Проверка валидности grid координат
func is_valid_grid(grid_pos: Vector2) -> bool:
	return grid_pos.x >= 0 and grid_pos.x < GRID_COLS and grid_pos.y >= 0 and grid_pos.y < GRID_ROWS

# Сброс игры
func reset_game():
	money = 200
	lives = 20
	wave = 0
	score = 0
	game_speed = 1
	game_over = false
	wave_in_progress = false
