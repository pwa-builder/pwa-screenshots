import express from 'express';

const app = express();
const port = 3000;
const routes = require('./routes/service');
const cors = require('cors');
app.use(cors());
app.use('/', routes);
app.listen(port, (err) => {
  if (err) {
    return console.error(err);
  }
  return console.log(`server is listening on ${port}`);
});
