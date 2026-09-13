import { AccountConfirmModal } from '../auth/accountOverlayUtils';
import '../css/AdminAccounts.css';

export default function ReliefImportValidationModal({ issues = [], onClose }) {
  return (
    <AccountConfirmModal
      open={issues.length > 0}
      title="Check Excel data"
      message="The file was not imported. Correct the following items in Excel and import it again. Your current entries are unchanged."
      confirmLabel="Got it"
      hideCancel
      onConfirm={onClose}
      onClose={onClose}
    >
      <ul style={{ maxHeight: '40vh', overflowY: 'auto', overflowWrap: 'anywhere', paddingLeft: 24 }}>
        {issues.map((issue, index) => <li key={index}>{issue}</li>)}
      </ul>
    </AccountConfirmModal>
  );
}
