/**
 * Spawner Manager
 * Handles population limits, dynamic body scaling, emergency creep recovery, and military defense schedules.
 */
const roleHarvester = require('role.harvester');
const roleRemoteHarvester = require('role.remoteharvester');
const roleMule = require('role.mule');
const roleSpawnMule = require("./role.spawnmule");
const roleJanitor = require('./role.janitor');

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
        const minUpdater = 5;
        const minBuilder = spawn.room.find(FIND_MY_CONSTRUCTION_SITES).length > 0 ? 8 : 1;
        const janitorConfig = roleJanitor.config ? roleJanitor.config.find(j => (j.homeRoom || j.room) === spawn.room.name) : null;
        const minJanitor = janitorConfig && janitorConfig.count !== undefined ? janitorConfig.count : 1;
        
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
            creep.memory.role === 'harvester' 
        ).length;
        const activeUpdater = spawn.room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'updater'
        }).length;
        const activeBuilder = spawn.room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'builder'
        }).length;
        const activeJanitor = spawn.room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.memory.role === 'janitor'
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

        spawnSpawnMuler(spawn);
        // 1. Emergency recovery if harvesters are critically low
        if (activeHarvester <= 1) {
            const emergencyRoute = neededHarvesterRoute ? neededHarvesterRoute.route : null;
            spawnEmergencyHarvester(spawn, emergencyRoute);
            if( spawn.memory.currentJob === 'emergency harvester' )
                return;
            spawn.memory.currentJob = 'emergency harvester';
            console.log(`Spawning emergency harvester ${activeHarvester}`);
        }
        // 2. Urgent wartime defense: Prioritize military defenders when hostiles are present
        else if (hasHostiles && activeDefenderMelee < minDefenderMelee) {
            if (spawn.room.energyAvailable < 280) {
                return;
            }
            spawnDefenderMelee(spawn);
            if( spawn.memory.currentJob === 'melee defender' )
                return;
            spawn.memory.currentJob = 'melee defender';
            console.log(`🚨 [ALERT] Spawning melee defender ${activeDefenderMelee}/${minDefenderMelee}`);
        }
        else if (hasHostiles && activeDefenderHealer < minDefenderHealer) {
            if (spawn.room.energyAvailable < 300) {
                return;
            }
            spawnDefenderHealer(spawn);
            if( spawn.memory.currentJob === 'combat healer' )
                return;
            spawn.memory.currentJob = 'combat healer';
            console.log(`🚨 [ALERT] Spawning combat healer ${activeDefenderHealer}/${minDefenderHealer}`);
        }
        else if (hasHostiles && activeDefenderRanged < minDefenderRanged) {
            if (spawn.room.energyAvailable < 260) {
                return;
            }
            spawnDefenderRanged(spawn);
            if( spawn.memory.currentJob === 'ranged defender' )
                return;
            spawn.memory.currentJob = 'ranged defender';
            console.log(`🚨 [ALERT] Spawning ranged defender ${activeDefenderRanged}/${minDefenderRanged}`);
        }
        // 3. Economy: Base harvesters & logistics
        else if (neededHarvesterRoute) {
            if (spawn.room.energyAvailable < 200) {
                return;
            }
            spawnHarvester(spawn, neededHarvesterRoute.route);
            if( spawn.memory.currentJob === 'harvester' )
                return;
            spawn.memory.currentJob = 'harvester';
            console.log(`Spawning harvester ${neededHarvesterRoute.current}/${neededHarvesterRoute.route.count} (${neededHarvesterRoute.route.route})`);
        }       
        else if (neededMuleRoute) {
            if (spawn.room.energyAvailable < 200) {
                return;
            }
            spawnMule(spawn, neededMuleRoute.route);
            if( spawn.memory.currentJob === 'mule' )
                return;
            spawn.memory.currentJob = 'mule';
            console.log(`Spawning mule ${neededMuleRoute.current}/${neededMuleRoute.route.count} (${neededMuleRoute.route.route})`);
        }
        // 4. Room progression: Updaters & Builders
        else if (activeUpdater < minUpdater) {
            if (spawn.room.energyAvailable < 200) {
                return;
            }
            spawnUpdater(spawn);
            if( spawn.memory.currentJob === 'updater' )
                return;
            spawn.memory.currentJob = 'updater';
            console.log(`Spawning updater ${activeUpdater}/${minUpdater}`);            
        }
        else if (activeBuilder < minBuilder) {
            if (spawn.room.energyAvailable < 200) {
                return;
            }
            spawnBuilder(spawn);
            if( spawn.memory.currentJob === 'builder' )
                return;
            spawn.memory.currentJob = 'builder';
            console.log(`Spawning builder ${activeBuilder}/${minBuilder}`);
        }
        else if (activeJanitor < minJanitor) {
            if (spawn.room.energyAvailable < 300) {
                return;
            }
            spawnJanitor(spawn);
            if( spawn.memory.currentJob === 'janitor' )
                return;
            spawn.memory.currentJob = 'janitor';
            console.log(`Spawning janitor ${activeJanitor}/${minJanitor}`);
        }
        // 5. Peacetime standing army (2 melee, 2 ranged, 1 healer)
        else if (activeDefenderMelee < minDefenderMelee) {
            if (spawn.room.energyAvailable < 280) {
                return;
            }
            spawnDefenderMelee(spawn);
            if( spawn.memory.currentJob === 'melee defender' )
                return;
            spawn.memory.currentJob = 'melee defender';
            console.log(`Spawning melee defender ${activeDefenderMelee}/${minDefenderMelee}`);
        }
        else if (activeDefenderRanged < minDefenderRanged) {
            if (spawn.room.energyAvailable < 200) {
                return;
            }
            spawnDefenderRanged(spawn);
            if( spawn.memory.currentJob === 'ranged defender ' )
                return;
            spawn.memory.currentJob = 'ranged defender';
            console.log(`Spawning ranged defender ${activeDefenderRanged}/${minDefenderRanged}`);
        }
        else if (activeDefenderHealer < minDefenderHealer) {
            if (spawn.room.energyAvailable < 400) {
                return;
            }
            spawnDefenderHealer(spawn);
            if( spawn.memory.currentJob === 'combat healer' )
                return;
            spawn.memory.currentJob = 'combat healer';
            console.log(`Spawning combat healer ${activeDefenderHealer}/${minDefenderHealer}`);
        }
        else if (neededRemoteHarvesterRoute) {
            if (spawn.room.energyAvailable < 200) {
                return;
            }
            spawnRemoteHarvester(spawn, neededRemoteHarvesterRoute.route);
            if( spawn.memory.currentJob === 'remote harvester' )
                return;
            spawn.memory.currentJob = 'remote harvester';
            console.log(`Spawning remote harvester ${neededRemoteHarvesterRoute.current}/${neededRemoteHarvesterRoute.route.count} (${neededRemoteHarvesterRoute.route.route})`);
        }
        else{
            if( spawn.memory.currentJob === 'idle' )
                return;
            spawn.memory.currentJob = 'idle';
            console.log(`Spawning idle`);
            return;
        }
    }
};

function spawnSpawnMuler(spawn){
    let body = null;
    let level = spawn.room.energyCapacityAvailable;
    const activeSpawnMuler = spawn.room.find(FIND_MY_CREEPS, {
        filter: (creep) => creep.memory.role === 'spawmMuler'
    }).length;
    
    if (activeSpawnMuler < 1)
    {
        body = [CARRY, MOVE]
    }   
    else if (level >= 300)
    {
        if (spawn.room.energyAvailable < 300)
            return;
        body = [CARRY, MOVE, CARRY, MOVE, CARRY, MOVE]
    }
    else if (level >= 400)
    {
        if (spawn.room.energyAvailable < 400)
            return;
        body = [CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE]
    }
    else if (level >= 500)
    {
        if (spawn.room.energyAvailable < 500)
            return;
        body = [CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE]
    }
    else
    {
        if (spawn.room.energyAvailable < 100)
            return;
        body = [CARRY, MOVE]
    }
    const spawnMule = roleSpawnMule.config ? roleSpawnMule.config.filter(r =>
        r.room === spawn.room.name) : [];

    for (const mule of spawnMule) {
        let activeSpawnMuler = spawn.room.find(FIND_MY_CREEPS, {
            filter: (creep) =>
                creep.memory.role === 'spawmMuler' && creep.memory.route === mule.route
        })
        if (activeSpawnMuler.length === 0) {
            const name = 'SpawmMuler' + mule.route + Game.time;
            spawn.spawnCreep(body, name, { memory: { 
                role: 'spawmMuler',
                route: mule.route
            }});
        }
    }
}

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
    let level = spawn.room.energyCapacityAvailable;
    let body = null;
    if (level < 300)
    {
        if (spawn.room.energyAvailable < 200)
            return;
        body = [WORK, CARRY, MOVE];
    }
    else if (level < 400)
    {
        if (spawn.room.energyAvailable < 300)
            return;
        body = [WORK, WORK, CARRY, MOVE]
    }
    else if (level < 500)
    {
        if (spawn.room.energyAvailable < 400)
            return;
        body = [WORK, WORK, WORK, CARRY, MOVE]
    }
    else if (level < 600)
    {
        if (spawn.room.energyAvailable < 500)
            return;
        body = [WORK, WORK, WORK, WORK, CARRY, MOVE]
    }
    else{
        if (spawn.room.energyAvailable < 600)
            return;
        body = [WORK, WORK, WORK, WORK, WORK, CARRY, MOVE]
    }
    
    const name = route.route + Game.time;
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
    let level = spawn.room.energyCapacityAvailable;
    let body = null;
    if (level < 300)
    {
        if (spawn.room.energyAvailable < 200)
            return;
        body = [WORK, CARRY, MOVE];
    }
    else if (level < 400)
    {
        if (spawn.room.energyAvailable < 300)
            return;
        body = [WORK, WORK, CARRY, MOVE]
    }
    else if (level < 500)
    {
        if (spawn.room.energyAvailable < 400)
            return;
        body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE]
    }
    else
    {
        if (spawn.room.energyAvailable < 400)
            return;

        let energyThere = spawn.room.energyAvailable - 200;
        body = [WORK, WORK];
        while (energyThere > 0)
        {
            body.push(CARRY);
            body.push(MOVE);
            energyThere -= 100;
        }
        if (spawn.room.energyAvailable < 500)
            return;
    }
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
    let level = spawn.room.energyCapacityAvailable;
    let body = null;
    if (level >= 300)
    {
        if (spawn.room.energyAvailable < 300)
            return;
        body = [WORK, CARRY, CARRY, MOVE, MOVE]
    }
    else if (level >= 400)
    {
        if (spawn.room.energyAvailable < 400)
            return;
        body = [WORK, WORK, CARRY, CARRY, MOVE, MOVE]
    }
    else if (level >= 500)
    {
        if (spawn.room.energyAvailable < 500)
            return; 
        body = [WORK, WORK, CARRY, CARRY, MOVE, CARRY, MOVE, MOVE]
    }
    else
    {
        if (spawn.room.energyAvailable < 200)
            return;
        body = [WORK, CARRY, MOVE];
    }
    const name = 'Updater' + Game.time;
    spawn.spawnCreep(body, name, { memory: { role: 'updater' } });
}

function spawnBuilder(spawn){
    let level = spawn.room.energyCapacityAvailable;
    let body = null;
    if (level >= 300)
    {
        if (spawn.room.energyAvailable < 300)
            return;
        body = [WORK, CARRY, CARRY,  MOVE, MOVE];
    }
    else if (level >= 400)
    {
        if (spawn.room.energyAvailable < 400)
            return;
        body = [WORK, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE];
    }
    else if (level >= 500)
    {
        if (spawn.room.energyAvailable < 500)
            return;
        body = [WORK, CARRY, CARRY, CARRY, CARRY, MOVE, MOVE, MOVE, MOVE];
    }
    else
    {
        if (spawn.room.energyAvailable < 200)
            return;
        body = [WORK, CARRY, MOVE];
    }
    const name = 'Builder' + Game.time;
    spawn.spawnCreep(body, name, { memory: { role: 'builder' } });
}

function spawnMule(spawn, route){
    let body = null;
    let level = spawn.room.energyCapacityAvailable;
    if (level >= 300)
    {
        if (spawn.room.energyAvailable < 300)
            return;
        body = [CARRY, MOVE, CARRY, MOVE, CARRY, MOVE]
    }
    else if (level >= 400)
    {
        if (spawn.room.energyAvailable < 400)
            return;
        body = [CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE]
    }
    else if (level >= 500)
    {
        if (spawn.room.energyAvailable < 500)
            return;
        body = [CARRY, MOVE, CARRY, MOVE, CARRY, MOVE, CARRY, MOVE]
    }
    else
    {
        if (spawn.room.energyAvailable < 100)
            return;
        body = [CARRY, MOVE]
    }
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

function spawnJanitor(spawn) {
    let level = spawn.room.energyCapacityAvailable;
    let body = null;
    if (level < 300)
    {
        if (spawn.room.energyAvailable < 200)
            return;
        body = [WORK, CARRY, MOVE];
    }
    else
    {
        if (spawn.room.energyAvailable < 300)
            return;
        body = [WORK, CARRY, CARRY, MOVE, MOVE]
    }
    const name = 'Janitor' + Game.time;
    spawn.spawnCreep(body, name, { memory: { role: 'janitor' } });
}

module.exports = managerSpawner;
