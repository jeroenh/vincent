import React from 'react';
import ReactDOM from "react-dom";
import { Route, Routes } from "react-router"
import NoAccess from './NoAccess.js';
import CSAFAdminApp from './CSAFAdminApp.js';
import CSAFProfile from "./CSAFProfile.js";

const AdminRoutes = () => (
    <Routes>
	<Route index element={<CSAFAdminApp />} />
        <Route path=":id">
	    <Route index element={<CSAFAdminApp />} />
            <Route path="err" element={<NoAccess />} />
	    <Route path="create" element={<CSAFProfile />} />
	    <Route path="edit" element={<CSAFProfile />} />
        </Route>
	<Route path="create" element={<CSAFProfile />} />
	<Route path="edit" element={<CSAFProfile />} />
    </Routes>
)

export default AdminRoutes;
