const User = require('../models/User');
const { isValidObjectId } = require('../utils/validateId');

const getAll = async (req, res) => {
  const users = await User.find().lean();
  res.json({ success: true, data: users });
};

const getById = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid user id' });
  }
  const user = await User.findById(id).lean();
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, data: user });
};

/**
 * Save: id exist karti h to 1 query me update, nahi to create.
 */
const save = async (req, res) => {
  const { id, name, email } = req.body;
  if (!name || !email) {
    return res.status(400).json({ success: false, message: 'name and email required' });
  }
  const payload = { name: name.trim(), email: email.trim() };

  if (id) {
    if (!isValidObjectId(id)) {
      return res.status(400).json({ success: false, message: 'Invalid user id' });
    }
    const user = await User.findByIdAndUpdate(id, payload, { new: true, runValidators: true }).lean();
    if (user) return res.json({ success: true, data: user, created: false });
  }

  try {
    const user = await User.create(payload);
    res.status(201).json({ success: true, data: user.toObject(), created: true });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already exists' });
    }
    throw err;
  }
};

const remove = async (req, res) => {
  const { id } = req.params;
  if (!isValidObjectId(id)) {
    return res.status(400).json({ success: false, message: 'Invalid user id' });
  }
  const user = await User.findByIdAndDelete(id);
  if (!user) return res.status(404).json({ success: false, message: 'User not found' });
  res.json({ success: true, message: 'User deleted' });
};

module.exports = { getAll, getById, save, remove };
