/**
 * Harvester Role
 * Gathers energy from configured sources and delivers it to designated dropoff containers,
 * falling back to adjacent containers, spawns, extensions, towers, storage, or upgrading.
 */
const idle = require('./manager.idle');

// Define harvester assignments: room, homeRoom, source ID (mining target), target ID (dropoff container), and count
const HARVESTERS = [
    {
        route: 'harvester_W2N2_1_',
        room: 'W2N2',
        sourcex: 9,
        sourcey: 23,
        targetx: 8,
        targety: 25,
        count: 3
    },
    {
        route: 'harvester_W2N2_2_',
        room: 'W2N2',
        sourcex: 4,
        sourcey: 21,
        targetx: 6,
        targety: 21,
        count: 3
    }
];

const roleHarvester = {
    config: HARVESTERS,

    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.delivering = false;
            //creep.say('🔄 harvest');
        }
        if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
            creep.memory.delivering = true;
            //creep.say('⚡ deliver');
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

function getSpawn(creep) {
    const spawnTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            (s.structureType === STRUCTURE_SPAWN ||
                s.structureType === STRUCTURE_EXTENSION) &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    return spawnTarget;
}

function goDeliver(creep) {
    const routeConfig = getHarvesterRoute(creep);
    if (!routeConfig){
        let spawnTarget = getSpawn(creep);
        if (creep.transfer(spawnTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(spawnTarget);
        }
        return;
    }    
    let targets = creep.room.lookForAt(LOOK_STRUCTURES, routeConfig.targetx, routeConfig.targety);
    let target = targets[0];
    if (target) {
        let result = null;
        if (target.hits < target.hitsMax * 0.8)
        {
          result = creep.repair(target);
        }
        else
        {
            result = creep.transfer(target, RESOURCE_ENERGY);
        }
        switch (result) {
            case ERR_NOT_IN_RANGE:
                creep.moveTo(target);
                break;
            default:
                break;
        }
    }
    else {
        let spawnTarget = getSpawn(creep);
        if(spawnTarget.store.getFreeCapacity(RESOURCE_ENERGY) < 0){
            idle.park(creep);
            return;
        }
        let resultFallback = creep.transfer(spawnTarget, RESOURCE_ENERGY);
        switch (resultFallback) {
            case ERR_NOT_IN_RANGE:
                creep.moveTo(spawnTarget);
                break;
            default:
                idle.park(creep);
                break;
        }
    }
}

function goHarvest(creep) {
    const routeConfig = getHarvesterRoute(creep);
    if (routeConfig) {
        let sources = creep.room.lookForAt(LOOK_SOURCES, routeConfig.sourcex, routeConfig.sourcey);
        let source = sources[0];
        if (creep.harvest(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(source);
        }   
    }
    else 
    {
        let harvestTarget = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
        if (harvestTarget) {
            if (creep.harvest(harvestTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(harvestTarget);
            }
        }
    }
}

module.exports = roleHarvester;
