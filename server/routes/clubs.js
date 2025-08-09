const express = require("express");
const router = express.Router();
const path = require("path");
const fs = require("fs");
const { requireRole, requireAnyRole } = require("../middleware/authMiddleware");
const multer = require("multer");
// Example mock club data

const clubPath = path.join(__dirname, "../data", "clubs.json");

/* GET all clubs
router.get("/", (req, res) => {
  res.json(clubs);
});

// GET one club by ID
router.get("/:id", (req, res) => {
  const club = clubs.find((club) => club.id === parseInt(req.params.id));
  if (!club) return res.status(404).send("Club not found");
  res.json(club);
});
*/
// POST create a new club

function readClubs() {
  if (!fs.existsSync(clubPath)) return [];
  return JSON.parse(fs.readFileSync(clubPath, "utf8"));
}

function writeClubs(clubs) {
  fs.writeFileSync(clubPath, JSON.stringify(clubs, null, 2), "utf8");
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadPath = path.join(__dirname, "../public/uploads");
    fs.mkdirSync(uploadPath, { recursive: true }); // Create directory if it doesn't exist
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1e9);
    cb(null, "event-" + uniqueSuffix + path.extname(file.originalname));
  },
});

const upload = multer({
  storage: storage,
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB limit
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed!"), false);
    }
  },
});

router.get("/", (req, res) => {
  const clubs = readClubs();
  res.json(clubs);
});

router.get("/:id", (req, res) => {
  let clubs = readClubs();
  clubs = clubs.find(club=> club.id === req.params.id)
  res.json(clubs);
});

router.put("/:id", upload.single('image'), (req, res) => {
  try {
    let clubs = readClubs();
    const clubIndex = clubs.findIndex(club => club.id === req.params.id);
    
    if (clubIndex === -1) {
      return res.status(404).json({ error: "Club not found" });
    }

    // Update text fields from req.body
    if (req.body.name) clubs[clubIndex].name = req.body.name;
    if (req.body.description) clubs[clubIndex].description = req.body.description;
    if (req.body.category) clubs[clubIndex].category = req.body.category;

    // Handle file upload if present
    if (req.file) {
      clubs[clubIndex].image = `/uploads/${req.file.filename}`;
    }

    // Save updated clubs
    writeClubs(clubs);

    // Return only the updated club
    res.json(clubs[clubIndex]);
  } catch (error) {
    console.error("Error updating club:", error);
    res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/",upload.single("image"), (req, res) => {
try {
    const clubs = readClubs();
    const id = (clubs.length ? Number(clubs[clubs.length-1].id) + 1 : 1) + "" 
    const newClub = {
      id,
      name: req.body["name"],
      category: req.body["category"],
      description: req.body["description"],
      capacity: req.body["capacity"] || "unlimited",
      image: req.file ? `/uploads/${req.file.filename}` : null,
      createdAt: new Date().toISOString(),
      createdBy: req.headers['x-user-name'],
      members: [req.headers['x-user-name']],
    };

    clubs.push(newClub);
    writeClubs(clubs);
    console.log("New club created:", newClub); // Log the new club
    res.status(201).json(newClub);
  } catch (err) {
    console.error("Error creating club:", err); // Log the error
    res.status(500).json({ error: "Failed to create club" });
  }
});

router.post("/:id/add-member", (req, res) => {
  const clubs = readClubs();
  const clubIndex = clubs.findIndex(club => club.id === req.params.id);

  if (clubIndex === -1) {
    return res.status(404).json({ error: "Club not found" });
  }

  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  // Avoid duplicate members
  if (!clubs[clubIndex].members.includes(username)) {
    clubs[clubIndex].members.push(username);
    writeClubs(clubs);
    return res.status(201).json(clubs[clubIndex]);
  } else {
    return res.status(409).json({ error: "User is already a member" });
  }
});

router.delete("/:id/remove-member", (req, res) => {
  const clubs = readClubs();
  const clubIndex = clubs.findIndex(club => club.id === req.params.id);

  if (clubIndex === -1) {
    return res.status(404).json({ error: "Club not found" });
  }

  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  // Remove the member if they exist
  const memberIndex = clubs[clubIndex].members.indexOf(username);
  if (memberIndex !== -1) {
    clubs[clubIndex].members.splice(memberIndex, 1);
    writeClubs(clubs);
    return res.status(200).json(clubs[clubIndex]);
  } else {
    return res.status(404).json({ error: "User is not a member" });
  }
});
router.delete("/:id", async (req, res) => {
  try {
    const clubs = await readClubs();
    const clubIndex = clubs.findIndex(club => club.id === req.params.id);
    
    if (clubIndex === -1) {
      return res.status(404).json({ message: "Club not found" });
    }
    
    clubs.splice(clubIndex, 1);
    await writeClubs(clubs);
    res.status(204).send(); // 204 No Content is common for successful DELETE
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error" });
  }
});
module.exports = router;
