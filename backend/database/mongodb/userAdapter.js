const User = require('../../models/User');

async function findUserByEmail(email) {
    if (!email) return null;
    return await User.findOne({ email: new RegExp('^' + email.trim() + '$', 'i') });
}

async function findUserById(id) {
    if (!id) return null;
    return await User.findById(id);
}

async function createUser(userData) {
    const user = new User(userData);
    return await user.save();
}

async function updateUserApprovalStatus(id, accountStatus) {
    return await User.findByIdAndUpdate(
        id,
        {
            $set: {
                accountStatus: accountStatus,
                verified: accountStatus === 'ACTIVE',
                status: accountStatus === 'ACTIVE' ? 'active' : 'inactive'
            }
        },
        { new: true }
    );
}

module.exports = {
    findUserByEmail,
    findUserById,
    createUser,
    updateUserApprovalStatus
};
