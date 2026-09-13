const MULES = [
    {
        route: 'spawnfiller1',
        room: 'W2N2',
        sourcex: 8,
        sourcey: 25
    },
    {
        route: 'spawnfiller2',
        room: 'W2N2',
        sourcex: 6,
        sourcey: 21
    },
    {
        route: 'spawnfiller1_1',
        room: 'W2N2',
        sourcex: 8,
        sourcey: 25
    },
    {
        route: 'spawnfiller2_1',
        room: 'W2N2',
        sourcex: 6,
        sourcey: 21
    },
]


const roleSpawnMule = {
    config: MULES,
    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.delivering = false;
            //creep.say('🔄 picking up');
        }
        if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
            creep.memory.delivering = true;
            //creep.say('⚡ delivering');
        }
        if (creep.memory.delivering) {
            goDeliver(creep);
        }
        else {
            goPickUp(creep);
        }
    }
};

function goDeliver(creep) {
    const spawnTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            (s.structureType === STRUCTURE_SPAWN ||
                s.structureType === STRUCTURE_EXTENSION) &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    if (spawnTarget) {
        if (creep.transfer(spawnTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(spawnTarget);
        }
    }
}

function goPickUp(creep) {
    let config = MULES.filter(s => s.route === creep.memory.route);
    let source = null;
    if (config) {
        let sources = creep.room.lookForAt(LOOK_STRUCTURES, config[0].sourcex, config[0].sourcey);
        source = sources[0];
    }
    else
    {
        source = creep.pos.findClosestByPath(FIND_STRUCTURES, {
            filter: (s) =>
                ( s.structureType === STRUCTURE_CONTAINER ||
                s.structureType === STRUCTURE_STORAGE )
            && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
        });
    }
    if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source);
    }
}
    
module.exports = roleSpawnMule;