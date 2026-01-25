extends Node2D

signal reached_end(enemy)
signal died(enemy, reward)

var enemy_type = "basic"
var current_health = 0
var max_health = 0
var speed = 0
var reward = 0
var is_scout = false
var has_shield = false

var path = []
var path_index = 0
var slow_effect = 1.0
var slow_timer = 0.0

onready var visual = $Visual
onready var health_fill = $HealthBar/HealthFill
onready var health_background = $HealthBar/Background

var enemy_data = {}
var pathfinder = null

func initialize(type: String, pf):
	enemy_type = type
	enemy_data = GameManager.ENEMY_TYPES[type]
	pathfinder = pf

	max_health = enemy_data.health
	current_health = max_health
	speed = enemy_data.speed
	reward = enemy_data.reward
	is_scout = enemy_data.get("is_scout", false)
	has_shield = enemy_data.get("has_shield", false)

	_update_visuals()
	_calculate_initial_path()

func _calculate_initial_path():
	if pathfinder == null:
		return

	var start_grid = GameManager.world_to_grid(position)
	path = pathfinder.find_path(start_grid, GameManager.END_POINT, is_scout)
	path_index = 0

func recalculate_path(pf):
	pathfinder = pf
	var current_grid = GameManager.world_to_grid(position)
	path = pathfinder.find_path(current_grid, GameManager.END_POINT, is_scout)
	path_index = 0

func _update_visuals():
	# Рисуем врага в зависимости от формы
	match enemy_data.shape:
		"circle":
			visual.polygon = _generate_circle(enemy_data.size, 16)
		"square":
			visual.polygon = _generate_square(enemy_data.size)
		"triangle":
			visual.polygon = _generate_triangle(enemy_data.size)

	visual.color = enemy_data.color

	# Обновляем HP бар
	_update_health_bar()

func _generate_circle(radius: float, segments: int) -> PoolVector2Array:
	var points = PoolVector2Array()
	var angle_step = 2.0 * PI / segments

	for i in range(segments):
		var angle = i * angle_step
		points.append(Vector2(cos(angle) * radius, sin(angle) * radius))

	return points

func _generate_square(size: float) -> PoolVector2Array:
	var half = size / 2.0
	return PoolVector2Array([
		Vector2(-half, -half),
		Vector2(half, -half),
		Vector2(half, half),
		Vector2(-half, half)
	])

func _generate_triangle(size: float) -> PoolVector2Array:
	var height = size * 0.866  # sqrt(3)/2
	return PoolVector2Array([
		Vector2(0, -height),
		Vector2(size / 2.0, height / 2.0),
		Vector2(-size / 2.0, height / 2.0)
	])

func _update_health_bar():
	var health_percent = current_health / max_health

	# Цвет в зависимости от HP
	if health_percent > 0.5:
		health_fill.color = Color(0, 1, 0)  # Зеленый
	elif health_percent > 0.25:
		health_fill.color = Color(1, 1, 0)  # Желтый
	else:
		health_fill.color = Color(1, 0, 0)  # Красный

	# Обновляем ширину HP бара
	health_fill.rect_size.x = 24 * health_percent
	health_fill.margin_right = -12 + 24 * health_percent

func _process(delta):
	if GameManager.game_over:
		return

	# Обновляем замедление
	if slow_timer > 0:
		slow_timer -= delta
		if slow_timer <= 0:
			slow_effect = 1.0

	# Движение по пути
	if path.empty() or path_index >= path.size():
		# Достигли конца пути
		emit_signal("reached_end", self)
		return

	var target_grid = path[path_index]
	var target_pos = GameManager.grid_to_world(target_grid)
	var direction = (target_pos - position).normalized()
	var move_distance = speed * slow_effect * delta * GameManager.game_speed

	# Отталкивание от башен
	_apply_tower_repulsion(delta)

	# Движение к цели
	if position.distance_to(target_pos) <= move_distance:
		position = target_pos
		path_index += 1

		# Проверка достижения конца
		if path_index >= path.size():
			emit_signal("reached_end", self)
	else:
		position += direction * move_distance

func _apply_tower_repulsion(delta):
	# Отталкивание от башен, как в JS версии
	var towers_layer = get_parent().get_parent().get_node("TowersLayer")

	for tower in towers_layer.get_children():
		if is_instance_valid(tower):
			var distance = position.distance_to(tower.position)
			if distance < 30:
				var force = (30 - distance) / 30.0
				var repel_direction = (position - tower.position).normalized()
				position += repel_direction * force * 5.0 * delta * 60.0  # 60 FPS нормализация

func take_damage(damage: float, is_sniper: bool = false):
	# Снайперы имеют штраф против бронированных целей
	if is_sniper and has_shield:
		damage *= 0.4

	current_health -= damage

	if current_health <= 0:
		current_health = 0
		_die()
	else:
		_update_health_bar()

func apply_slow(effect: float, duration: float):
	slow_effect = effect
	slow_timer = duration

func _die():
	emit_signal("died", self, reward)
	queue_free()
