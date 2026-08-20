# Orbit-P ERP (Pattaya Aviation)

Orbit-P is the Enterprise Resource Planning (ERP) and Manpower Management system for Pattaya Aviation. It handles recruitment tracking, manpower requests, and probation management.

## 🎨 UI & Design System

The application features a **Clean Light Theme** and a **High-Contrast Dark Theme** with a **Floating Pill Navigation** architecture.

### Key Features
- **PillNav Structure**: A floating top navigation bar that provides a clean, focused user experience, featuring an animated sun/moon theme toggle.
- **Dynamic Theming**: 
  - **Light Mode**: A soft slate palette (`#F8FAFC` background, white cards) for a modern enterprise feel.
  - **Dark Mode**: A sleek, high-contrast dark palette (`#000000` background, `#121212` cards) for comfortable low-light viewing.
- **Animated Interactions**: Smooth, performant transitions using Framer Motion (e.g., sliding profile drawers, staggered lists).
- **Automated Position Adjustments & Transfers**: Schedule future organizational changes via an intuitive cascading selection UI. A built-in Native Background Service automatically executes the updates in DynamoDB on the designated effective date without manual intervention.

## 🆕 Recent Enhancements
- **Extended Employee Profile Fields & Real-time LINE Avatar Integration (May 29, 2026)**:
  - **Dynamic Extended Profile Fields**: Added new parameters inside `EmployeeProfileDrawer` including เลขบัญชีธนาคาร (Bank Account) moved inside the premium "Identity" section, อายุงาน (Tenure) calculated dynamically (`useMemo`) from `contractStart` to `resignDate` or Today, an admin-editable LINE Webhook connection status, and Attached Documents (`เอกสารแนบ`) uploader (base64) & downloader.
  - **Redundant Info Cleanup**: Removed the legacy single-line "Emergency Contact" from the "Contact & Address" section since structured emergency fields (Name, Relationship, Phone) are already grouped under "Additional Information".
  - **Real-Time LINE Avatar Integration & Editable URL**: Added `line_avatar_url` attribute in AWS DynamoDB `fullstaff` table and SQLite `LineWebhook` connections. Implemented an admin-editable "LINE Avatar URL" input field inside the drawer.
  - **Intelligent Session-Based Auto-Sync**: Designed an automated `useEffect` sync hook. When a user logged in via LINE Login opens their own profile drawer, the system automatically retrieves their real LINE profile picture from their active session, saves it in both DynamoDB and SQLite, and instantly updates the UI in real-time.
  - **Dynamic Cache-Busting Pipeline**: Solved browser/Next.js dynamic GET caching on the staging server by appending dynamic query parameters (`?t=${Date.now()}`) to the API calls, guaranteeing fresh database lookups and instant profile picture rendering.
- **Authentic LINE LIFF Integration & Mock Profile Cleanup (May 28, 2026)**:
  - **Production-Grade LINE LIFF SDK Integration**: Replaced the entire mock simulation suite, dummy user lists (`Somchai`, `Wichai`, `Pattama`), fake QR scanner overlays, and simulation dialogues with the official **LINE LIFF SDK** (`2008863753-eyUoNYLk` / Client ID `2008863753`) loaded dynamically in the browser, redirecting authentic LINE credentials to the official LINE Auth server seamlessly.
  - **Real-Time Profile Extraction & Verification**: Retrieved user's actual **LINE Avatar**, **LINE Name**, and **LINE User ID** from LINE servers via `liff.getProfile()`. Validated their identity recursively against the **AWS DynamoDB `fullstaff` table** in real-time via `/api/auth/line/lookup?lineUserId=REAL_ID`.
  - **Emerald Green Verified UI Card**: Configured a premium, glowing emerald badge showing their real LINE avatar and name for verified employee profiles, and a copyable LINE User ID with a clipboard icon and a "Disconnect/Logout LINE" button for unverified accounts.
  - **Sandbox Dev ID Search Fallback**: Implemented a minimalist, neat manual database lookup field, allowing developers or administrators to search the real DynamoDB tables by LINE ID (e.g. testing `U05f37b7ea3767138d0681671464ec354`) to do authentic validation on local or non-HTTPS staging servers without mocks.
- **Probation Evaluation & Automated Transitions (May 28, 2026)**:
  - **Multi-Outcome Evaluation Modal (`PassProbationModal.tsx`)**: Replaced a simple "Pass Probation" confirmation with a premium, multi-outcome Probation Evaluation card, supporting:
    - **Pass (ผ่าน)**: Saves details but maintains `"Probation"` type until the official end date is reached.
    - **Fail (ไม่ผ่าน)**: Dynamically opens a last working date calendar, transitioning employee status to `"Failed Probation"` on date arrival.
    - **Extend (ขยายเวลา)**: Dynamically calculates new probation dates and displays live day countdowns for 30/60/90 days extension presets.
  - **Self-Healing State Syncing (`route.ts`)**: Built automatic, self-healing status transitions directly in the GET employee list API layer. When any user visits the directory, the server automatically checks if probation passed/failed dates are reached and updates their records in AWS DynamoDB seamlessly with zero downtime.
- **Remote Production Building & VPS Deployment Pipeline (May 28, 2026)**:
  - **GitHub CI/CD Automation & Staging Staging Sync**: Configured push integrations. Pushing local commits to GitHub `origin/main` automatically triggers the GitHub Actions workflow (`deploy.yml`) to sync, pull, compile, and hot-reload changes on the live production VPS (`43.210.174.224`).
  - **Zero-Downtime Live Updates**: The deployment pipeline builds the production bundle and reloads the application using **PM2 Process Manager (`pm2 restart all`)** with zero downtime, rendering updates instantly on the live domain: **[https://orbithire.pattayaaviation.com](https://orbithire.pattayaaviation.com)**.
- **Interactive Date Range Filter & Probation Countdown Badges (May 27, 2026)**:
  - **Dynamic Date Range Filtering**: Implemented an interactive Date Range popover filter. It dynamically switches behaviors based on the active tab: filters by **Resignation Date** (`resignDate`) inside the `"Resigning"` tab, and by **Start Date** (`contractStart`) inside all other tabs. Displays localized Thai date ranges for enhanced usability.
  - **Active Tab Probation Badges**: Configured the `"Active"` tab directory to automatically show the probation countdown badges for active employees still on probation, matching the `"Probation"` tab’s color-coded urgency alerts.
- **OrbitHire Rebranding & Recruitment SQLite Integration (May 25, 2026)**:
  - Rebranded the entire ERP platform to **OrbitHire ERP**, aligning the header, sidebar, and metadata title/descriptions.
  - Integrated the Applicant Tracking System (ATS) recruitment module with a local SQLite database via Prisma, supporting candidate Kanban states, screening stages, and seamless local data storage.
- **Organization Free Canvas & Real-time Drag-and-Drop Deployment**:
  - Fully implemented and deployed the **"กระดานอิสระ" (Free Canvas)** layout mode.
  - Added support for absolute-positioned node cards on the infinite whiteboard canvas, enabling real-time card dragging with automatic coordinate saving directly to Amazon DynamoDB (`PA_OrgStructure`).
  - Implemented dynamic **SVG Bezier connections** that dynamically recalculate and curved paths in real-time as cards are moved.
  - Enabled drag-to-reparent snapping drop zones with violet pulsing outlines, automatically reorganizing position hierarchies recursively in DynamoDB upon card release.
  - Added a dedicated **"Auto Align Layout"** reset button to clear custom coordinates in DynamoDB and restore computed tree defaults.
- **"All Employees" Unified Directory & Status Badging**:
  - Added a new **"All"** filter tab at the beginning of the status bar, allowing users to view the entire staff directory simultaneously without status restrictions (displays active, probationary, and resigned staff in a single unified list).
  - Implemented premium **Inline Status Badges** (e.g. green `Active` badge, light red `Resigned`/`Resigning` status badge, and slate neutral badges) inside the list items for effortless distinction when browsing all staff categories together.
  - Fully optimized list rendering and coordinate states with Amazon DynamoDB query results.
- **Probation Monitoring & Direct Status Transition**:
  - Added a dedicated, complete, and alphabetically sorted **"Probation" (ทดลองงาน)** tab within the Employees module to monitor all active employees currently on probation.
  - Implemented dynamic evaluation countdown badges (Overdue, Ends Today, Critical, Standard) with color-coded HSL alerts and Lucide icons.
  - Added a smart calculations engine in `EmployeeList.tsx` that automatically projects missing probation end dates to exactly 118 days from the employee's start date when database dates are incomplete.
  - Added a beautiful, premium **"Pass Probation"** button inside the profile drawer to transition probation status directly to `"Normal"` in DynamoDB via the `/api/employees/update` API endpoint.
  - Implemented smart visibility logic to automatically hide the "Pass Probation" button for resigned or resigning employees.
  - **Contractor Staff Categorization & Exclusion**: Automatically categorizes employees whose ID begins with `"80"` in Staff level positions (e.g., `"พนักงานบริการรถเข็นผู้โดยสาร" / "Wheelchair Service Staff"`) as `"Contractor"` rather than `"Normal"` or `"Probation"`. These employees display a dedicated Contractor status badge, and are cleanly excluded from the probation tracking board. 
  - **Agent Level Eligibility**: Employees in Agent level positions (e.g., `"เจ้าหน้าที่บริการรถเข็นผู้โดยสาร" / "Wheelchair Service Agent"`) are classified as `"Probation"` (or `"Normal"` after passing) and undergo standard probation tracking regardless of their ID prefix.
  - Fully enabled inline profile editing capabilities (Edit Profile, Save, Cancel) directly within the sliding drawer.
- **Employee Profile UI Overhaul**:
  - Expanded profile drawer width (`max-w-xl`) for improved readability.
  - Implemented Body Scroll Lock to prevent background scrolling while the drawer is open.
  - Smart Avatar Initials accurately extract the first letters of English first and last names (ignoring titles like Mr./Ms.).
  - Added a new red "Resign" action button alongside optimized "Position Adjustment" and "Transfer" buttons.
  - Implemented dynamic, color-coded status badges within the profile header (e.g. green for `"Active"` status, and high-visibility red for `"Resign"`/`"Resigned"` status for clear visual distinction from working staff).
- **Data & Forms**:
  - Enforced consistent `DD/MM/YYYY` date formatting across both read and edit modes using native date pickers.
  - Implemented seamless cascading dropdowns (`Department -> Division -> Section -> Unit -> Position`) using live organizational data.
- **Search & Filtering Upgrades**:
  - Automatically sorts all dropdown options (Departments, Divisions, Sections, Stations, Units) alphabetically based on their English abbreviation codes (e.g. GA, GB, GC) for uniform organizational alignment.
  - Granular Unit-level and Station-level search integration inside the Employee directory and Organization Chart headers.
- **Native Background Service**:
  - Configured Next.js `instrumentation.ts` to run a continuous background service (daemon).
  - Automatically scans DynamoDB every hour to apply scheduled position adjustments and transfers exactly when their effective date arrives.
- **Advanced Interactive Organization Chart (Whiteboard & Flowchart)**:
  - **Free Canvas Mode (Whiteboard Layout):** Supports absolute-positioned draggable node cards on an infinite interactive whiteboard container. Custom coordinate offsets `(x, y)` are saved in real-time to DynamoDB via `PUT /api/organization/layout` and can be reset with **"Auto Align Layout"**.
  - **Drag-to-Reparent Snapping Drop:** In Edit Mode, dragging a card (e.g. Section, Unit) near a valid parent highlights it with a violet pulsing outline and drop zone tooltip. Dropping the card automatically triggers a reparenting database command (`PUT /api/organization/reparent`) to reorganize position hierarchies recursively without cyclic loop conflicts.
  - **Dynamic SVG Bezier Connections:** Replaced nested CSS lines in Free Canvas mode with highly customizable dynamic SVG paths joining parent/child nodes.
  - **Real-Time Line Styling Customizer:** Features live controls in the Appearance Panel to modify connecting lines:
    - *Line Style:* Solid, Dashed, or Dotted stroke formats.
    - *Thickness:* Ranging from `1px` (thin) to `4px` (thick).
    - *Curvature:* Choose between Sharp angles (`0px`), Rounded joints (`6px`), or Curved Bezier arcs (`12px`).
    - *Custom Color Picker:* Dedicated native HTML5 color box with live Hex readout and theme reset support.
  - **Backdrop & Density Presets:** Switch background styles (Dotted Grid, graph-paper Grid, Solid) and density cards (Detailed, Compact, Minimal) to fine-tune readability.
  - **Fluid Pan & Zoom Viewport:** Drag to pan anywhere on the infinite canvas, with mousewheel scaling (`Ctrl + wheel`) and custom zoom buttons.



## 🚀 Modules

1. **Control Tower (Dashboard)**: Real-time overview of recruitment metrics, SLA risks, and recent activity.
2. **Organization**: Organizational structure management.
3. **Manpower Request**: Intelligent approval workflow for requesting new headcount or replacing staff.
4. **Employees**: Comprehensive directory of all staff (`fullstaff`) with robust filtering and a detailed slide-out profile drawer. Features an automated Position Adjustment & Transfer scheduling system. *(Note: Connects to AWS DynamoDB; requires IAM Access Keys in `.env`).*
5. **Applicant Tracking (ATS)**: Kanban-style board for managing candidates.
6. **Probation Tracker**: Automated evaluation system for 30, 60, and 90-day probation periods.

## 🛠 Tech Stack

- **Framework**: Next.js (App Router)
- **Styling**: Tailwind CSS, Framer Motion
- **Icons**: Lucide React
- **Charts**: Recharts

## 💻 Getting Started

First, install dependencies:
```bash
npm install
```

Run the development server:
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.
