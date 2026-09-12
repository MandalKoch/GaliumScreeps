/**
 * Harvester Role
 * Collects energy and delivers it to Spawns, Extensions, and Towers.
 */
const managerIdle = require('manager.idle');

const roleHarvesterW2N1 = {
    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.delivering = false;
            creep.memory.targetRoom = 'W2N1';
            creep.say('🔄 harvest');
        }
        if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
            creep.memory.delivering = true;
            creep.memory.targetRoom = 'W2N2';
            creep.say('⚡ deliver');
        }
        if (creep.memory.targetRoom && creep.memory.targetRoom !== creep.room.name) {
            const exitDir = creep.room.findExitTo(creep.memory.targetRoom);
            if (exitDir > 0) {
                const exit = creep.pos.findClosestByRange(exitDir);
                if (exit) {
                    creep.moveTo(exit, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffffff' }
                    });
                }
            } else {
                creep.moveTo(new RoomPosition(25, 25, creep.memory.targetRoom), {
                    reusePath: 15,
                    visualizePathStyle: { stroke: '#ffffff' }
                });
            }
            return;
        }
        if (creep.memory.delivering) {
            // 1. If there is a container adjacent or close to the harvester/source (static mining setup), fill it first!
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

            // 2. Priority: Spawns and Extensions -> Towers needing energy -> Storage/Containers
            const targets = creep.room.find(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (
                        (structure.structureType === STRUCTURE_EXTENSION ||
                            structure.structureType === STRUCTURE_SPAWN ||
                            structure.structureType === STRUCTURE_TOWER) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    );
                }
            });

            if (targets.length > 0) {
                const target = creep.pos.findClosestByPath(targets);
                if (target) {
                    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, {
                            reusePath: 15,
                            visualizePathStyle: { stroke: '#ffffff' }
                        });
                    }
                }
            } else {
                // Secondary fallback: storage or containers if all primary structures are full
                const storage = creep.room.storage;
                if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                    if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(storage, {
                            reusePath: 15,
                            visualizePathStyle: { stroke: '#ffffff' }
                        });
                    }
                } else {
                    const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                        filter: (s) =>
                            s.structureType === STRUCTURE_CONTAINER &&
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    });

                    if (container) {
                        if (creep.transfer(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                            creep.moveTo(container, {
                                reusePath: 15,
                                visualizePathStyle: { stroke: '#ffffff' }
                            });
                        }
                    } else {
                        // Spawner, extensions, towers, containers are all full - move away to idle flag
                        managerIdle.park(creep);
                    }
                }
            }
        } else {
            // Find active source
            const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
            if (source) {
                if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(source, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffaa00' }
                    });
                }
            } else {
                managerIdle.park(creep);
            }
        }
    }
};

module.exports = roleHarvesterW2N1;
