const express = require("express");
const sql = require("mssql");
const cors = require("cors");
require("dotenv").config(); // Load environment variables

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());
app.use(cors({ origin: "*" })); // Enable CORS

// Use process.env.PORT for Azure App Service
const PORT = process.env.PORT || 3000;

// Azure SQL configuration using environment variables
const config = {
  user: process.env.DB_USER, // Set in Azure App Service
  password: process.env.DB_PASSWORD, // Set in Azure App Service
  server: process.env.DB_SERVER, // Set in Azure App Service
  database: process.env.DB_NAME, // Set in Azure App Service
  port: 1433,
  options: {
    encrypt: true,
    enableArithAbort: true,
  },
};

// Function to create a new SQL connection for each request
async function getPool() {
  try {
    const pool = await sql.connect(config);
    return pool;
  } catch (err) {
    console.error("Error connecting to Azure SQL:", err);
    throw err;
  }
}

// Home route
app.get("/", (req, res) => {
  res.send("Task Management App Backend is Running ✅");
});

// Fetch all tasks
app.get("/tasks", async (req, res) => {
  try {
    const pool = await getPool();
    const result = await pool.request().query("SELECT * FROM Tasks");
    res.json(result.recordset);
  } catch (error) {
    console.error("Error fetching tasks:", error);
    res.status(500).json({ error: "Error fetching tasks" });
  }
});

// Insert a new task
app.post("/tasks", async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || text.trim() === "") {
      return res.status(400).json({ error: "Task text is required" });
    }
    const pool = await getPool();
    const result = await pool
      .request()
      .input("text", sql.NVarChar, text)
      .query(
        "INSERT INTO Tasks (text, completed) OUTPUT INSERTED.* VALUES (@text, 0)"
      );
    res.status(201).json(result.recordset[0]);
  } catch (error) {
    console.error("Error adding task:", error);
    res.status(500).json({ error: "Error adding task" });
  }
});

// Update a task
app.put("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const { text, completed } = req.body;
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .input("text", sql.NVarChar, text)
      .input("completed", sql.Bit, completed)
      .query(
        "UPDATE Tasks SET text = @text, completed = @completed OUTPUT INSERTED.* WHERE id = @id"
      );
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Error updating task:", error);
    res.status(500).json({ error: "Error updating task" });
  }
});

// Delete a task
app.delete("/tasks/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const pool = await getPool();
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query("DELETE FROM Tasks OUTPUT DELETED.* WHERE id = @id");
    if (result.recordset.length === 0) {
      return res.status(404).json({ error: "Task not found" });
    }
    res.json(result.recordset[0]);
  } catch (error) {
    console.error("Error deleting task:", error);
    res.status(500).json({ error: "Error deleting task" });
  }
});

// Start the server and use 0.0.0.0 for Azure compatibility
app.listen(PORT, "0.0.0.0", () => {
  console.log(`Server running on http://0.0.0.0:${PORT}`);
});
