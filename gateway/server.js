const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../.env') });
const app = require('./app');

const port = Number(process.env.GATEWAY_PORT || process.env.PORT || 3000);
app.listen(port, () => console.log(`API Gateway listening on port ${port}`));