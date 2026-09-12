/**
 * Spawner Manager
 * Handles population limits, dynamic body scaling, emergency creep recovery, and military defense schedules.
 */
const roleHarvester = require('role.harvester');
const roleRemoteHarvester = require('role.remoteharvester');
const roleMule = require('role.mule');

const managerSpawner = {
    
    run: function (spawn) {
        if (!spawn || spawn.spawning) {
            return;
        }
        
        if (spawn.room.energyAvailable < 200) {
            return;
        }

        // Check for hostiles in room to determine defense alert status
        const hostiles = spawn.room.find(FIND_HOSTILE_CREEPS);
        const hasHostiles = hostiles.length > 0;

        // Quotas: 2 of each during peacetime, 5 of each when hostiles are present
        const minDefenderMelee = hasHostiles ? 5 : 2;
        const minDefenderRanged = hasHostiles ? 5 : 2;
        const minDefenderHealer = hasHostiles ? 2 : 1;
        const minHarvester = 10;
        const minUpdater = 5;
        const minBuilder = spawn.room.find(FIND_MY_CONSTRUCTION_SITES).length > 0 ? 2 : 1;
        
        const activeDefenderMelee = spawn.room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'defenderMelee'
        }).length;
        const activeDefenderRanged = spawn.room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'defenderRanged'
        }).length;
        const activeDefenderHealer = spawn.room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'defenderHealer' || creep.memory.role === 'healer'
        }).length;
        const activeHarvester = Object.values(Game.creeps).filter((creep) =>
            creep.memory.role === 'harvester' &&
            ((creep.memory.homeRoom || creep.memory.room) === spawn.room.name || creep.room.name === spawn.room.name)
        ).length;
        const activeUpdater = spawn.room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'updater'
        }).length;
        const activeBuilder = spawn.room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'builder'
        }).length;
        
        // Find under-allocated harvester routes for this room / remote rooms
        const harvesterRoutes = roleHarvester.config ? roleHarvester.config.filter(h => (h.homeRoom || h.room) === spawn.room.name) : [];
        let neededHarvesterRoute = null;
        for (const route of harvesterRoutes) {
            const activeCount = Object.values(Game.creeps).filter((creep) =>
                creep.memory.role === 'harvester' &&
                creep.memory.route === route.route
            ).length;
            if (activeCount < (route.count !== undefined ? route.count : 1)) {
                neededHarvesterRoute = { route, current: activeCount };
                break;
            }
        }

        // Find under-allocated mule routes for this room to maintain logistical flow
        const muleRoutes = roleMule.config ? roleMule.config.filter(m => (m.homeRoom || m.room) === spawn.room.name) : [];
        let neededMuleRoute = null;
        for (const route of muleRoutes) {
            const activeMules = Object.values(Game.creeps).filter((creep) =>
                creep.memory.role === 'mule' &&
                creep.memory.route === route.route
            ).length;
            if (activeMules < (route.count !== undefined ? route.count : 1)) {
                neededMuleRoute = { route, current: activeMules };
                break;
            }
        }

        // Find under-allocated remote harvester routes
        const remoteHarvesterRoutes = roleRemoteHarvester.config ? roleRemoteHarvester.config.filter(r => (r.homeRoom || r.room) === spawn.room.name) : [];
        let neededRemoteHarvesterRoute = null;
        for (const route of remoteHarvesterRoutes) {
            const activeCount = Object.values(Game.creeps).filter((creep) =>
                (creep.memory.role === 'remoteharvester' || creep.memory.role === 'remoteHarvester') &&
                creep.memory.route === route.route
            ).length;
            if (activeCount < (route.count !== undefined ? route.count : 1)) {
                neededRemoteHarvesterRoute = { route, current: activeCount };
                break;
            }
        }
        
        // 1. Emergency recovery if harvesters are critically low
        if (activeHarvester <= 1) {
            const emergencyRoute = neededHarvesterRoute ? neededHarvesterRoute.route : null;
            spawnEmergencyHarvester(spawn, emergencyRoute);
            console.log(`Spawning emergency harvester ${activeHarvester}/${minHarvester}`);
        }
        // 2. Urgent wartime defense: Prioritize military defenders when hostiles are present
        else if (hasHostiles && activeDefenderMelee < minDefenderMelee) {
            if (spawn.room.energyAvailable < 280) {
                return;
            }
            console.log(`🚨 [ALERT] Spawning melee defender ${activeDefenderMelee}/${minDefenderMelee}`);
            spawnDefenderMelee(spawn);
        }
        else if (hasHostiles && activeDefenderHealer < minDefenderHealer) {
            if (spawn.room.energyAvailable < 300) {
                return;
            }
            console.log(`🚨 [ALERT] Spawning combat healer ${activeDefenderHealer}/${minDefenderHealer}`);
            spawnDefenderHealer(spawn);
        }
        else if (hasHostiles && activeDefenderRanged < minDefenderRanged) {
            if (spawn.room.energyAvailable < 260) {
                return;
            }
            console.log(`🚨 [ALERT] Spawning ranged defender ${activeDefenderRanged}/${minDefenderRanged}`);
            spawnDefenderRanged(spawn);
        }
        // 3. Economy: Base harvesters & logistics
        else if (neededHarvesterRoute) {
            if (spawn.room.energyAvailable < 500) {
                return;
            }
            console.log(`Spawning harvester ${neededHarvesterRoute.current}/${neededHarvesterRoute.route.count} (${neededHarvesterRoute.route.route})`);
            spawnHarvester(spawn, neededHarvesterRoute.route);
        }
        else if (harvesterRoutes.length === 0 && activeHarvester < minHarvester) {
            if (spawn.room.energyAvailable < 500) {
                return;
            }
            console.log(`Spawning harvester ${activeHarvester}/${minHarvester}`);
            spawnHarvester(spawn);
        }
        else if (neededMuleRoute) {
            if (spawn.room.energyAvailable < 200) {
                return;
            }
            console.log(`Spawning mule ${neededMuleRoute.current}/${neededMuleRoute.route.count} (${neededMuleRoute.route.route})`);
            spawnMule(spawn, neededMuleRoute.route);
        }
        else if (neededRemoteHarvesterRoute) {
            if (spawn.room.energyAvailable < 500) {
                return;
            }
            console.log(`Spawning remote harvester ${neededRemoteHarvesterRoute.current}/${neededRemoteHarvesterRoute.route.count} (${neededRemoteHarvesterRoute.route.route})`);
            spawnRemoteHarvester(spawn, neededRemoteHarvesterRoute.route);
        }
        // 4. Peacetime standing army (2 melee, 2 ranged, 1 healer)
        else if (activeDefenderMelee < minDefenderMelee) {
            if (spawn.room.energyAvailable < 280) {
                return;
            }
            console.log(`Spawning melee defender ${activeDefenderMelee}/${minDefenderMelee}`);
            spawnDefenderMelee(spawn);
        }
        else if (activeDefenderRanged < minDefenderRanged) {
            if (spawn.room.energyAvailable < 260) {
                return;
            }
            console.log(`Spawning ranged defender ${activeDefenderRanged}/${minDefenderRanged}`);
            spawnDefenderRanged(spawn);
        }
        else if (activeDefenderHealer < minDefenderHealer) {
            if (spawn.room.energyAvailable < 300) {
                return;
            }
            console.log(`Spawning combat healer ${activeDefenderHealer}/${minDefenderHealer}`);
            spawnDefenderHealer(spawn);
        }
        // 5. Room progression: Updaters & Builders
        else if (activeUpdater < minUpdater) {
            if (spawn.room.energyAvailable < 400) {
                return;
            }
            console.log(`Spawning updater ${activeUpdater}/${minUpdater}`);            
            spawnUpdater(spawn);
        }
        else if (activeBuilder < minBuilder) {
            if (spawn.room.energyAvailable < 400) {
                return;
            }
            console.log(`Spawning builder ${activeBuilder}/${minBuilder}`);
            spawnBuilder(spawn);
        }
    }
};


function spawnDefenderMelee(spawn) {
    const body = [TOUGH, TOUGH, ATTACK, ATTACK, MOVE, MOVE]; // 280 energy
    const name = 'DefMelee' + Game.time;
    spawn.spawnCreep(body, name, { memory: { role: 'defenderMelee' } });
}

function spawnDefenderRanged(spawn) {
    const body = [TOUGH, RANGED_ATTACK, MOVE, MOVE]; // 260 energy
    const name = 'DefRanged' + Game.time;
    spawn.spawnCreep(body, name, { memory: { role: 'defenderRanged' } });
}

function spawnDefenderHealer(spawn) {
    const body = [HEAL, MOVE]; // 300 energy (250 HEAL + 50 MOVE)
    const name = 'DefHealer' + Game.time;
    spawn.spawnCreep(body, name, { memory: { role: 'defenderHealer' } });
}

function spawnEmergencyHarvester(spawn, route) {
    const body = [WORK, CARRY, MOVE]; // 200 energy fallback
    const name = 'Harvester' + Game.time;
    const memory = { role: 'harvester' };
    if (route) {
        memory.route = route.route;
        memory.room = route.room;
        memory.homeRoom = route.homeRoom || spawn.room.name;
        if (route.source) memory.source = route.source;
        if (route.target) memory.target = route.target;
        if (route.container) memory.container = route.container;
    }
    spawn.spawnCreep(body, name, { memory });
}

function spawnHarvester(spawn, route) {
    const body = [WORK, WORK, WORK, WORK, CARRY, MOVE]; // 500 energy
    const name = 'Harvester' + Game.time;
    const memory = { role: 'harvester' };
    if (route) {
        memory.route = route.route;
        memory.room = route.room;
        memory.homeRoom = route.homeRoom || spawn.room.name;
        if (route.source) memory.source = route.source;
        if (route.target) memory.target = route.target;
        if (route.container) memory.container = route.container;
    }
    spawn.spawnCreep(body, name, { memory });
}

function spawnRemoteHarvester(spawn, route) {
    const body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE]; // 500 energy (2 WORK, 2 CARRY, 4 MOVE for 1:1 speed)
    const name = 'RemoteHarvester' + Game.time;
    const memory = { role: 'remoteharvester' };
    if (route) {
        memory.route = route.route;
        memory.room = route.room;
        memory.homeRoom = route.homeRoom || spawn.room.name;
        if (route.source) memory.source = route.source;
    }
    spawn.spawnCreep(body, name, { memory });
}

function spawnUpdater(spawn){
    const body = [WORK, WORK, WORK, CARRY, MOVE];
    const name = 'Updater' + Game.time;
    spawn.spawnCreep(body, name, { memory: { role: 'updater' } });
}

function spawnBuilder(spawn){
    const body = [WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
    const name = 'Builder' + Game.time;
    spawn.spawnCreep(body, name, { memory: { role: 'builder' } });
}

function spawnMule(spawn, route){
    const body = [CARRY, CARRY, MOVE, MOVE];
    const name = 'Mule' + Game.time;
    spawn.spawnCreep(body, name, {
        memory: {
            route: route.route,
            role: 'mule',
            room: route.room,
            source: route.source,
            target: route.target
        }
    });
}

module.exports = managerSpawner;
