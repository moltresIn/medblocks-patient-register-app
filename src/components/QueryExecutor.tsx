import clsx from "clsx";
import PatientTable from "./PatientTable";
function QueryExecutor() {
  return (
    <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
      <h2 className="text-2xl font-semibold text-gray-900 mb-6">
        Query Patient Records
      </h2>
      <div className="space-y-4">
        <div>
          <div className="flex justify-between mb-1">
            <label
              htmlFor="sql-query"
              className="block text-sm font-medium text-gray-700"
            >
              SQL Query
            </label>
          </div>

          <textarea
            id="sql-query"
            className="w-full px-3 py-2 border border-gray-300 rounded-md shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-mono text-sm"
            rows={4}
            placeholder="Enter your SQL query here..."
          />
        </div>
        <div className="flex justify-between items-center">
          <button
            className={clsx(
              "px-4 py-2 text-white font-medium rounded-md focus:outline-none focus:ring-2 focus:ring-offset-2 transition-colors bg-blue-600 hover:bg-blue-700"
            )}
          >
            Execute Query
          </button>
        </div>
        {/* Results Display */}
        <div className="mt-6">
          <PatientTable />
        </div>
      </div>
    </div>
  );
}

export default QueryExecutor;
