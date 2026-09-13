const MULES = [
    {
        route: 'spawnfiller1',
        room: 'W2N2',
        source: '6aa6607b12550b003faf31c5'
    },
    {
        route: 'spawnfiller2',
        room: 'W2N2',
        source: '6aa6638612550b003faf31ed'
    },
    {
        route: 'spawnfiller1_2',
        room: 'W2N2',
        source: '6aa6607b12550b003faf31c5'
    },
    {
        route: 'spawnfiller1_3',
        room: 'W2N2',
        source: '6aa6607b12550b003faf31c5'
    },
    {
        route: 'spawnfiller2_2',
        room: 'W2N2',
        source: '6aa6638612550b003faf31ed'
    }
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
    let source = Game.getObjectById(config[0].source);
    if (creep.withdraw(source, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source);
    }
}
    
module.exports = roleSpawnMule;