/**
 * Main Loop Entry Point
 */
const roleHarvester = require('role.harvester');
const roleRemoteHarvester = require('role.remoteharvester');
const roleUpdater = require('role.updater');
const roleBuilder = require('role.builder');
const roleMule = require('role.mule');
const roleDefender = require('role.defender');
const managerSpawner = require('manager.spawner');
const managerStats = require('manager.stats');
const managerTower = require('manager.tower');

module.exports.loop = function () {
    // 1. Memory Cleanup: Purge dead creeps
    for (const name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }
    // 2. Room Statistics & Tower Defense
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        managerStats.run(room);
        managerTower.run(room);
    }
    // 3. Spawner Management
    for (const spawnName in Game.spawns) {
        const spawn = Game.spawns[spawnName];
        managerSpawner.run(spawn);
    }
    // 4. Creep Execution
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        switch (creep.memory.role) {
            case 'harvester':
                roleHarvester.run(creep);
                break;
            case 'remoteharvester':
            case 'remoteHarvester':
                roleRemoteHarvester.run(creep);
                break;
            case 'updater':
                roleUpdater.run(creep);
                break;
            case 'builder':
            case 'roadbuilder':
            case 'roadBuilder':
                roleBuilder.run(creep);
                break;
            case 'mule':
                roleMule.run(creep);
                break;
            case 'defenderMelee':
            case 'defenderRanged':
            case 'defenderHealer':
            case 'healer':
            case 'defender':
                roleDefender.run(creep);
                break;
            default:
                creep.say('Unknown role');
                break;
        }
        // 5. CPU Bucket: Generate pixel if bucket reaches max capacity
        if (Game.cpu.generatePixel && Game.cpu.bucket >= 10000) {
            Game.cpu.generatePixel();
        }
    }
};
