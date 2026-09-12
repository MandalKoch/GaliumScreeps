/**
 * Upgrader Role
 * Upgrades the Room Controller to increase RCL.
 */
const managerIdle = require('manager.idle');

const roleUpgrader = {
    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.memory.upgrading && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.upgrading = false;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.upgrading && creep.store.getFreeCapacity() === 0) {
            creep.memory.upgrading = true;
            creep.say('⚡ upgrade');
        }

        if (creep.memory.upgrading) {
            if (creep.room.controller) {
                if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(creep.room.controller, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffffff' }
                    });
                }
            } else {
                managerIdle.park(creep);
            }
        } else {
            // Check storage / containers with energy first
            const energySource = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) =>
                    (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                    s.store[RESOURCE_ENERGY] > 50
            });

            if (energySource) {
                if (creep.withdraw(energySource, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(energySource, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffaa00' }
                    });
                }
            } else {
                // Otherwise harvest from active energy sources
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
    }
};

module.exports = roleUpgrader;
