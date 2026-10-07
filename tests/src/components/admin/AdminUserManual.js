import { Link } from "react-router-dom";
import {
  FaBoxOpen,
  FaClipboardCheck,
  FaHandHoldingHeart,
  FaPeopleCarry,
  FaShieldAlt,
  FaUserCog,
} from "react-icons/fa";
import DashboardShell from "../layout/DashboardShell";
import "../css/UserManual.css";

const manualSections = [
  {
    title: "Review barangay requests",
    description:
      "Use this page to assess every barangay request before it moves into the release process.",
    Icon: FaClipboardCheck,
    to: "/admin/relief-lists",
    action: "Open relief requests",
    actions: [
      ["Select a request", "Opens the barangay details, affected families, requested support, and submitted records."],
      ["Approve", "Confirms a pending request and sends it to the release planner."],
      ["Reject", "Declines a pending or approved request. A rejection reason is required."],
      ["Open Release Planner", "Appears after approval and opens the matching request in Inventory."],
    ],
  },
  {
    title: "Prepare and release aid",
    description: "Build one documented release for the approved barangay request.",
    Icon: FaHandHoldingHeart,
    to: "/admin/inventory",
    action: "Open release planner",
    actions: [
      ["Select template", "Chooses the food pack contents and calculates the stock needed for every pack."],
      ["Add appliances", "Selects the appliance item and quantity to release from available inventory."],
      ["Enter monetary amount", "Sets the approved cash amount and applies it to available monetary inventory."],
      ["Submit release", "Requires release proof and records the release for barangay receipt."],
    ],
  },
  {
    title: "Manage inventory",
    description: "Maintain the goods, appliances, and monetary records that are available for operations.",
    Icon: FaBoxOpen,
    to: "/admin/inventory",
    action: "Open inventory",
    actions: [
      ["Add Donations", "Opens the form for recording a new goods, appliance, or monetary inventory entry."],
      ["Edit", "Updates an existing item’s details, stock information, and supporting records."],
      ["Archive", "Removes an inactive item from the active list without deleting its history."],
      ["Food Pack Templates", "Creates or updates reusable food pack contents for relief releases."],
    ],
  },
  {
    title: "Validate donations",
    description: "Review each submitted donation before it is accepted into the central inventory.",
    Icon: FaPeopleCarry,
    to: "/admin/donations/queue",
    action: "Open donation queue",
    actions: [
      ["Select a donation", "Displays donor details, item or amount, submitted proof, and current review status."],
      ["Mark Received", "Accepts the donation and moves it into the appropriate inventory type."],
      ["Mark Not Received", "Records that the donation was not received and keeps it out of inventory."],
      ["Filters", "Narrow the queue by status or donation type when reviewing a large number of submissions."],
    ],
  },
  {
    title: "Account Management",
    description: "Create, update, restore, and review the accounts used across the system.",
    Icon: FaUserCog,
    to: "/admin/accounts",
    action: "Open account management",
    actions: [
      ["Register", "Creates an account and assigns its role before the user can sign in."],
      ["Edit Accounts", "Updates active user information and role-related account details."],
      ["Archived", "Restores an archived account when a user needs access again."],
      ["Activity Logs", "Reviews account-related changes for accountability and troubleshooting."],
    ],
  },
  {
    title: "Evacuation Centers",
    description: "Maintain the verified evacuation locations shown to barangays and the public.",
    Icon: FaShieldAlt,
    to: "/evacuation",
    action: "Open evacuation centers",
    actions: [
      ["Add center", "Creates a new evacuation center with its location, capacity, and contact details."],
      ["Edit", "Updates center information when capacity, facilities, or contact details change."],
      ["Map and coordinates", "Sets the location used by the public map and barangay planning tools."],
      ["Archive", "Removes an unavailable center from active use while preserving its record."],
    ],
  },
  {
    title: "Announcements",
    description: "Publish time-sensitive public notices for operations, hazards, and community updates.",
    Icon: FaPeopleCarry,
    to: "/admin/announcements",
    action: "Open announcements",
    actions: [
      ["Create announcement", "Starts a new public notice with its title, message, priority, and visibility."],
      ["Publish", "Makes a completed announcement visible on the public landing page."],
      ["Edit", "Corrects or updates a notice while keeping its latest information available."],
      ["Archive", "Removes an outdated notice from the active public feed."],
    ],
  },
  {
    title: "Guidelines",
    description: "Maintain preparedness and safety guidance that residents can read on the public portal.",
    Icon: FaClipboardCheck,
    to: "/admin/guidelines",
    action: "Open guidelines",
    actions: [
      ["Create guideline", "Adds a new preparedness, response, or recovery guide."],
      ["Publish", "Makes the completed guideline available to the public."],
      ["Edit", "Updates the content when official instructions change."],
      ["Archive or restore", "Hides an outdated guide or restores one when it becomes relevant again."],
    ],
  },
  {
    title: "Time In & Time Out",
    description: "Review attendance records that help coordinate personnel during daily and emergency operations.",
    Icon: FaUserCog,
    to: "/admin/time-in-time-out",
    action: "Open attendance records",
    actions: [
      ["Time In", "Records or reviews the start of a staff member’s duty period."],
      ["Time Out", "Records or reviews the end of a staff member’s duty period."],
      ["Date and staff filters", "Narrows attendance records to a specific period or person."],
      ["Review history", "Checks previous attendance entries when validating operational coverage."],
    ],
  },
  {
    title: "Keep a record",
    description: "Follow operational activity and respond to updates that need administrative attention.",
    Icon: FaShieldAlt,
    to: "/admin/audit-trail",
    action: "Open audit trail",
    actions: [
      ["Audit Trail", "Shows who performed important system actions and when they occurred."],
      ["Notifications", "Shows unread alerts from inventory, relief, evacuation, and guideline modules."],
      ["Time In & Time Out", "Reviews staff attendance records used for operational coordination."],
      ["Filters and search", "Use available filters to focus on the user, module, status, or date you need."],
    ],
  },
];

export default function AdminUserManual() {
  return (
    <DashboardShell variant="admin">
      <main className="manual-page">
        <section className="manual-shell" aria-labelledby="admin-manual-title">
          <header className="manual-hero">
            <div>
              <span className="manual-kicker">ADMIN WORKSPACE</span>
              <h1 id="admin-manual-title">Administrator User Manual</h1>
            </div>
            <div className="manual-role-note">
              <FaShieldAlt aria-hidden="true" />
              <span>Administrator access</span>
            </div>
          </header>

          <section className="manual-grid" aria-label="Administrator manual sections">
            {manualSections.map(({ title, description, Icon, to, action, actions }) => (
              <article className="manual-card" key={title}>
                <div className="manual-card-icon" aria-hidden="true">
                  <Icon />
                </div>
                <h2>{title}</h2>
                <p>{description}</p>
                <dl className="manual-action-list">
                  {actions.map(([button, explanation]) => (
                    <div key={button}>
                      <dt>{button}</dt>
                      <dd>{explanation}</dd>
                    </div>
                  ))}
                </dl>
                <Link to={to} className="manual-card-link">
                  {action}
                  <span aria-hidden="true">→</span>
                </Link>
              </article>
            ))}
          </section>
        </section>
      </main>
    </DashboardShell>
  );
}
