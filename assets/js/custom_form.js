import React from 'react';
import ReactDOM from "react-dom";
import { createRoot } from 'react-dom/client';
import InactivityTimer from './InactivityTimer.js';
import CustomCisaReport from './reports/CustomCisaReport.js';
import {BrowserRouter, Route, Routes} from 'react-router';

const container = document.getElementById("app");
const root = createRoot(container);

root.render(
    <BrowserRouter>
        <Routes>
            <Route element={<InactivityTimer />}>
		<Route path="/cvdp/report" element={<CustomCisaReport />} />
		<Route path="/cvdp/cases/:id/report/edit/" element={<CustomCisaReport edit={true}/>} />
	    </Route>
	</Routes>
    </BrowserRouter>
);


