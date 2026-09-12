/**
 * Builder Role
 * Constructs buildings and repairs damaged structures according to utility and defensive priorities.
 * Automatically loads room blueprints (e.g. room.<RoomName>.js) based on the creep's current room.
 */
const managerIdle = require('manager.idle');

const BUILD_PRIORITIES = [
    STRUCTURE_TOWER,
    STRUCTURE_CONTAINER,
    STRUCTURE_EXTENSION,
    STRUCTURE_ROAD,
    STRUCTURE_WALL,
    STRUCTURE_RAMPART
];

const roleBuilder = {
    /**
     * Cache for loaded room blueprints to avoid repeated require() overhead.
     */
    roomBlueprints: {},

    /**
     * Dynamically loads and runs the blueprint module matching the room name (e.g., room.W2N2.js).
     * @param {Room} room
     */
    checkRoomBlueprint: function (room) {
        if (!room) return;
        const roomName = room.name;

        if (this.roomBlueprints[roomName] === undefined) {
            try {
                this.roomBlueprints[roomName] = require('room.' + roomName);
            } catch (e) {
                // No blueprint module exists for this room
                this.roomBlueprints[roomName] = null;
            }
        }

        const blueprint = this.roomBlueprints[roomName];
        if (blueprint && typeof blueprint.run === 'function') {
            blueprint.run(room);
        }
    },

    /**
     * Selects the highest priority construction site in the room.
     * Hierarchy: Towers -> Extensions -> Containers -> Walls/Ramparts -> Roads -> Other sites.
     * Automatically attempts to place blueprint sites if none or few are present.
     * @param {Creep} creep
     * @returns {ConstructionSite|null}
     */
    getTargetConstructionSite: function (creep) {
        let sites = creep.room.find(FIND_CONSTRUCTION_SITES);

        // If no sites or fewer than 3 active sites, check room blueprint for new placements
        if (sites.length < 3) {
            this.checkRoomBlueprint(creep.room);
            sites = creep.room.find(FIND_CONSTRUCTION_SITES);
        }

        if (sites.length === 0) return null;

        for (const structureType of BUILD_PRIORITIES) {
            const matching = sites.filter((s) => s.structureType === structureType);
            if (matching.length > 0) {
                return creep.pos.findClosestByPath(matching);
            }
        }

        return creep.pos.findClosestByPath(sites);
    },

    /** @param {Creep} creep **/
    run: function (creep) {
        if (creep.memory.building && creep.store[RESOURCE_ENERGY] === 0) {
            creep.memory.building = false;
            creep.say('🔄 harvest');
        }
        if (!creep.memory.building && creep.store.getFreeCapacity() === 0) {
            creep.memory.building = true;
            creep.say('🚧 build');
        }

        if (creep.memory.building) {
            // Find construction sites by utility priority
            const targetSite = this.getTargetConstructionSite(creep);
            if (targetSite) {
                if (creep.build(targetSite) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(targetSite, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffffff' }
                    });
                }
            } else {
                // If no construction sites, repair damaged structures (excluding full HP walls/ramparts)
                const repairTarget = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                    filter: (s) => {
                        if (s.structureType === STRUCTURE_WALL || s.structureType === STRUCTURE_RAMPART) {
                            return s.hits < 50000; // Keep defensive structures fortified to a sensible threshold
                        }
                        return s.hits < s.hitsMax;
                    }
                });

                if (repairTarget) {
                    if (creep.repair(repairTarget) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(repairTarget, {
                            reusePath: 15,
                            visualizePathStyle: { stroke: '#ffffff' }
                        });
                    }
                } else if (creep.room.controller) {
                    // Fallback to upgrading controller if nothing to build/repair
                    if (creep.upgradeController(creep.room.controller) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(creep.room.controller, {
                            reusePath: 15,
                            visualizePathStyle: { stroke: '#ffffff' }
                        });
                    }
                } else {
                    managerIdle.park(creep);
                }
            }
        } else {
            // Check storage / containers with energy first
            const energySource = creep.pos.findClosestByPath(FIND_STRUCTURES, {
                filter: (s) =>
                    (s.structureType === STRUCTURE_CONTAINER || s.structureType === STRUCTURE_STORAGE) &&
                    s.store[RESOURCE_ENERGY] > 50
            });

            if (energySource) {
                if (creep.withdraw(energySource, RESOURCE_ENERGY) === ERR_NOT_IN_RANGE) {
                    creep.moveTo(energySource, {
                        reusePath: 15,
                        visualizePathStyle: { stroke: '#ffaa00' }
                    });
                }
            } else {
                // Otherwise harvest from active energy sources
                const source = creep.pos.findClosestByPath(FIND_SOURCES_ACTIVE);
                if (source) {
                    if (creep.harvest(source) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(source, {
                            reusePath: 15,
                            visualizePathStyle: { stroke: '#ffaa00' }
                        });
                    }
                } else {
                    managerIdle.park(creep);
                }
            }
        }
    }
};

module.exports = roleBuilder;
