extends Node2D

# Ссылки на слои
onready var grid_layer = $GameBoard/GridLayer
onready var portals_layer = $GameBoard/PortalsLayer
onready var towers_layer = $GameBoard/TowersLayer
onready var enemies_layer = $GameBoard/EnemiesLayer
onready var projectiles_layer = $GameBoard/ProjectilesLayer

# Загруженные сцены
var portal_scene = preload("res://scenes/Portal.tscn")
var tower_scene = preload("res://scenes/Tower.tscn")
var enemy_scene = preload("res://scenes/Enemy.tscn")
var projectile_scene = preload("res://scenes/Projectile.tscn")

# Игровое состояние
var portals = []
var towers = []
var enemies = []
var projectiles = []

var selected_tower_type = null
var selected_tower = null
var pathfinder = null

var auto_wave_timer = 0.0
var path_recalc_timer = 0.0

func _ready():
	_draw_grid()
	_create_initial_portal()
	pathfinder = load("res://scripts/PathFinder.gd").new()
	pathfinder.initialize(GameManager.GRID_COLS, GameManager.GRID_ROWS, towers)

	# Подключение UI
	# warning-ignore:return_value_discarded
	$UI.connect("tower_selected", self, "_on_tower_type_selected")
	# warning-ignore:return_value_discarded
	$UI.connect("start_wave_pressed", self, "_on_start_wave_pressed")
	# warning-ignore:return_value_discarded
	$UI.connect("sell_tower_pressed", self, "_on_sell_tower_pressed")

	print("Main scene ready!")

func _draw_grid():
	# Рисуем сетку
	var grid_canvas = ColorRect.new()
	grid_canvas.name = "GridCanvas"
	grid_canvas.rect_size = Vector2(
		GameManager.GRID_COLS * GameManager.GRID_SIZE,
		GameManager.GRID_ROWS * GameManager.GRID_SIZE
	)
	grid_canvas.color = Color("#2d5016")  # Темно-зеленый фон
	grid_layer.add_child(grid_canvas)

	# Линии сетки
	for x in range(GameManager.GRID_COLS + 1):
		var line = Line2D.new()
		line.add_point(Vector2(x * GameManager.GRID_SIZE, 0))
		line.add_point(Vector2(x * GameManager.GRID_SIZE, GameManager.GRID_ROWS * GameManager.GRID_SIZE))
		line.default_color = Color(0.2, 0.4, 0.1, 0.3)
		line.width = 1
		grid_layer.add_child(line)

	for y in range(GameManager.GRID_ROWS + 1):
		var line = Line2D.new()
		line.add_point(Vector2(0, y * GameManager.GRID_SIZE))
		line.add_point(Vector2(GameManager.GRID_COLS * GameManager.GRID_SIZE, y * GameManager.GRID_SIZE))
		line.default_color = Color(0.2, 0.4, 0.1, 0.3)
		line.width = 1
		grid_layer.add_child(line)

func _create_initial_portal():
	# Создаем первый портал в левой части карты (колонки 0-6)
	var random_x = randi() % 7
	var random_y = randi() % GameManager.GRID_ROWS
	_spawn_portal(Vector2(random_x, random_y))

func _spawn_portal(grid_pos: Vector2):
	var portal = portal_scene.instance()
	portal.position = GameManager.grid_to_world(grid_pos)
	portal.grid_pos = grid_pos
	portals_layer.add_child(portal)
	portals.append(portal)
	print("Portal spawned at ", grid_pos)

func _process(delta):
	if GameManager.game_over:
		return

	# Пересчет путей врагов периодически
	path_recalc_timer += delta
	if path_recalc_timer >= GameManager.PATH_RECALC_INTERVAL:
		path_recalc_timer = 0.0
		_recalculate_enemy_paths()

	# Автоматический старт волны
	if not GameManager.wave_in_progress and GameManager.wave < GameManager.waves.size():
		auto_wave_timer += delta
		if auto_wave_timer >= GameManager.AUTO_WAVE_DELAY:
			_start_wave()

	# Проверка окончания волны
	if GameManager.wave_in_progress and enemies.size() == 0:
		_wave_completed()

func _input(event):
	if event is InputEventMouseButton and event.pressed and event.button_index == BUTTON_LEFT:
		var mouse_pos = get_global_mouse_position()
		var grid_pos = GameManager.world_to_grid(mouse_pos)

		# Если выбран тип башни - пытаемся разместить
		if selected_tower_type != null and GameManager.is_valid_grid(grid_pos):
			_place_tower(grid_pos)
		else:
			# Иначе пытаемся выбрать существующую башню
			_select_tower_at(grid_pos)

func _place_tower(grid_pos: Vector2):
	var tower_type = GameManager.TOWER_TYPES[selected_tower_type]

	# Проверки
	if GameManager.money < tower_type.cost:
		print("Not enough money!")
		return

	# Проверка на занятость клетки
	for tower in towers:
		if tower.grid_pos == grid_pos:
			print("Cell already occupied!")
			return

	# Нельзя строить на финише или портале
	if grid_pos == GameManager.END_POINT:
		print("Cannot build on the end point!")
		return

	for portal in portals:
		if portal.grid_pos == grid_pos:
			print("Cannot build on portal!")
			return

	# Проверка на блокировку пути
	if not _can_place_tower_at(grid_pos):
		print("Cannot block all paths!")
		return

	# Создаем башню
	var tower = tower_scene.instance()
	tower.position = GameManager.grid_to_world(grid_pos)
	tower.grid_pos = grid_pos
	tower.tower_type = selected_tower_type
	tower.initialize(selected_tower_type)
	towers_layer.add_child(tower)
	towers.append(tower)

	GameManager.money -= tower_type.cost
	$UI.update_ui()

	print("Tower placed at ", grid_pos)

	# Пересчет путей
	_rebuild_pathfinder()
	_recalculate_enemy_paths()

	selected_tower_type = null
	$UI.deselect_all_tower_buttons()

func _can_place_tower_at(grid_pos: Vector2) -> bool:
	# Временно добавляем башню для проверки
	var test_towers = towers.duplicate()
	var fake_tower = {
		"grid_pos": grid_pos,
		"tower_type": selected_tower_type,
		"damage_level": 1,
		"range_level": 1,
		"speed_level": 1
	}
	test_towers.append(fake_tower)

	var test_pathfinder = load("res://scripts/PathFinder.gd").new()
	test_pathfinder.initialize(GameManager.GRID_COLS, GameManager.GRID_ROWS, test_towers)

	# Проверяем путь от каждого портала до финиша
	for portal in portals:
		var path = test_pathfinder.find_path(portal.grid_pos, GameManager.END_POINT, false)
		if path.empty():
			return false

	return true

func _select_tower_at(grid_pos: Vector2):
	selected_tower = null
	for tower in towers:
		if tower.grid_pos == grid_pos:
			selected_tower = tower
			tower.set_selected(true)
			print("Tower selected at ", grid_pos)
		else:
			tower.set_selected(false)

	$UI.update_sell_button(selected_tower != null)

func _rebuild_pathfinder():
	pathfinder = load("res://scripts/PathFinder.gd").new()
	pathfinder.initialize(GameManager.GRID_COLS, GameManager.GRID_ROWS, towers)

func _recalculate_enemy_paths():
	for enemy in enemies:
		if is_instance_valid(enemy):
			enemy.recalculate_path(pathfinder)

func _start_wave():
	if GameManager.wave >= GameManager.waves.size():
		return

	GameManager.wave_in_progress = true
	GameManager.wave += 1
	auto_wave_timer = 0.0

	print("Starting wave ", GameManager.wave)

	# Открытие новых порталов
	_check_new_portals()

	# Спавн врагов
	_spawn_wave_enemies()

	$UI.update_ui()

func _check_new_portals():
	if GameManager.wave == 5 and portals.size() == 1:
		# Второй портал в средней части
		var x = randi() % 5 + 4  # 4-8
		var y = randi() % GameManager.GRID_ROWS
		_spawn_portal(Vector2(x, y))

	if GameManager.wave == 10 and portals.size() == 2:
		# Третий портал в дальней части
		var x = randi() % 6 + 8  # 8-13
		var y = randi() % GameManager.GRID_ROWS
		_spawn_portal(Vector2(x, y))

func _spawn_wave_enemies():
	var wave_data = GameManager.waves[GameManager.wave - 1]

	# Спавн разведчиков
	for i in range(wave_data.scout_count):
		yield(get_tree().create_timer(0.5 * i), "timeout")
		_spawn_enemy("scout", portals[i % portals.size()])

	# Спавн обычных врагов
	var enemy_index = 0
	for enemy_group in wave_data.enemies:
		for i in range(enemy_group.count):
			yield(get_tree().create_timer(0.3 * enemy_index), "timeout")
			_spawn_enemy(enemy_group.type, portals[enemy_index % portals.size()])
			enemy_index += 1

func _spawn_enemy(type: String, portal):
	var enemy = enemy_scene.instance()
	enemy.position = portal.position
	enemy.initialize(type, pathfinder)
	enemies_layer.add_child(enemy)
	enemies.append(enemy)

	# Подключаем сигналы
	# warning-ignore:return_value_discarded
	enemy.connect("reached_end", self, "_on_enemy_reached_end")
	# warning-ignore:return_value_discarded
	enemy.connect("died", self, "_on_enemy_died")

func _on_enemy_reached_end(enemy):
	GameManager.lives -= 1
	enemies.erase(enemy)
	enemy.queue_free()

	$UI.update_ui()

	if GameManager.lives <= 0:
		_game_over()

func _on_enemy_died(enemy, reward):
	GameManager.money += reward
	GameManager.score += reward * 10
	enemies.erase(enemy)

	$UI.update_ui()

func _wave_completed():
	GameManager.wave_in_progress = false
	auto_wave_timer = 0.0
	print("Wave ", GameManager.wave, " completed!")

	if GameManager.wave >= GameManager.waves.size():
		_game_won()

func _game_over():
	GameManager.game_over = true
	print("GAME OVER!")
	# TODO: показать экран game over

func _game_won():
	GameManager.game_over = true
	print("YOU WIN!")
	# TODO: показать экран победы

# Сигналы от UI
func _on_tower_type_selected(tower_type):
	selected_tower_type = tower_type
	selected_tower = null
	print("Tower type selected: ", tower_type)

func _on_start_wave_pressed():
	_start_wave()

func _on_sell_tower_pressed():
	if selected_tower == null:
		return

	var tower_type = GameManager.TOWER_TYPES[selected_tower.tower_type]
	var base_cost = tower_type.cost
	var upgrade_cost = tower_type.upgrade_base_cost

	var total_upgrade_levels = (selected_tower.damage_level - 1) + \
								(selected_tower.range_level - 1) + \
								(selected_tower.speed_level - 1)

	var total_upgrade_cost = 0
	for i in range(1, total_upgrade_levels + 1):
		total_upgrade_cost += upgrade_cost * i

	var refund = floor((base_cost + total_upgrade_cost) * 0.5)

	GameManager.money += refund
	towers.erase(selected_tower)
	selected_tower.queue_free()
	selected_tower = null

	_rebuild_pathfinder()
	_recalculate_enemy_paths()

	$UI.update_ui()
	$UI.update_sell_button(false)

	print("Tower sold for $", refund)
