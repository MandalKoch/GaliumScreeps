/**
 * Builder Role
 * Constructs buildings, and when idle plans, builds, and repairs roads.
 */
const roleJanitorV2 = require('role.janitor');
require('helper.source');

// Define road routes to maintain and build when idle
const ROADS = [
    {
        route: 'updaterRoad',
        room: 'W9N9',
        source: '6aa55d271698000037e631d7',
        target: '6aa57a611964a00035340301'
    },
    {
        route: 'harvesterRoad1',
        room: 'W9N9',
        source: '6aa596a38c67d000382ebf00',
        target: '6aa55d271698000037e631d7'
    },
    {
        route: 'harvesterRoad2',
        room: 'W9N9',
        source: '6aa5969f8c67d000382ebeff',
        target: '6aa55d271698000037e631d7'
    }
];

const roleBuilder = {
    config: ROADS,

    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.memory.delivering && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.delivering = false;
            creep.say('🔄 gather');
        }
        if (!creep.memory.delivering && creep.store.getFreeCapacity() === 0) {
            creep.memory.delivering = true;
            creep.say('⚡ building');
        }

        if (creep.memory.delivering) {
            goDeliver(creep);
        } else {
            goGather(creep);
        }
    }
};

/**
 * Plans road construction sites along configured routes
 */
function planRoads(creep) {
    for (const route of ROADS) {
        if (route.room && route.room !== creep.room.name) continue;
        const source = typeof route.source === 'string' ? Game.getObjectById(route.source) : route.source;
        const target = typeof route.target === 'string' ? Game.getObjectById(route.target) : route.target;
        if (!source || !target || !source.pos || !target.pos) continue;

        const path = source.pos.findPathTo(target.pos, {
            ignoreCreeps: true,
            swampCost: 2,
            plainCost: 2
        });

        for (const step of path) {
            const structures = creep.room.lookForAt(LOOK_STRUCTURES, step.x, step.y);
            const hasRoad = structures.some((s) => s.structureType === STRUCTURE_ROAD);
            const sites = creep.room.lookForAt(LOOK_CONSTRUCTION_SITES, step.x, step.y);
            const hasSite = sites.length > 0;

            if (!hasRoad && !hasSite) {
                creep.room.createConstructionSite(step.x, step.y, STRUCTURE_ROAD);
            }
        }
    }
}

function goDeliver(creep) {
    // 1. Build active construction sites in the room
    const sites = creep.room.find(FIND_MY_CONSTRUCTION_SITES);
    if (sites.length > 0) {
        const target = creep.pos.findClosestByRange(sites);
        if (target) {
            if (creep.build(target) === ERR_NOT_IN_RANGE) {
                creep.moveTo(target, {
                    reusePath: 15,
                    visualizePathStyle: { stroke: '#ffffff' }
                });
            }
            return;
        }
    }

    // 2. Idle Behavior: Road maintenance & planning
    // Periodically plan road construction sites along routes
    if (Game.time % 10 === 0) {
        planRoads(creep);
    }

    // 3. Repair decaying roads (< 70% hits)
    const decayingRoad = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) => s.structureType === STRUCTURE_ROAD && s.hits < s.hitsMax * 0.7
    });
    if (decayingRoad) {
        if (creep.repair(decayingRoad) === ERR_NOT_IN_RANGE) {
            creep.moveTo(decayingRoad, {
                reusePath: 15,
                visualizePathStyle: { stroke: '#00ffaa' }
            });
        }
        return;
    }

    // 4. If nothing to do fall back to janitor
    roleJanitorV2.run(creep);
}

function goGather(creep) {
    // 1. Try to withdraw from a container with energy
    const container = findNextContainerWithEnergy(creep, 50);
    if (container) {
        if (creep.withdraw(container, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
            creep.moveTo(container, {
                reusePath: 15,
                visualizePathStyle: { stroke: '#ffaa00' }
            });
        }
        return;
    }

   // 2. Fallback: harvest from active source
   const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
   if (source) {
       if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
           creep.moveTo(source, {
               reusePath: 15,
               visualizePathStyle: { stroke: '#ffaa00' }
           });
       }
   }
}

module.exports = roleBuilder;