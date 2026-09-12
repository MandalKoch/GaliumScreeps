/**
 * Spawner Manager (RCL 2+)
 * Handles population limits, dynamic body scaling, version tracking, and unit upgrades.
 */
const managerSuicide = require('manager.suicide');
const managerTransporter = require('manager.transporter');

const managerSpawnerRcl2 = {
    version: 2,

    /**
     * Helper to generate body parts dynamically based on max energy capacity.
     * @param {number} energyCapacity
     * @param {string} role
     * @returns {string[]}
     */
    getBodyParts: function (energyCapacity, role) {
        let energy = energyCapacity;
        const body = [];

        switch (role) {
            case 'transporter': {
                // High-speed transporter with 1:1 CARRY:MOVE ratio (100 energy per segment)
                const segments = Math.min(Math.floor(energy / 100), 10);
                for (let i = 0; i < segments; i++) {
                    body.push(CARRY, MOVE);
                }
                break;
            }
            case 'carrier':
            case 'hauler': {
                // High CARRY and MOVE ratio (2 CARRY : 1 MOVE = 150 energy)
                const segments = Math.floor(energy / 150);
                for (let i = 0; i < segments; i++) {
                    body.push(CARRY, CARRY, MOVE);
                    energy -= 150;
                }
                while (energy >= 100) {
                    body.push(CARRY, MOVE);
                    energy -= 100;
                }
                if (energy >= 50) {
                    body.push(CARRY);
                    energy -= 50;
                }
                break;
            }
            case 'upgrader': {
                // Focus: Heavy WORK with sufficient CARRY & MOVE to maximize upgrading per tick
                if (energy >= 550) {
                    body.push(WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE);
                } else if (energy >= 400) {
                    body.push(WORK, WORK, CARRY, CARRY, MOVE, MOVE);
                } else if (energy >= 300) {
                    body.push(WORK, WORK, CARRY, MOVE);
                } else {
                    body.push(WORK, CARRY, MOVE);
                }
                break;
            }
            case 'builder': {
                // Balanced WORK, CARRY, MOVE for construction and maintenance
                if (energy >= 550) {
                    body.push(WORK, WORK, WORK, CARRY, CARRY, MOVE, MOVE, MOVE);
                } else if (energy >= 400) {
                    body.push(WORK, WORK, CARRY, CARRY, MOVE, MOVE);
                } else if (energy >= 300) {
                    body.push(WORK, CARRY, CARRY, MOVE, MOVE);
                } else {
                    body.push(WORK, CARRY, MOVE);
                }
                break;
            }
            case 'harvester':
            default: {
                // Heavy WORK miner/harvester to extract energy quickly
                if (energy >= 550) {
                    body.push(WORK, WORK, WORK, WORK, CARRY, MOVE, MOVE);
                } else if (energy >= 400) {
                    body.push(WORK, WORK, WORK, CARRY, MOVE);
                } else if (energy >= 300) {
                    body.push(WORK, WORK, CARRY, MOVE);
                } else {
                    body.push(WORK, CARRY, MOVE);
                }
                break;
            }
        }

        return body.length > 0 ? body : [WORK, CARRY, MOVE];
    },

    /**
     * Retires (marks for graceful suicide/recycling) a version 1 / outdated creep of the given role in the room.
     * @param {Room} room
     * @param {string} role
     * @returns {Creep|null} The creep that was retired, or null if none found.
     */
    retireVersion1Unit: function (room, role) {
        const outdatedUnits = room.find(FIND_MY_CREEPS, {
            filter: (c) =>
                c.memory.role === role &&
                (!c.memory.version || c.memory.version < this.version) &&
                !c.memory.retire &&
                !c.memory.suicide
        });

        if (outdatedUnits.length > 0) {
            // Find the oldest unit (lowest remaining ticks to live)
            const target = outdatedUnits.reduce((oldest, current) =>
                ((current.ticksToLive || 1500) < (oldest.ticksToLive || 1500) ? current : oldest), outdatedUnits[0]);

            console.log(`[Spawner] Marking version 1 ${role} for retirement: ${target.name} (TTL: ${target.ticksToLive || 'N/A'})`);
            managerSuicide.retire(target);
            return target;
        }

        return null;
    },

    /**
     * Run spawner logic for each spawn/room.
     * @param {StructureSpawn} spawn
     */
    run: function (spawn) {
        if (!spawn || spawn.spawning) {
            return;
        }

        const room = spawn.room;
        const creeps = room.find(FIND_MY_CREEPS);

        const harvesters = creeps.filter((c) => c.memory.role === 'harvester');
        const carriers = creeps.filter((c) => c.memory.role === 'carrier' || c.memory.role === 'hauler');
        const upgraders = creeps.filter((c) => c.memory.role === 'upgrader');
        const builders = creeps.filter((c) => c.memory.role === 'builder');

        // Filter active up-to-date creeps (excluding any marked for retirement)
        const activeHarvesters = harvesters.filter((c) => c.memory.version === this.version && !c.memory.retire && !c.memory.suicide);
        const activeCarriers = carriers.filter((c) => c.memory.version === this.version && !c.memory.retire && !c.memory.suicide);
        const activeUpgraders = upgraders.filter((c) => c.memory.version === this.version && !c.memory.retire && !c.memory.suicide);
        const activeBuilders = builders.filter((c) => c.memory.version === this.version && !c.memory.retire && !c.memory.suicide);

        // Population targets
        const minHarvesters = 2;
        const minCarriers = 2;
        const minUpgraders = 8;
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        const minBuilders = constructionSites.length > 0 ? 4 : 1;

        // Emergency Recovery: If no harvesters exist at all and energy is below capacity, spawn a minimal body
        if (harvesters.length === 0) {
            const emergencyBody = [WORK, CARRY, MOVE]; // 200 energy
            if (room.energyAvailable >= 200) {
                const name = 'Harvester_Emergency_' + Game.time;
                console.log(`[Spawner] Spawning emergency harvester: ${name}`);
                const res = spawn.spawnCreep(emergencyBody, name, {
                    memory: { role: 'harvester', version: this.version }
                });
                if (res === OK) {
                    this.retireVersion1Unit(room, 'harvester');
                }
            }
            return;
        }

        // Only spawn full-capacity creeps when room energy has reached capacity
        const targetEnergy = room.energyCapacityAvailable;
        if (room.energyAvailable < targetEnergy && room.energyAvailable < 300) {
            return;
        }

        // Check if any defined transportation routes need creeps
        const routeToSpawn = managerTransporter.getNextRouteToSpawn(room);

        let roleToSpawn = null;
        let prefix = '';
        let spawnMemory = null;

        if (activeHarvesters.length < minHarvesters) {
            roleToSpawn = 'harvester';
            prefix = `Harvester_v${this.version}`;
        } else if (activeCarriers.length < minCarriers) {
            roleToSpawn = 'carrier';
            prefix = `Carrier_v${this.version}`;
        } else if (routeToSpawn) {
            roleToSpawn = 'transporter';
            prefix = `Transporter_${routeToSpawn.name}_v${this.version}`;
            spawnMemory = {
                role: 'transporter',
                route: routeToSpawn.name,
                from: routeToSpawn.from,
                to: routeToSpawn.to,
                resourceType: routeToSpawn.resourceType || RESOURCE_ENERGY,
                version: this.version
            };
        } else if (activeUpgraders.length < minUpgraders) {
            roleToSpawn = 'upgrader';
            prefix = `Upgrader_v${this.version}`;
        } else if (activeBuilders.length < minBuilders) {
            roleToSpawn = 'builder';
            prefix = `Builder_v${this.version}`;
        }

        if (roleToSpawn && room.energyAvailable >= targetEnergy) {
            const body = this.getBodyParts(targetEnergy, roleToSpawn);
            const name = `${prefix}_${Game.time}`;
            const memory = spawnMemory || { role: roleToSpawn, version: this.version };
            const result = spawn.spawnCreep(body, name, { memory: memory });

            if (result === OK) {
                console.log(`[Spawner] Spawning ${roleToSpawn} v${this.version} (${name}) with body: ${JSON.stringify(body)}`);
                // Suicide/retire a version 1 unit with this role to replace it with the new RCL 2 unit
                const retired = this.retireVersion1Unit(room, roleToSpawn);
                if (!retired && (roleToSpawn === 'carrier' || roleToSpawn === 'transporter')) {
                    // Retiring older hybrid harvesters as specialized carriers/transporters come online
                    this.retireVersion1Unit(room, 'harvester');
                }
            }
        }

        // Display spawning notification above spawn
        if (spawn.spawning) {
            const spawningCreep = Game.creeps[spawn.spawning.name];
            spawn.room.visual.text(
                '🛠️ ' + (spawningCreep ? spawningCreep.memory.role : 'spawning'),
                spawn.pos.x + 1,
                spawn.pos.y,
                { align: 'left', opacity: 0.8 }
            );
        }
    }
};

module.exports = managerSpawnerRcl2;
