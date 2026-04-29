import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import axios from "axios";
import "../css/InventoryAdd.css";
import DashboardShell from "../layout/DashboardShell";
import {
  FaArchive,
  FaBell,
  FaBoxes,
  FaCheck,
  FaExclamationTriangle,
  FaFilePdf,
  FaFileInvoiceDollar,
  FaHistory,
  FaMoneyBillWave,
  FaPen,
  FaPlus,
  FaRedo,
  FaSave,
  FaTimes,
  FaTrash,
  FaUndo,
  FaUpload,
} from "react-icons/fa";

const BASE_URL =
  process.env.REACT_APP_API_URL || "https://gaganadapat.onrender.com";

const CUSTOM_CATEGORY_VALUE = "__custom__";
const TOAST_LIMIT = 3;
const TOAST_DURATION = 10000;

const APPLIANCE_EXPIRY_EXEMPT_KEYWORDS = ["appliance", "appliances", "equipment"];

const InventoryAdd = () => {
  const [items, setItems] = useState([]);
  const [archivedItems, setArchivedItems] = useState([]);
  const [proofFiles, setProofFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [showArchived, setShowArchived] = useState(false);
  const [donationType, setDonationType] = useState("goods");
  const [editingItemId, setEditingItemId] = useState("");
  const fileInputRef = useRef(null);
  const toastTimersRef = useRef({});
  const [confirmationDialog, setConfirmationDialog] = useState(null);

  const [categoryOptions, setCategoryOptions] = useState([]);
  const [categoryLoading, setCategoryLoading] = useState(false);

  const [toasts, setToasts] = useState([]);

  const getToastIcon = (type) => {
    if (type === "success") return <FaCheck />;
    if (type === "error") return <FaTimes />;
    if (type === "warning") return <FaExclamationTriangle />;
    return <FaBell />;
  };

  const openConfirmationDialog = (config) => {
    setConfirmationDialog({
      title: "Confirm Action",
      message: "Please confirm before continuing.",
      confirmLabel: "Confirm",
      cancelLabel: "Cancel",
      tone: "primary",
      icon: <FaExclamationTriangle />,
      ...config,
    });
  };

  const closeConfirmationDialog = () => {
    if (loading) return;
    setConfirmationDialog(null);
  };

  const confirmDialogAction = async () => {
    if (!confirmationDialog?.onConfirm) return;
    await confirmationDialog.onConfirm();
    setConfirmationDialog(null);
  };

  const [form, setForm] = useState({
    type: "goods",
    name: "",
    category: "",
    customCategory: "",
    quantity: "",
    unit: "",
    amount: "",
    expirationDate: "",
    description: "",
    sourceType: "external",
    sourceName: ""
  });

  const [formErrors, setFormErrors] = useState({});

  const [filters, setFilters] = useState({
    search: "",
    category: "",
    expiryStatus: "",
    addedBy: "",
    date: ""
  });

  const [sortConfig, setSortConfig] = useState({
    key: "createdAt",
    direction: "desc"
  });

  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const pushToast = useCallback((message, type = "success") => {
    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;

    setToasts((prev) => [{ id, message, type }, ...prev].slice(0, TOAST_LIMIT));

    if (toastTimersRef.current[id]) {
      clearTimeout(toastTimersRef.current[id]);
    }

    toastTimersRef.current[id] = setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
      delete toastTimersRef.current[id];
    }, TOAST_DURATION);
  }, []);

  const removeToast = (id) => {
    if (toastTimersRef.current[id]) {
      clearTimeout(toastTimersRef.current[id]);
      delete toastTimersRef.current[id];
    }

    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      Object.values(timers).forEach((timer) =>
        clearTimeout(timer)
      );
    };
  }, []);

  const normalizeType = (type) => (type || "goods").toLowerCase();

  const normalizeCategoryValue = useCallback((value) => {
    return String(value || "").trim().toLowerCase();
  }, []);

  const isFoodRelatedCategory = useCallback((category) => {
  const value = normalizeCategoryValue(category);
  if (!value) return false;

  const isApplianceLike = APPLIANCE_EXPIRY_EXEMPT_KEYWORDS.some((keyword) =>
    value.includes(keyword)
  );

  return !isApplianceLike;
}, [normalizeCategoryValue]);

  const getExpiryStatus = (item) => {
    if (!item?.expirationDate) return "none";

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const expiry = new Date(item.expirationDate);
    expiry.setHours(0, 0, 0, 0);

    const diffDays = Math.ceil(
      (expiry.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)
    );

    if (diffDays < 0) return "expired";
    if (diffDays <= 30) return "soon";
    return "ok";
  };

  const getExpiryBadgeLabel = (item) => {
    const status = getExpiryStatus(item);
    if (status === "expired") return "Expired";
    if (status === "soon") return "Expiring Soon";
    return "";
  };

  const getExpiryBadgeClass = (item) => {
    const status = getExpiryStatus(item);
    if (status === "expired") return "badge-expiry-expired";
    if (status === "soon") return "badge-expiry-soon";
    if (status === "ok") return "badge-expiry-ok";
    return "badge-expiry-none";
  };

  const fetchInventory = useCallback(async () => {
    try {
      setFetching(true);
      const res = await axios.get(`${BASE_URL}/api/inventory`, {
        withCredentials: true
      });

      setItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching inventory:", err);
      pushToast("Failed to fetch inventory items.", "error");
    } finally {
      setFetching(false);
    }
  }, [pushToast]);

  const fetchInventoryCategories = useCallback(async () => {
    try {
      setCategoryLoading(true);
      const res = await axios.get(`${BASE_URL}/api/inventory/categories`, {
        withCredentials: true
      });

      const data = Array.isArray(res.data) ? res.data : [];
      setCategoryOptions(data);
    } catch (err) {
      console.error("Error fetching inventory categories:", err);
      setCategoryOptions([]);
      pushToast("Failed to fetch inventory categories.", "error");
    } finally {
      setCategoryLoading(false);
    }
  }, [pushToast]);

  const fetchArchivedInventory = useCallback(async () => {
    try {
      const res = await axios.get(`${BASE_URL}/api/inventory/archived`, {
        withCredentials: true
      });

      setArchivedItems(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      console.error("Error fetching archived inventory:", err);
      pushToast("Failed to fetch archived inventory items.", "error");
    }
  }, [pushToast]);

  useEffect(() => {
    fetchInventory();
    fetchInventoryCategories();
  }, [fetchInventory, fetchInventoryCategories]);

  useEffect(() => {
    if (showArchived) {
      fetchArchivedInventory();
    }
  }, [showArchived, fetchArchivedInventory]);

  const resetForm = () => {
    setForm({
      type: donationType,
      name: "",
      category: "",
      customCategory: "",
      quantity: "",
      unit: "",
      amount: "",
      expirationDate: "",
      description: "",
      sourceType: "external",
      sourceName: ""
    });
    setProofFiles([]);
    setFormErrors({});
    setEditingItemId("");
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  useEffect(() => {
    if (editingItemId) return;

    setForm({
      type: donationType,
      name: "",
      category: "",
      customCategory: "",
      quantity: "",
      unit: "",
      amount: "",
      expirationDate: "",
      description: "",
      sourceType: "external",
      sourceName: ""
    });
    setProofFiles([]);
    setFormErrors({});
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }

    if (donationType === "goods") {
      fetchInventoryCategories();
    }
  }, [donationType, editingItemId, fetchInventoryCategories]);

  const formatDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleString();
  };

  const formatShortDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const formatExpiryDate = (date) => {
    if (!date) return "-";
    return new Date(date).toLocaleDateString();
  };

  const formatCategory = (category) => {
    if (!category) return "-";
    return category
      .split(" ")
      .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
      .join(" ");
  };

  const isRecentDonation = (createdAt) => {
    if (!createdAt) return false;
    const itemDate = new Date(createdAt);
    const now = new Date();
    const diffInDays = (now - itemDate) / (1000 * 60 * 60 * 24);
    return diffInDays <= 7;
  };

  const getFormTitle = () => {
    if (editingItemId) {
      return donationType === "goods"
        ? "Edit Goods Donation"
        : "Edit Monetary Donation";
    }

    return donationType === "goods"
      ? "Add Goods Donation"
      : "Add Monetary Donation";
  };

  const getPrimaryFieldLabel = () => {
    return donationType === "goods" ? "Item Name" : "Donor / Source Name";
  };

  const getPrimaryFieldPlaceholder = () => {
    return donationType === "goods"
      ? "e.g. Rice, Canned Goods, Hygiene Kit"
      : "e.g. Juan Dela Cruz, ABC Foundation";
  };

  const getSourceNamePlaceholder = () => {
    return donationType === "goods"
      ? "e.g. NGO, Barangay Office, Private Donor"
      : "e.g. Municipal Office, Foundation, Private Sponsor";
  };

  const getProofLabel = () => {
    return donationType === "goods"
      ? "Upload receipts, delivery photos, acknowledgement slips, or intake proof."
      : "Upload receipts, deposit slips, acknowledgement forms, or proof of transaction.";
  };

  const getNumberInputValue = (value) => {
    return value === 0 ? "" : value;
  };

  const getFinalGoodsCategory = useCallback(() => {
    if (form.category === CUSTOM_CATEGORY_VALUE) {
      return normalizeCategoryValue(form.customCategory);
    }
    return normalizeCategoryValue(form.category);
  }, [form.category, form.customCategory, normalizeCategoryValue]);

  const isExpiryRequired = useMemo(() => {
    if (donationType !== "goods") return false;
    return isFoodRelatedCategory(getFinalGoodsCategory());
  }, [donationType, getFinalGoodsCategory, isFoodRelatedCategory]);

  const handleChange = (e) => {
    const { name, value } = e.target;

    if (name === "quantity" || name === "amount") {
      if (value === "") {
        setForm((prev) => ({ ...prev, [name]: "" }));
      } else {
        const parsedValue = Number(value);
        if (!Number.isNaN(parsedValue) && parsedValue >= 0) {
          setForm((prev) => ({ ...prev, [name]: value }));
        }
      }
    } else if (name === "category") {
      setForm((prev) => ({
        ...prev,
        category: value,
        customCategory: value === CUSTOM_CATEGORY_VALUE ? prev.customCategory : ""
      }));
    } else {
      setForm((prev) => ({ ...prev, [name]: value }));
    }

    setFormErrors((prev) => ({
      ...prev,
      [name]: "",
      category: "",
      customCategory: "",
      expirationDate: ""
    }));
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    setProofFiles(files);
  };

  const validateForm = () => {
    const errors = {};

    if (!form.name.trim()) {
      errors.name =
        donationType === "goods"
          ? "Item name is required."
          : "Donor name is required.";
    }

    if (donationType === "goods") {
      const finalCategory = getFinalGoodsCategory();

      if (!finalCategory) {
        errors.category = "Category is required.";
      }

      if (
        form.category === CUSTOM_CATEGORY_VALUE &&
        !normalizeCategoryValue(form.customCategory)
      ) {
        errors.customCategory = "Please enter a custom category.";
      }

      if (form.quantity === "" || Number(form.quantity) <= 0) {
        errors.quantity = "Quantity must be greater than 0.";
      }

      if (!form.unit.trim()) {
        errors.unit = "Unit is required for goods donations.";
      }

      if (form.expirationDate) {
        const parsed = new Date(form.expirationDate);
        if (Number.isNaN(parsed.getTime())) {
          errors.expirationDate = "Expiration date is invalid.";
        }
      }

      if (isFoodRelatedCategory(finalCategory) && !form.expirationDate) {
        errors.expirationDate =
          "Expiration date is required for food-related goods.";
      }
    }

    if (donationType === "monetary") {
      if (form.amount === "" || Number(form.amount) <= 0) {
        errors.amount = "Amount must be greater than 0.";
      }
    }

    if (!form.sourceType.trim()) {
      errors.sourceType = "Source type is required.";
    }

    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const openEditForm = (item) => {
    const itemType = normalizeType(item.type);

    setDonationType(itemType);
    setEditingItemId(item._id);
    setShowForm(true);
    setFormErrors({});
    setProofFiles([]);

    setForm({
      type: itemType,
      name: item.name || "",
      category: itemType === "goods" ? item.category || "" : "",
      customCategory: "",
      quantity:
        itemType === "goods" && item.quantity !== undefined
          ? String(item.quantity)
          : "",
      unit: itemType === "goods" ? item.unit || "" : "",
      amount:
        itemType === "monetary" && item.amount !== undefined
          ? String(item.amount)
          : "",
      expirationDate:
        itemType === "goods" && item.expirationDate
          ? new Date(item.expirationDate).toISOString().slice(0, 10)
          : "",
      description: item.description || "",
      sourceType: item.sourceType || "external",
      sourceName: item.sourceName || ""
    });

    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateForm()) return;

    setLoading(true);

    try {
      const formData = new FormData();

      formData.append("type", donationType);
      formData.append("name", form.name.trim());
      formData.append("description", form.description.trim());
      formData.append("sourceType", form.sourceType);
      formData.append(
        "sourceName",
        donationType === "monetary" ? form.name.trim() : form.sourceName.trim()
      );

      if (donationType === "goods") {
        formData.append("category", getFinalGoodsCategory());
        if (form.quantity !== "") {
          formData.append("quantity", form.quantity);
        }
        formData.append("unit", form.unit.trim());
        formData.append("expirationDate", form.expirationDate || "");
      } else {
        if (form.amount !== "") {
          formData.append("amount", form.amount);
        }
      }

      for (let i = 0; i < proofFiles.length; i++) {
        formData.append("proofFiles", proofFiles[i]);
      }

      if (editingItemId) {
        await axios.put(`${BASE_URL}/api/inventory/${editingItemId}`, formData, {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" }
        });

        pushToast("Inventory item updated successfully.", "success");
      } else {
        await axios.post(`${BASE_URL}/api/inventory`, formData, {
          withCredentials: true,
          headers: { "Content-Type": "multipart/form-data" }
        });

        pushToast(
          donationType === "goods"
            ? "Goods donation added successfully."
            : "Monetary donation added successfully.",
          "success"
        );
      }

      resetForm();
      setShowForm(false);
      fetchInventory();
      fetchInventoryCategories();
    } catch (err) {
      console.error("Error saving inventory:", err);
      pushToast(
        err?.response?.data?.message || "Failed to save inventory item.",
        "error"
      );
    } finally {
      setLoading(false);
    }
  };

  const handleArchive = async (id, name) => {
    openConfirmationDialog({
      title: "Archive inventory record?",
      message: `"${name || "This item"}" will move to archived donations and leave the active inventory list.`,
      confirmLabel: "Archive Record",
      tone: "danger",
      icon: <FaArchive />,
      onConfirm: async () => {
        try {
          await axios.delete(`${BASE_URL}/api/inventory/${id}`, {
            withCredentials: true
          });

          pushToast("Inventory item archived successfully.", "success");
          fetchInventory();
          fetchInventoryCategories();
        } catch (err) {
          console.error("Error archiving item:", err);
          pushToast(
            err?.response?.data?.message || "Failed to archive item.",
            "error"
          );
        }
      }
    });
  };

  const handleUnarchive = async (id, name) => {
    openConfirmationDialog({
      title: "Restore archived record?",
      message: `"${name || "This item"}" will return to active inventory and become available again.`,
      confirmLabel: "Restore Record",
      tone: "primary",
      icon: <FaUndo />,
      onConfirm: async () => {
        try {
          await axios.put(
            `${BASE_URL}/api/inventory/archived/${id}/restore`,
            {},
            { withCredentials: true }
          );

          pushToast("Inventory item unarchived successfully.", "success");
          fetchArchivedInventory();
          fetchInventory();
          fetchInventoryCategories();
        } catch (err) {
          console.error("Error unarchiving item:", err);
          pushToast(
            err?.response?.data?.message || "Failed to unarchive item.",
            "error"
          );
        }
      }
    });
  };

  const handlePermanentDelete = async (id, name) => {
    openConfirmationDialog({
      title: "Permanently delete record?",
      message: `"${name || "This item"}" will be permanently deleted. This action cannot be undone.`,
      confirmLabel: "Delete Permanently",
      tone: "danger",
      icon: <FaTrash />,
      onConfirm: async () => {
        try {
          await axios.delete(`${BASE_URL}/api/inventory/archived/${id}/permanent`, {
            withCredentials: true
          });

          pushToast("Inventory item deleted permanently.", "success");
          fetchArchivedInventory();
          fetchInventoryCategories();
        } catch (err) {
          console.error("Error deleting archived item:", err);
          pushToast(
            err?.response?.data?.message || "Failed to permanently delete item.",
            "error"
          );
        }
      }
    });
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters((prev) => ({ ...prev, [name]: value }));
    setCurrentPage(1);
  };

  const clearFilters = () => {
    setFilters({
      search: "",
      category: "",
      expiryStatus: "",
      addedBy: "",
      date: ""
    });
    setCurrentPage(1);
  };

  const handleSort = (key) => {
    setSortConfig((prev) => {
      if (prev.key === key) {
        return {
          key,
          direction: prev.direction === "asc" ? "desc" : "asc"
        };
      }

      return {
        key,
        direction: "asc"
      };
    });
  };

  const exportInventoryPdf = useCallback(() => {
    try {
      let reportType = "masterlist";

      if (showArchived) {
        reportType = "archived";
      } else if (donationType === "monetary") {
        reportType = "monetary_donations";
      } else {
        reportType = "goods_donations";
      }

      const pdfUrl = `${BASE_URL}/api/inventory/export-pdf?reportType=${reportType}`;
      window.open(pdfUrl, "_blank", "noopener,noreferrer");
      pushToast("Opening inventory PDF...", "info");
    } catch (error) {
      console.error("Export inventory PDF error:", error);
      pushToast("Failed to open inventory PDF.", "error");
    }
  }, [showArchived, donationType, pushToast]);

  const goodsItems = useMemo(
    () => items.filter((item) => normalizeType(item.type) === "goods"),
    [items]
  );

  const monetaryItems = useMemo(
    () => items.filter((item) => normalizeType(item.type) === "monetary"),
    [items]
  );

  const currentTypeItems = useMemo(() => {
    const sourceItems = showArchived ? archivedItems : items;
    return sourceItems.filter((item) => normalizeType(item.type) === donationType);
  }, [items, archivedItems, donationType, showArchived]);

  const categories = useMemo(() => {
    if (donationType !== "goods") return [];
    const unique = [
      ...new Set(currentTypeItems.map((item) => item.category).filter(Boolean))
    ];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [currentTypeItems, donationType]);

  const selectableCategoryOptions = useMemo(() => {
    const merged = [...new Set([...categoryOptions, ...categories].filter(Boolean))];
    return merged.sort((a, b) => a.localeCompare(b));
  }, [categoryOptions, categories]);

  const addedByOptions = useMemo(() => {
    const unique = [
      ...new Set(currentTypeItems.map((item) => item.addedBy).filter(Boolean))
    ];
    return unique.sort((a, b) => a.localeCompare(b));
  }, [currentTypeItems]);

    const summary = useMemo(() => {
    const totalItems = items.length;
    const totalGoodsEntries = goodsItems.length;
    const totalMonetaryEntries = monetaryItems.length;

    const totalGoodsQuantity = goodsItems.reduce((sum, item) => {
      const qty = Number(item.quantity);
      return sum + (Number.isNaN(qty) ? 0 : qty);
    }, 0);

    const totalMonetaryAmount = monetaryItems.reduce((sum, item) => {
      const amount = Number(item.amount || 0);
      return sum + (Number.isNaN(amount) ? 0 : amount);
    }, 0);

    const recentDonationsCount = items.filter((item) =>
      isRecentDonation(item.createdAt)
    ).length;

    return {
      totalItems,
      totalGoodsEntries,
      totalMonetaryEntries,
      totalGoodsQuantity,
      totalMonetaryAmount,
      recentDonationsCount
    };
  }, [items, goodsItems, monetaryItems]);

  const filteredItems = useMemo(() => {
    let filtered = [...currentTypeItems];

    if (filters.search.trim()) {
      const searchTerm = filters.search.toLowerCase();
      filtered = filtered.filter((item) =>
        [
          item.name,
          item.description,
          item.category,
          item.addedBy,
          item.unit,
          item.sourceType,
          item.sourceName,
          item.expirationDate
        ]
          .join(" ")
          .toLowerCase()
          .includes(searchTerm)
      );
    }

    if (donationType === "goods" && filters.category) {
      filtered = filtered.filter(
        (item) =>
          (item.category || "").toLowerCase() === filters.category.toLowerCase()
      );
    }

    if (donationType === "goods" && filters.expiryStatus) {
      filtered = filtered.filter((item) => {
        const status = getExpiryStatus(item);
        return status === filters.expiryStatus;
      });
    }

    if (filters.addedBy) {
      filtered = filtered.filter(
        (item) =>
          (item.addedBy || "").toLowerCase() === filters.addedBy.toLowerCase()
      );
    }

    if (filters.date) {
      filtered = filtered.filter((item) => {
        if (!item.createdAt) return false;
        const itemDate = new Date(item.createdAt).toISOString().slice(0, 10);
        return itemDate === filters.date;
      });
    }

    return filtered;
  }, [currentTypeItems, filters, donationType]);

  const sortedItems = useMemo(() => {
    const sorted = [...filteredItems];

    sorted.sort((a, b) => {
      let aValue = a[sortConfig.key];
      let bValue = b[sortConfig.key];

      if (sortConfig.key === "type") {
        aValue = normalizeType(a.type);
        bValue = normalizeType(b.type);
      }

      if (sortConfig.key === "createdAt" || sortConfig.key === "expirationDate") {
        aValue = a[sortConfig.key] ? new Date(a[sortConfig.key]).getTime() : 0;
        bValue = b[sortConfig.key] ? new Date(b[sortConfig.key]).getTime() : 0;
      }

      if (sortConfig.key === "quantity") {
        aValue =
          donationType === "monetary"
            ? Number(a.amount || 0)
            : Number(a.quantity) || 0;

        bValue =
          donationType === "monetary"
            ? Number(b.amount || 0)
            : Number(b.quantity) || 0;
      }

      if (typeof aValue === "string") aValue = aValue.toLowerCase();
      if (typeof bValue === "string") bValue = bValue.toLowerCase();

      if (aValue < bValue) return sortConfig.direction === "asc" ? -1 : 1;
      if (aValue > bValue) return sortConfig.direction === "asc" ? 1 : -1;
      return 0;
    });

    return sorted;
  }, [filteredItems, sortConfig, donationType]);

  const totalPages = Math.ceil(sortedItems.length / rowsPerPage) || 1;

  const paginatedItems = useMemo(() => {
    const startIndex = (currentPage - 1) * rowsPerPage;
    return sortedItems.slice(startIndex, startIndex + rowsPerPage);
  }, [sortedItems, currentPage, rowsPerPage]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(1);
    }
  }, [totalPages, currentPage]);

  const pageNumbers = useMemo(() => {
    const pages = [];
    for (let i = 1; i <= totalPages; i++) {
      pages.push(i);
    }
    return pages;
  }, [totalPages]);

  const sortArrow = (key) => {
    if (sortConfig.key !== key) return "Sort";
    return sortConfig.direction === "asc" ? "Asc" : "Desc";
  };

  const tableColSpan = donationType === "goods" ? 11 : 8;

  return (
    <DashboardShell>
      <div className="inventory-page">
        <div className="inventory-shell">
          {typeof document !== "undefined"
            ? createPortal(
                <div className="notification-stack">
                  {toasts.map((toast) => (
                    <button
                      key={toast.id}
                      type="button"
                      className={`notification-toast ${toast.type}`}
                      onClick={() => removeToast(toast.id)}
                    >
                      <span className="notification-icon">{getToastIcon(toast.type)}</span>
                      <span className="notification-text">{toast.message}</span>
                    </button>
                  ))}
                </div>,
                document.body
              )
            : null}

          {confirmationDialog ? (
            <div
              className="inventory-confirm-backdrop"
              role="presentation"
              onClick={closeConfirmationDialog}
            >
              <div
                className={`inventory-confirm-card ${confirmationDialog.tone || "primary"}`}
                role="dialog"
                aria-modal="true"
                aria-labelledby="inventory-add-confirm-title"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="inventory-confirm-head">
                  <span className="inventory-confirm-icon">
                    {confirmationDialog.icon}
                  </span>
                  <div>
                    <h3 id="inventory-add-confirm-title">
                      {confirmationDialog.title}
                    </h3>
                    <p>{confirmationDialog.message}</p>
                  </div>
                </div>

                <div className="inventory-confirm-actions">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={closeConfirmationDialog}
                    disabled={loading}
                  >
                    <FaTimes className="btn-icon" />
                    {confirmationDialog.cancelLabel || "Cancel"}
                  </button>
                  <button
                    type="button"
                    className={`btn ${
                      confirmationDialog.tone === "danger"
                        ? "btn-danger"
                        : "btn-primary"
                    }`}
                    onClick={confirmDialogAction}
                    disabled={loading}
                  >
                    {confirmationDialog.tone === "danger" ? (
                      <FaTrash className="btn-icon" />
                    ) : (
                      <FaCheck className="btn-icon" />
                    )}
                    {confirmationDialog.confirmLabel || "Confirm"}
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div
            className={`inventory-header ${
              !showForm && !showArchived ? "inventory-header-with-summary" : ""
            }`}
          >
            <div>
              <h1 className="inventory-title">Add Donations to Inventory</h1>
            </div>

            {!showForm && (
              <div className="inventory-header-actions">
                <button
                  className="btn btn-primary"
                  onClick={exportInventoryPdf}
                >
                  <FaFilePdf className="btn-icon" />
                  Export PDF
                </button>

                <button
                  className="btn btn-secondary"
                  onClick={() => {
                    setShowArchived((prev) => !prev);
                    setCurrentPage(1);
                    clearFilters();
                  }}
                >
                  {showArchived ? (
                    <FaUndo className="btn-icon" />
                  ) : (
                    <FaHistory className="btn-icon" />
                  )}
                  {showArchived ? "Back to Active Donations" : "View Archived Donations"}
                </button>

                <button
                  className="btn btn-primary"
                  onClick={() => {
                    setEditingItemId("");
                    setShowForm(true);
                  }}
                >
                  <FaPlus className="btn-icon" />
                  Add {donationType === "goods" ? "Goods" : "Monetary"} Donation
                </button>
              </div>
            )}

            {!showForm && !showArchived && (
              <div className="summary-grid inventory-header-summary">
                <div className="summary-card muted">
                  <div className="summary-card-top">
                    <p className="summary-label">Total Inventory Records</p>
                    <span className="summary-icon"><FaArchive /></span>
                  </div>
                  <h3 className="summary-value">{summary.totalItems}</h3>
                  <span className="summary-note">All donation entries</span>
                </div>

                <div className="summary-card success">
                  <div className="summary-card-top">
                    <p className="summary-label">Goods Donations</p>
                    <span className="summary-icon"><FaBoxes /></span>
                  </div>
                  <h3 className="summary-value">{summary.totalGoodsEntries}</h3>
                  <span className="summary-note">
                    Total quantity: {summary.totalGoodsQuantity}
                  </span>
                </div>

                <div className="summary-card info">
                  <div className="summary-card-top">
                    <p className="summary-label">Monetary Donations</p>
                    <span className="summary-icon"><FaMoneyBillWave /></span>
                  </div>
                  <h3 className="summary-value">{summary.totalMonetaryEntries}</h3>
                  <span className="summary-note">
                    Total amount: PHP {summary.totalMonetaryAmount.toLocaleString()}
                  </span>
                </div>

                <div className="summary-card accent">
                  <div className="summary-card-top">
                    <p className="summary-label">Recent Donations</p>
                    <span className="summary-icon"><FaBell /></span>
                  </div>
                  <h3 className="summary-value">{summary.recentDonationsCount}</h3>
                  <span className="summary-note">Last 7 days</span>
                </div>
              </div>
            )}
          </div>

          {showForm ? (
            <div className="donation-modal-shell">
              <div className="donation-modal-card inventory-card">
                <div className="donation-modal-header">
                  <div className="donation-modal-heading">
                    <h2 className="section-title">{getFormTitle()}</h2>
                    <div className="donation-form-meta">
                      <span>
                        {donationType === "goods" ? "Goods intake" : "Financial intake"}
                      </span>
                      <span>{editingItemId ? "Editing record" : "New record"}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    className="btn btn-secondary modal-back-btn"
                    onClick={() => {
                      setShowForm(false);
                      resetForm();
                    }}
                  >
                    <FaUndo className="btn-icon" />
                    Back
                  </button>
                </div>

                {!editingItemId && (
                  <div className="donation-type-tabs">
                    <button
                      type="button"
                      className={`donation-type-tab ${
                        donationType === "goods" ? "active" : ""
                      }`}
                      onClick={() => setDonationType("goods")}
                    >
                      <FaBoxes className="btn-icon" />
                      Goods
                    </button>
                    <button
                      type="button"
                      className={`donation-type-tab ${
                        donationType === "monetary" ? "active" : ""
                      }`}
                      onClick={() => setDonationType("monetary")}
                    >
                      <FaMoneyBillWave className="btn-icon" />
                      Monetary
                    </button>
                  </div>
                )}

                <form onSubmit={handleSubmit} className="donation-form">
                  <div className="donation-form-section">
                    <div className="donation-section-heading">
                      <span className="donation-section-icon">
                        {donationType === "goods" ? <FaBoxes /> : <FaMoneyBillWave />}
                      </span>
                      <h3>Donation Details</h3>
                      <p>Main information for this donation record.</p>
                    </div>

                    <div className="donation-form-grid">
                      <div
                        className={`donation-form-group ${
                          donationType === "goods" ? "span-2" : ""
                        }`}
                      >
                        <label htmlFor="name">
                          {getPrimaryFieldLabel()} <span>*</span>
                        </label>
                        <input
                          id="name"
                          type="text"
                          name="name"
                          placeholder={getPrimaryFieldPlaceholder()}
                          value={form.name}
                          onChange={handleChange}
                          className={`input ${formErrors.name ? "input-error" : ""}`}
                        />
                        {formErrors.name && (
                          <span className="error-text">{formErrors.name}</span>
                        )}
                      </div>

                      {donationType === "goods" && (
                        <>
                          <div className="donation-form-group">
                            <label htmlFor="category">
                              Category <span>*</span>
                            </label>
                            <select
                              id="category"
                              name="category"
                              value={form.category}
                              onChange={handleChange}
                              className={`input ${
                                formErrors.category ? "input-error" : ""
                              }`}
                              disabled={categoryLoading}
                            >
                              <option value="">
                                {categoryLoading
                                  ? "Loading categories..."
                                  : "Select category"}
                              </option>

                              {selectableCategoryOptions.map((category) => (
                                <option key={category} value={category}>
                                  {formatCategory(category)}
                                </option>
                              ))}

                              <option value={CUSTOM_CATEGORY_VALUE}>
                                Other / Custom Category
                              </option>
                            </select>
                            {formErrors.category && (
                              <span className="error-text">{formErrors.category}</span>
                            )}
                          </div>

                          {form.category === CUSTOM_CATEGORY_VALUE && (
                            <div className="donation-form-group">
                              <label htmlFor="customCategory">
                                Custom Category <span>*</span>
                              </label>
                              <input
                                id="customCategory"
                                type="text"
                                name="customCategory"
                                placeholder="e.g. medicine, water, shelter kits"
                                value={form.customCategory}
                                onChange={handleChange}
                                className={`input ${
                                  formErrors.customCategory ? "input-error" : ""
                                }`}
                              />
                              {formErrors.customCategory && (
                                <span className="error-text">
                                  {formErrors.customCategory}
                                </span>
                              )}
                            </div>
                          )}

                          <div className="donation-form-group">
                            <label htmlFor="quantity">
                              Quantity <span>*</span>
                            </label>
                            <input
                              id="quantity"
                              type="number"
                              min="0"
                              step="1"
                              name="quantity"
                              placeholder="e.g. 50"
                              value={getNumberInputValue(form.quantity)}
                              onChange={handleChange}
                              className={`input ${
                                formErrors.quantity ? "input-error" : ""
                              }`}
                            />
                            {formErrors.quantity && (
                              <span className="error-text">
                                {formErrors.quantity}
                              </span>
                            )}
                          </div>

                          <div className="donation-form-group">
                            <label htmlFor="unit">
                              Unit <span>*</span>
                            </label>
                            <input
                              id="unit"
                              type="text"
                              name="unit"
                              placeholder="e.g. sacks, boxes, packs, pcs"
                              value={form.unit}
                              onChange={handleChange}
                              className={`input ${formErrors.unit ? "input-error" : ""}`}
                            />
                            {formErrors.unit && (
                              <span className="error-text">{formErrors.unit}</span>
                            )}
                          </div>

                          <div className="donation-form-group">
                            <label htmlFor="expirationDate">
                              Expiration Date {isExpiryRequired ? <span>*</span> : null}
                            </label>
                            <input
                              id="expirationDate"
                              type="date"
                              name="expirationDate"
                              value={form.expirationDate}
                              onChange={handleChange}
                              className={`input ${
                                formErrors.expirationDate ? "input-error" : ""
                              }`}
                            />
                            {formErrors.expirationDate && (
                              <span className="error-text">
                                {formErrors.expirationDate}
                              </span>
                            )}
                          </div>
                        </>
                      )}

                      {donationType === "monetary" && (
                        <div className="donation-form-group">
                          <label htmlFor="amount">
                            Amount <span>*</span>
                          </label>
                          <input
                            id="amount"
                            type="number"
                            min="0"
                            step="0.01"
                            name="amount"
                            placeholder="e.g. 10000"
                            value={getNumberInputValue(form.amount)}
                            onChange={handleChange}
                            className={`input ${
                              formErrors.amount ? "input-error" : ""
                            }`}
                          />
                          {formErrors.amount && (
                            <span className="error-text">{formErrors.amount}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="donation-form-section">
                    <div className="donation-section-heading">
                      <span className="donation-section-icon"><FaFileInvoiceDollar /></span>
                      <h3>Source Information</h3>
                      <p>
                        {donationType === "monetary"
                          ? "Classify the source type for this monetary donation."
                          : "Where the donation came from or who endorsed it."}
                      </p>
                    </div>

                    <div className="donation-form-grid">
                      <div className="donation-form-group">
                        <label htmlFor="sourceType">
                          Source Type <span>*</span>
                        </label>
                        <select
                          id="sourceType"
                          name="sourceType"
                          value={form.sourceType}
                          onChange={handleChange}
                          className={`input ${
                            formErrors.sourceType ? "input-error" : ""
                          }`}
                        >
                          <option value="external">External</option>
                          <option value="government">Government</option>
                          <option value="internal">Internal</option>
                        </select>
                        {formErrors.sourceType && (
                          <span className="error-text">{formErrors.sourceType}</span>
                        )}
                      </div>

                      {donationType === "goods" && (
                        <div className="donation-form-group">
                          <label htmlFor="sourceName">Source Name</label>
                          <input
                            id="sourceName"
                            type="text"
                            name="sourceName"
                            placeholder={getSourceNamePlaceholder()}
                            value={form.sourceName}
                            onChange={handleChange}
                            className="input"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="donation-form-section">
                    <div className="donation-section-heading">
                      <span className="donation-section-icon"><FaUpload /></span>
                      <h3>Additional Information</h3>
                      <p>Attach files and add supporting notes.</p>
                    </div>

                    <div className="donation-form-grid">
                      <div className="donation-form-group full-width">
                        <label htmlFor="description">Description / Notes</label>
                        <textarea
                          id="description"
                          name="description"
                          placeholder={
                            donationType === "goods"
                              ? "Add notes about packaging, expiry, condition, delivery details, or stock intake remarks..."
                              : "Add notes about transaction reference, intended use, receipt details, or supporting remarks..."
                          }
                          value={form.description}
                          onChange={handleChange}
                          className="textarea"
                          rows="4"
                        />
                      </div>
                                            <div className="donation-form-group full-width">
                        <label htmlFor="proofFiles">Validation</label>

                        <div
                          className="donation-upload-box"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <input
                            id="proofFiles"
                            ref={fileInputRef}
                            type="file"
                            multiple
                            onChange={handleFileChange}
                            className="file-input"
                          />

                          <div className="donation-upload-content">
                            <p className="donation-upload-title">
                              Click to upload supporting files
                            </p>
                            <span className="donation-upload-subtext">
                              {getProofLabel()}
                            </span>
                            <span className="donation-upload-count">
                              {proofFiles.length > 0
                                ? `${proofFiles.length} file${
                                    proofFiles.length > 1 ? "s" : ""
                                  } selected`
                                : "No files selected"}
                            </span>
                          </div>
                        </div>

                        {proofFiles.length > 0 && (
                          <div className="donation-selected-files">
                            {proofFiles.map((file, index) => (
                              <div key={`${file.name}-${index}`} className="donation-file-chip">
                                <span className="donation-file-chip-name">{file.name}</span>
                                <span className="donation-file-chip-size">
                                  {(file.size / 1024).toFixed(1)} KB
                                </span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="donation-form-actions">
                    <button
                      type="button"
                      className="btn btn-secondary"
                      onClick={() => {
                        setShowForm(false);
                        resetForm();
                      }}
                    >
                      <FaTimes className="btn-icon" />
                      Cancel
                    </button>

                    <button
                      type="button"
                      className="btn btn-outline"
                      onClick={resetForm}
                      disabled={loading}
                    >
                      <FaRedo className="btn-icon" />
                      Reset
                    </button>

                    <button type="submit" disabled={loading} className="btn btn-primary">
                      <FaSave className="btn-icon" />
                      {loading
                        ? "Saving..."
                        : editingItemId
                        ? "Update Record"
                        : donationType === "goods"
                        ? "Save Goods"
                        : "Save Monetary"}
                    </button>
                  </div>
                </form>
              </div>
            </div>
          ) : (
            <>
              <div className="inventory-card">
                <div className="type-switch">
                  <button
                    className={`type-tab ${donationType === "goods" ? "active" : ""}`}
                    onClick={() => {
                      setDonationType("goods");
                      setCurrentPage(1);
                      clearFilters();
                    }}
                  >
                    <FaBoxes className="btn-icon" />
                    Goods Donations
                  </button>
                  <button
                    className={`type-tab ${
                      donationType === "monetary" ? "active" : ""
                    }`}
                    onClick={() => {
                      setDonationType("monetary");
                      setCurrentPage(1);
                      clearFilters();
                    }}
                  >
                    <FaMoneyBillWave className="btn-icon" />
                    Monetary Donations
                  </button>
                </div>
              </div>

              <div className="inventory-card">
                <div className="section-header compact">
                  <div>
                    <h2 className="section-title">
                      {showArchived
                        ? donationType === "goods"
                          ? "Archived Goods Donations"
                          : "Archived Monetary Donations"
                        : donationType === "goods"
                        ? "Goods Donations"
                        : "Monetary Donations"}
                    </h2>
                  </div>
                </div>

                <div className="filter-toolbar inventory-filter-toolbar-5">
                  <div className="filter-group search-group">
                    <label>Search</label>
                    <input
                      type="text"
                      name="search"
                      placeholder={
                        donationType === "goods"
                          ? "Search item name, category, notes, source..."
                          : "Search donor, notes, source..."
                      }
                      value={filters.search}
                      onChange={handleFilterChange}
                      className="input"
                    />
                  </div>

                  {donationType === "goods" && (
                    <div className="filter-group">
                      <label>Category</label>
                      <select
                        name="category"
                        value={filters.category}
                        onChange={handleFilterChange}
                        className="input"
                      >
                        <option value="">All Categories</option>
                        {categories.map((category, index) => (
                          <option key={index} value={category}>
                            {formatCategory(category)}
                          </option>
                        ))}
                      </select>
                    </div>
                  )}

                  {donationType === "goods" && (
                    <div className="filter-group">
                      <label>Expiry Status</label>
                      <select
                        name="expiryStatus"
                        value={filters.expiryStatus}
                        onChange={handleFilterChange}
                        className="input"
                      >
                        <option value="">All</option>
                        <option value="expired">Expired</option>
                        <option value="soon">Expiring Soon</option>
                        <option value="ok">Not expiring</option>
                        <option value="none">No Expiry</option>
                      </select>
                    </div>
                  )}

                  <div className="filter-group">
                    <label>Added By</label>
                    <select
                      name="addedBy"
                      value={filters.addedBy}
                      onChange={handleFilterChange}
                      className="input"
                    >
                      <option value="">All Users</option>
                      {addedByOptions.map((user, index) => (
                        <option key={index} value={user}>
                          {user}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="filter-group">
                    <label>Date</label>
                    <input
                      type="date"
                      name="date"
                      value={filters.date}
                      onChange={handleFilterChange}
                      className="input"
                    />
                  </div>

                  <div className="filter-actions">
                    <button className="btn btn-secondary" onClick={clearFilters}>
                      <FaTimes className="btn-icon" />
                      Clear Filters
                    </button>
                  </div>
                </div>

                <div className="table-topbar">
                  <div className="table-meta">
                    <span>
                      Showing <strong>{paginatedItems.length}</strong> of{" "}
                      <strong>{sortedItems.length}</strong> filtered record(s)
                    </span>
                  </div>

                  <div className="rows-control">
                    <label>Rows per page</label>
                    <select
                      value={rowsPerPage}
                      onChange={(e) => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                      }}
                      className="rows-select"
                    >
                      <option value={5}>5</option>
                      <option value={10}>10</option>
                      <option value={20}>20</option>
                      <option value={50}>50</option>
                    </select>
                  </div>
                </div>

                <div className="table-wrapper">
                  <table className="inventory-table">
                    <thead>
                      <tr>
                        <th onClick={() => handleSort("name")} className="sortable">
                          {donationType === "goods" ? "Item Name" : "Name / Donor"}{" "}
                          <span>{sortArrow("name")}</span>
                        </th>

                        {donationType === "goods" && (
                          <th
                            onClick={() => handleSort("category")}
                            className="sortable"
                          >
                            Category <span>{sortArrow("category")}</span>
                          </th>
                        )}

                        <th onClick={() => handleSort("quantity")} className="sortable">
                          {donationType === "goods" ? "Quantity" : "Amount"}{" "}
                          <span>{sortArrow("quantity")}</span>
                        </th>

                        {donationType === "goods" && <th>Unit</th>}

                        {donationType === "goods" && (
                          <th
                            onClick={() => handleSort("expirationDate")}
                            className="sortable"
                          >
                            Expiration <span>{sortArrow("expirationDate")}</span>
                          </th>
                        )}

                        <th>Source</th>
                        <th>Description</th>
                        <th>Files</th>

                        <th onClick={() => handleSort("addedBy")} className="sortable">
                          Added By <span>{sortArrow("addedBy")}</span>
                        </th>

                        <th
                          onClick={() => handleSort("createdAt")}
                          className="sortable"
                        >
                          Created <span>{sortArrow("createdAt")}</span>
                        </th>

                        <th>Actions</th>
                      </tr>
                    </thead>

                    <tbody>
                      {fetching && !showArchived ? (
                        <tr>
                          <td colSpan={tableColSpan}>
                            <div className="table-empty">
                              <div className="spinner"></div>
                              <p>Loading inventory records...</p>
                            </div>
                          </td>
                        </tr>
                      ) : paginatedItems.length === 0 ? (
                        <tr>
                          <td colSpan={tableColSpan}>
                            <div className="table-empty">
                              <h4>No items found</h4>
                              <p>
                                {sortedItems.length === 0
                                  ? showArchived
                                    ? "There are no archived donation records for this section yet."
                                    : "There are no donation records available for this section yet."
                                  : "No records matched your current filters. Try adjusting your search or filters."}
                              </p>
                            </div>
                          </td>
                        </tr>
                      ) : (
                        paginatedItems.map((item) => (
                          <tr key={item._id}>
                            <td>
                              <div className="cell-main">{item.name || "-"}</div>
                            </td>

                            {donationType === "goods" && (
                              <td>
                                <span className="badge badge-category">
                                  {formatCategory(item.category)}
                                </span>
                              </td>
                            )}

                            <td className="quantity-cell">
                              {donationType === "monetary"
                                ? `PHP ${Number(item.amount || 0).toLocaleString()}`
                                : Number(item.quantity || 0).toLocaleString()}
                            </td>

                            {donationType === "goods" && <td>{item.unit || "-"}</td>}

                            {donationType === "goods" && (
                              <td>
                                <div className="expiry-cell-stack">
                                  <span>{formatExpiryDate(item.expirationDate)}</span>
                                  {getExpiryBadgeLabel(item) ? (
                                    <span className={`badge ${getExpiryBadgeClass(item)}`}>
                                      {getExpiryBadgeLabel(item)}
                                    </span>
                                  ) : null}
                                </div>
                              </td>
                            )}

                            <td>
                              <div className="source-cell">
                                <strong>{item.sourceType || "-"}</strong>
                                {donationType === "goods" ? (
                                  <small>{item.sourceName || "No source name"}</small>
                                ) : null}
                              </div>
                            </td>

                            <td>
                              <div className="description-cell" title={item.description || ""}>
                                {item.description || "-"}
                              </div>
                            </td>

                            <td>
                              {item.proofFiles && item.proofFiles.length > 0 ? (
                                <div className="proof-list">
                                  {item.proofFiles.map((file, idx) => (
                                    <a
                                      key={idx}
                                      href={`${BASE_URL}/uploads/proofs/${file}`}
                                      target="_blank"
                                      rel="noreferrer"
                                      className="file-link"
                                    >
                                      View File {idx + 1}
                                    </a>
                                  ))}
                                </div>
                              ) : (
                                <span className="muted-text">No files</span>
                              )}
                            </td>

                            <td>{item.addedBy || "-"}</td>

                            <td>
                              <div className="date-cell">
                                <span>{formatShortDate(item.createdAt)}</span>
                                <small>{formatDate(item.createdAt)}</small>
                              </div>
                            </td>

                            <td>
                              {showArchived ? (
                                <div className="row-action-stack">
                                  <button
                                    className="btn btn-secondary btn-sm"
                                    onClick={() => handleUnarchive(item._id, item.name)}
                                  >
                                    <FaUndo className="btn-icon" />
                                    Unarchive
                                  </button>
                                  <button
                                    className="btn btn-delete btn-sm"
                                    onClick={() => handlePermanentDelete(item._id, item.name)}
                                  >
                                    <FaTrash className="btn-icon" />
                                    Delete
                                  </button>
                                </div>
                              ) : (
                                <div className="row-action-stack">
                                  <button
                                    className="btn btn-outline btn-sm"
                                    onClick={() => openEditForm(item)}
                                  >
                                    <FaPen className="btn-icon" />
                                    Edit
                                  </button>
                                  <button
                                    className="btn btn-archive btn-sm"
                                    onClick={() => handleArchive(item._id, item.name)}
                                  >
                                    <FaArchive className="btn-icon" />
                                    Archive
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>

                {!fetching && sortedItems.length > 0 && (
                  <div className="pagination-bar">
                    <button
                      className="pagination-btn"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage((prev) => prev - 1)}
                    >
                      Previous
                    </button>

                    <div className="page-numbers">
                      {pageNumbers.map((page) => (
                        <button
                          key={page}
                          className={`page-number ${currentPage === page ? "active" : ""}`}
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </button>
                      ))}
                    </div>

                    <button
                      className="pagination-btn"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage((prev) => prev + 1)}
                    >
                      Next
                    </button>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </DashboardShell>
  );
};

export default InventoryAdd;
                  
                  
