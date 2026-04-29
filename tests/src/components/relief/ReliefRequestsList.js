import { useEffect, useState, useCallback, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  FaBell,
  FaCheck,
  FaClipboardCheck,
  FaClock,
  FaDownload,
  FaExclamationTriangle,
  FaExternalLinkAlt,
  FaInbox,
  FaTimes,
  FaTruckLoading,
  FaUndo
} from 'react-icons/fa';
import DashboardShell from '../layout/DashboardShell';
import '../css/ReliefRequestList.css';

const BASE_URL =
  process.env.REACT_APP_API_URL || 'https://gaganadapat.onrender.com';

const INVENTORY_RELEASE_ROUTE = '/drrmo/inventory';

const NOTIFICATION_DURATION = 10000;
const MAX_VISIBLE_NOTIFICATIONS = 4;

const normalize = (value) => String(value || '').trim().toLowerCase();

const formatStatusLabel = (value) =>
  String(value || '')
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase()) || '-';

const isResolvedStatus = (status) => {
  const normalized = normalize(status);
  return (
    normalized === 'received' ||
    normalized === 'completed' ||
    normalized === 'cancelled' ||
    normalized === 'canceled' ||
    normalized === 'rejected'
  );
};

const getRequestIndividuals = (request) => {
  const totals = request?.totals || {};
  return (
    Number(totals.male || 0) +
    Number(totals.female || 0) +
    Number(totals.lgbtq || 0) +
    Number(totals.pwd || 0) +
    Number(totals.pregnant || 0) +
    Number(totals.senior || 0)
  );
};

const getVulnerableCount = (request) => {
  const priority = request?.prioritySnapshot || {};
  if (priority.vulnerableCount !== undefined) {
    return Number(priority.vulnerableCount || 0);
  }

  const totals = request?.totals || {};
  return (
    Number(totals.pwd || 0) +
    Number(totals.pregnant || 0) +
    Number(totals.senior || 0)
  );
};

const getRequestSyncKey = (request) =>
  [
    request?._id || '',
    request?.updatedAt || '',
    request?.lastEditedAt || '',
    request?.editCount || 0,
    request?.totals?.requestedFoodPacks || 0,
    normalize(request?.status)
  ].join('|');

const getFlowTone = (request) => {
  const status = normalize(request?.status);

  if (status === 'pending') return 'pending';
  if (status === 'approved') return 'approved';
  if (status === 'partially_released') return 'approved';
  if (status === 'released') return 'released';
  if (status === 'received') return 'received';
  return 'default';
};

const getStatusOrder = (status) => {
  const normalized = normalize(status);

  if (normalized === 'pending') return 0;
  if (normalized === 'approved') return 1;
  if (normalized === 'partially_released') return 1;
  if (normalized === 'released') return 2;
  if (normalized === 'received') return 3;
  return 99;
};

const sortOperationalQueue = (items = []) =>
  [...items].sort((a, b) => {
    const statusDiff = getStatusOrder(a?.status) - getStatusOrder(b?.status);
    if (statusDiff !== 0) return statusDiff;

    const aTime = new Date(a?.requestDate || a?.createdAt || 0).getTime();
    const bTime = new Date(b?.requestDate || b?.createdAt || 0).getTime();
    return aTime - bTime;
  });

const areQueuesEquivalent = (prevRows = [], nextRows = []) => {
  if (prevRows.length !== nextRows.length) return false;

  for (let i = 0; i < prevRows.length; i += 1) {
    const prev = prevRows[i];
    const next = nextRows[i];

    if ((prev?._id || '') !== (next?._id || '')) return false;
    if (normalize(prev?.status) !== normalize(next?.status)) return false;

    const prevRequested = Number(prev?.totals?.requestedFoodPacks || 0);
    const nextRequested = Number(next?.totals?.requestedFoodPacks || 0);
    if (prevRequested !== nextRequested) return false;

    const prevEdited = Boolean(prev?.isEditedAfterSubmit);
    const nextEdited = Boolean(next?.isEditedAfterSubmit);
    if (prevEdited !== nextEdited) return false;

    const prevEditCount = Number(prev?.editCount || 0);
    const nextEditCount = Number(next?.editCount || 0);
    if (prevEditCount !== nextEditCount) return false;

    const prevLastEditedAt = prev?.lastEditedAt || '';
    const nextLastEditedAt = next?.lastEditedAt || '';
    if (prevLastEditedAt !== nextLastEditedAt) return false;
  }

  return true;
};

const buildNotification = (message, type = 'info') => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
  message,
  type
});

const getNotificationIcon = (type) => {
  if (type === 'success') return <FaCheck />;
  if (type === 'error') return <FaTimes />;
  if (type === 'warning') return <FaExclamationTriangle />;
  return <FaBell />;
};

const EMPTY_CONFIRM_STATE = {
  open: false,
  title: '',
  message: '',
  action: '',
  request: null
};

export default function ReliefRequestsList() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [receivedRows, setReceivedRows] = useState([]);
  const [loadingQueue, setLoadingQueue] = useState(true);
  const [selectedRequest, setSelectedRequest] = useState(null);

  const [queueFilter, setQueueFilter] = useState('active');
  const [barangayFilter, setBarangayFilter] = useState('');

  const [reviewDetails, setReviewDetails] = useState(null);
  const [feasibility, setFeasibility] = useState(null);
  const [loadingDetails, setLoadingDetails] = useState(false);

  const [pdfPreviewUrl, setPdfPreviewUrl] = useState('');
  const [submittingAction, setSubmittingAction] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [confirmState, setConfirmState] = useState(EMPTY_CONFIRM_STATE);
  const [rejectReason, setRejectReason] = useState('');

  const notificationTimeoutsRef = useRef({});
  const lastSelectedRequestIdRef = useRef(null);
  const editedWarningNotifiedRef = useRef(new Set());

  useEffect(() => {
    const storedRole = localStorage.getItem('role');
    if (!storedRole) {
      navigate('/');
    }
  }, [navigate]);

  useEffect(() => {
    const timeouts = notificationTimeoutsRef.current;
    return () => {
      Object.values(timeouts).forEach((timeoutId) => {
        clearTimeout(timeoutId);
      });
    };
  }, []);

  const removeNotification = useCallback((id) => {
    setNotifications((prev) => prev.filter((item) => item.id !== id));

    if (notificationTimeoutsRef.current[id]) {
      clearTimeout(notificationTimeoutsRef.current[id]);
      delete notificationTimeoutsRef.current[id];
    }
  }, []);

  const pushNotification = useCallback((message, type = 'info') => {
    const notification = buildNotification(message, type);

    setNotifications((prev) => {
      const next = [notification, ...prev];
      return next.slice(0, MAX_VISIBLE_NOTIFICATIONS);
    });

    notificationTimeoutsRef.current[notification.id] = setTimeout(() => {
      setNotifications((prev) => prev.filter((item) => item.id !== notification.id));
      delete notificationTimeoutsRef.current[notification.id];
    }, NOTIFICATION_DURATION);
  }, []);

  const formatDate = (date) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleDateString();
    } catch {
      return '-';
    }
  };

  const formatTime = (date) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  const formatDateTime = (date) => {
    if (!date) return '-';
    try {
      return new Date(date).toLocaleString([], {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    } catch {
      return '-';
    }
  };

  const getPdfPath = (request) => {
    if (request?.pdfFile) return request.pdfFile;
    if (request?.requestNo) {
      return `/uploads/relief-requests/${request.requestNo}.pdf`;
    }
    return '';
  };

  const getQueueHeading = () => {
    if (queueFilter === 'pending') return 'Pending Review';
    if (queueFilter === 'approved') return 'Awaiting Release';
    if (queueFilter === 'released') return 'Awaiting Receipt';
    if (queueFilter === 'received') return 'Received Requests';
    return 'Active Queue';
  };

  const fetchQueue = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setLoadingQueue(true);
        }

        const params = new URLSearchParams();
        params.set('status', queueFilter);

        const receivedParams = new URLSearchParams();
        receivedParams.set('status', 'received');

        const [res, receivedRes] = await Promise.all([
          fetch(`${BASE_URL}/api/drrmo/requests/queue?${params.toString()}`, {
            credentials: 'include'
          }),
          fetch(`${BASE_URL}/api/drrmo/requests/queue?${receivedParams.toString()}`, {
            credentials: 'include'
          })
        ]);

        if (!res.ok) {
          throw new Error('Failed to fetch request queue');
        }

        const data = await res.json();
        const requests = Array.isArray(data?.requests) ? data.requests : [];
        const receivedData = receivedRes.ok ? await receivedRes.json() : null;
        const receivedRequests = Array.isArray(receivedData?.requests)
          ? sortOperationalQueue(
              receivedData.requests.filter(
                (item) => normalize(item?.status) === 'received'
              )
            )
          : [];

        const cleaned = sortOperationalQueue(
          requests.filter((item) => {
            const status = normalize(item?.status);
            if (queueFilter === 'received') return status === 'received';
            if (isResolvedStatus(status)) return false;
            if (status === 'partially_released') return false;
            return true;
          })
        );

        setReceivedRows(receivedRequests);

        setRows((prevRows) => {
          if (areQueuesEquivalent(prevRows, cleaned)) {
            return prevRows;
          }
          return cleaned;
        });

        setSelectedRequest((prevSelected) => {
          if (!cleaned.length) return null;
          if (!prevSelected?._id) return cleaned[0];

          const matched = cleaned.find((item) => item._id === prevSelected._id);
          return matched || cleaned[0];
        });

        const editedPending = cleaned.filter(
          (item) =>
            normalize(item?.status) === 'pending' &&
            item?.isEditedAfterSubmit &&
            !editedWarningNotifiedRef.current.has(item._id)
        );

        if (editedPending.length > 0) {
          editedPending.forEach((item) => {
            editedWarningNotifiedRef.current.add(item._id);
          });

          pushNotification(
            `${editedPending.length} edited request${
              editedPending.length > 1 ? 's need' : ' needs'
            } review.`,
            'warning'
          );
        }
      } catch (err) {
        console.error(err);

        if (!silent) {
          setRows([]);
          setReceivedRows([]);
          setSelectedRequest(null);
          setReviewDetails(null);
          setFeasibility(null);
          pushNotification(err.message || 'Failed to load request queue.', 'error');
        }
      } finally {
        if (!silent) {
          setLoadingQueue(false);
        }
      }
    },
    [queueFilter, pushNotification]
  );

  useEffect(() => {
    fetchQueue();

    const interval = setInterval(() => {
      fetchQueue({ silent: true });
    }, 10000);

    return () => clearInterval(interval);
  }, [fetchQueue]);

  const barangayOptions = useMemo(() => {
    return [
      ...new Set(
        [...rows, ...receivedRows]
          .map((row) => String(row?.barangayName || '').trim())
          .filter(Boolean)
      )
    ].sort((a, b) => a.localeCompare(b));
  }, [rows, receivedRows]);

  const filteredRows = useMemo(() => {
    let nextRows = [...rows];

    if (barangayFilter) {
      nextRows = nextRows.filter(
        (row) => String(row?.barangayName || '').trim() === barangayFilter
      );
    }

    if (queueFilter === 'pending') {
      nextRows = nextRows.filter((row) => normalize(row?.status) === 'pending');
    } else if (queueFilter === 'approved') {
      nextRows = nextRows.filter((row) => normalize(row?.status) === 'approved');
    } else if (queueFilter === 'released') {
      nextRows = nextRows.filter((row) => normalize(row?.status) === 'released');
    } else if (queueFilter === 'received') {
      nextRows = nextRows.filter((row) => normalize(row?.status) === 'received');
    }

    return sortOperationalQueue(nextRows);
  }, [rows, barangayFilter, queueFilter]);

  useEffect(() => {
    setSelectedRequest((prev) => {
      if (!filteredRows.length) return null;
      if (!prev?._id) return filteredRows[0];

      const matched = filteredRows.find((item) => item._id === prev._id);
      return matched || filteredRows[0];
    });
  }, [filteredRows]);

  useEffect(() => {
    if (!filteredRows.length) {
      setSelectedRequest(null);
      setReviewDetails(null);
      setFeasibility(null);
      setPdfPreviewUrl('');
      lastSelectedRequestIdRef.current = null;
      return;
    }

    if (
      selectedRequest?._id &&
      !filteredRows.some((item) => item._id === selectedRequest._id)
    ) {
      setReviewDetails(null);
      setFeasibility(null);
      setPdfPreviewUrl('');
      lastSelectedRequestIdRef.current = null;
    }
  }, [filteredRows, selectedRequest]);

  const visibleSelectedRequest = useMemo(() => {
    if (!selectedRequest?._id) return null;
    return filteredRows.find((item) => item._id === selectedRequest._id) || null;
  }, [filteredRows, selectedRequest]);

  useEffect(() => {
    const loadSelectedRequestSupportData = async () => {
      if (!visibleSelectedRequest?._id) {
        setReviewDetails(null);
        setFeasibility(null);
        lastSelectedRequestIdRef.current = null;
        return;
      }

      const selectedRequestKey = getRequestSyncKey(visibleSelectedRequest);

      if (lastSelectedRequestIdRef.current === selectedRequestKey) {
        return;
      }

      lastSelectedRequestIdRef.current = selectedRequestKey;

      try {
        setLoadingDetails(true);

        const [detailsRes, feasibilityRes] = await Promise.all([
          fetch(`${BASE_URL}/api/drrmo/requests/${visibleSelectedRequest._id}`, {
            credentials: 'include'
          }),
          fetch(
            `${BASE_URL}/api/drrmo/requests/${visibleSelectedRequest._id}/feasibility`,
            {
              credentials: 'include'
            }
          )
        ]);

        const detailsData = detailsRes.ok ? await detailsRes.json() : null;
        const feasibilityData = feasibilityRes.ok ? await feasibilityRes.json() : null;

        setReviewDetails(detailsData);
        setFeasibility(feasibilityData);
      } catch (err) {
        console.error(err);
        setReviewDetails(null);
        setFeasibility(null);
        pushNotification('Failed to load request details.', 'error');
      } finally {
        setLoadingDetails(false);
      }
    };

    loadSelectedRequestSupportData();
  }, [visibleSelectedRequest, pushNotification]);

  const displayedRequest = visibleSelectedRequest
    ? reviewDetails?.request || visibleSelectedRequest
    : null;

  const inventorySummary =
    visibleSelectedRequest
      ? feasibility?.inventorySummary || reviewDetails?.inventorySummary || null
      : null;

  const lowStockWarnings =
    visibleSelectedRequest && Array.isArray(feasibility?.lowStockWarnings)
      ? feasibility.lowStockWarnings
      : [];

  const receivedSummaryBarangay =
    barangayFilter || String(displayedRequest?.barangayName || '').trim();

  const topTotals = useMemo(() => {
    const receivedSource = receivedSummaryBarangay
      ? receivedRows.filter(
          (row) => String(row?.barangayName || '').trim() === receivedSummaryBarangay
        )
      : receivedRows;

    const receivedTotals = receivedSource.reduce(
      (acc, row) => {
        acc.requests += 1;
        acc.foodPacks += Number(
          row?.fulfillment?.receivedFoodPacks ||
            row?.fulfillment?.releasedFoodPacks ||
            row?.totals?.receivedFoodPacks ||
            row?.totals?.releasedFoodPacks ||
            row?.totals?.requestedFoodPacks ||
            0
        );
        return acc;
      },
      { requests: 0, foodPacks: 0 }
    );

    return filteredRows.reduce(
      (acc, row) => {
        acc.requests += 1;
        acc.pending += normalize(row?.status) === 'pending' ? 1 : 0;
        acc.awaitingRelease += normalize(row?.status) === 'approved' ? 1 : 0;
        return acc;
      },
      {
        requests: 0,
        pending: 0,
        awaitingRelease: 0,
        received: receivedTotals.requests,
        receivedFoodPacks: receivedTotals.foodPacks
      }
    );
  }, [filteredRows, receivedRows, receivedSummaryBarangay]);

  const displayedRequested = Number(displayedRequest?.totals?.requestedFoodPacks || 0);

  const selectedIndividuals = displayedRequest ? getRequestIndividuals(displayedRequest) : 0;
  const selectedVulnerable = displayedRequest ? getVulnerableCount(displayedRequest) : 0;
  const selectedSubmittedAt =
    displayedRequest?.submittedAt ||
    displayedRequest?.createdAt ||
    displayedRequest?.requestDate ||
    null;

  const lowStockCount = lowStockWarnings.length;
  const totalStockUnits = Number(inventorySummary?.totalStockUnits || 0);

  const openReleasePlanner = (request) => {
    if (!request?._id) return;

    navigate(INVENTORY_RELEASE_ROUTE, {
      state: {
        openReleasePlanner: true,
        selectedReliefRequestId: request._id,
        selectedReliefRequest: request
      }
    });
  };

  const closeConfirmation = useCallback(() => {
    if (submittingAction) return;
    setConfirmState(EMPTY_CONFIRM_STATE);
    setRejectReason('');
  }, [submittingAction]);

  const openApproveConfirmation = useCallback((request) => {
    if (!request?._id) return;

    setConfirmState({
      open: true,
      title: 'Approve relief request?',
      message: `This will mark ${request.barangayName || 'this barangay'} request as approved and move it to release planning.`,
      action: 'approve',
      request
    });
    setRejectReason('');
  }, []);

  const openRejectConfirmation = useCallback((request) => {
    if (!request?._id) return;

    setConfirmState({
      open: true,
      title: 'Reject relief request?',
      message: `Enter the rejection reason for ${request.barangayName || 'this barangay'} before confirming.`,
      action: 'reject',
      request
    });
    setRejectReason('');
  }, []);

  const openReceiveConfirmation = useCallback((request) => {
    if (!request?._id) return;

    setConfirmState({
      open: true,
      title: 'Mark release as received?',
      message: `This will close ${request.barangayName || 'this barangay'} request as received and keep the released item data visible in their request record.`,
      action: 'receive',
      request
    });
    setRejectReason('');
  }, []);

  const handleReject = async (requestId) => {
    const trimmedReason = rejectReason.trim();

    if (!trimmedReason) {
      pushNotification('Please enter a rejection reason.', 'error');
      return;
    }

    try {
      setSubmittingAction(true);

      const res = await fetch(`${BASE_URL}/api/drrmo/requests/${requestId}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'reject',
          remarks: trimmedReason
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to reject request');
      }

      setPdfPreviewUrl('');
      setReviewDetails(null);
      setFeasibility(null);
      lastSelectedRequestIdRef.current = null;
      setConfirmState(EMPTY_CONFIRM_STATE);
      setRejectReason('');
      await fetchQueue();
      pushNotification('Request rejected successfully.', 'success');
    } catch (err) {
      console.error(err);
      pushNotification(err.message || 'Failed to reject request.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleApprove = async (request) => {
    try {
      setSubmittingAction(true);

      const res = await fetch(`${BASE_URL}/api/drrmo/requests/${request._id}/status`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          action: 'accept',
          remarks: 'Approved by DRRMO'
        })
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to approve request');
      }

      setConfirmState(EMPTY_CONFIRM_STATE);
      setRejectReason('');
      pushNotification('Request approved. Opening release planner...', 'success');
      await fetchQueue();

      navigate(INVENTORY_RELEASE_ROUTE, {
        state: {
          openReleasePlanner: true,
          selectedReliefRequestId: request._id,
          selectedReliefRequest: data?.request || request
        }
      });
    } catch (err) {
      console.error(err);
      pushNotification(err.message || 'Failed to approve request.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleMarkReceived = async (request) => {
    if (!request?._id) return;

    try {
      setSubmittingAction(true);

      const res = await fetch(`${BASE_URL}/api/relief-requests/${request._id}/received`, {
        method: 'PUT',
        credentials: 'include'
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.message || 'Failed to mark request as received');
      }

      setPdfPreviewUrl('');
      setReviewDetails(null);
      setFeasibility(null);
      lastSelectedRequestIdRef.current = null;
      setConfirmState(EMPTY_CONFIRM_STATE);
      setRejectReason('');
      await fetchQueue();
      pushNotification('Released goods marked as received.', 'success');
    } catch (err) {
      console.error(err);
      pushNotification(err.message || 'Failed to mark request as received.', 'error');
    } finally {
      setSubmittingAction(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmState?.request?._id) return;

    if (confirmState.action === 'approve') {
      await handleApprove(confirmState.request);
      return;
    }

    if (confirmState.action === 'reject') {
      await handleReject(confirmState.request._id);
      return;
    }

    if (confirmState.action === 'receive') {
      await handleMarkReceived(confirmState.request);
    }
  };

  const openPdfInNewTab = (pdfPath) => {
    if (!pdfPath) {
      pushNotification('No PDF file available for this request yet.', 'info');
      return;
    }

    window.open(`${BASE_URL}${pdfPath}`, '_blank', 'noopener,noreferrer');
    pushNotification('PDF opened in a new tab.', 'info');
  };

  const closePdfPreview = () => {
    setPdfPreviewUrl('');
  };

  const handleSelectRequest = (row) => {
    if (!row?._id) return;
    if (selectedRequest?._id === row._id) return;

    setSelectedRequest(row);
    setPdfPreviewUrl('');
    setReviewDetails(null);
    setFeasibility(null);
    lastSelectedRequestIdRef.current = null;
  };

  const selectedTone = getFlowTone(displayedRequest);

  const canApprove = normalize(displayedRequest?.status) === 'pending';
  const canOpenPlanner = normalize(displayedRequest?.status) === 'approved';
  const canMarkReceived = normalize(displayedRequest?.status) === 'released';
  const canReject =
    normalize(displayedRequest?.status) === 'pending' ||
    normalize(displayedRequest?.status) === 'approved';

  return (
    <DashboardShell>
      <div className="rrl-page">
        <div className="rrl-shell">
          <section className="rrl-header-card">
            <div className="rrl-header-head">
              <div className="rrl-header-main">
                <h1 className="rrl-header-title">Relief Request Review</h1>
              </div>
            </div>

            <div className="rrl-totals-row rrl-totals-row-compact">
              <div className="rrl-total-card">
                <div className="rrl-total-card-top">
                  <span>In Queue</span>
                  <span className="rrl-total-icon"><FaInbox /></span>
                </div>
                <strong>{topTotals.requests}</strong>
              </div>
              <div className="rrl-total-card pending">
                <div className="rrl-total-card-top">
                  <span>Pending Review</span>
                  <span className="rrl-total-icon"><FaClock /></span>
                </div>
                <strong>{topTotals.pending}</strong>
              </div>
              <div className="rrl-total-card warning">
                <div className="rrl-total-card-top">
                  <span>Awaiting Release</span>
                  <span className="rrl-total-icon"><FaTruckLoading /></span>
                </div>
                <strong>{topTotals.awaitingRelease}</strong>
              </div>
              <div className="rrl-total-card success">
                <div className="rrl-total-card-top">
                  <span>Successful Releases</span>
                  <span className="rrl-total-icon"><FaCheck /></span>
                </div>
                <strong>{topTotals.received}</strong>
                <small className="rrl-total-note">
                  {receivedSummaryBarangay || 'All barangays'} ·{' '}
                  {topTotals.receivedFoodPacks.toLocaleString()} food pack(s)
                </small>
              </div>
            </div>
          </section>

          <section className="rrl-board rrl-board-tight">
            <div className="rrl-board-left">
              <section className="rrl-card rrl-queue-card">
                <div className="rrl-toolbar">
                  <div className="rrl-toolbar-top">
                    <div className="rrl-toolbar-title">
                      <h2>{getQueueHeading()}</h2>
                    </div>
                  </div>

                  <div className="rrl-toolbar-controls">
                    <div className="rrl-control">
                      <label>Status</label>
                      <select
                        className="rrl-select"
                        value={queueFilter}
                        onChange={(e) => setQueueFilter(e.target.value)}
                      >
                        <option value="active">Active Queue</option>
                        <option value="pending">Pending Review</option>
                        <option value="approved">Awaiting Release</option>
                        <option value="released">Awaiting Receipt</option>
                        <option value="received">Received</option>
                      </select>
                    </div>
                    <div className="rrl-control">
                      <label>Barangay</label>
                      <select
                        className="rrl-select"
                        value={barangayFilter}
                        onChange={(e) => setBarangayFilter(e.target.value)}
                      >
                        <option value="">All barangays</option>
                        {barangayOptions.map((barangay) => (
                          <option key={barangay} value={barangay}>
                            {barangay}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="rrl-queue-list-wrap">
                  <div className="rrl-queue-list">
                    {loadingQueue ? (
                      <div className="rrl-empty-state">Loading request queue...</div>
                    ) : filteredRows.length === 0 ? (
                      <div className="rrl-empty-state">No requests found.</div>
                    ) : (
                      filteredRows.map((row) => {
                        const isActive = selectedRequest?._id === row._id;
                        const submittedAt =
                          row?.submittedAt || row?.createdAt || row?.requestDate || null;
                        const tone = getFlowTone(row);
                        const wasEdited = Boolean(row?.isEditedAfterSubmit);

                        return (
                          <button
                            type="button"
                            key={row._id}
                            className={`rrl-queue-item ${isActive ? 'active' : ''} rrl-queue-${tone}`}
                            onClick={() => handleSelectRequest(row)}
                          >
                            <div className="rrl-queue-top">
                              <div className="rrl-queue-main">
                                <div className="rrl-queue-barangay">
                                  {row.barangayName || '-'}
                                </div>
                                <div className="rrl-queue-disaster">
                                  {row.disaster || '-'}
                                </div>
                                <div className="rrl-queue-requestno-wrap">
                                  <div className="rrl-queue-requestno">
                                  {row.requestNo || '-'}
                                  </div>
                                  {wasEdited ? (
                                    <span className="rrl-edited-badge">
                                      <FaExclamationTriangle />
                                      Edited
                                    </span>
                                  ) : null}
                                </div>
                              </div>
                            </div>

                            <div className="rrl-queue-bottom">
                              <div className="rrl-queue-inline-meta">
                                <span>{row?.rows?.length || 0} center(s)</span>
                                <span>{getRequestIndividuals(row)} people</span>
                                <span>
                                  {Number(
                                    row?.totals?.requestedFoodPacks || 0
                                  ).toLocaleString()} packs
                                </span>
                              </div>

                              <div className="rrl-queue-datetime">
                                <strong>{formatDate(submittedAt)}</strong>
                                <span>{formatTime(submittedAt)}</span>
                              </div>
                            </div>
                          </button>
                        );
                      })
                    )}
                  </div>
                </div>
              </section>
            </div>

            <div className="rrl-board-right">
              {!displayedRequest ? (
                <section className="rrl-card rrl-placeholder-card">
                  <div className="rrl-placeholder-inner">
                    <h2>No selected request</h2>
                  </div>
                </section>
              ) : (
                <section className="rrl-card rrl-details-card rrl-details-card-compact">
                  <div className="rrl-details-head rrl-details-head-compact">
                    <div className="rrl-details-heading">
                      <div className="rrl-details-barangay">
                        {displayedRequest.barangayName || '-'}
                      </div>
                      <div className="rrl-details-disaster">
                        {displayedRequest.disaster || '-'}
                      </div>
                      <div className="rrl-details-requestno">
                        {displayedRequest.requestNo || '-'}
                      </div>
                    </div>

                    <div className={`rrl-status-banner rrl-status-banner-${selectedTone}`}>
                      {formatStatusLabel(displayedRequest.status)}
                    </div>
                  </div>

                  <div className="rrl-meta-strip">
                    <div className="rrl-meta-chip">
                      <span>Request Date</span>
                      <strong>{formatDate(displayedRequest.requestDate)}</strong>
                    </div>
                    <div className="rrl-meta-chip">
                      <span>Submitted</span>
                      <strong>{formatDateTime(selectedSubmittedAt)}</strong>
                    </div>
                    <div className="rrl-meta-chip">
                      <span>People</span>
                      <strong>{selectedIndividuals}</strong>
                    </div>
                    <div className="rrl-meta-chip">
                      <span>Centers</span>
                      <strong>{displayedRequest?.rows?.length || 0}</strong>
                    </div>
                  </div>

                  <div className="rrl-request-focus-layout rrl-request-focus-inline">
                    <div className="rrl-balance-strip rrl-balance-strip-request-only">
                      <div className="rrl-balance-chip rrl-balance-chip-primary rrl-balance-chip-request">
                        <span>Requested</span>
                        <strong>{displayedRequested}</strong>
                      </div>
                    </div>

                    <div className="rrl-support-strip rrl-support-strip-side">
                      <div className="rrl-support-chip">
                        <span>Vulnerable</span>
                        <strong>{selectedVulnerable}</strong>
                      </div>
                    </div>
                  </div>

                  {displayedRequest?.isEditedAfterSubmit ? (
                    <div className="rrl-edited-info-strip">
                      <div className="rrl-edited-info-chip">
                        <span>Edited After Submit</span>
                        <strong>Yes</strong>
                      </div>
                      <div className="rrl-edited-info-chip">
                        <span>Last Edited</span>
                        <strong>{formatDateTime(displayedRequest?.lastEditedAt)}</strong>
                      </div>
                      <div className="rrl-edited-info-chip">
                        <span>Edit Count</span>
                        <strong>{Number(displayedRequest?.editCount || 0)}</strong>
                      </div>
                    </div>
                  ) : null}

                  <div className="rrl-review-layout-focused">
                    <div className="rrl-review-main">
                      <div className="rrl-panel">
                        <div className="rrl-section-head">
                          <h3>Evacuation Rows</h3>
                        </div>

                        <div className="rrl-table-wrapper">
                          <table className="rrl-table rrl-detail-table">
                            <thead>
                              <tr>
                                <th>No.</th>
                                <th>Evacuation Center</th>
                                <th>Households</th>
                                <th>Families</th>
                                <th>Male</th>
                                <th>Female</th>
                                <th>LGBTQ</th>
                                <th>PWD</th>
                                <th>Pregnant</th>
                                <th>Senior</th>
                                <th>Food Packs</th>
                              </tr>
                            </thead>
                            <tbody>
                              {(displayedRequest.rows || []).length === 0 ? (
                                <tr>
                                  <td colSpan="11" className="rrl-empty-cell">
                                    No evacuation rows found.
                                  </td>
                                </tr>
                              ) : (
                                (displayedRequest.rows || []).map((row, index) => (
                                  <tr key={`${row.evacuationCenterName}-${index}`}>
                                    <td>{index + 1}</td>
                                    <td>{row.evacuationCenterName || '-'}</td>
                                    <td>{row.households || 0}</td>
                                    <td>{row.families || 0}</td>
                                    <td>{row.male || 0}</td>
                                    <td>{row.female || 0}</td>
                                    <td>{row.lgbtq || 0}</td>
                                    <td>{row.pwd || 0}</td>
                                    <td>{row.pregnant || 0}</td>
                                    <td>{row.senior || 0}</td>
                                    <td>{row.requestedFoodPacks || 0}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                            <tfoot>
                              <tr>
                                <td colSpan="2" className="rrl-total-label">
                                  Total
                                </td>
                                <td>{displayedRequest?.totals?.households || 0}</td>
                                <td>{displayedRequest?.totals?.families || 0}</td>
                                <td>{displayedRequest?.totals?.male || 0}</td>
                                <td>{displayedRequest?.totals?.female || 0}</td>
                                <td>{displayedRequest?.totals?.lgbtq || 0}</td>
                                <td>{displayedRequest?.totals?.pwd || 0}</td>
                                <td>{displayedRequest?.totals?.pregnant || 0}</td>
                                <td>{displayedRequest?.totals?.senior || 0}</td>
                                <td>{displayedRequest?.totals?.requestedFoodPacks || 0}</td>
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      <div className="rrl-panel rrl-remarks-panel">
                        <div className="rrl-section-head">
                          <h3>Remarks</h3>
                        </div>
                        <div className="rrl-remarks-box">
                          <p>{displayedRequest?.remarks || 'No remarks provided.'}</p>
                        </div>
                      </div>
                    </div>

                    <div className="rrl-review-side">
                      <div className="rrl-panel rrl-decision-panel">
                        <div className="rrl-section-head">
                          <h3>Decision Panel</h3>
                        </div>

                        {loadingDetails ? (
                          <div className="rrl-mini-empty">Loading support data...</div>
                        ) : (
                          <div className="rrl-readiness-compact">
                            <div className="rrl-readiness-compact-row">
                              <span>Stock Units</span>
                              <strong>{totalStockUnits}</strong>
                            </div>
                            <div
                              className={`rrl-readiness-compact-row ${lowStockCount > 0 ? 'warn' : ''}`}
                            >
                              <span>Low Stock</span>
                              <strong>{lowStockCount}</strong>
                            </div>
                          </div>
                        )}

                        <div className="rrl-decision-actions">
                          {canReject ? (
                            <button
                              type="button"
                              className="rrl-btn rrl-btn-danger"
                              disabled={submittingAction}
                              onClick={() => openRejectConfirmation(displayedRequest)}
                            >
                              <FaTimes />
                              Reject
                            </button>
                          ) : (
                            <div className="rrl-btn-slot" />
                          )}

                          {canApprove ? (
                            <button
                              type="button"
                              className="rrl-btn rrl-btn-approve"
                              disabled={submittingAction}
                              onClick={() => openApproveConfirmation(displayedRequest)}
                            >
                              <FaCheck />
                              Approve
                            </button>
                          ) : (
                            <div className="rrl-btn-slot" />
                          )}

                          {canOpenPlanner ? (
                            <button
                              type="button"
                              className="rrl-btn rrl-btn-primary"
                              disabled={submittingAction}
                              onClick={() => openReleasePlanner(displayedRequest)}
                            >
                              <FaClipboardCheck />
                              Open Release Planner
                            </button>
                          ) : canMarkReceived ? (
                            <button
                              type="button"
                              className="rrl-btn rrl-btn-approve"
                              disabled={submittingAction}
                              onClick={() => openReceiveConfirmation(displayedRequest)}
                            >
                              <FaCheck />
                              Mark Received
                            </button>
                          ) : (
                            <div className="rrl-btn-slot" />
                          )}
                        </div>

                        <div className="rrl-pdf-inline">
                          <button
                            type="button"
                            className="rrl-btn rrl-btn-secondary"
                            onClick={() => openPdfInNewTab(getPdfPath(displayedRequest))}
                          >
                            <FaExternalLinkAlt />
                            Open PDF
                          </button>

                          <a
                            className="rrl-btn rrl-btn-secondary"
                            href={
                              getPdfPath(displayedRequest)
                                ? `${BASE_URL}${getPdfPath(displayedRequest)}`
                                : undefined
                            }
                            target="_blank"
                            rel="noreferrer"
                            download
                            onClick={(e) => {
                              if (!getPdfPath(displayedRequest)) {
                                e.preventDefault();
                                pushNotification(
                                  'No PDF file available for this request yet.',
                                  'info'
                                );
                              } else {
                                pushNotification('PDF download started.', 'info');
                              }
                            }}
                          >
                            <FaDownload />
                            Download PDF
                          </a>
                        </div>
                      </div>
                    </div>
                  </div>
                </section>
              )}
            </div>
          </section>
        </div>

        {confirmState.open ? (
          <div className="rrl-modal-backdrop">
            <div className="rrl-modal-card">
              <h3>{confirmState.title}</h3>
              <p>{confirmState.message}</p>

              {confirmState.action === 'reject' ? (
                <div className="rrl-modal-field">
                  <label htmlFor="rrl-reject-reason" className="rrl-modal-label">
                    Rejection Reason
                  </label>
                  <textarea
                    id="rrl-reject-reason"
                    className="rrl-modal-textarea"
                    value={rejectReason}
                    onChange={(e) => setRejectReason(e.target.value)}
                    placeholder="Enter the reason for rejecting this request."
                    rows={4}
                    disabled={submittingAction}
                  />
                </div>
              ) : null}

              <div className="rrl-modal-actions">
                <button
                  type="button"
                  className="rrl-btn rrl-btn-secondary"
                  onClick={closeConfirmation}
                  disabled={submittingAction}
                >
                  <FaUndo />
                  Go Back
                </button>
                <button
                  type="button"
                  className={`rrl-btn ${
                    confirmState.action === 'reject'
                      ? 'rrl-btn-danger'
                      : 'rrl-btn-primary'
                  }`}
                  onClick={handleConfirmAction}
                  disabled={
                    submittingAction ||
                    (confirmState.action === 'reject' && !rejectReason.trim())
                  }
                >
                  {confirmState.action === 'reject' ? <FaTimes /> : <FaCheck />}
                  {submittingAction ? 'Processing...' : 'Confirm'}
                </button>
              </div>
            </div>
          </div>
        ) : null}

        {pdfPreviewUrl ? (
          <div className="rrl-pdf-modal-overlay" onClick={closePdfPreview}>
            <div className="rrl-pdf-modal" onClick={(e) => e.stopPropagation()}>
              <div className="rrl-pdf-modal-header">
                <div>
                  <h3>Relief Request PDF</h3>
                </div>

                <button
                  type="button"
                  className="rrl-btn rrl-btn-secondary"
                  onClick={closePdfPreview}
                >
                  <FaTimes />
                  Close
                </button>
              </div>

              <iframe
                title="Relief Request PDF Preview"
                src={pdfPreviewUrl}
                className="rrl-pdf-frame"
              />
            </div>
          </div>
        ) : null}

        <div className="notification-stack">
          {notifications.map((notification) => (
            <button
              key={notification.id}
              type="button"
              className={`notification-toast ${notification.type}`}
              onClick={() => removeNotification(notification.id)}
            >
              <span className="notification-icon">{getNotificationIcon(notification.type)}</span>
              <span className="notification-text">{notification.message}</span>
            </button>
          ))}
        </div>
      </div>
    </DashboardShell>
  );
}

