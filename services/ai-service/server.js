const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const app = require('./app');

const port = Number(process.env.AI_SERVICE_PORT || 3002);
app.listen(port, () => console.log(`AI Generation Service listening on port ${port}`));