/**
 * Fast Transporter & Route Manager
 * Defines container-to-container transportation routes and population quotas.
 */
const managerTransporter = {
    /**
     * Define container-to-container or container-to-spawn transportation routes here.
     * Each route entry supports:
     * - name: (string) Unique identifier for the route (e.g., 'source_to_spawn', 'source_to_controller')
     * - room: (string) Target room name (e.g., 'W2N2')
     * - from: (string|{x: number, y: number, room?: string}) Source container ID or coordinate object
     * - to:   (string|{x: number, y: number, room?: string}) Destination target:
     *         * 'spawn' or 'spawns' (automatically delivers to Spawn/Extensions needing energy)
     *         * Specific spawn name (e.g., 'Spawn1')
     *         * Container / Storage ID or coordinate object {x, y}
     * - count: (number) Target number of fast transporter creeps assigned to this route
     * - resourceType: (string, optional) Resource type to transport (default: RESOURCE_ENERGY)
     *
     * Example Routes:
     * [
     *     // Route 1: Haul from source container directly to Spawn / Extensions
     *     {
     *         name: 'source1_to_spawn',
     *         room: 'W2N2',
     *         from: { x: 21, y: 24 }, // Source container position or ID
     *         to: 'spawn',            // Delivers to Spawns & Extensions
     *         count: 1
     *     },
     *     // Route 2: Haul from source container to controller container for Upgraders
     *     {
     *         name: 'source1_to_controller',
     *         room: 'W2N2',
     *         from: { x: 21, y: 24 }, // Source container position
     *         to: { x: 28, y: 32 },   // Container next to controller
     *         count: 1
     *     }
     * ]
     */
    routes: [
        // Populate your routes here
        {
            name: 'harvestcontainer_to_spawn',
            room: 'W2N2',
            from: { x: 10, y: 26 }, // Source container position or ID
            to: 'spawn',            // Delivers to Spawns & Extensions
            count: 1
        }
    ],

    /**
     * Programmatically add or update a route.
     * @param {Object} route
     */
    addRoute: function (route) {
        if (!route || !route.name || !route.room) return;
        const existingIndex = this.routes.findIndex((r) => r.name === route.name && r.room === route.room);
        if (existingIndex >= 0) {
            this.routes[existingIndex] = route;
        } else {
            this.routes.push(route);
        }
    },

    /**
     * Retrieves all configured routes for a specific room.
     * @param {string} roomName
     * @returns {Object[]}
     */
    getRoutesForRoom: function (roomName) {
        return this.routes.filter((r) => r.room === roomName);
    },

    /**
     * Checks if any configured route in the room needs more transporter creeps.
     * @param {Room} room
     * @returns {Object|null} The next route object needing a creep, or null if all quotas met.
     */
    getNextRouteToSpawn: function (room) {
        if (!room) return null;
        const roomRoutes = this.getRoutesForRoom(room.name);
        if (roomRoutes.length === 0) return null;

        const creeps = room.find(FIND_MY_CREEPS, {
            filter: (c) => c.memory.role === 'transporter' && !c.memory.retire && !c.memory.suicide
        });

        for (const route of roomRoutes) {
            const targetCount = route.count !== undefined ? route.count : 1;
            const currentCount = creeps.filter((c) => c.memory.route === route.name).length;

            if (currentCount < targetCount) {
                return route;
            }
        }

        return null;
    }
};

module.exports = managerTransporter;
