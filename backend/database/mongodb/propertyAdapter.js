const Property = require('../../models/Property');

async function findPropertyById(id) {
    if (!id) return null;
    return await Property.findById(id).populate('owner', 'name email');
}

async function listProperties(filter = {}) {
    return await Property.find(filter).populate('owner', 'name email');
}

module.exports = {
    findPropertyById,
    listProperties
};
