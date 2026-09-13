import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { FaCheck, FaFilePdf, FaImage, FaTimes, FaUpload } from 'react-icons/fa';

export default function InventoryRowProofModal({ row, onChange, onClose }) {
  const dialog = useRef(null);
  const inputRefs = useRef({});
  const [error, setError] = useState('');
  useEffect(() => {
    const previous = document.activeElement;
    dialog.current?.querySelector('button')?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = previousOverflow; previous?.focus(); };
  }, []);
  const select = (event, field) => {
    const files = Array.from(event.target.files || []);
    event.target.value = '';
    if (!files.length) return;
    const file = files[0];
    const allowed = field === 'proofDocument' ? /\.(pdf|doc|docx)$/i : /\.(jpg|jpeg|png|webp)$/i;
    if (files.length !== 1 || !allowed.test(file.name)) {
      setError(field === 'proofDocument' ? 'Choose one PDF, DOC or DOCX document.' : 'Choose one JPG, PNG or WEBP image.');
      return;
    }
    if (file.size > 15 * 1024 * 1024) { setError('Each proof file must be 15 MB or smaller.'); return; }
    setError('');
    onChange(row.importId, field, file);
  };
  const handleKeyDown = (event) => {
    if (event.key === 'Escape') { event.stopPropagation(); onClose(); }
    if (event.key !== 'Tab') return;
    const controls = [...dialog.current.querySelectorAll('button')];
    const first = controls[0]; const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  };
  const slots = [
    ['proofDocument', 'Document proof', 'Select document', '.pdf,.doc,.docx', <FaFilePdf aria-hidden="true" />, 'PDF, DOC or DOCX'],
    ['proofImage', 'Image proof', 'Select image', '.jpg,.jpeg,.png,.webp', <FaImage aria-hidden="true" />, 'JPG, PNG or WEBP'],
  ];
  return createPortal(
    <div className="inventory-add-proof-modal" onClick={onClose}>
      <div className="inventory-row-proof-card" ref={dialog} role="dialog" aria-modal="true" aria-labelledby="row-proof-title" onKeyDown={handleKeyDown} onClick={event => event.stopPropagation()}>
        <div className="inventory-row-proof-head">
          <div>
            <h3 id="row-proof-title">Upload proofs for {row.name}</h3>
            <p>Attach the required files for this imported donation row.</p>
          </div>
          <button type="button" className="inventory-row-proof-close" onClick={onClose} aria-label="Close proof upload modal">
            <FaTimes aria-hidden="true" />
          </button>
        </div>
        <div className="inventory-row-proof-body">
          <div className="inventory-row-proof-note">
            <strong>Excel row {row.importRowNumber}</strong>
            <span>Exactly one document and one image, up to 15 MB each.</span>
          </div>
          <div className="inventory-row-proof-grid">
            {slots.map(([field, label, action, accept, icon, hint]) => (
              <div className="inventory-row-proof-slot" key={field}>
                <div className="inventory-row-proof-slot-icon">{icon}</div>
                <div className="inventory-row-proof-slot-main">
                  <label htmlFor={`row-${field}`}>{label}</label>
                  <input
                    ref={(node) => { inputRefs.current[field] = node; }}
                    id={`row-${field}`}
                    className="inventory-row-proof-native-input"
                    type="file"
                    accept={accept}
                    onChange={event => select(event, field)}
                    tabIndex="-1"
                  />
                  <span className="inventory-row-proof-hint">{hint}</span>
                  <div className="inventory-row-proof-file">
                    <span className={row[field] ? 'inventory-row-proof-file-name' : 'inventory-row-proof-empty-name'}>
                      {row[field]?.name || 'No file selected'}
                    </span>
                    {row[field] && <span className="inventory-row-proof-ready"><FaCheck aria-hidden="true" /> Attached</span>}
                  </div>
                </div>
                <div className="inventory-row-proof-slot-actions">
                  <button type="button" className="btn btn-outline" onClick={() => inputRefs.current[field]?.click()}>
                    <FaUpload className="btn-icon" aria-hidden="true" />
                    {action}
                  </button>
                  {row[field] && (
                    <button type="button" className="btn btn-outline inventory-row-proof-remove" onClick={() => onChange(row.importId, field, null)}>
                      <FaTimes className="btn-icon" aria-hidden="true" />
                      Remove {label.toLowerCase()}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
          {error && <p className="error-text inventory-row-proof-error" role="alert">{error}</p>}
        </div>
        <div className="inventory-row-proof-actions">
          <button type="button" className="btn btn-outline" onClick={onClose}>
            <FaTimes className="btn-icon" aria-hidden="true" />
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={onClose}>
            <FaCheck className="btn-icon" aria-hidden="true" />
            Done
          </button>
        </div>
      </div>
    </div>, document.body
  );
}
