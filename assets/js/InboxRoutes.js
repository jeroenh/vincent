import React, {useEffect,  useState} from 'react';
import ReactDOM from "react-dom";
import { Route, Routes } from "react-router"
import NoAccess from './NoAccess.js';
import UserProvider from './UserProvider.js';
import InboxApp from './InboxApp.js';

const InboxRoutes = () => (
    <UserProvider>
	<Routes>
	    <Route index element={<InboxApp />} />
	    <Route path=":id">
		<Route index element={<InboxApp />} />
		<Route path="*" element={<InboxApp />}/>
	    </Route>
	</Routes>
    </UserProvider>
)


export default InboxRoutes;
