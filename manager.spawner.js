/**
 * Spawner Manager
 * Handles population limits, dynamic body scaling, and emergency creep recovery.
 */


const managerSpawner = {
    
    run: function (spawn) {
        if (!spawn || spawn.spawning) {
            return;
        }
        
        const minHarvester = 1;
        const minUpdater = 1;
        
        const activeHarvester = spawn.room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'harvester'
        }).length;
        const activeUpdater = spawn.room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'updater'
        }).length;
        
        if (activeHarvester < minHarvester) {
            spawnHarvester(spawn);
        }
        else if (activeUpdater < minUpdater) {
            spawnUpdater(spawn);
        }
    }
};

function spawnHarvester(spawn){
    console.log('Spawning harvester');

    const body = [WORK, CARRY, MOVE];
    const name = 'Harvester' + Game.time;

    spawn.spawnCreep(body, name, { memory: { role: 'harvester' } });
}

function spawnUpdater(spawn){
    console.log('Spawning updater');

    const body = [WORK, CARRY, MOVE];
    const name = 'Updater' + Game.time;

    spawn.spawnCreep(body, name, { memory: { role: 'updater' } });
}

module.exports = managerSpawner;
