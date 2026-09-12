/**
 * Idle / Parking Manager & Config
 * Allows defining idle flags or parking locations per room so creeps don't block spawns.
 */
const managerIdle = {
    /**
     * Dictionary mapping room names to flag names or target locations.
     * Users can define room-specific parking flags here.
     * Example:
     * {
     *   'W1N1': 'Idle_W1N1',
     *   'sim': 'Idle_sim'
     * }
     */
    roomFlags: {'W2N2': 'idle_W2N2'},

    /**
     * Move an idle creep to its designated parking spot or away from critical structures.
     * @param {Creep} creep
     */
    park: function (creep) {
        // 1. Check explicitly configured flag name in the dictionary
        const configuredFlagName = this.roomFlags[creep.room.name];
        if (configuredFlagName && Game.flags[configuredFlagName]) {
            const flag = Game.flags[configuredFlagName];
            if (!creep.pos.inRangeTo(flag, 1)) {
                creep.moveTo(flag, {
                    reusePath: 15,
                    visualizePathStyle: { stroke: '#888888', lineStyle: 'dashed' }
                });
            }
            creep.say('💤 idle');
            return;
        }

        // 2. Check generic naming conventions: "Idle_<RoomName>", "Idle", or "Parking"
        const defaultFlag =
            Game.flags[`Idle_${creep.room.name}`] ||
            Game.flags[`idle_${creep.room.name}`] ||
            Game.flags['Idle'] ||
            Game.flags['idle'] ||
            Game.flags['Parking'];

        if (defaultFlag && (!defaultFlag.room || defaultFlag.room.name === creep.room.name)) {
            if (!creep.pos.inRangeTo(defaultFlag, 1)) {
                creep.moveTo(defaultFlag, {
                    reusePath: 15,
                    visualizePathStyle: { stroke: '#888888', lineStyle: 'dashed' }
                });
            }
            creep.say('💤 idle');
            return;
        }

        // 3. Fallback: If within 2 tiles of any spawn, step away to keep spawn clear
        const spawns = creep.room.find(FIND_MY_SPAWNS);
        for (const spawn of spawns) {
            if (creep.pos.inRangeTo(spawn, 2)) {
                const fleePath = PathFinder.search(
                    creep.pos,
                    { pos: spawn.pos, range: 4 },
                    { flee: true }
                );
                if (fleePath.path.length > 0) {
                    creep.moveByPath(fleePath.path);
                    creep.say('💤 clear');
                    return;
                }
            }
        }
    }
};

module.exports = managerIdle;
