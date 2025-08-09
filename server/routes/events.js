const express = require("express");
const router = express.Router();
const fs = require("fs");
const path = require("path");
const eventsPath = path.join(__dirname, "../data", "events.json");
const multer = require("multer");

// Helper functions
function readEvents() {
  if (!fs.existsSync(eventsPath)) return [];
  return JSON.parse(fs.readFileSync(eventsPath, "utf8"));
}

function writeEvents(events) {
  fs.writeFileSync(eventsPath, JSON.stringify(events, null, 2), "utf8");
}

// Get all events
router.get("/", (req, res) => {
  try {
    const events = readEvents();
    res.json(events);
  } catch (err) {
    res.status(500).json({ error: "Failed to load events" });
  }
});

router.get("/:id", (req, res) => {
  try {
    const events = readEvents();
    const event = events.find(e => e.id === req.params.id);
    
    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }
    
    res.json(event);
  } catch (err) {
    res.status(500).json({ error: "Failed to load event" });
  }
});


// Get events by club
router.get("/club/:clubId", (req, res) => {
  try {
    const events = readEvents();
    const clubEvents = events.filter(
      (event) => event.clubId === req.params.clubId
    );
    res.json(clubEvents);
  } catch (err) {
    res.status(500).json({ error: "Failed to load club events" });
  }
});

// Configure storage for uploaded files
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

// Create new event
router.post("/", upload.single("event-image"), (req, res) => {
  console.log(req.body, req.user);
  try {
    const events = readEvents();
    const id = (events.length ? Number(events[events.length-1].id) + 1 : 1) + "" 
    const newEvent = {
      id,
      title: req.body["event-title"],

      club: req.body["event-club"],
      category: req.body["event-category"],
      startDate: req.body["event-start"],
      endDate: req.body["event-end"],
      location: req.body["event-location"],
      description: req.body["event-description"],
      capacity: req.body["event-capacity"] || "unlimited",
      requiresRegistration: req.body["event-registration"] === "on",
      image: req.file ? `/uploads/${req.file.filename}` : null,
      createdAt: new Date().toISOString(),
      createdBy: req.headers['x-user-name'],
      attendees: [req.headers['x-user-name']],
    };

    events.push(newEvent);
    writeEvents(events);
    console.log("New event created:", newEvent); // Log the new event
    res.status(201).json(newEvent);
  } catch (err) {
    console.error("Error creating event:", err); // Log the error
    res.status(500).json({ error: "Failed to create event" });
  }
});
router.put("/:id", upload.single('image'), (req, res) => {
  console.log('Update Event Request:', {
    params: req.params,
    body: req.body,
    file: req.file ? `File received: ${req.file.originalname}` : null,
    user: req.headers['x-user-name']
  });

  try {
    // 1. Load existing events
    let events = readEvents();
    const eventIndex = events.findIndex(event => event.id === req.params.id);
    
    if (eventIndex === -1) {
      console.error(`Event ${req.params.id} not found`);
      return res.status(404).json({ error: "Event not found" });
    }

    // 2. Update fields - matching your form names exactly
    const updatedEvent = {
      ...events[eventIndex], // Preserve existing data
      title: req.body.name || events[eventIndex].title,
      description: req.body.description || events[eventIndex].description,
      startDate: req.body.start || events[eventIndex].startDate,
      endDate: req.body.end || events[eventIndex].endDate,
      location: req.body.location || events[eventIndex].location,
      club: req.body.clubId || events[eventIndex].club || null,
      capacity: req.body.capacity ? parseInt(req.body.capacity) : events[eventIndex].capacity || 0,
      requiresRegistration: req.body.requiresRegistration === 'on' || events[eventIndex].requiresRegistration || false,
      updatedAt: new Date().toISOString(),
      updatedBy: req.headers['x-user-name']
    };

    // 3. Handle image upload if present (identical to clubs endpoint)
    if (req.file) {
      updatedEvent.image = `/uploads/${req.file.filename}`;
      console.log('Updated image path:', updatedEvent.image);
    }

    // 4. Validate dates
    if (new Date(updatedEvent.startDate) >= new Date(updatedEvent.endDate)) {
      return res.status(400).json({ error: "End date must be after start date" });
    }

    // 5. Update and save
    events[eventIndex] = updatedEvent;
    writeEvents(events);

    console.log('Successfully updated event:', updatedEvent.id);
    res.json({
      id: updatedEvent.id,
      title: updatedEvent.title,
      description: updatedEvent.description,
      startDate: updatedEvent.startDate,
      endDate: updatedEvent.endDate,
      location: updatedEvent.location,
      club: updatedEvent.club,
      capacity: updatedEvent.capacity,
      requiresRegistration: updatedEvent.requiresRegistration,
      image: updatedEvent.image,
      createdAt: events[eventIndex].createdAt,
      createdBy: events[eventIndex].createdBy,
      attendees: events[eventIndex].attendees
    });

  } catch (error) {
    console.error("Error updating event:", {
      message: error.message,
      stack: error.stack,
      params: req.params,
      body: req.body
    });
    res.status(500).json({ error: "Internal server error" });
  }
});
// Register for event
router.post("/:id/register", (req, res) => {
  try {
    const events = readEvents();
    const eventIndex = events.findIndex((e) => e.id === req.params.id);

    if (eventIndex === -1) {
      return res.status(404).json({ error: "Event not found" });
    }

    const userId = req.body.username;
    if (!events[eventIndex].attendees.includes(userId)) {
      events[eventIndex].attendees.push(userId);
      writeEvents(events);
    }

    res.json(events[eventIndex]);
  } catch (err) {
    res.status(500).json({ error: "Failed to register for event" });
  }
});

router.delete("/:id/remove-attendee", (req, res) => {
  const events = readEvents();
  const eventIndex = events.findIndex(event => event.id === req.params.id);

  if (eventIndex === -1) {
    return res.status(404).json({ error: "event not found" });
  }

  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  // Remove the member if they exist
  const memberIndex = events[eventIndex].attendees.indexOf(username);
  if (memberIndex !== -1) {
    events[eventIndex].attendees.splice(memberIndex, 1);
    writeEvents(events);
    return res.status(200).json(events[eventIndex]);
  } else {
    return res.status(404).json({ error: "User is not an attendee" });
  }
});

router.post("/:id/add-attendee", (req, res) => {
  const events = readEvents();
  const eventIndex = events.findIndex(event => event.id === req.params.id);

  if (eventIndex === -1) {
    return res.status(404).json({ error: "event not found" });
  }

  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: "Username is required" });
  }

  // Remove the member if they exist
  const memberIndex = events[eventIndex].attendees.indexOf(username);
  if (memberIndex === -1) {
    events[eventIndex].attendees.push(username)
    writeEvents(events);
    return res.status(200).json(events[eventIndex]);
  } else {
    return res.status(404).json({ error: "User is already an attendee" });
  }
});

router.delete("/:id", (req, res) => {
  const events = readEvents();
  const eventIndex = events.findIndex(event => event.id === req.params.id);

  if (eventIndex === -1) {
    return res.status(404).json({ error: "event not found" });
  }

  // Remove the Event 
 

    events.splice(eventIndex, 1)
    writeEvents(events);
    return res.status(200).json(events);
 
});


router.delete("/:clubname/delete", (req, res) =>{
   const events = readEvents();
   events = events.filter(event => event.club !== req.params.clubname);
   writeEvents(events);
    return res.status(200).json(events);
})

module.exports = router;
