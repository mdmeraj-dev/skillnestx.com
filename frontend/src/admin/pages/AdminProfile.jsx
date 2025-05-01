import { useState } from "react";
import {
  Container,
  Typography,
  TextField,
  Button,
  Avatar,
  Grid,
  Paper,
  IconButton,
  InputAdornment,
  CircularProgress,
  Snackbar,
  Alert,
} from "@mui/material";

import "../styles/AdminProfile.css"; // Custom styles
import { Edit, Visibility, VisibilityOff } from "@mui/icons-material"; // Import Edit, Visibility, and VisibilityOff icons

const AdminProfile = () => {
  const [adminData, setAdminData] = useState({
    name: "John Doe",
    email: "admin@example.com",
    password: "",
    confirmPassword: "",
    profilePicture: "/assets/icons/profile-default.png", // Default profile image
  });

  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [snackbar, setSnackbar] = useState({ open: false, message: "", severity: "success" });

  // Handle Input Change
  const handleChange = (e) => {
    setAdminData({ ...adminData, [e.target.name]: e.target.value });
  };

  // Handle Profile Picture Change
  const handleProfilePictureChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setAdminData({ ...adminData, profilePicture: reader.result });
      };
      reader.readAsDataURL(file);
    }
  };

  // Handle Password Visibility Toggle
  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  // Handle Form Submission
  const handleSubmit = (e) => {
    e.preventDefault();
    setLoading(true);

    // Simulating API call
    setTimeout(() => {
      setLoading(false);
      setSnackbar({ open: true, message: "Profile updated successfully!", severity: "success" });
    }, 2000);
  };

  return (
    <Container maxWidth="sm">
      <Paper className="profile-container" elevation={3}>
        <Typography variant="h5" className="profile-title">Admin Profile</Typography>

        {/* Profile Picture Section */}
        <div className="profile-picture-section">
          <Avatar src={adminData.profilePicture} className="profile-avatar" />
          <input
            accept="image/*"
            type="file"
            id="profile-pic-upload"
            style={{ display: "none" }}
            onChange={handleProfilePictureChange}
          />
          <label htmlFor="profile-pic-upload">
            <IconButton component="span" className="edit-icon">
              <Edit />
            </IconButton>
          </label>
        </div>

        {/* Profile Form */}
        <form onSubmit={handleSubmit}>
          <Grid container spacing={2}>
            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Full Name"
                name="name"
                value={adminData.name}
                onChange={handleChange}
                variant="outlined"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Email Address"
                name="email"
                value={adminData.email}
                onChange={handleChange}
                variant="outlined"
                type="email"
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="New Password"
                name="password"
                value={adminData.password}
                onChange={handleChange}
                variant="outlined"
                type={showPassword ? "text" : "password"}
                InputProps={{
                  endAdornment: (
                    <InputAdornment position="end">
                      <IconButton onClick={togglePasswordVisibility} edge="end">
                        {showPassword ? <VisibilityOff /> : <Visibility />}
                      </IconButton>
                    </InputAdornment>
                  ),
                }}
              />
            </Grid>

            <Grid item xs={12}>
              <TextField
                fullWidth
                label="Confirm Password"
                name="confirmPassword"
                value={adminData.confirmPassword}
                onChange={handleChange}
                variant="outlined"
                type="password"
              />
            </Grid>
          </Grid>

          {/* Submit Button */}
          <Button
            type="submit"
            variant="contained"
            color="primary"
            fullWidth
            className="update-button"
            disabled={loading}
          >
            {loading ? <CircularProgress size={24} /> : "Update Profile"}
          </Button>
        </form>
      </Paper>

      {/* Snackbar for Notifications */}
      <Snackbar
        open={snackbar.open}
        autoHideDuration={3000}
        onClose={() => setSnackbar({ ...snackbar, open: false })}
      >
        <Alert severity={snackbar.severity}>{snackbar.message}</Alert>
      </Snackbar>
    </Container>
  );
};

export default AdminProfile;
