import React, {useEffect,  useState} from 'react';
import ReactDOM from "react-dom";
import { Route, Routes } from "react-router"
import NoAccess from './NoAccess.js';
import UserProvider from './UserProvider.js';
import TicketApp from './TicketApp.js';

const TicketRoutes = () => (
    <UserProvider>
	<Routes>
	    <Route index element={<TicketApp />} />
	    <Route path="err" element={<NoAccess />} />   
	    <Route path=":id">
		<Route index element={<TicketApp />} />
		<Route path="*" element={<TicketApp />}/>
	    </Route>
	</Routes>
    </UserProvider>
)


export default TicketRoutes;
