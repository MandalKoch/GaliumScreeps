# Screeps Autonomous AI Colony

A modular, CPU-optimized Screeps AI designed to autonomously manage energy extraction, dedicated point-to-point mule logistics, automated road construction, multi-archetype military defense, controller upgrading, and real-time performance analytics.

---

## 📁 Code Structure

The project uses a clean, modular CommonJS architecture where roles, managers, and helper utilities are separated into dedicated single-responsibility files:

```text
├── main.js                 # Primary game loop orchestrator
├── AGENTS.md               # AI guidelines, architectural rules, and knowledge base
├── README.md               # Human-readable guide and feature documentation
├── helper.source.js        # Global resource and container lookup helpers
│
├── Colony Managers:
│   ├── manager.spawner.js      # Prioritized spawning, quotas, military alerts & recovery
│   ├── manager.idle.js         # Idle parking manager (room flag dictionary & anti-blocking)
│   ├── manager.stats.js        # Periodic console reporting (upgrade/gather rates, CPU, units)
│   └── manager.tower.js        # Automated tower combat, triage healing & threshold repairs
│
└── Creep Roles:
    ├── role.harvester.js       # Static miner (deposits to nearby containers/structures)
    ├── role.remoteharvester.js # Long-distance remote miner & cross-room hauler
    ├── role.updater.js         # Controller upgrader (withdraws from containers/storage)
    ├── role.builder.js         # Construction specialist & idle road maintenance planner
    ├── role.mule.js            # Dedicated point-to-point route hauler (ID-based routing)
    └── role.defender.js        # Melee, ranged, and combat healer military forces
```

---

## 🚀 Key Features & Capabilities

### 1. Prioritized Spawner Management & Emergency Recovery (`manager.spawner.js`)
- **Emergency Recovery**: If active harvesters drop to 1 or 0, instantly triggers emergency 200-energy harvester spawning (`[WORK, CARRY, MOVE]`) to prevent colony collapse.
- **Wartime Defense Prioritization**: Detects hostile creeps in the room and overrides civilian production to spawn combat units (5 Melee, 5 Ranged, 2 Healers).
- **Logistics & Infrastructure Queuing**: Prioritizes route-based mules before allocating peacetime military and civilian upgraders/builders.

### 2. Dedicated Route Mule Logistics (`role.mule.js`)
- **High-Speed Point-to-Point Transport**: Fast `1 CARRY : 1 MOVE` body configuration for maximum speed on plains and roads.
- **Route Configuration Array (`MULES`)**: Define routes with target room, source ID, target destination ID, and target creep counts.
- **Dynamic Configuration Resolution**: Reads route settings directly from the `MULES` array at runtime, allowing instant changes without resetting creep memory.
- **Partial Delivery Drain**: If the source container is empty or depleted, mules holding partial energy deliver their cargo before entering idle parking.

### 3. Builder Construction & Idle Road Maintenance (`role.builder.js`)
- **Primary Construction**: Builds active construction sites prioritized across the room.
- **Idle Road Planning & Placement**: When no active sites exist, automatically traces paths between configured source and target routes (`ROADS`) and places `STRUCTURE_ROAD` sites.
- **Decay Repair**: Automatically detects and repairs decaying roads (< 70% hits) before entering parking.

### 4. Multi-Archetype Military Defense & Field Medics (`role.defender.js`)
- **Melee Attackers (`defenderMelee`)**: Heavily armored frontline units (`[TOUGH, MOVE, ATTACK, ATTACK, MOVE]`) that charge and eliminate high-threat targets.
- **Ranged Skirmishers (`defenderRanged`)**: Fast kiting units (`[RANGED_ATTACK, MOVE, MOVE]`) that maintain a 3-tile distance from melee enemies while dealing ranged damage.
- **Combat Field Medics (`defenderHealer`)**: Mobile triage units (`[HEAL, MOVE]`) that prioritize self-preservation, heal critical units sorted by lowest health percentage, and escort combat squads.
- **Priority Targeting**: Ranks targets dynamically: Healers > Attackers > Closest Hostiles > Invader Structures.
- **Peacetime Stations**: Assembles at `defend` flags during peacetime or parks using `manager.idle.js`.

### 5. Automated Tower Defense & Maintenance (`manager.tower.js`)
- **Priority Combat Targeting**: Concentrates fire on hostiles with `HEAL` parts, followed by offensive/dismantler units (`ATTACK`, `RANGED_ATTACK`, `WORK`), and closest hostiles.
- **Triage Field Healing**: Automatically heals damaged friendly creeps in the room, prioritizing those with the lowest health percentages.
- **Emergency Repairs**: Repairs critical infrastructure under 5,000 hits (or < 25% hits for roads and containers) when emergency energy is available.
- **Threshold-Gated Maintenance**: Only performs non-critical structure, wall, and rampart repairs when tower energy exceeds 500 energy to preserve reserves for base defense.

### 6. Local & Remote Harvesting (`role.harvester.js`, `role.remoteharvester.js`)
- **Local Static Harvesters (`role.harvester.js`)**: Configured with `[WORK, WORK, WORK, WORK, CARRY, MOVE]` (500e) to maximize static energy mining (8 e/t) into adjacent containers.
- **Dedicated Remote Harvesters (`role.remoteharvester.js`)**: Configured with `[WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]` (500e) providing a 1:1 `MOVE` ratio for full-speed movement across remote rooms.
- **Configurable Harvesting Routes**: Define local routes in `role.harvester.js` (`HARVESTERS`) and remote routes in `role.remoteharvester.js` (`REMOTE_HARVESTERS`).
- **Inter-Room Navigation & Return**: Remote harvesters travel to designated remote rooms, harvest active sources, and return energy to base room spawns, extensions, towers, and storage.
- **Room Saturation Fallback**: Automatically falls back to filling Spawns, Extensions, Towers, Storage, or upgrading the Room Controller when primary targets are full.

### 7. Controller Upgrading & Infrastructure Construction (`role.updater.js`, `role.builder.js`)
- **Container Sourcing (`helper.source.js`)**: Updaters and builders withdraw energy from containers rather than spending time mining active sources.
- **Active Mining Fallback**: Seamlessly falls back to mining sources if containers are empty or unavailable.

### 8. Anti-Congestion & Idle Parking (`manager.idle.js`)
- Prevents idle creeps from blocking spawns, extensions, or pathways.
- Moves idle units to room parking flags (`roomFlags` dictionary or auto-detected flags like `Idle_<RoomName>`, `Parking`, `Idle`), or automatically steps away if within 2 tiles of any spawn.

### 9. Real-Time Room Analytics Dashboard (`manager.stats.js`)
Outputs a comprehensive colony report to the console every 100 ticks (~5 minutes on MMO):
- **Controller Progress**: Current RCL, percentage to next level, and downgrade countdown timer.
- **Real-Time Rates & Trends**: Gathering and upgrade rates with dynamic trend indicators (`📈 UP`, `📉 DOWN`, `➖ Stable`).
- **Storage Breakdown**: Energy stored across Spawns, Extensions, Containers, Storage, Towers, and Dropped piles.
- **Unit Census**: Creep counts categorized by role.
- **Mule Route Fulfillment**: Real-time status and fulfillment counts (`[current/target]`) for all configured mule routes.
- **Spawner & Construction**: Active incubation progress and pending construction sites breakdown.
- **Defense & CPU Bucket**: Threat alerts, tower energy levels, and CPU bucket capacity.

---

## 🛠️ Configuration & Customization Guide

### 1. Setting Up Local & Remote Harvesting Routes
Configure local mining in `role.harvester.js` (`HARVESTERS`) and remote mining in `role.remoteharvester.js` (`REMOTE_HARVESTERS`):

```javascript
// role.harvester.js (Local static mining with dedicated dropoff containers)
const HARVESTERS = [
    {
        route: 'harvester_W9N9_1',
        room: 'W9N9',                         // Room where energy is harvested
        homeRoom: 'W9N9',                     // Base room with spawner/storage
        source: '884707717df4411',           // Mining target (Source ID)
        target: '6aa5a02e1964a00035340668',   // Dropoff container ID
        count: 4                              // Desired creep count
    }
];

// role.remoteharvester.js (Remote mining with 1:1 MOVE body)
const REMOTE_HARVESTERS = [
    {
        route: 'remoteHarvester_W9N8_1',
        room: 'W9N8',                         // Remote target room
        homeRoom: 'W9N9',                     // Base room to return to
        source: '6aa5969f8c67d000382ebeff',
        count: 2
    }
];
```

### 2. Setting Up Mule Logistics Routes (`role.mule.js`)
Open `role.mule.js` and add route entries to the `MULES` array:

```javascript
const MULES = [
    {
        route: 'updaterRoute',
        room: 'W9N9',
        source: '6aa55d271698000037e631d7', // Source container ID
        target: '6aa57a611964a00035340301', // Controller container ID
        count: 10                           // Number of assigned mules
    },
    {
        route: 'harvesterRoute1',
        room: 'W9N9',
        source: '6aa5a02e1964a00035340668', // Source 1 container ID
        target: '6aa55d271698000037e631d7', // Central storage/container ID
        count: 2
    }
];
```

### 3. Setting Up Road Routes in Builder (`role.builder.js`)
Open `role.builder.js` and configure route entries in the `ROADS` array for idle road maintenance:

```javascript
const ROADS = [
    {
        route: 'updaterRoad',
        room: 'W9N9',
        source: '6aa55d271698000037e631d7',
        target: '6aa57a611964a00035340301'
    }
];
```

### 4. Setting Up Idle Parking & Defense Flags
1. **Idle Parking Flag**: Place a flag named `Idle` (or `Idle_<RoomName>`, `Parking`) away from roads and spawns.
2. **Defense Rally Flag**: Place a flag named `defend` (or `Defend`, `defend_<RoomName>`) where military units should gather and hold formation during peacetime.
3. Alternatively, map room-specific parking flags in `manager.idle.js`:
   ```javascript
   roomFlags: {
       'W9N9': 'Idle'
   }
   ```

---

## ⚡ CPU & Performance Highlights
- **Path Caching**: All creep movement uses `reusePath: 15` or higher.
- **Euclidean Range Searches**: Uses `findClosestByRange` instead of CPU-heavy `findClosestByPath` where appropriate.
- **Global Helper Initialization**: Prototype and global helpers in `helper.source.js` load during initial script boot.
- **Pixel Generation**: Automatically generates pixels via `Game.cpu.generatePixel()` when `Game.cpu.bucket >= 10000`.
