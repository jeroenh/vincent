import React from 'react';
import ReactDOM from "react-dom";
import { createRoot } from 'react-dom/client';
import SearchCases from './SearchCases.js';

const container = document.getElementById("app");
const root = createRoot(container);

root.render(
    <SearchCases
    />                                                                                             

);
