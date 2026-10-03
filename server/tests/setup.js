const mongoose = require('mongoose');
const { MongoMemoryServer } = require('mongodb-memory-server');

let mongo;

// Mocha root hooks: one in-memory MongoDB for the whole run, emptied after every test.
exports.mochaHooks = {
  async beforeAll() {
    mongo = await MongoMemoryServer.create();
    await mongoose.connect(mongo.getUri());
    await Promise.all(Object.values(mongoose.models).map((m) => m.init()));
  },
  async afterEach() {
    const collections = await mongoose.connection.db.collections();
    await Promise.all(collections.map((c) => c.deleteMany({})));
  },
  async afterAll() {
    await mongoose.disconnect();
    if (mongo) await mongo.stop();
  },
};
