/**
 * Carrier / Hauler Role
 * Efficiently collects energy from dropped resources, tombstones, ruins, and containers,
 * and distributes it to Spawns, Extensions, Towers, and Storage.
 */
const managerIdle = require('manager.idle');

const roleCarrier = {
    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.delivering = false;
            creep.say('📦 fetch');
        }
        if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
            creep.memory.delivering = true;
            creep.say('⚡ deliver');
        }

        if (creep.memory.delivering) {
            // 1. Priority: Spawns and Extensions
            const primaryTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (
                        (structure.structureType === STRUCTURE_EXTENSION ||
                            structure.structureType === STRUCTURE_SPAWN) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    );
                }
            });

            if (primaryTarget) {
                if (creep.transfer(primaryTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(primaryTarget, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffffff' }
                    });
                }
                return;
            }

            // 2. Secondary: Towers needing energy
            const towerTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (
                        structure.structureType === STRUCTURE_TOWER &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 100
                    );
                }
            });

            if (towerTarget) {
                if (creep.transfer(towerTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(towerTarget, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffffff' }
                    });
                }
                return;
            }

            // 3. Storage
            const storage = creep.room.storage;
            if (storage && storage.store.getFreeCapacity(RESOURCE_ENERGY) > 0) {
                if (creep.transfer(storage, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(storage, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffffff' }
                    });
                }
                return;
            }

            // All destination structures are full - move away to idle flag
            managerIdle.park(creep);
        } else {
            // 1. Check for dropped energy resources on the ground
            const droppedEnergy = creep.pos.findClosestByPath(FIND_DROPPED_RESOURCES, {
                filter: (r) => r.resourceType === RESOURCE_ENERGY && r.amount >= 30
            });

            if (droppedEnergy) {
                if (creep.pickup(droppedEnergy) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(droppedEnergy, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffaa00' }
                    });
                }
                return;
            }

            // 2. Check for ruins or tombstones with energy
            const tombstone = creep.pos.findClosestByPath(FIND_TOMBSTONES, {
                filter: (t) => t.store[RESOURCE_ENERGY] > 0
            });
            if (tombstone) {
                if (creep.withdraw(tombstone, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(tombstone, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffaa00' }
                    });
                }
                return;
            }

            const ruin = creep.pos.findClosestByPath(FIND_RUINS, {
                filter: (r) => r.store[RESOURCE_ENERGY] > 0
            });
            if (ruin) {
                if (creep.withdraw(ruin, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(ruin, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffaa00' }
                    });
                }
                return;
            }

            // 3. Check for containers with energy
            const container = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) =>
                    s.structureType === STRUCTURE_CONTAINER &&
                    s.store[RESOURCE_ENERGY] >= 50
            });

            if (container) {
                if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(container, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffaa00' }
                    });
                }
                return;
            }

            // If creep has accumulated some energy and no more pickups available, deliver early
            if (creep.store[RESOURCE_ENERGY] > 0) {
                creep.memory.delivering = true;
                return;
            }

            // Nothing to collect, park
            managerIdle.park(creep);
        }
    }
};

module.exports = roleCarrier;
