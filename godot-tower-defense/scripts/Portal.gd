extends Node2D

var grid_pos = Vector2.ZERO
var pulse_time = 0.0
var pulse_speed = 2.0

onready var outer_ring = $OuterRing
onready var core = $Core
onready var particles_node = $Particles
onready var animation_timer = $AnimationTimer

var particle_circles = []

func _ready():
	animation_timer.connect("timeout", self, "_on_animation_tick")
	_create_particle_circles()

func _create_particle_circles():
	# Создаем 8 вращающихся частиц
	for i in range(8):
		var particle = Polygon2D.new()
		var circle_points = _generate_circle(3, 8)  # радиус 3, 8 сегментов
		particle.polygon = circle_points
		particle.color = Color(0.5, 0.3, 1.0, 0.8)  # Фиолетовый
		particles_node.add_child(particle)
		particle_circles.append(particle)

func _on_animation_tick():
	pulse_time += animation_timer.wait_time
	_update_portal_visuals()

func _update_portal_visuals():
	# Пульсация от 0.4 до 1.0
	var pulse = 0.4 + 0.6 * (sin(pulse_time * pulse_speed * PI) * 0.5 + 0.5)

	# Обновляем внешнее кольцо
	var outer_radius = 25.0 * pulse
	outer_ring.polygon = _generate_circle(outer_radius, 32)
	outer_ring.color = Color(0.5, 0.3, 1.0, 0.3 * pulse)

	# Обновляем ядро
	core.polygon = _generate_circle(12, 16)
	core.color = Color(0.8, 0.5, 1.0, 0.8)

	# Обновляем частицы (вращение)
	var angle_step = 2.0 * PI / particle_circles.size()
	for i in range(particle_circles.size()):
		var angle = pulse_time + i * angle_step
		var distance = 18.0
		var x = cos(angle) * distance
		var y = sin(angle) * distance
		particle_circles[i].position = Vector2(x, y)

func _generate_circle(radius: float, segments: int) -> PoolVector2Array:
	var points = PoolVector2Array()
	var angle_step = 2.0 * PI / segments

	for i in range(segments):
		var angle = i * angle_step
		var x = cos(angle) * radius
		var y = sin(angle) * radius
		points.append(Vector2(x, y))

	return points
