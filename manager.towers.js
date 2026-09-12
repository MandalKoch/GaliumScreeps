/**
 * Tower Defense & Repair Manager
 * Manages attack, heal, and repair priorities for room towers.
 */
const managerTowers = {
    /**
     * Run tower actions for all towers in a room.
     * @param {Room} room
     */
    run: function (room) {
        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: { structureType: STRUCTURE_TOWER }
        });

        for (const tower of towers) {
            // 1. Attack closest hostile creep
            const closestHostile = tower.pos.findClosestByRange(FIND_HOSTILE_CREEPS);
            if (closestHostile) {
                tower.attack(closestHostile);
                continue;
            }

            // 2. Heal damaged friendly creeps
            const damagedCreep = tower.pos.findClosestByRange(FIND_MY_CREEPS, {
                filter: (c) => c.hits < c.hitsMax
            });
            if (damagedCreep) {
                tower.heal(damagedCreep);
                continue;
            }

            // 3. Repair structures when energy reserves are above 50%
            if (tower.store.getUsedCapacity(RESOURCE_ENERGY) > tower.store.getCapacity(RESOURCE_ENERGY) * 0.5) {
                const damagedStructure = tower.pos.findClosestByRange(FIND_STRUCTURES, {
                    filter: (s) => {
                        if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) {
                            return s.hits < 10000; // Keep ramparts/walls maintained at baseline
                        }
                        return s.hits < s.hitsMax;
                    }
                });

                if (damagedStructure) {
                    tower.repair(damagedStructure);
                }
            }
        }
    }
};

module.exports = managerTowers;
