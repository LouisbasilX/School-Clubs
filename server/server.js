const express = require("express");
const path = require("path");
const app = express();
const PORT = 3000;

// Middleware
app.use(express.json({ limit: "100mb" }));
app.use(express.urlencoded({ extended: true, limit: "100mb" }));
app.use(express.raw({ limit: "100mb" }));
app.use(express.static(path.join(__dirname, "../client/public")));
app.use("/uploads", express.static(path.join(__dirname, "./public/uploads")));
// Routes
const eventsRouter = require("./routes/events");
const userRoutes = require("./routes/users");
const clubRoutes = require("./routes/clubs");
app.use("/api/users", userRoutes);
app.use("/api/clubs", clubRoutes);
app.use("/api/events", eventsRouter);
// Optional: 404 fallback
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, "public", "404.html"));
});

app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Server running at http://localhost:${PORT}`);
});
