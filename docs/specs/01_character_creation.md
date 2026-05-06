# Character Creation Specification

## 1. Overview
This specification defines the character creation flow for the World of Dungeons application. It adheres to the established core rules while incorporating specific interactive quality-of-life features for the web interface.

## 2. Character Generation Steps

### 2.1 Character Name
- The player inputs a custom name (required).
- The player may optionally input a **True Name** (`trueName`) — a secret name that grants power.
- Region-based name suggestions are not implemented.

### 2.2 Attributes
- The primary attributes are: Strength (STR), Dexterity (DEX), Constitution (CON), Intelligence (INT), Wisdom (WIS), and Charisma (CHA).
- The system rolls 2d6 to determine the modifier for each attribute based on the following scale:
  - **6 or less:** 0
  - **7-9:** +1
  - **10 or 11:** +2
  - **12:** +3
- **Rolling options:**
  - **Roll all** — rolls all six attributes at once.
  - **Reroll one** — rerolls a single attribute independently.
  - **Manual override** — the player may type a bonus value (0–3) directly into any attribute field.
- There is no limit on the number of rerolls.

### 2.3 Class Selection
The player must choose from one of the standard archetypes or opt to create a custom class.

#### Standard Classes
1. **Fighter** (`fighter`)
   - **Granted Skill:** Athletics.
   - **Abilities:** Choose 2 from (Манёвренность `skirmish`, Прочность `toughness`, Рубка `hewing`, Стойкость `sturdy`).
2. **Thief** (`thief`)
   - **Granted Skill:** Stealth.
   - **Abilities:** Choose 2 from (Удар из тени `shadowStrike`, Удача `luck`, Реакция `reflexes`, Умелец `skilled`).
3. **Cleric** (`cleric`)
   - **Granted Skills:** Decipher, Heal.
   - **Abilities:** Choose 2 from (Благословение `blessing`, Исцеление `heal`, Отвращение нежити `turnUndead`, Видение `vision`).
4. **Wizard** (`wizard`)
   - **Granted Skill:** Lore.
   - **Abilities:** Automatically gains `summoning` (Призыв). Choose 1 additional ability from (Заговоры `incantations`, Подчинение `domination`, Ритуал `ritual`).
   - **Magic Section:** The spirit/ritual fields are shown but not required — the player may leave them blank and defer spirit creation to gameplay.
5. **Ranger** (`ranger`)
   - **Granted Skill:** Survival.
   - **Abilities:** Choose 2 from (Питомец `pet`, Разведка `scouting`, Залп `volley`, Дикарь `savage`).

#### Custom Class
- **Name:** The player must enter a custom class name (`customClassName`).
- **Selection Rights:**
  - Choose **any 2 skills** from the entire game list.
  - Choose **any 2 special abilities** from any of the standard classes.
- **Data Persistence:** Custom classes are not added to a global class database or stored as a standalone template. Instead, they exist entirely as ad-hoc configuration data saved directly to the individual character.

### 2.4 Skill Total
- Every character ends up with **exactly 2 skills** total: class-granted skills + picked skills to fill up to 2.
- Classes with 1 granted skill (Fighter, Thief, Wizard, Ranger) pick 1 additional.
- Classes with 2 granted skills (Cleric) pick 0 additional.
- Custom class has 0 granted skills and picks 2.

### 2.5 Hit Points (HP) and Hit Dice
- **Hit Dice Count:** `1 + max(0, CON modifier)` — at least 1 die regardless of CON.
- **Starting HP Calculation:** The system rolls all allocated hit dice and keeps the highest ones equal to the character's level (at level 1, keeps the single highest d6 roll). Player starts with this value as their max HP.
- The `sturdy` ability adds +6 HP on top of the dice result.
- HP can be rerolled during creation (button toggles to "Reroll" after first roll).
