import React from 'react';
import ReactDOM from "react-dom";
import { createRoot } from 'react-dom/client';
import {BrowserRouter} from 'react-router';
import { Route, Routes } from "react-router";
import LoadInboxApp from './LoadInboxApp.js'
import InactivityTimer from './InactivityTimer.js';

const container = document.getElementById("mailapp");
var contactmsg=null;
if (document.getElementById('contact')) {
    contactmsg = JSON.parse(document.getElementById('contact').textContent);
}
var message = null;
if (document.getElementById('message')) {
    message = document.getElementById('message').getAttribute("val");
}
const coord = container.getAttribute("val");
const root = createRoot(container);

root.render(
    <BrowserRouter>
        <Routes>
	    <Route element={<InactivityTimer />}>
		<Route path="/cvdp/inbox/*" element={
			   <LoadInboxApp
			       coord = {coord}
			       contactmsg = {contactmsg}
			       message = {message}
			   />} />
	    </Route>
	</Routes>
    </BrowserRouter>
);
