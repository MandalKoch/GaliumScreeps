/**
 * Spawner Manager
 * Handles population limits, dynamic body scaling, and emergency creep recovery.
 */
const managerTransporter = require('manager.transporter');

const managerSpawner = {
    /**
     * Helper to generate body parts dynamically based on max energy capacity.
     * @param {number} energyCapacity
     * @param {string} role
     * @returns {string[]}
     */
    getBodyParts: function (energyCapacity, role) {
        if (role === 'transporter') {
            const segments = Math.min(Math.floor(energyCapacity / 100), 5);
            const body = [];
            for (let i = 0; i < Math.max(segments, 1); i++) {
                body.push(CARRY, MOVE);
            }
            return body;
        }

        if (role === 'defender' || role === 'warrior') {
            if (energyCapacity >= 300) {
                return [TOUGH, TOUGH, ATTACK, ATTACK, MOVE, MOVE];
            } else if (energyCapacity >= 140) {
                return [TOUGH, ATTACK, MOVE];
            }
            return [ATTACK, MOVE];
        }

        // Base cost: WORK=100, CARRY=50, MOVE=50
        // Standard worker segment: [WORK, CARRY, MOVE] = 200 energy
        const segmentCost = 200;
        const maxSegments = Math.min(Math.floor(energyCapacity / segmentCost), 8); // Cap at 8 segments (1600 energy)
        const segments = Math.max(maxSegments, 1);

        const body = [];
        for (let i = 0; i < segments; i++) {
            body.push(WORK);
            body.push(CARRY);
            body.push(MOVE);
        }
        return body;
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
        const upgraders = creeps.filter((c) => c.memory.role === 'upgrader');
        const builders = creeps.filter((c) => c.memory.role === 'builder');
        const defenders = creeps.filter((c) => c.memory.role === 'defender' || c.memory.role === 'warrior');

        // Population targets
        const minHarvesters = 2;
        const minUpgraders = 3;
        const constructionSites = room.find(FIND_CONSTRUCTION_SITES);
        const minBuilders = constructionSites.length > 0 ? 2 : 1;

        const hostiles = room.find(FIND_HOSTILE_CREEPS);
        const hasDefendFlag = !!(
            Game.flags['defend'] ||
            Game.flags['Defend'] ||
            Game.flags[`defend_${room.name}`] ||
            Game.flags[`Defend_${room.name}`] ||
            Object.keys(Game.flags).some((f) => f.toLowerCase().includes('defend'))
        );
        const minDefenders = (hasDefendFlag || hostiles.length > 0) ? (hostiles.length > 0 ? 2 : 1) : 0;

        // Emergency Recovery: If no harvesters exist and energy is below capacity, spawn a minimal body
        if (harvesters.length === 0) {
            const emergencyBody = [WORK, CARRY, MOVE]; // 200 energy
            if (room.energyAvailable >= 200) {
                const name = 'Harvester_Emergency_' + Game.time;
                console.log(`[Spawner] Spawning emergency harvester: ${name}`);
                spawn.spawnCreep(emergencyBody, name, {
                    memory: { role: 'harvester', version: 1 }
                });
            }
            return;
        }

        // Only spawn full-capacity creeps when room energy has reached capacity
        const targetEnergy = room.energyCapacityAvailable;
        if (room.energyAvailable < targetEnergy && room.energyAvailable < 300) {
            return;
        }

        const routeToSpawn = managerTransporter.getNextRouteToSpawn(room);

        let roleToSpawn = null;
        let prefix = '';
        let spawnMemory = null;

        if (harvesters.length < minHarvesters) {
            roleToSpawn = 'harvester';
            prefix = 'Harvester';
        } else if (hostiles.length > 0 && defenders.length < minDefenders) {
            roleToSpawn = 'defender';
            prefix = 'Defender';
        } else if (routeToSpawn) {
            roleToSpawn = 'transporter';
            prefix = `Transporter_${routeToSpawn.name}`;
            spawnMemory = {
                role: 'transporter',
                route: routeToSpawn.name,
                from: routeToSpawn.from,
                to: routeToSpawn.to,
                resourceType: routeToSpawn.resourceType || RESOURCE_ENERGY,
                version: 1
            };
        } else if (defenders.length < minDefenders) {
            roleToSpawn = 'defender';
            prefix = 'Defender';
        } else if (upgraders.length < minUpgraders) {
            roleToSpawn = 'upgrader';
            prefix = 'Upgrader';
        } else if (builders.length < minBuilders) {
            roleToSpawn = 'builder';
            prefix = 'Builder';
        }

        if (roleToSpawn && room.energyAvailable >= targetEnergy) {
            const body = this.getBodyParts(targetEnergy, roleToSpawn);
            const name = `${prefix}_${Game.time}`;
            const memory = spawnMemory || { role: roleToSpawn, version: 1 };
            const result = spawn.spawnCreep(body, name, { memory: memory });

            if (result === OK) {
                console.log(`[Spawner] Spawning ${roleToSpawn} (${name}) with body: ${JSON.stringify(body)}`);
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

module.exports = managerSpawner;
