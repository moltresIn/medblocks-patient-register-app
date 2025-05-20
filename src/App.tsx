import PatientRegistrationForm from "./components/PatientRegistrationForm";
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
      <PatientRegistrationForm />
    </>
  );
}
export default App;
