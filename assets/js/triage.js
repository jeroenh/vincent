import React from 'react';
import ReactDOM from "react-dom";
import { createRoot } from 'react-dom/client';
import {BrowserRouter} from 'react-router';
import TriageApp from './TriageApp.js';

const container = document.getElementById("app");
const root = createRoot(container);

root.render(
    <React.StrictMode>
	<BrowserRouter>
	    <TriageApp
	    />
	</BrowserRouter>
    </React.StrictMode>

);


