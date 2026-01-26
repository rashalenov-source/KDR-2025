extends CanvasLayer

# Сигналы
signal tower_selected(tower_type)
signal start_wave_pressed()
signal sell_tower_pressed()

# Ссылки на UI элементы
onready var money_label = $TopBar/MoneyLabel
onready var lives_label = $TopBar/LivesLabel
onready var wave_label = $TopBar/WaveLabel
onready var score_label = $TopBar/ScoreLabel
onready var start_wave_button = $TopBar/StartWaveButton
onready var sell_button = $RightPanel/TowerButtons/SellButton
onready var version_label = $VersionLabel

# Кнопки башен
onready var basic_button = $RightPanel/TowerButtons/BasicTowerButton
onready var sniper_button = $RightPanel/TowerButtons/SniperTowerButton
onready var cannon_button = $RightPanel/TowerButtons/CannonTowerButton
onready var freeze_button = $RightPanel/TowerButtons/FreezeTowerButton

var tower_buttons = []

func _ready():
	# Собираем все кнопки башен
	tower_buttons = [basic_button, sniper_button, cannon_button, freeze_button]

	# Подключаем кнопки
	# warning-ignore:return_value_discarded
	basic_button.connect("pressed", self, "_on_tower_button_pressed", ["basic"])
	# warning-ignore:return_value_discarded
	sniper_button.connect("pressed", self, "_on_tower_button_pressed", ["sniper"])
	# warning-ignore:return_value_discarded
	cannon_button.connect("pressed", self, "_on_tower_button_pressed", ["cannon"])
	# warning-ignore:return_value_discarded
	freeze_button.connect("pressed", self, "_on_tower_button_pressed", ["freeze"])

	# warning-ignore:return_value_discarded
	start_wave_button.connect("pressed", self, "_on_start_wave_button_pressed")
	# warning-ignore:return_value_discarded
	sell_button.connect("pressed", self, "_on_sell_button_pressed")

	# Устанавливаем версию
	version_label.text = "v" + GameManager.GAME_VERSION

	update_ui()

func update_ui():
	money_label.text = "Money: $" + str(GameManager.money)
	lives_label.text = "Lives: " + str(GameManager.lives)
	wave_label.text = "Wave: " + str(GameManager.wave) + "/" + str(GameManager.waves.size())
	score_label.text = "Score: " + str(GameManager.score)

	# Обновляем доступность кнопок башен
	_update_tower_buttons()

	# Обновляем кнопку старта волны
	start_wave_button.disabled = GameManager.wave_in_progress or GameManager.wave >= GameManager.waves.size()

func _update_tower_buttons():
	basic_button.disabled = GameManager.money < GameManager.TOWER_TYPES["basic"].cost
	sniper_button.disabled = GameManager.money < GameManager.TOWER_TYPES["sniper"].cost
	cannon_button.disabled = GameManager.money < GameManager.TOWER_TYPES["cannon"].cost
	freeze_button.disabled = GameManager.money < GameManager.TOWER_TYPES["freeze"].cost

func update_sell_button(enabled: bool):
	sell_button.disabled = not enabled

func _on_tower_button_pressed(tower_type: String):
	emit_signal("tower_selected", tower_type)
	_highlight_button(tower_type)

func _highlight_button(tower_type: String):
	# Подсвечиваем выбранную кнопку
	for button in tower_buttons:
		if button.name == _get_button_name_for_type(tower_type):
			button.modulate = Color(1.2, 1.2, 1.0)
		else:
			button.modulate = Color(1, 1, 1)

func deselect_all_tower_buttons():
	for button in tower_buttons:
		button.modulate = Color(1, 1, 1)

func _get_button_name_for_type(tower_type: String) -> String:
	match tower_type:
		"basic":
			return "BasicTowerButton"
		"sniper":
			return "SniperTowerButton"
		"cannon":
			return "CannonTowerButton"
		"freeze":
			return "FreezeTowerButton"
	return ""

func _on_start_wave_button_pressed():
	emit_signal("start_wave_pressed")

func _on_sell_button_pressed():
	emit_signal("sell_tower_pressed")
