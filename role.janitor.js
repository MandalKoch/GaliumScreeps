/**
 * Janitor Role
 * Cleans up dropped resources, scavenges tombstones and ruins,
 * performs structural repairs across the room, automatically plans
 * container construction sites, and deposits collected resources
 * into available containers and storage.
 */
const idle = require('./manager.idle');
require('./helper.source');

// Optional room-specific janitor configurations
const JANITORS = [
    // Example: { room: 'W9N9', count: 1 }
    {room: 'W2N2', count: 10}
];

// Defined container locations: specify room and coordinates (x, y) or target ID
const CONTAINERS = [
    // Example: { room: 'W2N2', x: 20, y: 25 },
    // Example: { room: 'W2N2', target: '399f0774a5bab03' },
    // Example: { room: 'W9N9', x: 15, y: 30 }
];

const roleJanitor = {
    config: JANITORS,
    containers: CONTAINERS,
    planContainers: planContainers,

    /** @param {Creep} creep **/
    run: function (creep) {
        // Periodically plan container construction sites
        if (Game.time % 10 === 0) {
            planContainers(creep);
        }

        // State transition: empty store -> gather/clean mode
        if (creep.memory.delivering && creep.store.getUsedCapacity() === 0) {
            creep.memory.delivering = false;
            creep.say('🧹 clean');
        }
        // State transition: full store -> deliver/repair mode
        if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
            creep.memory.delivering = true;
            creep.say('⚡ work');
        }

        if (creep.memory.delivering) {
            goWork(creep);
        } else {
            goClean(creep);
        }
    }
};

/**
 * Checks if a room tile is buildable (walkable plain/swamp, no non-road structures, no construction sites)
 */
function isTileBuildable(room, x, y) {
    if (x < 1 || x > 48 || y < 1 || y > 48) return false;
    const terrain = room.getTerrain ? room.getTerrain().get(x, y) : (typeof Game.map.getTerrainAt === 'function' ? Game.map.getTerrainAt(x, y, room.name) : 0);
    if (terrain === TERRAIN_MASK_WALL || terrain === 'wall') return false;

    const structures = room.lookForAt(LOOK_STRUCTURES, x, y);
    const isBlocked = structures.some(
        (s) => s.structureType !== STRUCTURE_ROAD && s.structureType !== STRUCTURE_RAMPART
    );
    if (isBlocked) return false;

    const sites = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
    if (sites.length > 0) return false;

    return true;
}

/**
 * Determines the optimal container placement position adjacent (range 1) to an energy source or mineral
 */
function getOptimalSourceContainerPos(room, source, spawn) {
    const candidatePositions = [];
    for (let dx = -1; dx <= 1; dx++) {
        for (let dy = -1; dy <= 1; dy++) {
            if (dx === 0 && dy === 0) continue;
            const x = source.pos.x + dx;
            const y = source.pos.y + dy;
            if (isTileBuildable(room, x, y)) {
                candidatePositions.push(new RoomPosition(x, y, room.name));
            }
        }
    }
    if (candidatePositions.length === 0) return null;

    const targetPos = spawn ? spawn.pos : (room.controller ? room.controller.pos : null);
    if (targetPos) {
        const path = source.pos.findPathTo(targetPos, { ignoreCreeps: true });
        if (path && path.length > 0) {
            const pathStep = candidatePositions.find((pos) => pos.x === path[0].x && pos.y === path[0].y);
            if (pathStep) return pathStep;
        }
        return targetPos.findClosestByRange(candidatePositions);
    }

    return candidatePositions[0];
}

/**
 * Determines the optimal container placement position near the room controller (range 2-3) for upgraders
 */
function getOptimalControllerContainerPos(room, controller, spawn) {
    const candidatePositions = [];
    for (let dx = -3; dx <= 3; dx++) {
        for (let dy = -3; dy <= 3; dy++) {
            const range = Math.max(Math.abs(dx), Math.abs(dy));
            if (range < 2 || range > 3) continue;
            const x = controller.pos.x + dx;
            const y = controller.pos.y + dy;
            if (isTileBuildable(room, x, y)) {
                candidatePositions.push(new RoomPosition(x, y, room.name));
            }
        }
    }
    if (candidatePositions.length === 0) return null;

    const targetPos = spawn ? spawn.pos : (room.find(FIND_SOURCES)[0] ? room.find(FIND_SOURCES)[0].pos : null);
    if (targetPos) {
        const path = controller.pos.findPathTo(targetPos, { ignoreCreeps: true });
        if (path && path.length > 1) {
            for (let i = 1; i < Math.min(path.length, 3); i++) {
                const stepPos = candidatePositions.find((pos) => pos.x === path[i].x && pos.y === path[i].y);
                if (stepPos) return stepPos;
            }
        }
        return targetPos.findClosestByRange(candidatePositions);
    }

    return candidatePositions[0];
}

/**
 * Plans and places container construction sites based on configured coordinates (CONTAINERS),
 * room flags, and automatic discovery for sources, controllers, and minerals.
 * @param {Creep|Room|string} roomOrCreep
 */
function planContainers(roomOrCreep) {
    const room = roomOrCreep ? (roomOrCreep.room || (roomOrCreep.name && Game.rooms[roomOrCreep.name] ? roomOrCreep : (typeof roomOrCreep === 'string' ? Game.rooms[roomOrCreep] : null))) : null;
    if (!room) return;
    if (room._containersPlanned === Game.time) return;
    room._containersPlanned = Game.time;

    const existingContainers = room.find(FIND_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_CONTAINER
    });
    const existingContainerSites = room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: (s) => s.structureType === STRUCTURE_CONTAINER
    });
    let containerCount = existingContainers.length + existingContainerSites.length;
    if (containerCount >= 5) return;

    const spawn = room.find(FIND_MY_SPAWNS)[0] || (roomOrCreep.pos ? roomOrCreep.pos.findClosestByRange(FIND_MY_SPAWNS) : null);

    // 1. Defined / Configured Containers from CONTAINERS array
    const roomConfigs = CONTAINERS.filter((c) => !c.room || c.room === room.name);
    for (const config of roomConfigs) {
        if (containerCount >= 5) break;

        let posX = null;
        let posY = null;

        if (config.x !== undefined && config.y !== undefined) {
            posX = config.x;
            posY = config.y;
        } else if (config.pos && config.pos.x !== undefined && config.pos.y !== undefined) {
            posX = config.pos.x;
            posY = config.pos.y;
        } else if (config.target || config.source) {
            const targetObj = Game.getObjectById(config.target || config.source);
            if (targetObj && targetObj.pos) {
                const range = config.range || 1;
                if (range === 1) {
                    const optimalPos = getOptimalSourceContainerPos(room, targetObj, spawn);
                    if (optimalPos) {
                        posX = optimalPos.x;
                        posY = optimalPos.y;
                    }
                } else {
                    const optimalPos = getOptimalControllerContainerPos(room, targetObj, spawn);
                    if (optimalPos) {
                        posX = optimalPos.x;
                        posY = optimalPos.y;
                    }
                }
            }
        }

        if (posX !== null && posY !== null) {
            const hasContainer = room.lookForAt(LOOK_STRUCTURES, posX, posY).some(
                (s) => s.structureType === STRUCTURE_CONTAINER
            );
            const hasSite = room.lookForAt(LOOK_CONSTRUCTION_SITES, posX, posY).some(
                (s) => s.structureType === STRUCTURE_CONTAINER
            );

            if (!hasContainer && !hasSite && isTileBuildable(room, posX, posY)) {
                const res = room.createConstructionSite(posX, posY, STRUCTURE_CONTAINER);
                if (res === OK) {
                    containerCount++;
                }
            }
        }
    }

    // 2. Defined Containers via in-room Flags (e.g. named 'Container', 'Container_1', etc.)
    const containerFlags = room.find(FIND_FLAGS, {
        filter: (f) => f.name && f.name.toLowerCase().startsWith('container')
    });
    for (const flag of containerFlags) {
        if (containerCount >= 5) break;

        const hasContainer = flag.pos.lookFor(LOOK_STRUCTURES).some(
            (s) => s.structureType === STRUCTURE_CONTAINER
        );
        const hasSite = flag.pos.lookFor(LOOK_CONSTRUCTION_SITES).some(
            (s) => s.structureType === STRUCTURE_CONTAINER
        );

        if (!hasContainer && !hasSite && isTileBuildable(room, flag.pos.x, flag.pos.y)) {
            const res = room.createConstructionSite(flag.pos.x, flag.pos.y, STRUCTURE_CONTAINER);
            if (res === OK) {
                containerCount++;
            }
        }
    }

    // 3. Fallback: Automatic planning for sources, controller, and minerals if no explicit config defined for this room
    if (roomConfigs.length === 0) {
        // 3a. Plan containers at Energy Sources
        const sources = room.find(FIND_SOURCES);
        for (const source of sources) {
            if (containerCount >= 5) break;

            const hasContainer = source.pos.findInRange(FIND_STRUCTURES, 1, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER
            }).length > 0;
            const hasSite = source.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 1, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER
            }).length > 0;

            if (!hasContainer && !hasSite) {
                const targetPos = getOptimalSourceContainerPos(room, source, spawn);
                if (targetPos) {
                    const res = room.createConstructionSite(targetPos.x, targetPos.y, STRUCTURE_CONTAINER);
                    if (res === OK) {
                        containerCount++;
                    }
                }
            }
        }

        // 3b. Plan container near Controller for upgraders
        const controller = room.controller;
        if (controller && (controller.my || !controller.owner) && containerCount < 5) {
            const hasContainer = controller.pos.findInRange(FIND_STRUCTURES, 4, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER
            }).length > 0;
            const hasSite = controller.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 4, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER
            }).length > 0;

            if (!hasContainer && !hasSite) {
                const targetPos = getOptimalControllerContainerPos(room, controller, spawn);
                if (targetPos) {
                    const res = room.createConstructionSite(targetPos.x, targetPos.y, STRUCTURE_CONTAINER);
                    if (res === OK) {
                        containerCount++;
                    }
                }
            }
        }

        // 3c. Plan container at Mineral if extractor exists and capacity allows
        if (containerCount < 5) {
            const minerals = room.find(FIND_MINERALS);
            for (const mineral of minerals) {
                if (containerCount >= 5) break;

                const hasExtractor = mineral.pos.lookFor(LOOK_STRUCTURES).some((s) => s.structureType === STRUCTURE_EXTRACTOR);
                if (!hasExtractor) continue;

                const hasContainer = mineral.pos.findInRange(FIND_STRUCTURES, 1, {
                    filter: (s) => s.structureType === STRUCTURE_CONTAINER
                }).length > 0;
                const hasSite = mineral.pos.findInRange(FIND_MY_CONSTRUCTION_SITES, 1, {
                    filter: (s) => s.structureType === STRUCTURE_CONTAINER
                }).length > 0;

                if (!hasContainer && !hasSite) {
                    const targetPos = getOptimalSourceContainerPos(room, mineral, spawn);
                    if (targetPos) {
                        const res = room.createConstructionSite(targetPos.x, targetPos.y, STRUCTURE_CONTAINER);
                        if (res === OK) {
                            containerCount++;
                        }
                    }
                }
            }
        }
    }
}

/**
 * Searches for dropped resources, tombstones, or ruins with resources.
 * If nothing to clean up on the ground and repairs are needed, withdraws from a container.
 */
function goClean(creep) {
    // 1. Priority 1: Pick up dropped resources (energy or minerals)
    const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES);
    if (droppedResources.length > 0) {
        // Pick the closest dropped resource (or largest if nearby)
        const target = creep.pos.findClosestByRange(droppedResources);
        if (target) {
            if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    reusePath: 15,
                    visualizePathStyle: { stroke: '#ffff00' }
                });
            }
            return;
        }
    }

    // 2. Priority 2: Scavenge tombstones with resources
    const tombstones = creep.room.find(FIND_TOMBSTONES, {
        filter: (t) => t.store && t.store.getUsedCapacity() > 0
    });
    if (tombstones.length > 0) {
        const target = creep.pos.findClosestByRange(tombstones);
        if (target) {
            for (const resourceType in target.store) {
                if (target.store[resourceType] > 0) {
                    if (creep.withdraw(target, resourceType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, {
                            reusePath: 15,
                            visualizePathStyle: { stroke: '#ffaa00' }
                        });
                    }
                    return;
                }
            }
        }
    }

    // 3. Priority 3: Scavenge ruins with resources
    const ruins = creep.room.find(FIND_RUINS, {
        filter: (r) => r.store && r.store.getUsedCapacity() > 0
    });
    if (ruins.length > 0) {
        const target = creep.pos.findClosestByRange(ruins);
        if (target) {
            for (const resourceType in target.store) {
                if (target.store[resourceType] > 0) {
                    if (creep.withdraw(target, resourceType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, {
                            reusePath: 15,
                            visualizePathStyle: { stroke: '#ffaa00' }
                        });
                    }
                    return;
                }
            }
        }
    }

    // 4. If creep is already carrying some resources, switch to work/deliver mode
    if (creep.store.getUsedCapacity() > 0) {
        creep.memory.delivering = true;
        creep.say('⚡ work');
        goWork(creep);
        return;
    }

    // 5. If ground is clean, check if there are damaged structures needing repair
    const damagedStructure = findRepairTarget(creep);
    if (damagedStructure) {
        // Withdraw energy from container to perform repairs
        const container = findNextContainerWithEnergy(creep, 50);
        if (container) {
            if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(container, {
                    reusePath: 15,
                    visualizePathStyle: { stroke: '#ffaa00' }
                });
            }
            return;
        }
    }

    // 6. If no repairs, check for container construction sites to build
    const containerSites = creep.room.find(FIND_MY_CONSTRUCTION_SITES, {
        filter: (s) => s.structureType === STRUCTURE_CONTAINER
    });
    if (containerSites.length > 0) {
        const container = findNextContainerWithEnergy(creep, 50);
        if (container) {
            if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(container, {
                    reusePath: 15,
                    visualizePathStyle: { stroke: '#ffaa00' }
                });
            }
            return;
        }
    }

    // 7. Nothing to clean or repair -> park
    idle.park(creep);
}

/**
 * Handles repairing damaged structures or delivering collected resources into containers.
 */
function goWork(creep) {
    // 1. If carrying energy, check for structures that need repair
    if (creep.store[RESOURCE_ENERGY] > 0) {
        const repairTarget = findRepairTarget(creep);
        if (repairTarget) {
            if (creep.repair(repairTarget) === ERR_NOT_IN_RANGE) {
                creep.moveTo(repairTarget, {
                    reusePath: 15,
                    visualizePathStyle: { stroke: '#00ffaa' }
                });
            }
            return;
        }
    }

    // 2. Deposit cargo into containers with free capacity
    const containers = creep.room.find(FIND_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_CONTAINER && s.store.getFreeCapacity() > 0
    });

    let target = null;
    if (containers.length > 0) {
        // Prefer container with the most free capacity, or closest
        target = creep.pos.findClosestByRange(containers);
    } else {
        // Fallback to storage
        const storage = creep.room.storage;
        if (storage && storage.store.getFreeCapacity() > 0) {
            target = storage;
        } else if (creep.store[RESOURCE_ENERGY] > 0) {
            // Fallback for energy: Spawns or Extensions
            target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                filter: (s) =>
                    (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION || s.structureType === STRUCTURE_TOWER) &&
                    s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
            });
        }
    }

    if (target) {
        for (const resourceType in creep.store) {
            if (creep.store[resourceType] > 0) {
                if (creep.transfer(target, resourceType) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffffff' }
                    });
                }
                return;
            }
        }
    } else {
        // Fallback: If carrying energy and construction sites exist (especially containers), build them
        if (creep.store[RESOURCE_ENERGY] > 0) {
            const containerSite = creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES, {
                filter: (s) => s.structureType === STRUCTURE_CONTAINER
            }) || creep.pos.findClosestByRange(FIND_MY_CONSTRUCTION_SITES);

            if (containerSite) {
                if (creep.build(containerSite) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(containerSite, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffffff' }
                    });
                }
                return;
            }
        }
    }
    
    // 3. If no delivery targets, repairs, or construction sites available, park
    idle.park(creep);
}

/**
 * Finds damaged structures requiring repair.
 * Prioritizes decaying roads & containers, then other structures, and fortified ramparts/walls.
 * @param {Creep} creep
 * @returns {Structure|null}
 */
function findRepairTarget(creep) {
    // Priority 1: Decaying roads (< 80% hits) and damaged containers (< 90% hits)
    const criticalInfra = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            (s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax * 0.5) ||
            (s.structureType === STRUCTURE_CONTAINER && s.hits < s.hitsMax * 0.9)
    });
    if (criticalInfra) return criticalInfra;

    // Priority 2: Other damaged structures excluding walls and ramparts
    const damagedStructures = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            s.structureType !== STRUCTURE_WALL &&
            s.structureType !== STRUCTURE_RAMPART &&
            s.hits < s.hitsMax
    });
    if (damagedStructures) return damagedStructures;

    // Priority 3: Fortified ramparts & walls below maintenance thresholds (e.g. 50k hits)
    const fortifiedStructures = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            (s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL) &&
            s.hits < 50000 &&
            s.hits < s.hitsMax
    });
    if (fortifiedStructures) return fortifiedStructures;

    return null;
}

module.exports = roleJanitor;
