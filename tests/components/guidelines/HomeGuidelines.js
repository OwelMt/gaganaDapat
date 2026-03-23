import React, { useEffect, useState } from "react";
import axios from "axios";

export default function GuidelinesScreen() {
  const [guidelines, setGuidelines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [files, setFiles] = useState([]);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("general");
  const [status, setStatus] = useState("draft");
  const [priorityLevel, setPriorityLevel] = useState("medium");

  // UPDATE STATES
  const [editingGuideline, setEditingGuideline] = useState(null);
  const [editTitle, setEditTitle] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editStatus, setEditStatus] = useState("");
  const [editPriority, setEditPriority] = useState("");
  const [editFiles, setEditFiles] = useState([]);

  const BASE_URL = "http://localhost:8000/api/guidelines/";

  useEffect(() => {
    fetchGuidelines();
  }, []);

  const fetchGuidelines = async () => {
    try {
      const response = await axios.get(BASE_URL);
      setGuidelines(response.data);
    } catch (error) {
      console.error(error.message);
    } finally {
      setLoading(false);
    }
  };

  const pickFile = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setFiles(selectedFiles);
  };

  const pickEditFile = (event) => {
    const selectedFiles = Array.from(event.target.files);
    setEditFiles(selectedFiles);
  };

  const createGuideline = async () => {
    try {
      const formData = new FormData();

      formData.append("title", title);
      formData.append("description", description);
      formData.append("category", category);
      formData.append("status", status);
      formData.append("priorityLevel", priorityLevel);
      formData.append("createdBy", "65f123456789abcdef123456");

      files.forEach((file) => formData.append("attachments", file));

      const response = await axios.post(BASE_URL, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setGuidelines([response.data, ...guidelines]);
      alert("Guideline created successfully!");

      setFiles([]);
      setTitle("");
      setDescription("");
    } catch (error) {
      console.log(error.response?.data || error.message);
    }
  };

  const updateGuideline = async () => {
    try {
      const formData = new FormData();

      formData.append("title", editTitle);
      formData.append("description", editDescription);
      formData.append("category", editCategory);
      formData.append("status", editStatus);
      formData.append("priorityLevel", editPriority);

      editFiles.forEach((file) => formData.append("attachments", file));

      const response = await axios.put(
        `${BASE_URL}${editingGuideline._id}`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      setGuidelines((prev) =>
        prev.map((g) => (g._id === editingGuideline._id ? response.data : g))
      );

      alert("Guideline updated successfully!");
      setEditingGuideline(null);
      setEditFiles([]);
    } catch (error) {
      console.error(error.response?.data || error.message);
      alert("Failed to update guideline.");
    }
  };

  const deleteGuideline = async (id) => {
    const confirmDelete = window.confirm(
      "Are you sure you want to delete this guideline?"
    );
    if (!confirmDelete) return;

    try {
      await axios.delete(`${BASE_URL}${id}`);
      setGuidelines((prev) => prev.filter((item) => item._id !== id));
      alert("Guideline deleted successfully!");
    } catch (error) {
      console.error(error.response?.data || error.message);
      alert("Failed to delete guideline.");
    }
  };

  if (loading) {
    return <div style={{ textAlign: "center", marginTop: 50 }}>Loading...</div>;
  }

  return (
    <div style={styles.container}>
      <h2>Create Guideline</h2>

      <input
        style={styles.input}
        placeholder="Title"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
      />

      <textarea
        style={{ ...styles.input, height: 80 }}
        placeholder="Description"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
      />

      <label style={styles.label}>Category</label>
      {["earthquake", "flood", "typhoon", "general"].map((item) => (
        <button
          key={item}
          onClick={() => setCategory(item)}
          style={{
            ...styles.option,
            ...(category === item ? styles.selectedOption : {}),
          }}
        >
          {item}
        </button>
      ))}

      <label style={styles.label}>Status</label>
      {["draft", "published", "archived"].map((item) => (
        <button
          key={item}
          onClick={() => setStatus(item)}
          style={{
            ...styles.option,
            ...(status === item ? styles.selectedOption : {}),
          }}
        >
          {item}
        </button>
      ))}

      <label style={styles.label}>Priority Level</label>
      {["low", "medium", "high", "critical"].map((item) => (
        <button
          key={item}
          onClick={() => setPriorityLevel(item)}
          style={{
            ...styles.option,
            ...(priorityLevel === item ? styles.selectedOption : {}),
          }}
        >
          {item}
        </button>
      ))}

      <input type="file" multiple onChange={pickFile} style={{ marginTop: 10 }} />

      {files.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <strong>Selected Files:</strong>
          {files.map((file, index) => (
            <div key={index}>• {file.name}</div>
          ))}
        </div>
      )}

      <button
        style={{ ...styles.uploadButton, backgroundColor: "#dc3545" }}
        onClick={() => setFiles([])}
      >
        Clear Files
      </button>

      <button style={styles.button} onClick={createGuideline}>
        Create Guideline
      </button>

      <h2>All Guidelines</h2>

      {guidelines.map((item) => (
        <div key={item._id} style={styles.card}>
          <div style={styles.cardHeader}>
            <button
              style={styles.updateButton}
              onClick={() => {
                setEditingGuideline(item);
                setEditTitle(item.title);
                setEditDescription(item.description);
                setEditCategory(item.category);
                setEditStatus(item.status);
                setEditPriority(item.priorityLevel);
                setEditFiles([]);
              }}
            >
              Update
            </button>

            <button
              onClick={() => deleteGuideline(item._id)}
              style={styles.deleteButton}
            >
              Delete
            </button>
          </div>

          <h3>{item.title}</h3>
          <p>Category: {item.category}</p>
          <p>Status: {item.status}</p>
          <p>Priority: {item.priorityLevel}</p>
          <p>{item.description}</p>

          {item.attachments?.length > 0 && (
            <div style={{ marginTop: 5 }}>
              <strong>Attachments:</strong>
              {item.attachments.map((file, idx) =>
                file.fileUrl.match(/\.(jpg|jpeg|png|gif)$/i) ? (
                  <div key={idx}>
                    <img
                      src={file.fileUrl}
                      alt=""
                      style={{ width: 100, height: 100, marginTop: 5 }}
                    />
                  </div>
                ) : (
                  <div key={idx}>
                    <a
                      href={file.fileUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{ color: "#007bff", textDecoration: "underline" }}
                    >
                      {file.fileName}
                    </a>
                  </div>
                )
              )}
            </div>
          )}
        </div>
      ))}

      {editingGuideline && (
        <div style={styles.modalOverlay}>
          <div style={styles.modal}>
            <h2>Update Guideline</h2>

            <input
              style={styles.input}
              value={editTitle}
              onChange={(e) => setEditTitle(e.target.value)}
            />

            <textarea
              style={styles.input}
              value={editDescription}
              onChange={(e) => setEditDescription(e.target.value)}
            />

            <label style={styles.label}>Category</label>
            {["earthquake", "flood", "typhoon", "general"].map((item) => (
              <button
                key={item}
                onClick={() => setEditCategory(item)}
                style={{
                  ...styles.option,
                  ...(editCategory === item ? styles.selectedOption : {}),
                }}
              >
                {item}
              </button>
            ))}

            <label style={styles.label}>Status</label>
            {["draft", "published", "archived"].map((item) => (
              <button
                key={item}
                onClick={() => setEditStatus(item)}
                style={{
                  ...styles.option,
                  ...(editStatus === item ? styles.selectedOption : {}),
                }}
              >
                {item}
              </button>
            ))}

            <label style={styles.label}>Priority Level</label>
            {["low", "medium", "high", "critical"].map((item) => (
              <button
                key={item}
                onClick={() => setEditPriority(item)}
                style={{
                  ...styles.option,
                  ...(editPriority === item ? styles.selectedOption : {}),
                }}
              >
                {item}
              </button>
            ))}

            <input
              type="file"
              multiple
              onChange={pickEditFile}
              style={{ marginTop: 10 }}
            />

            {editFiles.length > 0 && (
              <div style={{ marginBottom: 10 }}>
                <strong>Selected Files:</strong>
                {editFiles.map((file, index) => (
                  <div key={index}>• {file.name}</div>
                ))}
              </div>
            )}

            <button style={styles.button} onClick={updateGuideline}>
              Save Update
            </button>

            <button
              style={styles.cancelButton}
              onClick={() => setEditingGuideline(null)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = {
  container: { maxWidth: 600, margin: "auto", padding: 15, fontFamily: "Arial" },
  input: { width: "100%", border: "1px solid #ccc", padding: 10, borderRadius: 8, marginBottom: 10 },
  label: { fontWeight: "bold", marginTop: 10, display: "block" },
  option: { padding: 8, border: "1px solid #ccc", borderRadius: 6, margin: "3px 3px", cursor: "pointer" },
  selectedOption: { backgroundColor: "#cce5ff", borderColor: "#007bff" },
  button: { backgroundColor: "#007bff", color: "#fff", padding: 12, borderRadius: 8, marginTop: 15, border: "none", cursor: "pointer" },
  uploadButton: { backgroundColor: "#28a745", color: "#fff", padding: 12, borderRadius: 8, marginTop: 10, border: "none", cursor: "pointer" },
  card: { backgroundColor: "#f2f2f2", padding: 15, borderRadius: 10, marginBottom: 10 },
  cardHeader: { display: "flex", justifyContent: "flex-end", gap: 5 },
  updateButton: { backgroundColor: "#ffc107", padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer" },
  deleteButton: { backgroundColor: "#dc3545", color: "#fff", padding: "5px 10px", borderRadius: 6, border: "none", cursor: "pointer" },
  modalOverlay: { position: "fixed", top: 0, left: 0, width: "100%", height: "100%", background: "rgba(0,0,0,0.5)", display: "flex", justifyContent: "center", alignItems: "center" },
  modal: { background: "#fff", padding: 20, borderRadius: 10, width: 400 },
  cancelButton: { backgroundColor: "#6c757d", color: "#fff", padding: 10, borderRadius: 6, border: "none", marginTop: 10, cursor: "pointer" },
};