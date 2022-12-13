import React from 'react';
import ReactDOM from "react-dom";
import { Route, Routes } from "react-router"
import SearchCases from './SearchCases.js';
import CaseThreadApp from './CaseThreadApp';
import CaseStatusTable from './CaseStatusTable';
import NoAccess from './NoAccess.js';
import AdvisoryApp from './AdvisoryApp.js';
import ParticipantTable from './ParticipantTable.js';
import CaseDashboard from './CaseDashboard';
import CSAFSettings from './CSAFSettings.js';
import CaseStatusXls from './CaseStatusXls.js';
import CustomCisaReport from './reports/CustomCisaReport.js';
import VulTable from './VulTable.js';
import AdvisoryRevisionApp from './AdvisoryRevisionApp.js';
import AdvisoryPreviewApp from './AdvisoryPreviewApp.js';
import CSAFValidatorModal from './CSAFValidatorModal.js';

const CaseRoutes = () => (
    <Routes>
	<Route index element={<SearchCases />} />
	<Route path=":id">
	    <Route index element={<CaseThreadApp />}/>
	    <Route path="err" element={<NoAccess />} />
	    <Route path="status" element={<CaseStatusTable />} />
	    <Route path="table" element={<CaseStatusXls />} />
	    <Route path="advisory">
		<Route index element={<AdvisoryApp />} />
		<Route path="revisions" element={<AdvisoryRevisionApp />} />
		<Route path="preview" element={<AdvisoryPreviewApp />} />
		<Route path="validator" element={<CSAFValidatorModal />} />
	    </Route>
	    <Route path="participants" element={<ParticipantTable />} />
	    <Route path="vuls" element={<VulTable />} />
	    <Route path="dash" element={<CaseDashboard />} />
	    <Route path="csaf" element={<CSAFSettings />} />
	</Route>
    </Routes>
)

export default CaseRoutes;
