const express = require("express");
const sql = require("mssql");
const cors = require("cors");

const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Enable CORS (allowing all origins for demo purposes)
app.use(cors());

// Set up the server port
const PORT = 3000;

// Azure SQL configuration (insert your actual credentials)
const config = {
  user: "abin", // e.g., "myAzureUser"
  password: "#3TAServer", // e.g., "myAzurePassword"
  server: "ttappserver.database.windows.net", // e.g., "myserver.database.windows.net"
  database: "3TADatabase", // e.g., "myDatabase"
  port: 1433, // Default port for SQL Server
  options: {
    encrypt: true, // Required for Azure SQL
    enableArithAbort: true,
  },
};

// Create a global connection pool variable to reuse connections
let pool;

/**
 * Returns (or creates) a connection pool.
 */
async function getPool() {
  if (!pool) {
    try {
      pool = await sql.connect(config);
      console.log("Connected to Azure SQL Database");
    } catch (err) {
      console.error("Error connecting to Azure SQL Database:", err);
      throw err;
    }
  }
  return pool;
}

/**
 * GET /tasks
 * Retrieves all tasks from the Tasks table.
 */
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

/**
 * POST /tasks
 * Inserts a new task into the Tasks table.
 * Expected body: { text: "Task description" }
 */
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

/**
 * PUT /tasks/:id
 * Updates an existing task.
 * Expected body: { text: "Updated text", completed: true/false }
 */
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
        `UPDATE Tasks 
         SET text = @text, completed = @completed 
         OUTPUT INSERTED.* 
         WHERE id = @id`
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

/**
 * DELETE /tasks/:id
 * Deletes a task by its id.
 */
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

/**
 * Home route
 */
app.get("/", (req, res) => {
  res.send(
    "Hello, World! This is your Task Management App backend connected to Azure SQL."
  );
});

// Global error handler for SQL errors
sql.on("error", (err) => {
  console.error("SQL global error:", err);
});

// Start the server
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
