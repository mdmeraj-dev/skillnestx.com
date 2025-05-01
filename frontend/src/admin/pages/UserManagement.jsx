import { useState, useEffect } from "react";
import axios from "axios";
import "../styles/UserManagement.css";

const UserManagement = () => {
  const [users, setUsers] = useState([]); // Ensure users is always an array
  const [searchQuery, setSearchQuery] = useState(""); // Search query for name or email
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [isLoading, setIsLoading] = useState(false); // Loading state for better UX

  // Fetch all users
  const fetchAllUsers = async () => {
    setIsLoading(true);
    try {
      const response = await axios.get("/api/users");
      // Ensure the response data is an array
      if (Array.isArray(response.data)) {
        setUsers(response.data); // Set users if the response is an array
      } else {
        setUsers([]); // Fallback to an empty array if the response is not an array
        console.error("API response is not an array:", response.data);
      }
      setError("");
    } catch (err) {
      setError("Failed to fetch users.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Search users by name or email
  const searchUsers = async () => {
    if (!searchQuery.trim()) {
      setError("Please enter a name or email to search.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.get(`/api/users/search?query=${searchQuery.trim()}`);
      // Ensure the response data is an array
      if (Array.isArray(response.data)) {
        setUsers(response.data); // Set users if the response is an array
      } else {
        setUsers([]); // Fallback to an empty array if the response is not an array
        console.error("API response is not an array:", response.data);
      }
      setError("");
    } catch (err) {
      setError("No users found.");
      setUsers([]); // Reset users to an empty array on error
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Handle Enter key press for search
  const handleKeyPress = (event) => {
    if (event.key === "Enter") {
      searchUsers(); // Trigger search when Enter key is pressed
    }
  };

  // Add a new user
  const addUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim() || !newUser.password.trim()) {
      setError("All fields are required.");
      return;
    }
    setIsLoading(true);
    try {
      const response = await axios.post("/api/users", newUser);
      // Ensure the response data is a single user object
      if (response.data && typeof response.data === "object" && !Array.isArray(response.data)) {
        setUsers([...users, response.data]); // Add the new user to the list
        setSuccess("User added successfully.");
        setError("");
        setNewUser({ name: "", email: "", password: "", role: "user" }); // Reset the form
      } else {
        setError("Failed to add user: Invalid response data.");
        console.error("Invalid response data:", response.data);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add user.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Remove a user by email
  const removeUser = async (email) => {
    if (!window.confirm("Are you sure you want to remove this user?")) return;
    setIsLoading(true);
    try {
      await axios.delete(`/api/users/${email}`);
      setUsers(users.filter((user) => user.email !== email)); // Remove the user from the list
      setSuccess("User removed successfully.");
      setError("");
    } catch (err) {
      setError("Failed to remove user.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Ban/Unban a user by email
  const toggleBanUser = async (email, isBanned) => {
    setIsLoading(true);
    try {
      await axios.put(`/api/users/${email}/ban`, { isBanned });
      setUsers(
        users.map((user) =>
          user.email === email ? { ...user, isBanned } : user
        )
      );
      setSuccess(`User ${isBanned ? "banned" : "unbanned"} successfully.`);
      setError("");
    } catch (err) {
      setError("Failed to update user status.");
      console.error(err);
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch all users on component mount
  useEffect(() => {
    fetchAllUsers();
  }, []);

  return (
    <div className="user-management">
      <h1>User Management</h1>

      {/* Search Section */}
      <div className="search-section">
        <input
          type="text"
          placeholder="Search by name or email"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          onKeyPress={handleKeyPress} // Listen for Enter key press
        />
        <button onClick={searchUsers} disabled={isLoading}>
          {isLoading ? "Searching..." : "Search"}
        </button>
      </div>

      {/* Add New User Section */}
      <div className="add-user-section">
        <h2>Add New User</h2>
        <input
          type="text"
          placeholder="Name"
          value={newUser.name}
          onChange={(e) => setNewUser({ ...newUser, name: e.target.value })}
        />
        <input
          type="email"
          placeholder="Email"
          value={newUser.email}
          onChange={(e) => setNewUser({ ...newUser, email: e.target.value })}
        />
        <input
          type="password"
          placeholder="Password"
          value={newUser.password}
          onChange={(e) => setNewUser({ ...newUser, password: e.target.value })}
        />
        <select
          value={newUser.role}
          onChange={(e) => setNewUser({ ...newUser, role: e.target.value })}
        >
          <option value="user">User</option>
          <option value="admin">Admin</option>
          <option value="instructor">Instructor</option>
        </select>
        <button onClick={addUser} disabled={isLoading}>
          {isLoading ? "Adding..." : "Add User"}
        </button>
      </div>

      {/* Users Table */}
      {isLoading ? (
        <p>Loading...</p>
      ) : (
        <table className="user-list">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {Array.isArray(users) && users.map((user) => (
              <tr key={user.email}>
                <td>{user.name}</td>
                <td>{user.email}</td>
                <td className={user.isBanned ? "status-banned" : "status-active"}>
                  {user.isBanned ? "Banned" : "Active"}
                </td>
                <td className="actions">
                  <button onClick={() => removeUser(user.email)} disabled={isLoading}>
                    Remove
                  </button>
                  <button onClick={() => toggleBanUser(user.email, !user.isBanned)} disabled={isLoading}>
                    {user.isBanned ? "Unban" : "Ban"}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      {/* Success and Error Messages */}
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </div>
  );
};

export default UserManagement;