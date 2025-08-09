// migrate-passwords.js
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');

// Path to users.json
const usersPath = path.join(__dirname, 'data', 'users.json');

// Read current users
function readUsers() {
  return JSON.parse(fs.readFileSync(usersPath, 'utf8'));
}

// Write updated users
function writeUsers(users) {
  fs.writeFileSync(usersPath, JSON.stringify(users, null, 2));
}

// Hash all plaintext passwords
async function addBios() {
  const users = readUsers();
  let changes = 0;

  for (const user of users) {
    if(!user.bio)user.bio = '',
    changes++
  }

  if (changes > 0) {
    writeUsers(users);
    console.log(`✅ Added ${changes} Bios!`);
  } else {
    console.log("🔍 All bios already exist.");
  }
}

async function addClubs() {
  const users = readUsers();
  let changes = 0;

  for (const user of users) {
    if(!user.events)user.events = [],
    changes++
  }

  if (changes > 0) {
    writeUsers(users);
    console.log(`✅ Added ${changes} clubs!`);
  } else {
    console.log("🔍 All clubs already exist.");
  }
}




addBios().catch(err => {
  console.error("adding of clubs failed:", err);
  process.exit(1);
});

addClubs().catch(err => {
  console.error("adding of clubs failed:", err);
  process.exit(1);
});
