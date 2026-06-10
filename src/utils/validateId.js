const mongoose = require('mongoose');

/**
 * Valid MongoDB ObjectId check - invalid pe DB query avoid.
 */
const isValidObjectId = (id) => {
  if (!id || typeof id !== 'string') return false;
  return mongoose.Types.ObjectId.isValid(id) && String(new mongoose.Types.ObjectId(id)) === id;
};

module.exports = { isValidObjectId };
