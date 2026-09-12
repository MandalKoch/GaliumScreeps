/**
 * Main Loop Entry Point
 */
const roleHarvester = require('role.harvester');
const roleCarrier = require('role.carrier');
const roleTransporter = require('role.transporter');
const roleUpgrader = require('role.upgrader');
const roleBuilder = require('role.builder');
const roleDefender = require('role.defender');
const roleHarvesterW2N1 = require('role.harvesterW2N1');
const managerTowers = require('manager.towers');
const managerSpawner = require('manager.spawner');
const managerSpawnerRcl2 = require('manager.spawnerRCL2');
const managerSuicide = require('manager.suicide');
const managerStats = require('manager.stats');

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
        const rcl = (spawn.room.controller && spawn.room.controller.my) ? spawn.room.controller.level : 1;

        switch (rcl) {
            case 1:
                managerSpawner.run(spawn);
                break;
            case 2:
            default:
                managerSpawnerRcl2.run(spawn);
                break;
        }
    }

    // 3. Defense, Towers & Room Statistics
    for (const roomName in Game.rooms) {
        const room = Game.rooms[roomName];
        managerTowers.run(room);
        managerStats.run(room);
    }

    // 4. Creep Role Execution
    for (const name in Game.creeps) {
        const creep = Game.creeps[name];
        if (creep.spawning) {
            continue;
        }

        // Handle retiring creeps first (graceful dump & recycling)
        if (managerSuicide.run(creep)) {
            continue;
        }

        switch (creep.memory.role) {
            case 'harvester':
                roleHarvester.run(creep);
                break;
            case 'carrier':
            case 'hauler':
                roleCarrier.run(creep);
                break;
            case 'transporter':
                roleTransporter.run(creep);
                break;
            case 'upgrader':
                roleUpgrader.run(creep);
                break;
            case 'builder':
                roleBuilder.run(creep);
                break;
            case 'defender':
            case 'warrior':
                roleDefender.run(creep);
                break;
            case 'harvesterW2N1':
                roleHarvesterW2N1.run(creep);
                break;
            default:
                break;
        }
    }

    // 5. CPU Bucket: Generate pixel if bucket reaches max capacity
    if (Game.cpu.generatePixel && Game.cpu.bucket >= 10000) {
        Game.cpu.generatePixel();
    }
};
