const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '../../.env') });
const app = require('./app');

const port = Number(process.env.EMAIL_SERVICE_PORT || 3001);
app.listen(port, () => console.log(`Email Generation Service listening on port ${port}`));