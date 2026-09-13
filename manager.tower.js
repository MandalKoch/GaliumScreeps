/**
 * Tower Defense & Maintenance Manager
 * Handles automated multi-tower combat targeting, triage healing of damaged creeps,
 * emergency structural repairs, and threshold-gated defensive maintenance.
 */

const managerTower = {
    // Configuration thresholds
    config: {
        /** Minimum energy in tower before performing non-critical routine repairs */
        ENERGY_REPAIR_THRESHOLD: 500,
        /** Energy threshold required for emergency critical repairs */
        EMERGENCY_REPAIR_THRESHOLD: 200,
        /** Maximum hit points to maintain fortified ramparts */
        RAMPART_MAX_HITS: 50000,
        /** Maximum hit points to maintain constructed walls */
        WALL_MAX_HITS: 50000,
        /** Critical hit point threshold triggering emergency structure repairs */
        CRITICAL_HITS_THRESHOLD: 5000
    },

    /**
     * Executes tower operations for all towers in a room.
     * @param {Room} room
     */
    run: function (room) {
        if (!room) return;

        const towers = room.find(FIND_MY_STRUCTURES, {
            filter: (s) => s.structureType === STRUCTURE_TOWER
        });

        if (towers.length === 0) return;

        for (const tower of towers) {
            this.runTower(tower);
        }
    },

    /**
     * Executes prioritized actions for an individual tower.
     * Priority: Attack Hostiles > Heal Damaged Creeps > Emergency Repair > Routine Maintenance
     * @param {StructureTower} tower
     */
    runTower: function (tower) {
        if (!tower || !tower.store || tower.store[RESOURCE_ENERGY] < 10) {
            return;
        }

        const room = tower.room;

        // 1. Priority 1: Defense - Attack Hostile Creeps
        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        if (hostiles.length > 0) {
            const targetHostile = this.selectHostileTarget(tower, hostiles);
            if (targetHostile) {
                tower.attack(targetHostile);
                return;
            }
        }

        // 2. Priority 2: Triage - Heal Damaged Friendly Creeps
        const damagedCreeps = room.find(FIND_MY_CREEPS, {
            filter: (creep) => creep.hits < creep.hitsMax
        });
        if (damagedCreeps.length > 0) {
            // Sort by lowest health percentage (most critically injured first)
            damagedCreeps.sort((a, b) => (a.hits / a.hitsMax) - (b.hits / b.hitsMax));
            tower.heal(damagedCreeps[0]);
            return;
        }

        // 3. Priority 3: Emergency Repair - Critical Structures
        if (tower.store[RESOURCE_ENERGY] >= this.config.EMERGENCY_REPAIR_THRESHOLD) {
            const criticalStructure = this.findCriticalStructure(room);
            if (criticalStructure) {
                tower.repair(criticalStructure);
                return;
            }
        }

        // 4. Priority 4: Routine Maintenance - Repair Damaged Structures
        if (tower.store[RESOURCE_ENERGY] >= this.config.ENERGY_REPAIR_THRESHOLD) {
            const maintenanceTarget = this.findMaintenanceStructure(room);
            if (maintenanceTarget) {
                tower.repair(maintenanceTarget);
                return;
            }
        }
    },

    /**
     * Prioritizes hostile targets based on threat level:
     * Medics (HEAL) > Attackers (ATTACK/RANGED_ATTACK/WORK) > Closest Hostiles
     * @param {StructureTower} tower
     * @param {Creep[]} hostiles
     * @returns {Creep|null}
     */
    selectHostileTarget: function (tower, hostiles) {
        if (!hostiles || hostiles.length === 0) return null;

        // 1. Prioritize hostiles with HEAL parts
        const healers = hostiles.filter((h) =>
            h.body && h.body.some((part) => part.type === HEAL && part.hits > 0)
        );
        if (healers.length > 0) {
            return tower.pos.findClosestByRange(healers);
        }

        // 2. Prioritize hostiles with attack/dismantle capabilities
        const attackers = hostiles.filter((h) =>
            h.body && h.body.some((part) =>
                (part.type === ATTACK || part.type === RANGED_ATTACK || part.type === WORK) && part.hits > 0
            )
        );
        if (attackers.length > 0) {
            return tower.pos.findClosestByRange(attackers);
        }

        // 3. Target closest hostile by range
        return tower.pos.findClosestByRange(hostiles);
    },

    /**
     * Finds critical structures requiring urgent repairs (e.g. critically low ramparts/walls or containers).
     * @param {Room} room
     * @returns {Structure|null}
     */
    findCriticalStructure: function (room) {
        const criticalStructures = room.find(FIND_STRUCTURES, {
            filter: (s) => {
                if (s.structureType === STRUCTURE_RAMPART || s.structureType === STRUCTURE_WALL) {
                    return s.hits < this.config.CRITICAL_HITS_THRESHOLD;
                }
                if (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_ROAD) {
                    return s.hits < s.hitsMax * 0.25;
                }
                return s.hits < s.hitsMax * 0.5;
            }
        });

        if (criticalStructures.length === 0) return null;

        // Repair the one with the lowest absolute hits
        criticalStructures.sort((a, b) => a.hits - b.hits);
        return criticalStructures[0];
    },

    /**
     * Finds damaged structures within maintenance thresholds.
     * @param {Room} room
     * @returns {Structure|null}
     */
    findMaintenanceStructure: function (room) {
        const damagedStructures = room.find(FIND_STRUCTURES, {
            filter: (s) => {
                if (s.structureType === STRUCTURE_RAMPART) {
                    return s.hits < this.config.RAMPART_MAX_HITS && s.hits < s.hitsMax;
                }
                if (s.structureType === STRUCTURE_WALL) {
                    return s.hits < this.config.WALL_MAX_HITS && s.hits < s.hitsMax;
                }
                return s.hits < s.hitsMax;
            }
        });

        if (damagedStructures.length === 0) return null;

        // Prioritize non-wall/rampart infrastructure first (roads, containers, spawns), then lowest hits
        damagedStructures.sort((a, b) => {
            const aIsWallOrRampart = a.structureType === STRUCTURE_WALL || a.structureType === STRUCTURE_RAMPART;
            const bIsWallOrRampart = b.structureType === STRUCTURE_WALL || b.structureType === STRUCTURE_RAMPART;

            if (!aIsWallOrRampart && bIsWallOrRampart) return -1;
            if (aIsWallOrRampart && !bIsWallOrRampart) return 1;

            return a.hits - b.hits;
        });

        return damagedStructures[0];
    }
};

module.exports = managerTower;
