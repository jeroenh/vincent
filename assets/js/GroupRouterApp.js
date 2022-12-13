import React from 'react';
import ReactDOM from "react-dom";
import { Route, Routes } from "react-router"
import SearchGroupsApp from "./SearchGroupsApp";
import GroupAdminApp from "./GroupAdminApp";
import ContactApp from "./ContactApp";
import NoAccess from './NoAccess.js';
import CaseRoutes from "./CaseRoutes";
import ComponentRoutes from "./ComponentRoutes.js";

export default function GroupRouterApp() {
  return (
    <Routes>
        <Route path="/cvdp/groups/*">
            <Route index element={<SearchGroupsApp />} />
            <Route path=":id">
                <Route index element={<GroupAdminApp />}/>
                <Route path="err" element={<NoAccess />} />
            </Route>
        </Route>
	<Route path="/cvdp/contact">
	    <Route path=":id">
		<Route index element={<ContactApp />}/>
                <Route path="err" element={<NoAccess />} />
            </Route>
	</Route>
	<Route path="/cvdp/group/admin" element={<GroupAdminApp />}/>
    </Routes>
  )
}
