import express from 'express';

const app = express();
const port = 3000;
const routes = require('./routes/service');
const cors = require('cors');

app.use(cors());
app.use(express.json());

app.use('/', routes);

app.listen(port, () => {
  return console.log(`server is listening on ${port}`);
});
