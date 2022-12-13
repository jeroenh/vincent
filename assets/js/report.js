import React from 'react';
import ReactDOM from "react-dom";
import { createRoot } from 'react-dom/client';
import {BrowserRouter} from 'react-router';
import DesignForm from './DesignForm.js';
import { Route, Routes } from "react-router"
const container = document.getElementById("app");
const formid = container.getAttribute("formid");
const root = createRoot(container);

root.render(
    <BrowserRouter>
	<Routes>
	    <Route path="/cvdp/manage/forms">
		<Route path=":id">
		    <Route path="design" element={<DesignForm />}/>
		</Route>
	    </Route>
	</Routes>
    </BrowserRouter>

);
