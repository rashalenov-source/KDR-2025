extends Node2D

var grid_pos = Vector2.ZERO
var tower_type = "basic"
var damage_level = 1
var range_level = 1
var speed_level = 1

var last_fire_time = 0.0
var is_selected = false

onready var visual = $Visual
onready var range_circle = $RangeCircle
onready var selection_ring = $SelectionRing

var tower_data = {}

func initialize(type: String):
	tower_type = type
	tower_data = GameManager.TOWER_TYPES[type]
	_update_visuals()

func _ready():
	if not tower_data.empty():
		_update_visuals()

func _update_visuals():
	# Рисуем башню как круг
	var radius = 15.0
	visual.polygon = _generate_circle(radius, 16)
	visual.color = tower_data.color

	# Круг дальности (показываем только когда выбрана)
	var range_value = _get_current_range()
	range_circle.points = _generate_circle_line(range_value, 64)
	range_circle.visible = is_selected

	# Кольцо выделения
	selection_ring.points = _generate_circle_line(radius + 5, 16)
	selection_ring.visible = is_selected

func _generate_circle(radius: float, segments: int) -> PoolVector2Array:
	var points = PoolVector2Array()
	var angle_step = 2.0 * PI / segments

	for i in range(segments):
		var angle = i * angle_step
		points.append(Vector2(cos(angle) * radius, sin(angle) * radius))

	return points

func _generate_circle_line(radius: float, segments: int) -> PoolVector2Array:
	var points = PoolVector2Array()
	var angle_step = 2.0 * PI / segments

	for i in range(segments + 1):  # +1 для замыкания круга
		var angle = i * angle_step
		points.append(Vector2(cos(angle) * radius, sin(angle) * radius))

	return points

func _process(_delta):
	if GameManager.game_over:
		return

	# Атака врагов
	var current_time = OS.get_ticks_msec() / 1000.0
	var fire_rate = _get_current_fire_rate()

	if current_time - last_fire_time >= fire_rate / GameManager.game_speed:
		_try_fire()
		last_fire_time = current_time

func _try_fire():
	var target = _find_target()
	if target == null:
		return

	# Создаем снаряд
	var projectile_scene = load("res://scenes/Projectile.tscn")
	var projectile = projectile_scene.instance()
	projectile.position = position
	projectile.initialize(tower_type, target, _get_current_damage(), self)

	# Добавляем снаряд в слой снарядов
	get_parent().get_parent().get_node("ProjectilesLayer").add_child(projectile)

func _find_target():
	# Находим ближайшего врага в радиусе
	var enemies_layer = get_parent().get_parent().get_node("EnemiesLayer")
	var range_value = _get_current_range()
	var closest_enemy = null
	var closest_distance = range_value + 1

	for enemy in enemies_layer.get_children():
		if is_instance_valid(enemy):
			var distance = position.distance_to(enemy.position)
			if distance <= range_value and distance < closest_distance:
				closest_enemy = enemy
				closest_distance = distance

	return closest_enemy

func _get_current_damage() -> float:
	return tower_data.damage * (1.0 + (damage_level - 1) * 0.3)

func _get_current_range() -> float:
	return tower_data.range * (1.0 + (range_level - 1) * 0.2)

func _get_current_fire_rate() -> float:
	return tower_data.fire_rate / (1.0 + (speed_level - 1) * 0.15)

func set_selected(selected: bool):
	is_selected = selected
	_update_visuals()

func get_total_cost() -> int:
	var base_cost = tower_data.cost
	var upgrade_cost = tower_data.upgrade_base_cost

	var total_upgrade_levels = (damage_level - 1) + (range_level - 1) + (speed_level - 1)
	var total_upgrade_cost = 0

	for i in range(1, total_upgrade_levels + 1):
		total_upgrade_cost += upgrade_cost * i

	return base_cost + total_upgrade_cost
