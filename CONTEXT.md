# SandArtMatch

SandArtMatch is a portrait WeChat mini game about clearing sand art by sending colored buckets onto a carrier. This glossary keeps product, gameplay, and art-planning language consistent as prototype references become shippable game behavior.

## Language

**Formal Product Flow**:
The current runtime path players can actually enter in the MVP: Boot, Home, Battle, then Victory or Deadlock. Prototype-only branches are not part of this flow until a task explicitly promotes them.
_Avoid_: Full prototype flow, all-page flow

**Prototype Reference**:
A source of desired future page structure, interaction examples, art direction, or dynamic-content placeholders. It informs planning, but does not override frozen project decisions or the active task.
_Avoid_: Final spec, mandatory feature list

**Formal Level**:
A playable catalog entry available through the current product flow. The current formal catalog contains only `level-001`.
_Avoid_: Test level, prototype level

**Level Catalog**:
The ordered product list of formal levels shown or selected by Home. It separates player-facing level identity from the battle data used to start a level.
_Avoid_: Hard-coded level list, scene level list

**Embedded Level Selection**:
The level-selection experience inside Home. Selecting changes the highlighted formal level; Play is the action that starts Battle.
_Avoid_: LevelSelect scene, instant play selection

**Saved Selection**:
The last formal level chosen by the player when that level is still valid and unlocked. It is Home's first choice when deciding what to highlight.
_Avoid_: Current level, recommended level

**Highest Unlocked Level**:
The furthest formal level currently available to the player. Home uses it when there is no valid saved selection.
_Avoid_: Recommended level, next level

**Recommended Level**:
The first unlocked formal level that is not completed, used as progress guidance. It is not the same thing as Home's fallback selected level.
_Avoid_: Selected level, highest unlocked level

**Theme**:
A visual skin for Battle background, frame, and decorations. Themes do not change carrier capacity, bucket-pool shape, or gameplay rules.
_Avoid_: Ruleset, level mode

**Post-MVP System**:
A prototype feature intentionally outside the first MVP, such as ads, stamina, shop, collection, game-circle, or social systems. These may be planned without entering the formal product flow yet.
_Avoid_: MVP feature, required runtime flow
