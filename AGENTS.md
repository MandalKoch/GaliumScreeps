# Screeps AI Guidelines & Knowledge Base

This document contains guidelines, domain knowledge, architectural standards, and module references for developing Screeps AI in this codebase.

---

## 1. Project Architecture & Code Structure

### Main Loop Lifecycle (`main.js`)
The main loop runs strictly in the following sequence every tick:
1. **Memory Cleanup**: Purges dead creeps from `Memory.creeps` to avoid memory leaks.
2. **Creep Recycling & Suicide Execution**: Directs retiring units (`manager.suicide.js`) to deposit carried resources and recycle at the spawn.
3. **Room & Defense Management**:
   - **Tower Management** (`manager.towers.js`): Hostile attack > Creep heal > Structure repair.
   - **RCL-Adaptive Spawner Management**: Dynamically routes spawners based on Controller Level (`manager.spawner.js` for RCL 1, `manager.spawnerRCL2.js` for RCL 2+).
   - **Room Statistics & Dashboards** (`manager.stats.js`): Tracks throughput, gathering/upgrade rates, routes, and CPU.
4. **Creep Role Execution**: Executes role behavior loops (`role.harvester`, `role.carrier`, `role.transporter`, `role.upgrader`, `role.builder`).
5. **CPU Bucket Maintenance**: Checks `Game.cpu.generatePixel` and generates pixels when bucket reaches 10,000.

---

## 2. Codebase Modules & File Catalog

### Core & Entry Point
- **`main.js`**: Primary entry point and tick orchestrator.

### Colony Managers (`manager.*.js`)
- **`manager.spawner.js`**: RCL 1 spawner manager. Handles basic hybrid creeps (`[WORK, CARRY, MOVE]`), version 1 tracking, and emergency harvester recovery when energy is depleted.
- **`manager.spawnerRCL2.js`**: RCL 2+ spawner manager. Employs dynamic body scaling per role, version 2 tagging, carrier and transporter quota management, and automated retirement of obsolete v1 creeps upon spawning v2 replacements.
- **`manager.transporter.js`**: Point-to-point and chain logistics manager. Configures routes between containers/spawns (`from` -> `to`), assigns fast transporters, and checks route quotas.
- **`manager.towers.js`**: Automated tower defense system. Prioritizes attacking hostile creeps, healing friendly creeps, and repairing critical ramparts/containers when energy > 50%.
- **`manager.idle.js`**: Parking and congestion control. Dispatches idle creeps to designated room parking flags (`roomFlags` dictionary or auto-detected flags like `Idle_<RoomName>`, `Parking`, `Idle`) to keep spawns and roads clear.
- **`manager.suicide.js`**: Graceful unit recycling. Offloads carried energy to base structures, navigates to the nearest spawn to recycle (`spawn.recycleCreep`), or suicides cleanly without wasting resources.
- **`manager.stats.js`**: Real-time console reporting system. Gathers tick-by-tick gathering and upgrade rates, trend indicators (📈 UP / 📉 DOWN), storage breakdowns, spawner status, route fulfillment, defense alerts, and CPU bucket stats every 100 ticks.

### Creep Roles (`role.*.js`)
- **`role.harvester.js`**: Energy extraction role. Prioritizes depositing energy directly into adjacent source containers for static mining setups, falling back to filling spawns/extensions if no containers exist.
- **`role.carrier.js`**: General logistics hauler. Collects dropped resources, tombstones, ruins, and container energy to supply spawns, extensions, towers, and storage.
- **`role.transporter.js`**: High-speed dedicated route transporter (1:1 `CARRY:MOVE` ratio). Executes specific container-to-container or container-to-spawn routes defined in `manager.transporter.js` with automatic overflow balancing.
- **`role.upgrader.js`**: Room controller upgrader. Withdraws energy from controller containers or nearby storage to continuously upgrade the Room Controller.
- **`role.builder.js`**: Construction and maintenance specialist. Prioritizes construction sites (`Towers` > `Extensions` > `Containers` > `Walls/Ramparts` > `Roads`), automatically loads room blueprints (`room.<RoomName>.js`), and performs urgent repairs.

### Room Blueprints (`room.*.js`)
- **`room.W2N2.js`**: Room layout blueprint for `W2N2`. Defines planned construction coordinates (`constructions` array with `type`, `x`, `y`, `minRcl`), dynamically loaded and queued by builder creeps.

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
- **Object References**: Never store live game objects (`Creep`, `Structure`, `Source`) in `Memory`. Always store ID strings (`creep.memory.targetId = target.id`) or coordinate objects (`{x, y}`).
- **Pathfinding & Distance Optimization**:
  - Prefer `pos.findClosestByRange()` over `pos.findClosestByPath()` for general target selection to avoid heavy pathfinder computations.
  - Set `reusePath: 15` or higher on `creep.moveTo()`.
- **Dynamic Module Caching**: Cache dynamically required modules (e.g., `role.builder.js` blueprint caching `roomBlueprints[roomName]`) to eliminate repeated `require()` overhead.
- **CPU Bucket**: Maintain CPU bucket awareness (`Game.cpu.bucket`). Trigger `Game.cpu.generatePixel()` when reaching 10,000 CPU bucket capacity.

---

## 4. Creep Body Ratios & Role Archetypes

- **Static Miner / Harvester (v2)**: Heavy `WORK` (e.g. 5 `WORK`, 1 `CARRY`, 1-2 `MOVE`). Sits on source containers and harvests 10 e/tick.
- **Dedicated Hauler / Carrier (v2)**: 2 `CARRY` : 1 `MOVE` (roads) or 1 `CARRY` : 1 `MOVE` (plains).
- **Fast Route Transporter**: 1 `CARRY` : 1 `MOVE` for 100% full speed on plains and roads.
- **Upgrader / Builder (v2)**: Balanced throughput (e.g., 2-4 `WORK`, 1-2 `CARRY`, 1-2 `MOVE`).

---

## 5. Room Progression & Logistics Chain

```
[Energy Source]
       │
       ▼ (Harvester mines 10 e/tick)
[Source Container]
       │
       ├──► [Transporter: Route 1] ──► [Spawns & Extensions] ──► Spawns v2 Units
       ├──► [Transporter: Route 2] ──► [Controller Container] ──► Upgraders
       └──► [Carrier / Hauler]     ──► [Towers & Storage]     ──► Defense & Stockpile
```

- **RCL 1**: Spawns hybrid v1 harvesters/upgraders/builders to supply spawn and upgrade controller.
- **RCL 2**: Builds source containers + first 5 extensions. Unlocks static mining, carriers, fast transporters, and replaces v1 units via graceful retirement.
- **RCL 3**: Builds defensive towers and additional extensions.
- **RCL 4+**: Unlocks storage and advanced link logistics.
