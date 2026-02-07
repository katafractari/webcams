// Test setup - load environment variables if .env file exists
try {
  require('dotenv').config();
} catch {
  // .env file is optional for tests
}
