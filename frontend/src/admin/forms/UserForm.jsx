import { useState, useEffect } from "react";
import axios from "axios";

const UserForm = () => {
  const [users, setUsers] = useState([]);
  const [searchEmail, setSearchEmail] = useState("");
  const [userDetails, setUserDetails] = useState(null);
  const [newUser, setNewUser] = useState({
    name: "",
    email: "",
    password: "",
    role: "user",
  });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // Fetch all users
  const fetchAllUsers = async () => {
    try {
      const response = await axios.get("/api/users");
      setUsers(response.data);
      setError("");
    } catch (err) {
      setError("Failed to fetch users.");
      console.error(err);
    }
  };

  // Search user by email
  const searchUserByEmail = async () => {
    if (!searchEmail) {
      setError("Please enter an email to search.");
      return;
    }
    try {
      const response = await axios.get(`/api/users/${searchEmail}`);
      setUserDetails(response.data);
      setError("");
    } catch (err) {
      setError("User not found.");
      setUserDetails(null);
      console.error(err);
    }
  };

  // Add a new user
  const addUser = async () => {
    if (!newUser.name || !newUser.email || !newUser.password) {
      setError("All fields are required.");
      return;
    }
    try {
      const response = await axios.post("/api/users", newUser);
      setUsers([...users, response.data]);
      setSuccess("User added successfully.");
      setError("");
      setNewUser({ name: "", email: "", password: "", role: "user" });
    } catch (err) {
      setError("Failed to add user.");
      console.error(err);
    }
  };

  // Remove a user by email
  const removeUser = async (email) => {
    try {
      await axios.delete(`/api/users/${email}`);
      setUsers(users.filter((user) => user.email !== email));
      setSuccess("User removed successfully.");
      setError("");
    } catch (err) {
      setError("Failed to remove user.");
      console.error(err);
    }
  };

  // Ban/Unban a user by email
  const toggleBanUser = async (email, isBanned) => {
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
    }
  };

  useEffect(() => {
    fetchAllUsers();
  }, []);

  return (
    <div className="user-form">
      <h1>User Management</h1>

      {/* Search User by Email */}
      <div className="search-section">
        <h2>Search User by Email</h2>
        <input
          type="email"
          placeholder="Enter user email"
          value={searchEmail}
          onChange={(e) => setSearchEmail(e.target.value)}
        />
        <button onClick={searchUserByEmail}>Search</button>
        {userDetails && (
          <div className="user-details">
            <h3>User Details</h3>
            <p>Name: {userDetails.name}</p>
            <p>Email: {userDetails.email}</p>
            <p>Role: {userDetails.role}</p>
          </div>
        )}
      </div>

      {/* Add New User */}
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
        <button onClick={addUser}>Add User</button>
      </div>

      {/* Display All Users */}
      <div className="user-list">
        <h2>All Users</h2>
        <button onClick={fetchAllUsers}>Refresh List</button>
        <ul>
          {users.map((user) => (
            <li key={user.email}>
              <p>Name: {user.name}</p>
              <p>Email: {user.email}</p>
              <p>Role: {user.role}</p>
              <button onClick={() => removeUser(user.email)}>Remove</button>
              <button
                onClick={() => toggleBanUser(user.email, !user.isBanned)}
              >
                {user.isBanned ? "Unban" : "Ban"}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Success and Error Messages */}
      {error && <p className="error">{error}</p>}
      {success && <p className="success">{success}</p>}
    </div>
  );
};

export default UserForm;