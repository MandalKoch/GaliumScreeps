/**
 * Defender & Combat Support Role
 * Protects the room from hostile creeps and structures.
 * Supports melee, ranged, and healer combat units to maximize unit longevity and colony defense.
 * In peacetime, stations at a "defend" flag or parks with idle manager.
 */
const idle = require('manager.idle');

const roleDefender = {
    /** @param {Creep} creep **/
    run: function (creep) {
        const hasHeal = creep.getActiveBodyparts(HEAL) > 0;
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);

        // 1. Dedicated Healer / Field Medic logic
        if (hasHeal) {
            runHealerLogic(creep, hostiles);
            return;
        }

        // 2. Combat Units: Find hostiles in the room
        if (hostiles.length > 0) {
            const target = findPriorityTarget(creep, hostiles);
            if (target) {
                engageTarget(creep, target);
                return;
            }
        }

        // 3. Check for hostile structures (e.g. invader cores)
        const hostileStructures = creep.room.find(FIND_HOSTILE_STRUCTURES, {
            filter: (s) => s.structureType !== STRUCTURE_CONTROLLER
        });
        if (hostileStructures.length > 0) {
            const target = creep.pos.findClosestByRange(hostileStructures);
            if (target) {
                engageTarget(creep, target);
                return;
            }
        }

        // 4. Peacetime: Guard defend flag or park
        guardStation(creep);
    }
};

/**
 * Executes healing and triage logic to maximize survivability of friendly units
 */
function runHealerLogic(creep, hostiles) {
    // Priority 1: Self-preservation if damaged
    if (creep.hits < creep.hitsMax) {
        creep.heal(creep);
    }

    // Priority 2: Find injured friendly creeps
    const injuredCreeps = creep.room.find(FIND_MY_CREEPS, {
        filter: (c) => c.hits < c.hitsMax
    });

    if (injuredCreeps.length > 0) {
        // Sort by lowest health percentage to prioritize critical units
        injuredCreeps.sort((a, b) => (a.hits / a.hitsMax) - (b.hits / b.hitsMax));
        const target = injuredCreeps[0];
        const range = creep.pos.getRangeTo(target);

        creep.say('💊 heal');

        if (range <= 1) {
            creep.heal(target);
        } else if (range <= 3) {
            creep.rangedHeal(target);
        }

        if (range > 1) {
            creep.moveTo(target, {
                reusePath: 3,
                visualizePathStyle: { stroke: '#00ff00' }
            });
        }
        return;
    }

    // Priority 3: Accompany combat defenders into battle if hostiles exist
    if (hostiles.length > 0) {
        const defenders = creep.room.find(FIND_MY_CREEPS, {
            filter: (c) => (c.memory.role === 'defenderMelee' || c.memory.role === 'defenderRanged' || c.memory.role === 'defender') && c.id !== creep.id
        });

        if (defenders.length > 0) {
            const closestDefender = creep.pos.findClosestByRange(defenders);
            if (closestDefender && !creep.pos.inRangeTo(closestDefender, 2)) {
                creep.moveTo(closestDefender, {
                    reusePath: 5,
                    visualizePathStyle: { stroke: '#00ff00' }
                });
                creep.say('🛡️ assist');
                return;
            }
        }
    }

    // Peacetime / No injuries: Guard station
    guardStation(creep);
}

/**
 * Selects highest priority hostile target.
 * Priority: Creeps with HEAL parts > Creeps with ATTACK/RANGED_ATTACK > Closest
 */
function findPriorityTarget(creep, hostiles) {
    // Priority 1: Hostile Healers
    const healers = hostiles.filter(h => h.getActiveBodyparts(HEAL) > 0);
    if (healers.length > 0) {
        return creep.pos.findClosestByRange(healers);
    }

    // Priority 2: Hostile Attackers (Melee or Ranged)
    const attackers = hostiles.filter(h =>
        h.getActiveBodyparts(ATTACK) > 0 || h.getActiveBodyparts(RANGED_ATTACK) > 0
    );
    if (attackers.length > 0) {
        return creep.pos.findClosestByRange(attackers);
    }

    // Priority 3: Closest hostile
    return creep.pos.findClosestByRange(hostiles);
}

/**
 * Executes combat behavior for melee and ranged defenders
 */
function engageTarget(creep, target) {
    const hasRanged = creep.getActiveBodyparts(RANGED_ATTACK) > 0;
    const hasMelee = creep.getActiveBodyparts(ATTACK) > 0;
    const range = creep.pos.getRangeTo(target);

    creep.say('⚔️ attack');

    // Ranged attack logic
    if (hasRanged) {
        if (range <= 1) {
            creep.rangedMassAttack();
        } else if (range <= 3) {
            creep.rangedAttack(target);
        }

        // Maintain optimal range (range 2-3)
        if (range > 3) {
            creep.moveTo(target, {
                reusePath: 5,
                visualizePathStyle: { stroke: '#00ffff' }
            });
        } else if (range < 2 && target.getActiveBodyparts && target.getActiveBodyparts(ATTACK) > 0) {
            // Kite away from melee attackers if too close
            const fleePath = PathFinder.search(
                creep.pos,
                { pos: target.pos, range: 3 },
                { flee: true }
            );
            if (fleePath.path.length > 0) {
                creep.moveByPath(fleePath.path);
            }
        }
    }

    // Melee attack logic
    if (hasMelee) {
        if (creep.attack(target) === ERR_NOT_IN_RANGE) {
            creep.moveTo(target, {
                reusePath: 5,
                visualizePathStyle: { stroke: '#ff0000' }
            });
        }
    }

    // If creep has neither, follow or fall back
    if (!hasRanged && !hasMelee) {
        creep.moveTo(target, { reusePath: 5 });
    }
}

/**
 * Stations defender at peacetime guard post or parks
 */
function guardStation(creep) {
    const defendFlag =
        Game.flags['defend'] ||
        Game.flags['Defend'] ||
        Game.flags[`Defend_${creep.room.name}`] ||
        Game.flags[`defend_${creep.room.name}`] ||
        Game.flags['Guard'] ||
        Game.flags['guard'];

    if (defendFlag && (!defendFlag.room || defendFlag.room.name === creep.room.name)) {
        if (!creep.pos.inRangeTo(defendFlag, 2)) {
            creep.moveTo(defendFlag, {
                reusePath: 15,
                visualizePathStyle: { stroke: '#00ff00', lineStyle: 'dashed' }
            });
        }
        creep.say('🛡️ guard');
        return;
    }

    // Default parking if no defend flag exists
    idle.park(creep);
}

module.exports = roleDefender;
