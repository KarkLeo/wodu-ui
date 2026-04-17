import type { InventoryItem } from '@/types/character'

export type GearTemplate = Omit<InventoryItem, 'id'> & { templateId: string }

export const GEAR_CATEGORIES = [
  { id: 'weapon', name: 'Оружие' },
  { id: 'armor',  name: 'Доспехи и щиты' },
  { id: 'gear',   name: 'Походное снаряжение' },
  { id: 'tool',   name: 'Инструменты' },
  { id: 'occult', name: 'Оккультные предметы' },
  { id: 'rare',   name: 'Редкие предметы' },
  { id: 'fire',   name: 'Огненное масло' },
] as const

export const GEAR_CATALOG: GearTemplate[] = [
  // Оружие
  { templateId: 'light_weapon',  name: 'Лёгкое оружие',  price: 10, tags: ['weapon', 'light'],   damage: 'd6',   notes: 'Кинжалы, короткие мечи, ручные топоры. Как доп. оружие — 1 раз за атаку перебросить урон.' },
  { templateId: 'battle_weapon', name: 'Боевое оружие',  price: 30, tags: ['weapon', 'battle'],  damage: 'd6+1', notes: 'Длинные мечи, молоты, топоры, копья.' },
  { templateId: 'heavy_weapon',  name: 'Тяжёлое оружие', price: 40, tags: ['weapon', 'heavy', 'two-handed'], damage: 'd6+2', notes: 'Двуручные мечи, боевые топоры, древковое оружие.' },
  { templateId: 'short_bow',     name: 'Короткий лук',   price: 10, tags: ['weapon', 'ranged', 'light'],  damage: 'd6',   notes: 'Пращи и т.п.' },
  { templateId: 'bow',           name: 'Лук',            price: 30, tags: ['weapon', 'ranged', 'battle'], damage: 'd6+1', notes: 'Арбалеты, пистолеты и т.п.' },
  { templateId: 'heavy_bow',     name: 'Тяжёлый лук / огнестрел', price: 50, tags: ['weapon', 'ranged', 'heavy'], damage: 'd6+2', notes: 'С места. Арбалеты и мушкеты.' },
  // Доспехи
  { templateId: 'light_armor', name: 'Лёгкий доспех', price: 30, tags: ['armor', 'light'], notes: 'Броня 1.' },
  { templateId: 'full_armor',  name: 'Полный доспех', price: 60, tags: ['armor', 'full'],  notes: 'Броня 2. Всегда со шлемом. Мешает бегать, скрываться, плавать.' },
  { templateId: 'shield',      name: 'Щит',           price: 10, tags: ['armor', 'shield'], notes: '+1 к броне.' },
  // Походное (2с)
  { templateId: 'rope',    name: 'Верёвка 6м',       price: 2, tags: ['gear'] },
  { templateId: 'spike',   name: 'Железный клин',    price: 2, tags: ['gear'] },
  { templateId: 'chalk',   name: 'Мел',              price: 2, tags: ['gear'] },
  { templateId: 'parchment', name: 'Пергамент',      price: 2, tags: ['gear'] },
  { templateId: 'flint',   name: 'Кремень и огниво', price: 2, tags: ['gear'] },
  { templateId: 'torches', name: 'Факелы (4 шт.)',   price: 2, tags: ['gear'] },
  { templateId: 'tent',    name: 'Палатка',          price: 2, tags: ['gear'] },
  { templateId: 'dice',    name: 'Кости',            price: 2, tags: ['gear'] },
  { templateId: 'caltrops', name: 'Шипы',            price: 2, tags: ['gear'], notes: 'Замедляют преследователей.' },
  { templateId: 'bandages', name: 'Бинты',           price: 2, tags: ['gear'] },
  { templateId: 'rations', name: 'Дорожный паёк',    price: 2, tags: ['gear', 'consumable'] },
  { templateId: 'waterskin', name: 'Бурдюк с водой', price: 2, tags: ['gear', 'consumable'] },
  { templateId: 'wineskin', name: 'Бурдюк с вином',  price: 2, tags: ['gear', 'consumable'] },
  // Инструменты (5с)
  { templateId: 'crowbar',    name: 'Лом',              price: 5, tags: ['tool'] },
  { templateId: 'hatchet',    name: 'Топорик',          price: 5, tags: ['tool'] },
  { templateId: 'snare',      name: 'Капкан',           price: 5, tags: ['tool'] },
  { templateId: 'lockpicks',  name: 'Отмычки',          price: 5, tags: ['tool'] },
  { templateId: 'ink',        name: 'Перо и чернила',   price: 5, tags: ['tool'] },
  { templateId: 'fishingrod', name: 'Удочка',           price: 5, tags: ['tool'] },
  { templateId: 'shovel',     name: 'Лопата',           price: 5, tags: ['tool'] },
  { templateId: 'grapnel',    name: 'Кошка с верёвкой', price: 5, tags: ['tool'] },
  { templateId: 'pick',       name: 'Кирка',            price: 5, tags: ['tool'] },
  { templateId: 'pole',       name: 'Складной шест',    price: 5, tags: ['tool'] },
  // Оккультные (10с)
  { templateId: 'mercury',      name: 'Ртуть (доза)',         price: 10, tags: ['occult', 'consumable'], notes: 'Слабый яд и наркотик. Больше доз в день, чем уровень — бросок ТЕЛ против эффектов.' },
  { templateId: 'bonedust',     name: 'Мешочек с костной пылью', price: 10, tags: ['occult'] },
  { templateId: 'holywater',    name: 'Пузырёк святой воды',  price: 10, tags: ['occult', 'consumable'] },
  { templateId: 'bloodvial',    name: 'Пузырёк крови',        price: 10, tags: ['occult', 'consumable'] },
  { templateId: 'incense',      name: 'Благовония и масла',   price: 10, tags: ['occult'] },
  // Редкие (20с)
  { templateId: 'mirror',    name: 'Зеркало',        price: 20, tags: ['rare'] },
  { templateId: 'lantern',   name: 'Фонарь',         price: 20, tags: ['rare'] },
  { templateId: 'spyglass',  name: 'Подзорная труба', price: 20, tags: ['rare'] },
  { templateId: 'hourglass', name: 'Песочные часы',  price: 20, tags: ['rare'] },
  { templateId: 'boardgame', name: 'Настольная игра', price: 20, tags: ['rare'] },
  { templateId: 'finery',    name: 'Изысканная одежда', price: 20, tags: ['rare'] },
  { templateId: 'symbols',   name: 'Священные символы и обереги', price: 20, tags: ['rare'] },
  // Огненное масло
  { templateId: 'fireoil', name: 'Огненное масло (фляжка)', price: 20, tags: ['fire', 'consumable'], notes: 'Поджигает область: d6+1 урона/раунд 3 раунда. Фонарь — 10 заправок.' },
]

export function findGearTemplate(templateId: string): GearTemplate | undefined {
  return GEAR_CATALOG.find(g => g.templateId === templateId)
}
