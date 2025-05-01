import { useState, useEffect, useCallback, useMemo } from "react";
import axios from "axios";
import "../styles/TransactionManagement.css"; // Import your CSS file

const TransactionManagement = () => {
  const [transactions, setTransactions] = useState([]);
  const [refundRequests, setRefundRequests] = useState([]);
  const [filters, setFilters] = useState({
    status: "",
    startDate: "",
    endDate: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [transactionsPerPage] = useState(10);
  const [activeTab, setActiveTab] = useState("transactions"); // Tabs: transactions or refunds

  // Fetch all transactions
  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const { status, startDate, endDate } = filters;
      const response = await axios.get("/api/transactions/filter", {
        params: {
          paymentStatus: status,
          startDate,
          endDate,
          page: currentPage,
          limit: transactionsPerPage,
        },
      });
      if (response.data.success) {
        setTransactions(response.data.transactions);
      } else {
        setTransactions([]);
        console.error("Failed to fetch transactions:", response.data.message);
      }
    } catch (error) {
      console.error("Error fetching transactions:", error);
      alert("Failed to fetch transactions. Please try again later.");
      setTransactions([]);
    } finally {
      setIsLoading(false);
    }
  }, [filters, currentPage, transactionsPerPage]);

  // Fetch refund requests
  const fetchRefundRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/transactions/refund-requests", {
        params: {
          page: currentPage,
          limit: transactionsPerPage,
        },
      });
      if (response.data.success) {
        setRefundRequests(response.data.refundRequests);
      } else {
        setRefundRequests([]);
        console.error("Failed to fetch refund requests:", response.data.message);
      }
    } catch (error) {
      console.error("Error fetching refund requests:", error);
      alert("Failed to fetch refund requests. Please try again later.");
      setRefundRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, [currentPage, transactionsPerPage]);

  // Handle refund request (approve/reject)
  const handleRefundAction = async (transactionId, action) => {
    try {
      const response = await axios.post(
        `/api/transactions/refund-requests/${transactionId}`,
        { action }
      );
      if (response.data.success) {
        alert(`Refund request ${action}d successfully.`);
        fetchRefundRequests(); // Refresh refund requests
        fetchTransactions(); // Refresh transactions
      } else {
        alert(`Failed to ${action} refund request: ${response.data.message}`);
      }
    } catch (error) {
      console.error("Error processing refund action:", error);
      alert("Failed to process refund action. Please try again later.");
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const csvHeader =
      "Transaction ID,User Name,User Email,Course Name,Amount Paid,Payment Status,Refund Status,Requested Date\n";
    const csvRows = refundRequests
      .map(
        (req) =>
          `${req.transactionId},${req.user.name},${req.user.email},${req.course.title},${req.amount},${req.paymentStatus},${req.refundRequest?.status || "N/A"},${new Date(
            req.refundRequest?.requestedAt
          ).toLocaleDateString()}`
      )
      .join("\n");

    const csvContent = csvHeader + csvRows;
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "refund_requests.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  // Pagination logic
  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = useMemo(
    () => transactions.slice(indexOfFirstTransaction, indexOfLastTransaction),
    [transactions, indexOfFirstTransaction, indexOfLastTransaction]
  );

  const paginate = (pageNumber) => setCurrentPage(pageNumber);

  // Handle tab change
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    setCurrentPage(1); // Reset pagination when switching tabs
    if (tab === "refunds") {
      fetchRefundRequests();
    } else {
      fetchTransactions();
    }
  };

  useEffect(() => {
    if (activeTab === "transactions") {
      fetchTransactions();
    } else {
      fetchRefundRequests();
    }
  }, [activeTab, fetchTransactions, fetchRefundRequests]);

  return (
    <div className="transaction-management-container">
      <h1 className="transaction-header">Transaction Management</h1>

      {/* Tabs */}
      <div className="tabs">
        <button
          className={activeTab === "transactions" ? "active" : ""}
          onClick={() => handleTabChange("transactions")}
        >
          Transactions
        </button>
        <button
          className={activeTab === "refunds" ? "active" : ""}
          onClick={() => handleTabChange("refunds")}
        >
          Refund Requests
        </button>
      </div>

      {/* Filter Transactions */}
      {activeTab === "transactions" && (
        <div className="filter-section">
          <h2>Filter Transactions</h2>
          <div className="filter-controls">
            <select
              value={filters.status}
              onChange={(e) => setFilters({ ...filters, status: e.target.value })}
            >
              <option value="">Select Status</option>
              <option value="Success">Success</option>
              <option value="Pending">Pending</option>
              <option value="Failed">Failed</option>
              <option value="Refunded">Refunded</option>
              <option value="Disputed">Disputed</option>
            </select>
            <input
              type="date"
              value={filters.startDate}
              onChange={(e) =>
                setFilters({ ...filters, startDate: e.target.value })
              }
            />
            <input
              type="date"
              value={filters.endDate}
              onChange={(e) =>
                setFilters({ ...filters, endDate: e.target.value })
              }
            />
            <button onClick={fetchTransactions}>Apply Filters</button>
          </div>
        </div>
      )}

      {/* Display Transactions or Refund Requests */}
      <div>
        <h2>
          {activeTab === "transactions" ? "Transactions" : "Refund Requests"}
        </h2>
        {isLoading ? (
          <div className="loading-spinner">
            <p>Loading...</p>
          </div>
        ) : (
          <>
            {activeTab === "transactions" ? (
              <>
                {currentTransactions.length > 0 ? (
                  <>
                    <table className="transaction-table">
                      <thead>
                        <tr>
                          <th>Transaction ID</th>
                          <th>User Name</th>
                          <th>User Email</th>
                          <th>Course Name</th>
                          <th>Amount Paid</th>
                          <th>Payment Status</th>
                          <th>Refund Status</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {currentTransactions.map((txn) => (
                          <tr key={txn._id}>
                            <td>{txn.transactionId}</td>
                            <td>{txn.user.name}</td>
                            <td>{txn.user.email}</td>
                            <td>{txn.course.title}</td>
                            <td>₹{txn.amount}</td>
                            <td>{txn.paymentStatus}</td>
                            <td>{txn.refundRequest?.status || "No Request"}</td>
                            <td>
                              <button>View Details</button>
                              {txn.refundRequest?.status === "Pending" && (
                                <>
                                  <button
                                    onClick={() =>
                                      handleRefundAction(
                                        txn.transactionId,
                                        "approve"
                                      )
                                    }
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleRefundAction(
                                        txn.transactionId,
                                        "reject"
                                      )
                                    }
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Pagination */}
                    <div className="pagination">
                      {Array.from({
                        length: Math.ceil(
                          transactions.length / transactionsPerPage
                        ),
                      }).map((_, index) => (
                        <button
                          key={index}
                          onClick={() => paginate(index + 1)}
                          className={currentPage === index + 1 ? "active" : ""}
                        >
                          {index + 1}
                        </button>
                      ))}
                    </div>
                  </>
                ) : (
                  <p className="no-transactions">No transactions found.</p>
                )}
              </>
            ) : (
              <>
                {refundRequests.length > 0 ? (
                  <>
                    <table className="transaction-table">
                      <thead>
                        <tr>
                          <th>Transaction ID</th>
                          <th>User Name</th>
                          <th>Course Name</th>
                          <th>Amount Paid</th>
                          <th>Refund Status</th>
                          <th>Requested Date</th>
                          <th>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {refundRequests.map((req) => (
                          <tr key={req._id}>
                            <td>{req.transactionId}</td>
                            <td>{req.user.name}</td>
                            <td>{req.course.title}</td>
                            <td>₹{req.amount}</td>
                            <td>{req.refundRequest?.status || "N/A"}</td>
                            <td>
                              {new Date(
                                req.refundRequest?.requestedAt
                              ).toLocaleDateString()}
                            </td>
                            <td>
                              {req.refundRequest?.status === "Pending" ? (
                                <>
                                  <button
                                    onClick={() =>
                                      handleRefundAction(
                                        req.transactionId,
                                        "approve"
                                      )
                                    }
                                  >
                                    Approve
                                  </button>
                                  <button
                                    onClick={() =>
                                      handleRefundAction(
                                        req.transactionId,
                                        "reject"
                                      )
                                    }
                                  >
                                    Reject
                                  </button>
                                </>
                              ) : (
                                <button>View</button>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>

                    {/* Export to CSV */}
                    <button onClick={exportToCSV} className="export-button">
                      Export to CSV
                    </button>
                  </>
                ) : (
                  <p className="no-transactions">No refund requests found.</p>
                )}
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default TransactionManagement;