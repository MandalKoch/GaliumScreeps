# Screeps AI Guidelines & Knowledge Base

This document contains guidelines, domain knowledge, architectural standards, and module references for developing Screeps AI in this codebase.

---

## 1. Project Architecture & Code Structure

### Main Loop Lifecycle (`main.js`)
The main loop runs strictly in the following sequence every tick:
1. **Memory Cleanup**: Purges dead creeps from `Memory.creeps` to avoid memory leaks.
2. **Room Statistics & Dashboards** (`manager.stats.js`): Accumulates gathering and upgrade metrics, tracking throughput, routes, storage, and CPU.
3. **Tower Defense & Repairs** (`manager.tower.js`): Executes automated combat targeting, triage healing of damaged creeps, emergency structural repairs, and threshold-gated maintenance.
4. **Spawner Management** (`manager.spawner.js`): Evaluates threat levels and creep quotas, executing prioritized spawn queues (emergency recovery > wartime defense > static harvesters > mules > standing army > updaters > builders).
5. **Creep Role Execution**: Dispatches role execution loops (`role.harvester`, `role.updater`, `role.builder`, `role.mule`, `role.defender`).
6. **CPU Bucket Maintenance**: Checks `Game.cpu.generatePixel` and generates pixels when bucket reaches 10,000.

---

## 2. Codebase Modules & File Catalog

### Core & Entry Point
- **`main.js`**: Primary entry point and tick orchestrator.
- **`helper.source.js`**: Global helper functions extending environment capabilities (e.g., `global.findNextContainerWithEnergy`).

### Colony Managers (`manager.*.js`)
- **`manager.spawner.js`**: Autonomous colony spawner. Evaluates hostile presence to switch between peacetime quotas and wartime alerts, managing emergency recovery, mule routes, military forces, and civilian workers.
- **`manager.idle.js`**: Parking and congestion control. Dispatches idle creeps to designated room parking flags (`roomFlags` dictionary or auto-detected flags like `Idle_<RoomName>`, `Parking`, `Idle`) and steers creeps away from spawns.
- **`manager.stats.js`**: Real-time console reporting system. Gathers tick-by-tick gathering and upgrade rates, trend indicators (📈 UP / 📉 DOWN), storage breakdowns, spawner status, mule route fulfillment, defense alerts, and CPU bucket stats every 100 ticks.
- **`manager.tower.js`**: Automated defense and maintenance system. Prioritizes hostiles (healers > attackers > closest), triage heals friendly creeps, performs emergency repairs on critical structures, and maintains infrastructure when energy exceeds configured thresholds.

### Creep Roles (`role.*.js`)
- **`role.harvester.js`**: Home room energy extraction role. Supports local harvesting routes via `HARVESTERS` configuration (`route`, `room`, `homeRoom`, `source`, `target`, `count`). Prioritizes depositing energy directly into the configured dropoff container / adjacent source containers (static mining setup), falling back to filling spawns, extensions, towers, storage, or controller upgrading.
- **`role.remoteharvester.js`**: Long-distance remote room energy extractor and hauler. Uses `REMOTE_HARVESTERS` route configuration (`route`, `room`, `homeRoom`, `source`, `count`) with balanced 1:1 `MOVE` parts (`[WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]`) for efficient cross-border navigation and hauling back to `homeRoom`.
- **`role.updater.js`**: Room controller upgrader. Gathers energy from containers (or active sources) and upgrades the Room Controller.
- **`role.builder.js`**: Construction & maintenance specialist. Withdraws energy from containers to construct active building sites, and when idle, plans routes, places road construction sites, and repairs decaying roads (< 70% hits).
- **`role.mule.js`**: Dedicated point-to-point route logistics hauler. Uses `MULES` route configuration (`route`, `room`, `source`, `target`, `count`) with object IDs. Delivers remaining cargo before parking on empty sources.
- **`role.defender.js`**: Multi-archetype military combat and field medic role. Handles melee combat (`attack`), ranged combat with kiting (`rangedAttack`/`rangedMassAttack`), and combat medic healing (`heal`/`rangedHeal` triage). Stations at `defend` flag during peacetime.

---

## 3. Memory & CPU Optimization Guidelines

- **Memory Garbage Collection**: Dead creeps must be purged every tick:
  ```javascript
  for (const name in Memory.creeps) {
      if (!Game.creeps[name]) {
          delete Memory.creeps[name];
      }
  }
  ```
- **Object References**: Never store live game objects (`Creep`, `Structure`, `Source`) in `Memory`. Always store ID strings (`creep.memory.source = source.id`) or route keys (`creep.memory.route = 'updaterRoute'`).
- **Pathfinding & Distance Optimization**:
  - Prefer `pos.findClosestByRange()` over `pos.findClosestByPath()` for general target selection to avoid heavy pathfinder computations.
  - Set `reusePath: 15` on `creep.moveTo()`.
- **Dynamic Configuration Lookups**: Keep route definitions in role configuration arrays (e.g. `role.mule.js` and `role.builder.js`) and look them up dynamically to allow instant route tuning without rebuilding creep memory.
- **CPU Bucket**: Maintain CPU bucket awareness (`Game.cpu.bucket`). Trigger `Game.cpu.generatePixel()` when reaching 10,000 CPU bucket capacity.

---

## 4. Creep Body Ratios & Role Archetypes

- **Emergency Harvester**: `[WORK, CARRY, MOVE]` (200 energy) - Jumpstarts colony when harvesters <= 1.
- **Static Miner / Harvester**: `[WORK, WORK, WORK, WORK, CARRY, MOVE]` (500 energy) - Mines 8 energy/tick directly into adjacent containers with low transit overhead.
- **Remote Harvester**: `[WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]` (500 energy) - Balanced 1:1 `MOVE` ratio for fast cross-border transit and hauling.
- **Dedicated Route Mule**: `[CARRY, CARRY, MOVE, MOVE]` (200 energy) - 1:1 `CARRY:MOVE` ratio for 100% full speed on plains and roads.
- **Defender Melee**: `[TOUGH, MOVE, ATTACK, ATTACK, MOVE]` (280 energy) - Frontline armored strike unit.
- **Defender Ranged**: `[RANGED_ATTACK, MOVE, MOVE]` (260 energy) - Mobile skirmisher and kiting unit.
- **Defender Healer**: `[HEAL, MOVE]` (300 energy) - Combat medic for active unit triage and recovery.
- **Updater / Builder**: `[WORK, CARRY, MOVE]` (200 energy) - Standard civilian infrastructure workers.

---

## 5. Room Progression & Logistics Chain

```
[Energy Source]
       │
       ▼ (Harvester mines into container)
[Source Container]
       │
       ├──► [Mule: Harvester Route] ──► [Central / Base Container] ──► [Spawns & Extensions]
       ├──► [Mule: Updater Route]   ──► [Controller Container]    ──► Upgraders (RCL Progress)
       └──► [Builder (Idle)]        ──► Plans & constructs roads between source & target IDs
```

- **Emergency State**: Spawns low-cost harvesters to restore room energy flow.
- **Hostile Alert**: Automatically scales defenders (5 Melee, 5 Ranged, 2 Healers) on top priority.
- **Logistics & Infrastructure**: Mules maintain throughput between containers while Builders maintain high-speed paved transit lanes when idle.
