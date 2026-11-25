// Makes API output tidy: _id becomes id and __v is removed.
module.exports = (schema) => {
  schema.set('toJSON', {
    versionKey: false,
    transform: (doc, ret) => { ret.id = ret._id; delete ret._id; return ret; },
  });
  return schema;
};
