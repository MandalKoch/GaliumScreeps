/**
 * Janitor Role
 * Cleans up dropped resources, scavenges tombstones and ruins,
 * performs structural repairs across the room, automatically plans
 * container construction sites, and deposits collected resources
 * into available containers and storage.
 */
const idle = require('./manager.idle');
require('./helper.source');

// Optional room-specific janitor configurations
const JANITORS = [
    // Example: { room: 'W9N9', count: 1 }
    {room: 'W2N2', count: 10}
];

// Defined container locations: specify room and coordinates (x, y) or target ID
const CONTAINERS = [
    // Example: { room: 'W2N2', x: 20, y: 25 },
    // Example: { room: 'W2N2', target: '399f0774a5bab03' },
    // Example: { room: 'W9N9', x: 15, y: 30 }
    { room: 'W2N2', x: 8, y: 25 },
    { room: 'W2N2', x: 6, y: 21 },
    { room: 'W2N2', x: 16, y: 19 },
];

const roleJanitor = 
    {
        /** @param {Creep} creep **/
        run: function (creep) {
            if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
                if(creep.memory.delivering){
                    creep.say('🧹 clean');
                }
                creep.memory.delivering = false;
            }

            if (creep.memory.delivering) {
                goDeliver(creep);
            } else {
                goCleanUp(creep);
            }
        }
};

function goDeliver(creep){
    // Rebuild Container
    rebuildContainers(creep);    
    // 1. check towers
    if (refillTowers(creep)) return;
    // 2. check spawner and extensions 
    if (dropBySpawner(creep)) return;
    // 3. check containers 
    // if (dropByContainer(creep)) return;
    // 4 Repair
    if (repair(creep)) return;
    // 5 idle
    idle.park(creep);
}

function goCleanUp(creep){

    if ( creep.store.getFreeCapacity(RESOURCE_ENERGY) === 0 )
    {
        if(!creep.memory.delivering){
            creep.say('⚡ work');
        }
        creep.memory.delivering = true;
        return;
    }
    
    // 1. Priority 1: Pick up dropped resources (energy or minerals)
    if(pickup(creep)) return;
    // 2. Priority 2: Scavenge tombstones with resources
    if(scavenge(creep)) return;
    // 3. Priority 3: Scavenge ruins with     
    if(ruins(creep)) return;
    // 4. Priority 4: refill by container
    if(refill(creep)) return;
    
}

function rebuildContainers(creep){
    for ( container in CONTAINERS){
        creep.room.createConstructionSite(container.x,container.y, STRUCTURE_CONTAINER);
    }
}

function refill(creep){
    const containers = findNextContainerWithEnergy(creep);
    if (containers) {
           if(creep.withdraw(containers, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                creep.moveTo(containers, {
                    reusePath: 15,
                    visualizePathStyle: { stroke: '#ffaa00' }
                });
            }
            return true;
    }
    return false;
}

function ruins(creep){
    const ruins = creep.room.find(FIND_RUINS, {
        filter: (r) => r.store && r.store.getUsedCapacity() > 0
    });
    if (ruins.length > 0) {
        const target = creep.pos.findClosestByRange(ruins);
        if (target) {
            for (const resourceType in target.store) {
                if (target.store[resourceType] > 0) {
                    if (creep.withdraw(target, resourceType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, {
                            reusePath: 15,
                            visualizePathStyle: { stroke: '#ffaa00' }
                        });
                    }
                    return true;
                }
            }
        }
    }
    return false;
}

function scavenge(creep){
    const tombstones = creep.room.find(FIND_TOMBSTONES, {
        filter: (t) => t.store && t.store.getUsedCapacity() > 0
    });
    if (tombstones.length > 0) {
        const target = creep.pos.findClosestByRange(tombstones);
        if (target) {
            for (const resourceType in target.store) {
                if (target.store[resourceType] > 0) {
                    if (creep.withdraw(target, resourceType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, {
                            reusePath: 15,
                            visualizePathStyle: { stroke: '#ffaa00' }
                        });
                    }
                    return true;
                }
            }
        }
    }
    return false;
}

function pickup(creep){
    const droppedResources = creep.room.find(FIND_DROPPED_RESOURCES);
    if (droppedResources.length > 0) {
        // Pick the closest dropped resource (or largest if nearby)
        const target = creep.pos.findClosestByRange(droppedResources);
        if (target) {
            if (creep.pickup(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    reusePath: 15,
                    visualizePathStyle: { stroke: '#ffff00' }
                });
            }
            return true;
        }
    }
    return false;
}

function repair(creep){
    let target = findRepairTarget(creep);
    if (target) {
        if (creep.repair(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target);
        }
        return true;
    }
    return false;
}

function findRepairTarget(creep) {
    // Priority 1: Decaying roads (< 80% hits) and damaged containers (< 90% hits)
    const criticalInfra = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            (s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax * 0.5) ||
            (s.structureType === STRUCTURE_CONTAINER && s.hits < s.hitsMax * 0.9)
    });
    if (criticalInfra) return criticalInfra;

    // Priority 2: Other damaged structures excluding walls and ramparts
    const damagedStructures = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            s.structureType !== STRUCTURE_WALL &&
            s.structureType !== STRUCTURE_RAMPART &&
            s.hits < s.hitsMax
    });
    if (damagedStructures) return damagedStructures;

    // Priority 3: Fortified ramparts & walls below maintenance thresholds (e.g. 50k hits)
    const fortifiedStructures = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            (s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL) &&
            s.hits < 50000 &&
            s.hits < s.hitsMax
    });
    if (fortifiedStructures) return fortifiedStructures;

    return null;
}


function refillTowers(creep){

    const towers = creep.pos.findClosestByRange(FIND_MY_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_TOWER
             && s.store.getFreeCapacity(RESOURCE_ENERGY) / s.store.getCapacity(RESOURCE_ENERGY) < 0.7
    });
    if (!towers) return false;
    let target = towers[0];
    if (creep.transfer(target, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
        creep.moveTo(source, {
            reusePath: 15,
            visualizePathStyle: { stroke: '#ffff00' }
        });
        return  true;
    }
    return false;
}
function dropBySpawner(creep){
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
        return true; 
    }
    return false; 
}
function dropByContainer(creep){
    const spawnTarget = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            s.structureType === STRUCTURE_CONTAINER &&
            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
    });
    if (spawnTarget) {
        if (creep.transfer(spawnTarget, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(spawnTarget);
        }
        return true;
    }
    return false;
}

module.exports = roleJanitor;