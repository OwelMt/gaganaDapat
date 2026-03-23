// src/components/admin/AdminAnalytics.js
import React, { useEffect, useState, useMemo } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../layout/DashboardShell';
import './AdminDashboard.css';

import {
  Chart as ChartJS,
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  Title, Tooltip as ChartTooltip, Legend
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  ChartTooltip,
  Legend
);

export default function AdminAnalytics() {
  const navigate = useNavigate();

  const [evacAnalytics, setEvacAnalytics] = useState({
    totalPlaces: 0,
    statusCounts: { available: 0, limited: 0, full: 0 },
    totalCapacity: 0,
    averageCapacity: 0
  });
  const [stats, setStats] = useState({
    reported: 0,
    onProcess: 0,
    resolved: 0,
    total: 0
  });
  const [trendData, setTrendData] = useState([]);
  const [typeStats, setTypeStats] = useState({});

  // auth guard
  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (!storedRole) navigate('/');
  }, [navigate]);

  // fetchers
  useEffect(() => {
    const fetchEvacAnalytics = async () => {
      try {
        const res = await axios.get('http://localhost:8000/evacs/analytics/summary');
        setEvacAnalytics(res.data);
      } catch (err) { console.error(err); }
    };
    fetchEvacAnalytics();
    const t = setInterval(fetchEvacAnalytics, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const res = await axios.get('http://localhost:8000/incident/stats');
        setStats(res.data);
      } catch (err) { console.error(err); }
    };
    fetchStats();
    const t = setInterval(fetchStats, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchTrend = async () => {
      try {
        const res = await axios.get('http://localhost:8000/incident/trend');
        setTrendData(res.data || []);
      } catch (err) { console.error(err); }
    };
    fetchTrend();
    const t = setInterval(fetchTrend, 5000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const fetchTypeStats = async () => {
      try {
        const res = await axios.get('http://localhost:8000/incident/typeStats');
        setTypeStats(res.data || {});
      } catch (err) { console.error(err); }
    };
    fetchTypeStats();
    const t = setInterval(fetchTypeStats, 5000);
    return () => clearInterval(t);
  }, []);

  // Chart data
  const statusBarData = useMemo(() => ({
    labels: ['Available', 'Limited', 'Full'],
    datasets: [{
      label: 'Centers by Status',
      data: [
        evacAnalytics.statusCounts?.available || 0,
        evacAnalytics.statusCounts?.limited || 0,
        evacAnalytics.statusCounts?.full || 0
      ],
      backgroundColor: ['#34d399', '#fbbf24', '#f87171']
    }]
  }), [evacAnalytics]);

  const trendLineData = useMemo(() => ({
    labels: (trendData || []).map(it => it._id),
    datasets: [{
      label: 'Incidents per Day',
      data: (trendData || []).map(it => it.count),
      borderColor: '#60a5fa',
      backgroundColor: 'rgba(96,165,250,0.2)',
      fill: true,
      tension: 0.3,
      pointRadius: 3,
      pointHoverRadius: 5
    }]
  }), [trendData]);

  const typeBarData = useMemo(() => {
    const order = ['flood', 'fire', 'earthquake', 'typhoon'];
    return {
      labels: order.map(x => x[0].toUpperCase() + x.slice(1)),
      datasets: [{
        label: 'Incidents per Type',
        data: order.map(k => typeStats[k] || 0),
        backgroundColor: ['#3b82f6', '#ef4444', '#f59e0b', '#fb923c']
      }]
    };
  }, [typeStats]);

  return (
    <DashboardShell>
      <div className="admin-wrapper">
        <div className="admin-container">
          <header className="admin-header">
            <div>
              <h2 className="admin-title">Analytics</h2>
              <p className="admin-subtitle">Real-time overview of incidents and evacuation centers</p>
            </div>
            <div className="admin-header-actions">
              <button className="btn btn-secondary" onClick={() => navigate('/admin')}>Incident Admin</button>
            </div>
          </header>

          {/* KPI GRID */}
          <section className="metric-grid">
            <div className="metric-card">
              <div className="metric-label">Total Centers</div>
              <div className="metric-value">{evacAnalytics.totalPlaces}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Available</div>
              <div className="metric-value">{evacAnalytics.statusCounts?.available || 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Limited</div>
              <div className="metric-value">{evacAnalytics.statusCounts?.limited || 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Full</div>
              <div className="metric-value">{evacAnalytics.statusCounts?.full || 0}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total Capacity</div>
              <div className="metric-value">{evacAnalytics.totalCapacity}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Avg. Capacity</div>
              <div className="metric-value">
                {Math.round((evacAnalytics.averageCapacity || 0) * 10) / 10}
              </div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Reported</div>
              <div className="metric-value">{stats.reported}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">On Process</div>
              <div className="metric-value">{stats.onProcess}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Resolved</div>
              <div className="metric-value">{stats.resolved}</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Total Incidents</div>
              <div className="metric-value">{stats.total}</div>
            </div>
          </section>

          {/* CHART GRID */}
          <section className="chart-grid">
            <div className="card chart-card">
              <div className="card-title">Evacuation Center Status Distribution</div>
              <Bar
                data={statusBarData}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }}
              />
            </div>

            <div className="card chart-card">
              <div className="card-title">Incident Trend Over Time</div>
              <Line
                data={trendLineData}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: {
                    x: { title: { display: true, text: 'Date' } },
                    y: { beginAtZero: true, title: { display: true, text: 'Incidents' } }
                  }
                }}
              />
            </div>

            <div className="card chart-card chart-card--full">
              <div className="card-title">Incident Type Distribution</div>
              <Bar
                data={typeBarData}
                options={{
                  responsive: true,
                  plugins: { legend: { display: false } },
                  scales: { y: { beginAtZero: true, ticks: { stepSize: 1 } } }
                }}
              />
              <div className="legend-inline">
                <span className="legend-dot" style={{ background: '#3b82f6' }} /> Flood
                <span className="legend-dot" style={{ background: '#ef4444' }} /> Fire
                <span className="legend-dot" style={{ background: '#f59e0b' }} /> Earthquake
                <span className="legend-dot" style={{ background: '#fb923c' }} /> Typhoon
              </div>
            </div>
          </section>
        </div>
      </div>
    </DashboardShell>
  );
}