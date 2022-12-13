import React, { useState, useEffect } from "react";
import {Form} from "react-bootstrap";

/**
   This input allows for pauses while user types so we don't
   hammer the API with unnecessary requests */

const DebouncedSearch = ({initialVal, setSearchVal}) => {
    
    const [query, setQuery] = useState(initialVal | "");  // The search query typed by user
    const [debouncedQuery, setDebouncedQuery] = useState(query);  // Debounced value
    const [skipLoad, setSkipLoad] = useState(false);
    
    useEffect(() => {
	// Set a timeout to update debounced value after 500ms
	const handler = setTimeout(() => {
	    setDebouncedQuery(query);
	}, 500);
	
	// Cleanup the timeout if `query` changes before 500ms
	return () => {
	    clearTimeout(handler);
	};
    }, [query]);


    useEffect(() => {
	setQuery(initialVal);
    }, [initialVal]);

    
    // Whenever debouncedQuery changes, simulate an API call
    useEffect(() => {
	if (skipLoad) {
	    setSearchVal(debouncedQuery);
	} else {
	    /* skip initial load */
	    setSkipLoad(true);
	}
    }, [debouncedQuery]);
    
    return (
	<>
	    <Form.Control
		type="text"
		value={query}
		onChange={(e) => setQuery(e.target.value)}
	    />
	</>
    );
};

export default DebouncedSearch;
