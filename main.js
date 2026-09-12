/**
 * Main Loop Entry Point
 */
const roleHarvester = require('role.harvester');
const roleUpdater = require('role.updater');
const managerSpawner = require('manager.spawner');

module.exports.loop = function () {
    // 1. Memory Cleanup: Purge dead creeps
    for (const name in Memory.creeps) {
        if (!Game.creeps[name]) {
            delete Memory.creeps[name];
        }
    }
    // 2. Room & Spawner Management
    for (const spawnName in Game.spawns) {
            const spawn = Game.spawns[spawnName];
            managerSpawner.run(spawn);
        }
    for (const creepName in Game.creeps) {
        const creep = Game.creeps[creepName];
        switch (creep.memory.role) {
            case 'harvester':
                roleHarvester.run(creep);
                break;
            case 'updater':
                roleUpdater.run(creep);
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
