import React from 'react';
import ReactDOM from "react-dom";
import { Route, Routes } from "react-router"
import SearchCases from './SearchCases.js';
import CaseThreadApp from './CaseThreadApp';
import CaseStatusTable from './CaseStatusTable';
import CaseDashboard from './CaseDashboard';
import NoAccess from './NoAccess.js';

export default function CaseApp() {
  return (
    <Routes>
	<Route path="/cvdp/cases">
	    <Route index element={<SearchCases />} />
	    <Route path=":id">
		<Route index element={<CaseThreadApp />}/>
		<Route path="err" element={<NoAccess />} />
		<Route path="status" element={<CaseStatusTable />} />
		<Route path="dash" element={<CaseDashboard />} />
	    </Route>
	</Route>
    </Routes>
  )
}
