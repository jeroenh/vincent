import React from 'react';
import ReactDOM from "react-dom";
import { createRoot } from 'react-dom/client';
import SearchAll from './SearchAll.js';
import CaseRoutes from './CaseRoutes.js';
import TriageList from './TriageList.js';
import TriageCalendar from './TriageCalendar.js';
import SearchGroupsApp from "./SearchGroupsApp";
import GroupAdminApp from "./GroupAdminApp";
import GroupRoutes from "./GroupRoutes";
import ContactApp from "./ContactApp";
import NoAccess from './NoAccess.js';
import MyReportsApp from './MyReportsApp.js'
import ComponentTable from './ComponentTable.js';
import ComponentRoutes from './ComponentRoutes.js';
import CaseMetrics from './CaseMetrics.js';
import DashboardList from './DashboardList.js';
import SysAdminRoutes from './SysAdminRoutes.js';
import InboxRoutes from './InboxRoutes.js';
import TicketRoutes from './TicketRoutes.js';
import {BrowserRouter, Route, Routes} from 'react-router';
import UserProvider from './UserProvider.js';
import InactivityTimer from './InactivityTimer.js';
import DebugLayout from './DebugLayout';
const container = document.getElementById("app");
const root = createRoot(container);

root.render(
    <BrowserRouter>
        <Routes>
	    <Route element={<InactivityTimer />}>
		<Route path="/cvdp/components/*" element={<ComponentRoutes />} />
		<Route path="/cvdp/reports" element={<MyReportsApp />} />
		<Route path="/cvdp/cases/*" element={<CaseRoutes />} />
		<Route path="/cvdp/dashboard" element={<DashboardList />} />
		<Route path="/cvdp/triage" element={<TriageList />} />
		<Route path="/cvdp/triage/calendar" element={<TriageCalendar />} />
		<Route path="/cvdp/triage/calendar/err" element={<NoAccess />} />
		<Route path="/cvdp/metrics/" element={<CaseMetrics />} />
		<Route path="/cvdp/groups/*" element={<GroupRoutes />} />
		<Route path="/cvdp/inbox/*" element={<InboxRoutes />} />
		<Route path="/cvdp/tickets/*" element={<TicketRoutes />} />
		<Route path="/cvdp/contact">
		    <Route path=":id">
			<Route index element={<ContactApp />}/>
			<Route path="err" element={<NoAccess />} />
		    </Route>
		</Route>
		<Route path="/cvdp/group/admin" element={<GroupAdminApp />}/>
		<Route path="/cvdp/search/" element={<SearchAll />} />
		<Route path="/cvdp/manage/*" element={<SysAdminRoutes />} />
	    </Route>

        </Routes>
    </BrowserRouter>
	
);


/*<Route path="/cvdp/groups/" element={<GroupRouterApp />} />
<Route path="/cvdp/contact" element={<GroupRouterApp />} />
<Route path="/cvdp/group/*" element={<GroupRouterApp />} />*/
