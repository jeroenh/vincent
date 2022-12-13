import React from 'react';
import { useCallback, useState, useEffect, useRef } from 'react';
import AdminAPI from './AdminAPI.js'
import {Typeahead, AsyncTypeahead} from 'react-bootstrap-typeahead';
import {Badge} from 'react-bootstrap';
import 'react-bootstrap-typeahead/css/Typeahead.bs5.css';
import 'react-bootstrap-typeahead/css/Typeahead.css';
import '../css/casethread.css'

const adminapi = new AdminAPI();


const CACHE = {};

const PER_PAGE = 50;

function makeAndHandleRequest(query, page = 1) {

    return adminapi.getCWEs(query).then((response) => {
        console.log(response);
        const items = response.results;
        const total_count = response.length;
        const options = items.map((i) => ({
            cwe: i.cwe,
            description: i.description,
            children: i.children,
            usage: i.usage,
            slice: i.slice_1003,
        }));
        return {options, total_count};

    });
}


const CWETypeahead = (props) => {

    const [error, setError] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [query, setQuery] = useState("");
    const [options, setOptions] = useState([]);
    const [cwes, setCWEs] = useState([]);
    const ref = useRef(null);


    const handleCWESearch = (q) => {
        //console.log(q);
        if (CACHE[q]) {
            setCWEs(CACHE[q].options);
            return;
        }
        setIsLoading(true);
	let query = `page_size=200&search=${q}`;
        makeAndHandleRequest(query).then((resp) => {
            CACHE[q] = { ...resp, page: 1 };
            //console.log("OPTIONS ARE>>>>>>>", resp.options);
            setIsLoading(false);
            setCWEs(resp.options);
        });
    }


    const getUsageColor = (usage) => {
        switch (usage) {
        case 'Allowed':
            return 'success';
        case 'Discouraged':
            return 'warning';
        case 'Prohibited':
            return 'danger';
        default:
            return 'info';
        }
    }


    return (

	<AsyncTypeahead
            id="cwe"
            name="cwe"
            paginate
            multiple
	    ref={ref}
            onSearch={handleCWESearch}
            isLoading={isLoading}
            labelKey="cwe"
            options={cwes}
            className="typeahead"
            onChange={(e) => (
		props.setCWEs(e)
            )}
            selected={props.cwes}
            placeholder="Add problem type(s)..."
            renderMenuItemChildren={(option) => (
                <div className="d-flex align-items-center gap-2">
                    <span className="fw-500">{option.cwe}</span>
                    <Badge pill bg={getUsageColor(option.usage)}>{option.usage}</Badge>
                    {option.children.length > 0 &&
                     <Badge bg="primary">Has Children</Badge>
                    }
                    {option.slice &&
                     <Badge bg="secondary">NVD</Badge>
                    }
                </div>
            )}
        />

    )

}

export default CWETypeahead;
