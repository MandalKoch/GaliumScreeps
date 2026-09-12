/**
 * Harvester Role
 * Collects energy and delivers it to Spawns, Extensions, and Towers.
 */

const roleHarvester = {
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
        }
        else {
            goHarvest(creep);
        }
    }    
};

function goDeliver(creep) {
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
    }
}

function goHarvest (creep) {
    // Find active source
    const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    if (source) {
        if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source, {
                reusePath: 15,
                visualizePathStyle: { stroke: '#ffaa00' }
            });
        }
    }
}

module.exports = roleHarvester;
