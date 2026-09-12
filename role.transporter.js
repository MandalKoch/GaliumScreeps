/**
 * Fast Transporter Role
 * Moves resources directly from a designated source container to a target container/structure.
 * Utilizes high-speed CARRY:MOVE body ratios to maximize delivery speed.
 */
const managerIdle = require('manager.idle');
const managerTransporter = require('manager.transporter');

const roleTransporter = {
    /**
     * Helper to resolve a container or structure target from an ID string, name, keyword, or {x, y} coordinate object.
     * @param {Room} room
     * @param {string|{x: number, y: number, room?: string}} targetRef
     * @param {string} [purpose='deliver'] 'deliver' or 'fetch'
     * @returns {Structure|null}
     */
    resolveTarget: function (room, targetRef, purpose = 'deliver') {
        if (!targetRef || !room) return null;

        // If string: ID, spawn name, or generic keyword ('spawn', 'spawns', 'extensions')
        if (typeof targetRef === 'string') {
            // Check if direct ID
            const obj = Game.getObjectById(targetRef);
            if (obj) return obj;

            // Check if named spawn in Game.spawns
            if (Game.spawns[targetRef]) {
                const sp = Game.spawns[targetRef];
                if (purpose === 'deliver' && sp.store.getFreeCapacity(RESOURCE_ENERGY) === 0) {
                    // If named spawn is full, check for empty extensions in the same room
                    const emptyExt = room.find(FIND_STRUCTURES, {
                        filter: (s) => s.structureType === STRUCTURE_EXTENSION && s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    });
                    if (emptyExt.length > 0) {
                        return sp.pos.findClosestByRange(emptyExt);
                    }
                }
                return sp;
            }

            // Generic keyword 'spawn' or 'spawns'
            if (targetRef === 'spawn' || targetRef === 'spawns') {
                if (purpose === 'deliver') {
                    // Priority: Spawns/Extensions needing energy
                    const targets = room.find(FIND_STRUCTURES, {
                        filter: (s) =>
                            (s.structureType === STRUCTURE_SPAWN || s.structureType === STRUCTURE_EXTENSION) &&
                            s.store.getFreeCapacity(RESOURCE_ENERGY) > 0
                    });
                    if (targets.length > 0) {
                        return targets[0];
                    }
                }
                // Fallback to any spawn in room
                const allSpawns = room.find(FIND_MY_SPAWNS);
                return allSpawns.length > 0 ? allSpawns[0] : null;
            }

            return null;
        }

        // If coordinate object { x, y }
        if (typeof targetRef === 'object' && targetRef.x !== undefined && targetRef.y !== undefined) {
            const targetRoomName = targetRef.room || room.name;
            const targetRoom = Game.rooms[targetRoomName] || room;
            const structures = targetRoom.lookForAt(LOOK_STRUCTURES, targetRef.x, targetRef.y);

            // Look for container, storage, spawn, extension, tower, or any structure with a store
            const match = structures.find(
                (s) =>
                    s.structureType === STRUCTURE_CONTAINER ||
                    s.structureType === STRUCTURE_STORAGE ||
                    s.structureType === STRUCTURE_SPAWN ||
                    s.structureType === STRUCTURE_EXTENSION ||
                    s.structureType === STRUCTURE_TOWER ||
                    (s.store !== undefined)
            );
            return match || (structures.length > 0 ? structures[0] : null);
        }

        return null;
    },

    /** @param {Creep} creep **/
    run: function (creep) {
        // Auto-resolve route definition if from/to are missing in creep memory
        if (creep.memory.route && (!creep.memory.from || !creep.memory.to)) {
            const routeConfig = managerTransporter.routes.find(
                (r) => r.name === creep.memory.route && (r.room === creep.room.name || !r.room)
            );
            if (routeConfig) {
                creep.memory.from = creep.memory.from || routeConfig.from;
                creep.memory.to = creep.memory.to || routeConfig.to;
                creep.memory.resourceType = creep.memory.resourceType || routeConfig.resourceType || RESOURCE_ENERGY;
            }
        }

        const resourceType = creep.memory.resourceType || RESOURCE_ENERGY;

        // State toggles
        if (creep.memory.delivering && creep.store[resourceType] === 0) {
            creep.memory.delivering = false;
            creep.say('📦 fetch');
        }
        if (!creep.memory.delivering && creep.store.getFreeCapacity(resourceType) === 0) {
            creep.memory.delivering = true;
            creep.say('⚡ deliver');
        }

        if (creep.memory.delivering) {
            // Deliver phase: Transport to destination container / spawn / structure
            let targetStructure = this.resolveTarget(creep.room, creep.memory.to, 'deliver');

            if (targetStructure) {
                // If target is spawn and full, check if any extensions need energy
                if (
                    targetStructure.structureType === STRUCTURE_SPAWN &&
                    targetStructure.store &&
                    targetStructure.store.getFreeCapacity(resourceType) === 0
                ) {
                    const ext = creep.pos.findClosestByRange(FIND_STRUCTURES, {
                        filter: (s) =>
                            s.structureType === STRUCTURE_EXTENSION &&
                            s.store.getFreeCapacity(resourceType) > 0
                    });
                    if (ext) {
                        targetStructure = ext;
                    }
                }

                // Check if target has capacity
                if (targetStructure.store && targetStructure.store.getFreeCapacity(resourceType) > 0) {
                    if (creep.transfer(targetStructure, resourceType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(targetStructure, {
                            reusePath: 15,
                            visualizePathStyle: { stroke: '#00ff88' }
                        });
                    }
                    return;
                } else {
                    // Target is full: wait nearby without blocking
                    if (!creep.pos.inRangeTo(targetStructure, 2)) {
                        creep.moveTo(targetStructure, {
                            reusePath: 15,
                            visualizePathStyle: { stroke: '#888888', lineStyle: 'dashed' }
                        });
                    }
                    creep.say('⏳ full');
                    return;
                }
            } else {
                // Target structure not found, park
                managerIdle.park(creep);
            }
        } else {
            // Fetch phase: Withdraw from source container
            const sourceStructure = this.resolveTarget(creep.room, creep.memory.from, 'fetch');

            if (sourceStructure) {
                const storedAmount = sourceStructure.store ? sourceStructure.store[resourceType] || 0 : 0;

                if (storedAmount > 0) {
                    if (creep.withdraw(sourceStructure, resourceType) === ERR_NOT_IN_RANGE) {
                        creep.moveTo(sourceStructure, {
                            reusePath: 15,
                            visualizePathStyle: { stroke: '#ffaa00' }
                        });
                    }
                    return;
                } else {
                    // Source container is currently empty
                    if (creep.store[resourceType] > 0) {
                        // Deliver what is already held early
                        creep.memory.delivering = true;
                        return;
                    }

                    // Wait near source container or park
                    if (!creep.pos.inRangeTo(sourceStructure, 2)) {
                        creep.moveTo(sourceStructure, {
                            reusePath: 15,
                            visualizePathStyle: { stroke: '#888888', lineStyle: 'dashed' }
                        });
                    }
                    return;
                }
            } else {
                managerIdle.park(creep);
            }
        }
    }
};

module.exports = roleTransporter;
