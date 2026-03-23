// src/components/admin/AdminDashboard.js
import React, { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import DashboardShell from '../layout/DashboardShell';
import '../css/AdminAnalytics.css';
import axios from 'axios';

import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  Title,
  Tooltip as ChartTooltip,
  Legend,
} from 'chart.js';
import { Bar, Line } from 'react-chartjs-2';

// Register chart primitives
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

export default function AdminDashboard() {
  const navigate = useNavigate();

  useEffect(() => {
    const role = localStorage.getItem('role');
    if (!role) navigate('/');
  }, [navigate]);

  const [evacAnalytics, setEvacAnalytics] = useState({
    totalPlaces: 0,
    statusCounts: { available: 0, limited: 0, full: 0 },
    totalCapacity: 0,
    averageCapacity: 0,
  });
  const [stats, setStats] = useState({
    reported: 0,
    onProcess: 0,
    resolved: 0,
    total: 0,
  });
  const [trendData, setTrendData] = useState([]);
  const [typeStats, setTypeStats] = useState({});

  useEffect(() => {
    const fetchEvac = async () => {
      try {
        const res = await axios.get('http://localhost:8000/evacs/analytics/summary');
        setEvacAnalytics(res.data || {});
      } catch (e) { console.error(e); }
    };
    const fetchStats = async () => {
      try {
        const res = await axios.get('http://localhost:8000/incident/stats');
        setStats(res.data || {});
      } catch (e) { console.error(e); }
    };
    const fetchTrend = async () => {
      try {
        const res = await axios.get('http://localhost:8000/incident/trend');
        setTrendData(res.data || []);
      } catch (e) { console.error(e); }
    };
    const fetchType = async () => {
      try {
        const res = await axios.get('http://localhost:8000/incident/typeStats');
        setTypeStats(res.data || {});
      } catch (e) { console.error(e); }
    };

    fetchEvac(); fetchStats(); fetchTrend(); fetchType();
    const t = setInterval(() => { fetchEvac(); fetchStats(); fetchTrend(); fetchType(); }, 10000);
    return () => clearInterval(t);
  }, []);

  // Chart data
  const statusBarData = useMemo(() => ({
    labels: ['Available', 'Limited', 'Full'],
    datasets: [{
      label: 'Centers by Status',
      data: [
        evacAnalytics?.statusCounts?.available || 0,
        evacAnalytics?.statusCounts?.limited || 0,
        evacAnalytics?.statusCounts?.full || 0,
      ],
      backgroundColor: ['#22c55e', '#a3e635', '#ef4444'], // green / lime / red
      borderRadius: 6,
    }]
  }), [evacAnalytics]);

  const trendLineData = useMemo(() => ({
    labels: (trendData || []).map((d) => d._id),
    datasets: [{
      label: 'Incidents per Day',
      data: (trendData || []).map((d) => d.count),
      borderColor: '#16a34a',
      backgroundColor: 'rgba(22,163,74,0.18)',
      fill: true,
      tension: 0.35,
      pointRadius: 2,
      pointHoverRadius: 4,
    }]
  }), [trendData]);

  const typeBarData = useMemo(() => {
    const order = ['flood', 'fire', 'earthquake', 'typhoon'];
    return {
      labels: order.map((x) => x[0].toUpperCase() + x.slice(1)),
      datasets: [{
        label: 'Incidents per Type',
        data: order.map((k) => typeStats[k] || 0),
        backgroundColor: ['#22c55e', '#ef4444', '#84cc16', '#10b981'],
        borderRadius: 6,
      }]
    };
  }, [typeStats]);

  // Shared options
  const baseOptions = {
    responsive: true,
    maintainAspectRatio: false, // let CSS height drive the canvas
    plugins: {
      legend: { display: false },
      title: { display: false },
      tooltip: { mode: 'index', intersect: false },
    },
    interaction: { mode: 'nearest', intersect: false },
    scales: {
      x: {
        ticks: { color: '#0b1b12', font: { size: 11 } },
        grid: { color: 'rgba(16,185,129,0.18)' },
      },
      y: {
        beginAtZero: true,
        ticks: { color: '#0b1b12', stepSize: 1, font: { size: 11 } },
        grid: { color: 'rgba(16,185,129,0.18)' },
      },
    },
  };

  return (
    <DashboardShell>
      {/* Root fills available area; scroller provides vertical scroll only */}
      <div className="analytics-page">
        <div className="analytics-scroll">
          <div className="analytics-container">
            {/* Header (darker title + subtitle) */}
            <header className="analytics-header">
              <div>
                <h2 className="analytics-title">Analytics</h2>
                <p className="analytics-subtitle">
                  Real-time overview of incidents & evacuation centers
                </p>
              </div>
            </header>

            {/* KPIs */}
            <section className="analytics-metric-grid">
              <div className="a-metric-card">
                <div className="a-metric-label">Total Centers</div>
                <div className="a-metric-value">{evacAnalytics?.totalPlaces || 0}</div>
              </div>
              <div className="a-metric-card">
                <div className="a-metric-label">Available</div>
                <div className="a-metric-value">{evacAnalytics?.statusCounts?.available || 0}</div>
              </div>
              <div className="a-metric-card">
                <div className="a-metric-label">Limited</div>
                <div className="a-metric-value">{evacAnalytics?.statusCounts?.limited || 0}</div>
              </div>
              <div className="a-metric-card">
                <div className="a-metric-label">Full</div>
                <div className="a-metric-value">{evacAnalytics?.statusCounts?.full || 0}</div>
              </div>
              <div className="a-metric-card">
                <div className="a-metric-label">Total Capacity</div>
                <div className="a-metric-value">{evacAnalytics?.totalCapacity || 0}</div>
              </div>
              <div className="a-metric-card">
                <div className="a-metric-label">Avg. Capacity</div>
                <div className="a-metric-value">
                  {Math.round((evacAnalytics?.averageCapacity || 0) * 10) / 10}
                </div>
              </div>
              <div className="a-metric-card">
                <div className="a-metric-label">Reported</div>
                <div className="a-metric-value">{stats?.reported || 0}</div>
              </div>
              <div className="a-metric-card">
                <div className="a-metric-label">On Process</div>
                <div className="a-metric-value">{stats?.onProcess || 0}</div>
              </div>
              <div className="a-metric-card">
                <div className="a-metric-label">Resolved</div>
                <div className="a-metric-value">{stats?.resolved || 0}</div>
              </div>
              <div className="a-metric-card">
                <div className="a-metric-label">Total Incidents</div>
                <div className="a-metric-value">{stats?.total || 0}</div>
              </div>
            </section>

            {/* Charts */}
            <section className="analytics-chart-grid">
              {/* Status bar chart + legend (Available / Limited / Full) */}
              <div className="a-card a-chart-card">
                <div className="a-card-title">Evacuation Center Status</div>
                <div className="a-chart-body">
                  <Bar data={statusBarData} options={baseOptions} />
                </div>
                <div className="a-legend-inline a-legend-inline--tight">
                  <span className="a-legend-dot" style={{ background: '#22c55e' }} /> Available
                  <span className="a-legend-dot" style={{ background: '#a3e635' }} /> Limited
                  <span className="a-legend-dot" style={{ background: '#ef4444' }} /> Full
                </div>
              </div>

              {/* Trend line chart */}
              <div className="a-card a-chart-card">
                <div className="a-card-title">Incident Trend Over Time</div>
                <div className="a-chart-body">
                  <Line data={trendLineData} options={baseOptions} />
                </div>
              </div>

              {/* Type distribution + legend */}
              <div className="a-card a-chart-card a-chart-card--full">
                <div className="a-card-title">Incident Type Distribution</div>
                <div className="a-chart-body">
                  <Bar data={typeBarData} options={baseOptions} />
                </div>
                <div className="a-legend-inline a-legend-inline--tight">
                  <span className="a-legend-dot" style={{ background: '#22c55e' }} /> Flood
                  <span className="a-legend-dot" style={{ background: '#ef4444' }} /> Fire
                  <span className="a-legend-dot" style={{ background: '#84cc16' }} /> Earthquake
                  <span className="a-legend-dot" style={{ background: '#10b981' }} /> Typhoon
                </div>
              </div>
            </section>
          </div>
        </div>
      </div>
    </DashboardShell>
  );
}