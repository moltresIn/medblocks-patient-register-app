/* eslint-disable @typescript-eslint/no-explicit-any */
/* eslint-disable prefer-const */
import { PGlite } from "@electric-sql/pglite";

// Database instance
let dbInstance: PGlite | null = null;
const DATABASE_NAME = "idb://patient_db"; 

// Create a broadcast channel for cross-tab communication
const dbChannel = new BroadcastChannel("patient_data_channel");

// Transaction queue management
let isTransactionInProgress = false;
let pendingTransactions: Array<() => Promise<void>> = [];



/**
 * Initialize the database connection
 */
async function initializeDatabase() {
  
  try {
    // Fetch local WASM and FS bundle
    const wasmResponse = await fetch('/pglite.wasm');
    if (!wasmResponse.ok) throw new Error(`Failed to fetch WASM: ${wasmResponse.status} ${wasmResponse.statusText}`);
    console.log('WASM Response Status:', wasmResponse.status, 'URL:', wasmResponse.url);
    const wasmModule = await WebAssembly.compileStreaming(wasmResponse);
    const fsResponse = await fetch('/pglite.data');
    if (!fsResponse.ok) throw new Error(`Failed to fetch FS bundle: ${fsResponse.status} ${fsResponse.statusText}`);
    console.log('FS Response Status:', fsResponse.status, 'URL:', fsResponse.url);
    const fsBundle = await fsResponse.blob();
    console.log('FS Bundle Size:', fsBundle.size);

    // Initialize with local assets
    dbInstance = await PGlite.create({
      wasmModule,
      fsBundle,
      dataDir: DATABASE_NAME,
    });

    
    console.log("Database initialized successfully");
    return dbInstance;
  } catch (error) {
    console.error("Database initialization error:", error);
    throw error;
  }
}

export const dbPromise = initializeDatabase();

/**
 * Process pending database transactions
 */
async function processPendingTransactions() {
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
      // Process next transaction
      processPendingTransactions();
    }
  }
}

/**
 * Execute an SQL query with transaction queuing
 */
export async function executeQuery(query: string, params: any[] = []): Promise<any> {
  return new Promise((resolve, reject) => {
    pendingTransactions.push(async () => {
      try {
        const db = await dbPromise;
        const result = await db.query(query, params);
        
        // Broadcast changes for modifying queries
        if (isModifyingQuery(query)) {
          dbChannel.postMessage({
            type: "data_updated",
            query,
            timestamp: Date.now(),
          });
        }
        
        resolve(result);
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
    lowerQuery.startsWith("drop")
  );
}