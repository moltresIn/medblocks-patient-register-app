import { PGlite } from "@electric-sql/pglite";

// Database instance
let dbInstance: PGlite | null = null;
const DATABASE_NAME = "idb://patient_db"; 

/**
 * Initialize the database connection
 */
async function initializeDatabase() {
  if (dbInstance) return dbInstance;

  try {
    // Create PGlite instance with minimal options
    dbInstance = new PGlite(DATABASE_NAME);
    return dbInstance;
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
}

export const dbPromise = initializeDatabase();