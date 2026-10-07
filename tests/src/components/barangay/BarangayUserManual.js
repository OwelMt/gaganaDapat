import { Link } from "react-router-dom";
import {
  FaBell,
  FaClipboardCheck,
  FaFileAlt,
  FaHospital,
  FaMapMarkedAlt,
} from "react-icons/fa";
import DashboardShell from "../layout/DashboardShell";
import "../css/UserManual.css";

const manualSections = [
  {
    title: "Relief Request",
    description: "Create and update the barangay’s official request for disaster assistance.",
    Icon: FaClipboardCheck,
    to: "/barangay/relief-request",
    action: "Open relief request",
    actions: [
      ["Support type", "Choose the food packs, appliances, and/or monetary assistance needed by the barangay."],
      ["Evacuation rows", "Add the affected families, evacuation locations, and quantities that support the request."],
      ["Submit Request", "Sends a completed request to the authorized staff for review."],
      ["Save Changes or Resubmit", "Updates a returned request or sends a rejected request again after corrections."],
    ],
  },
  {
    title: "Request Status and Receipt",
    description: "Follow every submitted request from review through release and completion.",
    Icon: FaFileAlt,
    to: "/barangay/relief-status",
    action: "Open request status",
    actions: [
      ["Status filter", "Find requests that are pending, approved, released, received, or need attention."],
      ["Select a request", "Opens the request details, release information, and current progress."],
      ["Confirm receipt", "Records that the barangay received the released assistance when confirmation is available."],
      ["Export PDF", "Downloads the request or accomplished report when the record is ready."],
    ],
  },
  {
    title: "Evacuation Centers",
    description: "Find verified evacuation locations and their current public information.",
    Icon: FaHospital,
    to: "/barangay/evacuation-centers",
    action: "Open evacuation centers",
    actions: [
      ["Map", "Views the locations of verified evacuation centers in the municipality."],
      ["Search and filters", "Finds a center by name, barangay, or available details."],
      ["Center details", "Shows available capacity, facilities, address, and contact information."],
      ["Use in requests", "Use the verified center details when preparing evacuation rows for relief requests."],
    ],
  },
  {
    title: "Notifications",
    description: "Stay informed when staff review, release, or update a barangay request.",
    Icon: FaBell,
    to: "/barangay/notifications",
    action: "Open notifications",
    actions: [
      ["Unread alerts", "Shows recent updates that require attention from the barangay account."],
      ["Open related record", "Uses an alert to return to the affected relief request or evacuation update."],
      ["Mark as read", "Clears a notification after its update has been reviewed."],
      ["Refresh", "Loads the latest alerts before coordinating with local responders."],
    ],
  },
  {
    title: "Public Safety Map",
    description: "Use municipal location information to prepare local response and evacuation plans.",
    Icon: FaMapMarkedAlt,
    to: "/map",
    action: "Open public safety map",
    actions: [
      ["Map layers", "Views available municipal map information and safety locations."],
      ["Location search", "Finds a barangay, place, or relevant mapped location."],
      ["Evacuation planning", "Uses the displayed locations when deciding where affected families can go."],
      ["Coordinate with DRRMO", "Report missing or outdated public information to the operations team."],
    ],
  },
];

export default function BarangayUserManual() {
  return (
    <DashboardShell variant="barangay">
      <main className="manual-page">
        <section className="manual-shell" aria-labelledby="barangay-manual-title">
          <header className="manual-hero">
            <div>
              <span className="manual-kicker">BARANGAY WORKSPACE</span>
              <h1 id="barangay-manual-title">Barangay User Manual</h1>
            </div>
            <div className="manual-role-note">
              <FaMapMarkedAlt aria-hidden="true" />
              <span>Barangay access</span>
            </div>
          </header>

          <section className="manual-grid" aria-label="Barangay manual sections">
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
