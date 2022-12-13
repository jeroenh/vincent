import React from 'react';
import ReactDOM from "react-dom";
import { createRoot } from 'react-dom/client';
import AdminRoutes from "./AdminRoutes.js"
import CSAFRoutes from "./CSAFRoutes.js"
import ManageCVEApp from "./ManageCVEApp.js";
import EmailBounceTable from "./EmailBounceTable";
import AdminApp from './AdminApp.js';
import DesignForm from './DesignForm.js';
import {BrowserRouter} from 'react-router';
import { Route, Routes } from "react-router"

const SysAdminRoutes = () => (
    <Routes>
        <Route index element={<AdminRoutes />} />
	<Route path="system/*" element={<AdminRoutes />} />
	<Route path="csaf/*" element={<CSAFRoutes />} />
	<Route path="bounces" element={<EmailBounceTable />} />
	<Route path="cve" element={<ManageCVEApp />} />
	<Route path="users" element={<AdminApp />} />
	<Route path="forms">
            <Route path=":id">
                <Route path="design" element={<DesignForm />}/>
            </Route>
        </Route>
    </Routes>
)

export default SysAdminRoutes;
