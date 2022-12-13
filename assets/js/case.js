import React from 'react';
import ReactDOM from "react-dom";
import { createRoot } from 'react-dom/client';
import CaseRoutes from './CaseRoutes.js';
import DashboardList from './DashboardList.js';
import {BrowserRouter} from 'react-router';
import { Route, Routes } from "react-router"
const container = document.getElementById("app");
const root = createRoot(container);

root.render(
    <BrowserRouter>
	<Routes>
	    <Route path="/cvdp/cases/*" element={<CaseRoutes />} />
	    <Route path="/cvdp/dashboard" element={<DashboardList />} />
	</Routes>
    </BrowserRouter>

);
