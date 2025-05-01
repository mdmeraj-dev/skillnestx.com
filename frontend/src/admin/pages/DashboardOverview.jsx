import { useEffect, useState } from 'react';
import axios from 'axios'; // Use axios for API calls
import '../styles/DashboardOverview.css';
import usersIcon from '../assets/icons/users.svg';
import subscribersIcon from '../assets/icons/subscribers.svg';
import coursesIcon from '../assets/icons/courses.svg';
import LoadingSpinner from './LoadingSpinner'; // Import a loading spinner component

const DashboardOverview = () => {
    const [totalUsers, setTotalUsers] = useState(0); // State for total users
    const [totalSubscribers, setTotalSubscribers] = useState(0); // State for total subscribers
    const [totalCourses, setTotalCourses] = useState(0); // State for total courses
    const [loading, setLoading] = useState(true); // Loading state for better UX
    const [error, setError] = useState(''); // Error state for handling API errors

    // Fetch all dashboard data (users, subscribers, courses) from the backend
    useEffect(() => {
        const fetchDashboardData = async () => {
            try {
                // Fetch total users
                const usersResponse = await axios.get('/api/users/total/count');
                setTotalUsers(usersResponse.data.totalUsers);

                // Fetch total subscribers
                const subscribersResponse = await axios.get('/api/subscriptions/total/count');
                setTotalSubscribers(subscribersResponse.data.totalSubscribers);

                // Fetch total courses
                const coursesResponse = await axios.get('/api/courses/total/count');
                setTotalCourses(coursesResponse.data.totalCourses);

                setLoading(false); // Disable loading state
            } catch (err) {
                console.error('Error fetching dashboard data:', err);
                setError('Failed to fetch dashboard data. Please try again later.');
                setLoading(false); // Disable loading state
            }
        };

        fetchDashboardData();
    }, []);

    // Display loading state
    if (loading) {
        return (
            <div className="dashboard-container">
                <LoadingSpinner /> {/* Show a loading spinner */}
            </div>
        );
    }

    // Display error state
    if (error) {
        return <div className="dashboard-container error">{error}</div>;
    }

    return (
        <div className="dashboard-container">
            {/* Stats Cards */}
            <div className="stats-row">
                <div className="card">
                    <img src={usersIcon} alt="Users" className="icon" />
                    <div className="card-content">
                        <h3>Total Users</h3>
                        <p>{totalUsers}</p>
                    </div>
                </div>
                <div className="card">
                    <img src={subscribersIcon} alt="Subscribers" className="icon" />
                    <div className="card-content">
                        <h3>Total Subscribers</h3>
                        <p>{totalSubscribers}</p>
                    </div>
                </div>
                <div className="card">
                    <img src={coursesIcon} alt="Courses" className="icon" />
                    <div className="card-content">
                        <h3>Total Courses</h3>
                        <p>{totalCourses}</p>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default DashboardOverview;