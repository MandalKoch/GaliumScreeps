/**
 * Harvester Role
 * Gathers energy from configured sources and delivers it to designated dropoff containers,
 * falling back to adjacent containers, spawns, extensions, towers, storage, or upgrading.
 */
const idle = require('./manager.idle');

// Define harvester assignments: room, homeRoom, source ID (mining target), target ID (dropoff container), and count
const HARVESTERS = [
    {
        route: 'harvester_W9N9_1',
        room: 'W9N9',
        homeRoom: 'W9N9',
        source: '884707717df4411',
        target: '6aa5432a8c67d000382ebecb',
        // target: '6aa5a02e1964a00035340668',
        count: 4
    },
    {
        route: 'harvester_W9N9_2',
        room: 'W9N9',
        homeRoom: 'W9N9',
        source: '1f8907717df7113',
        //target: '6aa5a3ef104aaf003c9e62a6',
        target: '6aa5432a8c67d000382ebecb',
        count: 4
    }
];

const roleHarvester = {
    config: HARVESTERS,

    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.delivering = false;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
            creep.memory.delivering = true;
            creep.say('⚡ deliver');
        }

        if (creep.memory.delivering) {
            goDeliver(creep);
        } else {
            goHarvest(creep);
        }
    }
};

/**
 * Looks up route configuration for the creep from HARVESTERS array or memory
 */
function getHarvesterRoute(creep) {
    if (!creep.memory.route) return null;
    return HARVESTERS.find((h) => h.route === creep.memory.route) || null;
}

/**
 * Resolves destination dropoff structure from ID
 */
function getTargetObject(creep, targetDef) {
    if (!targetDef) return null;
    if (typeof targetDef === 'string') {
        return Game.getObjectById(targetDef.trim());
    }
    return targetDef;
}

/**
 * Resolves energy source object from ID
 */
function getSourceObject(creep, sourceDef) {
    if (!sourceDef) return null;
    if (typeof sourceDef === 'string') {
        return Game.getObjectById(sourceDef.trim());
    }
    return sourceDef;
}

function goDeliver(creep) {
    const routeConfig = getHarvesterRoute(creep);
    const targetDef = (routeConfig && (routeConfig.target || routeConfig.container || routeConfig.dropoff)) ||
                      creep.memory.target || creep.memory.container;
    const homeRoom = (routeConfig && routeConfig.homeRoom) || creep.memory.homeRoom || creep.room.name;

    // 1. Configured dropoff container: Deliver to designated target if specified and has capacity
    if (targetDef) {
        const dropoff = getTargetObject(creep, targetDef);
        if (dropoff && dropoff.store && dropoff.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
            if (creep.transfer(dropoff, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(dropoff, {
                    reusePath: 15,
                    visualizePathStyle: { stroke: '#ffffff' }
                });
            }
            return;
        }
    }

    // 2. Static mining fallback: Check for nearby container (range <= 2) in current room
    const nearbyContainer = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            s.structureType === STRUCTURE_CONTAINER &&
            creep.pos.inRangeTo(s, 2) &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });

    if (nearbyContainer) {
        if (creep.transfer(nearbyContainer, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(nearbyContainer, {
                reusePath: 15,
                visualizePathStyle: { stroke: '#ffffff' }
            });
        }
        return;
    }

    // 3. If in a remote room and no nearby container, travel back to home room
    if (homeRoom && creep.room.name !== homeRoom) {
        creep.moveTo(new RoomPosition(25, 25, homeRoom), {
            reusePath: 15,
            visualizePathStyle: { stroke: '#ffffff' }
        });
        return;
    }

    // 4. Prioritize Spawns, Extensions, and Towers that need energy
    let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            (s.structureType === STRUCTURE_SPAWN ||
                s.structureType === STRUCTURE_EXTENSION ||
                (s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 200)) &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });

    // 5. Fallback: Storage or Containers with free capacity
    if (!target) {
        target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
            filter: (s) =>
                (s.structureType === STRUCTURE_STORAGE ||
                    s.structureType === STRUCTURE_CONTAINER) &&
                s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
    }

    // Deliver to the selected target
    if (target) {
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                reusePath: 15,
                visualizePathStyle: { stroke: '#ffffff' }
            });
        }
    } else {
        // Fallback: Upgrade controller if all energy sinks are full
        if (creep.room.controller && creep.room.controller.my) {
            if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                creep.moveTo(creep.room.controller, {
                    reusePath: 15,
                    visualizePathStyle: { stroke: '#ffffff' }
                });
            }
        } else {
            idle.park(creep);
        }
    }
}

function goHarvest(creep) {
    const routeConfig = getHarvesterRoute(creep);
    const targetRoom = (routeConfig && routeConfig.room) || creep.memory.room || creep.room.name;
    const sourceDef = (routeConfig && routeConfig.source) || creep.memory.source;

    // 1. Move to target room if not already there
    if (targetRoom && creep.room.name !== targetRoom) {
        creep.moveTo(new RoomPosition(25, 25, targetRoom), {
            reusePath: 15,
            visualizePathStyle: { stroke: '#ffaa00' }
        });
        return;
    }

    // 2. Resolve source object by ID if configured
    let source = getSourceObject(creep, sourceDef);

    // 3. Fallback: Find active source in current room
    if (!source) {
        source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE) || creep.pos.findClosestByRange(FIND_SOURCES);
    }

    if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, {
                reusePath: 15,
                visualizePathStyle: { stroke: '#ffaa00' }
            });
        }
    } else {
        idle.park(creep);
    }
}

module.exports = roleHarvester;
