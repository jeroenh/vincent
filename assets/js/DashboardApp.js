import React from 'react';
import ReactDOM from "react-dom";
import { Route, Routes } from "react-router"
import DashboardList from './DashboardList.js';
import SearchCases from './SearchCases.js';
import CaseThreadApp from './CaseThreadApp'
import NoAccess from './NoAccess.js';
import CaseRoutes from './CaseRoutes.js';


export default function DashboardApp() {
  return (
      <Routes>
	  <Route index path="/cvdp/dashboard" element={<DashboardList />}/>
	  <Route path="/cvdp/cases/*" element={<CaseRoutes />} />
    </Routes>
  )
}
