import PatientRegistrationForm from "./components/PatientRegistrationForm";
import QueryExecutor from "./components/QueryExecutor";
import { dbPromise } from "./utils/pgliteConfig";
function App() {
  async function initialize() {
    try {
      await dbPromise;
    } catch (error) {
      console.error("Failed to initialize the database:", error);
    }
  }

  initialize();
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
