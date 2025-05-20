import { useEffect, useCallback } from "react";
import PatientRegistrationForm from "./components/PatientRegistrationForm";
import QueryExecutor from "./components/QueryExecutor";
import {
  dbPromise,
  executeQuery,
  initializePatientTable,
} from "./utils/pgliteConfig";

function App() {
  const initialize = useCallback(async () => {
    try {
      await dbPromise;
      await initializePatientTable();
      await runDatabaseDiagnostics();
    } catch (error) {
      console.error("Failed to initialize the database:", error);
    }
  }, []);

  const runDatabaseDiagnostics = useCallback(async () => {
    try {
      // 1. Check all tables in the database
      const tables = await executeQuery<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public'"
      );
      console.log("Tables in database:", tables.rows);

      // 2. Check the structure of the patients table
      const tableStructure = await executeQuery<{
        column_name: string;
        data_type: string;
        is_nullable: string;
      }>(`
        SELECT column_name, data_type, is_nullable 
        FROM information_schema.columns 
        WHERE table_name = 'patients'
      `);
      console.log("Patients table structure:", tableStructure.rows);

      // 3. Count records in patients table
      const countResult = await executeQuery<{ count: number }>(
        "SELECT COUNT(*) as count FROM patients"
      );
      console.log("Total patients:", countResult.rows[0]?.count);

      // 4. Get all patients (limited to 10 if many exist)
      await logAllPatients();

      // 5. Check database size
      const dbSize = await executeQuery<{ size: string }>(
        "SELECT pg_size_pretty(pg_database_size(current_database())) as size"
      );
      console.log("Database size:", dbSize.rows[0]?.size);
    } catch (error) {
      console.error("Error running diagnostics:", error);
    }
  }, []);

  const logAllPatients = useCallback(async (limit = 10) => {
    try {
      const result = await executeQuery<{
        id: number;
        full_name: string;
        age: number;
        gender: string;
        created_at: string;
      }>(
        `
        SELECT id, full_name, age, gender, created_at 
        FROM patients 
        ORDER BY created_at DESC
        LIMIT $1
      `,
        [limit]
      );

      console.log(`Patients in database (first ${limit}):`);
      console.table(result.rows);
    } catch (error) {
      console.error("Error fetching patients:", error);
    }
  }, []);

  useEffect(() => {
    initialize();

    const interval = setInterval(() => {
      logAllPatients();
    }, 10000);

    return () => {
      clearInterval(interval);
    };
  }, [initialize, logAllPatients]);

  return (
    <>
      <div className="min-h-screen bg-gray-50">
        <div className=" mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-between mb-8">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Patient Registration App
            </h1>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <PatientRegistrationForm />
            <QueryExecutor />
          </div>
        </div>
      </div>
    </>
  );
}

export default App;
