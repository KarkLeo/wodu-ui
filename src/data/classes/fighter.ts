import type { ClassData, Move } from '@/types/character'

export const signatureWeaponOptions = {
  bases: [
    { id: 'sword',  name: 'Меч' },
    { id: 'axe',    name: 'Топор' },
    { id: 'hammer', name: 'Молот' },
    { id: 'spear',  name: 'Копьё' },
    { id: 'flail',  name: 'Цеп' },
    { id: 'fists',  name: 'Кулаки' },
  ],
  ranges: [
    { id: 'hand',        name: 'Рука' },
    { id: 'sword_reach', name: 'Взмах меча' },
    { id: 'spear_reach', name: 'Удар копья' },
  ],
  enhancements: [
    { id: 'hooks',      name: 'Крюки и шипы',              desc: 'Бонус +1 к урону, однако вес увеличивается на 1.' },
    { id: 'sharp',      name: 'Острое',                     desc: 'Пробивание +2.' },
    { id: 'balanced',   name: 'Идеально сбалансированное',  desc: 'Добавьте свойство точное.' },
    { id: 'serrated',   name: 'Зазубренное лезвие',         desc: '+1 к урону.' },
    { id: 'glowing',    name: 'Светится',                   desc: 'когда рядом существа определённого типа (ваш выбор).' },
    { id: 'huge',       name: 'Огромные размеры',           desc: 'Добавьте свойства мощное и месиво.' },
    { id: 'versatile',  name: 'Универсальное',              desc: 'Выберите вторую длину.' },
    { id: 'masterwork', name: 'Мастерская работа',          desc: 'Вес -1.' },
  ],
  appearances: [
    { id: 'ancient',      name: 'Древнее' },
    { id: 'pristine',     name: 'Безупречное' },
    { id: 'ornate',       name: 'Богато украшенное' },
    { id: 'bloodstained', name: 'Закалённое в крови' },
    { id: 'grim',         name: 'Мрачное' },
  ],
}

const moves: Move[] = [
  // ── Стартовые ──────────────────────────────────────────
  {
    id: 'fighter_bend_bars',
    classId: 'fighter',
    name: 'Гнуть прутья, ломать двери',
    trigger: 'Когда вы посредством грубой силы пытаетесь разрушить какое-либо неодушевлённое препятствие, бросьте+СИЛ.',
    hit10: 'Выберите три варианта из списка.',
    hit7: 'Выберите два.',
    options: [
      'Всё удалось сделать быстро.',
      'Ничего ценного из этого не повреждено.',
      'Вы сделали это без лишнего шума.',
      'Вы без особых усилий сможете починить, что сломали.',
    ],
    type: 'starting',
  },
  {
    id: 'fighter_armored',
    classId: 'fighter',
    name: 'Привычный к доспехам',
    description: 'Вы игнорируете свойство неуклюжий, которое накладывает броня.',
    type: 'starting',
  },
  {
    id: 'fighter_signature_weapon',
    classId: 'fighter',
    name: 'Знаковое оружие',
    description:
      'Это ваше оружие. На свете много подобных ему, однако это — ваше. Оно — ваш лучший друг. Ваша жизнь. Вы — его хозяин, а оно — хозяин вашей жизни. Без вас ваше оружие бесполезно, равно как и вы без него. Носите его с честью.',
    type: 'starting',
  },
  // ── Расовые (входят в стартовые) ───────────────────────
  {
    id: 'fighter_race_dwarf',
    classId: 'fighter',
    name: 'Гном',
    description: 'Договариваясь с собутыльником, вы можете использовать ТЕЛ, а не ХАР.',
    type: 'starting',
  },
  {
    id: 'fighter_race_elf',
    classId: 'fighter',
    name: 'Эльф',
    description: 'Выберите один вид оружия: в ваших руках оно всегда точное.',
    type: 'starting',
  },
  {
    id: 'fighter_race_halfling',
    classId: 'fighter',
    name: 'Полурослик',
    description: 'Если вы спасаетесь от угрозы, используя свой маленький рост как преимущество, вы получаете бонус +1.',
    type: 'starting',
  },
  {
    id: 'fighter_race_human',
    classId: 'fighter',
    name: 'Человек',
    description: 'Один раз за битву вы можете перебросить один бросок урона (как ваш собственный, так и чужой).',
    type: 'starting',
  },
  // ── Продвинутые 2–5 ─────────────────────────────────────
  {
    id: 'fighter_merciless',
    classId: 'fighter',
    name: 'Безжалостный',
    description: 'Вы получаете бонус +1к4 к наносимому урону.',
    type: 'advanced_2_5',
  },
  {
    id: 'fighter_heritage',
    classId: 'fighter',
    name: 'Наследие',
    trigger: 'Когда вы слушаете духов, обитающих в вашем знаковом оружии, они посылают вам озарение о текущей ситуации. В свою очередь, они могут задать вам несколько вопросов. Бросьте+ХАР.',
    hit10: 'Ведущий опишет ясное видение.',
    hit7: 'Видение будет неточным и запутанным.',
    type: 'advanced_2_5',
    requiresId: 'fighter_signature_weapon',
  },
  {
    id: 'fighter_armor_mastery',
    classId: 'fighter',
    name: 'Мастер защиты',
    description:
      'Когда вы принимаете основной удар на доспех либо щит, вы не получаете урона, однако должны уменьшить величину брони вашего доспеха (или щита) на 1 каждый раз, когда совершаете этот манёвр. Если броня предмета опускается до 0, то предмет уничтожен.',
    type: 'advanced_2_5',
  },
  {
    id: 'fighter_improved_weapon',
    classId: 'fighter',
    name: 'Лучшее оружие',
    description: 'Наделите знаковое оружие ещё одним свойством.',
    type: 'advanced_2_5',
    requiresId: 'fighter_signature_weapon',
  },
  {
    id: 'fighter_seeing_red',
    classId: 'fighter',
    name: 'Взгляд убийцы',
    description: 'Изучая обстановку во время битвы, вы получаете +1 к броску этого хода.',
    type: 'advanced_2_5',
  },
  {
    id: 'fighter_interrogator',
    classId: 'fighter',
    name: 'Допрос',
    description:
      'Когда вы договариваетесь, используя в качестве рычага воздействия угрозу физического насилия, вы можете использовать СИЛ, а не ХАР.',
    type: 'advanced_2_5',
  },
  {
    id: 'fighter_scent_of_blood',
    classId: 'fighter',
    name: 'Запах крови',
    description: 'Если вы рубите и кромсаете, ваша следующая атака по той же цели наносит +1к4 урона.',
    type: 'advanced_2_5',
  },
  {
    id: 'fighter_multiclass_dabbler',
    classId: 'fighter',
    name: 'Мультикласс: дилетант',
    description: 'Возьмите один ход другого класса, но будто ваш уровень ниже на 1.',
    type: 'advanced_2_5',
  },
  {
    id: 'fighter_iron_hide',
    classId: 'fighter',
    name: 'Железная шкура',
    description: 'Вы получаете +1 к броне.',
    type: 'advanced_2_5',
  },
  {
    id: 'fighter_smith',
    classId: 'fighter',
    name: 'Кузнец',
    description:
      'Когда у вас есть доступ к кузнице, вы можете наделить ваше знаковое оружие волшебными свойствами другого оружия. Последнее при этом будет уничтожено.',
    type: 'advanced_2_5',
    requiresId: 'fighter_signature_weapon',
  },
  // ── Продвинутые 6–10 ────────────────────────────────────
  {
    id: 'fighter_bloodthirsty',
    classId: 'fighter',
    name: 'Кровожадный',
    description: 'Вы получаете бонус +1к8 к наносимому урону.',
    type: 'advanced_6_10',
    requiresId: 'fighter_merciless',
    replacesId: 'fighter_merciless',
  },
  {
    id: 'fighter_perfect_defense',
    classId: 'fighter',
    name: 'Идеальная защита',
    description:
      'Когда вы принимаете основной удар на доспех или щит, вы не получаете урона и делаете следующий ход против атаковавшего с +1, но должны снизить броню доспеха (или щита) на 1 каждый раз, когда делаете этот ход. Если броня предмета опускается до 0, предмет уничтожен.',
    type: 'advanced_6_10',
    requiresId: 'fighter_armor_mastery',
    replacesId: 'fighter_armor_mastery',
  },
  {
    id: 'fighter_evil_eye',
    classId: 'fighter',
    name: 'Дурной глаз',
    trigger: 'Когда вы начинаете битву, бросьте+ХАР.',
    hit10: 'Вы получаете запас 2.',
    hit7: 'Запас 1.',
    miss: 'Ведущий считает вас главной угрозой.',
    note: 'Если вы посмотрите в глаза персонажа ведущего, находящегося рядом, и потратите запас, он застынет на месте или отступит; он не сможет совершать никаких действий, пока вы не отведёте взгляд.',
    type: 'advanced_6_10',
    requiresId: 'fighter_seeing_red',
  },
  {
    id: 'fighter_taste_of_blood',
    classId: 'fighter',
    name: 'Вкус крови',
    description: 'Если вы рубите и кромсаете, ваша следующая атака по той же цели наносит +1к8 урона.',
    type: 'advanced_6_10',
    requiresId: 'fighter_scent_of_blood',
    replacesId: 'fighter_scent_of_blood',
  },
  {
    id: 'fighter_multiclass_initiate',
    classId: 'fighter',
    name: 'Мультикласс: посвящённый',
    description: 'Возьмите один ход другого класса, но будто ваш уровень ниже на 1.',
    type: 'advanced_6_10',
    requiresId: 'fighter_multiclass_dabbler',
  },
  {
    id: 'fighter_steel_hide',
    classId: 'fighter',
    name: 'Стальная шкура',
    description: 'Вы получаете +2 к броне.',
    type: 'advanced_6_10',
    requiresId: 'fighter_iron_hide',
    replacesId: 'fighter_iron_hide',
  },
  {
    id: 'fighter_eyes_of_death',
    classId: 'fighter',
    name: 'Глазами смерти',
    trigger: 'В начале боя бросьте+МДР.',
    hit10: 'Назовите того, кто переживёт бой, и того, кто погибнет.',
    hit7: 'Назовите того, кто переживёт бой, или того, кто погибнет. Всё ещё существует даже крошечный шанс, что видение сбудется; ведущий должен это учесть.',
    miss: 'Вы видите собственную смерть и получаете -1 на все ходы, пока битва не закончится.',
    type: 'advanced_6_10',
  },
  {
    id: 'fighter_weapon_expert',
    classId: 'fighter',
    name: 'Знаток оружия',
    description: 'Рассматривая оружие противника, вы можете выяснить у ведущего, сколько урона оно наносит.',
    type: 'advanced_6_10',
  },
  {
    id: 'fighter_superior_warrior',
    classId: 'fighter',
    name: 'Великий воитель',
    description:
      'Когда вы, рубя и кромсая, получаете 12+, вы не просто наносите урон и избегаете ответного удара, но и впечатляете до глубины души, лишаете мужества или приводите в ужас вашего противника.',
    type: 'advanced_6_10',
  },
]

const fighter: ClassData = {
  id: 'fighter',
  name: 'Воин',
  damageDice: 'd10',
  baseHp: 10,    // + КОН-модификатор при создании
  baseLoad: 12,  // + СИЛ-модификатор при создании

  moves,

  alignments: [
    { id: 'good',    name: 'Доброе',    trigger: 'Защити кого-то более слабого от опасности' },
    { id: 'neutral', name: 'Нейтральное', trigger: 'Победи достойного противника' },
    { id: 'evil',    name: 'Злое',      trigger: 'Убей беззащитного врага' },
  ],

  races: [
    { id: 'dwarf',    name: 'Гном',       moveId: 'fighter_race_dwarf' },
    { id: 'elf',      name: 'Эльф',       moveId: 'fighter_race_elf' },
    { id: 'halfling', name: 'Полурослик', moveId: 'fighter_race_halfling' },
    { id: 'human',    name: 'Человек',    moveId: 'fighter_race_human' },
  ],

  looks: [
    { category: 'Глаза',   options: ['зоркие', 'жёсткие', 'дикие', 'мёртвые', 'умные'] },
    { category: 'Волосы',  options: ['бритые', 'кудрявые', 'нечёсаные', 'заплетённые', 'лысина'] },
    { category: 'Лицо',    options: ['изрезанное шрамами', 'суровое', 'простодушное', 'красивое', 'страшное'] },
    { category: 'Тело',    options: ['мускулистое', 'коренастое', 'тощее', 'огромное', 'гибкое'] },
    { category: 'Одежда',  options: ['доспехи', 'поношенный наряд', 'дорогая одежда', 'трофеи с врагов', 'походная одежда'] },
  ],

  bondTemplates: [
    '_____ спасли мою жизнь; я у них в долгу.',
    '_____ — единственный человек, которому я доверяю в бою.',
    '_____ моложе меня и неопытен; я должен защищать его.',
    '_____ знает моих врагов и помог мне против них.',
  ],

  startingGear: [
    // Группа 1: пайки (автоматически)
    [
      { id: 'sg_dungeon_rations', name: 'Дорожные пайки (5)', weight: 1, tags: ['расходник'] },
    ],
    // Группа 2: броня (выбор)
    [
      { id: 'sg_chainmail',  name: 'Кольчуга (броня 1)', weight: 1, tags: ['доспех', 'броня 1'] },
      { id: 'sg_scale_mail', name: 'Чешуйчатая броня (броня 2, громоздкая)', weight: 3, tags: ['доспех', 'броня 2', 'громоздкий'] },
    ],
    // Группа 3: доп. предмет (выбор)
    [
      { id: 'sg_healing_potion', name: 'Зелье лечения', weight: 0, tags: ['расходник'] },
      { id: 'sg_antitoxin',      name: 'Антитоксин',   weight: 0, tags: ['расходник'] },
    ],
    // Группа 4: монеты (автоматически)
    [
      { id: 'sg_coins', name: '10 монет', weight: 1, tags: ['монеты'] },
    ],
  ],
}

export default fighter
export { moves }
