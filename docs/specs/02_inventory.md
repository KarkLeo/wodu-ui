# Inventory Specification

## 1. Overview
This specification defines the inventory system for the World of Dungeons application. It covers purchasing items from the gear catalog, equipping items, using consumables, creating custom items, and the special mercury flow (described further in the Magic specification).

## 2. Data Model

### 2.1 InventoryItem
```ts
interface InventoryItem {
  id: string          // UUID, auto-generated
  templateId?: string // reference to gear catalog entry
  name: string
  descriptor: ItemDescriptor
  price?: number      // cost in silver pieces
  damage?: string     // e.g. 'd6', 'd6+1'
  notes?: string
  equipped?: boolean  // only meaningful for weapons, armor, shields
  quantity?: number   // defaults to 1; >1 only for consumables
}
```

### 2.2 ItemDescriptor
Discriminated union that determines item behaviour:

| kind | extra fields | notes |
|------|-------------|-------|
| `weapon` | `melee: boolean` | melee or ranged |
| `armor` | `class: 'none' \| 'light' \| 'full'` | `light` → 1 armor, `full` → 2 armor |
| `shield` | — | adds +1 armor |
| `gear` | `consumable?: boolean` | generic camp gear |
| `tool` | — | non-consumable tools |
| `occult` | `consumable?: boolean` | occult items |
| `custom` | `consumable?: boolean` | player-created items |

### 2.3 Coins
Tracked on the Character as `coins: number` (silver pieces). Minimum value is 0.

### 2.4 Quicksilver Counter
Tracked on the Character as `quicksilverCount?: number`. Used exclusively for mercury overdose tracking; see §6.1.

## 3. Gear Catalog

The catalog (`src/data/gear.ts`) contains 43 predefined items organised into 7 categories:

| Category key | UI label | Notable items |
|---|---|---|
| `weapon` | Weapons | light (d6, 10с), battle (d6+1, 30с), heavy (d6+2, 40с), bows |
| `armor` | Armor & Shields | light armor (30с), full armor (60с), shield (10с) |
| `gear` | Camp Gear | rope, torches, rations (consumable), bandages |
| `tool` | Tools | crowbar, lockpicks, grapnel, etc. |
| `occult` | Occult Items | mercury (consumable, 10с), bonedust, holy water (consumable) |
| `rare` | Rare Items | mirror, lantern, spyglass, etc. |
| `fire` | Fire Oil | fire oil (consumable, d6+1 dmg/round × 3) |

Each catalog entry carries a `templateId` that is preserved on the created `InventoryItem` for stacking and special-case logic.

## 4. Purchasing Items

### 4.1 Normal Purchase
- Player selects an item from the catalog; the app dispatches `BUY_ITEM { templateId }`.
- If `coins >= price`, coins are deducted and the item is added.
- Consumables with the same `templateId` are auto-stacked (quantity incremented) rather than added as separate items.

### 4.2 Insufficient Coins — GM Approval Flow
- If `coins < price`, a dialog is shown informing the player of insufficient funds.
- The GM may approve the acquisition; the app then dispatches `RECEIVE_ITEM` (no coin deduction).
- The player may also cancel.

## 5. Equipping Items

- Any non-consumable item (weapon, armor, shield, tool, gear, occult) can be equipped via the `EQUIP_ITEM` command.
- Dispatching `EQUIP_ITEM` on an already-equipped item dispatches `UNEQUIP_ITEM` (toggle behaviour).
- Equipped items are sorted to the top of the inventory list and highlighted with an accent border.
- **Effect on derived stats:**
  - Equipped `armor` items contribute to `totalArmor`: `light` → 1, `full` → 2.
  - Equipped `shield` items add +1 to `totalArmor`.
  - The equipped weapon's damage formula is shown in the header strip.
- **Multiple weapons alert:** If more than one item with `descriptor.kind === 'weapon'` is equipped simultaneously, a warning banner is displayed at the top of the inventory panel. The behaviour is still allowed — the warning is advisory only.
- **Multiple armor alert:** Same rule applies for more than one equipped armor piece.

## 6. Using Consumables

- Items where `isConsumable(item) === true` show a **Use** button instead of an equip toggle.
- Dispatching `USE_ITEM { itemId }`:
  - Decrements `quantity` by 1.
  - If `quantity` reaches 0, the item is removed from inventory.
- Consumable items cannot be equipped.

### 6.1 Mercury / Quicksilver Flow
This flow is handled separately from the standard consumable use and will be fully described in the **Magic Specification**. In brief:
- When a mercury item (`templateId === 'mercury'`) is used, `quicksilverCount` is incremented by 1.
- If `quicksilverCount >= character.level`, an overdose dialog is shown before the item is consumed.
- The dialog offers three options: cancel, reset counter (`RESET_QUICKSILVER`), or roll a CON check (then consume anyway).

## 7. Custom Items

Players can create items that are not in the gear catalog.

### 7.1 Creation
The form collects:
- **Name** (required)
- **Price** (optional, silver pieces)
- **Description / Notes** (optional)
- **Consumable** checkbox
- **Quantity** (visible only when Consumable is checked)

On submit, dispatches `ADD_CUSTOM_ITEM`. The resulting item has `descriptor: { kind: 'custom', consumable }` and no `templateId`.

### 7.2 Editing
- Custom items show an edit (✎) button.
- The same fields as creation can be modified inline.
- Dispatches `EDIT_CUSTOM_ITEM { itemId, ...fields }`.
- Editing is only available for items with `descriptor.kind === 'custom'`.

### 7.3 Removal
Any item (catalog or custom) can be removed via a delete button, dispatching `REMOVE_ITEM { itemId }`.

## 8. Domain Commands Summary

| Command | Purpose |
|---|---|
| `BUY_ITEM { templateId }` | Purchase from catalog, deduct coins |
| `RECEIVE_ITEM { item }` | Add item without cost (GM grant) |
| `ADD_CUSTOM_ITEM { name, price?, notes?, consumable?, quantity? }` | Create custom item |
| `EDIT_CUSTOM_ITEM { itemId, name, price?, notes?, consumable?, quantity? }` | Modify custom item |
| `REMOVE_ITEM { itemId }` | Delete item |
| `USE_ITEM { itemId }` | Consume item (decrement qty or remove) |
| `EQUIP_ITEM { itemId }` | Mark item as equipped |
| `UNEQUIP_ITEM { itemId }` | Mark item as unequipped |
| `SET_COINS { amount }` | Set coin total (clamped ≥ 0) |
| `RESET_QUICKSILVER` | Reset quicksilverCount to 0 |

## 9. Derived Values

All armor and damage derived values are computed in `src/utils/derived.ts`:
- `totalArmor(char)` — sums equipped armor class values + shield + `toughness` ability bonus.
- `armorBreakdownLines(char)` — returns `BreakdownLine[]` for the armor popover tooltip.
- `damageFormula(char, weapon)` — weapon damage string including ability bonuses.
- `damageBreakdownLines(char, weapon)` — breakdown for the damage popover tooltip.
