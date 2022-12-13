import React, {useEffect,  useState} from 'react';
import ReactDOM from "react-dom";
import { Route, Routes } from "react-router"
import SearchGroupsApp from "./SearchGroupsApp";
import GroupAdminApp from "./GroupAdminApp";
import NoAccess from './NoAccess.js';
import UserProvider from './UserProvider.js';
import UnverifiedContacts from './UnverifiedContacts.js';

const GroupRoutes = () => (
    <UserProvider>
	<Routes>
	    <Route index element={<SearchGroupsApp />} />
            <Route path=":id">
                <Route index element={<GroupAdminApp />}/>
                <Route path="err" element={<NoAccess />} />
            </Route>
	    <Route path="unverified" element={<UnverifiedContacts />}/>
	</Routes>
    </UserProvider>
)


export default GroupRoutes;
