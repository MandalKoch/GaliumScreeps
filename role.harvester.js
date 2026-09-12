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
        //target: '6aa5432a8c67d000382ebecb',
        target: '6aa5a02e1964a00035340668',
        count: 3
    },
    {
        route: 'harvester_W9N9_2',
        room: 'W9N9',
        homeRoom: 'W9N9',
        source: '1f8907717df7113',
        target: '6aa5a3ef104aaf003c9e62a6',
        //target: '6aa5432a8c67d000382ebecb',
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

function goDeliver(creep) {
    const routeConfig = getHarvesterRoute(creep);
    let target = Game.getObjectById(routeConfig.target);  
    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(target);
    }
}

function goHarvest(creep) {
    const routeConfig = getHarvesterRoute(creep);
    let source = Game.getObjectById(routeConfig.source);
    if (creep.harvest(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source);
    }   
}

module.exports = roleHarvester;
