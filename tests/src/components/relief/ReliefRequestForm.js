import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as XLSX from 'xlsx';
import {
  FaCheck,
  FaExclamationTriangle,
  FaFileImport,
  FaFilePdf,
  FaPen,
  FaPlus,
  FaRedo,
  FaTimes
} from 'react-icons/fa';
import DashboardShell from '../layout/DashboardShell';
import '../css/ReliefRequestForm.css';

const BASE_URL =
  process.env.REACT_APP_API_URL || 'https://gaganadapat.onrender.com';

const numberFields = [
  'households',
  'families',
  'male',
  'female',
  'lgbtq',
  'pwd',
  'pregnant',
  'senior',
  'requestedFoodPacks'
];

const STAGE_STEPS = [
  { key: 'prepare', label: 'Prepare' },
  { key: 'review', label: 'For Review' },
  { key: 'approved', label: 'Approved' },
  { key: 'to_receive', label: 'Receive Goods' },
  { key: 'received', label: 'Received' }
];

const IMPORT_HEADER_ALIASES = {
  evacuationCenterName: [
    'evacuationcentername',
    'evacuation center name',
    'evacuation center',
    'evacuationcenter',
    'centername',
    'center name',
    'evacuation site',
    'evacuationsite',
    'evac name',
    'name'
  ],
  households: ['households', 'household'],
  families: ['families', 'family'],
  male: ['male', 'males'],
  female: ['female', 'females'],
  lgbtq: ['lgbtq', 'lgbt', 'lgbtqia', 'lgbtqia+'],
  pwd: ['pwd', 'pwds', 'personswithdisability', 'personwithdisability'],
  pregnant: ['pregnant', 'pregnantwomen', 'pregnant woman', 'pregnant women'],
  senior: ['senior', 'seniors', 'seniorcitizen', 'senior citizen', 'seniorcitizens'],
  requestedFoodPacks: [
    'requestedfoodpacks',
    'requested food packs',
    'foodpacks',
    'food packs',
    'requestedpacks',
    'packsrequested',
    'packs'
  ],
  rowRemarks: ['rowremarks', 'row remarks', 'remarks', 'notes', 'comment', 'comments']
};

const createPreparedRow = (row = {}) => ({
  evacPlaceId: row.evacPlaceId || row._id || '',
  evacuationCenterName: String(row.evacuationCenterName || row.name || '').trim(),
  households: Number(row.households || 0),
  families: Number(row.families || 0),
  male: Number(row.male || 0),
  female: Number(row.female || 0),
  lgbtq: Number(row.lgbtq || 0),
  pwd: Number(row.pwd || 0),
  pregnant: Number(row.pregnant || 0),
  senior: Number(row.senior || 0),
  requestedFoodPacks: Number(row.requestedFoodPacks || 0),
  isActiveRow: row.isActiveRow !== undefined ? Boolean(row.isActiveRow) : true,
  rowRemarks: String(row.rowRemarks || '').trim()
});

const buildRowsFromRequest = (request) => {
  const sourceRows = Array.isArray(request?.rows) ? request.rows : [];
  return sourceRows.map((row) => createPreparedRow(row));
};

const buildRowsFromEvacs = (evacs = []) =>
  evacs.map((place) =>
    createPreparedRow({
      evacPlaceId: place._id,
      evacuationCenterName: place.name,
      households: 0,
      families: 0,
      male: 0,
      female: 0,
      lgbtq: 0,
      pwd: 0,
      pregnant: 0,
      senior: 0,
      requestedFoodPacks: 0,
      isActiveRow: true,
      rowRemarks: ''
    })
  );

const formatDate = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleDateString();
  } catch {
    return '-';
  }
};

const formatDateTime = (value) => {
  if (!value) return '-';
  try {
    return new Date(value).toLocaleString();
  } catch {
    return '-';
  }
};

const normalizeStage = (stage) => String(stage || '').toLowerCase();

const normalizeValue = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const normalizeStatus = (value) =>
  String(value || '')
    .trim()
    .toLowerCase();

const isCancelledStatus = (value) => {
  const normalized = normalizeStatus(value);
  return normalized === 'cancelled' || normalized === 'canceled';
};

const getStageMeta = (stage) => {
  switch (normalizeStage(stage)) {
    case 'pending_review':
      return { label: 'For Review', tone: 'pending', activeStep: 2, completedSteps: 1 };
    case 'approved_waiting_release':
      return { label: 'Approved', tone: 'approved', activeStep: 3, completedSteps: 2 };
    case 'partially_released':
      return { label: 'Receive Goods', tone: 'released', activeStep: 4, completedSteps: 3 };
    case 'released_waiting_receipt':
      return { label: 'Receive Goods', tone: 'released', activeStep: 4, completedSteps: 3 };
    case 'completed':
      return { label: 'Received', tone: 'completed', activeStep: 5, completedSteps: 4 };
    case 'rejected':
      return { label: 'Rejected', tone: 'rejected', activeStep: 2, completedSteps: 1 };
    case 'cancelled':
    case 'canceled':
    case 'preparation':
    default:
      return { label: 'Prepare', tone: 'draft', activeStep: 1, completedSteps: 0 };
  }
};

const parseSafeNumber = (value) => {
  if (value === null || value === undefined || value === '') return 0;
  const parsed = Number(value);
  return Number.isNaN(parsed) ? 0 : Math.max(0, parsed);
};

const normalizeHeader = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .replace(/[^a-z0-9 ]/g, '');

const resolveHeaderKey = (rawHeader) => {
  const normalized = normalizeHeader(rawHeader);
  const entries = Object.entries(IMPORT_HEADER_ALIASES);

  for (const [field, aliases] of entries) {
    if (aliases.includes(normalized)) return field;
  }

  return '';
};

const buildImportSummaryText = (summary) => {
  if (!summary) return '';
  return `${summary.totalRows} row${summary.totalRows === 1 ? '' : 's'} imported - ${summary.matchedRows} matched - ${summary.unmatchedRows} unmatched`;
};

const serializeRowsForCompare = (rows = []) =>
  rows.map((row) => ({
    evacPlaceId: row.evacPlaceId || '',
    evacuationCenterName: String(row.evacuationCenterName || '').trim(),
    households: Number(row.households || 0),
    families: Number(row.families || 0),
    male: Number(row.male || 0),
    female: Number(row.female || 0),
    lgbtq: Number(row.lgbtq || 0),
    pwd: Number(row.pwd || 0),
    pregnant: Number(row.pregnant || 0),
    senior: Number(row.senior || 0),
    requestedFoodPacks: Number(row.requestedFoodPacks || 0),
    isActiveRow: Boolean(row.isActiveRow),
    rowRemarks: String(row.rowRemarks || '').trim()
  }));

export default function ReliefRequestForm() {
  const navigate = useNavigate();
  const location = useLocation();
  const fileInputRef = useRef(null);

  const editMode = location.state?.mode === 'edit';
  const editingRequest = location.state?.request || null;

  const [loadingPage, setLoadingPage] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submittingAction, setSubmittingAction] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);

  const [barangayName, setBarangayName] = useState('');
  const [requestId, setRequestId] = useState('');
  const [requestNo, setRequestNo] = useState('Auto-generated');
  const [disaster, setDisaster] = useState('');
  const [requestDate, setRequestDate] = useState(
    new Date().toISOString().slice(0, 10)
  );
  const [remarks, setRemarks] = useState('');
  const [rows, setRows] = useState([]);
  const [bootstrapRows, setBootstrapRows] = useState([]);

  const [journey, setJourney] = useState({
    request: null,
    releases: [],
    stage: 'preparation',
    canEdit: false,
    canCancel: false,
    canReceiveAnyRelease: false,
    canRequestAgain: false,
    summary: null
  });

  const [pageError, setPageError] = useState('');
  const [showEditor, setShowEditor] = useState(false);

  const [formFeedback, setFormFeedback] = useState({
    type: '',
    message: ''
  });

  const [confirmState, setConfirmState] = useState({
    open: false,
    title: '',
    message: '',
    action: ''
  });

  const [importingFile, setImportingFile] = useState(false);
  const [importInfo, setImportInfo] = useState({
    hasImported: false,
    fileName: '',
    summary: null,
    issues: [],
    source: 'manual'
  });

  const fetchLatestBootstrapRows = useCallback(async () => {
    const res = await fetch(`${BASE_URL}/api/relief-requests/bootstrap`, {
      credentials: 'include'
    });

    const data = res.ok ? await res.json() : null;

    if (!res.ok || !data) {
      throw new Error('Failed to refresh evacuation center rows.');
    }

    const freshRows = Array.isArray(data.rows)
      ? data.rows.map((row) => createPreparedRow(row))
      : [];

    setBootstrapRows(freshRows);
    return freshRows;
  }, []);

  const loadJourneyData = useCallback(
    async ({ silent = false } = {}) => {
      try {
        if (!silent) {
          setLoadingPage(true);
          setPageError('');
        }

        const sessionRes = await fetch(`${BASE_URL}/api/debug-session`, {
          credentials: 'include'
        });

        if (!sessionRes.ok) {
          navigate('/');
          return;
        }

        const sessionData = await sessionRes.json();
        const role = String(sessionData?.role || '').toLowerCase();

        if (role !== 'barangay') {
          navigate('/');
          return;
        }

        const barangayRes = await fetch(`${BASE_URL}/api/barangays/me`, {
          credentials: 'include'
        });

        const barangayData = barangayRes.ok ? await barangayRes.json() : null;

        if (!barangayRes.ok || !barangayData) {
          throw new Error('Failed to load barangay information.');
        }

        setBarangayName(barangayData.barangayName || barangayData.name || '');

        const [bootstrapRes, journeyRes, evacsRes] = await Promise.all([
          fetch(`${BASE_URL}/api/relief-requests/bootstrap`, {
            credentials: 'include'
          }),
          fetch(`${BASE_URL}/api/relief-requests/journey/current`, {
            credentials: 'include'
          }),
          fetch(`${BASE_URL}/evacs`, {
            credentials: 'include'
          })
        ]);

        const bootstrapData = bootstrapRes.ok ? await bootstrapRes.json() : null;
        const journeyData = journeyRes.ok ? await journeyRes.json() : null;
        const evacsData = evacsRes.ok ? await evacsRes.json() : [];

        if (!journeyRes.ok || !journeyData) {
          throw new Error('Failed to load request status.');
        }

        const bootstrapPrepared = Array.isArray(bootstrapData?.rows)
          ? bootstrapData.rows.map((row) => createPreparedRow(row))
          : [];

        const fallbackEvacs = Array.isArray(evacsData)
          ? evacsData
              .filter((place) => {
                const placeBarangayId = String(place.barangayId || '');
                const currentBarangayId = String(barangayData._id || '');
                const isVisible =
                  place.isRequestVisible === undefined
                    ? true
                    : Boolean(place.isRequestVisible);

                return (
                  !place.isArchived &&
                  isVisible &&
                  (!placeBarangayId ||
                    !currentBarangayId ||
                    placeBarangayId === currentBarangayId)
                );
              })
              .map((place) => ({
                _id: place._id,
                name: place.name
              }))
          : [];

        const resolvedBootstrapRows =
          bootstrapPrepared.length > 0
            ? bootstrapPrepared
            : buildRowsFromEvacs(fallbackEvacs);

        const sanitizedJourney = {
          request: journeyData.request || null,
          releases: Array.isArray(journeyData.releases) ? journeyData.releases : [],
          stage: journeyData.stage || 'preparation',
          canEdit: Boolean(journeyData.canEdit),
          canCancel: Boolean(journeyData.canCancel),
          canReceiveAnyRelease: Boolean(journeyData.canReceiveAnyRelease),
          canRequestAgain: Boolean(journeyData.canRequestAgain),
          summary: journeyData.summary || null
        };

        setBootstrapRows(resolvedBootstrapRows);
        setJourney(sanitizedJourney);
        setSessionChecked(true);

        if (editMode && editingRequest) {
          setRequestId(editingRequest._id || '');
          setRequestNo(editingRequest.requestNo || 'Auto-generated');
          setDisaster(editingRequest.disaster || '');
          setRequestDate(
            editingRequest.requestDate
              ? new Date(editingRequest.requestDate).toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10)
          );
          setRemarks(editingRequest.remarks || '');
          setRows(buildRowsFromRequest(editingRequest));
          setShowEditor(true);
          setImportInfo({
            hasImported: editingRequest.entryMode === 'excel_import',
            fileName: '',
            summary: null,
            issues: [],
            source: editingRequest.entryMode === 'excel_import' ? 'excel_import' : 'manual'
          });
          return;
        }

        const journeyRequestStatus = normalizeStatus(sanitizedJourney.request?.status);
        const journeyStageStatus = normalizeStatus(sanitizedJourney.stage);
        const canRestoreExistingRequest =
          sanitizedJourney.canEdit ||
          journeyRequestStatus === 'rejected' ||
          journeyStageStatus === 'rejected';

        if (sanitizedJourney.request && canRestoreExistingRequest) {
          setRequestId(sanitizedJourney.request._id || '');
          setRequestNo(sanitizedJourney.request.requestNo || 'Auto-generated');
          setDisaster(sanitizedJourney.request.disaster || '');
          setRequestDate(
            sanitizedJourney.request.requestDate
              ? new Date(sanitizedJourney.request.requestDate).toISOString().slice(0, 10)
              : new Date().toISOString().slice(0, 10)
          );
          setRemarks(sanitizedJourney.request.remarks || '');
          setRows(buildRowsFromRequest(sanitizedJourney.request));
          setShowEditor(false);
          setImportInfo({
            hasImported: sanitizedJourney.request.entryMode === 'excel_import',
            fileName: '',
            summary: null,
            issues: [],
            source:
              sanitizedJourney.request.entryMode === 'excel_import' ? 'excel_import' : 'manual'
          });
          return;
        }

        setRequestId('');
        setRequestNo('Auto-generated');
        setDisaster('');
        setRequestDate(new Date().toISOString().slice(0, 10));
        setRemarks('');
        setRows(resolvedBootstrapRows);
        setShowEditor(false);
        setImportInfo({
          hasImported: false,
          fileName: '',
          summary: null,
          issues: [],
          source: 'manual'
        });
      } catch (err) {
        console.error(err);
        setPageError(err.message || 'Failed to load request page.');
        setSessionChecked(true);
      } finally {
        setLoadingPage(false);
      }
    },
    [editMode, editingRequest, navigate]
  );

  useEffect(() => {
    loadJourneyData();
  }, [loadJourneyData]);

  useEffect(() => {
    if (showEditor || editMode || !sessionChecked || loadingPage) {
      return undefined;
    }

    const intervalId = setInterval(() => {
      loadJourneyData({ silent: true });
    }, 12000);

    return () => clearInterval(intervalId);
  }, [showEditor, editMode, sessionChecked, loadingPage, loadJourneyData]);

  useEffect(() => {
    const canStayInEditor =
      journey.canEdit ||
      normalizeStatus(journey.request?.status) === 'rejected' ||
      normalizeStatus(journey.stage) === 'rejected';

    if (!canStayInEditor && !editMode) {
      setShowEditor(false);
    }
  }, [journey.canEdit, journey.request?.status, journey.stage, editMode]);

  const latestRequest = useMemo(() => {
    if (!journey.request) return null;
    if (isCancelledStatus(journey.request?.status)) return null;
    return journey.request;
  }, [journey.request]);

  const stageMeta = useMemo(() => {
    if (editMode || showEditor) return getStageMeta('preparation');
    if (!latestRequest) return getStageMeta('preparation');
    return getStageMeta(journey.stage);
  }, [editMode, showEditor, latestRequest, journey.stage]);

  const preparedRows = useMemo(() => rows.map((row) => createPreparedRow(row)), [rows]);

  const activeRows = useMemo(
    () => preparedRows.filter((row) => row.isActiveRow),
    [preparedRows]
  );

  const requestRowsForDisplay = useMemo(() => {
    return Array.isArray(latestRequest?.rows)
      ? latestRequest.rows.map((row) => createPreparedRow(row))
      : [];
  }, [latestRequest?.rows]);

  const activeRequestRowsForDisplay = useMemo(() => {
    return requestRowsForDisplay.filter((row) => row.isActiveRow);
  }, [requestRowsForDisplay]);

  const displayRequestedPacks = useMemo(() => {
    const rowTotal = activeRequestRowsForDisplay.reduce(
      (sum, row) => sum + Number(row.requestedFoodPacks || 0),
      0
    );

    return Number(
      latestRequest?.totalRequestedFoodPacks ||
        latestRequest?.requestedFoodPacks ||
        latestRequest?.requestedPacks ||
        latestRequest?.totals?.requestedFoodPacks ||
        latestRequest?.summary?.requestedFoodPacks ||
        journey.summary?.requestedFoodPacks ||
        journey.summary?.totalRequestedFoodPacks ||
        rowTotal ||
        0
    );
  }, [activeRequestRowsForDisplay, latestRequest, journey.summary]);

  const displayTotalAffected = useMemo(() => {
    const rowTotal = activeRequestRowsForDisplay.reduce(
      (sum, row) =>
        sum +
        Number(row.male || 0) +
        Number(row.female || 0) +
        Number(row.lgbtq || 0) +
        Number(row.pwd || 0) +
        Number(row.pregnant || 0) +
        Number(row.senior || 0),
      0
    );

    return Number(
      latestRequest?.totalAffected ||
        latestRequest?.totalIndividuals ||
        latestRequest?.totals?.totalAffected ||
        latestRequest?.totals?.individuals ||
        latestRequest?.summary?.totalAffected ||
        journey.summary?.totalAffected ||
        journey.summary?.totalIndividuals ||
        rowTotal ||
        0
    );
  }, [activeRequestRowsForDisplay, latestRequest, journey.summary]);

  const displayVulnerableCount = useMemo(() => {
    const rowTotal = activeRequestRowsForDisplay.reduce(
      (sum, row) =>
        sum +
        Number(row.pwd || 0) +
        Number(row.pregnant || 0) +
        Number(row.senior || 0),
      0
    );

    return Number(
      latestRequest?.vulnerableCount ||
        latestRequest?.totalVulnerable ||
        latestRequest?.totals?.vulnerableCount ||
        latestRequest?.totals?.totalVulnerable ||
        latestRequest?.summary?.vulnerableCount ||
        journey.summary?.vulnerableCount ||
        journey.summary?.totalVulnerable ||
        rowTotal ||
        0
    );
  }, [activeRequestRowsForDisplay, latestRequest, journey.summary]);

  const evacNameMap = useMemo(() => {
    const map = new Map();

    bootstrapRows.forEach((row) => {
      const normalizedName = normalizeValue(row.evacuationCenterName);
      if (normalizedName) {
        map.set(normalizedName, createPreparedRow(row));
      }
    });

    return map;
  }, [bootstrapRows]);

  const totals = useMemo(() => {
    return activeRows.reduce(
      (acc, row) => {
        acc.households += Number(row.households || 0);
        acc.families += Number(row.families || 0);
        acc.male += Number(row.male || 0);
        acc.female += Number(row.female || 0);
        acc.lgbtq += Number(row.lgbtq || 0);
        acc.pwd += Number(row.pwd || 0);
        acc.pregnant += Number(row.pregnant || 0);
        acc.senior += Number(row.senior || 0);
        acc.requestedFoodPacks += Number(row.requestedFoodPacks || 0);
        return acc;
      },
      {
        households: 0,
        families: 0,
        male: 0,
        female: 0,
        lgbtq: 0,
        pwd: 0,
        pregnant: 0,
        senior: 0,
        requestedFoodPacks: 0
      }
    );
  }, [activeRows]);

  const totalIndividuals = useMemo(() => {
    return (
      totals.male +
      totals.female +
      totals.lgbtq +
      totals.pwd +
      totals.pregnant +
      totals.senior
    );
  }, [totals]);

  const vulnerableCount = useMemo(
    () => totals.pwd + totals.pregnant + totals.senior,
    [totals]
  );

  const hasInvalidRows = useMemo(() => {
    if (!preparedRows.length) return true;

    const enabledRows = preparedRows.filter((row) => row.isActiveRow);
    if (!enabledRows.length) return true;

    return enabledRows.some((row) => {
      if (!String(row.evacuationCenterName || '').trim()) return true;

      return numberFields.some((field) => {
        const value = Number(row[field]);
        return Number.isNaN(value) || value < 0;
      });
    });
  }, [preparedRows]);

  const baselineSource = useMemo(() => {
    if (editMode && editingRequest) {
      return {
        disaster: editingRequest.disaster || '',
        requestDate: editingRequest.requestDate
          ? new Date(editingRequest.requestDate).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        remarks: editingRequest.remarks || '',
        rows: buildRowsFromRequest(editingRequest)
      };
    }

    if (
      journey.request &&
      (journey.canEdit ||
        normalizeStatus(journey.request?.status) === 'rejected' ||
        normalizeStatus(journey.stage) === 'rejected')
    ) {
      return {
        disaster: journey.request.disaster || '',
        requestDate: journey.request.requestDate
          ? new Date(journey.request.requestDate).toISOString().slice(0, 10)
          : new Date().toISOString().slice(0, 10),
        remarks: journey.request.remarks || '',
        rows: buildRowsFromRequest(journey.request)
      };
    }

    return {
      disaster: '',
      requestDate: new Date().toISOString().slice(0, 10),
      remarks: '',
      rows: bootstrapRows.map((row) => createPreparedRow(row))
    };
  }, [
    editMode,
    editingRequest,
    journey.request,
    journey.canEdit,
    journey.stage,
    bootstrapRows
  ]);

  const isDirty = useMemo(() => {
    const current = JSON.stringify({
      disaster: disaster.trim(),
      requestDate,
      remarks: remarks.trim(),
      rows: serializeRowsForCompare(preparedRows)
    });

    const baseline = JSON.stringify({
      disaster: String(baselineSource.disaster || '').trim(),
      requestDate: baselineSource.requestDate,
      remarks: String(baselineSource.remarks || '').trim(),
      rows: serializeRowsForCompare(baselineSource.rows || [])
    });

    return current !== baseline;
  }, [disaster, requestDate, remarks, preparedRows, baselineSource]);

  const isEditingExisting = Boolean(editMode || requestId);
  const isSubmitDisabled =
    submitting ||
    loadingPage ||
    !barangayName.trim() ||
    !disaster.trim() ||
    !requestDate ||
    !preparedRows.length ||
    hasInvalidRows ||
    (isEditingExisting && !isDirty);

  const requestStatusLabel = useMemo(() => {
    const normalizedStage = normalizeStatus(journey?.stage);
    const normalizedRequestStatus = normalizeStatus(latestRequest?.status);

    if (
      normalizedStage === 'pending_review' ||
      normalizedRequestStatus === 'pending' ||
      normalizedRequestStatus === 'pending_review'
    ) {
      return 'For Review';
    }

    if (
      normalizedStage === 'approved_waiting_release' ||
      normalizedRequestStatus === 'approved'
    ) {
      return 'Approved';
    }

    if (
      normalizedStage === 'released_waiting_receipt' ||
      normalizedStage === 'partially_released'
    ) {
      return 'Receive Goods';
    }

    if (
      normalizedStage === 'completed' ||
      normalizedRequestStatus === 'received' ||
      normalizedRequestStatus === 'completed'
    ) {
      return 'Received';
    }

    if (normalizedStage === 'rejected' || normalizedRequestStatus === 'rejected') {
      return 'Rejected';
    }

    if (
      normalizedStage === 'cancelled' ||
      normalizedStage === 'canceled' ||
      normalizedRequestStatus === 'cancelled' ||
      normalizedRequestStatus === 'canceled'
    ) {
      return 'Prepare';
    }

    return stageMeta.label || 'Prepare';
  }, [journey?.stage, latestRequest?.status, stageMeta.label]);

  const receiptMeta = useMemo(() => {
    const receivedAt = journey.summary?.receivedAt || latestRequest?.receivedAt;
    const releasedPacks = Number(journey.summary?.releasedFoodPacks || 0);
    const receivedPacks = Number(journey.summary?.receivedFoodPacks || 0);
    const normalizedStage = normalizeStatus(journey?.stage);

    if (receivedAt) {
      return {
        label: 'Received Date',
        value: formatDateTime(receivedAt),
        tone: 'completed'
      };
    }

    if (
      normalizedStage === 'released_waiting_receipt' ||
      normalizedStage === 'partially_released' ||
      releasedPacks > receivedPacks
    ) {
      return {
        label: 'Receipt',
        value: 'Awaiting confirmation',
        tone: 'released'
      };
    }

    if (normalizedStage === 'rejected') {
      return {
        label: 'Receipt',
        value: 'Request was rejected',
        tone: 'rejected'
      };
    }

    return {
      label: 'Receipt',
      value: 'Not yet released',
      tone: 'draft'
    };
  }, [
    journey?.stage,
    journey.summary?.receivedAt,
    journey.summary?.releasedFoodPacks,
    journey.summary?.receivedFoodPacks,
    latestRequest?.receivedAt
  ]);

  const canShowRequestAgainButton = useMemo(() => {
    if (journey.canRequestAgain) return true;
    if (!latestRequest) return true;

    const normalizedStatus = normalizeStatus(latestRequest?.status);
    const normalizedStage = normalizeStatus(journey?.stage);

    return (
      ['completed', 'received', 'rejected', 'cancelled', 'canceled'].includes(
        normalizedStatus
      ) ||
      ['completed', 'received', 'rejected', 'cancelled', 'canceled'].includes(
        normalizedStage
      )
    );
  }, [journey.canRequestAgain, journey.stage, latestRequest]);

  const decisionRemarks = useMemo(() => {
    return (
      String(journey.summary?.decisionRemarks || '').trim() ||
      String(journey.summary?.rejectionRemarks || '').trim() ||
      String(latestRequest?.rejectionReason || '').trim() ||
      String(latestRequest?.rejectionRemarks || '').trim() ||
      String(latestRequest?.decisionRemarks || '').trim() ||
      String(latestRequest?.approvalRemarks || '').trim() ||
      String(latestRequest?.reviewRemarks || '').trim()
    );
  }, [journey.summary, latestRequest]);

  const isRejectedJourney = useMemo(() => {
    return (
      normalizeStatus(journey?.stage) === 'rejected' ||
      normalizeStatus(latestRequest?.status) === 'rejected' ||
      Boolean(journey.summary?.isRejected)
    );
  }, [journey?.stage, latestRequest?.status, journey.summary?.isRejected]);

  const releaseRecords = useMemo(() => {
    const raw = [
      ...(Array.isArray(journey.releases) ? journey.releases : []),
      ...(Array.isArray(latestRequest?.releases) ? latestRequest.releases : []),
      ...(Array.isArray(latestRequest?.reliefReleases) ? latestRequest.reliefReleases : []),
      ...(Array.isArray(latestRequest?.releaseHistory) ? latestRequest.releaseHistory : []),
      ...(latestRequest?.release ? [latestRequest.release] : [])
    ].filter(Boolean);

    const seen = new Set();

    return raw.filter((entry) => {
      const key =
        entry?._id ||
        entry?.id ||
        entry?.releaseNo ||
        `${entry?.createdAt || ''}-${entry?.updatedAt || ''}`;

      if (!key) return true;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }, [journey.releases, latestRequest]);

  const receivedReleaseRecords = useMemo(() => {
    return releaseRecords.filter((release) => {
      const status = normalizeStatus(
        release?.status ||
          release?.releaseStatus ||
          release?.receiveStatus ||
          release?.receiptStatus ||
          release?.acknowledgementStatus
      );

      return (
        Boolean(
          release?.receivedAt ||
            release?.dateReceived ||
            release?.acknowledgedAt ||
            release?.receiptDate
        ) ||
        status === 'received' ||
        status === 'completed'
      );
    });
  }, [releaseRecords]);

  const receivedItems = useMemo(() => {
    const sourceRecords =
      receivedReleaseRecords.length > 0
        ? receivedReleaseRecords
        : normalizeStatus(journey?.stage) === 'completed'
          ? releaseRecords
          : [];

    return sourceRecords.flatMap((release) => {
      const releaseDate =
        release?.receivedAt ||
        release?.dateReceived ||
        release?.acknowledgedAt ||
        release?.receiptDate ||
        release?.updatedAt ||
        release?.createdAt ||
        null;

      const releaseLabel = release?.releaseNo || release?.referenceNo || release?._id || '-';

      return (Array.isArray(release?.items) ? release.items : []).map((item, index) => {
        const quantity =
          item?.quantityReceived ??
          item?.quantityReleased ??
          item?.quantity ??
          item?.packsReceived ??
          item?.packsReleased ??
          0;

        const amount =
          item?.amountReceived ??
          item?.amountReleased ??
          item?.amount ??
          0;

        return {
          key: `${releaseLabel}-${item?._id || item?.inventoryItemId || item?.itemName || index}`,
          itemName: item?.itemName || item?.name || 'Unnamed item',
          category: item?.category || '-',
          unit: item?.unit || (amount ? 'PHP' : '-'),
          quantity: Number(quantity || 0),
          amount: Number(amount || 0),
          remarks: item?.remarks || release?.remarks || '-',
          releaseLabel,
          releaseDate
        };
      });
    });
  }, [receivedReleaseRecords, releaseRecords, journey?.stage]);

  const receivedSummary = useMemo(() => {
    const sourceRecords =
      receivedReleaseRecords.length > 0
        ? receivedReleaseRecords
        : normalizeStatus(journey?.stage) === 'completed'
          ? releaseRecords
          : [];

    const latestReceivedAt = sourceRecords.reduce((latest, release) => {
      const value =
        release?.receivedAt ||
        release?.dateReceived ||
        release?.acknowledgedAt ||
        release?.receiptDate ||
        null;

      if (!value) return latest;
      if (!latest) return value;

      return new Date(value).getTime() > new Date(latest).getTime() ? value : latest;
    }, null);

    const totalFoodPacks = sourceRecords.reduce((sum, release) => {
      const packs =
        release?.packsReceived ??
        release?.receivedFoodPacks ??
        release?.foodPacksReceived ??
        release?.packsReleased ??
        release?.releasedFoodPacks ??
        release?.foodPacksReleased ??
        0;

      return sum + Number(packs || 0);
    }, 0);

    const totalQuantity = receivedItems.reduce(
      (sum, item) => sum + Number(item.quantity || 0),
      0
    );

    const totalAmount = receivedItems.reduce(
      (sum, item) => sum + Number(item.amount || 0),
      0
    );

    return {
      releaseCount: sourceRecords.length,
      latestReceivedAt,
      totalFoodPacks,
      itemLines: receivedItems.length,
      totalQuantity,
      totalAmount
    };
  }, [receivedReleaseRecords, releaseRecords, receivedItems, journey?.stage]);

  const displayReceivedPacks = useMemo(() => {
    return Number(
      journey.summary?.receivedFoodPacks ||
        receivedSummary.totalFoodPacks ||
        0
    );
  }, [journey.summary?.receivedFoodPacks, receivedSummary.totalFoodPacks]);

  const displayPendingReceipt = useMemo(() => {
    return Math.max(
      0,
      Number(journey.summary?.releasedFoodPacks || displayReceivedPacks || 0) -
        Number(displayReceivedPacks || 0)
    );
  }, [journey.summary?.releasedFoodPacks, displayReceivedPacks]);

  const hasReceivedData = useMemo(() => {
    return (
      receivedSummary.releaseCount > 0 ||
      receivedItems.length > 0 ||
      Number(journey.summary?.receivedFoodPacks || 0) > 0 ||
      normalizeStatus(journey?.stage) === 'completed'
    );
  }, [receivedSummary, receivedItems, journey.summary?.receivedFoodPacks, journey?.stage]);

  const shouldShowReceivedSection = useMemo(() => {
    const normalizedStage = normalizeStatus(journey?.stage);
    const normalizedStatus = normalizeStatus(latestRequest?.status);

    return (
      normalizedStage === 'released_waiting_receipt' ||
      normalizedStage === 'partially_released' ||
      normalizedStage === 'completed' ||
      normalizedStatus === 'received' ||
      normalizedStatus === 'completed'
    );
  }, [journey?.stage, latestRequest?.status]);

  const isReceiptConfirmed = useMemo(() => {
    const normalizedStage = normalizeStatus(journey?.stage);
    const normalizedStatus = normalizeStatus(latestRequest?.status);

    return (
      normalizedStage === 'completed' ||
      normalizedStatus === 'received' ||
      normalizedStatus === 'completed' ||
      Boolean(journey.summary?.receivedAt || latestRequest?.receivedAt)
    );
  }, [
    journey?.stage,
    journey.summary?.receivedAt,
    latestRequest?.status,
    latestRequest?.receivedAt
  ]);

  const clearFeedback = () => {
    setFormFeedback({ type: '', message: '' });
  };

  const setSuccessFeedback = (message) => {
    setFormFeedback({ type: 'success', message });
  };

  const setErrorFeedback = (message) => {
    setFormFeedback({ type: 'error', message });
  };

  const openConfirmation = ({ title, message, action }) => {
    setConfirmState({
      open: true,
      title,
      message,
      action
    });
  };

  const closeConfirmation = () => {
    setConfirmState({
      open: false,
      title: '',
      message: '',
      action: ''
    });
  };

  const handleRowNumberChange = (index, field, value) => {
    const sanitized =
      value === '' ? '' : Math.max(0, Number.isNaN(Number(value)) ? 0 : Number(value));

    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, [field]: sanitized } : row))
    );
  };

  const handleRowRemarksChange = (index, value) => {
    setRows((prev) =>
      prev.map((row, i) => (i === index ? { ...row, rowRemarks: value } : row))
    );
  };

  const handleToggleRow = (index) => {
    setRows((prev) =>
      prev.map((row, i) => {
        if (i !== index) return row;

        const nextState = !row.isActiveRow;

        if (!nextState) {
          return {
            ...row,
            isActiveRow: false,
            households: 0,
            families: 0,
            male: 0,
            female: 0,
            lgbtq: 0,
            pwd: 0,
            pregnant: 0,
            senior: 0,
            requestedFoodPacks: 0,
            rowRemarks: ''
          };
        }

        return {
          ...row,
          isActiveRow: true
        };
      })
    );
  };

  const resetImportState = () => {
    setImportInfo({
      hasImported: false,
      fileName: '',
      summary: null,
      issues: [],
      source: 'manual'
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleResetForm = () => {
    clearFeedback();
    setDisaster(baselineSource.disaster || '');
    setRequestDate(baselineSource.requestDate);
    setRemarks(baselineSource.remarks || '');
    setRows((baselineSource.rows || []).map((row) => createPreparedRow(row)));
    resetImportState();
  };

  const buildPayload = () => ({
    disaster: disaster.trim(),
    requestDate,
    remarks: remarks.trim(),
    rows: preparedRows.map((row) => ({
      evacPlaceId: row.evacPlaceId || null,
      evacuationCenterName: row.evacuationCenterName.trim(),
      households: Number(row.households || 0),
      families: Number(row.families || 0),
      male: Number(row.male || 0),
      female: Number(row.female || 0),
      lgbtq: Number(row.lgbtq || 0),
      pwd: Number(row.pwd || 0),
      pregnant: Number(row.pregnant || 0),
      senior: Number(row.senior || 0),
      requestedFoodPacks: Number(row.requestedFoodPacks || 0),
      isActiveRow: Boolean(row.isActiveRow),
      rowRemarks: String(row.rowRemarks || '').trim()
    })),
    entryMode: importInfo.source === 'excel_import' ? 'excel_import' : 'manual',
    rowSource:
      importInfo.source === 'excel_import' ? 'manual_override' : 'evac_place_snapshot',
    resubmitRejected: isRejectedJourney
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    clearFeedback();

    if (isSubmitDisabled) {
      if (isEditingExisting && !isDirty) {
        setErrorFeedback('No changes to save.');
        return;
      }
      setErrorFeedback('Please complete the request before saving.');
      return;
    }

    try {
      setSubmitting(true);

      const endpoint =
        isEditingExisting
          ? `${BASE_URL}/api/relief-requests/${requestId}`
          : `${BASE_URL}/api/relief-requests`;

      const method = isEditingExisting ? 'PUT' : 'POST';

      const res = await fetch(endpoint, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(buildPayload())
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data?.message || 'Failed to save relief request.');
      }

      setSuccessFeedback(
        data?.message ||
          (method === 'POST'
            ? 'Relief request submitted successfully.'
            : 'Relief request updated successfully.')
      );

      if (data?.request?._id) {
        setRequestId(data.request._id);
      }

      await loadJourneyData({ silent: true });
      setShowEditor(false);
    } catch (err) {
      console.error(err);
      setErrorFeedback(err.message || 'Failed to save relief request.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmAction = async () => {
    if (!confirmState.action) return;

    try {
      setSubmittingAction(true);
      clearFeedback();

      if (confirmState.action === 'cancel') {
        const res = await fetch(`${BASE_URL}/api/relief-requests/${latestRequest?._id}/cancel`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({
            remarks: remarks.trim()
          })
        });

        const contentType = res.headers.get('content-type') || '';
        const rawText = await res.text();

        let data = {};
        if (contentType.includes('application/json')) {
          try {
            data = JSON.parse(rawText);
          } catch {
            data = {};
          }
        }

        if (!res.ok) {
          throw new Error(
            data?.message ||
              (rawText.startsWith('<!DOCTYPE') || rawText.startsWith('<html')
                ? 'Cancel route returned HTML instead of JSON. Check the backend route or server error.'
                : 'Failed to cancel request.')
          );
        }

        setSuccessFeedback(data?.message || 'Relief request cancelled successfully.');

        setJourney({
          request: null,
          releases: [],
          stage: 'preparation',
          canEdit: false,
          canCancel: false,
          canReceiveAnyRelease: false,
          canRequestAgain: true,
          summary: null
        });

        setRequestId('');
        setRequestNo('Auto-generated');
        setDisaster('');
        setRequestDate(new Date().toISOString().slice(0, 10));
        setRemarks('');
        setRows(bootstrapRows.map((row) => createPreparedRow(row)));
        setShowEditor(false);
        resetImportState();

        await loadJourneyData({ silent: true });
      }

      if (confirmState.action === 'receive') {
        const res = await fetch(`${BASE_URL}/api/relief-requests/${latestRequest?._id}/received`, {
          method: 'PUT',
          credentials: 'include'
        });

        const contentType = res.headers.get('content-type') || '';
        const rawText = await res.text();

        let data = {};
        if (contentType.includes('application/json')) {
          try {
            data = JSON.parse(rawText);
          } catch {
            data = {};
          }
        }

        if (!res.ok) {
          throw new Error(
            data?.message ||
              (rawText.startsWith('<!DOCTYPE') || rawText.startsWith('<html')
                ? 'Receive route returned HTML instead of JSON. Check the backend route or server error.'
                : 'Failed to mark request as received.')
          );
        }

        setSuccessFeedback(
          data?.message || 'Received deliveries updated successfully.'
        );
        await loadJourneyData({ silent: true });
      }
    } catch (err) {
      console.error(err);
      setErrorFeedback(err.message || 'Action failed.');
    } finally {
      setSubmittingAction(false);
      closeConfirmation();
    }
  };

  const handleStartNewRequest = async () => {
    try {
      clearFeedback();

      const freshRows = await fetchLatestBootstrapRows();

      setShowEditor(true);
      setRows(freshRows.map((row) => createPreparedRow(row)));
      setRequestId('');
      setRequestNo('Auto-generated');
      setDisaster('');
      setRequestDate(new Date().toISOString().slice(0, 10));
      setRemarks('');
      resetImportState();
    } catch (err) {
      console.error(err);
      setErrorFeedback(err.message || 'Failed to prepare a new request.');
    }
  };

  const handleExportRequestPdf = () => {
    if (!latestRequest?._id) return;

    window.open(
      `${BASE_URL}/api/relief-requests/mine/${latestRequest._id}/export-pdf`,
      '_blank'
    );
  };

  const handleEditCurrentRequest = () => {
    if (!latestRequest) return;

    clearFeedback();
    setRequestId(latestRequest._id || '');
    setRequestNo(latestRequest.requestNo || 'Auto-generated');
    setDisaster(latestRequest.disaster || '');
    setRequestDate(
      latestRequest.requestDate
        ? new Date(latestRequest.requestDate).toISOString().slice(0, 10)
        : new Date().toISOString().slice(0, 10)
    );
    setRemarks(latestRequest.remarks || '');
    setRows(buildRowsFromRequest(latestRequest));
    setImportInfo({
      hasImported: latestRequest.entryMode === 'excel_import',
      fileName: '',
      summary: null,
      issues: [],
      source: latestRequest.entryMode === 'excel_import' ? 'excel_import' : 'manual'
    });
    setShowEditor(true);
  };

  const handleChooseFile = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleCloseEditor = () => {
    clearFeedback();
    setShowEditor(false);
  };

  const handleImportFile = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    clearFeedback();
    setImportingFile(true);

    try {
      const arrayBuffer = await file.arrayBuffer();
      const workbook = XLSX.read(arrayBuffer, { type: 'array' });
      const firstSheetName = workbook.SheetNames?.[0];

      if (!firstSheetName) {
        throw new Error('The selected file does not contain a worksheet.');
      }

      const sheet = workbook.Sheets[firstSheetName];
      const rawRows = XLSX.utils.sheet_to_json(sheet, {
        defval: '',
        raw: false
      });

      if (!Array.isArray(rawRows) || rawRows.length === 0) {
        throw new Error('The selected file does not contain any data rows.');
      }

      const mappedRows = [];
      const issues = [];
      let matchedRows = 0;
      let unmatchedRows = 0;

      rawRows.forEach((rawRow, index) => {
        const mapped = {};

        Object.keys(rawRow || {}).forEach((header) => {
          const resolvedKey = resolveHeaderKey(header);
          if (resolvedKey) {
            mapped[resolvedKey] = rawRow[header];
          }
        });

        const evacuationCenterName = String(
          mapped.evacuationCenterName || ''
        ).trim();

        if (!evacuationCenterName) {
          issues.push(`Row ${index + 2}: Missing evacuation center name.`);
          return;
        }

        const matchedBootstrapRow = evacNameMap.get(normalizeValue(evacuationCenterName));

        if (matchedBootstrapRow) {
          matchedRows += 1;
        } else {
          unmatchedRows += 1;
          issues.push(
            `Row ${index + 2}: "${evacuationCenterName}" did not match an existing evacuation center.`
          );
        }

        mappedRows.push(
          createPreparedRow({
            evacPlaceId: matchedBootstrapRow?.evacPlaceId || '',
            evacuationCenterName:
              matchedBootstrapRow?.evacuationCenterName || evacuationCenterName,
            households: parseSafeNumber(mapped.households),
            families: parseSafeNumber(mapped.families),
            male: parseSafeNumber(mapped.male),
            female: parseSafeNumber(mapped.female),
            lgbtq: parseSafeNumber(mapped.lgbtq),
            pwd: parseSafeNumber(mapped.pwd),
            pregnant: parseSafeNumber(mapped.pregnant),
            senior: parseSafeNumber(mapped.senior),
            requestedFoodPacks: parseSafeNumber(mapped.requestedFoodPacks),
            isActiveRow: true,
            rowRemarks: String(mapped.rowRemarks || '').trim()
          })
        );
      });

      if (!mappedRows.length) {
        throw new Error('No valid data rows were found in the file.');
      }

      const matchedNames = new Set(
        mappedRows.map((row) => normalizeValue(row.evacuationCenterName))
      );

      const untouchedBootstrapRows = bootstrapRows
        .filter((row) => !matchedNames.has(normalizeValue(row.evacuationCenterName)))
        .map((row) => createPreparedRow(row));

      setRows([...mappedRows, ...untouchedBootstrapRows]);

      const summary = {
        totalRows: mappedRows.length,
        matchedRows,
        unmatchedRows
      };

      setImportInfo({
        hasImported: true,
        fileName: file.name,
        summary,
        issues,
        source: 'excel_import'
      });

      setSuccessFeedback(`Import complete. ${buildImportSummaryText(summary)}.`);
    } catch (err) {
      console.error(err);
      setErrorFeedback(err.message || 'Failed to import file.');
      setImportInfo({
        hasImported: false,
        fileName: '',
        summary: null,
        issues: [],
        source: 'manual'
      });
    } finally {
      setImportingFile(false);
      if (event.target) event.target.value = '';
    }
  };

  const showEditorSection = showEditor || editMode;
  const isJourneyInMotion =
    !showEditorSection &&
    stageMeta.activeStep >= 2 &&
    stageMeta.activeStep <= 4;
  const requestLayoutClass =
    stageMeta.activeStep >= 4 ? 'rrf-phase-fulfillment' : 'rrf-phase-early';
  const journeyProgressWidth = `${Math.min(
    100,
    Math.max(0, ((stageMeta.activeStep - 1) / (STAGE_STEPS.length - 1)) * 100)
  )}%`;

  return (
    <DashboardShell>
      <div className="rrf-page">
        <div className="rrf-shell">
          {loadingPage && !sessionChecked ? (
            <div className="rrf-loading-card">
              <div className="rrf-spinner" />
              <h2>Loading request</h2>
            </div>
          ) : (
            <>
              <section className="rrf-header-card">
                <div className="rrf-header-copy">
                  <span className="rrf-kicker">Barangay Relief Request</span>
                  <h1 className="rrf-title">Request, track, and confirm relief delivery</h1>
                </div>
              </section>

              <section
                className={`rrf-progress-card rrf-progress-card-compact ${
                  isJourneyInMotion ? 'rrf-progress-card-active' : 'rrf-progress-card-static'
                }`}
              >
                <div className="rrf-progress-head">
                  <div>
                    <span className="rrf-progress-kicker">Journey Progress</span>
                    <h2>Current request status</h2>
                  </div>
                  <div className="rrf-stage-head">
                    <span className={`rrf-stage-badge rrf-stage-${stageMeta.tone}`}>
                      {stageMeta.label}
                    </span>
                  </div>
                </div>

                <div
                  className={`rrf-journey-flow ${
                    isJourneyInMotion ? 'active' : 'static'
                  }`}
                  style={{ '--rrf-progress-width': journeyProgressWidth }}
                  aria-hidden="true"
                >
                  <span />
                  <span />
                </div>

                <div className="rrf-progress-steps five-step">
                  {STAGE_STEPS.map((step, index) => {
                    const stepNumber = index + 1;
                    const isDone = stageMeta.completedSteps >= stepNumber;
                    const isActive = stageMeta.activeStep === stepNumber;
                    const isIdle = !isDone && !isActive;

                    return (
                      <div
                        key={step.key}
                        className={`rrf-step ${isDone ? 'done' : ''} ${
                          isActive ? 'active' : ''
                        } ${isIdle ? 'idle' : ''}`}
                      >
                        <span>{stepNumber}</span>
                        <div>
                          <strong>{step.label}</strong>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>

              {pageError ? (
                <section className="rrf-card rrf-empty-card">
                  <div className="rrf-empty-state">
                    <h2>Unable to load request page</h2>
                    <p>{pageError}</p>
                  </div>
                </section>
              ) : null}

              {formFeedback.message ? (
                <section className={`rrf-feedback-card ${formFeedback.type}`}>
                  <p>{formFeedback.message}</p>
                </section>
              ) : null}

              <div className="rrf-layout-single">
                {showEditorSection ? (
                  <form className="rrf-form" onSubmit={handleSubmit}>
                    <section className="rrf-card">
                      <div className="rrf-panel-head">
                        <div>
                          <h2>
                            {isRejectedJourney
                              ? 'Edit Rejected Request'
                              : isEditingExisting
                                ? 'Edit Request'
                                : 'Prepare Request'}
                          </h2>
                        </div>

                        <div className="rrf-inline-actions">
                          <input
                            ref={fileInputRef}
                            type="file"
                            accept=".xlsx,.xls,.csv"
                            onChange={handleImportFile}
                            className="rrf-hidden-input"
                          />

                          <button
                            type="button"
                            className="rrf-btn rrf-btn-secondary"
                            onClick={handleChooseFile}
                            disabled={importingFile || submitting}
                          >
                            {importingFile ? 'Importing…' : 'Import Excel / CSV'}
                            <FaFileImport />
                          </button>

                          <button
                            type="button"
                            className="rrf-btn rrf-btn-secondary"
                            onClick={handleResetForm}
                            disabled={submitting}
                          >
                            Reset
                            <FaRedo />
                          </button>
                        </div>
                      </div>

                      {importInfo.hasImported ? (
                        <div className="rrf-import-strip">
                          <div className="rrf-import-strip-main">
                            <strong>{importInfo.fileName || 'Imported file'}</strong>
                            <span>{buildImportSummaryText(importInfo.summary)}</span>
                          </div>

                          {importInfo.issues?.length ? (
                            <small>{importInfo.issues.length} issue(s)</small>
                          ) : (
                            <small>Applied</small>
                          )}
                        </div>
                      ) : null}

                      <div className="rrf-editor-grid">
                        <div className="rrf-editor-main">
                          <div className="rrf-form-grid">
                            <div className="rrf-field">
                              <label htmlFor="requestNo">Request No.</label>
                              <input id="requestNo" type="text" value={requestNo} readOnly />
                            </div>

                            <div className="rrf-field">
                              <label htmlFor="barangayName">Barangay</label>
                              <input
                                id="barangayName"
                                type="text"
                                value={barangayName}
                                readOnly
                              />
                            </div>

                            <div className="rrf-field">
                              <label htmlFor="disaster">Disaster / Incident</label>
                              <input
                                id="disaster"
                                type="text"
                                value={disaster}
                                onChange={(e) => setDisaster(e.target.value)}
                              />
                            </div>

                            <div className="rrf-field">
                              <label htmlFor="requestDate">Request Date</label>
                              <input
                                id="requestDate"
                                type="date"
                                value={requestDate}
                                onChange={(e) => setRequestDate(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="rrf-field rrf-remarks-field">
                            <label htmlFor="remarks">Overall Remarks</label>
                            <textarea
                              id="remarks"
                              value={remarks}
                              onChange={(e) => setRemarks(e.target.value)}
                            />
                          </div>
                        </div>

                        <div className="rrf-editor-side">
                          <div className="rrf-card rrf-summary-card rrf-summary-card-compact">
                            <div className="rrf-panel-head rrf-panel-head-tight">
                              <div>
                                <h2>Live Totals</h2>
                              </div>
                            </div>

                            <div className="rrf-summary-list">
                              <div className="rrf-summary-item">
                                <span>Centers</span>
                                <strong>{activeRows.length}</strong>
                              </div>
                              <div className="rrf-summary-item">
                                <span>Families</span>
                                <strong>{totals.families}</strong>
                              </div>
                              <div className="rrf-summary-item">
                                <span>Individuals</span>
                                <strong>{totalIndividuals}</strong>
                              </div>
                              <div className="rrf-summary-item">
                                <span>Vulnerable</span>
                                <strong>{vulnerableCount}</strong>
                              </div>
                              <div className="rrf-summary-item emphasis">
                                <span>Food Packs</span>
                                <strong>{totals.requestedFoodPacks}</strong>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      <div className="rrf-table-card">
                        <div className="rrf-subsection-head">
                          <div>
                            <span className="rrf-subsection-kicker">Evacuation center rows</span>
                            <h3>Review and update row data</h3>
                          </div>
                        </div>

                        <div className="rrf-table-wrapper rrf-table-wrapper-tall">
                          <table className="rrf-table rrf-table-compact">
                            <thead>
                              <tr>
                                <th>#</th>
                                <th>Status</th>
                                <th className="rrf-left-cell">Evacuation Center</th>
                                <th>Households</th>
                                <th>Families</th>
                                <th>Male</th>
                                <th>Female</th>
                                <th>LGBTQ</th>
                                <th>PWD</th>
                                <th>Pregnant</th>
                                <th>Senior</th>
                                <th>Food Packs</th>
                                <th className="rrf-left-cell">Row Remarks</th>
                              </tr>
                            </thead>

                            <tbody>
                              {preparedRows.map((row, index) => (
                                <tr
                                  key={`${row.evacuationCenterName}-${index}`}
                                  className={!row.isActiveRow ? 'rrf-row-muted' : ''}
                                >
                                  <td className="rrf-row-number">{index + 1}</td>
                                  <td>
                                    <button
                                      type="button"
                                      className={`rrf-toggle-btn ${row.isActiveRow ? 'active' : ''}`}
                                      onClick={() => handleToggleRow(index)}
                                    >
                                      {row.isActiveRow ? 'On' : 'Off'}
                                    </button>
                                  </td>

                                  <td className="rrf-left-cell">
                                    <div className="rrf-evac-static">
                                      <strong>{row.evacuationCenterName || 'Unnamed center'}</strong>
                                    </div>
                                  </td>

                                  {numberFields.map((field) => (
                                    <td key={`${field}-${index}`} className="rrf-number-cell">
                                      <input
                                        type="number"
                                        min="0"
                                        value={row[field]}
                                        onChange={(e) =>
                                          handleRowNumberChange(index, field, e.target.value)
                                        }
                                        disabled={!row.isActiveRow}
                                      />
                                    </td>
                                  ))}

                                  <td className="rrf-left-cell rrf-cell-remarks">
                                    <input
                                      type="text"
                                      value={row.rowRemarks || ''}
                                      onChange={(e) =>
                                        handleRowRemarksChange(index, e.target.value)
                                      }
                                      disabled={!row.isActiveRow}
                                      placeholder="Optional"
                                    />
                                  </td>
                                </tr>
                              ))}
                            </tbody>

                            <tfoot>
                              <tr>
                                <td colSpan="3" className="rrf-total-label">
                                  Total
                                </td>
                                <td>{totals.households}</td>
                                <td>{totals.families}</td>
                                <td>{totals.male}</td>
                                <td>{totals.female}</td>
                                <td>{totals.lgbtq}</td>
                                <td>{totals.pwd}</td>
                                <td>{totals.pregnant}</td>
                                <td>{totals.senior}</td>
                                <td>{totals.requestedFoodPacks}</td>
                                <td />
                              </tr>
                            </tfoot>
                          </table>
                        </div>
                      </div>

                      <div className="rrf-submit-row">
                        <button
                          type="button"
                          className="rrf-btn rrf-btn-secondary"
                          onClick={handleCloseEditor}
                          disabled={submitting}
                        >
                          Close Editor
                          <FaTimes />
                        </button>
                        <button
                          type="submit"
                          className="rrf-btn rrf-btn-primary"
                          disabled={isSubmitDisabled}
                        >
                          <FaCheck />
                          {submitting
                            ? isEditingExisting
                              ? 'Saving...'
                              : 'Submitting...'
                            : isEditingExisting
                              ? isRejectedJourney
                                ? 'Resubmit Request'
                                : 'Save Changes'
                              : 'Submit Request'}
                        </button>
                      </div>
                    </section>
                  </form>
                ) : null}

                {!showEditorSection && latestRequest ? (
                  <section
                    className={`rrf-card rrf-current-request-card rrf-unified-request-card ${requestLayoutClass}`}
                  >
                    <div className="rrf-unified-request-header">
                      <div>
                        <span className="rrf-subsection-kicker">Current request</span>
                        <h2>Relief Request Overview</h2>
                      </div>

                      <div className="rrf-inline-actions">
                        {journey.canEdit || isRejectedJourney ? (
                          <button
                            type="button"
                            className="rrf-btn rrf-btn-secondary"
                            onClick={handleEditCurrentRequest}
                          >
                            {isRejectedJourney ? 'Edit & Resubmit' : 'Edit Request'}
                            <FaPen />
                          </button>
                        ) : null}

                        {journey.canCancel ? (
                          <button
                            type="button"
                            className="rrf-btn rrf-btn-danger"
                            onClick={() =>
                              openConfirmation({
                                title: 'Cancel this request?',
                                message: 'This request will no longer continue in the queue.',
                                action: 'cancel'
                              })
                            }
                            disabled={submittingAction}
                          >
                            Cancel Request
                            <FaTimes />
                          </button>
                        ) : null}

                        {journey.canReceiveAnyRelease ? (
                          <button
                            type="button"
                            className="rrf-btn rrf-btn-primary"
                            onClick={() =>
                              openConfirmation({
                                title: 'Confirm received deliveries?',
                                message:
                                  'Only the currently released deliveries will be marked as received.',
                                action: 'receive'
                              })
                            }
                            disabled={submittingAction}
                          >
                            Confirm Received
                            <FaCheck />
                          </button>
                        ) : null}

                        {canShowRequestAgainButton ? (
                          <button
                            type="button"
                            className="rrf-btn rrf-btn-primary"
                            onClick={handleStartNewRequest}
                          >
                            Prepare New Request
                            <FaPlus />
                          </button>
                        ) : null}
                      </div>
                    </div>

                    {isRejectedJourney ? (
                      <div className="rrf-result-banner rrf-result-banner-rejected rrf-result-banner-combined">
                        <div className="rrf-result-banner-icon">
                          <FaExclamationTriangle />
                        </div>

                        <div className="rrf-result-banner-content">
                          <span className="rrf-result-banner-kicker">Request Rejected</span>
                          <h3>This request needs revision</h3>
                          <p>
                            {decisionRemarks ||
                              'DRRMO rejected this request. Please review and resubmit it.'}
                          </p>
                        </div>
                      </div>
                    ) : null}

                    <div className="rrf-unified-request-body">
                      <div className="rrf-request-identity-panel">
                        <span>Request No.</span>
                        <strong>{latestRequest.requestNo || '-'}</strong>

                        <div className="rrf-request-identity-foot">
                          <div>
                            <small>Status</small>
                            <b className={`rrf-stage-badge rrf-stage-${stageMeta.tone}`}>
                              {requestStatusLabel}
                            </b>
                          </div>

                          <div>
                            <small>Request Date</small>
                            <b>{formatDate(latestRequest.requestDate)}</b>
                          </div>
                        </div>
                      </div>

                      <div className="rrf-request-metrics-grid">
                        <div className="rrf-request-metric highlight">
                          <span>Requested Packs</span>
                          <strong>{displayRequestedPacks}</strong>
                          <small>Total food packs requested</small>
                        </div>

                        <div className="rrf-request-metric success">
                          <span>Received Packs</span>
                          <strong>{displayReceivedPacks}</strong>
                          <small>Confirmed by barangay</small>
                        </div>

                        <div className="rrf-request-metric warning">
                          <span>Pending Receipt</span>
                          <strong>{displayPendingReceipt}</strong>
                          <small>Waiting confirmation</small>
                        </div>

                        <div className={`rrf-request-metric receipt ${receiptMeta.tone}`}>
                          <span>{receiptMeta.label}</span>
                          <strong>{receiptMeta.value}</strong>
                          <small>Receipt status</small>
                        </div>
                      </div>
                    </div>

                    <div className="rrf-request-details-grid">
                      <div className="rrf-request-detail-card">
                        <span>Disaster / Incident</span>
                        <strong>{latestRequest.disaster || '-'}</strong>
                      </div>

                      <div className="rrf-request-detail-card">
                        <span>Entry Mode</span>
                        <strong>
                          {latestRequest.entryMode === 'excel_import'
                            ? 'Excel Import'
                            : 'Manual Encoding'}
                        </strong>
                      </div>

                      <div className="rrf-request-detail-card">
                        <span>Total Affected</span>
                        <strong>{displayTotalAffected}</strong>
                      </div>

                      <div className="rrf-request-detail-card">
                        <span>Vulnerable Count</span>
                        <strong>{displayVulnerableCount}</strong>
                      </div>
                    </div>

                    {shouldShowReceivedSection ? (
                      <div className="rrf-unified-receipt-panel">
                        <div className="rrf-unified-receipt-head">
                          <div>
                            <span className="rrf-subsection-kicker">Receipt Details</span>
                            <h3>{hasReceivedData ? 'Delivery Received' : 'Waiting for Delivery'}</h3>
                          </div>

                          {latestRequest?._id && isReceiptConfirmed ? (
                            <button
                              type="button"
                              className="rrf-btn rrf-btn-secondary rrf-btn-small"
                              onClick={handleExportRequestPdf}
                            >
                              <FaFilePdf />
                              Export PDF
                            </button>
                          ) : null}
                        </div>

                        <div className="rrf-receipt-summary-grid">
                          <div className="rrf-receipt-summary-card featured">
                            <span>Received Food Packs</span>
                            <strong>{displayReceivedPacks}</strong>
                            <small>Distributed packs</small>
                          </div>

                          <div className="rrf-receipt-summary-card">
                            <span>Total Quantity</span>
                            <strong>{Number(receivedSummary.totalQuantity || 0)}</strong>
                            <small>Units received</small>
                          </div>

                          <div className="rrf-receipt-summary-card">
                            <span>Total Amount</span>
                            <strong>PHP {Number(receivedSummary.totalAmount || 0).toFixed(2)}</strong>
                            <small>Monetary value</small>
                          </div>

                          <div className="rrf-receipt-summary-card">
                            <span>Item Lines</span>
                            <strong>{Number(receivedSummary.itemLines || 0)}</strong>
                            <small>Accepted items</small>
                          </div>

                          <div className="rrf-receipt-summary-card">
                            <span>Last Received</span>
                            <strong>{formatDateTime(receivedSummary.latestReceivedAt)}</strong>
                            <small>Latest confirmation</small>
                          </div>
                        </div>

                        <div className="rrf-unified-items-panel">
                          <div className="rrf-unified-items-head">
                            <div>
                              <span className="rrf-subsection-kicker">Accepted Items</span>
                              <h3>Delivered Item Breakdown</h3>
                            </div>
                          </div>

                          {receivedItems.length ? (
                            <div className="rrf-table-wrapper rrf-unified-items-scroll">
                              <table className="rrf-table rrf-unified-items-table">
                                <thead>
                                  <tr>
                                    <th>#</th>
                                    <th>Item</th>
                                    <th>Category</th>
                                    <th>Quantity / Amount</th>
                                    <th>Unit</th>
                                    <th>Received Date</th>
                                    <th>Remarks</th>
                                  </tr>
                                </thead>

                                <tbody>
                                  {receivedItems.map((item, index) => (
                                    <tr key={item.key || index}>
                                      <td>{index + 1}</td>
                                      <td className="rrf-left-cell">
                                        <strong>{item.itemName}</strong>
                                      </td>
                                      <td>{item.category}</td>
                                      <td>
                                        {Number(item.amount || 0) > 0
                                          ? `PHP ${Number(item.amount || 0).toFixed(2)}`
                                          : Number(item.quantity || 0)}
                                      </td>
                                      <td>{item.unit}</td>
                                      <td>{formatDateTime(item.releaseDate)}</td>
                                      <td>{item.remarks || '-'}</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="rrf-received-empty">
                              <div className="rrf-received-empty-icon">
                                <FaExclamationTriangle />
                              </div>
                              <div>
                                <h4>No received item lines yet</h4>
                                <p>
                                  Delivery information will appear here once DRRMO releases goods and the
                                  barangay confirms receipt.
                                </p>
                              </div>
                            </div>
                          )}
                        </div>
                      </div>
                    ) : null}
                  </section>
                ) : null}

                {!showEditorSection && !latestRequest ? (
                  <section className="rrf-card rrf-empty-card">
                    <div className="rrf-empty-inline">
                      <div>
                        <h2>No active request</h2>
                      </div>

                      <button
                        type="button"
                        className="rrf-btn rrf-btn-primary"
                        onClick={handleStartNewRequest}
                      >
                        Prepare New Request
                        <FaPlus />
                      </button>
                    </div>
                  </section>
                ) : null}
              </div>

              {confirmState.open ? (
                <div className="rrf-modal-backdrop">
                  <div className="rrf-modal-card">
                    <h3>{confirmState.title}</h3>
                    <p>{confirmState.message}</p>

                    <div className="rrf-modal-actions">
                      <button
                        type="button"
                        className="rrf-btn rrf-btn-secondary"
                        onClick={closeConfirmation}
                        disabled={submittingAction}
                      >
                        Go Back
                        <FaTimes />
                      </button>
                      <button
                        type="button"
                        className={`rrf-btn ${
                          confirmState.action === 'cancel'
                            ? 'rrf-btn-danger'
                            : 'rrf-btn-primary'
                        }`}
                        onClick={handleConfirmAction}
                        disabled={submittingAction}
                      >
                        {submittingAction ? 'Processing…' : 'Confirm'}
                        {confirmState.action === 'cancel' ? <FaTimes /> : <FaCheck />}
                      </button>
                    </div>
                  </div>
                </div>
              ) : null}
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
}
