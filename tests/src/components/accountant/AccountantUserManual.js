import { Link } from "react-router-dom";
import {
  FaBell,
  FaChartBar,
  FaClipboardCheck,
  FaHandHoldingHeart,
  FaMoneyBillWave,
  FaPlusCircle,
} from "react-icons/fa";
import DashboardShell from "../layout/DashboardShell";
import "../css/UserManual.css";

const manualSections = [
  {
    title: "Monetary Relief Requests",
    description: "Review and process barangay requests that contain monetary assistance only.",
    Icon: FaHandHoldingHeart,
    to: "/accountant/relief-lists",
    action: "Open relief requests",
    actions: [
      ["Select a request", "Opens the barangay details, requested amount, and records supporting the monetary request."],
      ["Approve", "Confirms a pending monetary request and sends it to release planning."],
      ["Reject", "Declines the request with a required reason when it cannot be fulfilled."],
      ["Open Release Planner", "Opens the approved monetary request in Inventory to prepare the release."],
    ],
  },
  {
    title: "Monetary Inventory",
    description: "Maintain the available monetary records used for approved assistance releases.",
    Icon: FaMoneyBillWave,
    to: "/accountant/inventory",
    action: "Open monetary inventory",
    actions: [
      ["Monetary view", "Shows the monetary inventory records assigned to the Accountant role."],
      ["Edit", "Updates available amounts, references, descriptions, and supporting records."],
      ["Archive", "Removes an inactive monetary record from active use while preserving history."],
      ["Release Planner", "Sets the approved amount, attaches proof, and submits the monetary release."],
    ],
  },
  {
    title: "Add Monetary Donations",
    description: "Record verified cash donations and funding entries for the monetary inventory.",
    Icon: FaPlusCircle,
    to: "/accountant/inventory/add",
    action: "Add a monetary donation",
    actions: [
      ["Amount", "Records the monetary amount that will be available for authorized releases."],
      ["Reference number", "Stores the transaction or funding reference used for verification."],
      ["Attach proof", "Adds the supporting receipt, document, or image before saving."],
      ["Save", "Creates the active monetary inventory record."],
    ],
  },
  {
    title: "Donation Queue",
    description: "Validate submitted monetary donations before they become available in inventory.",
    Icon: FaClipboardCheck,
    to: "/accountant/donations/queue",
    action: "Open donation queue",
    actions: [
      ["Select a donation", "Displays the donor details, amount, reference number, and uploaded proof."],
      ["Mark Received", "Accepts the verified monetary donation into the inventory workflow."],
      ["Mark Not Received", "Records that the donation was not received and prevents it from entering inventory."],
      ["Filters", "Narrows the queue by review status when processing multiple donations."],
    ],
  },
  {
    title: "Analytics and Notifications",
    description: "Monitor monetary operations and respond to new items that need review.",
    Icon: FaChartBar,
    to: "/accountant/analytics",
    action: "Open analytics",
    actions: [
      ["Analytics tabs", "Review the monetary inventory, donations, and monetary relief-request trends."],
      ["Filters", "Focus the data on the date range or operational detail you need."],
      ["Notifications", "Opens unread alerts from monetary inventory, donations, and relief modules."],
      ["Refresh", "Loads the latest available operational data."],
    ],
  },
];

export default function AccountantUserManual() {
  return (
    <DashboardShell variant="accountant">
      <main className="manual-page">
        <section className="manual-shell" aria-labelledby="accountant-manual-title">
          <header className="manual-hero">
            <div>
              <span className="manual-kicker">ACCOUNTANT WORKSPACE</span>
              <h1 id="accountant-manual-title">Accountant User Manual</h1>
            </div>
            <div className="manual-role-note">
              <FaBell aria-hidden="true" />
              <span>Accountant access</span>
            </div>
          </header>

          <section className="manual-grid" aria-label="Accountant manual sections">
            {manualSections.map(({ title, description, Icon, to, action, actions }) => (
              <article className="manual-card" key={title}>
                <div className="manual-card-icon" aria-hidden="true"><Icon /></div>
                <h2>{title}</h2>
                <p>{description}</p>
                <dl className="manual-action-list">
                  {actions.map(([button, explanation]) => (
                    <div key={button}><dt>{button}</dt><dd>{explanation}</dd></div>
                  ))}
                </dl>
                <Link to={to} className="manual-card-link">{action}<span aria-hidden="true">→</span></Link>
              </article>
            ))}
          </section>
        </section>
      </main>
    </DashboardShell>
  );
}
