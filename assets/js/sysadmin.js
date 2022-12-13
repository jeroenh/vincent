import React from 'react';
import ReactDOM from "react-dom";
import { createRoot } from 'react-dom/client';
import AdminRoutes from "./AdminRoutes.js"
import CSAFRoutes from "./CSAFRoutes.js"
import ManageCVEApp from "./ManageCVEApp.js";
import AdminApp from './AdminApp.js';
import DesignForm from './DesignForm.js';
import {BrowserRouter} from 'react-router';
import { Route, Routes } from "react-router"

const container = document.getElementById("app");
const root = createRoot(container);

root.render(
    <BrowserRouter>
        <Routes>
            <Route path="/cvdp/manage/system/*" element={<AdminRoutes />} />
	    <Route path="/cvdp/manage/system/" element={<AdminRoutes />} />
	    <Route path="/cvdp/manage/csaf/*" element={<CSAFRoutes />} />
	    <Route path="/cvdp/manage/cve/" element={<ManageCVEApp />} />
	    <Route path="/cvdp/manage/users/" element={<AdminApp />} />
	    <Route path="/cvdp/manage/forms">
                <Route path=":id">
                    <Route path="design" element={<DesignForm />}/>
                </Route>
            </Route>
        </Routes>
    </BrowserRouter>
);
