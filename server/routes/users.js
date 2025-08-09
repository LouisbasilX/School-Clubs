const express = require("express");
const router = express.Router();
const { authorizeAdmin } = require("../middleware/authMiddleware");
const fs = require("fs");
const path = require("path");
const userPath = path.join(__dirname, "../data", "users.json");
const bcrypt = require('bcryptjs');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, '../public/uploads/profile-pictures');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `${req.params.username}-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({ 
  storage: storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

function readUsers() {
  if (!fs.existsSync(userPath)) return [];
  return JSON.parse(fs.readFileSync(userPath, "utf8"));
}

function writeUsers(users) {
  fs.writeFileSync(userPath, JSON.stringify(users, null, 2), "utf8");
}

// Get all users
router.get("/", (req, res) => {
  const users = readUsers();
  res.json(users);
});

// Get specific user
router.get("/:username", (req, res) => {
  const users = readUsers();
  const user = users.find(u => u.username === req.params.username);
  
  if (!user) {
    return res.status(404).json({ error: "User not found" });
  }
  
  // Don't return password hash
  const { password, ...userData } = user;
  res.json(userData);
});

// Update user 
router.put("/:username", async (req, res) => {
  const params = req.body;

  const users = readUsers();
  const userIndex = users.findIndex(u => u.username === req.params.username);
  
  if (userIndex === -1) {
    return res.status(404).json({ error: "User not found" });
  }
     //if username is to be updated, update username.
   if(params.username){
  users[userIndex].username = params.username;
 }

 //if bio is to be updated, update bio.
if(params.bio){
users[userIndex].bio = params.bio;
}

 //if password is to be updated, update password.
if(params.password){
 const hashedPassword = await bcrypt.hash(params.password, 10);
 users[userIndex].password = hashedPassword;
}

 //if events is to be updated, update events.
 if(params.addEventId){
users[userIndex].events.push(params.eventId);
}

 if(params.removeEventId){
   events.splice(events.indexOf(params.removeEventId, 1))
}

//if role is to be updated, update role.
 if(params.role){
users[userIndex].role = params.role;
}
 if(params.leaveClubId && users[userIndex].clubs.includes(params.leaveClubId)){
  const index = users[userIndex].clubs.indexOf(params.leaveClubId)
  users[userIndex].clubs.splice( index, 1)
 }
  
  if(params.joinClubId && !users[userIndex].clubs.includes(params.joinClubId)){
  users[userIndex].clubs.push(params.joinClubId)
 }
 if(params.joinEventId && !users[userIndex].events.includes(params.joinEventId)){
  users[userIndex].events.push(params.joinEventId)
 }
if(params.leaveEventId && users[userIndex].events.includes(params.leaveEventId)){
  const index = users[userIndex].clubs.indexOf(params.leaveEventId)
  users[userIndex].events.splice( index, 1)
 }
 if(params.recentActivity){
  const activity = {
    date: new Date().toISOString(),
  ...params.recentActivity 
  }
  users[userIndex].recentActivity.push(activity);
  if(users[userIndex].recentActivity.length > 10)users[userIndex].recentActivity.shift();
 }
  
  writeUsers(users);

  res.json({ 
    message: "user updated successfully",
    user: {
      username: users[userIndex].username,
    }
  });
});

// Upload profile picture
router.post("/:username/profile-picture", upload.single('profilePicture'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  const users = readUsers();
  const userIndex = users.findIndex(u => u.username === req.params.username);
  
  if (userIndex === -1) {
    // Clean up the uploaded file if user not found
    fs.unlinkSync(req.file.path);
    return res.status(404).json({ error: "User not found" });
  }

  // Delete old profile picture if it exists
  if (users[userIndex].profilePicture) {
    const oldPicturePath = path.join(__dirname, '../public', users[userIndex].profilePicture);
    if (fs.existsSync(oldPicturePath)) {
      fs.unlinkSync(oldPicturePath);
    }
  }

  // Update user with new profile picture path
  const relativePath = `/uploads/profile-pictures/${req.file.filename}`;
  users[userIndex].profilePicture = relativePath;
  writeUsers(users);

  res.json({ 
    message: "Profile picture uploaded successfully",
    profilePicture: relativePath
  });
});

// Add new user (user or admin) – allowed for admin & superadmin
router.post("/create-user", authorizeAdmin, async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: "All fields are required" });
  }

  const users = readUsers();
  if (users.some((u) => u.username === username)) {
    return res.status(409).json({ error: "User already exists" });
  }

  const hashedPassword = await bcrypt.hash(password, 10);
  const newUser = { 
    username, 
    password: hashedPassword, 
    role,
    joinedDate: new Date().toISOString(),
    clubs: [],
    events: [],
    bio: "",
    profilePicture: ""
  };
  
  users.push(newUser);
  writeUsers(users);
  
  // Don't return password hash
  const { password: _, ...userData } = newUser;
  res.status(201).json(userData);
});

// User login
router.post("/login", async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: "Username and password are required" });
  }

  const users = readUsers();
  const user = users.find(u => u.username === username.trim());

  if (!user) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  const isMatch = await bcrypt.compare(password, user.password);
  if (!isMatch) {
    return res.status(401).json({ error: "Invalid username or password" });
  }

  // Don't return password hash
  const { password: _, ...userData } = user;
  
  res.json({
    message: "Login successful",
    user: userData
  });
});


router.delete("/:username", async (req, res) => {
  try {
    // Read current users
    const users = readUsers();
    
    // Find user to delete
    const username = req.params.username;
    const userIndex = users.findIndex(u => u.username === username);
    
    if (userIndex === -1) {
      return res.status(404).json({ error: "User not found" });
    }

    // Get user data before deletion (in case needed for cleanup)
    const userToDelete = users[userIndex];
    
    // Remove user from array
    users.splice(userIndex, 1);
    
    // Write updated users list
    await writeUsers(users);  // Assuming writeUsers might be async
    
    // Optional: Add cleanup logic here if needed
    // For example, remove user from clubs/events they were part of
    
    return res.status(204).send();  // 204 No Content is standard for successful DELETE
    
  } catch (error) {
    console.error("Error deleting user:", error);
    return res.status(500).json({ 
      error: "Internal server error",
      details: error.message 
    });
  }
});

module.exports = router;