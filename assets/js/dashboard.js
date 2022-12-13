import React from 'react';
import ReactDOM from "react-dom";
import { createRoot } from 'react-dom/client';
import DashboardApp from './DashboardApp.js';
import {BrowserRouter} from 'react-router';
const container = document.getElementById("app");
const root = createRoot(container);

root.render(
    <BrowserRouter>  
	<DashboardApp
	/>
    </BrowserRouter>

);


