const app = require("./app");
const config = require("./config");
const connectDB = require("./config/db");

const start = async () => {
  await connectDB();
  app.listen(config.port, () => {
    console.log(`Server running on http://localhost:${config.port}`);
    console.log(`API docs (Scalar): http://localhost:${config.port}/reference`);
  });
};

start().catch((err) => {
  console.error(err);
  process.exit(1);
});
