import React, {useEffect,  useState} from 'react';
import ReactDOM from "react-dom";
import { Route, Routes } from "react-router"
import ComponentTable from './ComponentTable.js';
import ComponentDetail from './ComponentDetail.js';
import NoAccess from './NoAccess.js';
import UserProvider from './UserProvider.js';

const ComponentRoutes = () => (
    <UserProvider>
	<Routes>
	    <Route index element={<ComponentTable />} />
	    <Route path=":id">
		<Route index element={<ComponentDetail />}/>
		<Route path="err" element={<NoAccess />} />
	    </Route>
	</Routes>
    </UserProvider>
)


export default ComponentRoutes;
