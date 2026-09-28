import { API_BASE_URL } from "../../config/api";
const buildInventoryProofPreviewUrl = (url = "") =>
  `${API_BASE_URL}/api/inventory/proof-preview?url=${encodeURIComponent(url)}`;


export default function ProofDocumentPreview({ candidates = [], title = "Proof document" }) {
  const candidate = candidates.find(Boolean) || "";

  if (!candidate) {
    return (
      <div className="proof-document-preview-state">
        <strong>Document preview unavailable</strong>
        <p>No proof file URL was found for this document.</p>
      </div>
    );
  }

  return <iframe title={title} src={buildInventoryProofPreviewUrl(candidate)} />;
}
