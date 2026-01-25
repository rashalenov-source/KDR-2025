# A* Pathfinding с картой опасности
# Портировано из JS версии tower defense

extends Reference

var grid_cols = 0
var grid_rows = 0
var towers = []
var danger_map = {}

func initialize(cols: int, rows: int, tower_list: Array):
	grid_cols = cols
	grid_rows = rows
	towers = tower_list
	danger_map = _build_danger_map()

func _build_danger_map() -> Dictionary:
	var map = {}

	for tower in towers:
		if not is_instance_valid(tower):
			continue

		var tower_type_key = tower.tower_type if tower has "tower_type" else tower.get("tower_type", "basic")
		var tower_data = GameManager.TOWER_TYPES[tower_type_key]

		# Получаем уровни улучшений
		var damage_level = tower.damage_level if tower has "damage_level" else tower.get("damage_level", 1)
		var range_level = tower.range_level if tower has "range_level" else tower.get("range_level", 1)
		var speed_level = tower.speed_level if tower has "speed_level" else tower.get("speed_level", 1)

		var range_value = tower_data.range * (1.0 + (range_level - 1) * 0.2)
		var damage = tower_data.damage * (1.0 + (damage_level - 1) * 0.3)
		var fire_rate = tower_data.fire_rate / (1.0 + (speed_level - 1) * 0.15)

		# DPS башни
		var dps = damage / fire_rate

		# Используем ТОЛЬКО реальный радиус атаки
		var range_in_cells = ceil(range_value / GameManager.GRID_SIZE)
		var effective_range = range_value

		var tower_grid_pos = tower.grid_pos if tower has "grid_pos" else tower.get("grid_pos", Vector2.ZERO)

		for dx in range(-range_in_cells, range_in_cells + 1):
			for dy in range(-range_in_cells, range_in_cells + 1):
				var x = int(tower_grid_pos.x) + dx
				var y = int(tower_grid_pos.y) + dy

				if x >= 0 and x < grid_cols and y >= 0 and y < grid_rows:
					var dist = sqrt(dx * dx + dy * dy) * GameManager.GRID_SIZE

					if dist <= effective_range:
						var key = "%d,%d" % [x, y]

						# Нормализованное расстояние (0 = в центре, 1 = на краю)
						var normalized_dist = dist / effective_range

						# ЭКСТРЕМАЛЬНАЯ опасность: степень 5 для резкого роста
						var distance_factor = pow(1.0 - normalized_dist, 5.0)

						# Базовая опасность зависит от DPS (x2000000 как в JS версии)
						var base_danger = dps * 2000000.0

						# Итоговая опасность
						var danger_from_tower = distance_factor * base_danger

						if not map.has(key):
							map[key] = 0.0
						map[key] += danger_from_tower

	# Отладка
	var danger_count = map.keys().size()
	var max_danger = 0.0
	for value in map.values():
		if value > max_danger:
			max_danger = value

	print("🗺️ DangerMap: ", danger_count, " опасных клеток, макс. опасность=", int(max_danger))

	return map

func find_path(start: Vector2, end: Vector2, is_scout: bool = false) -> Array:
	# Разведчики идут случайным путем
	if is_scout:
		return _find_random_path(start, end)

	# Обычный A* с учетом опасности
	return _find_path_with_danger(start, end)

func _find_random_path(start: Vector2, end: Vector2) -> Array:
	# Простой случайный путь с bias к цели (75% к цели, 25% случайно)
	var path = [start]
	var current = start

	while current != end:
		var neighbors = _get_neighbors(current)
		if neighbors.empty():
			break

		# 75% шанс идти к цели, 25% случайно
		if randf() < 0.75:
			# Идем к цели
			var best_neighbor = neighbors[0]
			var best_dist = _heuristic(neighbors[0], end)

			for neighbor in neighbors:
				var dist = _heuristic(neighbor, end)
				if dist < best_dist:
					best_dist = dist
					best_neighbor = neighbor

			current = best_neighbor
		else:
			# Случайный сосед
			current = neighbors[randi() % neighbors.size()]

		path.append(current)

		# Защита от бесконечного цикла
		if path.size() > grid_cols * grid_rows:
			break

	return path

func _find_path_with_danger(start: Vector2, end: Vector2) -> Array:
	var open_set = [start]
	var closed_set = {}
	var came_from = {}
	var g_score = {}
	var f_score = {}

	var start_key = _vec_to_key(start)
	var end_key = _vec_to_key(end)

	g_score[start_key] = 0.0
	f_score[start_key] = _heuristic(start, end)

	var iterations = 0

	while not open_set.empty():
		iterations += 1

		# Находим узел с минимальным f_score
		var current = open_set[0]
		var current_key = _vec_to_key(current)
		var min_f = f_score.get(current_key, INF)

		for node in open_set:
			var node_key = _vec_to_key(node)
			var node_f = f_score.get(node_key, INF)
			if node_f < min_f:
				min_f = node_f
				current = node
				current_key = node_key

		# Достигли цели
		if current_key == end_key:
			var path = _reconstruct_path(came_from, current)
			print("📊 Путь: длина=", path.size(), ", итераций=", iterations)
			return path

		# Убираем из open_set и добавляем в closed_set
		open_set.erase(current)
		closed_set[current_key] = true

		# Проверяем соседей
		for neighbor in _get_neighbors(current):
			var neighbor_key = _vec_to_key(neighbor)

			if closed_set.has(neighbor_key):
				continue

			# Стоимость перехода
			var base_cost = 1.0

			# ОГРОМНЫЙ штраф за опасные клетки (x50000 как в JS версии)
			var danger = danger_map.get(neighbor_key, 0.0)
			var danger_penalty = danger * 50000.0

			var tentative_g = g_score.get(current_key, INF) + base_cost + danger_penalty

			if not neighbor_key in g_score or tentative_g < g_score[neighbor_key]:
				came_from[neighbor_key] = current
				g_score[neighbor_key] = tentative_g
				f_score[neighbor_key] = tentative_g + _heuristic(neighbor, end) * 0.00001  # Эвристика почти не влияет

				if not neighbor in open_set:
					open_set.append(neighbor)

	# Путь не найден
	print("❌ Путь не найден!")
	return []

func _get_neighbors(pos: Vector2) -> Array:
	var neighbors = []
	var directions = [
		Vector2(0, -1),  # вверх
		Vector2(1, 0),   # вправо
		Vector2(0, 1),   # вниз
		Vector2(-1, 0),  # влево
	]

	for dir in directions:
		var neighbor = pos + dir
		if neighbor.x >= 0 and neighbor.x < grid_cols and neighbor.y >= 0 and neighbor.y < grid_rows:
			neighbors.append(neighbor)

	return neighbors

func _heuristic(a: Vector2, b: Vector2) -> float:
	# Манхэттенское расстояние
	return abs(a.x - b.x) + abs(a.y - b.y)

func _reconstruct_path(came_from: Dictionary, current: Vector2) -> Array:
	var path = [current]
	var current_key = _vec_to_key(current)

	while came_from.has(current_key):
		current = came_from[current_key]
		current_key = _vec_to_key(current)
		path.push_front(current)

	return path

func _vec_to_key(vec: Vector2) -> String:
	return "%d,%d" % [int(vec.x), int(vec.y)]
