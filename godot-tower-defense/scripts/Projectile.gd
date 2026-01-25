extends Node2D

var tower_type = "basic"
var target = null
var damage = 0
var speed = 0
var tower_ref = null

onready var visual = $Visual

var tower_data = {}

func initialize(type: String, target_enemy, dmg: float, tower):
	tower_type = type
	target = target_enemy
	damage = dmg
	tower_ref = tower
	tower_data = GameManager.TOWER_TYPES[type]
	speed = tower_data.projectile_speed

	_update_visuals()

func _update_visuals():
	# Рисуем снаряд как маленький круг
	visual.polygon = _generate_circle(4, 8)
	visual.color = tower_data.color

func _generate_circle(radius: float, segments: int) -> PoolVector2Array:
	var points = PoolVector2Array()
	var angle_step = 2.0 * PI / segments

	for i in range(segments):
		var angle = i * angle_step
		points.append(Vector2(cos(angle) * radius, sin(angle) * radius))

	return points

func _process(delta):
	if not is_instance_valid(target):
		queue_free()
		return

	# Движение к цели
	var direction = (target.position - position).normalized()
	var move_distance = speed * delta * GameManager.game_speed

	position += direction * move_distance

	# Проверка попадания
	if position.distance_to(target.position) <= 8:
		_hit_target()

func _hit_target():
	if not is_instance_valid(target):
		queue_free()
		return

	# Применяем урон
	match tower_type:
		"basic":
			target.take_damage(damage)
		"sniper":
			target.take_damage(damage, true)  # Снайпер имеет штраф против брони
		"cannon":
			_apply_splash_damage()
		"freeze":
			target.take_damage(damage)
			target.apply_slow(tower_data.slow_effect, tower_data.slow_duration)

	queue_free()

func _apply_splash_damage():
	# Сплэш урон для пушки
	var splash_radius = tower_data.splash_radius
	var splash_damage = damage * 0.7

	var enemies_layer = get_parent().get_parent().get_node("EnemiesLayer")

	for enemy in enemies_layer.get_children():
		if is_instance_valid(enemy):
			var distance = position.distance_to(enemy.position)
			if distance <= splash_radius:
				if enemy == target:
					enemy.take_damage(damage)  # Основной урон по цели
				else:
					enemy.take_damage(splash_damage)  # Сплэш по остальным
