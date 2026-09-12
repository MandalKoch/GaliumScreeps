/**
 * Room W2N2 Layout & Construction Blueprint
 * Stores planned structures and automatically places construction sites for builders.
 */
const roomW2N2 = {
    roomName: 'W2N2',

    /**
     * List of planned constructions for room W2N2.
     * Add your planned structures here with:
     * - type / structureType: Structure constant (e.g. STRUCTURE_EXTENSION, STRUCTURE_CONTAINER, STRUCTURE_TOWER, STRUCTURE_ROAD)
     * - x: X coordinate (0-49)
     * - y: Y coordinate (0-49)
     * - minRcl: (optional) Minimum Controller Level required (default: 1)
     *
     * Example:
     * { type: STRUCTURE_CONTAINER, x: 20, y: 25, minRcl: 2 },
     * { type: STRUCTURE_EXTENSION, x: 23, y: 21, minRcl: 2 },
     * { type: STRUCTURE_TOWER, x: 25, y: 23, minRcl: 3 },
     * { type: STRUCTURE_ROAD, x: 24, y: 20, minRcl: 1 }
     */
    constructions: [
        // Populate your planned buildings here:
    ],

    /**
     * Programmatically add a new planned construction to room W2N2.
     * @param {string} structureType
     * @param {number} x
     * @param {number} y
     * @param {number} [minRcl=1]
     */
    addConstruction: function (structureType, x, y, minRcl = 1) {
        this.constructions.push({
            type: structureType,
            x: x,
            y: y,
            minRcl: minRcl
        });
    },

    /**
     * Checks planned constructions and places construction sites in the room
     * when the room controller level allows and structures are not yet built.
     * @param {Room} room
     * @param {number} [maxSitesToCreate=5] Maximum active construction sites to maintain in the room
     */
    run: function (room, maxSitesToCreate = 5) {
        if (!room || room.name !== this.roomName) return;
        if (!room.controller || !room.controller.my) return;
        if (this.constructions.length === 0) return;

        const currentRcl = room.controller.level;
        const currentSites = room.find(FIND_CONSTRUCTION_SITES);

        // Limit concurrent construction sites in room to avoid hitting global limits
        if (currentSites.length >= maxSitesToCreate) {
            return;
        }

        let sitesCreated = 0;
        const availableSlots = maxSitesToCreate - currentSites.length;

        for (const item of this.constructions) {
            if (sitesCreated >= availableSlots) {
                break;
            }

            const reqRcl = item.minRcl || item.rcl || 1;
            if (reqRcl > currentRcl) {
                continue;
            }

            const structType = item.type || item.structureType;
            if (!structType) continue;

            const x = item.x;
            const y = item.y;

            // 1. Check if structure already exists at position
            const structuresAtPos = room.lookForAt(LOOK_STRUCTURES, x, y);
            const alreadyBuilt = structuresAtPos.some((s) => s.structureType === structType);
            if (alreadyBuilt) {
                continue;
            }

            // 2. Check if construction site already exists at position
            const sitesAtPos = room.lookForAt(LOOK_CONSTRUCTION_SITES, x, y);
            const siteAlreadyPlaced = sitesAtPos.some((s) => s.structureType === structType);
            if (siteAlreadyPlaced) {
                continue;
            }

            // 3. Place construction site
            const result = room.createConstructionSite(x, y, structType);
            if (result === OK) {
                console.log(`[Room ${this.roomName}] Placed construction site: ${structType} at (${x}, ${y}) [RCL ${reqRcl}]`);
                sitesCreated++;
            } else if (result === ERR_RCL_NOT_ENOUGH) {
                // Reached max structure count for current RCL
                continue;
            } else if (result === ERR_FULL) {
                // Too many construction sites globally
                break;
            } else if (result === ERR_INVALID_TARGET) {
                // Obstructed or invalid placement
                continue;
            }
        }
    }
};

module.exports = roomW2N2;
