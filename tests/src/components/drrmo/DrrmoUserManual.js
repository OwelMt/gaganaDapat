import { Link } from "react-router-dom";
import {
  FaBell,
  FaBookOpen,
  FaBoxOpen,
  FaBullhorn,
  FaChartBar,
  FaClipboardCheck,
  FaCube,
  FaHospital,
  FaInfoCircle,
  FaPlusCircle,
} from "react-icons/fa";
import DashboardShell from "../layout/DashboardShell";
import "../css/UserManual.css";

const manualSections = [
  {
    title: "Relief Requests",
    description: "Review and process barangay requests for food packs and appliances.",
    Icon: FaClipboardCheck,
    to: "/drrmo/relief-lists",
    action: "Open relief requests",
    actions: [
      ["Select a request", "Opens the barangay details, evacuation rows, requested food packs, and appliance needs."],
      ["Approve", "Confirms a pending food-pack or appliance request and sends it to release planning."],
      ["Reject", "Declines a request with a required reason when the request cannot be fulfilled."],
      ["Open Release Planner", "Opens the approved request in Inventory to prepare the food-pack or appliance release."],
    ],
  },
  {
    title: "Inventory and Releases",
    description: "Manage goods and appliances used for DRRMO relief operations.",
    Icon: FaBoxOpen,
    to: "/drrmo/inventory",
    action: "Open inventory",
    actions: [
      ["Goods and Appliances", "Switches between the inventory types assigned to DRRMO."],
      ["Edit", "Updates item details, availability, quantities, and supporting records."],
      ["Food Pack Templates", "Builds reusable food pack contents from available goods."],
      ["Release Planner", "Selects food packs or appliances, attaches proof, and submits a release."],
    ],
  },
  {
    title: "Add Donations",
    description: "Record goods and appliance donations that are ready to enter operational inventory.",
    Icon: FaPlusCircle,
    to: "/drrmo/inventory/add",
    action: "Add a donation",
    actions: [
      ["Donation type", "Choose Goods or Appliance for the donation being recorded."],
      ["Item details", "Enter the item name, category, quantity, source, and condition where applicable."],
      ["Attach proof", "Add supporting images or documents before saving the inventory entry."],
      ["Save", "Creates the active inventory record for future relief releases."],
    ],
  },
  {
    title: "Evacuation Centers",
    description: "Maintain verified evacuation locations used during response operations.",
    Icon: FaHospital,
    to: "/drrmo/evacuation-centers",
    action: "Open evacuation centers",
    actions: [
      ["Add center", "Creates a center with its location, capacity, facilities, and contact details."],
      ["Edit", "Updates operational information when a center’s details change."],
      ["Map and coordinates", "Sets the location shown to barangays and the public map."],
      ["Archive", "Removes an unavailable center from active use while keeping its history."],
    ],
  },
  {
    title: "Digital Twin",
    description: "Monitor water-level readings and the linked Unity digital-twin environment.",
    Icon: FaCube,
    to: "/drrmo/digital-twin",
    action: "Open Digital Twin",
    actions: [
      ["Camera selector", "Changes the monitored camera source and loads its current readings."],
      ["Current, warning, and danger", "Compares the current water level against the warning and danger thresholds."],
      ["Daily information", "Reviews recorded water-level information for the selected camera."],
      ["Refresh", "Loads the latest available monitoring data."],
    ],
  },
  {
    title: "Incident Reports",
    description: "Review and manage reported incidents that need DRRMO action or public follow-up.",
    Icon: FaInfoCircle,
    to: "/drrmo/incident-report",
    action: "Open incident reports",
    actions: [
      ["Select an incident", "Opens the submitted report, location, evidence, and current status."],
      ["Update status", "Marks the incident as being handled, resolved, or requiring follow-up."],
      ["Review evidence", "Checks submitted photos and details before recording an official action."],
      ["Filters", "Narrow the report list by status, type, barangay, or priority."],
    ],
  },
  {
    title: "Announcements",
    description: "Publish official operational notices for residents and barangays.",
    Icon: FaBullhorn,
    to: "/drrmo/announcements",
    action: "Open announcements",
    actions: [
      ["Create announcement", "Starts a notice with its title, message, priority, and public visibility."],
      ["Publish", "Makes a completed notice visible on the public portal."],
      ["Edit", "Updates a notice when new official information is available."],
      ["Archive", "Removes an expired notice from the active public feed."],
    ],
  },
  {
    title: "Guidelines",
    description: "Maintain preparedness and safety guidance for the public portal.",
    Icon: FaBookOpen,
    to: "/drrmo/guidelines",
    action: "Open guidelines",
    actions: [
      ["Create guideline", "Adds a preparedness, response, or recovery guide."],
      ["Publish", "Makes the completed guide available to residents."],
      ["Edit", "Updates instructions when official guidance changes."],
      ["Archive or restore", "Hides outdated guidance or restores it when it becomes relevant."],
    ],
  },
  {
    title: "Analytics and Notifications",
    description: "Use the operational overview and alerts to prioritize response work.",
    Icon: FaChartBar,
    to: "/drrmo/analytics",
    action: "Open analytics",
    actions: [
      ["Analytics tabs", "Review inventory, relief requests, incident reports, and evacuation trends."],
      ["Filters", "Focus the dashboard on the date range or operational information you need."],
      ["Notifications", "Open unread alerts from relief, inventory, evacuation, incident, and guideline modules."],
      ["Refresh", "Loads the latest data before making an operational decision."],
    ],
  },
];

export default function DrrmoUserManual() {
  return (
    <DashboardShell variant="drrmo">
      <main className="manual-page">
        <section className="manual-shell" aria-labelledby="drrmo-manual-title">
          <header className="manual-hero">
            <div>
              <span className="manual-kicker">DRRMO OPERATIONS</span>
              <h1 id="drrmo-manual-title">DRRMO User Manual</h1>
            </div>
            <div className="manual-role-note">
              <FaBell aria-hidden="true" />
              <span>DRRMO access</span>
            </div>
          </header>

          <section className="manual-grid" aria-label="DRRMO manual sections">
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
