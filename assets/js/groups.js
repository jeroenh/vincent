import React from 'react';
import ReactDOM from "react-dom";
import { createRoot } from 'react-dom/client';
import {BrowserRouter} from 'react-router';
import GroupRouterApp from './GroupRouterApp';

const container = document.getElementById("app");
const root = createRoot(container);

/* this is the group search page */

root.render(
    <BrowserRouter>
	<GroupRouterApp />
    </BrowserRouter>

);

