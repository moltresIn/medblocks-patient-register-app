/* eslint-disable @typescript-eslint/no-explicit-any */
import { PGlite } from "@electric-sql/pglite";

// Configuration interface
interface DatabaseConfig {
  wasmPath: string;
  fsBundlePath: string;
  maxQueueSize: number;
  databaseName: string;
  channelName: string;
}

// Default configuration
const DEFAULT_CONFIG: DatabaseConfig = {
  wasmPath: '/pglite.wasm',
  fsBundlePath: '/pglite.data',
  maxQueueSize: 100,
  databaseName: "idb://patient_db",
  channelName: "patient_data_channel"
};

// Database state
let dbInstance: PGlite | null = null;
let dbChannel: BroadcastChannel | null = null;
let isInitialized = false;

// Transaction queue management
let isTransactionInProgress = false;
let pendingTransactions: Array<() => Promise<void>> = [];

/**
 * Initialize the database connection with optional configuration
 */
async function initializeDatabase(config: Partial<DatabaseConfig> = {}): Promise<PGlite> {
  if (isInitialized && dbInstance) {
    return dbInstance;
  }

  const fullConfig: DatabaseConfig = { ...DEFAULT_CONFIG, ...config };

  try {
    // Fetch resources in parallel
    const [wasmResponse, fsResponse] = await Promise.all([
      fetch(fullConfig.wasmPath),
      fetch(fullConfig.fsBundlePath)
    ]);

    if (!wasmResponse.ok) {
      throw new Error(`Failed to fetch WASM: ${wasmResponse.status} ${wasmResponse.statusText}`);
    }
    if (!fsResponse.ok) {
      throw new Error(`Failed to fetch FS bundle: ${fsResponse.status} ${fsResponse.statusText}`);
    }

    const [wasmModule, fsBundle] = await Promise.all([
      WebAssembly.compileStreaming(wasmResponse),
      fsResponse.blob()
    ]);

    // Initialize database with local assets
    dbInstance = await PGlite.create({
      wasmModule,
      fsBundle,
      dataDir: fullConfig.databaseName,
    });

    // Initialize broadcast channel
    dbChannel = new BroadcastChannel(fullConfig.channelName);
    isInitialized = true;
    console.log("Database initialized successfully");
    return dbInstance;
  } catch (error) {
    console.error("Database initialization error:", error);
    // Clean up if initialization fails
    if (dbInstance) {
      await dbInstance.close();
      dbInstance = null;
    }
    if (dbChannel) {
      dbChannel.close();
      dbChannel = null;
    }
    isInitialized = false;
    throw error;
  }
}

// Export the initialization promise
export const dbPromise = initializeDatabase();
// In your database initialization code or a separate setup file
export async function initializePatientTable() {
  try {
    await executeQuery(`
      CREATE TABLE IF NOT EXISTS patients (
        id SERIAL PRIMARY KEY,
        full_name TEXT NOT NULL,
        age INTEGER NOT NULL,
        gender TEXT NOT NULL,
        contact_info TEXT,
        address TEXT,
        email TEXT,
        blood_type TEXT,
        allergies TEXT,
        medical_history TEXT,
        insurance_provider TEXT,
        insurance_id TEXT,
        emergency_contact TEXT,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);
    console.log("Patients table initialized");
  } catch (error) {
    console.error("Error initializing patients table:", error);
  }
}


/**
 * Clean up database resources
 */
export async function cleanupDatabase(): Promise<void> {
  if (dbInstance) {
    await dbInstance.close();
    dbInstance = null;
  }
  if (dbChannel) {
    dbChannel.close();
    dbChannel = null;
  }
  isInitialized = false;
  pendingTransactions = [];
  console.log("Database resources cleaned up");
}

/**
 * Process pending database transactions
 */
async function processPendingTransactions(): Promise<void> {
  if (pendingTransactions.length === 0 || isTransactionInProgress) {
    return;
  }

  isTransactionInProgress = true;
  const transaction = pendingTransactions.shift();

  if (transaction) {
    try {
      await transaction();
    } catch (error) {
      console.error("Transaction processing error:", error);
    } finally {
      isTransactionInProgress = false;
      // Process next transaction in the next event loop iteration
      setTimeout(processPendingTransactions, 0);
    }
  }
}

/**
 * Check if a query modifies the database
 */
function isModifyingQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase().trim();
  return (
    lowerQuery.startsWith("insert") ||
    lowerQuery.startsWith("update") ||
    lowerQuery.startsWith("delete") ||
    lowerQuery.startsWith("create") ||
    lowerQuery.startsWith("alter") ||
    lowerQuery.startsWith("drop") ||
    lowerQuery.startsWith("truncate")
  );
}

/**
 * Execute an SQL query with transaction queuing
 */
export async function executeQuery<T = any>(
  query: string,
  params: unknown[] = [],
  config?: { skipQueue?: boolean }
): Promise<T> {
  // Validate database is initialized
  if (!isInitialized) {
    throw new Error("Database not initialized");
  }

  // Skip queue for read-only queries if requested
  if (config?.skipQueue && !isModifyingQuery(query)) {
    const db = await dbPromise;
    return db.query(query, params) as Promise<T>;
  }

  return new Promise((resolve, reject) => {
    // Check queue size limit
    if (pendingTransactions.length >= DEFAULT_CONFIG.maxQueueSize) {
      reject(new Error("Transaction queue is full"));
      return;
    }

    // Add transaction to queue
    pendingTransactions.push(async () => {
      try {
        const db = await dbPromise;
        const result = await db.query(query, params);
        
        // Broadcast changes for modifying queries
        if (isModifyingQuery(query) && dbChannel) {
          try {
            dbChannel.postMessage({
              type: "data_updated",
              query,
              timestamp: Date.now(),
            });
          } catch (broadcastError) {
            console.error("Broadcast error:", broadcastError);
          }
        }
        
        resolve(result as T);
      } catch (error) {
        console.error("Query execution error:", error);
        reject(error);
      }
    });
    
    // Start processing the queue
    processPendingTransactions();
  });
}

/**
 * Utility to listen for database updates
 */
export function onDatabaseUpdate(
  callback: (event: { query: string; timestamp: number }) => void
): () => void {
  if (!dbChannel) {
    throw new Error("Database channel not initialized");
  }

  const listener = (event: MessageEvent) => {
    if (event.data.type === "data_updated") {
      callback(event.data);
    }
  };

  dbChannel.addEventListener("message", listener);
  
  // Return cleanup function
  return () => {
    dbChannel?.removeEventListener("message", listener);
  };
}