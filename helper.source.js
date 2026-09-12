

global.findNextContainerWithEnergy = function (creep, minEnergy = 50) {
    if (!creep || !creep.room) return null;
    const target_container = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            s.structureType === STRUCTURE_CONTAINER &&
            s.store[RESOURCE_ENERGY] >= minEnergy
    });
    if (target_container) return target_container;

    const container_Extension = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            s.structureType === STRUCTURE_CONTAINER &&
            s.store[RESOURCE_ENERGY] >= minEnergy
    });
    if (container_Extension) return container_Extension;
    
    const container_Spawn = creep.pos.findClosestByRange(FIND_STRUCTURES, {
        filter: (s) =>
            s.structureType === STRUCTURE_CONTAINER &&
            s.store[RESOURCE_ENERGY] >= minEnergy
    });
    if (container_Spawn) return container_Spawn;
    return  null;
};