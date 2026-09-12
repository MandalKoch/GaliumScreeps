# Screeps Autonomous AI Colony

A modular, CPU-optimized Screeps AI designed to autonomously manage room expansion, static mining economies, point-to-point container logistics, tower defense, prioritized construction blueprints, and real-time performance analytics.

---

## 📁 Code Structure

The project uses a clean, modular CommonJS architecture where roles, managers, and room blueprints are separated into dedicated single-responsibility files:

```text
├── main.js                 # Primary game loop orchestrator
├── AGENTS.md               # AI guidelines, architectural rules, and knowledge base
├── README.md               # Human-readable guide and feature documentation
│
├── Colony Managers:
│   ├── manager.spawner.js      # RCL 1 basic spawner & emergency harvester recovery
│   ├── manager.spawnerRCL2.js  # RCL 2+ dynamic body scaling, quotas & unit replacement
│   ├── manager.transporter.js  # Route manager for container-to-container & container-to-spawn hauling
│   ├── manager.towers.js       # Tower defense manager (hostile attack, heal, repairs)
│   ├── manager.idle.js         # Idle parking manager (room flag dictionary & anti-blocking)
│   ├── manager.suicide.js      # Graceful creep retirement & energy recycling
│   └── manager.stats.js        # Periodic console reporting (upgrade/gather rates, CPU, units)
│
├── Creep Roles:
│   ├── role.harvester.js       # Static/hybrid miner (deposits to nearby containers first)
│   ├── role.carrier.js         # General room hauler (dropped energy, ruins, extensions, towers)
│   ├── role.transporter.js     # Fast route transporter (1:1 CARRY:MOVE for specific routes)
│   ├── role.upgrader.js        # Controller upgrader (withdraws from containers/storage)
│   └── role.builder.js         # Prioritized builder & dynamic room blueprint executor
│
└── Room Blueprints:
    └── room.W2N2.js            # Planned layout & coordinates for room W2N2
```

---

## 🚀 Key Features & Capabilities

### 1. Dynamic RCL Progression & Automated Creep Upgrades
- **RCL 1 Mode (`manager.spawner.js`)**: Focuses on balanced hybrid workers (`[WORK, CARRY, MOVE]`) to jumpstart the colony, upgrade the controller to RCL 2, and maintain emergency recovery failsafes.
- **RCL 2+ Mode (`manager.spawnerRCL2.js`)**: Dynamically scales creep body sizes based on `room.energyCapacityAvailable`. Unlocks specialized archetypes (heavy-WORK miners, fast carriers, route transporters).
- **Automated Creep Replacement**: Creeps are stamped with a version tag (`version: 1` vs `version: 2`). When upgraded v2 units spawn, older v1 creeps of that role are automatically marked for retirement.

### 2. Graceful Creep Recycling (`manager.suicide.js`)
- Retiring creeps never suicide with full inventory.
- They first deliver carried resources to the nearest spawn, extension, tower, or container.
- Once empty, they walk to the spawn and execute `spawn.recycleCreep()` (or cleanly suicide) to return energy to your colony.

### 3. High-Speed Route Transportation (`role.transporter.js` & `manager.transporter.js`)
- **Fast Hauling Ratio**: Uses a `1 CARRY : 1 MOVE` body configuration to travel at full speed (1 tile/tick) on both plains and roads.
- **Configurable Logistics Chain**: Define dedicated routes between source containers, spawns, extensions, and controller containers.
- **Auto-Balancing**: If a designated spawn is full, transporters automatically redirect to adjacent extensions needing energy.

### 4. Prioritized Construction & Dynamic Room Blueprints
- **Prioritized Build Order**: Builders always construct critical colony infrastructure in priority order:
  1. `Towers` (Defense & security)
  2. `Extensions` (Higher energy capacity for bigger creeps)
  3. `Containers` (Decoupled mining & storage buffers)
  4. `Walls & Ramparts` (Base fortification)
  5. `Roads` (Movement speed & decay prevention)
- **Dynamic Blueprint Loading**: `role.builder.js` dynamically checks and loads `room.<RoomName>.js` based on the creep's current room, caching loaded modules to save CPU.

### 5. Automated Tower Defense (`manager.towers.js`)
- Detects hostiles entering the room and coordinates multiple towers to focus-fire invaders.
- Heals damaged friendly creeps in the room.
- Performs automated maintenance on critical ramparts, walls, and decaying containers when energy is above 50%.

### 6. Anti-Congestion & Idle Parking (`manager.idle.js`)
- Prevents idle creeps from crowding around spawns or blocking roads when spawns/extensions are full.
- Creeps automatically park at room flags defined in `manager.idle.js` (or auto-detected flags like `Idle_<RoomName>`, `Parking`, or `Idle`).

### 7. Real-Time Room Analytics Dashboard (`manager.stats.js`)
Outputs a comprehensive colony report to the in-game console every 100 ticks (~5 minutes on MMO, ~1-2 minutes on private servers):
- **Controller Progress**: Current RCL, percentage to next level, and downgrade countdown timer.
- **Real-Time Upgrade Rate**: Energy invested per tick into the controller with trend indicators (`📈 UP`, `📉 DOWN`, `➖ Stable`).
- **Mining Gathering Rate**: Measured energy/tick extracted across room sources.
- **Storage Breakdown**: Energy stored across Spawns, Extensions, Containers, Storage, and Dropped piles.
- **Unit Census**: Creep counts categorized by role and version (`v1` vs `v2`).
- **Logistics Fulfillment**: Status of active transporter routes (assigned creeps vs target quota).
- **Spawner & Construction**: Active incubation progress and pending construction sites.
- **Defense & CPU Bucket**: Hostile detection status, tower energy, and CPU bucket capacity.

---

## 🛠️ Configuration & Customization Guide

### 1. Setting Up Transporter Routes (`manager.transporter.js`)
Open `manager.transporter.js` and add route entries to the `routes` array:

```javascript
routes: [
    // Example 1: Haul from source container to Spawn & Extensions
    {
        name: 'source_to_spawn',
        room: 'W2N2',
        from: { x: 10, y: 26 }, // Coordinates of source container (or container ID string)
        to: 'spawn',            // Keyword 'spawn' fills Spawn and Extensions
        count: 1                // Number of transporters assigned
    },
    // Example 2: Haul from source container to container near the Room Controller
    {
        name: 'source_to_controller',
        room: 'W2N2',
        from: { x: 10, y: 26 },
        to: { x: 28, y: 32 },   // Container next to Room Controller
        count: 1
    }
]
```

### 2. Adding Construction Blueprints (`room.W2N2.js`)
To plan buildings for a room, add objects into the `constructions` array:

```javascript
constructions: [
    // Source Containers (RCL 2)
    { type: STRUCTURE_CONTAINER, x: 10, y: 26, minRcl: 2 },

    // Extensions (RCL 2+)
    { type: STRUCTURE_EXTENSION, x: 24, y: 20, minRcl: 2 },
    { type: STRUCTURE_EXTENSION, x: 25, y: 20, minRcl: 2 },

    // Tower (RCL 3)
    { type: STRUCTURE_TOWER,     x: 25, y: 23, minRcl: 3 },

    // Roads (RCL 1+)
    { type: STRUCTURE_ROAD,      x: 25, y: 19, minRcl: 1 }
]
```

### 3. Setting Up Idle Parking Flags
1. In the Screeps game client, place a flag in your room on an empty tile away from spawns and roads.
2. Name the flag `Idle_W2N2` (or `Parking` / `Idle`).
3. Alternatively, map it explicitly in `manager.idle.js`:
   ```javascript
   roomFlags: {
       'W2N2': 'Idle_W2N2'
   }
   ```

---

## ⚡ CPU & Performance Highlights
- **Path Caching**: All creep movement uses `reusePath: 15` or higher.
- **Euclidean Range Filtering**: Avoids expensive `findClosestByPath` across large structure lists, replacing them with `findClosestByRange`.
- **Dynamic Require Caching**: Loaded room blueprints are cached in memory to eliminate repeated module resolution.
- **Pixel Generation**: Automatically triggers `Game.cpu.generatePixel()` when `Game.cpu.bucket >= 10000`.
