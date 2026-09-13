/**
 * Remote Harvester Role
 * Gathers energy from remote room sources and transports it back to the home room.
 * Built with balanced WORK, CARRY, and MOVE parts for long-distance transit.
 */
const idle = require('manager.idle');

// Configurable remote harvesting routes: target remote room, home base room, source ID, and creep quota
const REMOTE_HARVESTERS = [
    {
        route: 'W2N1',
        room: 'W2N1',
        homeRoom: 'W2N2',
        count: 20
    },
    {
        route: 'W3N1',
        room: 'W3N1',
        homeRoom: 'W2N2',
        count: 20
    }
];

const roleRemoteHarvester = {
    config: REMOTE_HARVESTERS,

    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.delivering = false;
            creep.say('🔄 remote');
        }
        if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
            creep.memory.delivering = true;
            creep.say('⚡ return');
        }

        if (creep.memory.delivering) {
            goDeliver(creep);
        } else {
            goHarvest(creep);
        }
    }
};

/**
 * Looks up route configuration for the creep from REMOTE_HARVESTERS array or memory
 */
function getRemoteRoute(creep) {
    if (!creep.memory.route) return null;
    return REMOTE_HARVESTERS.find((h) => h.route === creep.memory.route) || null;
}

function goDeliver(creep) {
    const routeConfig = getRemoteRoute(creep);
    const homeRoom = (routeConfig && routeConfig.homeRoom) || creep.memory.homeRoom;

    // 1. If not in home room, navigate back to home room
    if (homeRoom && creep.room.name !== homeRoom) {
        creep.moveTo(new RoomPosition(25, 25, homeRoom), {
            reusePath: 15,
            visualizePathStyle: { stroke: '#ffffff' }
        });
        return;
    }

    // 2. Prioritize Spawns, Extensions, and Towers that need energy in home room
    let target = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            (s.structureType === STRUCTURE_SPAWN ||
                s.structureType === STRUCTURE_EXTENSION ||
                (s.structureType === STRUCTURE_TOWER && s.store.getFreeCapacity(RESOURCE_ENERGY) > 200)) &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });

    // 3. Fallback: Storage or Containers with free capacity
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
    const routeConfig = getRemoteRoute(creep);
    const targetRoom = (routeConfig && routeConfig.room) || creep.memory.room;

    // Move to target remote room if not already there
    if (targetRoom && creep.room.name !== targetRoom) {
        creep.moveTo(new RoomPosition(25, 25, targetRoom), {
            reusePath: 15,
            visualizePathStyle: { stroke: '#ffaa00' }
        });
        return;
    }

    // Find active source in current remote room
    let source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE) || creep.pos.findClosestByRange(FIND_SOURCES);
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

module.exports = roleRemoteHarvester;
