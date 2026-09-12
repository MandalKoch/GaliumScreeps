/**
 * Role: Defender
 * Gathers and patrols at the 'defend' flag during peacetime,
 * and engages hostile creeps with high priority when threats enter the room.
 */
const managerIdle = require('manager.idle');

const roleDefender = {
    /**
     * Finds the designated defend flag for the creep.
     * @param {Creep} creep
     * @returns {Flag|null}
     */
    getDefendFlag: function (creep) {
        // 1. Explicitly assigned flag name in memory
        if (creep.memory.flagName && Game.flags[creep.memory.flagName]) {
            return Game.flags[creep.memory.flagName];
        }

        // 2. Direct name matches
        if (Game.flags['defend']) return Game.flags['defend'];
        if (Game.flags['Defend']) return Game.flags['Defend'];
        if (Game.flags['DEFEND']) return Game.flags['DEFEND'];

        // 3. Room-specific flag name: defend_<RoomName> or Defend_<RoomName>
        const roomDefendFlag =
            Game.flags[`defend_${creep.room.name}`] ||
            Game.flags[`Defend_${creep.room.name}`] ||
            Game.flags[`DEFEND_${creep.room.name}`];
        if (roomDefendFlag) return roomDefendFlag;

        // 4. Any flag with 'defend' in its name
        for (const flagName in Game.flags) {
            if (flagName.toLowerCase().includes('defend')) {
                return Game.flags[flagName];
            }
        }

        return null;
    },

    /**
     * @param {Creep} creep
     */
    run: function (creep) {
        // 1. Scan for hostile creeps in the current room
        const hostiles = creep.room.find(FIND_HOSTILE_CREEPS);

        if (hostiles.length > 0) {
            // Prioritize dangerous hostile targets: healers first, then attackers, then closest
            const healer = hostiles.find((h) => h.body.some((p) => p.type === HEAL));
            const attacker = hostiles.find((h) =>
                h.body.some((p) => p.type === ATTACK || p.type === RANGED_ATTACK)
            );
            const target = healer || attacker || creep.pos.findClosestByRange(hostiles);

            if (target) {
                // Ranged attack if armed with RANGED_ATTACK parts
                if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
                    if (creep.pos.inRangeTo(target, 3)) {
                        creep.rangedAttack(target);
                    }
                }

                // Melee attack if armed with ATTACK parts
                if (creep.getActiveBodyparts(ATTACK) > 0) {
                    const attackResult = creep.attack(target);
                    if (attackResult === ERR_NOT_IN_RANGE) {
                        creep.moveTo(target, {
                            reusePath: 3,
                            visualizePathStyle: { stroke: '#ff0000', lineStyle: 'solid' }
                        });
                    }
                } else if (creep.getActiveBodyparts(RANGED_ATTACK) > 0) {
                    // Ranged kiting: keep range 3
                    if (!creep.pos.inRangeTo(target, 3)) {
                        creep.moveTo(target, {
                            reusePath: 3,
                            visualizePathStyle: { stroke: '#ffaa00' }
                        });
                    }
                }

                creep.say('⚔️ attack');
                return;
            }
        }

        // 2. Self / Ally healing during peacetime if armed with HEAL parts
        if (creep.getActiveBodyparts(HEAL) > 0) {
            if (creep.hits < creep.hitsMax) {
                creep.heal(creep);
            } else {
                const damagedAlly = creep.pos.findClosestByRange(FIND_MY_CREEPS, {
                    filter: (c) => c.hits < c.hitsMax
                });
                if (damagedAlly) {
                    if (creep.heal(damagedAlly) === ERR_NOT_IN_RANGE) {
                        creep.rangedHeal(damagedAlly);
                    }
                }
            }
        }

        // 3. Peacetime / Gathering: Move to and assemble at the 'defend' flag
        const defendFlag = this.getDefendFlag(creep);

        if (defendFlag) {
            // If in a different room or not close to the flag, move to it
            if (creep.room.name !== defendFlag.pos.roomName || !creep.pos.inRangeTo(defendFlag, 1)) {
                creep.moveTo(defendFlag, {
                    reusePath: 10,
                    visualizePathStyle: { stroke: '#00ff00', lineStyle: 'dashed' }
                });
                creep.say('🛡️ defend');
            } else {
                // Holding position at the defense flag
                creep.say('🛡️ guard');
            }
        } else {
            // Fallback: If no defend flag is defined, park away from spawns
            managerIdle.park(creep);
        }
    }
};

module.exports = roleDefender;
