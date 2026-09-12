/**
 * Mule Role
 * Collects energy from designated sources/containers and delivers it to targets.
 */

// Define dedicated mule logistics routes: room, source ID/structure, target ID/structure, and quota

const idle = require('manager.idle');
const MULES = [
    {
        route: 'updaterRoute',
        room: 'W9N9',
        source: '6aa55d271698000037e631d7',
        target: '6aa57a611964a00035340301',
        count: 10 
    },
    {
        route: 'spawnfiller1',
        room: 'W9N9',
        source: '6aa5a02e1964a00035340668',
        target: '6aa5432a8c67d000382ebecb',
        count: 1
    },
    {
        route: 'spawnfiller2',
        room: 'W9N9',
        source: '6aa5a3ef104aaf003c9e62a6',
        target: '6aa5432a8c67d000382ebecb',
        count: 1
    },
    {
        route: 'harvesterRoute1',
        room: 'W9N9',
        source: '6aa5a02e1964a00035340668',
        target: '6aa55d271698000037e631d7',
        count: 5
    },
    {
        route: 'harvesterRoute2',
        room: 'W9N9',
        source: '6aa5a3ef104aaf003c9e62a6',
        target: '6aa55d271698000037e631d7',
        count: 5
    }
];

const roleBMule = {
    config: MULES,

    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.delivering = false;
            creep.say('🔄 picking up');
        }
        if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
            creep.memory.delivering = true;
            creep.say('⚡ delivering');
        }
        if (creep.memory.delivering) {
            goDeliver(creep);
        }
        else {
            goPickUp(creep);
        }
    }
};

/**
 * Resolves destination target from ID
 */
function getTargetObject(creep, targetDef) {
    if (!targetDef) return null;
    if (typeof targetDef === 'string') {
        return Game.getObjectById(targetDef.trim());
    }
    return targetDef;
}

/**
 * Resolves energy source from ID
 */
function getSourceObject(creep, sourceDef) {
    if (!sourceDef) return null;
    if (typeof sourceDef === 'string') {
        return Game.getObjectById(sourceDef.trim());
    }
    return sourceDef;
}

/**
 * Determines whether a source object has 0 available energy
 */
function isSourceEmpty(source) {
    if (!source) return true;
    if (source.store) {
        return (source.store[RESOURCE_ENERGY] || 0) === 0;
    }
    if (source.energy !== undefined) {
        return source.energy === 0;
    }
    if (source.amount !== undefined) {
        return source.amount === 0;
    }
    return false;
}

function getMuleRoute(creep) {
    if (!creep.memory.route) return null;
    return MULES.find((m) => m.route === creep.memory.route && (m.room === creep.room.name || !m.room)) ||
           MULES.find((m) => m.route === creep.memory.route);
}

function goDeliver(creep) {
    const routeConfig = getMuleRoute(creep);
    const targetDef = routeConfig ? routeConfig.target : creep.memory.target;
    const target = getTargetObject(creep, targetDef);

    if (target) {
        if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                reusePath: 15,
                visualizePathStyle: { stroke: '#ffffff' }
            });
        }
    } else {
        idle.park(creep);
    }
}

function goPickUp(creep) {
    const routeConfig = getMuleRoute(creep);
    const sourceDef = routeConfig ? routeConfig.source : creep.memory.source;
    const source = getSourceObject(creep, sourceDef);

    if (!source || isSourceEmpty(source)) {
        if (creep.store[RESOURCE_ENERGY] > 0) {
            creep.memory.delivering = true;
            creep.say('⚡ delivering');
            goDeliver(creep);
            return;
        }
        idle.park(creep);
        return;
    }

    let res = creep.withdraw(source, RESOURCE_ENERGY);
    if (res === ERR_INVALID_TARGET && typeof source.harvest === 'function') {
        res = creep.harvest(source);
    }

    if (res === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, {
            reusePath: 15,
            visualizePathStyle: { stroke: '#ffaa00' }
        });
    } else if (res === ERR_NOT_ENOUGH_RESOURCES) {
        if (creep.store[RESOURCE_ENERGY] > 0) {
            creep.memory.delivering = true;
            creep.say('⚡ delivering');
            goDeliver(creep);
            return;
        }
        idle.park(creep);
    }
}

module.exports = roleBMule;