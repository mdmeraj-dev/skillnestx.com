import '../styles/Dashboard.css';

const Dashboard = () => {
  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <h1>Dashboard</h1>
      </header>
      <div className="metrics-container">
        <div className="metric-card">
          <h2>Total Users</h2>
          <p>1,250</p>
        </div>
        <div className="metric-card">
          <h2>Active Sessions</h2>
          <p>450</p>
        </div>
        <div className="metric-card">
          <h2>Conversion Rate</h2>
          <p>12.5%</p>
        </div>
      </div>
      <div className="charts-container">
        <div className="chart-card">
          <h3>Sales Overview</h3>
          <div className="chart-placeholder"></div>
        </div>
        <div className="chart-card">
          <h3>User Activity</h3>
          <div className="chart-placeholder"></div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;