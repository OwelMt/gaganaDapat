import React, { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';

const AuditTrails = () => {
  const BASE_URL = process.env.REACT_APP_API_URL || "https://gaganadapat.onrender.com";
  const navigate = useNavigate();
    useEffect(() => {
      const storedRole = localStorage.getItem('role');
      if (!storedRole) {
        navigate('/'); // redirect to login
      }
    }, [navigate]);

    const [incidentHistory, setIncidentHistory] = useState([]);
 


  useEffect(() => {
  const fetchData = () => {
    axios.get(`${BASE_URL}/history/getHistory`)
      .then(res => setIncidentHistory(res.data))
      .catch(err => console.error(err));
  };

  fetchData(); 

  const interval = setInterval(fetchData, 5000);

  return () => clearInterval(interval);
    }, []);




  return (
    <div>
    
      <h1>AuditTrails</h1>
      <h3>Manage Trails</h3>
      <table border="1" cellPadding="8" cellSpacing="0">
        <thead>
          <tr>
            <th>Action</th>
            <th>Location</th>
            <th>Details</th>
          </tr>
        </thead>
        <tbody>
          {incidentHistory.map((inc) => (
            <tr key={inc._id}>
              <td>{inc.action}</td>
              <td>{inc.placeName}</td>
              <td>{inc.details}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default AuditTrails;
