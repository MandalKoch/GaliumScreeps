/**
 * Suicide / Recycle Manager
 * Gracefully retires creeps by emptying their carried energy into storage/spawns first
 * and then recycling or suiciding them at the nearest spawn.
 */
const managerSuicide = {
    /**
     * Mark a creep for retirement/suicide.
     * @param {Creep} creep
     */
    retire: function (creep) {
        if (creep) {
            creep.memory.retire = true;
        }
    },

    /**
     * Run the retirement workflow for a creep.
     * @param {Creep} creep
     * @returns {boolean} True if the creep was processed by the retirement manager, false otherwise.
     */
    run: function (creep) {
        if (!creep.memory.retire && !creep.memory.suicide) {
            return false;
        }

        // 1. If creep is carrying resources, return energy first
        if (creep.store.getUsedCapacity() > 0) {
            // Find structures that can accept energy
            const target = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (structure) => {
                    return (
                        (structure.structureType === STRUCTURE_SPAWN ||
                            structure.structureType === STRUCTURE_EXTENSION ||
                            structure.structureType === STRUCTURE_TOWER ||
                            structure.structureType === STRUCTURE_STORAGE ||
                            structure.structureType === STRUCTURE_CONTAINER) &&
                        structure.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    );
                }
            });

            if (target) {
                creep.say('⚡ dump');
                if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(target, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ff5555' }
                    });
                }
                return true;
            } else {
                // If all structures are full, drop energy so it's not lost upon death
                creep.drop(RESOURCE_ENERGY);
            }
        }

        // 2. Creep is empty: move to nearest spawn to recycle or suicide
        const spawn = creep.pos.findClosestByPath(FIND_MY_SPAWNS);
        if (spawn) {
            creep.say('💀 retire');
            if (creep.pos.isNearTo(spawn)) {
                // Recycle creep at spawn to recover energy into spawn
                const result = spawn.recycleCreep(creep);
                if (result !== OK) {
                    creep.suicide();
                }
            } else {
                creep.moveTo(spawn, {
                    reusePath: 15,
                    visualizePathStyle: { stroke: '#ff0000' }
                });
            }
            return true;
        }

        // Fallback: If no spawn found in room, suicide directly
        creep.say('💀 bye');
        creep.suicide();
        return true;
    }
};

module.exports = managerSuicide;
