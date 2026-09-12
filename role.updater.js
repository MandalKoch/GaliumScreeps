/**
 * Harvester Role
 * Collects energy and delivers it to Spawns, Extensions, and Towers.
 */
require('helper.source');

const roleHarvester = {
    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.delivering = false;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
            creep.memory.delivering = true;
            creep.say('⚡ updating');
        }

        if (creep.memory.delivering) {
            goDeliver(creep);
        }
        else {
            goGather(creep);
        }
      
    }    
};

function goDeliver(creep) {
    // 1. If there is a container adjacent or close to the harvester/source (static mining setup), fill it first!
    if(creep.upgradeController(creep.room.controller) == ERR_NOT_IN_RANGE) {
        creep.moveTo(creep.room.controller);
    }
}

function goGather(creep) {
    // 1. Try to withdraw from a container with energy
    const container = findNextContainerWithEnergy(creep, 50);
    if (container) {
        if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(container, {
                reusePath: 15,
                visualizePathStyle: {stroke: '#ffaa00'}
            });
        }
    } 
    //else {
    //   // Find active source
    //   const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
    //   if (source) {
    //       if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
    //           creep.moveTo(source, {
    //               reusePath: 15,
    //               visualizePathStyle: {stroke: '#ffaa00'}
    //           });
    //       }
    //   }
    //}
}

module.exports = roleHarvester;
