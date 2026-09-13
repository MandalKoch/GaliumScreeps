const roleMule = require('role.mule');

/**
 * Room Statistics & Performance Manager
 * Tracks unit counts, resource levels, RCL progression, energy gathering rates, mule routes,
 * and spawner/construction status per tick, outputting formatted summaries to the console.
 */
const managerStats = {
    // 100 ticks is approximately 5 minutes on official servers (~3s/tick)
    INTERVAL_TICKS: 100,

    /**
     * Initializes or cleans up room statistics memory.
     * @param {Room} room
     */
    initMemory: function (room) {
        if (!Memory.stats) {
            Memory.stats = {};
        }
        if (!Memory.stats[room.name]) {
            Memory.stats[room.name] = {
                energyGathered: 0,
                energyUpgraded: 0,
                lastSourceEnergy: {},
                lastControllerProgress: room.controller ? room.controller.progress : 0,
                lastControllerLevel: room.controller ? room.controller.level : 0,
                lastUpgradeRate: 0,
                lastGatheringRate: 0,
                lastLogTime: Game.time
            };
        }
    },

    /**
     * Tracks energy harvested from sources and controller upgrade progression every tick.
     * @param {Room} room
     */
    trackGatheringAndUpgrades: function (room) {
        this.initMemory(room);
        const roomStats = Memory.stats[room.name];

        // 1. Track energy gathered from sources
        const sources = room.find(FIND_SOURCES);
        let totalGatherDelta = 0;
        for (const source of sources) {
            const prev = roomStats.lastSourceEnergy[source.id];
            if (prev !== undefined && source.energy < prev) {
                // Source energy decreased -> energy was gathered
                totalGatherDelta += (prev - source.energy);
            }
            // Update source energy snapshot
            roomStats.lastSourceEnergy[source.id] = source.energy;
        }
        roomStats.energyGathered = (roomStats.energyGathered || 0) + totalGatherDelta;

        // 2. Track controller upgrade progress
        if (room.controller && room.controller.my) {
            const currentProgress = room.controller.progress;
            const currentLevel = room.controller.level;
            const prevProgress = roomStats.lastControllerProgress !== undefined ? roomStats.lastControllerProgress : currentProgress;
            const prevLevel = roomStats.lastControllerLevel !== undefined ? roomStats.lastControllerLevel : currentLevel;

            let upgradeDelta = 0;
            if (currentLevel === prevLevel) {
                upgradeDelta = currentProgress - prevProgress;
            } else if (currentLevel > prevLevel) {
                // Leveled up: progress was reset
                upgradeDelta = currentProgress;
            }

            if (upgradeDelta > 0) {
                roomStats.energyUpgraded = (roomStats.energyUpgraded || 0) + upgradeDelta;
            }

            roomStats.lastControllerProgress = currentProgress;
            roomStats.lastControllerLevel = currentLevel;
        }
    },

    /**
     * Calculates total energy stored across all structures and ground in the room.
     * @param {Room} room
     * @returns {{ total: number, capacity: number, breakdown: object }}
     */
    calculateResources: function (room) {
        let spawnAndExtensionEnergy = 0;
        let spawnAndExtensionCap = 0;
        let containerEnergy = 0;
        let containerCap = 0;
        let storageEnergy = 0;
        let storageCap = 0;
        let towerEnergy = 0;
        let towerCap = 0;

        const structures = room.find(FIND_STRUCTURES);
        for (const s of structures) {
            if (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) {
                spawnAndExtensionEnergy += s.store ? s.store.getUsedCapacity(RESOURCE_ENERGY) : 0;
                spawnAndExtensionCap += s.store ? s.store.getCapacity(RESOURCE_ENERGY) : 0;
            } else if (s.structureType === STRUCTURE_CONTAINER) {
                containerEnergy += s.store.getUsedCapacity(RESOURCE_ENERGY);
                containerCap += s.store.getCapacity(RESOURCE_ENERGY);
            } else if (s.structureType === STRUCTURE_STORAGE) {
                storageEnergy += s.store.getUsedCapacity(RESOURCE_ENERGY);
                storageCap += s.store.getCapacity(RESOURCE_ENERGY);
            } else if (s.structureType === STRUCTURE_TOWER) {
                towerEnergy += s.store.getUsedCapacity(RESOURCE_ENERGY);
                towerCap += s.store.getCapacity(RESOURCE_ENERGY);
            }
        }

        // Dropped energy
        const dropped = room.find(FIND_DROPPED_RESOURCES, {
            filter: (r) => r.resourceType === RESOURCE_ENERGY
        });
        const droppedEnergy = dropped.reduce((sum, r) => sum + r.amount, 0);

        const totalEnergy = spawnAndExtensionEnergy + containerEnergy + storageEnergy + towerEnergy + droppedEnergy;
        const totalCapacity = spawnAndExtensionCap + containerCap + storageCap + towerCap;

        return {
            total: totalEnergy,
            capacity: totalCapacity,
            breakdown: {
                spawnsAndExt: `${spawnAndExtensionEnergy}/${spawnAndExtensionCap}`,
                containers: `${containerEnergy}/${containerCap}`,
                storage: storageCap > 0 ? `${storageEnergy}/${storageCap}` : 'N/A',
                towers: towerCap > 0 ? `${towerEnergy}/${towerCap}` : 'N/A',
                dropped: droppedEnergy
            }
        };
    },

    /**
     * Gathers creep count breakdown for the room.
     * @param {Room} room
     * @returns {{ total: number, roles: object, versions: object }}
     */
    getUnitCounts: function (room) {
        const creeps = room.find(FIND_MY_CREEPS);
        const roles = {};
        const versions = {};

        for (const creep of creeps) {
            const role = creep.memory.role || 'unassigned';
            roles[role] = (roles[role] || 0) + 1;

            const v = creep.memory.version ? `v${creep.memory.version}` : 'v1';
            versions[v] = (versions[v] || 0) + 1;
        }

        return {
            total: creeps.length,
            roles: roles,
            versions: versions
        };
    },

    /**
     * Gathers status of configured mule routes for the room.
     * @param {Room} room
     * @returns {string}
     */
    getMuleRouteStats: function (room) {
        const routes = (roleMule.config || []).filter((r) => r.room === room.name);
        if (routes.length === 0) return '';

        const mules = room.find(FIND_MY_CREEPS, {
            filter: (c) => c.memory.role === 'mule' && !c.memory.retire && !c.memory.suicide
        });

        const routeSummaries = routes.map((route) => {
            const targetCount = route.count !== undefined ? route.count : 1;
            const currentCount = mules.filter((c) => c.memory.route === route.route).length;
            const statusIcon = currentCount >= targetCount ? '✅' : '⏳';
            const name = route.route || `${route.source} -> ${route.target}`;
            return `${statusIcon} ${name} [${currentCount}/${targetCount}]`;
        });

        return routeSummaries.join(', ');
    },

   
    /**
     * Gathers status of room spawns and active spawning progress.
     * @param {Room} room
     * @returns {string}
     */
    getSpawnerStatus: function (room) {
        const spawns = room.find(FIND_MY_SPAWNS);
        if (spawns.length === 0) return 'No Spawns';

        return spawns.map((spawn) => {
            if (spawn.spawning) {
                const creep = Game.creeps[spawn.spawning.name];
                const role = creep ? (creep.memory.role || 'creep') : 'creep';
                const progress = spawn.spawning.needTime - spawn.spawning.remainingTime;
                return `${spawn.name}: Spawning ${role} (${progress}/${spawn.spawning.needTime}t)`;
            } else {

                const savingFor = spawn.memory.currentJob;
                const energy = room.energyAvailablenumber;
                const cap = spawn.store ? room.energyCapacityAvailable : 300;
                return `${spawn.name}: saving for ${savingFor} (${energy}/${cap}e)`;
            }
        }).join(' | ');
    },

    /**
     * Gathers active construction sites summary.
     * @param {Room} room
     * @returns {string}
     */
    getConstructionStatus: function (room) {
        const sites = room.find(FIND_CONSTRUCTION_SITES);
        if (sites.length === 0) return 'No active construction sites';

        const types = {};
        for (const site of sites) {
            types[site.structureType] = (types[site.structureType] || 0) + 1;
        }

        const breakdown = Object.keys(types)
            .map((t) => `${types[t]} ${t}`)
            .join(', ');

        return `${sites.length} sites (${breakdown})`;
    },

    /**
     * Gathers defense and threat status for the room.
     * @param {Room} room
     * @returns {string}
     */
    getDefenseStatus: function (room) {
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_TOWER
        });

        const towerEnergy = towers.reduce((sum, t) => sum + (t.store ? t.store.getUsedCapacity(RESOURCE_ENERGY) : 0), 0);
        const towerCap = towers.reduce((sum, t) => sum + (t.store ? t.store.getCapacity(RESOURCE_ENERGY) : 1000), 0);
        const towerInfo = towers.length > 0 ? `${towers.length} Towers (${towerEnergy}/${towerCap}e)` : '0 Towers';

        if (hostiles.length > 0) {
            return `⚠️ ALERT: ${hostiles.length} Hostiles detected! | ${towerInfo}`;
        }
        return `✅ Safe (0 Hostiles) | ${towerInfo}`;
    },

    /**
     * Outputs comprehensive room statistics to the console.
     * @param {Room} room
     */
    logStatistics: function (room) {
        const roomStats = Memory.stats[room.name];
        const elapsedTicks = Game.time - (roomStats.lastLogTime || (Game.time - this.INTERVAL_TICKS));
        const ticks = elapsedTicks > 0 ? elapsedTicks : this.INTERVAL_TICKS;

        const currentGatheringRate = Number((roomStats.energyGathered / ticks).toFixed(2));
        const currentUpgradeRate = Number(((roomStats.energyUpgraded || 0) / ticks).toFixed(2));

        // Determine trend indicators for upgrade rate (up, down, stable)
        let upgradeTrend = '➖ Stable';
        if (roomStats.lastUpgradeRate !== undefined) {
            if (currentUpgradeRate > roomStats.lastUpgradeRate) {
                const diff = (currentUpgradeRate - roomStats.lastUpgradeRate).toFixed(2);
                upgradeTrend = `📈 UP (+${diff} e/t)`;
            } else if (currentUpgradeRate < roomStats.lastUpgradeRate) {
                const diff = (roomStats.lastUpgradeRate - currentUpgradeRate).toFixed(2);
                upgradeTrend = `📉 DOWN (-${diff} e/t)`;
            }
        }

        // Determine trend indicators for gathering rate
        let gatherTrend = '➖ Stable';
        if (roomStats.lastGatheringRate !== undefined) {
            if (currentGatheringRate > roomStats.lastGatheringRate) {
                const diff = (currentGatheringRate - roomStats.lastGatheringRate).toFixed(2);
                gatherTrend = `📈 UP (+${diff} e/t)`;
            } else if (currentGatheringRate < roomStats.lastGatheringRate) {
                const diff = (roomStats.lastGatheringRate - currentGatheringRate).toFixed(2);
                gatherTrend = `📉 DOWN (-${diff} e/t)`;
            }
        }

        const unitStats = this.getUnitCounts(room);
        const resStats = this.calculateResources(room);
        const routeStats = this.getMuleRouteStats(room);
        const spawnerStats = this.getSpawnerStatus(room);
        const constructionStats = this.getConstructionStatus(room);
        const defenseStats = this.getDefenseStatus(room);

        // Format role breakdown string
        const roleStr = Object.keys(unitStats.roles)
            .map((role) => `${role}: ${unitStats.roles[role]}`)
            .join(', ') || 'None';
        
        // Controller Info
        let rclInfo = 'No Controller';
        if (room.controller && room.controller.my) {
            const pct = room.controller.progressTotal
                ? ((room.controller.progress / room.controller.progressTotal) * 100).toFixed(1)
                : 100;
            rclInfo = `RCL ${room.controller.level} (${pct}% to next | Downgrade: ${room.controller.ticksToDowngrade}t)`;
        }

        const cpuUsed = Game.cpu.getUsed ? Game.cpu.getUsed().toFixed(2) : 'N/A';
        const cpuLimit = Game.cpu.limit || 'N/A';
        const cpuBucket = Game.cpu.bucket !== undefined ? Game.cpu.bucket : 'N/A';

        // Print header & structured report
        console.log(`==================== [ROOM STATS: ${room.name} | Tick ${Game.time}] ====================`);
        console.log(`👑 Controller:     ${rclInfo}`);
        console.log(`📈 Upgrade Rate:   ${currentUpgradeRate} e/tick [${upgradeTrend}] (${roomStats.energyUpgraded || 0} upgraded over ${ticks}t)`);
        console.log(`⛏️  Gathering Rate: ${currentGatheringRate} e/tick [${gatherTrend}] (${roomStats.energyGathered} gathered over ${ticks}t)`);
        console.log(`⚡ Stored Energy:  ${resStats.total} / ${resStats.capacity} (Spawns/Ext: ${resStats.breakdown.spawnsAndExt}, Containers: ${resStats.breakdown.containers}, Storage: ${resStats.breakdown.storage}, Dropped: ${resStats.breakdown.dropped})`);
        console.log(`👥 Units (${unitStats.total}):      ${roleStr}`);
        if (routeStats) {
            console.log(`🚚 Mule Routes:    ${routeStats}`);
        }
        console.log(`🏭 Spawners:       ${spawnerStats}`);
        console.log(`🔨 Construction:   ${constructionStats}`);
        console.log(`🛡️  Defense:        ${defenseStats}`);
        console.log(`💻 CPU & Bucket:   Used ${cpuUsed} / ${cpuLimit} | Bucket: ${cpuBucket}`);
        console.log(`================================================================================`);

        // Save rates for trend comparison and reset counters for next window
        roomStats.lastUpgradeRate = currentUpgradeRate;
        roomStats.lastGatheringRate = currentGatheringRate;
        roomStats.energyGathered = 0;
        roomStats.energyUpgraded = 0;
        roomStats.lastLogTime = Game.time;
    },

    /**
     * Main manager execution called every tick.
     * @param {Room} room
     */
    run: function (room) {
        if (!room) return;

        // 1. Accumulate gathering and upgrade stats every tick
        this.trackGatheringAndUpgrades(room);

        // 2. Output statistics every INTERVAL_TICKS (~5 minutes)
        if (Game.time % this.INTERVAL_TICKS === 0) {
            this.logStatistics(room);
        }
    }
};

module.exports = managerStats;