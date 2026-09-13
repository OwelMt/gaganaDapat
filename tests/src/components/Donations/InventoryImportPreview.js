import { useState } from 'react';
import InventoryRowProofModal from './InventoryRowProofModal';
import { FaBoxes } from 'react-icons/fa';

export default function InventoryImportPreview({ rows, type, disabled, onProofChange }) {
  const [activeId, setActiveId] = useState(null);
  const activeRow = rows.find(row => row.importId === activeId);
  const fields = type === 'goods'
    ? [['name', 'Item Name'], ['category', 'Category'], ['quantity', 'Quantity'], ['unit', 'Unit'], ['expirationDate', 'Expiration Date']]
    : type === 'appliance'
      ? [['name', 'Appliance Name'], ['category', 'Category'], ['quantity', 'Quantity'], ['condition', 'Condition'], ['usageDuration', 'Usage Duration']]
      : [['name', 'Donor Name'], ['amount', 'Amount'], ['referenceNumber', 'Reference Number']];
  const columns = [...fields, ['sourceType', 'Provider'], ['sourceName', 'Provider Name'], ['description', 'Notes']];
  return (
    <div className="donation-form-section donation-batch-preview">
      <div className="donation-section-heading">
        <span className="donation-section-icon"><FaBoxes /></span>
        <h3>Imported Donations</h3>
        <p>Review the rows below, attach proofs to each row, then click Save. To change a row, update your spreadsheet and import it again.</p>
      </div>
      <div className="donation-batch-table-scroll">
        <table className="inventory-table" aria-label="Imported donations">
          <thead><tr><th>Proofs</th><th>Excel Row</th>{columns.map(([key, label]) => <th key={key}>{label}</th>)}</tr></thead>
          <tbody>{rows.map((row) => (
            <tr key={row.importId}>
              <td><button type="button" className="btn btn-outline" disabled={disabled} aria-label={`Attach proofs for ${row.name}, row ${row.importRowNumber}`} onClick={() => setActiveId(row.importId)}>Attach proofs</button><small className="inventory-row-proof-status">{Number(Boolean(row.proofDocument)) + Number(Boolean(row.proofImage))}/2 attached</small></td>
              <td>{row.importRowNumber}</td>
              {columns.map(([key]) => <td key={key}>{key === 'sourceType' && row[key] === 'external' ? 'Donated' : row[key] || '-'}</td>)}
            </tr>
          ))}</tbody>
        </table>
      </div>
      {activeRow && !disabled && <InventoryRowProofModal row={activeRow} onChange={onProofChange} onClose={() => setActiveId(null)} />}
    </div>
  );
}
